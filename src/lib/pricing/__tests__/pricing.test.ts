import { describe, expect, it } from "vitest";
import { DEFAULT_DIMS, blankAreaM2 } from "@/lib/dieline";
import type { StructureCode } from "@/types";
import {
  CITY_ZONE,
  DEFAULT_PRICING_CONFIG,
  QuoteInputError,
  boardMultiplier,
  deliveryEstimate,
  digitalOffsetBreakpoint,
  estimateBoardArea,
  flatPackBundles,
  formatPrice,
  fromQuoteRequest,
  interpolateUnit,
  makeConfig,
  priceTable,
  quote,
  resolvePriceIndex,
  toPiasters,
  toPublicOutcome,
  vatOf,
  withMargin,
  zoneForGovernorate,
  type InstantQuote,
  type QuoteInput,
  type VendorOffer,
} from "..";
import { CFG, NOW, baseInput, makeData, refArea } from "./fixtures";

const data = makeData();
const opts = { config: CFG, now: NOW, area: refArea };

function instant(input: Partial<QuoteInput> = {}, o: Parameters<typeof quote>[2] = opts): InstantQuote {
  const r = quote({ ...baseInput, ...input }, data, o);
  if (r.mode !== "instant") throw new Error("expected instant quote");
  return r;
}
const offerOf = (r: InstantQuote, vendorId: string): VendorOffer => {
  const o = r.offers.find((x) => x.vendorId === vendorId);
  if (!o) throw new Error(`no offer for ${vendorId}`);
  return o;
};
const line = (o: VendorOffer, kind: string) => o.lines.find((l) => l.kind === kind);

// ───────────────────────── money ─────────────────────────

describe("money helpers", () => {
  it("rounds half away from zero to whole piasters, ignoring float noise", () => {
    expect(toPiasters(2.5)).toBe(3);
    expect(toPiasters(2.4999)).toBe(2);
    expect(toPiasters(-2.5)).toBe(-3);
    expect(toPiasters(1.005 * 100)).toBe(101); // 100.49999999999999 in IEEE754
    expect(() => toPiasters(Number.NaN)).toThrow();
  });

  it("computes VAT 14% exactly with half-up rounding", () => {
    expect(vatOf(100, 0.14)).toBe(14);
    expect(vatOf(1, 0.14)).toBe(0); // 0.14
    expect(vatOf(4, 0.14)).toBe(1); // 0.56
    expect(vatOf(25, 0.14)).toBe(4); // 3.5 -> 4
    expect(vatOf(75, 0.14)).toBe(11); // 10.5 -> 11
    expect(vatOf(1_521_700, 0.14)).toBe(213_038);
    expect(vatOf(0, 0.14)).toBe(0);
    expect(() => vatOf(10.5, 0.14)).toThrow();
  });

  it("applies the margin and rounds", () => {
    expect(withMargin(1900, 0.25)).toBe(2375);
    expect(withMargin(1, 0.25)).toBe(1); // 1.25
    expect(withMargin(2, 0.25)).toBe(3); // 2.5 -> 3
  });

  it("formats prices per locale (ج.م after the amount in Arabic)", () => {
    expect(formatPrice(125050, "ar")).toBe("1,250.50 ج.م");
    expect(formatPrice(125050, "en")).toBe("EGP 1,250.50");
    expect(formatPrice(1200, "en", "unit")).toBe("EGP 12.00");
    expect(formatPrice(120000, "en")).toBe("EGP 1,200");
  });
});

// ───────────────────────── tiers ─────────────────────────

