import { describe, expect, it } from "vitest";
import type { BagFilmChoice, BagHandleKind, Dims, MaterialCode, RateTier } from "@/types";
import { quote } from "../engine";
import { FILM_MOQ_KG, NONWOVEN_MOQ_PCS, PLASTIC_BAG_EPR_PIASTERS_PER_KG, plasticCostExtras } from "../bags";
import type { PricingData, PricingRateCard, QuoteInput } from "../types";
import { CFG, NOW } from "./fixtures";

const tiers = (egp: number[]): RateTier[] => [100, 250, 500, 1000, 2000].map((minQty, i) => ({ minQty, unitPiasters: Math.round(egp[i]! * 100) }));
const MATS: [MaterialCode, number, number][] = [
  ["PE_HDPE_50", 48, 1.03],
  ["PE_LDPE_50", 46, 1],
  ["PE_LDPE_70", 64, 1.39],
  ["PE_LDPE_100", 92, 2],
  ["NONWOVEN_PP_80", 80, 6],
  ["NONWOVEN_PP_100", 100, 7],
];
const card = (m: MaterialCode, mult: number): PricingRateCard => ({
  vendorId: "film",
  structureCode: "PLASTIC_BAG",
  materialId: m,
  qtyTiers: tiers([2.02, 1.6, 1.34, 1.18, 1.04].map((x) => x * mult)),
  referenceAreaM2: 0.365,
  setupPiasters: 90_000,
  dieCostPiasters: 0,
  printSidesSurchargePct: 35,
  finishSurcharges: { NONE: 0 },
  leadTimeDays: 10,
  active: true,
});
const data: PricingData = {
  materials: MATS.map(([code, gsm]) => ({ id: code, code, family: "PLASTIC_BAG", gsm, thicknessMm: 0.05 })),
  finishes: [{ code: "NONE", setupPiasters: 0 }],
  vendors: [
    {
      id: "film",
      slug: "film",
      name: { ar: "فيلم", en: "Film" },
      city: "OBOUR",
      rating: 4.6,
      ratingCount: 10,
      onTimePct: 94,
      leadTimeDays: 7,
      minOrderQty: 100,
      verified: true,
      status: "ACTIVE",
      capabilities: { structures: ["PLASTIC_BAG"], materials: MATS.map((x) => x[0]), finishes: ["NONE"], maxColors: 6, digitalShortRun: true, monthlyCapacityUnits: 5_000_000 },
    },
  ],
  rateCards: MATS.map(([m, , mult]) => card(m, mult)),
  presets: {},
};
const input = (code: string, dims: Dims, m: MaterialCode, q: number, film: BagFilmChoice, handle?: BagHandleKind, colours = 2): QuoteInput => ({
  structureCode: "PLASTIC_BAG",
  dims,
  materialId: m,
  finishes: ["NONE"],
  printSides: "OUTSIDE",
  colours,
  quantity: q,
  zone: "GREATER_CAIRO",
  model: { code, features: { bagFilm: film, ...(handle ? { bagHandle: { kind: handle, color: "BLACK" } } : {}) } },
});
const offer = (i: QuoteInput) => {
  const r = quote(i, data, { config: CFG, now: NOW });
  if (r.mode !== "instant") throw new Error(r.mode);
  return r;
};
const DIECUT = { L: 300, W: 80, H: 400 };

