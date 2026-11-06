import { BufferGeometry, Float32BufferAttribute, ShapeUtils, Vector2, Vector3 } from "three";
import { panelAxis, panelLocalPoint, panelPivot, type DielineModel, type DielinePanel, type Polygon, type Pt, type Segment } from "@/lib/dieline";
import { MAT_EDGE, MAT_INSIDE, MAT_OUTSIDE } from "./boardMaterials";

const DEG = Math.PI / 180;

function onSegment(p: Pt, s: Segment, tol = 1e-3): boolean {
  const dx = s.b.x - s.a.x;
  const dy = s.b.y - s.a.y;
  const l2 = dx * dx + dy * dy;
  if (l2 < 1e-12) return false;
  const t = ((p.x - s.a.x) * dx + (p.y - s.a.y) * dy) / l2;
  if (t < -1e-6 || t > 1 + 1e-6) return false;
  return Math.abs(dx * (p.y - s.a.y) - dy * (p.x - s.a.x)) / Math.sqrt(l2) < tol;
}

/**
 * Smooth-shading normals across "roll" hinges (tube labels bent from strips): a vertex on a
 * roll hinge gets the average of the two strips' normals, so the facets read as one curve.
 */
function vertexNormals(model: DielineModel, panel: DielinePanel, poly: Polygon): Vector3[] {
  const up = new Vector3(0, 0, 1);
  const out = poly.map(() => up.clone());
  const adjust: { seg: Segment; axis: Vector3; angle: number }[] = [];
  if (panel.hinge && panel.hingeKind === "roll") adjust.push({ seg: panel.hinge, axis: panelAxis(panel), angle: (-panel.foldAngleClosed * DEG) / 2 });
  for (const c of model.panels) {
    if (c.parentId === panel.id && c.hinge && c.hingeKind === "roll") adjust.push({ seg: c.hinge, axis: panelAxis(c), angle: (c.foldAngleClosed * DEG) / 2 });
  }
  if (!adjust.length) return out;
  poly.forEach((p, i) => {
    for (const a of adjust) if (onSegment(p, a.seg)) out[i].applyAxisAngle(a.axis, a.angle);
    out[i].normalize();
  });
  return out;
}

const signedArea = (pts: { x: number; y: number }[]) => {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
};

/**
 * A panel as a thin slab of board in its group's local space (pivot at the hinge).
 * Groups: 0 = printed outside face, 1 = inside face, 2 = cut edges (outline + apertures).
 * Outside/inside UVs are sheet coordinates (u = x / sheetW, v = 1 - y / sheetH) so one
 * texture per printed surface wraps across every fold. Concave outlines and holes are
 * triangulated with earcut.
 */