describe("quantity tier interpolation", () => {
  const tiers = data.rateCards[0]!.qtyTiers;

  it("returns tier prices exactly at tier quantities", () => {
    expect(interpolateUnit(tiers, 100)).toBe(3800);
    expect(interpolateUnit(tiers, 500)).toBe(1900);
    expect(interpolateUnit(tiers, 2000)).toBe(1100);
  });

  it("clamps below the first tier and above the last", () => {
    expect(interpolateUnit(tiers, 10)).toBe(3800);
    expect(interpolateUnit(tiers, 5000)).toBe(1100);
  });

  it("interpolates in log space between tiers", () => {
    const geoMid = Math.sqrt(100 * 250);
    expect(interpolateUnit(tiers, geoMid)).toBeCloseTo((3800 + 2700) / 2, 6);
    const u = interpolateUnit(tiers, 700);
    expect(u).toBeLessThan(1900);
    expect(u).toBeGreaterThan(1400);
  });

  it("is order-independent and keeps unit falling / total rising with quantity", () => {
    expect(interpolateUnit([...tiers].reverse(), 300)).toBe(interpolateUnit(tiers, 300));
    let prevUnit = Infinity;
    let prevTotal = 0;
    for (let q = 100; q <= 2000; q += 25) {
      const u = interpolateUnit(tiers, q);
      expect(u).toBeLessThanOrEqual(prevUnit);
      expect(u * q).toBeGreaterThan(prevTotal);
      prevUnit = u;
      prevTotal = u * q;
    }
  });

  it("rejects empty tables and non-positive quantities", () => {
    expect(() => interpolateUnit([], 10)).toThrow();
    expect(() => interpolateUnit(tiers, 0)).toThrow();
  });
});

// ───────────────────────── full quote (hand-computed) ─────────────────────────

describe("quote(): hand-computed offer", () => {
  it("prices Nile Pack, 500 custom-size mailers, Greater Cairo", () => {
    const o = offerOf(instant(), "nile");
    expect(o.printMethod).toBe("OFFSET");
    expect(line(o, "PRODUCT")).toEqual({ kind: "PRODUCT", labelKey: "pricing.line.product", quantity: 500, unitPiasters: 2375, totalPiasters: 1_187_500 });
    expect(line(o, "SETUP")!.totalPiasters).toBe(75_000); // 600 EGP × 1.25
    expect(line(o, "DIE")!.totalPiasters).toBe(225_000); // 1,800 EGP × 1.25 (custom size)
    // 3 bundles of flat blanks: 2 × 200 (15.5 kg) + 1 × 100 (8 kg) = 39 kg → 70 + 34 × 8 EGP
    expect(o.shipping.bundles).toBe(3);
    expect(o.shipping.chargeableWeightKg).toBe(39);
    expect(o.shippingPiasters).toBe(34_200);
    expect(o.subtotalPiasters).toBe(1_521_700);
    expect(o.vatPiasters).toBe(213_038);
    expect(o.totalPiasters).toBe(1_734_738);
    expect(o.unitPiasters).toBe(3043);
    expect(o.leadTimeDays).toBe(9); // 6 + 3 days for a new die
    expect(o.deliveryDays).toBe(10);
    expect(o.standardSize).toBe(false);
  });

  it("keeps every amount an integer and lines summing to the subtotal", () => {
    for (const q of [50, 100, 137, 250, 333, 500, 999, 1000, 1500, 2000]) {
      const r = instant({ quantity: q, finishes: ["MATTE_LAMINATION"], printSides: "BOTH", colours: 2 });
      for (const o of r.offers) {
        for (const l of o.lines) {
          expect(Number.isInteger(l.unitPiasters)).toBe(true);
          expect(l.totalPiasters).toBe(l.unitPiasters * l.quantity);
        }
        expect(o.subtotalPiasters).toBe(o.lines.reduce((s, l) => s + l.totalPiasters, 0));
        expect(o.vatPiasters).toBe(vatOf(o.subtotalPiasters, 0.14));
        expect(o.totalPiasters).toBe(o.subtotalPiasters + o.vatPiasters);
        expect(o.unitPiasters).toBe(Math.round(o.subtotalPiasters / q));
        expect(o.quantity).toBe(q);
      }
    }
  });

  it("applies a configurable platform margin and records it internally", () => {
    const at25 = offerOf(instant(), "nile");
    const at30 = offerOf(instant({}, { ...opts, config: makeConfig({ ...CFG, marginPct: 0.3 }) }), "nile");
    expect(line(at30, "PRODUCT")!.unitPiasters).toBe(2470); // 1900 × 1.3
    expect(at30.subtotalPiasters).toBeGreaterThan(at25.subtotalPiasters);
    expect(at25.internal.marginPct).toBe(0.25);
    const buy = 1900 * 500 + 60_000 + 180_000;
    expect(at25.internal.vendorCostPiasters).toBe(buy);
    expect(at25.internal.marginPiasters).toBe(at25.subtotalPiasters - buy - at25.internal.shippingCostPiasters);
    expect(at25.internal.marginPiasters / buy).toBeCloseTo(0.25, 3);
  });

  it("sets validUntil to now + 72 h", () => {
    const r = instant();
    expect(r.validUntil).toBe("2026-11-08T10:00:00.000Z");
    expect(r.offers.every((o) => o.validUntil === r.validUntil)).toBe(true);
  });

  it("charges the inside print surcharge and extra plates for two-sided print", () => {
    const one = offerOf(instant(), "nile");
    const both = offerOf(instant({ printSides: "BOTH" }), "nile");
    expect(line(both, "PRODUCT")!.unitPiasters).toBe(withMargin(1900 * 1.35, 0.25));
    expect(line(both, "SETUP")!.totalPiasters).toBe(withMargin(60_000 * 1.5, 0.25));
    expect(both.totalPiasters).toBeGreaterThan(one.totalPiasters);
  });

  it("adds a finish line (area-scaled unit) and the finish setup", () => {
    const o = offerOf(instant({ finishes: ["MATTE_LAMINATION", "NONE", "MATTE_LAMINATION"] }), "nile");
    const f = o.lines.filter((l) => l.kind === "FINISH");
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ labelKey: "finishes.MATTE_LAMINATION", quantity: 500, unitPiasters: withMargin(90, 0.25) });
    expect(line(o, "SETUP")!.totalPiasters).toBe(withMargin(60_000 + 25_000, 0.25));
  });

  it("scales the board share of the unit price with blank area", () => {
    const double = () => ({ blankAreaM2: 0.5, netAreaM2: 0.4, blankWidthMm: 700, blankHeightMm: 714, source: "dieline" as const });
    const o = offerOf(instant({}, { ...opts, area: double }), "nile");
    // 1900 × (0.6 × 2 + 0.4) = 3040 buy
    expect(line(o, "PRODUCT")!.unitPiasters).toBe(withMargin(3040, 0.25));
  });

  it("cheaper with fewer colours on offset", () => {
    const four = offerOf(instant({ colours: 4 }), "nile");
    const one = offerOf(instant({ colours: 1 }), "nile");
    expect(line(one, "PRODUCT")!.unitPiasters).toBe(withMargin(1900 * 0.85, 0.25));
    expect(line(one, "SETUP")!.totalPiasters).toBe(withMargin(60_000 * 0.4, 0.25));
    expect(one.totalPiasters).toBeLessThan(four.totalPiasters);
  });
});

