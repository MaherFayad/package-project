import { describe, expect, it } from "vitest";
import { VESSEL_MODELS, describeVesselModel, type VesselModelDef } from "@/lib/library";
import { describeVesselDraft } from "../config";

// 3D QA round 6, item 8: the Model panel's size check describes the vessel with the chosen closure,
// so its neck finish (and the outer size, print areas) match the 3D view (engine R6-3Q-F-01).
const model = (slug: string) => VESSEL_MODELS.find((m) => m.slug === slug) as VesselModelDef;

describe("describeVesselDraft passes the chosen closure", () => {
  const m = model("glass-water-bottle");
  const p = m.presets.find((x) => x.id === m.defaultPresetId) ?? m.presets[0];
  const base = { surfaces: m.defaultSurfaces, container: m.defaultContainer, options: undefined };

  it("follows the closure: a swing top stands taller than the ROPP cap on the same bottle", () => {
    const ropp = describeVesselDraft(m, p.dims, { ...base, closure: "ROPP_CAP" });
    const swing = describeVesselDraft(m, p.dims, { ...base, closure: "SWING_TOP" });
    expect(swing.envelope.height).toBeGreaterThan(ropp.envelope.height);
  });

  it("matches the engine's description for every closure of every multi-closure bottle", () => {
    for (const mm of VESSEL_MODELS.filter((x) => x.closures.length > 1)) {
      const pp = mm.presets.find((x) => x.id === mm.defaultPresetId) ?? mm.presets[0];
      for (const c of mm.closures) {
        const v = { surfaces: mm.defaultSurfaces, container: mm.defaultContainer, options: undefined, closure: c.code };
        expect(describeVesselDraft(mm, pp.dims, v), `${mm.slug} / ${c.code}`).toEqual(describeVesselModel(mm, pp.dims, v.surfaces, undefined, v.container, undefined, c.code));
      }
    }
  });
});
