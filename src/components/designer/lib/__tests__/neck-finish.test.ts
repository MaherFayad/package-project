import { describe, expect, it } from "vitest";
import { BOX_MODELS, VESSEL_MODELS, type VesselModelDef } from "@/lib/library";
import { neckFinishLabel } from "../config";

// R14-04: the Model panel shows the neck finish of the chosen closure under a bottle's name.
const water = VESSEL_MODELS.find((m) => m.slug === "glass-water-bottle") as VesselModelDef;

describe("neckFinishLabel", () => {
  it("follows the chosen closure, in both languages", () => {
    expect(neckFinishLabel(water, "ROPP_CAP", "en")).toMatch(/PP 28/);
    expect(neckFinishLabel(water, "SWING_TOP", "en")).toMatch(/swing/i);
    expect(neckFinishLabel(water, "CROWN_26", "en")).toMatch(/crown/i);
    expect(neckFinishLabel(water, "SWING_TOP", "ar")).toMatch(/[؀-ۿ]/);
    expect(neckFinishLabel(water, "SWING_TOP", "ar")).not.toBe(neckFinishLabel(water, "ROPP_CAP", "ar"));
  });

  it("never shows a raw finish id", () => {
    for (const m of VESSEL_MODELS) for (const c of m.closures) for (const loc of ["ar", "en"] as const) {
      const label = neckFinishLabel(m, c.code, loc);
      if (label) expect(label, `${m.slug} ${c.code}`).not.toMatch(/^(PP\d|TO\d|SCREW_|CROWN_|SWING_)/);
    }
  });

  it("falls back to the default closure, and is null for boxes", () => {
    expect(neckFinishLabel(water, undefined, "en")).toBe(neckFinishLabel(water, water.defaultClosure, "en"));
    expect(neckFinishLabel(BOX_MODELS[0], undefined, "en")).toBeNull();
  });
});