// ───────────────────────── manual quote ─────────────────────────

describe("manual quote above 2,000 units", () => {
  it("returns manual_quote for 2,001+", () => {
    const r = quote({ ...baseInput, quantity: 2001 }, data, opts);
    expect(r).toEqual({ mode: "manual_quote", reason: "QUANTITY_ABOVE_INSTANT_MAX", quantity: 2001, maxInstantQty: 2000 });
    expect(quote({ ...baseInput, quantity: 50_000 }, data, opts).mode).toBe("manual_quote");
  });

  it("still prices exactly 2,000 instantly", () => {
    expect(instant({ quantity: 2000 }).offers.length).toBeGreaterThan(0);
  });

  it("toPublicOutcome passes manual quotes through unchanged", () => {
    const r = quote({ ...baseInput, quantity: 3000 }, data, opts);
    expect(toPublicOutcome(r)).toEqual(r);
  });
});

// ───────────────────────── standard sizes ─────────────────────────

describe("standard sizes (vendor owns the die)", () => {
  const accessories = { L: 180, W: 120, H: 50 };

  it("waives the die cost and is faster for a catalog standard size", () => {
    const custom = offerOf(instant(), "nile");
    const std = offerOf(instant({ dims: accessories }), "nile");
    expect(std.standardSize).toBe(true);
    expect(line(std, "DIE")).toBeUndefined();
    expect(std.leadTimeDays).toBe(custom.leadTimeDays - 3);
  });

  it("matches within ±2 mm, not beyond", () => {
    expect(offerOf(instant({ dims: { L: 182, W: 118, H: 51 } }), "nile").standardSize).toBe(true);
    expect(offerOf(instant({ dims: { L: 183, W: 120, H: 50 } }), "nile").standardSize).toBe(false);
  });

  it("ignores presets not flagged standard", () => {
    expect(offerOf(instant({ dims: { L: 200, W: 150, H: 60 } }), "nile").standardSize).toBe(false);
  });

  it("honours a vendor's own dies", () => {
    const d = makeData();
    d.vendors.find((v) => v.id === "alex")!.ownedDies = [{ structureCode: "FEFCO_0427", dims: { L: 250, W: 180, H: 80 } }];
    const r = quote(baseInput, d, opts);
    if (r.mode !== "instant") throw new Error();
    expect(offerOf(r, "alex").standardSize).toBe(true);
    expect(offerOf(r, "nile").standardSize).toBe(false);
  });

  it("does not add a die or extra days when the structure needs no die (RSC)", () => {
    const o = offerOf(instant({ structureCode: "FEFCO_0201", dims: { L: 300, W: 200, H: 150 } }), "nile");
    expect(line(o, "DIE")).toBeUndefined();
    expect(o.leadTimeDays).toBe(6);
  });

  it("suggests a cheaper standard size nearby that the product still fits in", () => {
    const r = instant({ dims: { L: 175, W: 116, H: 47 } });
    expect(r.offers.every((o) => !o.standardSize)).toBe(true);
    expect(r.suggestion).not.toBeNull();
    const s = r.suggestion!;
    expect(s.presetId).toBe("accessories");
    expect(s.dims).toEqual(accessories);
    const cheapest = Math.min(...r.offers.map((o) => o.totalPiasters));
    expect(s.savingsPiasters).toBe(cheapest - s.totalPiasters);
    expect(s.savingsPiasters).toBeGreaterThan(0);
    expect(s.savingsPct).toBeGreaterThan(0);
    expect(s.leadTimeDaysSaved).toBeGreaterThanOrEqual(3);
  });

  it("no suggestion when already standard, when nothing fits, or when the standard box is too big", () => {
    expect(instant({ dims: accessories }).suggestion).toBeNull();
    expect(instant({ dims: { L: 400, W: 300, H: 100 } }).suggestion).toBeNull(); // bigger than every preset
    expect(instant({ dims: { L: 120, W: 80, H: 40 } }).suggestion).toBeNull(); // accessories volume > +30%
  });
});

