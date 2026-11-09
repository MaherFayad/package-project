import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { STRUCTURE_CODES } from "@/types";
import { BOARD_SPECS, DEFAULT_DIMS, defaultMaterialFor, generateDieline } from "@/lib/dieline";
import { buildFilmGeometry, buildPanelGeometry, buildPerfGeometry, pointInPolygon } from "../panelGeometry";
import { createBoardMaterials, MAT_EDGE, MAT_INSIDE, MAT_OUTSIDE } from "../boardMaterials";
import { boardAppearance } from "@/lib/dieline";
import type { DielineModel, DielinePanel, Pt, Segment } from "@/lib/dieline";

const onSeg = (p: Pt, s: Segment) => {
  const dx = s.b.x - s.a.x;
  const dy = s.b.y - s.a.y;
  const l2 = dx * dx + dy * dy;
  const t = ((p.x - s.a.x) * dx + (p.y - s.a.y) * dy) / l2;
  return t > -1e-6 && t < 1 + 1e-6 && Math.abs(dx * (p.y - s.a.y) - dy * (p.x - s.a.x)) / Math.sqrt(l2) < 1e-3;
};
/** R5-3Q-A-03: a crease folded ~90° about the printed face (its end face is set back, see panelGeometry). */
const squareCrease = (c: DielinePanel) => !!c.hinge && c.hingeKind !== "roll" && !c.pivotDepth && Math.abs(Math.abs(c.foldAngleClosed) - 90) <= 30;
/**
 * Side quads of the outline after the R6 split (R6-3Q-C-01 follow-up): every outline edge is cut
 * where a collinear hinge (own, children's, roll) starts or ends; pieces on a roll hinge get no
 * side face. Pieces on a square crease keep theirs (set back, so a half-open fold shows no slot);
 * `hidden` counts those. Returns { quads, hidden, foldOnLongEdge }.
 */
function outlinePieces(model: DielineModel, panel: DielinePanel) {
  const hingeSegs = [panel, ...model.panels.filter((c) => c.parentId === panel.id)].filter((c) => c.hinge).map((c) => ({ c, h: c.hinge! }));
  const skip = hingeSegs.filter(({ c }) => c.hingeKind === "roll").map((x) => x.h);
  const square = hingeSegs.filter(({ c }) => c.hingeKind !== "roll" && squareCrease(c)).map((x) => x.h);
  const creases = hingeSegs.filter(({ c }) => c.hingeKind !== "roll").map((x) => x.h);
  const poly = panel.polygon;
  let quads = 0;
  let hidden = 0;
  let foldOnLongEdge = 0;
  for (let i = 0; i < poly.length; i++) {
    const A = poly[i];
    const B = poly[(i + 1) % poly.length];
    const dx = B.x - A.x;
    const dy = B.y - A.y;
    const L2 = dx * dx + dy * dy;
    if (L2 < 1e-12) continue;
    const ts = [0, 1];
    for (const { h } of hingeSegs)
      for (const q of [h.a, h.b]) {
        const t = ((q.x - A.x) * dx + (q.y - A.y) * dy) / L2;
        if (t > 1e-4 && t < 1 - 1e-4 && Math.abs(dx * (q.y - A.y) - dy * (q.x - A.x)) / Math.sqrt(L2) < 1e-3) ts.push(t);
      }
    ts.sort((a, b) => a - b);
    const split = ts.length > 2;
    for (let k = 0; k + 1 < ts.length; k++) {
      if (ts[k + 1] - ts[k] < 1e-6 || Math.sqrt(L2) * (ts[k + 1] - ts[k]) < 1e-6) continue;
      const pa = { x: A.x + dx * ts[k], y: A.y + dy * ts[k] };
      const pb = { x: A.x + dx * ts[k + 1], y: A.y + dy * ts[k + 1] };
      if (skip.some((h) => onSeg(pa, h) && onSeg(pb, h))) continue;
      quads++;
      if (square.some((h) => onSeg(pa, h) && onSeg(pb, h))) {
        hidden++;
        continue;
      }
      if (split && creases.some((h) => onSeg(pa, h) && onSeg(pb, h))) foldOnLongEdge++;
    }
  }
  return { quads, hidden, foldOnLongEdge };
}
const hiddenEdges = (model: DielineModel, panel: DielinePanel) => outlinePieces(model, panel).hidden;

