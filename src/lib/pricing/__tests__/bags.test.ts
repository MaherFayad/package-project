import { describe, expect, it } from "vitest";
import type { BagHandleKind, Dims, FinishCode, MaterialCode, RateTier } from "@/types";
import { quote } from "../engine";
import { BAG_HANDLE_COST, BAG_MOQ, bagAreaRatio, bagSizeBand, BAG_REFERENCE_AREA_M2 } from "../bags";
import { vatOf } from "../money";
import type { PricingData, PricingRateCard, QuoteInput } from "../types";
import { CFG, NOW } from "./fixtures";

const tiers = (egp: number[]): RateTier[] => [100, 250, 500, 1000, 2000].map((minQty, i) => ({ minQty, unitPiasters: Math.round(egp[i]! * 100) }));
const KRAFT: MaterialCode[] = ["BAG_KRAFT_80", "BAG_KRAFT_120", "BAG_WHITE_KRAFT_120"];
const ART: MaterialCode[] = ["BAG_ART_170", "BAG_ART_210", "BAG_ART_250"];
// Same economics as prisma/seed.ts (PAPER_BAG tiers x material multiplier).
const MULT: Record<string, number> = { BAG_KRAFT_80: 0.85, BAG_KRAFT_120: 1, BAG_WHITE_KRAFT_120: 1.15, BAG_ART_170: 3.9, BAG_ART_210: 4.3, BAG_ART_250: 4.8 };

function card(vendorId: string, m: MaterialCode): PricingRateCard {
  const art = m.startsWith("BAG_ART_");
  const finishSurcharges: Partial<Record<FinishCode, number>> = art ? { NONE: 0, MATTE_LAMINATION: 0, GLOSS_LAMINATION: 0, SPOT_UV: 480, HOT_FOIL: 190 } : { NONE: 0, VARNISH: 105, HOT_FOIL: 190 };
  return {
    vendorId,
    structureCode: "PAPER_BAG",
    materialId: m,
    qtyTiers: tiers([16, 11, 8.5, 7, 6].map((x) => x * MULT[m])),
    referenceAreaM2: BAG_REFERENCE_AREA_M2,
    setupPiasters: 90_000,
    dieCostPiasters: art ? 90_000 : 0,
    printSidesSurchargePct: 35,
    finishSurcharges,
    leadTimeDays: art ? 15 : 10,
    active: true,
  };
}

const data: PricingData = {
  materials: [...KRAFT, ...ART].map((code) => ({ id: code, code, family: "PAPER_BAG", gsm: 120, thicknessMm: 0.16 })),
  finishes: [
    { code: "NONE", setupPiasters: 0 },
    { code: "MATTE_LAMINATION", setupPiasters: 25_000 },
    { code: "GLOSS_LAMINATION", setupPiasters: 25_000 },
    { code: "VARNISH", setupPiasters: 15_000 },
    { code: "HOT_FOIL", setupPiasters: 140_000 },
    { code: "SPOT_UV", setupPiasters: 90_000 },
  ],
  vendors: [
    {
      id: "bags",
      slug: "bags",
      name: { ar: "أكياس", en: "Bags" },
      city: "ALEXANDRIA",
      rating: 4.4,
      ratingCount: 10,
      onTimePct: 92,
      leadTimeDays: 8,
      minOrderQty: 100,
      verified: true,
      status: "ACTIVE",
      capabilities: { structures: ["PAPER_BAG"], materials: [...KRAFT, ...ART], finishes: ["NONE", "MATTE_LAMINATION", "GLOSS_LAMINATION", "VARNISH", "HOT_FOIL", "SPOT_UV"], maxColors: 4, digitalShortRun: false, monthlyCapacityUnits: 1_000_000 },
    },
  ],
  rateCards: [...KRAFT, ...ART].map((m) => card("bags", m)),
  presets: {},
};

function input(code: string, dims: Dims, material: MaterialCode, quantity: number, o: { handle?: BagHandleKind; colours?: number; finishes?: FinishCode[] } = {}): QuoteInput {
  return {
    structureCode: "PAPER_BAG",
    dims,
    materialId: material,
    finishes: o.finishes ?? ["NONE"],
    printSides: "OUTSIDE",
    colours: o.colours ?? 1,
    quantity,
    zone: "GREATER_CAIRO",
    model: { code, ...(o.handle ? { features: { bagHandle: { kind: o.handle, color: "BLACK" } } } : {}) },
  };
}

