import { describe, expect, it } from "vitest";
import { advanceOnAccept } from "../payouts";

describe("advanceOnAccept (R7 fix: advance after reassignment)", () => {
  it("creates the 40% advance on a first acceptance", () => {
    expect(advanceOnAccept([], "v-new", 100_000)).toBe(40_000);
  });

  it("still creates the new printer's advance when the old printer's advance was already paid", () => {
    expect(advanceOnAccept([{ kind: "ADVANCE", vendorId: "v-old" }], "v-new", 100_000)).toBe(40_000);
  });

  it("creates it exactly once per printer", () => {
    expect(advanceOnAccept([{ kind: "ADVANCE", vendorId: "v-new" }], "v-new", 100_000)).toBe(0);
  });

  it("ignores balance rows and zero cost", () => {
    expect(advanceOnAccept([{ kind: "BALANCE", vendorId: "v-new" }], "v-new", 100_000)).toBe(40_000);
    expect(advanceOnAccept([], "v-new", 0)).toBe(0);
  });
});
