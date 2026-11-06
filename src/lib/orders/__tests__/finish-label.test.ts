import { describe, expect, it } from "vitest";
import { configFinishCodes, configFinishNames, finishLabel } from "../finish-label";

// R5-JR-02: the printer must read the foil colour the buyer chose, not the pricing code "Hot foil".
describe("finish labels from the design config", () => {
  const t = (k: string) => (k === "finishes.HOT_FOIL" ? "Hot foil" : k);

  it("names the configured finishes in order, without duplicates", () => {
    const config = { finishes: [{ code: "FOIL_GOLD", mask: {} }, { code: "SPOT_UV" }, { code: "FOIL_GOLD" }] };
    expect(configFinishCodes(config)).toEqual(["FOIL_GOLD", "SPOT_UV"]);
    expect(configFinishNames(config, "en")).toBe("Gold foil, Spot UV");
    expect(configFinishNames(config, "ar")).toBe("بصمة ذهبي، يو في موضعي");
  });

  it("falls back to the coarse finish label when the config names none", () => {
    expect(finishLabel(null, "HOT_FOIL", "en", t)).toBe("Hot foil");
    expect(finishLabel({ finishes: [] }, "HOT_FOIL", "en", t)).toBe("Hot foil");
    expect(finishLabel({ finishes: [{ code: "NOT_A_FINISH" }] }, "HOT_FOIL", "en", t)).toBe("Hot foil");
  });

  it("tells silver and rose gold apart", () => {
    expect(finishLabel({ finishes: [{ code: "FOIL_SILVER" }] }, "HOT_FOIL", "en", t)).toBe("Silver foil");
    expect(finishLabel({ finishes: [{ code: "FOIL_ROSE_GOLD" }] }, "HOT_FOIL", "ar", t)).toBe("بصمة روز جولد");
  });
});
