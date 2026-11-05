import "server-only";
import type {
  DimsPreset,
  EgyptCity,
  FinishCode,
  MaterialCode,
  RateTier,
  StructureCode,
  StructureFamily,
  VendorCapabilities,
} from "@/types";
import { db } from "@/lib/db";
import { fromJson } from "@/lib/json";
import { quote, type QuoteOptions } from "./engine";
import type { PricingData, PricingVendor, QuoteInput, QuoteOutcome } from "./types";

/** Load everything the pricing engine needs from the database (active rows only). */
export async function loadPricingData(): Promise<PricingData> {
  const [vendors, cards, materials, finishes, structures] = await Promise.all([
    db.vendor.findMany({ where: { status: "ACTIVE" } }),
    db.rateCard.findMany({ where: { active: true }, include: { structure: { select: { code: true } } } }),
    db.material.findMany({ where: { active: true } }),
    db.finish.findMany({ where: { active: true } }),
    db.structure.findMany({ where: { active: true }, select: { code: true, presets: true } }),
  ]);

  return {
    vendors: vendors.map(
      (v): PricingVendor => ({
        id: v.id,
        slug: v.slug,
        name: { ar: v.nameAr, en: v.nameEn },
        city: v.city as EgyptCity,
        rating: v.rating,
        ratingCount: v.ratingCount,
        onTimePct: v.onTimePct,
        leadTimeDays: v.leadTimeDays,
        minOrderQty: v.minOrderQty,
        capabilities: fromJson<VendorCapabilities>(v.capabilities),
        verified: v.verified,
        status: v.status as PricingVendor["status"],
      }),
    ),
    rateCards: cards.map((c) => ({
      vendorId: c.vendorId,
      structureCode: c.structure.code as StructureCode,
      materialId: c.materialId,
      qtyTiers: fromJson<RateTier[]>(c.qtyTiers),
      referenceAreaM2: c.referenceAreaM2,
      setupPiasters: c.setupPiasters,
      dieCostPiasters: c.dieCostPiasters,
      printSidesSurchargePct: c.printSidesSurchargePct,
      finishSurcharges: fromJson<Partial<Record<FinishCode, number>>>(c.finishSurcharges),
      leadTimeDays: c.leadTimeDays,
      active: c.active,
    })),
    materials: materials.map((m) => ({
      id: m.id,
      code: m.code as MaterialCode,
      family: m.family as StructureFamily,
      gsm: m.gsm,
      thicknessMm: m.thicknessMm,
    })),
    finishes: finishes.map((f) => ({
      code: f.code as FinishCode,
      setupPiasters: f.setupPiasters,
      unitSurchargePiasters: f.unitSurchargePiasters,
    })),
    presets: Object.fromEntries(structures.map((s) => [s.code, fromJson<DimsPreset[]>(s.presets)])),
  };
}

/** DB-backed quote (server only). */
export async function quoteFromDb(input: QuoteInput, opts: QuoteOptions = {}): Promise<QuoteOutcome> {
  return quote(input, await loadPricingData(), opts);
}
