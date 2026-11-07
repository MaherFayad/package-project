import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { DesignDoc } from "@/types";
import { QTY_TIERS } from "@/types";
import { designQuoteFields, headlineOffer, HEADLINE_DEFAULTS, makeConfig, quote } from "@/lib/pricing";
import { CFG, makeData as makeFixtureData, NOW } from "@/lib/pricing/__tests__/fixtures";
import { orderTotals } from "@/lib/orders/totals";
import { sampleOffer } from "@/lib/orders/sample";
import { mergeCheckoutSettings } from "@/lib/orders/checkout-settings";
import { computePricingFacts, REFERENCE_BOX } from "../pricing-facts";

/**
 * The /pricing and /why-elba numbers must equal what checkout charges for the same box.
 * Checkout prices a design with `quoteDesign` (designQuoteFields + default colours + zone),
 * pre-selects the best-match offer and turns it into totals with `toCheckoutOffer`.
 */
const settings = mergeCheckoutSettings({ prepayDiscountPct: 3 }, {
  prepayDiscountPct: 0,
  sample: { enabled: true, pricePiasters: 75_000, maxPieces: 5, creditDays: 60, monthlyCap: 100, vendorCostPiasters: null },
});

// As in the seed (R1-03): the reference mailer size is a catalogue standard die.
function makeData() {
  const d = makeFixtureData();
  d.presets.FEFCO_0427 = [...(d.presets.FEFCO_0427 ?? []), { id: "cosmetics-kit", name: { ar: "x", en: "x" }, dims: REFERENCE_BOX.dims, standard: true }];
  return d;
}

// The reference box as a design nobody has decorated yet (what the "Start designing" link opens).
const doc = {
  structureCode: REFERENCE_BOX.code,
  dims: REFERENCE_BOX.dims,
  materialCode: REFERENCE_BOX.material,
  finishCode: "NONE",
  finishes: [],
  printSides: HEADLINE_DEFAULTS.printSides,
} as unknown as DesignDoc;

function checkoutQuote(quantity: number) {
  // Mirrors src/lib/orders/service.ts quoteDesign(doc, { quantity }) with no governorate.
  return quote({ ...designQuoteFields(doc), colours: HEADLINE_DEFAULTS.colours, quantity, zone: HEADLINE_DEFAULTS.zone }, makeData(), { config: CFG, now: NOW });
}

describe("pricing page facts = checkout prices", () => {
  const facts = computePricingFacts(makeData(), CFG, settings, NOW);

  it("prices every instant tier", () => {
    expect(facts.tiers.map((t) => t.quantity)).toEqual(QTY_TIERS.filter((q) => q <= CFG.maxInstantQty));
  });

  it.each(QTY_TIERS.map((q) => [q]))("tier %i: per box, totals, VAT, discount and days equal toCheckoutOffer", async (q) => {
    const { toCheckoutOffer } = await import("@/lib/orders/service");
    const outcome = checkoutQuote(q);
    expect(outcome.mode).toBe("instant");
    if (outcome.mode !== "instant") return;
    const best = headlineOffer(outcome.offers)!;
    const list = toCheckoutOffer(best, 0);
    const pay = toCheckoutOffer(best, settings.prepayDiscountPct); // what placeOrder charges
    const tier = facts.tiers.find((t) => t.quantity === q)!;
    // Per box exactly as the checkout offer card computes it (CheckoutClient OfferCard).
    expect(tier.unitPiasters).toBe(Math.round(pay.pay.subtotalPiasters / pay.quantity));
    expect(tier.unitInclVatPiasters).toBe(Math.round(pay.pay.totalPiasters / pay.quantity));
    expect(tier.subtotalPiasters).toBe(pay.pay.subtotalPiasters);
    expect(tier.totalPiasters).toBe(pay.pay.totalPiasters);
    expect(tier.vatPiasters).toBe(pay.pay.vatPiasters);
    expect(tier.discountPiasters).toBe(pay.pay.discountPiasters);
    expect(tier.listTotalPiasters).toBe(list.pay.totalPiasters);
    expect(tier.savingPiasters).toBe(list.pay.totalPiasters - pay.pay.totalPiasters);
    expect(tier.savingPiasters).toBeGreaterThan(0);
    // R2-08: the comparison table's ex-VAT rows add up as read.
    expect(tier.listSubtotalPiasters - tier.discountPiasters).toBe(tier.subtotalPiasters);
    expect(tier.subtotalPiasters + tier.vatPiasters).toBe(tier.totalPiasters);
    expect(tier.shippingPiasters).toBe(pay.pay.shippingPiasters);
    expect(tier.deliveryDays).toBe(pay.deliveryDays);
    expect(tier.method).toBe(best.printMethod);
  });

  it("sample total equals the checkout sample offer (fixed price + same printer's delivery, no prepay discount)", async () => {
    const { toCheckoutOffer } = await import("@/lib/orders/service");
    const outcome = checkoutQuote(QTY_TIERS[0]);
    if (outcome.mode !== "instant") throw new Error("expected instant");
    const s = sampleOffer(outcome.offers[0]!, settings.sample.maxPieces, settings.sample.pricePiasters, settings.sample.vendorCostPiasters);
    const pay = toCheckoutOffer(s, settings.prepayDiscountPct, { sample: true }).pay;
    expect(facts.sample?.totalPiasters).toBe(pay.totalPiasters);
    expect(facts.sample?.totalPiasters).toBe(orderTotals(s.lines, 0).totalPiasters);
    expect(facts.sample?.deliveryDays).toBe(s.deliveryDays);
  });

  it("takes the prepay discount from the admin checkout setting", () => {
    const f5 = computePricingFacts(makeData(), CFG, { ...settings, prepayDiscountPct: 5 }, NOW);
    expect(f5.prepayDiscountPct).toBe(5);
    expect(f5.tiers[0]!.savingPiasters).toBeGreaterThan(facts.tiers[0]!.savingPiasters);
    expect(f5.tiers[0]!.totalPiasters).toBeLessThan(facts.tiers[0]!.totalPiasters);
  });

  it("stops instant tiers at the configured maximum (price on request above it)", () => {
    const small = computePricingFacts(makeData(), makeConfig({ ...CFG, maxInstantQty: 500 }), settings, NOW);
    expect(small.tiers.map((t) => t.quantity)).toEqual([100, 250, 500]);
    expect(small.maxInstantQty).toBe(500);
  });

  it("reports only real figures: printers, minimum order, standard-size die", () => {
    expect(facts.printerCount).toBe(3); // the suspended printer is not counted
    // R1-08: the smallest quantity checkout offers (its first tier), not a printer's own minimum (50).
    expect(facts.minOrderQty).toBe(100);
    expect(facts.tiers.every((t) => t.diePiasters === 0)).toBe(true); // the reference box is a standard die size
    expect(facts.unitDropPct).toBe(Math.round((1 - facts.tiers.at(-1)!.unitPiasters / facts.tiers[0]!.unitPiasters) * 100));
  });

  it("returns no tiers when no printer can make the box (pages then show no prices)", () => {
    const data = makeData();
    data.vendors = [];
    expect(computePricingFacts(data, CFG, settings, NOW).tiers).toEqual([]);
  });
});
