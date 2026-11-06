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

  it("0350: every flap of the octagonal flap bottom carries the bottom artwork (R5-3Q-B)", () => {
    // The side and corner minor flaps show round the two majors (most of the octagon).
    const def = byCode("FEFCO_0350");
    const m = generateFamilyDieline(def, def.defaultDims, { thicknessMm: 3 });
    const ids = m.faces.bottom!.parts.map((p) => p.panelId);
    for (let i = 0; i < 8; i++) expect(ids).toContain(`bottomFlap${i}`);
  });

  it.each([
    // R5-3Q-B: the two gussets on one wall overlap when the tray is deeper than half that wall
    // (0303 / 0308: the pair on a long wall differ in x, not y), and a deep lid's second inside
    // pair must not enter the base walls (0308 / 0309). 0307: locking noses on a short wall.
    ["FEFCO_0303", { L: 150, W: 120, H: 100 }, undefined],
    ["FEFCO_0308", { L: 150, W: 120, H: 100 }, 100],
    ["FEFCO_0309", { L: 700, W: 500, H: 300 }, 300],
    ["FEFCO_0307", { L: 80, W: 60, H: 300 }, undefined],
  ] as const)("%s %o lid %s: no shared board at size extremes", (code, dims, lid) => {
    const def = byCode(code);
    // Inside gussets: the web stays joined to the neighbouring wall of the same blank (a real
    // bend, as WEB_BENDS above). A lid gusset touching a base wall is a clash.
    const web = /^(lid_)?(end[LR]|long[TB]|gus[TB][LR][ab]) × (lid_)?(end[LR]|long[TB]|gus[TB][LR][ab])$/;
    const sameBlank = (a: string, b: string) => a.startsWith("lid_") === b.startsWith("lid_");
    for (const t of [1.5, 3]) {
      const m = generateFamilyDieline(def, dims, { thicknessMm: t, features: lid ? { lidHeightMm: lid } : {} });
      const found = clashes(m, 1)
        .filter((c) => !(code.match(/030[89]/) && web.test(`${c.a} × ${c.b}`) && /gus/.test(c.a) !== /gus/.test(c.b) && sameBlank(c.a, c.b)))
        .map((c) => `${t} ${c.a} × ${c.b}`);
      expect(found).toEqual([]);
    }
  });

  it("octabin side faces wrap half of each corner panel, seamlessly (artwork runs round the chamfers)", () => {
    const def = byCode("FEFCO_0351");
    const m = generateFamilyDieline(def, def.defaultDims, { thicknessMm: 3 });
    const front = m.faces.front!;
    const part = (id: string) => front.parts.find((p) => p.panelId === id)!;
    const side = m.panels.find((p) => p.id === "p0")!;
    const corner = m.panels.find((p) => p.id === "p1")!;
    expect(front.parts.map((p) => p.panelId)).toEqual(expect.arrayContaining(["p7", "p0", "p1"]));
    // Side panel + two corner halves (the cap rims, a clearance further out, run a little wider).
    expect(front.width).toBeGreaterThan(side.bbox.width + corner.bbox.width - 0.5);
    expect(front.width).toBeLessThan(side.bbox.width + corner.bbox.width + 20);
    expect(front.parts.filter((p) => /Cap_wall/.test(p.panelId))).toHaveLength(6);
    // Face points either side of each corner crease land on the two panels' shared crease.
    const sheetAt = (id: string, u: number, v: number) => {
      const [a, b, c, d, e, f] = part(id).transform;
      return { x: a * u + c * v + e, y: b * u + d * v + f };
    };
    const v = part("p0").rect.y + 10;
    const right = part("p0").rect.x + part("p0").rect.width;
    expect(sheetAt("p0", right, v).x).toBeCloseTo(sheetAt("p1", right, v).x, 6);
    expect(sheetAt("p1", right, v).x).toBeCloseTo(corner.bbox.x, 6);
    const left = part("p0").rect.x;
    const p7 = m.panels.find((p) => p.id === "p7")!;
    expect(sheetAt("p7", left, v).x).toBeCloseTo(p7.bbox.x + p7.bbox.width, 6);
    expect(sheetAt("p0", left, v).x).toBeCloseTo(side.bbox.x, 6);
  });

  it.each(["FEFCO_0300", "FEFCO_0303", "FEFCO_0304", "FEFCO_0307", "FEFCO_0308", "FEFCO_0309", "FEFCO_0321", "FEFCO_0322", "FEFCO_0323", "FEFCO_0330", "FEFCO_0331", "FEFCO_0310", "FEFCO_0313"])(
    "%s: below a partial lid the base walls carry the side artwork (R6-3Q-B)",
    (code) => {
      // 0304: the base end walls between the outside gusset triangles were bare board below a
      // partial lid (they lie 11.5 mm under the lid's gussets); 0321: both base end walls.
      const def = byCode(code);
      // Sizes where the two outside gussets on one wall overlap (four layers out).
      const d = code === "FEFCO_0304" ? { L: 330, W: 210, H: 120 } : code === "FEFCO_0303" ? { L: 150, W: 120, H: 100 } : def.defaultDims;
      for (const t of [1.5, 3]) {
        const m = generateFamilyDieline(def, d, { thicknessMm: t, features: { lidHeightMm: Math.round(d.H * 0.4) } });
        const base = m.panels[0].pieceId;
        const cov = faceCoverage(m);
        for (const face of ["front", "back", "left", "right"] as const) {
          const parts = m.faces[face]!.parts.map((p) => m.panels.find((q) => q.id === p.panelId)!);
          expect(parts.some((p) => p.pieceId === base), `${code} t=${t} ${face}: base wall printed`).toBe(true);
          // 0.85: the outside gussets of the other wall pair stand up to 4t proud of these edges.
          expect(cov[face], `${code} t=${t} ${face}`).toBeGreaterThanOrEqual(0.85);
        }
      }
    },
  );
});
