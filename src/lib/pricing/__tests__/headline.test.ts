import { describe, expect, it } from "vitest";
import { HEADLINE_DEFAULTS, checkoutVendor, headlineInput, headlineOffer, priceTable, quote } from "..";
import { orderTotals } from "@/lib/orders/totals";
import { CFG, NOW, baseInput, makeData, refArea } from "./fixtures";

const data = makeData();
const opts = { config: CFG, now: NOW, area: refArea };

describe("headline price (B-26: one price source for page, designer badge and checkout)", () => {
  it("uses the same defaults as the quote API and the order service", () => {
    expect(HEADLINE_DEFAULTS).toEqual({ printSides: "OUTSIDE", colours: 4, finishes: [], zone: "GREATER_CAIRO" });
    const i = headlineInput(baseInput.structureCode, baseInput.dims, baseInput.materialId);
    expect(i).toMatchObject({ colours: 4, printSides: "OUTSIDE", zone: "GREATER_CAIRO", finishes: [] });
  });

  it("picks the best-match offer (the vendor checkout pre-selects), not the cheapest", () => {
    const r = quote({ ...headlineInput(baseInput.structureCode, baseInput.dims, baseInput.materialId), quantity: 500 }, data, opts);
    if (r.mode !== "instant") throw new Error("expected instant quote");
    const h = headlineOffer(r.offers)!;
    expect(h.badges).toContain("BEST_MATCH");
    expect(h).toBe(r.offers[0]);
  });

  it("the public price table row equals the headline offer for the same box and quantity", () => {
    const input = headlineInput(baseInput.structureCode, baseInput.dims, baseInput.materialId);
    const row = priceTable(input, data, opts).find((t) => t.quantity === 500)!;
    const r = quote({ ...input, quantity: 500 }, data, { ...opts, skipSuggestion: true });
    if (r.mode !== "instant") throw new Error("expected instant quote");
    expect(row.best?.vendorId).toBe(headlineOffer(r.offers)?.vendorId);
    expect(row.best?.unitPiasters).toBe(headlineOffer(r.offers)?.unitPiasters);
    expect(row.best?.leadTimeDays).toBe(headlineOffer(r.offers)?.leadTimeDays);
  });

  it("returns null without offers", () => {
    expect(headlineOffer([])).toBeNull();
    expect(headlineOffer(undefined)).toBeNull();
  });
});

describe("R3-01: the same order to the same governorate always gets the same printer, price and date", () => {
  const zones = ["GREATER_CAIRO", "ALEXANDRIA", "DELTA", "CANAL", "UPPER_EGYPT"] as const;
  const offersFor = (zone: (typeof zones)[number], d = data) => {
    const r = quote({ ...headlineInput(baseInput.structureCode, baseInput.dims, baseInput.materialId), quantity: 500, zone }, d, { ...opts, skipSuggestion: true });
    if (r.mode !== "instant") throw new Error("expected instant quote");
    return r.offers;
  };
  const pick = (offers: ReturnType<typeof offersFor>, id: string | null) => {
    const o = offers.find((x) => x.vendorId === id)!;
    return { vendorId: o.vendorId, subtotal: orderTotals(o.lines, 3).subtotalPiasters, days: o.deliveryDays };
  };

  it("quoting twice, or with the printers listed in another order, ranks the same best match", () => {
    for (const zone of zones) {
      const a = offersFor(zone);
      const b = offersFor(zone);
      const shuffled = offersFor(zone, { ...data, vendors: [...data.vendors].reverse() });
      expect(a.map((o) => o.vendorId)).toEqual(b.map((o) => o.vendorId));
      expect(headlineOffer(shuffled)?.vendorId).toBe(headlineOffer(a)?.vendorId);
      expect(headlineOffer(shuffled)?.totalPiasters).toBe(headlineOffer(a)?.totalPiasters);
    }
  });

  it("re-pricing for a new governorate does not keep the printer chosen for the old one", () => {
    const cairo = offersFor("GREATER_CAIRO");
    for (const zone of zones) {
      const fresh = offersFor(zone);
      // Path 1: a returning buyer whose saved address is already in `zone`.
      const direct = pick(fresh, checkoutVendor(fresh, null));
      // Path 2: a new buyer who started on Cairo's best match, then picked `zone`.
      const cairoChoice = checkoutVendor(cairo, null);
      expect(cairoChoice).toBe(cairo[0]!.vendorId);
      const switched = pick(fresh, checkoutVendor(fresh, null));
      expect(switched).toEqual(direct);
    }
  });

  it("keeps a printer the buyer chose themselves while it still prices the run", () => {
    const offers = offersFor("UPPER_EGYPT");
    const other = offers.at(-1)!.vendorId;
    expect(checkoutVendor(offers, other)).toBe(other);
    expect(checkoutVendor(offers, "gone")).toBe(offers[0]!.vendorId);
    expect(checkoutVendor([], other)).toBeNull();
  });
});
