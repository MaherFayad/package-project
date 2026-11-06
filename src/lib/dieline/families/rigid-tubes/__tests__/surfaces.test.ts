import { describe, expect, it } from "vitest";
import { DEFINITIONS, FAMILY_MATERIALS } from "..";
import { describeHits, faceMappingErrors, surfaceHits } from "./surfaces";

/**
 * Closed 3D model, every preset × every board: no z-fighting faces and no piece piercing
 * another (lid turn-ins through base walls, cover turn-ins through the tray, cap curls
 * through the body). Envelopes are flat stock and out of the 3D designer.
 */
const SOLID = DEFINITIONS.filter((d) => d.family !== "ENVELOPE");

describe.each(SOLID.map((d) => [d.code, d] as const))("%s closed surfaces", (_c, def) => {
  it("no z-fighting or piercing, artwork upright and unmirrored, on any preset and board", () => {
    for (const material of def.materials) {
      const t = FAMILY_MATERIALS[material].thicknessMm;
      for (const dims of [def.defaultDims, ...def.presets.map((p) => p.dims)]) {
        const m = def.generate(dims, { material, thicknessMm: t, features: def.defaultFeatures });
        const hits = surfaceHits(m);
        expect(hits, `${material} ${JSON.stringify(dims)}: ${describeHits(hits)}`).toEqual([]);
        expect(faceMappingErrors(m), `${material} ${JSON.stringify(dims)} artwork orientation`).toEqual([]);
      }
    }
  });
});

describe("rigid options keep the surfaces clean", () => {
  const variants = [{ thumbNotch: true }, { lidHeightMm: 15 }, { lidHeightMm: 400 }, { window: { face: "top" as const, widthRatio: 0.5, heightRatio: 0.5 } }];
  for (const def of SOLID.filter((d) => d.family === "RIGID" || d.family === "TUBE")) {
    it(def.code, () => {
      for (const features of variants) {
        const hits = surfaceHits(def.generate(def.defaultDims, { features }));
        expect(hits, `${JSON.stringify(features)}: ${describeHits(hits)}`).toEqual([]);
      }
    });
  }
});