describe.each(STRUCTURE_CODES)("panel geometry %s", (code) => {
  const material = defaultMaterialFor(code);
  const model = generateDieline(code, DEFAULT_DIMS[code], { thicknessMm: BOARD_SPECS[material].thicknessMm });

  it("builds a closed slab per panel with outside/inside/edge groups and sheet UVs", () => {
    for (const panel of model.panels) {
      const g = buildPanelGeometry(model, panel);
      const pos = g.getAttribute("position");
      const uv = g.getAttribute("uv");
      const nor = g.getAttribute("normal");
      const n = panel.polygon.length;
      const holes = panel.holes ?? [];
      const hv = holes.reduce((s, h) => s + h.length, 0);
      // earcut: V - 2 + 2 × holes triangles per face; 2 triangles per outline/aperture edge
      const tris = n + hv - 2 + 2 * holes.length;
      expect(pos.count).toBe(tris * 3 * 2 + (outlinePieces(model, panel).quads + hv) * 6);
      expect(g.groups.map((x) => x.materialIndex)).toEqual([MAT_OUTSIDE, MAT_INSIDE, MAT_EDGE]);
      expect(Array.from(pos.array as Float32Array).every(Number.isFinite)).toBe(true);
      // outside face points +Z, triangles wound counter-clockwise (front-facing)
      const a = new Vector3().fromBufferAttribute(pos, 0);
      const b = new Vector3().fromBufferAttribute(pos, 1);
      const c = new Vector3().fromBufferAttribute(pos, 2);
      const face = new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a));
      expect(face.z).toBeGreaterThan(0);
      expect(nor.getZ(0)).toBeGreaterThan(0.9); // < 1 only next to a rolled (smooth-shaded) hinge
      // UVs of the faces stay inside the sheet
      const faceVerts = tris * 3 * 2;
      for (let i = 0; i < faceVerts; i++) {
        expect(uv.getX(i)).toBeGreaterThanOrEqual(0);
        expect(uv.getX(i)).toBeLessThanOrEqual(1);
        expect(uv.getY(i)).toBeGreaterThanOrEqual(0);
        expect(uv.getY(i)).toBeLessThanOrEqual(1);
      }
      // slab thickness = board thickness
      g.computeBoundingBox();
      expect(g.boundingBox!.max.z - g.boundingBox!.min.z).toBeCloseTo(model.thicknessMm, 5);
      g.dispose();
    }
  });
});

