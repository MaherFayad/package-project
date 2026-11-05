import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { STRUCTURE_CODES } from "@/types";
import { BOARD_SPECS, DEFAULT_DIMS, defaultMaterialFor, generateDieline } from "@/lib/dieline";
import { buildFilmGeometry, buildPanelGeometry, buildPerfGeometry, pointInPolygon } from "../panelGeometry";
import { createBoardMaterials, MAT_EDGE, MAT_INSIDE, MAT_OUTSIDE } from "../boardMaterials";
import { boardAppearance } from "@/lib/dieline";

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
      expect(pos.count).toBe(tris * 3 * 2 + (n + hv) * 6);
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
    expect(g.getAttribute("position").count).toBe((n + h) * 3 * 2 + (n + h) * 6);
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