const best = (i: QuoteInput) => {
  const r = quote(i, data, { config: CFG, now: NOW });
  if (r.mode !== "instant") throw new Error(`not instant: ${r.mode}`);
  return r;
};
const egpPerBag = (i: QuoteInput) => {
  const o = best(i).offers[0]!;
  // product + handle + parts + setup per bag, ex-VAT and ex-delivery (what the public lists quote)
  return (o.subtotalPiasters - o.shippingPiasters) / o.quantity / 100;
};

const MEDIUM = { L: 260, W: 120, H: 350 };

describe("bag size bands", () => {
  it("the four bands step up with the paper blank and the medium band is the rate-card reference", () => {
    expect(bagSizeBand(0.17).id).toBe("S");
    expect(bagSizeBand(0.367).id).toBe("M");
    expect(bagSizeBand(0.5).id).toBe("L");
    expect(bagSizeBand(0.81).id).toBe("XL");
    expect(bagAreaRatio(0.3, BAG_REFERENCE_AREA_M2)).toBe(1);
    expect(bagAreaRatio(0.4, BAG_REFERENCE_AREA_M2)).toBe(1);
    expect(bagAreaRatio(1.2, BAG_REFERENCE_AREA_M2)).toBeCloseTo(1.2 / 0.36, 6);
  });

  it("two sizes in one band cost the same; a bigger band costs more", () => {
    const a = best(input("BAG_TWISTED_KRAFT", { L: 250, W: 110, H: 340 }, "BAG_KRAFT_120", 500)).offers[0]!;
    const b = best(input("BAG_TWISTED_KRAFT", { L: 260, W: 120, H: 350 }, "BAG_KRAFT_120", 500)).offers[0]!;
    const xl = best(input("BAG_TWISTED_KRAFT", { L: 460, W: 160, H: 490 }, "BAG_KRAFT_120", 500)).offers[0]!;
    expect(a.lines.find((l) => l.kind === "PRODUCT")!.unitPiasters).toBe(b.lines.find((l) => l.kind === "PRODUCT")!.unitPiasters);
    expect(xl.unitPiasters).toBeGreaterThan(b.unitPiasters);
  });
});

describe("bag prices sit in the Egyptian public bands (docs/audit/bags.md)", () => {
  it("kraft twisted-handle, medium, 1 colour, 500 bags: EGP 7 to 20 per bag ex-VAT", () => {
    const p = egpPerBag(input("BAG_TWISTED_KRAFT", MEDIUM, "BAG_KRAFT_120", 500));
    expect(p).toBeGreaterThan(7);
    expect(p).toBeLessThan(20);
  });

  it("laminated art-paper rope bag, medium, CMYK, 500 to 1,000 bags: EGP 20 to 60 per bag ex-VAT", () => {
    for (const q of [500, 1000]) {
      const p = egpPerBag(input("BAG_ROPE_ART", { L: 240, W: 90, H: 320 }, "BAG_ART_210", q, { colours: 4, finishes: ["MATTE_LAMINATION"] }));
      expect(p, String(q)).toBeGreaterThan(20);
      expect(p, String(q)).toBeLessThan(60);
    }
  });

  it("more bags, lower price per bag", () => {
    const at = (q: number) => best(input("BAG_TWISTED_KRAFT", MEDIUM, "BAG_KRAFT_120", q)).offers[0]!.unitPiasters;
    expect(at(250)).toBeGreaterThan(at(500));
    expect(at(500)).toBeGreaterThan(at(1000));
    expect(at(1000)).toBeGreaterThan(at(2000));
  });
});

