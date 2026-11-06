import { describe, expect, it } from "vitest";
import { DEFINITIONS, buildFefco02Dieline } from "..";
import { clashes, faceCoverage, mirroredParts } from "./closedPose";

/**
 * What the live 3D designer shows for every group 02 style: closed boxes with no board passing
 * through board, no two surfaces fighting for the same pixels, faces fully covered by the
 * panels that carry their artwork, mapped without mirroring.
 */

/** Faces that are open or not rectangular by design (share of the face rect that is board). */
const OPEN_FACES: Record<string, Partial<Record<string, number>>> = {
  FEFCO_0209: { top: 0.5 }, // frame round an open top
  FEFCO_0217: { left: 0.8, right: 0.8, front: 0.93, back: 0.93 }, // gable triangles; hand hole in the handle
  FEFCO_0226: { left: 0.75, right: 0.75 }, // hip triangles above the end walls
};
const MIN_COVERAGE = 0.94; // slots between flaps (2t + 2 mm) are real gaps

describe.each(DEFINITIONS.map((d) => [d.code, d] as const))("%s in 3D", (code, def) => {
  it.each([1.5, 3])("t=%s: closed box has no interpenetrating or z-fighting panels", (t) => {
    const m = buildFefco02Dieline(def, def.defaultDims, { thicknessMm: t });
    expect(clashes(m, 1).map((c) => `${c.kind} ${c.a} × ${c.b} (${c.samples})`)).toEqual([]);
  });

  it.each([1.5, 3])("t=%s: every face is covered by its panels, unmirrored", (t) => {
    const m = buildFefco02Dieline(def, def.defaultDims, { thicknessMm: t });
    expect(mirroredParts(m)).toEqual([]);
    for (const [face, share] of Object.entries(faceCoverage(m))) {
      expect(share, `${code} ${face}`).toBeGreaterThanOrEqual(OPEN_FACES[code]?.[face] ?? MIN_COVERAGE);
    }
  });
});

describe("FEFCO 02 fold sequence", () => {
  it.each(DEFINITIONS.filter((d) => ["FEFCO_0207", "FEFCO_0208", "FEFCO_0225", "FEFCO_0229"].includes(d.code)).map((d) => [d.code, d] as const))(
    "%s: panels never sweep through each other half-way",
    (_code, def) => {
      const m = buildFefco02Dieline(def, def.defaultDims, { thicknessMm: 1.5 });
      for (const progress of [0.25, 0.5, 0.75]) expect(clashes(m, progress).map((c) => `${progress} ${c.a} × ${c.b}`)).toEqual([]);
    },
  );

  it("overlapped inner flaps carry the end-face artwork (0202 top = all four flaps)", () => {
    const def = DEFINITIONS.find((d) => d.code === "FEFCO_0202")!;
    const m = buildFefco02Dieline(def, def.defaultDims, { thicknessMm: 3 });
    expect(m.faces.top!.parts.map((p) => p.panelId).sort()).toEqual(["topFlap_back", "topFlap_front", "topFlap_left", "topFlap_right"]);
    expect(m.faces.top!.height).toBeCloseTo(m.closedOuter.W, 0);
  });

  it("roofs continue the wall faces: 0217 front runs over roof and handle, 0226 over its leaning flap", () => {
    const g = DEFINITIONS.find((d) => d.code === "FEFCO_0217")!;
    const m = buildFefco02Dieline(g, g.defaultDims, { thicknessMm: 1.5 });
    expect(m.faces.front!.parts.map((p) => p.panelId)).toEqual(["front", "roof_front", "handle_front"]);
    expect(m.faces.top).toBeUndefined();
    const p = DEFINITIONS.find((d) => d.code === "FEFCO_0226")!;
    const m2 = buildFefco02Dieline(p, p.defaultDims, { thicknessMm: 1.5 });
    expect(m2.faces.left!.parts.map((x) => x.panelId)).toEqual(["left", "topFlap_left"]);
    // Pinch top: the long flaps reach the ridge (within a caliper of the centre line).
    const ridge = m2.closedOuter.H - (p.defaultDims.H + 2 * 1.5 * 2);
    expect(ridge).toBeGreaterThan(0.2 * p.defaultDims.W);
  });
});