export function buildPanelGeometry(model: DielineModel, panel: DielinePanel): BufferGeometry {
  const t = model.thicknessMm;
  const pivot = panelPivot(panel, t);
  const { width: sw, height: sh } = model.sheet;
  const loops: Polygon[] = [panel.polygon, ...(panel.holes ?? [])];
  const flat = loops.flat();
  const outerAll = flat.map((p) => panelLocalPoint(panel, p, 0, pivot, t));
  const innerAll = flat.map((p) => panelLocalPoint(panel, p, 1, pivot, t));
  const uvAll = flat.map((p) => [p.x / sw, 1 - p.y / sh] as const);
  const normalsAll = vertexNormals(model, panel, flat);

  // Two buffers: faces + fold edges (printed), then inside + cut edges. Fold edges are the
  // board's end faces along a crease: on a real carton the liner wraps around the fold, so they
  // carry the outside print (sheet UV of the crease line) instead of the raw cut edge texture,
  // which would read as a pale seam along every fold.
  type Buf = { pos: number[]; nor: number[]; uvs: number[] };
  const mk = (): Buf => ({ pos: [], nor: [], uvs: [] });
  const outsideBuf = mk();
  const foldBuf = mk();
  const insideBuf = mk();
  const edgeBuf = mk();
  let cur = outsideBuf;
  const geo = new BufferGeometry();
  const push = (v: Vector3, nn: Vector3, u: number, w: number) => {
    cur.pos.push(v.x, v.y, v.z);
    cur.nor.push(nn.x, nn.y, nn.z);
    cur.uvs.push(u, w);
  };

  // Triangulate in the local XY plane (Y = -sheet y).
  const contour = panel.polygon.map((_, i) => new Vector2(outerAll[i].x, outerAll[i].y));
  let offset = panel.polygon.length;
  const holes2 = (panel.holes ?? []).map((h) => {
    const v = h.map((_, i) => new Vector2(outerAll[offset + i].x, outerAll[offset + i].y));
    offset += h.length;
    return v;
  });
  const tris = ShapeUtils.triangulateShape(contour, holes2);
  const flat2 = [...contour, ...holes2.flat()];
  const ccwTri = (tri: number[]) => {
    const [a, b, c] = tri.map((k) => flat2[k]);
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x) > 0;
  };

  // Outside face (+Z, counter-clockwise).
  cur = outsideBuf;
  for (const tri of tris) {
    const order = ccwTri(tri) ? tri : [tri[0], tri[2], tri[1]];
    for (const k of order) push(outerAll[k], normalsAll[k], uvAll[k][0], uvAll[k][1]);
  }

  // Inside face (-Z), reversed winding.
  cur = insideBuf;
  for (const tri of tris) {
    const order = ccwTri(tri) ? [tri[0], tri[2], tri[1]] : tri;
    for (const k of order) push(innerAll[k], normalsAll[k].clone().negate(), uvAll[k][0], uvAll[k][1]);
  }

  // Cut edges: outline (normals outward) and apertures (normals into the hole). Edges on a
  // roll hinge are inside the curved wall: no side face there (it would show as a seam).
  const rollHinges: Segment[] = [
    ...(panel.hinge && panel.hingeKind === "roll" ? [panel.hinge] : []),
    ...model.panels.filter((c) => c.parentId === panel.id && c.hinge && c.hingeKind === "roll").map((c) => c.hinge!),
  ];
  const onRoll = (a: Pt, b: Pt) => rollHinges.some((h) => onSegment(a, h) && onSegment(b, h));
  const creases: Segment[] = [
    ...(panel.hinge && panel.hingeKind !== "roll" ? [panel.hinge] : []),
    ...model.panels.filter((c) => c.parentId === panel.id && c.hinge && c.hingeKind !== "roll").map((c) => c.hinge!),
  ];
  const onCrease = (a: Pt, b: Pt) => creases.some((h) => onSegment(a, h) && onSegment(b, h));
  const pitch = model.thicknessMm >= 1 ? (model.thicknessMm >= 2.5 ? 6.5 : 3.3) : 10;
  let base = 0;
  loops.forEach((loop, li) => {
    const n = loop.length;
    const o = outerAll.slice(base, base + n);
    const inn = innerAll.slice(base, base + n);
    base += n;
    const ccw = signedArea(o) > 0;
    // outward of this loop for the outline, inward (into the hole) for apertures
    const flip = (li === 0) !== ccw;
    let run = 0;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const e = new Vector3().subVectors(o[j], o[i]);
      const l = e.length();
      if (l < 1e-6) continue;
      if (li === 0 && onRoll(loop[i], loop[j])) {
        run += l;
        continue;
      }
      const normal = new Vector3(e.y, -e.x, 0).normalize();
      if (flip) normal.negate();
      const fold = li === 0 && onCrease(loop[i], loop[j]);
      cur = fold ? foldBuf : edgeBuf;
      // fold edges: sheet UV of the crease (print continues round the fold); cut edges: flute pitch
      const sa = uvAll[base - n + i];
      const sb = uvAll[base - n + j];
      const u0 = fold ? 0 : run / pitch;
      const u1 = fold ? 0 : (run + l) / pitch;
      run += l;
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
      if (fold) {
        tri(o[i], inn[i], inn[j], [sa[0], sa[1]], [sa[0], sa[1]], [sb[0], sb[1]]);
        tri(o[i], inn[j], o[j], [sa[0], sa[1]], [sb[0], sb[1]], [sb[0], sb[1]]);
      } else {
        tri(o[i], inn[i], inn[j], [u0, 1], [u0, 0], [u1, 0]);
        tri(o[i], inn[j], o[j], [u0, 1], [u1, 0], [u1, 1]);
      }
    }
  });

  const pos = [...outsideBuf.pos, ...foldBuf.pos, ...insideBuf.pos, ...edgeBuf.pos];
  const nor = [...outsideBuf.nor, ...foldBuf.nor, ...insideBuf.nor, ...edgeBuf.nor];
  const uvs = [...outsideBuf.uvs, ...foldBuf.uvs, ...insideBuf.uvs, ...edgeBuf.uvs];
  const nOut = (outsideBuf.pos.length + foldBuf.pos.length) / 3;
  const nIn = insideBuf.pos.length / 3;
  geo.addGroup(0, nOut, MAT_OUTSIDE);
  geo.addGroup(nOut, nIn, MAT_INSIDE);
  geo.addGroup(nOut + nIn, edgeBuf.pos.length / 3, MAT_EDGE);

  geo.setAttribute("position", new Float32BufferAttribute(pos, 3));
  geo.setAttribute("normal", new Float32BufferAttribute(nor, 3));
  geo.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geo.computeBoundingSphere();
  geo.computeBoundingBox();
  return geo;
}