// ───────────────────────── delivery ─────────────────────────

describe("delivery zones and volumetric weight", () => {
  it("maps vendor cities and governorates to zones", () => {
    expect(CITY_ZONE.SIXTH_OF_OCTOBER).toBe("GREATER_CAIRO");
    expect(CITY_ZONE.ALEXANDRIA).toBe("ALEXANDRIA");
    expect(CITY_ZONE.NEW_DAMIETTA).toBe("DELTA");
    expect(zoneForGovernorate("Giza")).toBe("GREATER_CAIRO");
    expect(zoneForGovernorate("Port Said Governorate")).toBe("CANAL");
    expect(zoneForGovernorate("  aswan ")).toBe("UPPER_EGYPT");
    expect(zoneForGovernorate("Menoufia")).toBe("DELTA");
    expect(zoneForGovernorate("محافظة الإسكندرية")).toBe("ALEXANDRIA");
    expect(zoneForGovernorate("أسيوط")).toBe("UPPER_EGYPT");
    expect(zoneForGovernorate("Atlantis")).toBeNull();
  });

  it("charges more and takes longer to farther zones", () => {
    const zones = ["GREATER_CAIRO", "ALEXANDRIA", "DELTA", "CANAL", "UPPER_EGYPT"] as const;
    const nile = zones.map((zone) => offerOf(instant({ zone }), "nile"));
    for (const o of nile.slice(1)) {
      expect(o.shippingPiasters).toBeGreaterThan(nile[0]!.shippingPiasters);
      expect(o.shipping.transitDays).toBeGreaterThan(nile[0]!.shipping.transitDays);
    }
    expect(nile[4]!.shippingPiasters).toBe(Math.max(...nile.map((o) => o.shippingPiasters)));
    // Production price does not depend on the zone.
    expect(new Set(nile.map((o) => line(o, "PRODUCT")!.totalPiasters)).size).toBe(1);
  });

  it("applies the inter-zone multiplier from the vendor's origin", () => {
    const toAlex = instant({ zone: "ALEXANDRIA" });
    const alexLocal = offerOf(toAlex, "alex").shipping;
    const nileToAlex = offerOf(toAlex, "nile").shipping;
    expect(alexLocal.originZone).toBe("ALEXANDRIA");
    expect(nileToAlex.originZone).toBe("GREATER_CAIRO");
    expect(nileToAlex.pricePiasters).toBe(toPiasters(alexLocal.pricePiasters * 1.15));
    expect(nileToAlex.transitDays).toBe(alexLocal.transitDays + 1);
  });

  it("bundles flat-packed boxes by stack height and charges max(actual, volumetric)", () => {
    const area = refArea("FEFCO_0427", baseInput.dims, "E_FLUTE_KRAFT");
    const b = flatPackBundles("FEFCO_0427", area, { gsm: 380, thicknessMm: 1.5 }, 500, CFG);
    expect(b.unitsPerBundle).toBe(200); // 300 mm / 1.5 mm
    expect(b.bundles).toBe(3);
    expect(b.bundleCm).toEqual({ L: 50, W: 50, H: 30 });
    expect(b.actualWeightKg).toBeCloseTo(38, 6); // 500 × 0.2 m² × 380 g
    expect(b.volumetricWeightKg).toBeCloseTo(37.5, 6); // 50 × 50 × 75 cm / 5000
    expect(b.chargeableWeightKg).toBe(39);

    // Glued boxes fold flat: 2 layers, half the footprint.
    const g = flatPackBundles("FEFCO_0201", area, { gsm: 380, thicknessMm: 1.5 }, 500, CFG);
    expect(g.unitsPerBundle).toBe(100);
    expect(g.bundleCm).toEqual({ L: 50, W: 25, H: 30 });
    expect(g.bundles).toBe(5);
  });

  it("switches to a van/truck load for very heavy shipments", () => {
    const area = { blankAreaM2: 1.2, netAreaM2: 1.1, blankWidthMm: 1200, blankHeightMm: 1000, source: "dieline" as const };
    const b = flatPackBundles("FEFCO_0427", area, { gsm: 450, thicknessMm: 3 }, 2000, CFG);
    expect(b.chargeableWeightKg).toBeGreaterThan(150);
    const est = deliveryEstimate(b, "GREATER_CAIRO", "GREATER_CAIRO", CFG);
    expect(est.mode).toBe("FREIGHT");
    expect(est.pricePiasters).toBe(CFG.shipping.zones.GREATER_CAIRO.freightPerLoadPiasters);
  });

  it("can put the margin on shipping when configured", () => {
    const o = offerOf(instant({}, { ...opts, config: makeConfig({ ...CFG, marginOnShipping: true }) }), "nile");
    expect(o.shippingPiasters).toBe(withMargin(o.shipping.pricePiasters, 0.25));
  });
});

