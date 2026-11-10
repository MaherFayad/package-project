import { boundsAt, composeAffine, computePoses, panelLocalPoint, panelOrder, panelPivot, type Affine, type DielineModel, type DielinePanel, type PanelRole } from "@/lib/dieline";
import { Vec3 } from "@/lib/dieline/math";
import type { FaceId, PrintSurface } from "@/types";
import type { Box, PanelMap, PanelPlan, RemapSource } from "./types";

/**
 * Closed-pose panel correspondence: which panel of the buyer's template (the detected candidate
 * model, fitted on the art) sits at the same place of the CLOSED box as each panel of Elba's
 * model. Positions are compared in the closed box normalised to a unit cube, so a template with
 * other proportions, another tuck depth or other flap shapes still maps panel for panel, and a
 * face keeps its art the way the buyer drew it (no continuity is invented where the flat layouts
 * differ). Model-agnostic: it reads only the fold poses every model already has.
 */

const FACE_ROLES = new Set<PanelRole>(["front", "back", "left", "right", "top", "bottom"]);

interface Frame {
  panel: DielinePanel;
  /** Sheet (x, y) → normalised closed-box point: o + x·ex + y·ey. */
  o: Vec3;
  ex: Vec3;
  ey: Vec3;
  /** Unit normal of the printed surface (world). */
  n: Vec3;
  /** Normalised depth below the box's outer face in the normal's direction (0 = outer face). */
  depth: number;
}

const ZERO = { x: 0, y: 0 };

/** Frames of every printable panel's printed surface (outside or inside) in the closed box. */
export function closedFrames(model: DielineModel, surface: PrintSurface): Frame[] {
  const t = model.thicknessMm;
  const poses = computePoses(model, 1);
  const box = boundsAt(model, 1, poses);
  const size = box.getSize(new Vec3());
  const sz = [size.x || 1, size.y || 1, size.z || 1];
  const norm = (v: Vec3, point: boolean) =>
    new Vec3(((v.x - (point ? box.min.x : 0)) / sz[0]), ((v.y - (point ? box.min.y : 0)) / sz[1]), ((v.z - (point ? box.min.z : 0)) / sz[2]));
  const depth01 = surface === "outside" ? 0 : 1;
  const out: Frame[] = [];
  for (const panel of model.panels) {
    if (!panel.printable) continue;
    const pose = poses.get(panel.id);
    if (!pose) continue;
    const pivot = panelPivot(panel, t);
    const at = (p: { x: number; y: number }) => panelLocalPoint(panel, p, depth01, pivot, t).applyMatrix4(pose.world);
    const o = at(ZERO);
    const ex = at({ x: 1, y: 0 }).sub(o);
    const ey = at({ x: 0, y: 1 }).sub(o);
    const n = new Vec3(0, 0, surface === "outside" ? 1 : -1).transformDirection(pose.world);
    const c = { x: panel.bbox.x + panel.bbox.width / 2, y: panel.bbox.y + panel.bbox.height / 2 };
    const cw = norm(at(c), true);
    const axis = [Math.abs(n.x), Math.abs(n.y), Math.abs(n.z)].reduce((b, v, i, a) => (v > a[b] ? i : b), 0);
    const comp = axis === 0 ? cw.x : axis === 1 ? cw.y : cw.z;
    const sign = axis === 0 ? n.x : axis === 1 ? n.y : n.z;
    out.push({ panel, o: norm(o, true), ex: norm(ex, false), ey: norm(ey, false), n, depth: sign > 0 ? 1 - comp : comp });
  }
  return out;
}

/** Least-squares in-plane map: target sheet → source sheet (both mm) through the closed box. */
function planeMap(t: Frame, s: Frame): Affine | null {
  // q = (GᵀG)⁻¹ Gᵀ (t.o - s.o + t.ex·x + t.ey·y), G = [s.ex s.ey]
  const a = s.ex.dot(s.ex);
  const b = s.ex.dot(s.ey);
  const d = s.ey.dot(s.ey);
  const det = a * d - b * b;
  if (Math.abs(det) < 1e-18) return null;
  const inv = (u: Vec3) => {
    const gx = s.ex.dot(u);
    const gy = s.ey.dot(u);
    return { x: (d * gx - b * gy) / det, y: (a * gy - b * gx) / det };
  };
  const cx = inv(t.ex);
  const cy = inv(t.ey);
  const c0 = inv(t.o.clone().sub(s.o));
  return [cx.x, cx.y, cy.x, cy.y, c0.x, c0.y];
}

export interface PanelPair {
  source: string;
  cost: number;
  /** target sheet mm → source (candidate) sheet mm */
  A: Affine;
}

