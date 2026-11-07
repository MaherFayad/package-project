/**
 * R6-3Q-D-06: the gable ends of the gable-top liquid carton fold in as a real Pure-Pak / Tetra
 * Rex gusset. The end panel's top strip is split by two diagonal creases (end wall top corners
 * → centre of the fin line) and a centre crease; closed, the two centre halves tilt inward as
 * one recessed triangle under the fin and the two outer tucks fold back under the roof panels.
 */
import { describe, expect, it } from "vitest";
import { BOARD_SPECS, computePoses, panelLocalPoint, panelPivot, type DielineModel } from "../../..";
import { segLength } from "../../../geometry";
import { DEFINITIONS_BY_CODE, generateFamilyDieline, gussetFolds } from "..";

const def = DEFINITIONS_BY_CODE.LIQUID_GABLE_TOP;
const sizes = [def.defaultDims, ...def.presets.map((p) => p.dims)];
const boards = [BOARD_SPECS.SBS_350.thicknessMm, 0.3, 0.6];

function closed(m: DielineModel) {
  const poses = computePoses(m, 1);
  const t = m.thicknessMm;
  return (id: string, depth = 0) => {
    const p = m.panels.find((q) => q.id === id)!;
    const pv = panelPivot(p, t);
    return p.polygon.map((q) => panelLocalPoint(p, q, depth, pv, t).applyMatrix4(poses.get(id)!.world));
  };
}

