import { describe, expect, it } from "vitest";
import { DEFINITIONS, generateFamilyDieline } from "..";
import { clashes, faceCoverage, mirroredParts } from "../../fefco-02/__tests__/closedPose";

/**
 * What the live 3D designer shows for every group 03 / 05 style once assembled: no board
 * through board, no z-fighting, every face covered by the panels that carry its artwork.
 */

const OCTAGON_ENDS = 0.8; // octagonal caps fill ~83 % of their bounding rectangle
const OPEN_FACES: Record<string, Partial<Record<string, number>>> = {
  FEFCO_0350: { top: OCTAGON_ENDS, bottom: OCTAGON_ENDS },
  FEFCO_0351: { top: OCTAGON_ENDS, bottom: OCTAGON_ENDS },
  FEFCO_0352: { top: 0.9, bottom: 0.9 },
};
const MIN_COVERAGE = 0.93; // corner relief and the clearance step between lid and base

/** Bends that are not hinges: a gusset's web stays joined to the next wall along a crease. */
const WEB_BENDS: Record<string, RegExp> = {
  FEFCO_0308: /^(lid_)?end[LR] × (lid_)?gus[TB][LR][ab]$/,
};

describe.each(DEFINITIONS.map((d) => [d.code, d] as const))("%s in 3D", (code, def) => {
  it.each([1.5, 3])("t=%s: assembled set has no interpenetrating or z-fighting panels", (t) => {
    const m = generateFamilyDieline(def, def.defaultDims, { thicknessMm: t });
    const found = clashes(m, 1)
      .map((c) => `${c.a} × ${c.b}`)
      .filter((s) => !WEB_BENDS[code]?.test(s));
    expect(found).toEqual([]);
  });

  it.each([1.5, 3])("t=%s: every face is covered by its panels, unmirrored", (t) => {
    const m = generateFamilyDieline(def, def.defaultDims, { thicknessMm: t });
    expect(mirroredParts(m)).toEqual([]);
    for (const [face, share] of Object.entries(faceCoverage(m))) {
      expect(share, `${code} ${face}`).toBeGreaterThanOrEqual(OPEN_FACES[code]?.[face] ?? MIN_COVERAGE);
    }
  });
});

describe("FEFCO 03 / 05 fold sequence and mapping", () => {
  const byCode = (c: string) => DEFINITIONS.find((d) => d.code === c)!;

  it.each(["FEFCO_0300", "FEFCO_0310", "FEFCO_0322", "FEFCO_0331", "FEFCO_0350"])("%s: walls, corner flaps and ears never sweep through each other", (code) => {
    const def = byCode(code);
    const m = generateFamilyDieline(def, def.defaultDims, { thicknessMm: 1.5 });
    // Panels of one blank only (extra pieces fly in on a straight path: engine-side).
    for (const progress of [0.25, 0.5]) {
      const found = clashes(m, progress).filter((c) => {
        const pa = m.panels.find((p) => p.id === c.a)!.pieceId;
        const pb = m.panels.find((p) => p.id === c.b)!.pieceId;
        return pa === pb;
      });
      expect(found.map((c) => `${progress} ${c.a} × ${c.b}`)).toEqual([]);
    }
  });

  it("0314: the sleeve sides between the self-locking caps carry the end-face artwork", () => {
    const def = byCode("FEFCO_0314");
    const m = generateFamilyDieline(def, def.defaultDims, { thicknessMm: 3 });
    expect(m.faces.left!.parts.map((p) => p.panelId)).toContain("p3");
    expect(m.faces.right!.parts.map((p) => p.panelId)).toContain("p1");
  });

  it("0321: the minor envelope flaps between the tapered majors are printed", () => {
    const def = byCode("FEFCO_0321");
    const m = generateFamilyDieline(def, def.defaultDims, { thicknessMm: 1.5 });
    expect(m.faces.top!.parts).toHaveLength(4);
  });

  it("octabin faces are the flat side panels (artwork centred on a face lands on the board)", () => {
    const def = byCode("FEFCO_0351");
    const m = generateFamilyDieline(def, def.defaultDims, { thicknessMm: 3 });
    const front = m.faces.front!;
    const widest = Math.max(...front.parts.map((p) => p.rect.width));
    expect(front.parts.map((p) => p.panelId)).toContain("p0");
    expect(front.width).toBeCloseTo(widest, 6);
    expect(front.width).toBeLessThan(0.6 * m.closedOuter.L);
  });
});
