import "server-only";
import type { Prisma } from "@prisma/client";
import { fromJson, toJson } from "@/lib/json";
import type { VendorCapabilities } from "@/types";

type Tx = Prisma.TransactionClient;

/**
 * Starter rate cards for a newly approved vendor (R5-JR-01).
 *
 * Nothing else in the product creates a RateCard: the vendor portal only edits existing cards and the
 * admin console has no "new rate card" form. An approved vendor therefore had no card, never matched a
 * quote and could never receive a job, while its public profile said "We'll pick this printer when you
 * price your design". On approval we now copy, for every style the vendor applied with, the median
 * active card of the other active vendors for each board (by entry price). The copies are PAUSED: they
 * price nothing until the vendor reviews the numbers on /vendor/rate-cards and ticks "Active". The
 * boards they cover are added to the vendor's materials only when the vendor has listed none yet, so
 * an activated card can match (the engine checks capabilities.materials).
 *
 * Returns the number of cards created. Idempotent: an existing (vendor, style, board) card is kept.
 */
export async function seedStarterRateCards(tx: Tx, vendorId: string): Promise<number> {
  const vendor = await tx.vendor.findUnique({ where: { id: vendorId }, select: { capabilities: true } });
  const caps = fromJson<VendorCapabilities>(vendor?.capabilities ?? null);
  const codes = caps?.structures ?? [];
  if (!codes.length) return 0;
  const structures = await tx.structure.findMany({ where: { code: { in: codes } }, select: { id: true } });
  if (!structures.length) return 0;
  const templates = await tx.rateCard.findMany({
    where: { structureId: { in: structures.map((s) => s.id) }, active: true, vendorId: { not: vendorId }, vendor: { status: "ACTIVE" } },
    include: { material: { select: { code: true } } },
  });
  const existing = await tx.rateCard.findMany({ where: { vendorId }, select: { structureId: true, materialId: true } });
  const have = new Set(existing.map((c) => `${c.structureId}|${c.materialId}`));

  const groups = new Map<string, typeof templates>();
  for (const c of templates) {
    const k = `${c.structureId}|${c.materialId}`;
    if (have.has(k)) continue;
    groups.set(k, [...(groups.get(k) ?? []), c]);
  }
  const entry = (c: (typeof templates)[number]) => {
    const tiers = fromJson<{ minQty: number; unitPiasters: number }[]>(c.qtyTiers) ?? [];
    return tiers.length ? Math.min(...tiers.map((t) => t.unitPiasters)) : Number.MAX_SAFE_INTEGER;
  };
  const materials = new Set<string>();
  let created = 0;
  for (const cards of groups.values()) {
    const sorted = [...cards].sort((a, b) => entry(a) - entry(b));
    const t = sorted[Math.floor((sorted.length - 1) / 2)]!;
    await tx.rateCard.create({
      data: {
        vendorId,
        structureId: t.structureId,
        materialId: t.materialId,
        qtyTiers: t.qtyTiers as Prisma.InputJsonValue,
        referenceAreaM2: t.referenceAreaM2,
        setupPiasters: t.setupPiasters,
        dieCostPiasters: t.dieCostPiasters,
        printSidesSurchargePct: t.printSidesSurchargePct,
        finishSurcharges: t.finishSurcharges as Prisma.InputJsonValue,
        leadTimeDays: t.leadTimeDays,
        standardDies: [],
        active: false,
      },
    });
    materials.add(t.material.code);
    created += 1;
  }
  if (caps && !caps.materials?.length && materials.size) {
    await tx.vendor.update({ where: { id: vendorId }, data: { capabilities: toJson<VendorCapabilities>({ ...caps, materials: [...materials] as VendorCapabilities["materials"] }) } });
  }
  return created;
}