// ───────────────────────── digital vs offset ─────────────────────────

describe("digital vs offset", () => {
  it("uses digital for short runs and offset for long runs at a digital-capable vendor", () => {
    expect(offerOf(instant({ quantity: 50 }), "quick").printMethod).toBe("DIGITAL");
    expect(offerOf(instant({ quantity: 1500 }), "quick").printMethod).toBe("OFFSET");
    expect(offerOf(instant({ quantity: 50 }, opts), "quick").leadTimeDays).toBe(4 + 3 - 1);
  });

  it("never uses digital at an offset-only vendor", () => {
    expect(offerOf(instant({ quantity: 100 }), "nile").printMethod).toBe("OFFSET");
  });

  it("finds the breakpoint where offset becomes cheaper", () => {
    const d = makeData();
    const card = d.rateCards.find((c) => c.vendorId === "quick")!;
    const v = d.vendors.find((x) => x.id === "quick")!;
    const bp = digitalOffsetBreakpoint(card, v, { colours: 4, printSides: "OUTSIDE" }, 1, 1, CFG);
    expect(bp).not.toBeNull();
    expect(bp!).toBeGreaterThan(50);
    expect(bp!).toBeLessThanOrEqual(CFG.digital.maxQty + 1);
    expect(offerOf(instant({ quantity: bp! - 1 }), "quick").printMethod).toBe("DIGITAL");
    expect(offerOf(instant({ quantity: bp! }), "quick").printMethod).toBe("OFFSET");
    expect(digitalOffsetBreakpoint(card, d.vendors[0]!, { colours: 4, printSides: "OUTSIDE" }, 1, 1, CFG)).toBeNull();
  });

  it("moves the breakpoint down for 1-colour jobs (offset setup shrinks with colours)", () => {
    const d = makeData();
    const card = d.rateCards.find((c) => c.vendorId === "quick")!;
    const v = d.vendors.find((x) => x.id === "quick")!;
    const bp4 = digitalOffsetBreakpoint(card, v, { colours: 4, printSides: "OUTSIDE" }, 1, 1, CFG)!;
    const bp1 = digitalOffsetBreakpoint(card, v, { colours: 1, printSides: "OUTSIDE" }, 1, 1, CFG) ?? 0;
    expect(bp1).toBeLessThan(bp4);
  });
});

