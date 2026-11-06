import { describe, expect, it } from "vitest";
import { sellerTaxReady } from "../tax-document";

describe("tax invoice only with the seller tax number (R4-B-07)", () => {
  it("is a receipt until a 9-digit ELBA_TAX_ID is configured", () => {
    expect(sellerTaxReady({})).toBe(false);
    expect(sellerTaxReady({ ELBA_TAX_ID: "To be assigned" })).toBe(false);
    expect(sellerTaxReady({ ELBA_TAX_ID: "123-456-789" })).toBe(true);
  });
});
