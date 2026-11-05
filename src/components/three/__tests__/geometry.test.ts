import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { STRUCTURE_CODES } from "@/types";
import { BOARD_SPECS, DEFAULT_DIMS, defaultMaterialFor, generateDieline } from "@/lib/dieline";
import { buildPanelGeometry } from "../panelGeometry";
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
      expect(pos.count).toBe((n - 2) * 3 * 2 + n * 6);
      expect(g.groups.map((x) => x.materialIndex)).toEqual([MAT_OUTSIDE, MAT_INSIDE, MAT_EDGE]);
      expect(Array.from(pos.array as Float32Array).every(Number.isFinite)).toBe(true);
      // outside face points +Z, triangles wound counter-clockwise (front-facing)
      const a = new Vector3().fromBufferAttribute(pos, 0);
      const b = new Vector3().fromBufferAttribute(pos, 1);
      const c = new Vector3().fromBufferAttribute(pos, 2);
      const face = new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a));
      expect(face.z).toBeGreaterThan(0);
      expect(nor.getZ(0)).toBe(1);
      // UVs of the faces stay inside the sheet
      const faceVerts = (n - 2) * 3 * 2;
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