// ───────────────────────── eligibility & ranking ─────────────────────────

describe("eligibility and best match", () => {
  it("skips inactive vendors, minimum quantities, unsupported finishes and too many colours", () => {
    const r = instant({ quantity: 100 });
    expect(r.offers.map((o) => o.vendorId).sort()).toEqual(["nile", "quick"]);
    expect(r.ineligible).toEqual(
      expect.arrayContaining([
        { vendorId: "alex", reason: "BELOW_MIN_QTY" },
        { vendorId: "suspended", reason: "VENDOR_INACTIVE" },
      ]),
    );
    const gloss = instant({ finishes: ["GLOSS_LAMINATION"] });
    expect(gloss.ineligible).toContainEqual({ vendorId: "quick", reason: "FINISH_UNSUPPORTED" });
    expect(instant({ finishes: ["SPOT_UV"] }).offers).toHaveLength(0);
    expect(instant({ colours: 5 }).ineligible).toContainEqual({ vendorId: "nile", reason: "TOO_MANY_COLOURS" });
    expect(instant({ materialId: "B_FLUTE_KRAFT" }).ineligible).toContainEqual({ vendorId: "quick", reason: "MATERIAL_UNSUPPORTED" });
    expect(instant({ materialId: "B_FLUTE_KRAFT" }).ineligible).toContainEqual({ vendorId: "nile", reason: "NO_RATE_CARD" });
  });

  it("restricts to one vendor when vendorId is given", () => {
    const r = instant({ vendorId: "alex" });
    expect(r.offers.map((o) => o.vendorId)).toEqual(["alex"]);
  });

  it("sorts by best-match score with badges", () => {
    const r = instant();
    expect(r.offers.length).toBe(3);
    for (let i = 1; i < r.offers.length; i++) expect(r.offers[i - 1]!.score).toBeGreaterThanOrEqual(r.offers[i]!.score);
    expect(r.offers[0]!.badges).toContain("BEST_MATCH");
    const cheapest = [...r.offers].sort((a, b) => a.totalPiasters - b.totalPiasters)[0]!;
    expect(cheapest.badges).toContain("CHEAPEST");
    const fastest = [...r.offers].sort((a, b) => a.deliveryDays - b.deliveryDays)[0]!;
    expect(fastest.badges).toContain("FASTEST");
    expect(offerOf(r, "nile").badges).toContain("TOP_RATED");
    expect(r.offers.flatMap((o) => o.badges).filter((b) => b === "BEST_MATCH")).toHaveLength(1);
  });

  it("price dominates: a much cheaper vendor wins over a slightly better-rated one", () => {
    const d = makeData();
    d.rateCards.find((c) => c.vendorId === "alex")!.qtyTiers.forEach((t) => (t.unitPiasters = Math.round(t.unitPiasters * 0.6)));
    const r = quote(baseInput, d, opts);
    if (r.mode !== "instant") throw new Error();
    expect(r.offers[0]!.vendorId).toBe("alex");
  });

  it("strips internal economics from public offers", () => {
    const pub = toPublicOutcome(instant());
    if (pub.mode !== "instant") throw new Error();
    for (const o of pub.offers) expect(o).not.toHaveProperty("internal");
    expect(JSON.stringify(pub)).not.toContain("vendorCostPiasters");
  });
});

// ───────────────────────── index, inputs, tables ─────────────────────────

