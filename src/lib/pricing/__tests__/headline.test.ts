import { describe, expect, it } from "vitest";
import { HEADLINE_DEFAULTS, headlineInput, headlineOffer, priceTable, quote } from "..";
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
    expect(row.best?.deliveryDays).toBe(headlineOffer(r.offers)?.deliveryDays);
  });

  it("returns null without offers", () => {
    expect(headlineOffer([])).toBeNull();
    expect(headlineOffer(undefined)).toBeNull();
  });
});