/** Clear film patch on the inside of a panel (local space of the panel's group). */
export function buildFilmGeometry(model: DielineModel, panel: DielinePanel, polygon: Polygon): BufferGeometry {
  const t = model.thicknessMm;
  const pivot = panelPivot(panel, t);
  const pts = polygon.map((p) => panelLocalPoint(panel, p, 1, pivot, t));
  const z = pts[0].z - Math.min(0.15, t * 0.3);
  const contour = pts.map((p) => new Vector2(p.x, p.y));
  const tris = ShapeUtils.triangulateShape(contour, []);
  const pos: number[] = [];
  for (const tri of tris) for (const k of tri) pos.push(pts[k].x, pts[k].y, z);
  const geo = new BufferGeometry();
  geo.setAttribute("position", new Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

/**
 * Perforation dashes printed-side up (tear strip): short slits every few mm, drawn as
 * thin quads just above the outside surface so they read on any artwork.
 */
export function buildPerfGeometry(model: DielineModel, panel: DielinePanel, lines: Segment[]): BufferGeometry {
  const t = model.thicknessMm;
  const pivot = panelPivot(panel, t);
  const pos: number[] = [];
  const dash = 3;
  const gap = 1.6;
  const half = 0.35;
  for (const s of lines) {
    const dx = s.b.x - s.a.x;
    const dy = s.b.y - s.a.y;
    const l = Math.hypot(dx, dy);
    if (l < 1) continue;
    const ux = dx / l;
    const uy = dy / l;
    for (let d = 0; d + dash <= l; d += dash + gap) {
      const p0 = { x: s.a.x + ux * d, y: s.a.y + uy * d };
      const p1 = { x: s.a.x + ux * (d + dash), y: s.a.y + uy * (d + dash) };
      const q = [
        { x: p0.x - uy * half, y: p0.y + ux * half },
        { x: p1.x - uy * half, y: p1.y + ux * half },
        { x: p1.x + uy * half, y: p1.y - ux * half },
        { x: p0.x + uy * half, y: p0.y - ux * half },
      ].map((p) => panelLocalPoint(panel, p, 0, pivot, t));
      for (const v of q) v.z += 0.06;
      for (const k of [0, 1, 2, 0, 2, 3]) pos.push(q[k].x, q[k].y, q[k].z);
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute("position", new Float32BufferAttribute(pos, 3));
  const n = new Float32Array(pos.length);
  for (let i = 2; i < n.length; i += 3) n[i] = 1;
  geo.setAttribute("normal", new Float32BufferAttribute(n, 3));
  geo.computeBoundingSphere();
  return geo;
}

/** Simple point-in-polygon (even-odd) for sheet coordinates. */
export function pointInPolygon(p: Pt, poly: Polygon): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
