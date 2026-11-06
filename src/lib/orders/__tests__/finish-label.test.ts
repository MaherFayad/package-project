import { describe, expect, it } from "vitest";
import { FINISHES } from "@/lib/configurator/catalog";
import { configFinishCodes, configFinishNames, finishLabel } from "../finish-label";

// R5-JR-02: the printer must read the foil colour the buyer chose, not the pricing code "Hot foil".
describe("finish labels from the design config", () => {
  const t = (k: string) => (k === "finishes.HOT_FOIL" ? "Hot foil" : k);

  it("names the configured finishes in order, without duplicates", () => {
    const config = { finishes: [{ code: "FOIL_GOLD", mask: {} }, { code: "SPOT_UV" }, { code: "FOIL_GOLD" }] };
    expect(configFinishCodes(config)).toEqual(["FOIL_GOLD", "SPOT_UV"]);
    expect(configFinishNames(config, "en")).toBe("Gold foil, Spot UV");
    expect(configFinishNames(config, "ar")).toBe(`${FINISHES.FOIL_GOLD.name.ar}، ${FINISHES.SPOT_UV.name.ar}`);
  });

  it("falls back to the coarse finish label when the config names none", () => {
    expect(finishLabel(null, "HOT_FOIL", "en", t)).toBe("Hot foil");
    expect(finishLabel({ finishes: [] }, "HOT_FOIL", "en", t)).toBe("Hot foil");
    expect(finishLabel({ finishes: [{ code: "NOT_A_FINISH" }] }, "HOT_FOIL", "en", t)).toBe("Hot foil");
  });

  it("tells silver and rose gold apart", () => {
    expect(finishLabel({ finishes: [{ code: "FOIL_SILVER" }] }, "HOT_FOIL", "en", t)).toBe("Silver foil");
    expect(finishLabel({ finishes: [{ code: "FOIL_ROSE_GOLD" }] }, "HOT_FOIL", "ar", t)).toBe(FINISHES.FOIL_ROSE_GOLD.name.ar);
    expect(FINISHES.FOIL_ROSE_GOLD.name.ar).not.toBe(FINISHES.FOIL_GOLD.name.ar);
  });
});