describe("gable-top carton: folded gable-end gussets (R6-3Q-D-06)", () => {
  it("ideal board (t → 0): halves tilt 45° and the tucks fold back 120° flat under the 45° roof", () => {
    const f = gussetFolds(35, 35 * Math.SQRT2, 0, 0, 0);
    expect(f.half).toBeCloseTo(45, 0);
    expect(Math.abs(f.half - 45)).toBeLessThan(0.1);
    expect(Math.abs(f.tuck + 120)).toBeLessThan(0.5);
  });

  it("sheet: each end's top strip is two centre halves + two tucks with diagonal and centre creases", () => {
    const m = generateFamilyDieline(def, def.defaultDims, { thicknessMm: BOARD_SPECS.SBS_350.thicknessMm });
    const roof = m.panels.find((p) => p.id === "roof_front")!;
    for (const side of ["left", "right"]) {
      const wall = m.panels.find((p) => p.id === side)!;
      expect(wall.polygon).toHaveLength(4); // plain end wall, no flat pentagon
      for (const k of ["a", "b"]) {
        const half = m.panels.find((p) => p.id === `gusset_${side}_${k}`)!;
        // Half a hangs on the end wall's top crease, half b on half a's centre crease.
        expect(half.parentId).toBe(k === "a" ? side : `gusset_${side}_a`);
        const tuck = m.panels.find((p) => p.id === `gusset_${side}_${k}_tuck`)!;
        expect(tuck.parentId).toBe(half.id);
        // The strip is as tall as the roof panel beside it; the diagonal is a fold (hinge).
        expect(tuck.bbox.height).toBeCloseTo(roof.bbox.height, 6);
        expect(segLength(tuck.hinge!)).toBeCloseTo(Math.hypot(wall.bbox.width / 2, roof.bbox.height), 6);
      }
      // Centre crease drawn on the die.
      const cx = wall.bbox.x + wall.bbox.width / 2;
      expect(m.creaseLines.some((c) => Math.abs(c.a.x - cx) < 1e-6 && Math.abs(c.b.x - cx) < 1e-6 && Math.abs(c.a.y - c.b.y) > roof.bbox.height - 1e-6)).toBe(true);
    }
    // Tube corners continued up the top strip: tuck ↔ roof are creases, not cuts.
    const cornerX = m.panels.find((p) => p.id === "front")!.bbox.x;
    const top = roof.bbox.y;
    expect(m.creaseLines.some((c) => Math.abs(c.a.x - cornerX) < 1e-6 && Math.abs(c.b.x - cornerX) < 1e-6 && Math.min(c.a.y, c.b.y) <= top + 1e-6)).toBe(true);
  });

  for (const t of boards) {
    for (const dims of sizes) {
      it(`closed ${dims.L}×${dims.W}×${dims.H} t=${t}: recessed gusset, roof edge closed, no board through the roof`, () => {
        const m = generateFamilyDieline(def, dims, { thicknessMm: t });
        const at = closed(m);
        const front = at("front");
        const xEnd = Math.min(...front.map((p) => p.x)); // left end plane (printed surface)
        const zFront = Math.max(...front.map((p) => p.z));
        const yWall = Math.max(...front.map((p) => p.y));
        const roof = at("roof_front");
        const ridgeY = Math.max(...roof.map((p) => p.y));
        // Closed pack: nothing proud of the end walls (L unchanged).
        expect(m.closedOuter.L).toBeLessThan(dims.L + 2 * t + 0.02);
        for (const side of ["left", "right"] as const) {
          const sgn = side === "left" ? 1 : -1;
          const end = sgn * xEnd;
          for (const k of ["a", "b"]) {
            // Centre halves: printed side faces out and up; every vertex at or inside the end
            // plane, the apex well inside (recessed) and up under the ridge.
            const half = at(`gusset_${side}_${k}`);
            for (const p of half) expect(sgn * (p.x - end)).toBeGreaterThan(-1e-6);
            const apex = half.reduce((a, b) => (b.y > a.y ? b : a));
            expect(sgn * (apex.x - end)).toBeGreaterThan(dims.W / 2 - 1);
            expect(apex.y).toBeLessThan(ridgeY);
            expect(apex.y).toBeGreaterThan(ridgeY - 2);
            // Tucks: never proud of the end plane, and both surfaces stay under the front /
            // back roof's printed surface (y + |z − zFront| ≤ roof plane): nothing pokes through.
            const tuck = [...at(`gusset_${side}_${k}_tuck`, 0), ...at(`gusset_${side}_${k}_tuck`, 1)];
            for (const p of tuck) expect(sgn * (p.x - end)).toBeGreaterThan(-1e-6);
            const ridgeZ = zFront - (dims.W + 2 * t) / 2;
            for (const p of tuck) {
              // Roof printed surface: y − yWall = (W'/2) − |z − ridgeZ| over the end (45°).
              const roofY = yWall + (dims.W + 2 * t) / 2 - Math.abs(p.z - ridgeZ);
              expect(p.y).toBeLessThan(roofY + 1e-6);
            }
            // The tuck's outer edge runs along the roof's end edge (no slot under the roof edge):
            // its corners stay within a millimetre of the end plane, under the roof board
            // and less than a caliper below it.
            const outer = at(`gusset_${side}_${k}_tuck`, 1).filter((p) => Math.abs(sgn * (p.x - end)) < 1);
            expect(outer.length).toBeGreaterThanOrEqual(2);
            for (const p of outer) {
              const roofIn = yWall + (dims.W + 2 * t) / 2 - Math.abs(p.z - ridgeZ) - t * Math.SQRT2;
              expect(roofIn - p.y).toBeGreaterThan(-1e-6);
              expect(roofIn - p.y).toBeLessThan(t);
            }
          }
        }
      });
    }
  }

  it("end faces carry the end wall and the whole gusset strip (halves + tucks)", () => {
    const m = generateFamilyDieline(def, def.defaultDims, { thicknessMm: BOARD_SPECS.SBS_350.thicknessMm });
    for (const side of ["left", "right"] as const) {
      expect(m.faces[side]!.parts.map((p) => p.panelId).sort()).toEqual([side, `gusset_${side}_a`, `gusset_${side}_a_tuck`, `gusset_${side}_b`, `gusset_${side}_b_tuck`].sort());
    }
  });
});
