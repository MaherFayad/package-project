import type { Dims } from "@/types";
import type { Affine, DielineModel } from "@/lib/dieline";
import { BOARD_SPECS } from "@/lib/dieline/materials";
import type { DetectModel } from "./types";

/**
 * Step 3 of the dieline detector: compare the detected structure with every library box model
 * (`model.build`, the same generator the designer uses) and solve for its dims.
 *
 * Positions of the straight fold and cut lines are (piecewise) linear in L, W, H, so per model
 * and orientation a 4-build finite difference gives line position = p0 + J · (D - D0) (mm).
 * The image positions are then px = s · mm + offset with s the px/mm scale: with s fixed, the
 * unknowns (s·L, s·W, s·H, offsetX, offsetY) solve by weighted least squares, and an ICP loop
 * re-pairs model lines with detected lines. Raster checks (chamfer both ways, silhouette IoU)
 * rank the short list.
 */

const DIM_KEYS = ["L", "W", "H"] as const;
type DimKey = (typeof DIM_KEYS)[number];

/* ───────────── model geometry ───────────── */

export interface MSeg {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  kind: "cut" | "crease" | "perf";
}

/** A built dieline in die-local mm (origin at the die's top-left corner). */
export interface Geo {
  dims: Dims;
  W: number;
  H: number;
  segs: MSeg[];
  polys: { x: number; y: number }[][];
  model: DielineModel;
}

export function thicknessOf(m: DetectModel): number {
  const mat = m.materials?.[0];
  return (mat && BOARD_SPECS[mat]?.thicknessMm) || 1.5;
}

/** Clamp to the model's limits and apply its simple rules ("H <= W", "L == W", …). */
export function legalDims(m: DetectModel, d: Dims): Dims {
  const out: Dims = { ...d };
  for (const k of DIM_KEYS) out[k] = Math.min(m.limits[k].max, Math.max(m.limits[k].min, Number.isFinite(out[k]) ? out[k] : m.defaultDims[k]));
  for (const rule of m.limits.rules ?? []) {
    const r = /^\s*([LWH])\s*(<=|>=|==|<|>)\s*([LWH])\s*$/.exec(rule);
    if (!r) continue;
    const a = r[1] as DimKey;
    const b = r[3] as DimKey;
    const op = r[2];
    if (op === "==") out[a] = out[b];
    else if ((op === "<=" || op === "<") && out[a] > out[b]) out[a] = op === "<" ? out[b] - 0.5 : out[b];
    else if ((op === ">=" || op === ">") && out[a] < out[b]) out[a] = op === ">" ? out[b] + 0.5 : out[b];
  }
  return out;
}

const GEO_CACHE = new Map<string, Geo | null>();

export function geoOf(m: DetectModel, dims: Dims): Geo | null {
  const d = legalDims(m, dims);
  const key = `${m.code}|${d.L.toFixed(2)}|${d.W.toFixed(2)}|${d.H.toFixed(2)}`;
  if (GEO_CACHE.has(key)) return GEO_CACHE.get(key)!;
  let model: DielineModel | null = null;
  try {
    model = m.build(d, { thicknessMm: thicknessOf(m) });
  } catch {
    model = null;
  }
  let geo: Geo | null = null;
  if (model) {
    const ox = model.dieBounds.x;
    const oy = model.dieBounds.y;
    const seg = (s: { a: { x: number; y: number }; b: { x: number; y: number } }, kind: MSeg["kind"]): MSeg => ({ ax: s.a.x - ox, ay: s.a.y - oy, bx: s.b.x - ox, by: s.b.y - oy, kind });
    geo = {
      dims: d,
      W: model.dieBounds.width,
      H: model.dieBounds.height,
      segs: [...model.cutLines.map((s) => seg(s, "cut")), ...model.creaseLines.map((s) => seg(s, "crease")), ...model.perfLines.map((s) => seg(s, "perf"))],
      polys: model.panels.map((p) => p.polygon.map((q) => ({ x: q.x - ox, y: q.y - oy }))),
      model,
    };
  }
  if (GEO_CACHE.size > 4000) GEO_CACHE.clear();
  GEO_CACHE.set(key, geo);
  return geo;
}

/* ───────────── orientations ───────────── */

