import { Vector3 } from "three";
import type { FaceId } from "@/types";
import { FACE_FRAMES, applyAffine, computePoses, panelLocalPoint, panelPivot } from "../../../fold";
import type { DielineModel, FaceInfo, Pt } from "../../../types";

/**
 * Closed-pose surface checks shared by the family tests (rigid / tubes and food service).
 *
 * Every panel is a slab of board: a printed face (local +Z) and a back face, t apart. Two
 * parallel panels that overlap in projection are a visible defect when
 *  - a face of one lies in the plane of a face of the other AND both face the same way
 *    (z-fighting: the renderer flickers between them), or
 *  - they belong to different pieces (lid vs base, cover vs tray, cap vs body) and their slabs
 *    overlap (one pierces the other where it slides over it).
 * Paper parts drawn inside their own wall on purpose (fractional `stackOffset`: turn-ins,
 * corner tabs, glue flaps) may overlap boards of their own piece.
 */
/** What the checks read (family models carry their own catalogue code union). */
type Closed = Pick<DielineModel, "panels" | "rootId" | "thicknessMm" | "closedRotation" | "faces">;

export interface SurfaceHit {
  kind: "z-fight" | "pierce";
  a: string;
  b: string;
  depthMm: number;
  areaMm2: number;
}

function inPoly(x: number, y: number, poly: Pt[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function surfaceHits(d: Closed, minAreaMm2 = 20): SurfaceHit[] {
  const t = d.thicknessMm;
  const poses = computePoses(d, 1);
  const frames = d.panels.map((p) => {
    const pose = poses.get(p.id)!;
    const pv = panelPivot(p, t);
    const s0 = p.polygon.map((q) => panelLocalPoint(p, q, 0, pv, t).applyMatrix4(pose.world));
    const s1 = p.polygon.map((q) => panelLocalPoint(p, q, 1, pv, t).applyMatrix4(pose.world));
    return { p, n: new Vector3(0, 0, 1).transformDirection(pose.world).normalize(), s0, s1 };
  });
  const frac = (x: number) => Math.abs(x - Math.round(x)) > 1e-6;
  const hits: SurfaceHit[] = [];
  for (let i = 0; i < frames.length; i++) {
    for (let j = i + 1; j < frames.length; j++) {
      const A = frames[i];
      const B = frames[j];
      const cos = A.n.dot(B.n);
      if (Math.abs(cos) < 0.999) continue;
      const sg = Math.sign(cos);
      const a0 = A.n.dot(A.s0[0]);
      const a1 = A.n.dot(A.s1[0]);
      const b0 = A.n.dot(B.s0[0]);
      const b1 = A.n.dot(B.s1[0]);
      const faces: [number, number][][] = [
        [
          [a0, 1],
          [a1, -1],
        ],
        [
          [b0, sg],
          [b1, -sg],
        ],
      ];
      const zf = faces[0].some(([x, fx]) => faces[1].some(([y, fy]) => Math.abs(x - y) < 0.03 && fx === fy));
      const pen = Math.min(Math.max(a0, a1), Math.max(b0, b1)) - Math.max(Math.min(a0, a1), Math.min(b0, b1));
      const samePiece = A.p.pieceId === B.p.pieceId;
      const pierce = pen > 0.05 && !samePiece;
      if (!zf && !pierce) continue;
      if (!zf && samePiece && (frac(A.p.stackOffset) || frac(B.p.stackOffset))) continue;
      const u = new Vector3().subVectors(A.s0[1], A.s0[0]).normalize();
      const v = new Vector3().crossVectors(A.n, u).normalize();
      const pa = A.s0.map((q) => ({ x: q.dot(u), y: q.dot(v) }));
      const pb = B.s0.map((q) => ({ x: q.dot(u), y: q.dot(v) }));
      const xs = pa.map((q) => q.x);
      const ys = pa.map((q) => q.y);
      const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
      const N = 20;
      let hit = 0;
      for (let a = 0; a < N; a++) {
        for (let b = 0; b < N; b++) {
          const x = x0 + ((a + 0.5) / N) * (x1 - x0);
          const y = y0 + ((b + 0.5) / N) * (y1 - y0);
          if (inPoly(x, y, pa) && inPoly(x, y, pb)) hit++;
        }
      }
      const area = (hit / (N * N)) * (x1 - x0) * (y1 - y0);
      if (area < minAreaMm2) continue;
      hits.push({ kind: zf ? "z-fight" : "pierce", a: A.p.id, b: B.p.id, depthMm: Math.round(pen * 100) / 100, areaMm2: Math.round(area) });
    }
  }
  return hits;
}

export const describeHits = (hits: SurfaceHit[]) => hits.map((h) => `${h.kind} ${h.a}↔${h.b} ${h.depthMm}mm ${h.areaMm2}mm²`).join("; ");

/**
 * Artwork orientation on the closed model: for every face part, one mm to the right in the
 * face (artwork) must move along the face's right vector in 3D and one mm down along its down
 * vector (FACE_FRAMES). A mirrored or rotated part (back wall read in a mirror, side wall
 * turned 90°) fails. Returns one message per bad part.
 */
export function faceMappingErrors(d: Closed): string[] {
  const t = d.thicknessMm;
  const poses = computePoses(d, 1);
  const byId = new Map(d.panels.map((p) => [p.id, p]));
  const errors: string[] = [];
  for (const [face, info] of Object.entries(d.faces) as [FaceId, FaceInfo][]) {
    const { r, d: down } = FACE_FRAMES[face];
    for (const part of info.parts) {
      const panel = byId.get(part.panelId);
      if (!panel) continue;
      const pose = poses.get(panel.id)!;
      const pv = panelPivot(panel, t);
      const world = (u: number, v: number) => {
        const q = applyAffine(part.transform, u, v);
        return panelLocalPoint(panel, q, 0, pv, t).applyMatrix4(pose.world);
      };
      const cu = part.rect.x + part.rect.width / 2;
      const cv = part.rect.y + part.rect.height / 2;
      const o = world(cu, cv);
      const du = world(cu + 1, cv).sub(o);
      const dv = world(cu, cv + 1).sub(o);
      // > 0: tube strips at the silhouette turn almost 90° from the view, but never backwards.
      // Width within 20 %: a tube cap's label is the body artwork spread over its larger
      // circumference (4 % on a 75 mm tube, 17 % on a 20 mm push-up) so the design lines up by
      // angle across the cap edge. Height is never stretched.
      const ok = du.dot(r) > 0.05 && dv.dot(down) > 0.2 && Math.abs(du.length() - 1) < 0.2 && Math.abs(dv.length() - 1) < 0.05;
      if (!ok) errors.push(`${face}/${part.panelId}: right→(${du.toArray().map((x) => x.toFixed(2))}) down→(${dv.toArray().map((x) => x.toFixed(2))})`);
    }
  }
  return errors;
}
