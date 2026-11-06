import { Mat4 as Matrix4, Vec3 as Vector3 } from "@/lib/dieline/math";
import { computePoses, panelLocalPoint, panelPivot } from "../../../fold";
import { polygonArea } from "../../../geometry";
import type { DielineModel, DielinePanel, Pt } from "../../../types";

/**
 * Closed-pose integrity probes shared by the FEFCO 02 and 03/05 tests (what the 3D view
 * shows): board slabs that pass through each other, coincident same-facing surfaces (z-fight)
 * and faces whose artwork area is not covered by board.
 */

function inPoly(poly: Pt[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

const onBoard = (p: DielinePanel, x: number, y: number) => inPoly(p.polygon, x, y) && !(p.holes ?? []).some((h) => inPoly(h, x, y));

function edgeDist(p: DielinePanel, x: number, y: number): number {
  let d = Infinity;
  const poly = p.polygon;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l2 = dx * dx + dy * dy || 1;
    const u = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / l2));
    d = Math.min(d, Math.hypot(x - a.x - u * dx, y - a.y - u * dy));
  }
  return d;
}

/** Any built model: the family models carry their own (wider) structure code. */
export type Probe = Omit<DielineModel, "structureCode">;

export interface Clash {
  a: string;
  b: string;
  kind: "penetrate" | "zfight";
  samples: number;
}

/**
 * Sample every panel on a grid (`step` mm, away from its outline) at mid-board and on both
 * surfaces, and test each sample against every other panel's slab at fold `progress`.
 * Pairs hit by fewer than `minSamples` samples are ignored (corner contact).
 */
export function clashes(m: Probe, progress = 1, step = 6, minSamples = 2): Clash[] {
  const t = m.thicknessMm;
  const poses = computePoses(m, progress);
  const byId = new Map(m.panels.map((p) => [p.id, p]));
  // A child and its parent share the bend at their hinge; a stacked or deep-pivoted child
  // bends a few calipers in. Samples in that strip are the bend itself, not a clash.
  const bendZone = (p: DielinePanel, q: DielinePanel, x: number, y: number) => {
    const child = p.parentId === q.id ? p : q.parentId === p.id ? q : null;
    if (!child?.hinge) return false;
    const zone = (1 + Math.abs(child.stackOffset) + child.pivotDepth) * t + 1;
    const { a, b } = child.hinge;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l2 = dx * dx + dy * dy || 1;
    const u = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / l2));
    return Math.hypot(x - a.x - u * dx, y - a.y - u * dy) < zone;
  };
  const inv = new Map<string, Matrix4>();
  const piv = new Map<string, Vector3>();
  for (const p of m.panels) {
    inv.set(p.id, poses.get(p.id)!.world.clone().invert());
    piv.set(p.id, panelPivot(p, t));
  }
  const hits = new Map<string, Clash>();
  const add = (a: string, b: string, kind: Clash["kind"]) => {
    const [x, y] = [a, b].sort();
    const k = `${x}|${y}|${kind}`;
    const h = hits.get(k) ?? { a: x, b: y, kind, samples: 0 };
    h.samples++;
    hits.set(k, h);
  };
  const v = new Vector3();
  const w = new Vector3();
  for (const p of m.panels) {
    const world = poses.get(p.id)!.world;
    for (let x = p.bbox.x + step / 2; x < p.bbox.x + p.bbox.width; x += step)
      for (let y = p.bbox.y + step / 2; y < p.bbox.y + p.bbox.height; y += step) {
        // Keep clear of the outline by more than a caliper: right at a hinge the two panels
        // legitimately share the corner of the bend.
        if (!onBoard(p, x, y) || edgeDist(p, x, y) < t + 1) continue;
        for (const depth of [0.5, 0, 1]) {
          panelLocalPoint(p, { x, y }, depth, piv.get(p.id)!, t, v).applyMatrix4(world);
          const normal = new Vector3(0, 0, depth === 1 ? -1 : 1).transformDirection(world);
          for (const q of m.panels) {
            if (q.id === p.id) continue;
            w.copy(v).applyMatrix4(inv.get(q.id)!);
            const qp = piv.get(q.id)!;
            const sx = w.x + qp.x;
            const sy = -(w.y + qp.y);
            if (!onBoard(q, sx, sy) || edgeDist(q, sx, sy) < 1) continue;
            if (bendZone(p, q, x, y)) continue;
            const qd = q.stackOffset - (w.z + qp.z) / t;
            if (depth === 0.5) {
              if (qd > 0.08 && qd < 0.92) add(p.id, q.id, "penetrate");
            } else if (p.id < q.id) {
              for (const qDepth of [0, 1]) {
                if (Math.abs(qd - qDepth) > 0.03) continue;
                const qn = new Vector3(0, 0, qDepth === 1 ? -1 : 1).transformDirection(poses.get(q.id)!.world);
                if (qn.dot(normal) > 0.99) add(p.id, q.id, "zfight");
              }
            }
          }
        }
      }
  }
  // Interlocking partitions (two division panels crossing at right angles) are slotted into
  // each other in the real box: that crossing is intended.
  // Judged on the closed box: partitions that end up crossing square are slotted together.
  const closed = progress === 1 ? poses : computePoses(m, 1);
  const crossing = (h: Clash) => {
    const a = byId.get(h.a)!;
    const b = byId.get(h.b)!;
    if (a.role !== "inner" || b.role !== "inner" || h.kind !== "penetrate") return false;
    const na = new Vector3(0, 0, 1).transformDirection(closed.get(a.id)!.world);
    const nb = new Vector3(0, 0, 1).transformDirection(closed.get(b.id)!.world);
    return Math.abs(na.dot(nb)) < 0.05;
  };
  return [...hits.values()].filter((h) => h.samples >= minSamples && !crossing(h));
}

/**
 * Share of each face's area that its parts' panels actually cover with board (polygon area
 * mapped through the part transform, clipped to the part rect by sampling). A face whose
 * artwork would land on nothing reads as a gap / seam in the 3D view.
 */
export function faceCoverage(m: Probe, step = 4): Partial<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const [id, f] of Object.entries(m.faces)) {
    if (!f) continue;
    let hit = 0;
    let all = 0;
    for (let u = step / 2; u < f.width; u += step)
      for (let v = step / 2; v < f.height; v += step) {
        all++;
        for (const part of f.parts) {
          const r = part.rect;
          if (u < r.x || u > r.x + r.width || v < r.y || v > r.y + r.height) continue;
          const [a, b, c, d, e, g] = part.transform;
          const sx = a * u + c * v + e;
          const sy = b * u + d * v + g;
          const panel = m.panels.find((p) => p.id === part.panelId)!;
          if (onBoard(panel, sx, sy) || edgeDist(panel, sx, sy) < 0.75) {
            hit++;
            break;
          }
        }
      }
    out[id] = all ? hit / all : 0;
  }
  return out;
}

/** Outside face parts must map face → sheet without mirroring or scaling. */
export function mirroredParts(m: Probe): string[] {
  const bad: string[] = [];
  for (const [id, f] of Object.entries(m.faces)) {
    for (const part of f?.parts ?? []) {
      const [a, b, c, d] = part.transform;
      const det = a * d - b * c;
      if (Math.abs(det - 1) > 1e-6) bad.push(`${id}:${part.panelId} det ${det.toFixed(4)}`);
    }
  }
  return bad;
}

export const panelArea = (p: DielinePanel) => polygonArea(p.polygon);