/** Die-local → oriented die-local affine (k × 90° clockwise, then optional mirror). */
export function orientAffine(o: number, W: number, H: number): { A: Affine; W: number; H: number } {
  const k = o & 3;
  let A: Affine;
  let w2 = W;
  let h2 = H;
  if (k === 0) A = [1, 0, 0, 1, 0, 0];
  else if (k === 1) {
    A = [0, 1, -1, 0, H, 0];
    w2 = H;
    h2 = W;
  } else if (k === 2) A = [-1, 0, 0, -1, W, H];
  else {
    A = [0, -1, 1, 0, 0, W];
    w2 = H;
    h2 = W;
  }
  if (o & 4) A = mul([-1, 0, 0, 1, w2, 0], A);
  return { A, W: w2, H: h2 };
}

/** A ∘ B (apply B first). */
export function mul(A: Affine, B: Affine): Affine {
  return [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3], A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]];
}

export const apply = (A: Affine, x: number, y: number) => ({ x: A[0] * x + A[2] * y + A[4], y: A[1] * x + A[3] * y + A[5] });

/* ───────────── 1D line positions ───────────── */

export interface Pos {
  pos: number;
  w: number;
}

/**
 * Distinct x positions of vertical lines and y positions of horizontal lines (oriented frame),
 * merged within `tol`, keeping those whose total length is at least `minW`.
 */
export function axisPositions(segs: { ax: number; ay: number; bx: number; by: number }[], A: Affine, tol: number, minW: number): { xs: Pos[]; ys: Pos[] } {
  const vx: Pos[] = [];
  const hy: Pos[] = [];
  for (const s of segs) {
    const a = apply(A, s.ax, s.ay);
    const b = apply(A, s.bx, s.by);
    const dx = Math.abs(b.x - a.x);
    const dy = Math.abs(b.y - a.y);
    const len = Math.hypot(dx, dy);
    if (len <= 0) continue;
    if (dx <= 0.02 * len) vx.push({ pos: (a.x + b.x) / 2, w: len });
    else if (dy <= 0.02 * len) hy.push({ pos: (a.y + b.y) / 2, w: len });
  }
  return { xs: mergePos(vx, tol, minW), ys: mergePos(hy, tol, minW) };
}

export function mergePos(list: Pos[], tol: number, minW: number): Pos[] {
  const s = [...list].sort((a, b) => a.pos - b.pos);
  const out: Pos[] = [];
  let cur: { sp: number; w: number; last: number } | null = null;
  for (const p of s) {
    if (cur && p.pos - cur.last <= tol) {
      cur.sp += p.pos * p.w;
      cur.w += p.w;
      cur.last = p.pos;
    } else {
      if (cur) out.push({ pos: cur.sp / cur.w, w: cur.w });
      cur = { sp: p.pos * p.w, w: p.w, last: p.pos };
    }
  }
  if (cur) out.push({ pos: cur.sp / cur.w, w: cur.w });
  return out.filter((p) => p.w >= minW);
}

/* ───────────── detected structure ───────────── */

export interface DetStructure {
  /** Deskewed working px. */
  xs: Pos[];
  ys: Pos[];
  box: { x0: number; y0: number; x1: number; y1: number };
  /** Longest side of the die box (px). */
  size: number;
}

/* ───────────── linearised model ───────────── */

interface AxisLin {
  p0: number[];
  J: [number, number, number][];
  w: number[];
}

/** One model in one orientation, linearised around D0 (mm, oriented die-local frame). */
export interface Lin {
  code: string;
  o: number;
  D0: Dims;
  x: AxisLin;
  y: AxisLin;
  size0: [number, number];
  sizeJ: [[number, number, number], [number, number, number]];
  /** Dims that cannot move (min == max). */
  fixed: [boolean, boolean, boolean];
}

const POS_TOL = 0.004;
const POS_MIN = 0.03;

function positionsOf(g: Geo, o: number) {
  const { A, W, H } = orientAffine(o, g.W, g.H);
  const size = Math.max(W, H);
  const { xs, ys } = axisPositions(g.segs, A, POS_TOL * size, POS_MIN * size);
  return { xs, ys, W, H };
}

/** Pair each base line with the nearest line of a slightly perturbed build (moves < 1 mm). */
function pairUp(base: Pos[], other: Pos[]): number[] {
  return base.map((b) => {
    let best = other[0]?.pos ?? b.pos;
    for (const q of other) if (Math.abs(q.pos - b.pos) < Math.abs(best - b.pos)) best = q.pos;
    return best;
  });
}

/** Linearise a model in all 8 orientations around D0 (4 builds). */
const LIN_CACHE = new Map<string, Lin[] | null>();