describe("bag handle, parts and MOQ", () => {
  it("handle line follows the handle type; SOS bags have none", () => {
    const line = (code: string, dims: Dims, m: MaterialCode, h?: BagHandleKind) => best(input(code, dims, m, 500, { handle: h, colours: 4 })).offers[0]!.lines.find((l) => l.labelKey === "pricing.line.bagHandle");
    const twisted = line("BAG_TWISTED_KRAFT", MEDIUM, "BAG_KRAFT_120", "TWISTED_PAPER")!;
    const flat = line("BAG_TWISTED_KRAFT", MEDIUM, "BAG_KRAFT_120", "FLAT_PAPER")!;
    const rope = line("BAG_ROPE_ART", { L: 260, W: 120, H: 350 }, "BAG_ART_210", "COTTON_ROPE")!;
    const satin = line("BAG_ROPE_ART", { L: 260, W: 120, H: 350 }, "BAG_ART_210", "SATIN_RIBBON")!;
    expect(flat.unitPiasters).toBeLessThan(twisted.unitPiasters);
    expect(rope.unitPiasters).toBeGreaterThan(twisted.unitPiasters);
    expect(satin.unitPiasters).toBeGreaterThan(rope.unitPiasters);
    expect(rope.unitPiasters).toBe(Math.round(BAG_HANDLE_COST.COTTON_ROPE * 1.25));
    expect(line("BAG_SOS", { L: 159, W: 97, H: 318 }, "BAG_KRAFT_80")).toBeUndefined();
  });

  it("laminated bags carry the base board line, kraft bags do not", () => {
    const has = (code: string, dims: Dims, m: MaterialCode, q: number) => best(input(code, dims, m, q, { colours: 4 })).offers[0]!.lines.some((l) => l.labelKey === "pricing.line.bagBoard");
    expect(has("BAG_ROPE_ART", { L: 240, W: 90, H: 320 }, "BAG_ART_210", 500)).toBe(true);
    expect(has("BAG_TWISTED_KRAFT", MEDIUM, "BAG_KRAFT_120", 500)).toBe(false);
  });

  it("minimum orders: kraft from 200 (first tier 250), laminated from 300 (first tier 500)", () => {
    expect(BAG_MOQ).toEqual({ machine: 200, handmade: 300 });
    expect(best(input("BAG_TWISTED_KRAFT", MEDIUM, "BAG_KRAFT_120", 100)).offers).toHaveLength(0);
    expect(best(input("BAG_TWISTED_KRAFT", MEDIUM, "BAG_KRAFT_120", 100)).ineligible[0]!.reason).toBe("BELOW_MIN_QTY");
    expect(best(input("BAG_TWISTED_KRAFT", MEDIUM, "BAG_KRAFT_120", 250)).offers).toHaveLength(1);
    expect(best(input("BAG_ROPE_ART", { L: 240, W: 90, H: 320 }, "BAG_ART_210", 250)).offers).toHaveLength(0);
    expect(best(input("BAG_ROPE_ART", { L: 240, W: 90, H: 320 }, "BAG_ART_210", 500)).offers).toHaveLength(1);
  });

  it("kraft bags are not laminated (no rate), art bags include lamination at no extra unit cost", () => {
    expect(best(input("BAG_TWISTED_KRAFT", MEDIUM, "BAG_KRAFT_120", 500, { finishes: ["MATTE_LAMINATION"] })).offers).toHaveLength(0);
    const lam = best(input("BAG_ROPE_ART", { L: 240, W: 90, H: 320 }, "BAG_ART_210", 500, { finishes: ["MATTE_LAMINATION"] })).offers[0]!;
    expect(lam.lines.some((l) => l.labelKey === "finishes.MATTE_LAMINATION")).toBe(false);
  });

  it("die-cut and bottle bags go to a quote", () => {
    for (const [code, dims, m] of [["BAG_DIECUT_PATCH", { L: 300, W: 120, H: 400 }, "BAG_KRAFT_120"], ["BAG_BOTTLE", { L: 140, W: 80, H: 390 }, "BAG_ART_210"]] as const) {
      const r = quote(input(code, dims, m, 500), data, { config: CFG, now: NOW });
      expect(r.mode, code).toBe("manual_quote");
    }
  });

  it("money: integer piasters and 14% VAT on the subtotal", () => {
    const o = best(input("BAG_GIFT_ART", { L: 180, W: 80, H: 230 }, "BAG_ART_170", 1000, { colours: 4, handle: "SATIN_RIBBON" })).offers[0]!;
    for (const l of o.lines) {
      expect(Number.isInteger(l.unitPiasters)).toBe(true);
      expect(Number.isInteger(l.totalPiasters)).toBe(true);
    }
    expect(o.vatPiasters).toBe(vatOf(o.subtotalPiasters, 0.14));
    expect(o.vatPiasters).toBe(Math.round(o.subtotalPiasters * 0.14));
    expect(o.totalPiasters).toBe(o.subtotalPiasters + o.vatPiasters);
    expect(o.lines.find((l) => l.kind === "PRODUCT")!.labelKey).toBe("pricing.line.productBag");
  });
});
