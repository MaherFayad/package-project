import { describe, expect, it } from "vitest";
import { instantOrderBlock } from "../order-guard";

const lines = (quantity: number) => [{ kind: "PRODUCT" as const, quantity }];

describe("instant order guard (B-16, R4-B-01)", () => {
  it("lets a plain box or an instant model through", () => {
    expect(instantOrderBlock({ modelCode: null }, { lines: lines(500) })).toBeNull();
    expect(instantOrderBlock({}, { lines: lines(2000) })).toBeNull();
  });
  it("refuses an instant order for quote-only and preview models", () => {
    expect(instantOrderBlock({ modelCode: "LIQUID_ASEPTIC_BRICK" }, { lines: lines(100) })).toBe("MODEL_BY_QUOTE");
    expect(instantOrderBlock({ modelCode: "FEFCO_0930" }, { lines: lines(100) })).toBe("MODEL_BY_QUOTE");
  });
  it("refuses an instant order above 2,000 boxes", () => {
    expect(instantOrderBlock({ modelCode: null }, { lines: lines(2001) })).toBe("QUANTITY_ABOVE_INSTANT_MAX");
  });
  it("allows both when the order comes from a price the team sent", () => {
    expect(instantOrderBlock({ modelCode: "LIQUID_ASEPTIC_BRICK" }, { lines: lines(5000) }, "q_1")).toBeNull();
  });
});