describe("feature geometry", () => {
  it("cuts window apertures (extra edge walls) and builds film and perforation meshes", () => {
    const m = generateDieline("FEFCO_0427", DEFAULT_DIMS.FEFCO_0427, { thicknessMm: 1.5, features: { window: { face: "top" }, tearStrip: true } });
    const lid = m.panels.find((p) => p.holes?.length)!;
    const g = buildPanelGeometry(m, lid);
    const n = lid.polygon.length;
    const h = lid.holes![0].length;
    // outline + hole: (n + h) edge quads, and earcut uses n + h vertices → n + h triangles per face
    expect(g.getAttribute("position").count).toBe((n + h) * 3 * 2 + (outlinePieces(m, lid).quads + h) * 6);
    g.dispose();
    const film = buildFilmGeometry(m, lid, m.films[0].polygon);
    expect(film.getAttribute("position").count).toBeGreaterThan(0);
    film.dispose();
    const perfPanel = m.panels.find((p) => pointInPolygon({ x: (m.perfLines[0].a.x + m.perfLines[0].b.x) / 2, y: (m.perfLines[0].a.y + m.perfLines[0].b.y) / 2 }, p.polygon))!;
    expect(perfPanel.id).toBe("top");
    const perf = buildPerfGeometry(m, perfPanel, m.perfLines);
    expect(perf.getAttribute("position").count % 6).toBe(0);
    expect(perf.getAttribute("position").count).toBeGreaterThan(60);
    perf.dispose();
  });

  it("closes a 90° crease about the printed face with a set-back end face (no slot when half open, no z-fight when square)", () => {
    const m = generateDieline("RIGID_BOX", DEFAULT_DIMS.RIGID_BOX, { thicknessMm: BOARD_SPECS[defaultMaterialFor("RIGID_BOX")].thicknessMm });
    let square = 0;
    for (const p of m.panels) square += hiddenEdges(m, p);
    // every wall of the lid and the base folds 90° on its crease
    expect(square).toBeGreaterThanOrEqual(8);
    const wall = m.panels.find((p) => squareCrease(p))!;
    const g = buildPanelGeometry(m, wall);
    // the crease end face is there (slab closed along the fold) ...
    const pos = g.getAttribute("position");
    const faces = (wall.polygon.length + (wall.holes ?? []).reduce((s, h) => s + h.length, 0) - 2 + 2 * (wall.holes?.length ?? 0)) * 6;
    expect(pos.count - faces).toBe((outlinePieces(m, wall).quads + (wall.holes ?? []).reduce((s, h) => s + h.length, 0)) * 6);
    expect(Array.from(pos.array as Float32Array).every(Number.isFinite)).toBe(true);
    g.dispose();
  });

  it("prints the part of a long outline edge a shorter flap is hinged on (R6-3Q-C-01 follow-up)", () => {
    // across every core structure, some outline edges are longer than the hinge on them; their
    // covered piece is a printed fold now, and it lands in the outside (printed) group
    let found = 0;
    for (const code of STRUCTURE_CODES) {
      const m = generateDieline(code, DEFAULT_DIMS[code], { thicknessMm: BOARD_SPECS[defaultMaterialFor(code)].thicknessMm });
      for (const p of m.panels) {
        const { foldOnLongEdge } = outlinePieces(m, p);
        if (!foldOnLongEdge) continue;
        found += foldOnLongEdge;
        const g = buildPanelGeometry(m, p);
        const faceVerts = (p.polygon.length + (p.holes ?? []).reduce((s, h) => s + h.length, 0) - 2 + 2 * (p.holes?.length ?? 0)) * 3;
        // outside group = outside face + every fold side face
        expect(g.groups[0].count, `${code}/${p.id}`).toBeGreaterThanOrEqual(faceVerts + foldOnLongEdge * 6);
        g.dispose();
      }
    }
    expect(found).toBeGreaterThan(0);
  });

  it("smooths shading across the rolled tube label", () => {
    const m = generateDieline("PAPER_TUBE", DEFAULT_DIMS.PAPER_TUBE, { thicknessMm: 1.5 });
    const strip = m.panels.find((p) => p.id === "body1")!;
    const g = buildPanelGeometry(m, strip);
    const nor = g.getAttribute("normal");
    const xs = new Set<number>();
    for (let i = 0; i < 6; i++) xs.add(Math.round(nor.getX(i) * 1e4));
    expect(xs.size).toBeGreaterThan(1); // vertex normals differ across the strip
    g.dispose();
  });
});

describe("board materials", () => {
  it("creates three materials and disposes them (no DOM needed)", () => {
    const set = createBoardMaterials({ appearance: boardAppearance("E_FLUTE_KRAFT"), finish: "GLOSS_LAMINATION", sheet: { width: 500, height: 400 } });
    expect(set.list).toHaveLength(3);
    expect((set.list[0] as unknown as { roughness: number }).roughness).toBeLessThan(0.3);
    expect(() => set.dispose()).not.toThrow();
    const matte = createBoardMaterials({ appearance: boardAppearance("SBS_350"), finish: "MATTE_LAMINATION", sheet: { width: 200, height: 300 } });
    expect((matte.list[0] as unknown as { roughness: number }).roughness).toBeGreaterThan(0.4);
    matte.dispose();
  });
});