/** Depth difference (normalised) above which two panels are not the same layer. */
const DEPTH_TOL = 0.09;

/**
 * For each printable target panel, the source panels at the same place of the closed box,
 * best first. Same facing (normals within ~11°), similar depth below the outer face, and a small
 * preference for the same role (a wall for a wall, a tuck for a tuck).
 */
export function pairPanels(target: DielineModel, source: DielineModel, surface: PrintSurface): Map<string, PanelPair[]> {
  const tf = closedFrames(target, surface);
  const sf = closedFrames(source, surface);
  const out = new Map<string, PanelPair[]>();
  for (const t of tf) {
    const list: PanelPair[] = [];
    for (const s of sf) {
      if (t.n.dot(s.n) < 0.98) continue;
      const dd = Math.abs(t.depth - s.depth);
      if (dd > DEPTH_TOL) continue;
      const tFace = FACE_ROLES.has(t.panel.role);
      const sFace = FACE_ROLES.has(s.panel.role);
      const cost = dd + (tFace !== sFace ? 0.05 : 0) + (t.panel.role !== s.panel.role ? 0.02 : 0);
      const A = planeMap(t, s);
      if (A) list.push({ source: s.panel.id, cost, A });
    }
    list.sort((x, y) => x.cost - y.cost);
    out.set(t.panel.id, list);
  }
  return out;
}

/* ───────────── snapping the template's panels to the lines drawn on the art ───────────── */

const apply = (A: Affine, x: number, y: number) => ({ x: A[0] * x + A[2] * y + A[4], y: A[1] * x + A[3] * y + A[5] });

export function invertAffine(A: Affine): Affine {
  const det = A[0] * A[3] - A[1] * A[2];
  const i0 = A[3] / det;
  const i1 = -A[1] / det;
  const i2 = -A[2] / det;
  const i3 = A[0] / det;
  return [i0, i1, i2, i3, -(i0 * A[4] + i2 * A[5]), -(i1 * A[4] + i3 * A[5])];
}

/** Rect → rect (axis-aligned) affine. */
function rectMap(from: Box, to: Box): Affine {
  const sx = (to.x1 - to.x0) / (from.x1 - from.x0 || 1);
  const sy = (to.y1 - to.y0) / (from.y1 - from.y0 || 1);
  return [sx, 0, 0, sy, to.x0 - from.x0 * sx, to.y0 - from.y0 * sy];
}

/**
 * Snap each panel box of the fitted template to the nearest line drawn on the art (cut or crease,
 * candidate sheet mm) within a gate, so a printer template whose panels differ a little from the
 * library's (another tuck depth, wider dust flaps, rounded corners) still maps edge to edge.
 * `lines` are the detected segments in image px; `T` maps candidate sheet mm → image px.
 */
