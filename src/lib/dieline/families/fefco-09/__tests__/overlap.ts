import { Mat4 as Matrix4, Vec3 as Vector3 } from "@/lib/dieline/math";
import { computePoses, panelLocalPoint, panelPivot, type DielineModel } from "../../..";

/**
 * Test helper shared by the FEFCO 06/07 and 09 suites: pairs of panels that lie in parallel
 * planes, share board volume (their slabs overlap by more than 5 % of a caliper) and overlap in
 * plan by more than a hairline. Those pairs z-fight or clip through each other in the 3D view.
 */

type V2 = [number, number];

function clipConvex(subject: V2[], clip: V2[]): V2[] {
  const signed = (p: V2[]) => p.reduce((s, a, i) => s + a[0] * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * a[1], 0) / 2;
  const cp = signed(clip) < 0 ? [...clip].reverse() : clip;
  let out = subject;
  for (let i = 0; i < cp.length && out.length; i++) {
    const a = cp[i];
    const b = cp[(i + 1) % cp.length];
    const inside = (p: V2) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= -1e-9;
    const cross = (p: V2, q: V2): V2 => {
      const a1 = b[1] - a[1];
      const b1 = a[0] - b[0];
      const c1 = a1 * a[0] + b1 * a[1];
      const a2 = q[1] - p[1];
      const b2 = p[0] - q[0];
      const c2 = a2 * p[0] + b2 * p[1];
      const det = a1 * b2 - a2 * b1;
      return [(b2 * c1 - b1 * c2) / det, (a1 * c2 - a2 * c1) / det];
    };
    const input = out;
    out = [];
    for (let j = 0; j < input.length; j++) {
      const p = input[j];
      const q = input[(j + 1) % input.length];
      if (inside(q)) {
        if (!inside(p)) out.push(cross(p, q));
        out.push(q);
      } else if (inside(p)) out.push(cross(p, q));
    }
  }
  return out;
}

const area = (p: V2[]) => Math.abs(p.reduce((s, a, i) => s + a[0] * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * a[1], 0) / 2);

export function overlappingPanels(m: DielineModel, progress = 1): string[] {
  const t = m.thicknessMm;
  const poses = computePoses(m, progress);
  const slabs = m.panels.map((p) => {
    const w = poses.get(p.id)!.world;
    const pivot = panelPivot(p, t);
    const outer = p.polygon.map((q) => panelLocalPoint(p, q, 0, pivot, t).applyMatrix4(w));
    const inner = p.polygon.map((q) => panelLocalPoint(p, q, 1, pivot, t).applyMatrix4(w));
    return { id: p.id, n: new Vector3(0, 0, 1).transformDirection(new Matrix4().extractRotation(w)), outer, all: [...outer, ...inner] };
  });
  const out: string[] = [];
  for (let i = 0; i < slabs.length; i++) {
    for (let j = i + 1; j < slabs.length; j++) {
      const A = slabs[i];
      const B = slabs[j];
      if (Math.abs(A.n.dot(B.n)) < 0.999) continue;
      const da = A.all.map((p) => p.dot(A.n));
      const db = B.all.map((p) => p.dot(A.n));
      const depth = Math.min(Math.max(...da), Math.max(...db)) - Math.max(Math.min(...da), Math.min(...db));
      if (depth < 0.05 * t) continue;
      const u = new Vector3().crossVectors(A.n, Math.abs(A.n.x) < 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0)).normalize();
      const v = new Vector3().crossVectors(A.n, u);
      const flat = (pts: Vector3[]) => pts.map((p) => [p.dot(u), p.dot(v)] as V2);
      const shared = area(clipConvex(flat(A.outer), flat(B.outer)));
      if (shared > 4 * t * t + 20) out.push(`${A.id}×${B.id} ${shared.toFixed(0)} mm²`);
    }
  }
  return out;
}
