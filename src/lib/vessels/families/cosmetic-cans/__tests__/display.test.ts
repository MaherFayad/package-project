import { describe, expect, it } from "vitest";
import { DEFINITIONS_BY_CODE, displayLiquid, displaySurfaces } from "@/lib/vessels/families/cosmetic-cans";
import { defaultFlexConfig, defaultPrintPanels, flexDisplayEnvelope } from "@/lib/vessels/families/flexible";

describe("display mapping (E-02, E-03, E-06, E-07)", () => {
  it("direct-printed round bodies show a wrap, square ones front + back", () => {
    expect(displaySurfaces(DEFINITIONS_BY_CODE["CAN-BEVERAGE"]).defaultSurfaces).toEqual(["WRAP"]);
    expect(displaySurfaces(DEFINITIONS_BY_CODE["TIN-GIFT-ROUND"]).defaultSurfaces).toEqual(["WRAP", "LID"]);
    expect(displaySurfaces(DEFINITIONS_BY_CODE["TIN-GIFT-SQUARE"]).surfaces).toEqual(expect.arrayContaining(["FRONT", "BACK"]));
  });

  it("every catalogue model maps to at least one core display surface", () => {
    for (const def of Object.values(DEFINITIONS_BY_CODE)) {
      const d = displaySurfaces(def);
      expect(d.surfaces.length, def.code).toBeGreaterThan(0);
      expect(d.defaultSurfaces.every((s) => d.surfaces.includes(s)), def.code).toBe(true);
    }
  });

  it("perfume shows perfume, cans cola, creams cream", () => {
    expect(displayLiquid(DEFINITIONS_BY_CODE["COS-PERFUME-ROUND"])).toBe("PERFUME");
    expect(displayLiquid(DEFINITIONS_BY_CODE["COS-SERUM"])).toBe("SERUM");
    expect(displayLiquid(DEFINITIONS_BY_CODE["CAN-BEVERAGE"])).toBe("COLA");
    expect(displayLiquid(DEFINITIONS_BY_CODE["COS-JAR-DOUBLE"])).toBe("CREAM");
  });

  it("flow wrap is framed lying down; gussets and bottoms are printed by default", () => {
    const e = flexDisplayEnvelope(defaultFlexConfig("FLEX_FLOW_WRAP"));
    expect(e.width).toBeGreaterThan(e.height);
    expect(defaultPrintPanels("FLEX_QUAD_SEAL_BAG")).toEqual(expect.arrayContaining(["gussetLeft", "gussetRight", "bottom"]));
  });
});