describe("FX / board index", () => {
  it("picks the latest row in force", () => {
    const t = DEFAULT_PRICING_CONFIG.priceIndex;
    expect(resolvePriceIndex(t, new Date("2026-06-01")).id).toBe("2026-W01");
    expect(resolvePriceIndex(t, new Date("2026-10-01T00:00:00Z")).id).toBe("2026-W40");
    expect(resolvePriceIndex(t, new Date("2020-01-01")).id).toBe("2026-W01");
    const row = resolvePriceIndex(t, NOW);
    expect(boardMultiplier(row, "E_FLUTE_KRAFT")).toBeCloseTo(1.02 * 1.03, 10);
  });

  it("raises only the board share of the unit price", () => {
    const cfg = makeConfig({ priceIndex: [{ id: "up", effectiveFrom: "2026-01-01", fx: 1.1, board: { E_FLUTE_KRAFT: 1.1 } }] });
    const o = offerOf(instant({}, { ...opts, config: cfg }), "nile");
    expect(line(o, "PRODUCT")!.unitPiasters).toBe(withMargin(1900 * (0.6 * 1.21 + 0.4), 0.25));
    expect(o.internal.indexId).toBe("up");
    expect(line(o, "SETUP")!.totalPiasters).toBe(75_000);
  });
});

describe("input validation", () => {
  it("rejects bad dims, unknown or mismatched materials, bad quantities and colours", () => {
    const err = (i: Partial<QuoteInput>) => {
      try {
        quote({ ...baseInput, ...i }, data, opts);
      } catch (e) {
        return e instanceof QuoteInputError ? e.code : "OTHER";
      }
      return "NONE";
    };
    expect(err({ dims: { L: 10, W: 180, H: 80 } })).toBe("INVALID_DIMS");
    expect(err({ dims: { L: 250, W: 100, H: 200 } })).toBe("INVALID_DIMS"); // H <= W rule
    expect(err({ materialId: "nope" })).toBe("UNKNOWN_MATERIAL");
    expect(err({ materialId: "SBS_350" })).toBe("MATERIAL_STRUCTURE_MISMATCH");
    expect(err({ quantity: 0 })).toBe("INVALID_QUANTITY");
    expect(err({ quantity: 10.5 })).toBe("INVALID_QUANTITY");
    expect(err({ colours: 0 })).toBe("INVALID_COLOURS");
    expect(err({ colours: 7 })).toBe("INVALID_COLOURS");
  });

  it("accepts a material code as well as a row id", () => {
    expect(instant({ materialId: "E_FLUTE_KRAFT" }).offers.length).toBe(3);
  });

  it("adapts the shared QuoteRequest contract", () => {
    const i = fromQuoteRequest(
      { structureCode: "FEFCO_0427", dims: baseInput.dims, materialCode: "E_FLUTE_KRAFT", finishCode: "NONE", printSides: "OUTSIDE", quantity: 250 },
      "DELTA",
    );
    expect(i).toMatchObject({ materialId: "E_FLUTE_KRAFT", finishes: ["NONE"], colours: 4, zone: "DELTA", quantity: 250 });
    expect(quote(i, data, opts).mode).toBe("instant");
  });
});

describe("priceTable()", () => {
  it("returns the best offer for every quantity tier with falling unit prices", () => {
    const { quantity: _q, ...rest } = baseInput;
    void _q;
    const rows = priceTable(rest, data, opts);
    expect(rows.map((r) => r.quantity)).toEqual([100, 250, 500, 1000, 2000]);
    const units = rows.map((r) => r.best!.unitPiasters);
    for (let i = 1; i < units.length; i++) expect(units[i]!).toBeLessThan(units[i - 1]!);
  });
});

describe("board area from the dieline engine", () => {
  it("uses the dieline by default", () => {
    const r = quote(baseInput, data, { config: CFG, now: NOW });
    if (r.mode !== "instant") throw new Error();
    expect(r.areaSource).toBe("dieline");
    expect(r.areaM2).toBeCloseTo(blankAreaM2("FEFCO_0427", baseInput.dims, "E_FLUTE_KRAFT"), 3);
  });

  it("fallback estimate stays within 15% of the dieline at default sizes", () => {
    const mats: Partial<Record<StructureCode, "E_FLUTE_KRAFT" | "SBS_350">> = {
      FEFCO_0427: "E_FLUTE_KRAFT",
      FEFCO_0201: "E_FLUTE_KRAFT",
      PIZZA: "E_FLUTE_KRAFT",
      ECMA_RTE: "SBS_350",
      ECMA_STE: "SBS_350",
      SLEEVE: "SBS_350",
    };
    for (const code of Object.keys(mats) as StructureCode[]) {
      const real = blankAreaM2(code, DEFAULT_DIMS[code], mats[code]!);
      const est = estimateBoardArea(code, DEFAULT_DIMS[code]).blankAreaM2;
      expect(Math.abs(est - real) / real).toBeLessThan(0.15);
    }
  });
});
