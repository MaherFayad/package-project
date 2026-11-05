import { BufferGeometry, Float32BufferAttribute, Vector3 } from "three";
import { panelLocalPoint, panelPivot, type DielineModel, type DielinePanel } from "@/lib/dieline";
import { MAT_EDGE, MAT_INSIDE, MAT_OUTSIDE } from "./boardMaterials";

/**
 * A panel as a thin slab of board in its group's local space (pivot at the hinge).
 * Groups: 0 = printed outside face, 1 = inside face, 2 = cut edges.
 * Outside/inside UVs are sheet coordinates (u = x / sheetW, v = 1 - y / sheetH) so one
 * texture per printed surface wraps across every fold.
 */
export function buildPanelGeometry(model: DielineModel, panel: DielinePanel): BufferGeometry {
  const t = model.thicknessMm;
  const pivot = panelPivot(panel, t);
  const { width: sw, height: sh } = model.sheet;
  const poly = panel.polygon;
  const n = poly.length;
  const outer = poly.map((p) => panelLocalPoint(panel, p, 0, pivot, t));
  const inner = poly.map((p) => panelLocalPoint(panel, p, 1, pivot, t));
  const uv = poly.map((p) => [p.x / sw, 1 - p.y / sh] as const);

  // Orientation in the local XY plane (Y = -sheet y): want CCW for +Z normals.
  let area = 0;
  for (let i = 0; i < n; i++) {
    const a = outer[i];
    const b = outer[(i + 1) % n];
    area += a.x * b.y - b.x * a.y;
  }
  const ccw = area > 0;

  const pos: number[] = [];
  const nor: number[] = [];
  const uvs: number[] = [];
  const geo = new BufferGeometry();
  const push = (v: Vector3, nn: Vector3, u: number, w: number) => {
    pos.push(v.x, v.y, v.z);
    nor.push(nn.x, nn.y, nn.z);
    uvs.push(u, w);
  };

  // Outside face (+Z), triangle fan (panels are convex).
  const up = new Vector3(0, 0, 1);
  const down = new Vector3(0, 0, -1);
  let start = 0;
  for (let i = 1; i < n - 1; i++) {
    const [a, b, c] = ccw ? [0, i, i + 1] : [0, i + 1, i];
    for (const k of [a, b, c]) push(outer[k], up, uv[k][0], uv[k][1]);
  }
  geo.addGroup(start, pos.length / 3 - start, MAT_OUTSIDE);
  start = pos.length / 3;

  // Inside face (-Z), reversed winding.
  for (let i = 1; i < n - 1; i++) {
    const [a, b, c] = ccw ? [0, i + 1, i] : [0, i, i + 1];
    for (const k of [a, b, c]) push(inner[k], down, uv[k][0], uv[k][1]);
  }
  geo.addGroup(start, pos.length / 3 - start, MAT_INSIDE);
  start = pos.length / 3;

  // Cut edges.
  const pitch = model.thicknessMm >= 1 ? (model.thicknessMm >= 2.5 ? 6.5 : 3.3) : 10;
  let run = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const e = new Vector3().subVectors(outer[j], outer[i]);
    const l = e.length();
    if (l < 1e-6) continue;
    const normal = new Vector3(e.y, -e.x, 0).normalize();
    if (!ccw) normal.negate();
    const u0 = run / pitch;
    const u1 = (run + l) / pitch;
    run += l;
    // two triangles: (oi, ii, ij) (oi, ij, oj); fix winding against the outward normal
    const tri = (a: Vector3, b: Vector3, c: Vector3, ua: [number, number], ub: [number, number], uc: [number, number]) => {
      const cr = new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a));
      if (cr.dot(normal) >= 0) {
        push(a, normal, ...ua);
        push(b, normal, ...ub);
        push(c, normal, ...uc);
      } else {
        push(a, normal, ...ua);
        push(c, normal, ...uc);
        push(b, normal, ...ub);
      }
    };
    tri(outer[i], inner[i], inner[j], [u0, 1], [u0, 0], [u1, 0]);
    tri(outer[i], inner[j], outer[j], [u0, 1], [u1, 0], [u1, 1]);
  }
  geo.addGroup(start, pos.length / 3 - start, MAT_EDGE);

  geo.setAttribute("position", new Float32BufferAttribute(pos, 3));
  geo.setAttribute("normal", new Float32BufferAttribute(nor, 3));
  geo.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geo.computeBoundingSphere();
  geo.computeBoundingBox();
  return geo;
}
