import type { RateTier } from "@/types";
import { makeConfig, type PricingConfig } from "../config";
import type { BoardAreaProvider } from "../area";
import type { PricingData, PricingRateCard, PricingVendor, QuoteInput } from "../types";

export const NOW = new Date("2026-11-05T10:00:00.000Z");

/** Flat index so hand-computed numbers stay simple. */
export const CFG: PricingConfig = makeConfig({
  priceIndex: [{ id: "flat", effectiveFrom: "2026-01-01", fx: 1, board: {} }],
});

const tiers = (egp: number[]): RateTier[] =>
  [100, 250, 500, 1000, 2000].map((minQty, i) => ({ minQty, unitPiasters: Math.round(egp[i]! * 100) }));

const corr = ["E_FLUTE_KRAFT", "E_FLUTE_WHITE", "B_FLUTE_KRAFT"] as const;

function vendor(p: Partial<PricingVendor> & Pick<PricingVendor, "id" | "city">): PricingVendor {
  return {
    slug: p.id,
    name: { ar: p.id, en: p.id },
    rating: 4.5,
    ratingCount: 10,
    onTimePct: 95,
    leadTimeDays: 6,
    minOrderQty: 100,
    verified: true,
    status: "ACTIVE",
    capabilities: {
      structures: ["FEFCO_0427", "FEFCO_0201", "PIZZA"],
      materials: [...corr],
      finishes: ["NONE", "MATTE_LAMINATION", "GLOSS_LAMINATION"],
      maxColors: 4,
      digitalShortRun: false,
      monthlyCapacityUnits: 100_000,
    },
    ...p,
  };
}

function card(vendorId: string, structureCode: PricingRateCard["structureCode"], egp: number[], extra: Partial<PricingRateCard> = {}): PricingRateCard {
  return {
    vendorId,
    structureCode,
    materialId: "mat-ek",
    qtyTiers: tiers(egp),
    referenceAreaM2: 0.25,
    setupPiasters: 60_000,
    dieCostPiasters: 180_000,
    printSidesSurchargePct: 35,
    finishSurcharges: { NONE: 0, MATTE_LAMINATION: 90, GLOSS_LAMINATION: 80 },
    leadTimeDays: 6,
    active: true,
    ...extra,
  };
}

export function makeData(): PricingData {
  return {
    materials: [
      { id: "mat-ek", code: "E_FLUTE_KRAFT", family: "CORRUGATED", gsm: 380, thicknessMm: 1.5 },
      { id: "mat-ew", code: "E_FLUTE_WHITE", family: "CORRUGATED", gsm: 400, thicknessMm: 1.5 },
      { id: "mat-bk", code: "B_FLUTE_KRAFT", family: "CORRUGATED", gsm: 450, thicknessMm: 3 },
      { id: "mat-sbs350", code: "SBS_350", family: "FOLDING_CARTON", gsm: 350, thicknessMm: 0.48 },
    ],
    finishes: [
      { code: "NONE", setupPiasters: 0 },
      { code: "MATTE_LAMINATION", setupPiasters: 25_000 },
      { code: "GLOSS_LAMINATION", setupPiasters: 25_000 },
      { code: "SPOT_UV", setupPiasters: 90_000 },
    ],
    vendors: [
      // Offset only, Greater Cairo, cheapest base.
      vendor({ id: "nile", city: "SIXTH_OF_OCTOBER", rating: 4.7, onTimePct: 96 }),
      // Alexandria, offset, slightly cheaper but min 250.
      vendor({ id: "alex", city: "ALEXANDRIA", rating: 4.4, onTimePct: 89, minOrderQty: 250, leadTimeDays: 8 }),
      // Digital short-run shop, fast, pricier.
      vendor({
        id: "quick",
        city: "OBOUR",
        rating: 4.5,
        onTimePct: 98,
        minOrderQty: 50,
        leadTimeDays: 4,
        capabilities: {
          structures: ["FEFCO_0427"],
          materials: ["E_FLUTE_KRAFT", "E_FLUTE_WHITE"],
          finishes: ["NONE", "MATTE_LAMINATION"],
          maxColors: 4,
          digitalShortRun: true,
          monthlyCapacityUnits: 60_000,
        },
      }),
      vendor({ id: "suspended", city: "CAIRO", status: "SUSPENDED" }),
    ],
    rateCards: [
      card("nile", "FEFCO_0427", [38, 27, 19, 14, 11]),
      card("alex", "FEFCO_0427", [36, 25.5, 17.9, 13.2, 10.3], { leadTimeDays: 8 }),
      card("quick", "FEFCO_0427", [42.5, 30.2, 21.3, 15.7, 12.3], { leadTimeDays: 4 }),
      card("suspended", "FEFCO_0427", [30, 20, 15, 10, 8]),
      card("nile", "FEFCO_0201", [42, 31, 23, 18, 15], { referenceAreaM2: 0.55, dieCostPiasters: 0 }),
    ],
    presets: {
      FEFCO_0427: [
        { id: "accessories", name: { ar: "إكسسوارات", en: "Accessories" }, dims: { L: 180, W: 120, H: 50 }, standard: true },
        { id: "tshirt", name: { ar: "تيشيرت", en: "T-shirt" }, dims: { L: 300, W: 220, H: 60 }, standard: true },
        { id: "custom-look", name: { ar: "x", en: "x" }, dims: { L: 200, W: 150, H: 60 } },
      ],
    },
  };
}

/** Area provider pinned to the rate card reference area (area ratio = 1). */
export const refArea: BoardAreaProvider = () => ({
  blankAreaM2: 0.25,
  netAreaM2: 0.2,
  blankWidthMm: 500,
  blankHeightMm: 500,
  source: "dieline",
});

export const baseInput: QuoteInput = {
  structureCode: "FEFCO_0427",
  dims: { L: 250, W: 180, H: 80 },
  materialId: "mat-ek",
  finishes: [],
  printSides: "OUTSIDE",
  colours: 4,
  quantity: 500,
  zone: "GREATER_CAIRO",
};