export function linearise(m: DetectModel, D0in: Dims): Lin[] | null {
  const D0 = legalDims(m, D0in);
  const key = `${m.code}|${D0.L.toFixed(2)}|${D0.W.toFixed(2)}|${D0.H.toFixed(2)}`;
  if (LIN_CACHE.has(key)) return LIN_CACHE.get(key)!;
  if (LIN_CACHE.size > 3000) LIN_CACHE.clear();
  const out = lineariseUncached(m, D0);
  LIN_CACHE.set(key, out);
  return out;
}

function lineariseUncached(m: DetectModel, D0: Dims): Lin[] | null {
  const g0 = geoOf(m, D0);
  if (!g0) return null;
  const fixed: [boolean, boolean, boolean] = [false, false, false];
  const pert: (Geo | null)[] = [];
  const deltas: number[] = [];
  DIM_KEYS.forEach((k, i) => {
    const lim = m.limits[k];
    if (lim.max - lim.min < 0.5) {
      fixed[i] = true;
      pert.push(null);
      deltas.push(0);
      return;
    }
    let dlt = 0.5;
    if (D0[k] + dlt > lim.max) dlt = -dlt;
    const g = geoOf(m, { ...D0, [k]: D0[k] + dlt });
    const real = g ? g.dims[k] - D0[k] : 0;
    if (!g || Math.abs(real) < 1e-6) {
      fixed[i] = true;
      pert.push(null);
      deltas.push(0);
      return;
    }
    pert.push(g);
    deltas.push(real);
  });
  const out: Lin[] = [];
  for (let o = 0; o < 8; o++) {
    const b = positionsOf(g0, o);
    const ps = pert.map((g) => (g ? positionsOf(g, o) : null));
    const axis = (key: "xs" | "ys"): AxisLin => {
      const base = b[key];
      const cols = ps.map((p, i) => (p ? pairUp(base, p[key]).map((v, j) => (v - base[j].pos) / deltas[i]) : base.map(() => 0)));
      return { p0: base.map((p) => p.pos), J: base.map((_, j) => [cols[0][j], cols[1][j], cols[2][j]]), w: base.map((p) => p.w) };
    };
    const sj = (key: "W" | "H"): [number, number, number] => ps.map((p, i) => (p ? (p[key] - b[key]) / deltas[i] : 0)) as [number, number, number];
    out.push({ code: m.code, o, D0, x: axis("xs"), y: axis("ys"), size0: [b.W, b.H], sizeJ: [sj("W"), sj("H")], fixed });
  }
  return out;
}

/* ───────────── least squares fit ───────────── */

/** z = [uL, uW, uH, ox, oy]: u = s · dims (px), o = die origin (px). */
export type Z = [number, number, number, number, number];

function predict(p0: number, J: readonly number[], D0: Dims, s: number, z: Z, axis: 0 | 1): number {
  return s * (p0 - J[0] * D0.L - J[1] * D0.W - J[2] * D0.H) + J[0] * z[0] + J[1] * z[1] + J[2] * z[2] + z[3 + axis];
}

function nearest(list: Pos[], v: number): number {
  let best = Infinity;
  let bi = -1;
  for (let i = 0; i < list.length; i++) {
    const d = Math.abs(list[i].pos - v);
    if (d < best) {
      best = d;
      bi = i;
    }
  }
  return bi;
}

