import type { PrismaClient } from "@prisma/client";
import type { FinishCode, RateTier, StructureCode, VendorCapabilities } from "../src/types";
import { materialFitsStructure } from "../src/lib/dieline/materials";

/**
 * Catalogue capability extension (additive, runs after the vendor seed). Widens what seeded
 * Egyptian printers make to the families they realistically run, so more catalogue models get
 * more than one instant offer:
 *
 * - Damietta (export produce and furniture cluster): self-locking produce trays, FEFCO 0422.
 * - Alexandria print house (export cartons): full telescope boxes, FEFCO 0320.
 * - Obour short-run digital shop: E-flute shipping cases (FEFCO 0201).
 * - Delta Cartons (already runs the core crash-lock carton on its gluer) lists the crash-lock and
 *   corner-glued carton models, so they get instant prices from it (B-16 "listed" models).
 *
 * New rate cards are copied from an existing card for the same structure and board, scaled by
 * the printer's own price level (its ratio to that card's vendor on a structure both price).
 * Nothing is removed or re-priced.
 */
const EXTENSIONS: { vendor: string; structures: StructureCode[] }[] = [
  { vendor: "damietta-packaging", structures: ["FEFCO_0422"] },
  { vendor: "alex-print-house", structures: ["FEFCO_0320"] },
  { vendor: "obour-box-works", structures: ["FEFCO_0201"] },
];

/** Special-gluing models (src/data/catalogue/order-mode.ts "listed") a printer confirms it makes. */
const LISTED_MODELS: { vendor: string; models: string[] }[] = [
  { vendor: "delta-cartons", models: ["ECMA_TUCK_CRASH_LOCK", "GABLE_CARRY_CLB", "ECMA_TRAY_4C", "ECMA_TRAY_BEERS", "ECMA_TRAY_BRIGHTWOOD", "ECMA_TRAY_6C_LID"] },
];

type Card = Awaited<ReturnType<PrismaClient["rateCard"]["findMany"]>>[number] & { structure: { code: string }; material: { code: string } };

const unitAt = (c: Card) => ((c.qtyTiers as unknown as RateTier[])[0]?.unitPiasters ?? 0) / Math.max(c.referenceAreaM2, 1e-6);

export async function extendCatalogueCapabilities(db: PrismaClient): Promise<{ added: number }> {
  const cards = (await db.rateCard.findMany({ include: { structure: { select: { code: true } }, material: { select: { code: true } } } })) as Card[];
  const structures = new Map((await db.structure.findMany({ select: { id: true, code: true } })).map((s) => [s.code, s.id]));
  let added = 0;
  for (const ext of EXTENSIONS) {
    const vendor = await db.vendor.findUnique({ where: { slug: ext.vendor } });
    if (!vendor) continue;
    const caps = vendor.capabilities as unknown as VendorCapabilities;
    const own = cards.filter((c) => c.vendorId === vendor.id);
    for (const code of ext.structures) {
      if (!structures.has(code)) continue;
      for (const mc of caps.materials) {
        if (!materialFitsStructure(mc, code)) continue;
        if (own.some((c) => c.structure.code === code && c.material.code === mc)) continue;
        const source = cards.find((c) => c.vendorId !== vendor.id && c.structure.code === code && c.material.code === mc);
        if (!source) continue;
        // Price level: this vendor vs the source vendor on a card both have.
        const shared = own.find((o) => cards.some((c) => c.vendorId === source.vendorId && c.structure.code === o.structure.code && c.material.code === o.material.code));
        const peer = shared && cards.find((c) => c.vendorId === source.vendorId && c.structure.code === shared.structure.code && c.material.code === shared.material.code);
        const k = shared && peer && unitAt(peer) > 0 ? unitAt(shared) / unitAt(peer) : 1;
        const tiers = (source.qtyTiers as unknown as RateTier[]).map((t) => ({ minQty: t.minQty, unitPiasters: Math.round(t.unitPiasters * k) }));
        const surcharges = Object.fromEntries(
          Object.entries((source.finishSurcharges ?? {}) as Partial<Record<FinishCode, number>>).filter(([f]) => caps.finishes.includes(f as FinishCode)).map(([f, v]) => [f, Math.round((v ?? 0) * k)]),
        );
        await db.rateCard.create({
          data: {
            vendorId: vendor.id,
            structureId: structures.get(code)!,
            materialId: source.materialId,
            qtyTiers: tiers as object[],
            referenceAreaM2: source.referenceAreaM2,
            setupPiasters: Math.round(source.setupPiasters * k),
            dieCostPiasters: Math.round(source.dieCostPiasters * k),
            printSidesSurchargePct: source.printSidesSurchargePct,
            finishSurcharges: surcharges,
            leadTimeDays: vendor.leadTimeDays,
          },
        });
        added++;
      }
      if (!caps.structures.includes(code)) caps.structures = [...caps.structures, code];
    }
    await db.vendor.update({ where: { id: vendor.id }, data: { capabilities: caps as object } });
  }
  for (const l of LISTED_MODELS) {
    const vendor = await db.vendor.findUnique({ where: { slug: l.vendor } });
    if (!vendor) continue;
    const caps = vendor.capabilities as unknown as VendorCapabilities;
    caps.models = [...new Set([...(caps.models ?? []), ...l.models])];
    await db.vendor.update({ where: { id: vendor.id }, data: { capabilities: caps as object } });
  }
  return { added };
}
