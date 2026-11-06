import { describe, expect, it } from "vitest";
import { DEFINITIONS, FOOD_MATERIALS, generateFamilyDieline, type DielineDefinition } from "..";
import { describeHits, faceMappingErrors, surfaceHits } from "../../rigid-tubes/__tests__/surfaces";

/** Closed boxes (bags, tags and sleeves are flat or open): no z-fighting, no piercing pieces. */
const BOXES = DEFINITIONS.filter((d): d is DielineDefinition => d.kind === "dieline" && !d.code.startsWith("FS_BAG") && !["FS_HANG_TAG", "FS_BELLY_BAND", "FS_GIFT_SLEEVE"].includes(d.code));

describe.each(BOXES.map((d) => [d.code, d] as const))("%s closed surfaces", (_c, def) => {
  it("no z-fighting or piercing, artwork upright and unmirrored, on any preset and board", () => {
    for (const material of def.materials) {
      const t = FOOD_MATERIALS[material].thicknessMm;
      for (const dims of [def.defaultDims, ...def.presets.map((p) => p.dims)]) {
        const m = generateFamilyDieline(def, dims, { thicknessMm: t });
        const hits = surfaceHits(m);
        expect(hits, `${material} ${JSON.stringify(dims)}: ${describeHits(hits)}`).toEqual([]);
        expect(faceMappingErrors(m), `${material} ${JSON.stringify(dims)} artwork orientation`).toEqual([]);
      }
    }
  });
});