function solve5(M: number[][], r: number[]): number[] | null {
  const n = 5;
  const a = M.map((row, i) => [...row, r[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let i = c + 1; i < n; i++) if (Math.abs(a[i][c]) > Math.abs(a[p][c])) p = i;
    if (Math.abs(a[p][c]) < 1e-12) return null;
    [a[c], a[p]] = [a[p], a[c]];
    for (let i = 0; i < n; i++) {
      if (i === c) continue;
      const f = a[i][c] / a[c][c];
      for (let j = c; j <= n; j++) a[i][j] -= f * a[c][j];
    }
  }
  return a.map((row, i) => row[n] / row[i]);
}

export interface Fit {
  lin: Lin;
  s: number;
  z: Z;
  score: number;
  /** Model lines paired with a detected line / all model line weight. */
  matched: number;
  pairs: number;
  total: number;
}

/**
 * ICP: pair each model line with the nearest detected line on the same axis, solve, re-pair with
 * a shrinking gate. The first round places the `start` layout per axis by `align`: 0 stretched
 * onto the detected box, 1 at scale `s` from the box's low edge, 2 from its high edge (so a
 * template with a flap the art lacks, or the reverse, still starts paired right at one end).
 * `init` warm-starts from a previous solution instead (no placement round, tight gates).
 */
export function fitLin(lin: Lin, det: DetStructure, s: number, start: Dims, align: readonly [number, number] = [0, 0], init?: Z, rounds?: number): Fit {
  const { box } = det;
  const bw = box.x1 - box.x0;
  const bh = box.y1 - box.y0;
  const D0 = lin.D0;
  // Prior: the start dims at scale s.
  const prior = [s * start.L, s * start.W, s * start.H];
  let z: Z = init ? [...init] : [prior[0], prior[1], prior[2], box.x0, box.y0];
  const startSize = [
    lin.size0[0] + lin.sizeJ[0][0] * (start.L - D0.L) + lin.sizeJ[0][1] * (start.W - D0.W) + lin.sizeJ[0][2] * (start.H - D0.H),
    lin.size0[1] + lin.sizeJ[1][0] * (start.L - D0.L) + lin.sizeJ[1][1] * (start.W - D0.W) + lin.sizeJ[1][2] * (start.H - D0.H),
  ];
  // From a previous solution (`init`): no placement round, tight gates only.
  const allGates = init ? [0.02, 0.015, 0.012, 0.01, 0.01] : [0.06, 0.04, 0.025, 0.018, 0.012, 0.01, 0.01];
  const gates = rounds ? allGates.slice(0, rounds) : allGates;
  if (!lin.x.p0.length || !lin.y.p0.length) {
    return { lin, s, z, score: -1, matched: 0, pairs: 0, total: 0 };
  }
  const totalW = lin.x.w.reduce((a, b) => a + b, 0) + lin.y.w.reduce((a, b) => a + b, 0) || 1;
  for (let it = 0; it < gates.length; it++) {
    const gate = gates[it] * det.size;
    const M = Array.from({ length: 5 }, () => [0, 0, 0, 0, 0]);
    const r = [0, 0, 0, 0, 0];
    const addRow = (c: number[], rhs: number, w: number) => {
      for (let i = 0; i < 5; i++) {
        r[i] += w * c[i] * rhs;
        for (let j = 0; j < 5; j++) M[i][j] += w * c[i] * c[j];
      }
    };
    for (const axis of [0, 1] as const) {
      const al = axis === 0 ? lin.x : lin.y;
      const dl = axis === 0 ? det.xs : det.ys;
      for (let i = 0; i < al.p0.length; i++) {
        const J = al.J[i];
        let pred: number;
        if (it === 0 && !init) {
          // Stretch the start layout onto the detected box.
          const pS = al.p0[i] + J[0] * (start.L - D0.L) + J[1] * (start.W - D0.W) + J[2] * (start.H - D0.H);
          const lo = axis === 0 ? box.x0 : box.y0;
          const hi = axis === 0 ? box.x1 : box.y1;
          const mode = align[axis];
          pred = mode === 1 ? lo + s * pS : mode === 2 ? hi - s * (startSize[axis] - pS) : lo + (pS / startSize[axis]) * (axis === 0 ? bw : bh);
        } else pred = predict(al.p0[i], J, D0, s, z, axis);
        const j = nearest(dl, pred);
        if (j < 0 || Math.abs(dl[j].pos - pred) > gate) continue;
        const c = [J[0], J[1], J[2], axis === 0 ? 1 : 0, axis === 1 ? 1 : 0];
        const rhs = dl[j].pos - s * (al.p0[i] - J[0] * D0.L - J[1] * D0.W - J[2] * D0.H);
        addRow(c, rhs, al.w[i] / totalW);
      }
    }
    // Die box edges (the outline's bounding box is a strong cue for overall proportions).
    const bwt = 0.06;
    for (const axis of [0, 1] as const) {
      const sJ = lin.sizeJ[axis];
      const lo = axis === 0 ? box.x0 : box.y0;
      const hi = axis === 0 ? box.x1 : box.y1;
      // Gated like the lines after the first round: a template with an extra (or missing) flap
      // on the art must not be squeezed to the art's outline.
      const lowPred = z[3 + axis];
      const hiPred = predict(lin.size0[axis], sJ, D0, s, z, axis);
      if ((it === 0 && !init) || Math.abs(lowPred - lo) <= gate) addRow([0, 0, 0, axis === 0 ? 1 : 0, axis === 1 ? 1 : 0], lo, bwt);
      const c = [sJ[0], sJ[1], sJ[2], axis === 0 ? 1 : 0, axis === 1 ? 1 : 0];
      if ((it === 0 && !init) || Math.abs(hiPred - hi) <= gate) addRow(c, hi - s * (lin.size0[axis] - sJ[0] * D0.L - sJ[1] * D0.W - sJ[2] * D0.H), bwt);
    }
    // Weak prior keeps unobservable dims (and fixed ones) where they are.
    for (let k = 0; k < 3; k++) {
      const lam = lin.fixed[k] ? 1e3 : 1e-4;
      const c = [0, 0, 0, 0, 0];
      c[k] = 1;
      addRow(c, prior[k], lam / Math.max(1, prior[k]) ** 2);
    }
    const sol = solve5(M, r);
    if (!sol || sol.some((v) => !Number.isFinite(v))) break;
    z = [Math.max(1, sol[0]), Math.max(1, sol[1]), Math.max(1, sol[2]), sol[3], sol[4]];
  }
  return { lin, s, z, ...score1D(lin, det, s, z) };
}

/** Symmetric truncated distance between predicted model lines and detected lines (0..1). */
export function score1D(lin: Lin, det: DetStructure, s: number, z: Z): { score: number; matched: number; pairs: number; total: number } {
  const tau = 0.012 * det.size;
  let mm = 0;
  let mw = 0;
  let matchedW = 0;
  let pairs = 0;
  let total = 0;
  const predAxis: number[][] = [[], []];
  for (const axis of [0, 1] as const) {
    const al = axis === 0 ? lin.x : lin.y;
    const dl = axis === 0 ? det.xs : det.ys;
    for (let i = 0; i < al.p0.length; i++) {
      const p = predict(al.p0[i], al.J[i], lin.D0, s, z, axis);
      predAxis[axis].push(p);
      const j = nearest(dl, p);
      const d = j < 0 ? tau : Math.abs(dl[j].pos - p);
      mm += al.w[i] * Math.min(1, d / tau);
      mw += al.w[i];
      total++;
      if (d < 0.5 * tau) {
        matchedW += al.w[i];
        pairs++;
      }
    }
  }
  let dm = 0;
  let dw = 0;
  for (const axis of [0, 1] as const) {
    const dl = axis === 0 ? det.xs : det.ys;
    for (const q of dl) {
      let best = Infinity;
      for (const p of predAxis[axis]) best = Math.min(best, Math.abs(p - q.pos));
      dm += q.w * Math.min(1, best / tau);
      dw += q.w;
    }
  }
  // Box edges.
  const W = predict(lin.size0[0], lin.sizeJ[0], lin.D0, s, z, 0) - z[3];
  const H = predict(lin.size0[1], lin.sizeJ[1], lin.D0, s, z, 1) - z[4];
  const be =
    (Math.min(1, Math.abs(z[3] - det.box.x0) / tau) +
      Math.min(1, Math.abs(z[4] - det.box.y0) / tau) +
      Math.min(1, Math.abs(z[3] + W - det.box.x1) / tau) +
      Math.min(1, Math.abs(z[4] + H - det.box.y1) / tau)) /
    4;
  const cm = mw ? mm / mw : 1;
  const cd = dw ? dm / dw : 1;
  return { score: 1 - (0.4 * cm + 0.4 * cd + 0.2 * be), matched: mw ? matchedW / mw : 0, pairs, total };
}

/** Normalised-layout comparison at the default size (prefilter, no solve). */
export function coarseCost(g: Geo, o: number, det: DetStructure): number {
  const { xs, ys, W, H } = positionsOf(g, o);
  const bw = det.box.x1 - det.box.x0;
  const bh = det.box.y1 - det.box.y0;
  const tau = 0.05;
  const one = (m: Pos[], d: Pos[], mScale: number, d0: number, dScale: number) => {
    const mn = m.map((p) => ({ pos: p.pos / mScale, w: p.w }));
    const dn = d.map((p) => ({ pos: (p.pos - d0) / dScale, w: p.w }));
    const half = (a: Pos[], b: Pos[]) => {
      let c = 0;
      let wsum = 0;
      for (const p of a) {
        const j = nearest(b, p.pos);
        c += p.w * Math.min(1, j < 0 ? 1 : Math.abs(b[j].pos - p.pos) / tau);
        wsum += p.w;
      }
      return wsum ? c / wsum : 1;
    };
    return 0.5 * (half(mn, dn) + half(dn, mn));
  };
  const cx = one(xs, det.xs, W, det.box.x0, bw);
  const cy = one(ys, det.ys, H, det.box.y0, bh);
  const countPen = (Math.abs(xs.length - det.xs.length) + Math.abs(ys.length - det.ys.length)) / Math.max(4, det.xs.length + det.ys.length);
  return 0.5 * (cx + cy) + 0.25 * countPen;
}

/** Predicted dims (mm) from a fit. */
export const dimsOf = (z: Z, s: number): Dims => ({ L: z[0] / s, W: z[1] / s, H: z[2] / s });

/**
 * Absolute size guess when the image has no usable resolution: the scale that puts the fitted
 * proportions nearest one of the model's standard sizes (presets, default), kept inside limits.
 */
export function guessScale(m: DetectModel, u: [number, number, number], fixed: [boolean, boolean, boolean]): number {
  let lo = 0;
  let hi = Infinity;
  DIM_KEYS.forEach((k, i) => {
    if (fixed[i]) return;
    lo = Math.max(lo, u[i] / m.limits[k].max);
    hi = Math.min(hi, u[i] / m.limits[k].min);
  });
  const sizes = [m.defaultDims, ...m.presets.map((p) => p.dims)];
  let best = Infinity;
  let bestS = 0;
  for (const d of sizes) {
    const logs = DIM_KEYS.map((k, i) => (fixed[i] ? null : Math.log(u[i] / d[k]))).filter((v): v is number => v !== null);
    if (!logs.length) continue;
    const mean = logs.reduce((a, b) => a + b, 0) / logs.length;
    const dist = Math.sqrt(logs.reduce((a, b) => a + (b - mean) ** 2, 0) / logs.length);
    if (dist < best) {
      best = dist;
      bestS = Math.exp(mean);
    }
  }
  if (!bestS) bestS = u[0] / m.defaultDims.L;
  if (lo <= hi) bestS = Math.min(hi, Math.max(lo, bestS));
  return bestS;
}

/* ───────────── data-driven starts ───────────── */

/**
 * Panel sizes seen on the art: gaps between consecutive distinct lines on each axis (px), merged
 * within 2 %, heaviest first. A box's L, W and H (in px) are usually among them.
 */
export function panelGaps(det: DetStructure, max = 8): number[] {
  const gaps: Pos[] = [];
  for (const list of [det.xs, det.ys]) {
    for (let i = 1; i < list.length; i++) {
      const g = list[i].pos - list[i - 1].pos;
      if (g >= 0.03 * det.size) gaps.push({ pos: g, w: Math.min(list[i].w, list[i - 1].w) });
    }
  }
  gaps.sort((a, b) => a.pos - b.pos);
  const merged: Pos[] = [];
  for (const g of gaps) {
    const last = merged[merged.length - 1];
    if (last && g.pos <= last.pos * 1.02) {
      last.pos = (last.pos * last.w + g.pos * g.w) / (last.w + g.w);
      last.w += g.w;
    } else merged.push({ ...g });
  }
  return merged
    .sort((a, b) => b.w - a.w)
    .slice(0, max)
    .map((g) => g.pos);
}

/**
 * Offsets for a given u (px dims) by voting: every pairing of one of the template's heaviest
 * lines with a detected line proposes an offset; the one that lines up the most weight wins.
 */
export function houghInit(lin: Lin, det: DetStructure, s: number, u: [number, number, number]): Z {
  const tau = 0.01 * det.size;
  const off = (axis: 0 | 1): number => {
    const al = axis === 0 ? lin.x : lin.y;
    const dl = axis === 0 ? det.xs : det.ys;
    const base = axis === 0 ? det.box.x0 : det.box.y0;
    if (!al.p0.length || !dl.length) return base;
    const z0: Z = [u[0], u[1], u[2], 0, 0];
    const pred = al.p0.map((p0, i) => predict(p0, al.J[i], lin.D0, s, z0, axis));
    const order = al.w.map((w, i) => ({ w, i })).sort((a, b) => b.w - a.w).slice(0, 3);
    let best = base;
    let bestV = -1;
    for (const { i } of order) {
      for (const d of dl) {
        const o = d.pos - pred[i];
        let v = 0;
        for (let k = 0; k < pred.length; k++) {
          const j = nearest(dl, pred[k] + o);
          if (Math.abs(dl[j].pos - pred[k] - o) < tau) v += Math.min(al.w[k], dl[j].w / s);
        }
        if (v > bestV) {
          bestV = v;
          best = o;
        }
      }
    }
    return best;
  };
  return [u[0], u[1], u[2], off(0), off(1)];
}