export function snapPanels(model: DielineModel, T: Affine, lines: readonly [number, number, number, number][]): Record<string, [number, number, number, number]> {
  const Ti = invertAffine(T);
  const die = Math.max(model.dieBounds.width, model.dieBounds.height);
  type L = { pos: number; a: number; b: number };
  const hs: L[] = [];
  const vs: L[] = [];
  for (const [x1, y1, x2, y2] of lines) {
    const p = apply(Ti, x1, y1);
    const q = apply(Ti, x2, y2);
    if (Math.abs(q.x - p.x) >= Math.abs(q.y - p.y)) hs.push({ pos: (p.y + q.y) / 2, a: Math.min(p.x, q.x), b: Math.max(p.x, q.x) });
    else vs.push({ pos: (p.x + q.x) / 2, a: Math.min(p.y, q.y), b: Math.max(p.y, q.y) });
  }
  const cluster = 0.006 * die;
  const snap = (list: L[], pos: number, a: number, b: number, gate: number): number => {
    const near = list.filter((l) => Math.abs(l.pos - pos) <= gate && Math.min(b, l.b) - Math.max(a, l.a) > 0);
    const groups: { pos: number; w: number; cover: number }[] = [];
    for (const l of near.sort((x, y) => x.pos - y.pos)) {
      const ov = Math.min(b, l.b) - Math.max(a, l.a);
      const g = groups.find((gr) => Math.abs(gr.pos - l.pos) <= cluster);
      if (g) {
        g.pos = (g.pos * g.w + l.pos * ov) / (g.w + ov);
        g.w += ov;
        g.cover += ov;
      } else groups.push({ pos: l.pos, w: ov, cover: ov });
    }
    const ok = groups.filter((g) => g.cover >= 0.35 * (b - a));
    if (!ok.length) return pos;
    ok.sort((x, y) => Math.abs(x.pos - pos) - Math.abs(y.pos - pos));
    return ok[0].pos;
  };
  const out: Record<string, [number, number, number, number]> = {};
  for (const p of model.panels) {
    const { x, y, width: w, height: h } = p.bbox;
    const gx = Math.min(0.3 * w, 0.04 * die);
    const gy = Math.min(0.3 * h, 0.04 * die);
    // A flap's free edge (the one opposite its hinge) may sit much further out on the printer's
    // template: a tuck as deep as the wall, wider dust flaps. Search it as far as the flap is deep.
    const free = !FACE_ROLES.has(p.role) && p.hinge;
    const hx = p.hinge && Math.abs(p.hinge.a.x - p.hinge.b.x) < 1e-3 ? p.hinge.a.x : null;
    const hy = p.hinge && Math.abs(p.hinge.a.y - p.hinge.b.y) < 1e-3 ? p.hinge.a.y : null;
    const far = (edge: number, hinge: number | null, extent: number, g: number) => (free && hinge != null && Math.abs(edge - hinge) > 0.5 * extent ? Math.max(g, Math.min(1.0 * extent, 0.15 * die)) : g);
    // the far edge snaps outward only: the nearest line beyond the template's edge, else inward within the usual gate
    const snapFar = (list: L[], pos: number, a: number, b: number, g: number, wide: number, outward: number) => {
      if (wide <= g) return snap(list, pos, a, b, g);
      const near = snap(list, pos, a, b, g);
      if (near !== pos) return near;
      const out = snap(list.filter((l) => (l.pos - pos) * outward > 0), pos, a, b, wide);
      return out;
    };
    let x0 = snapFar(vs, x, y, y + h, gx, far(x, hx, w, gx), -1);
    let x1 = snapFar(vs, x + w, y, y + h, gx, far(x + w, hx, w, gx), 1);
    let y0 = snapFar(hs, y, x, x + w, gy, far(y, hy, h, gy), -1);
    let y1 = snapFar(hs, y + h, x, x + w, gy, far(y + h, hy, h, gy), 1);
    if (x1 - x0 < 0.4 * w) [x0, x1] = [x, x + w];
    if (y1 - y0 < 0.4 * h) [y0, y1] = [y, y + h];
    out[p.id] = [r3(x0), r3(y0), r3(x1), r3(y1)];
  }
  return out;
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;

/** Bounding box (px) of a sheet-mm box through an affine. */
function boxThrough(A: Affine, b: Box): Box {
  const pts = [apply(A, b.x0, b.y0), apply(A, b.x1, b.y0), apply(A, b.x0, b.y1), apply(A, b.x1, b.y1)];
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

/** Panels sharing a hinge (parent and child), by id. */
function foldNeighbours(model: DielineModel): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  const add = (a: string, b: string) => (m.get(a) ?? m.set(a, new Set()).get(a)!).add(b);
  for (const p of model.panels)
    if (p.parentId && p.hingeKind !== "roll") {
      add(p.id, p.parentId);
      add(p.parentId, p.id);
    }
  return m;
}

/** Reflection about a line through a and b (sheet mm). */
function reflection(a: { x: number; y: number }, b: { x: number; y: number }): Affine {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy || 1;
  const c = (dx * dx - dy * dy) / l2;
  const s = (2 * dx * dy) / l2;
  // p' = a + R (p - a), R = [[c, s], [s, -c]]
  return [c, s, s, -c, a.x - c * a.x - s * a.y, a.y - s * a.x + c * a.y];
}

/**
 * Plan for every printable target panel. `direct` gives each matched panel's maps; panels without
 * any get their parent's art mirrored across their hinge (rolled-in walls, tucks: hidden when the
 * box is closed, and the art stays continuous round the fold), else the mean colour.
 */
export function completePlan(target: DielineModel, direct: Map<string, PanelMap[]>, viaDirect: "match" | "face"): PanelPlan[] {
  const plans = new Map<string, PanelPlan>();
  for (const p of panelOrder(target)) {
    if (!p.printable) continue;
    const maps = direct.get(p.id);
    if (maps?.length) {
      plans.set(p.id, { panelId: p.id, via: viaDirect, maps });
      continue;
    }
    const parent = p.parentId ? plans.get(p.parentId) : null;
    if (parent && parent.maps.length && p.hinge) {
      const R = reflection(p.hinge.a, p.hinge.b);
      plans.set(p.id, { panelId: p.id, via: "reflect", maps: parent.maps.slice(0, 1).map((m) => ({ ...m, A: composeAffine(m.A, R), across: [] })) });
      continue;
    }
    plans.set(p.id, { panelId: p.id, via: "fill", maps: [] });
  }
  // A root without a match (multi-piece lids, or nothing matched at all): borrow from a child.
  for (const p of target.panels) {
    const plan = plans.get(p.id);
    if (!plan || plan.maps.length) continue;
    const child = target.panels.find((c) => c.parentId === p.id && c.hinge && plans.get(c.id)?.via !== "fill" && plans.get(c.id)?.maps.length);
    if (child) {
      const R = reflection(child.hinge!.a, child.hinge!.b);
      plan.via = "reflect";
      plan.maps = plans.get(child.id)!.maps.slice(0, 1).map((m) => ({ ...m, A: composeAffine(m.A, R), across: [] }));
    }
  }
  return [...plans.values()];
}

/**
 * Model mode: the candidate model fitted on the art (built at `fitDims`), its placement `T`
 * (candidate sheet mm → image px) and its snapped panel boxes.
 */
export function planFromModel(target: DielineModel, candidate: DielineModel, src: RemapSource, surface: PrintSurface): PanelPlan[] {
  const T = src.transform!;
  const snapped = src.snapped ?? {};
  const pairs = pairPanels(target, candidate, surface);
  const nb = foldNeighbours(candidate);
  const boxOf = (id: string): Box | null => {
    const s = snapped[id];
    if (s) return { x0: s[0], y0: s[1], x1: s[2], y1: s[3] };
    const p = candidate.panels.find((q) => q.id === id);
    return p ? { x0: p.bbox.x, y0: p.bbox.y, x1: p.bbox.x + p.bbox.width, y1: p.bbox.y + p.bbox.height } : null;
  };
  const direct = new Map<string, PanelMap[]>();
  for (const [tid, list] of pairs) {
    const maps: PanelMap[] = [];
    for (const pr of list) {
      const cp = candidate.panels.find((q) => q.id === pr.source);
      const snappedBox = boxOf(pr.source);
      if (!cp || !snappedBox) continue;
      const tmpl: Box = { x0: cp.bbox.x, y0: cp.bbox.y, x1: cp.bbox.x + cp.bbox.width, y1: cp.bbox.y + cp.bbox.height };
      const C = rectMap(tmpl, snappedBox);
      const A = composeAffine(T, composeAffine(C, pr.A));
      const across = [...(nb.get(pr.source) ?? [])].map((id) => boxOf(id)).filter((b): b is Box => !!b).map((b) => boxThrough(T, b));
      maps.push({ A, clamp: boxThrough(T, snappedBox), across, source: pr.source });
    }
    if (maps.length) direct.set(tid, maps);
  }
  return completePlan(target, direct, "match");
}

/** Faces mode: each visible target face from the face found in the art (no model matched). */
export function planFromFaces(target: DielineModel, src: RemapSource): PanelPlan[] {
  const faces = src.faces ?? {};
  const direct = new Map<string, PanelMap[]>();
  for (const info of Object.values(target.faces)) {
    if (!info) continue;
    const f = faces[info.face as FaceId];
    if (!f) continue;
    for (const part of info.parts) {
      const panel = target.panels.find((p) => p.id === part.panelId);
      if (!panel?.printable) continue;
      // target sheet → face-local (outside view). The source face frames are outside-view too,
      // for an inside print as well (found from the walls' physical sides), so the same map holds.
      const toFace = invertAffine(part.transform);
      const su = f.width / (info.width || 1);
      const sv = f.height / (info.height || 1);
      // face-local (u, v) → image px: origin + right·u·su + down·v·sv
      const F: Affine = [f.right.x * su, f.right.y * su, f.down.x * sv, f.down.y * sv, f.origin.x, f.origin.y];
      const A = composeAffine(F, toFace);
      const corners = [f.origin, { x: f.origin.x + f.right.x * f.width, y: f.origin.y + f.right.y * f.width }, { x: f.origin.x + f.down.x * f.height, y: f.origin.y + f.down.y * f.height }, { x: f.origin.x + f.right.x * f.width + f.down.x * f.height, y: f.origin.y + f.right.y * f.width + f.down.y * f.height }];
      const clamp: Box = { x0: Math.min(...corners.map((c) => c.x)), y0: Math.min(...corners.map((c) => c.y)), x1: Math.max(...corners.map((c) => c.x)), y1: Math.max(...corners.map((c) => c.y)) };
      const list = direct.get(part.panelId) ?? [];
      list.push({ A, clamp, across: [], source: info.face });
      direct.set(part.panelId, list);
    }
  }
  return completePlan(target, direct, "face");
}
