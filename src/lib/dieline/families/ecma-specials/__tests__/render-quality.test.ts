/**
 * 3D render quality of every ECMA tuck-end and ECMA specials model as the designer builds it
 * (src/lib/library: default size and every preset, on each of its boards):
 *  - no z-fighting / interpenetration: closed panels that are parallel and overlap in
 *    projection are at least one caliper apart (coplanar boards flicker in WebGL);
 *  - the print bleed region of every printable panel covers the whole panel (a clip polygon
 *    that cuts into a panel shows as a cut through the artwork);
 *  - every face part is a panel whose printed side looks out of the closed pack, and the
 *    face artwork lands on it un-mirrored and, on the walls, the right way up.
 */
import { describe, expect, it } from "vitest";
import { Vec3 as Vector3 } from "@/lib/dieline/math";
import { BOX_MODELS } from "@/lib/library";
import { BOARD_SPECS, computePoses, panelLocalPoint, panelPivot, type DielineModel } from "../../..";
import { FACE_FRAMES, applyAffine } from "../../../fold";
import type { Polygon } from "../../../types";

const MODELS = BOX_MODELS.filter((m) => m.source === "ecma-tuck" || m.source === "ecma-specials");

function inPoly(x: number, y: number, poly: Polygon) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}

/** Pairs of closed panels that share a plane (or sit closer than a caliper) over > 20 mm². */
function overlaps(d: DielineModel): string[] {
  const t = d.thicknessMm;
  const poses = computePoses(d, 1);
  const frames = d.panels.map((p) => {
    const pose = poses.get(p.id)!;
    const pivot = panelPivot(p, t);
    const mid = p.polygon.map((q) => panelLocalPoint(p, q, 0.5, pivot, t).applyMatrix4(pose.world));
    return { p, n: new Vector3(0, 0, 1).transformDirection(pose.world).normalize(), mid };
  });
  const hits: string[] = [];
  for (let i = 0; i < frames.length; i++) {
    for (let j = i + 1; j < frames.length; j++) {
      const A = frames[i];
      const B = frames[j];
      if (Math.abs(A.n.dot(B.n)) < 0.999) continue;
      const dist = Math.abs(A.n.dot(B.mid[0]) - A.n.dot(A.mid[0]));
      if (dist >= t * 0.98) continue;
      const u = new Vector3().subVectors(A.mid[1], A.mid[0]).normalize();
      const v = new Vector3().crossVectors(A.n, u).normalize();
      const pa = A.mid.map((q) => ({ x: q.dot(u), y: q.dot(v) }));
      const pb = B.mid.map((q) => ({ x: q.dot(u), y: q.dot(v) }));
      const xs = pa.map((q) => q.x);
      const ys = pa.map((q) => q.y);
      const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
      const N = 24;
      let hit = 0;
      for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) {
        const x = x0 + ((a + 0.5) / N) * (x1 - x0);
        const y = y0 + ((b + 0.5) / N) * (y1 - y0);
        if (inPoly(x, y, pa) && inPoly(x, y, pb)) hit++;
      }
      if ((hit / (N * N)) * (x1 - x0) * (y1 - y0) > 20) hits.push(`${A.p.id}↔${B.p.id} d=${dist.toFixed(2)}`);
    }
  }
  return hits;
}

const cases = MODELS.flatMap((m) =>
  [m.defaultDims, ...m.presets.map((p) => p.dims)].flatMap((dims) => m.materials.filter((mat) => BOARD_SPECS[mat].family === "FOLDING_CARTON").map((mat) => ({ code: m.code, m, dims, t: BOARD_SPECS[mat].thicknessMm }))),
);

describe.each(cases)("$code $dims.L×$dims.W×$dims.H t=$t", ({ m, dims, t }) => {
  const d = m.build(dims, { thicknessMm: t });

  it("has no coplanar or interpenetrating boards when closed", () => {
    expect(overlaps(d)).toEqual([]);
  });

  it("bleeds the print over the whole of every printable panel", () => {
    for (const b of d.bleedRegions) {
      const p = d.panels.find((q) => q.id === b.panelId)!;
      const box = p.bbox;
      for (let i = 1; i < 12; i++) for (let k = 1; k < 12; k++) {
        // Off-grid samples (never exactly on a 45° crease or an edge).
        const x = box.x + ((i + 0.137) / 12.3) * box.width;
        const y = box.y + ((k + 0.291) / 12.3) * box.height;
        if (inPoly(x, y, p.polygon) && !(p.holes ?? []).some((h) => inPoly(x, y, h))) expect(inPoly(x, y, b.polygon), `${p.id} at ${x.toFixed(1)},${y.toFixed(1)}`).toBe(true);
      }
    }
  });

  it("maps every face part onto a panel whose printed side looks out", () => {
    const poses = computePoses(d, 1);
    const centre = new Vector3();
    let count = 0;
    for (const p of d.panels) for (const q of p.polygon) {
      centre.add(panelLocalPoint(p, q, 0, panelPivot(p, d.thicknessMm), d.thicknessMm).applyMatrix4(poses.get(p.id)!.world));
      count++;
    }
    centre.multiplyScalar(1 / count);
    for (const [face, info] of Object.entries(d.faces)) {
      for (const part of info!.parts) {
        const panel = d.panels.find((p) => p.id === part.panelId)!;
        const world = poses.get(panel.id)!.world;
        const n = new Vector3(0, 0, 1).transformDirection(world);
        const facing = n.dot(FACE_FRAMES[face as keyof typeof FACE_FRAMES].n);
        // Wrap-around faces (a cone wall printed as one face): outward = away from the axis.
        const c = panelLocalPoint(panel, { x: panel.bbox.x + panel.bbox.width / 2, y: panel.bbox.y + panel.bbox.height / 2 }, 0, panelPivot(panel, d.thicknessMm), d.thicknessMm).applyMatrix4(world);
        const radial = new Vector3(c.x - centre.x, 0, c.z - centre.z);
        const out = facing > 0.2 || (radial.length() > 1 && n.dot(radial.normalize()) > 0.2);
        expect(out, `${face}/${part.panelId} facing ${facing.toFixed(2)}`).toBe(true);
        // Artwork orientation: face +u (right) and -v (up) as they land on the board.
        const pv = panelPivot(panel, d.thicknessMm);
        const at = (u: number, v: number) => panelLocalPoint(panel, applyAffine(part.transform, u, v), 0, pv, d.thicknessMm).applyMatrix4(world);
        const cu = part.rect.x + part.rect.width / 2;
        const cv = part.rect.y + part.rect.height / 2;
        const o = at(cu, cv);
        const right = at(cu + 1, cv).sub(o);
        const up = o.clone().sub(at(cu, cv + 1));
        expect(new Vector3().crossVectors(right, up).dot(n), `${face}/${part.panelId} mirrored`).toBeGreaterThan(0.5);
        if (face !== "top" && face !== "bottom") expect(up.y, `${face}/${part.panelId} upside down`).toBeGreaterThan(0.2);
      }
    }
  });
});
