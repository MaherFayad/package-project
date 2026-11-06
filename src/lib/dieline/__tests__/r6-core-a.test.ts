/**
 * Round 6 3D QA (family A: core structures + FEFCO 02): options that did nothing in 3D and the
 * split-wall seam. Checks the closed 3D pose, the state a buyer sees.
 */
import { describe, expect, it } from "vitest";
import { BOX_MODELS } from "@/lib/library";
import type { Dims, StructureFeatures } from "@/types";
import { BOARD_SPECS, computePoses, panelLocalPoint, panelPivot, type DielineModel } from "..";

function build(code: string, dims: Dims, features: StructureFeatures = {}, material?: string) {
  const m = BOX_MODELS.find((b) => b.code === code)!;
  const t = BOARD_SPECS[(material ?? m.materials[0]) as keyof typeof BOARD_SPECS].thicknessMm;
  return { d: m.build(dims, { thicknessMm: t, features }), t };
}

/** World-space bounds of a polygon of panel `id` at the closed pose. */
function worldBox(d: DielineModel, t: number, id: string, poly?: { x: number; y: number }[]) {
  const p = d.panels.find((q) => q.id === id)!;
  const pose = computePoses(d, 1).get(id)!;
  const pv = panelPivot(p, t);
  const pts = (poly ?? p.polygon).map((q) => panelLocalPoint(p, q, 0, pv, t).applyMatrix4(pose.world));
  const r = (k: "x" | "y" | "z") => [Math.min(...pts.map((q) => q[k])), Math.max(...pts.map((q) => q[k]))];
  return { x: r("x"), y: r("y"), z: r("z") };
}
const centre = (b: { y: number[]; z: number[] }) => ({ y: (b.y[0] + b.y[1]) / 2, z: (b.z[0] + b.z[1]) / 2 });
const panel = (d: DielineModel, id: string) => d.panels.find((p) => p.id === id)!;

describe("FEFCO_0320 telescope options", () => {
  const dims = { L: 330, W: 250, H: 60 };
  it("handle with the default full-depth lid cuts hand holes through lid and base end walls, in register", () => {
    const { d, t } = build("FEFCO_0320", dims, { handle: true });
    for (const side of ["left", "right"]) {
      const base = panel(d, side);
      const lid = panel(d, `lid_${side}`);
      expect(base.holes?.length).toBe(1);
      expect(lid.holes?.length).toBe(1);
      const a = centre(worldBox(d, t, side, base.holes![0]));
      const b = centre(worldBox(d, t, `lid_${side}`, lid.holes![0]));
      expect(Math.abs(a.y - b.y)).toBeLessThan(0.3);
      expect(Math.abs(a.z - b.z)).toBeLessThan(0.3);
    }
  });
  it("thumb notches are cut in the lid's open edge (the base rim is under the lid)", () => {
    const { d } = build("FEFCO_0320", dims, { thumbNotch: true });
    expect(panel(d, "lid_front").polygon.length).toBeGreaterThan(4);
    expect(panel(d, "lid_back").polygon.length).toBeGreaterThan(4);
    expect(panel(d, "front").polygon.length).toBe(4);
  });
});

describe("RIGID_BOX thumb notch", () => {
  it("is cut in the lid skirt (and its turn-in), not in the hidden base rim", () => {
    const { d } = build("RIGID_BOX", { L: 120, W: 120, H: 80 }, { thumbNotch: true });
    for (const id of ["lid_front", "lid_back", "lid_frontTurn", "lid_backTurn"]) expect(panel(d, id).polygon.length).toBeGreaterThan(4);
    expect(panel(d, "front").polygon.length).toBe(4);
  });
});

describe("hand holes on low walls", () => {
  it("FEFCO_0201 at its smallest size still gets hand holes", () => {
    const { d } = build("FEFCO_0201", { L: 100, W: 80, H: 60 }, { handle: true });
    expect(panel(d, "left").holes?.length).toBe(1);
    expect(panel(d, "right").holes?.length).toBe(1);
  });
  it("FEFCO_0202 (FEFCO 02 kit) at its smallest size gets hand holes", () => {
    const { d } = build("FEFCO_0202", { L: 100, W: 80, H: 60 }, { handle: true });
    expect(d.panels.filter((p) => p.holes?.length).length).toBeGreaterThanOrEqual(2);
  });
});

describe("split-wall seam (0228, 0230)", () => {
  for (const code of ["FEFCO_0228", "FEFCO_0230"]) {
    for (const material of ["E_FLUTE_KRAFT", "B_FLUTE_KRAFT"]) {
      it(`${code} ${material}: the two halves of the back major flap butt at the seam (no slot across the top)`, () => {
        const { d, t } = build(code, { L: 200, W: 150, H: 100 }, {}, material);
        for (const end of ["top", "bottom"]) {
          const a = worldBox(d, t, `${end}Flap_backA`);
          const b = worldBox(d, t, `${end}Flap_backB`);
          const gap = Math.max(b.x[0] - a.x[1], a.x[0] - b.x[1]);
          expect(Math.abs(gap)).toBeLessThan(0.05);
        }
      });
    }
  }
});