describe("plastic bag prices", () => {
  it("die-cut LDPE 50 bag: EPR line = weight x EGP 37.5/kg, at cost, rounded up", () => {
    const o = offer(input("PBAG_DIECUT", DIECUT, "PE_LDPE_50", 1000, { tone: "WHITE", gusset: "BOTTOM" })).offers[0]!;
    const epr = o.lines.find((l) => l.labelKey === "pricing.line.eprFee")!;
    expect(epr).toBeTruthy();
    // 0.365 m² x 46 g/m² = 16.8 g → 63 piasters
    expect(epr.unitPiasters).toBe(Math.ceil(0.365 * 0.046 * PLASTIC_BAG_EPR_PIASTERS_PER_KG));
    expect(PLASTIC_BAG_EPR_PIASTERS_PER_KG).toBe(3750);
  });

  it("sells per bag between EGP 1.5 and 5 at 1,000 (public EGP 58 to 90/kg bulk, short runs dearer)", () => {
    const o = offer(input("PBAG_DIECUT", DIECUT, "PE_LDPE_50", 1000, { tone: "WHITE", gusset: "BOTTOM" })).offers[0]!;
    const perBag = (o.subtotalPiasters - o.shippingPiasters) / o.quantity / 100;
    expect(perBag).toBeGreaterThan(1.5);
    expect(perBag).toBeLessThan(5);
  });

  it("thicker film costs more; prices fall with quantity", () => {
    const at = (m: MaterialCode, q: number) => offer(input("PBAG_DIECUT", DIECUT, m, q, { tone: "WHITE", gusset: "BOTTOM" })).offers[0]!.unitPiasters;
    expect(at("PE_LDPE_70", 1000)).toBeGreaterThan(at("PE_LDPE_50", 1000));
    expect(at("PE_LDPE_50", 1000)).toBeGreaterThan(at("PE_LDPE_50", 2000));
  });

  it("MOQ by weight: under 5 kg of bags there is no instant offer", () => {
    const x = plasticCostExtras({ modelCode: "PBAG_DIECUT", material: "PE_LDPE_50", gsm: 46, areaM2: 0.365 });
    expect(x.moq).toBe(Math.ceil(FILM_MOQ_KG / x.weightKg));
    expect(offer(input("PBAG_DIECUT", DIECUT, "PE_LDPE_50", 250, { tone: "WHITE", gusset: "BOTTOM" })).offers).toHaveLength(0);
    expect(offer(input("PBAG_DIECUT", DIECUT, "PE_LDPE_50", 500, { tone: "WHITE", gusset: "BOTTOM" })).offers).toHaveLength(1);
  });

  it("film prints flexo: no digital short run on PE film", () => {
    const o = offer(input("PBAG_DIECUT", DIECUT, "PE_LDPE_50", 500, { tone: "WHITE", gusset: "BOTTOM" })).offers[0]!;
    expect(o.printMethod).toBe("OFFSET");
  });

  it("non-woven bags: no EPR line, MOQ 100 pieces, sewn straps line", () => {
    expect(NONWOVEN_MOQ_PCS).toBe(100);
    const o = offer(input("PBAG_NONWOVEN", { L: 350, W: 120, H: 400 }, "NONWOVEN_PP_80", 250, { tone: "COLOUR", color: "GREEN" }, "SEWN_STRAP", 1)).offers[0]!;
    expect(o.lines.some((l) => l.labelKey === "pricing.line.eprFee")).toBe(false);
    expect(o.lines.some((l) => l.labelKey === "pricing.line.bagHandle")).toBe(true);
    const perBag = (o.subtotalPiasters - o.shippingPiasters) / o.quantity / 100;
    expect(perBag).toBeGreaterThan(6);
    expect(perBag).toBeLessThan(25);
  });

  it("quote-only plastic models never get an instant price", () => {
    for (const code of ["PBAG_SOFT_LOOP", "PBAG_CLIP", "PBAG_DRAWSTRING"]) {
      const r = quote(input(code, { L: 350, W: 100, H: 400 }, "PE_LDPE_70", 1000, { tone: "WHITE", gusset: "BOTTOM" }), data, { config: CFG, now: NOW });
      expect(r.mode, code).toBe("manual_quote");
    }
  });

  it("integer piasters everywhere", () => {
    const o = offer(input("PBAG_TSHIRT", { L: 300, W: 100, H: 400 }, "PE_HDPE_50", 2000, { tone: "WHITE" })).offers[0]!;
    for (const l of o.lines) expect(Number.isInteger(l.unitPiasters) && Number.isInteger(l.totalPiasters)).toBe(true);
    expect(o.totalPiasters).toBe(o.subtotalPiasters + o.vatPiasters);
  });
});
