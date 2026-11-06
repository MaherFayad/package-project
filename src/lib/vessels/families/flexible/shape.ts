import type { Mm } from "@/types";
import { SLEEVE_MAX_SHRINK } from "./constants";
import { definitionFor } from "./definitions";
import { headerHeight, type FlexConfig } from "./schema";
import type { FlexPanelId } from "./types";

/**
 * Filled-shape solver (pure math, no three.js). Film does not stretch, so every model is built
 * in FLAT film coordinates and bent into shape while keeping lengths:
 *  - across a face, the cross-section curve is solved so its arc length equals the flat width;
 *  - along the height, rows are spaced so the face centre line keeps its flat length.
 * That is why a filled pillow pinches in at the waist and gets shorter, and why artwork mapped
 * by flat coordinates (UVs) lands on the 3D pack without stretching.
 */

/** A surface point of a cross-section row. s = flat mm across the panel, from its left edge as seen from outside. */
export interface RowPoint {
  x: Mm;
  z: Mm;
  s: Mm;
}

export interface PanelStrip {
  panel: FlexPanelId;
  pts: RowPoint[];
}

export interface ShapeRow {
  y: Mm;
  /** Flat distance (mm) of this row from the TOP trim edge of the face panels. */
  tFlat: Mm;
  strips: PanelStrip[];
}

export interface FlexShape {
  config: FlexConfig;
  model: "pillow" | "standup" | "box" | "sleeve";
  /** Body rows, bottom to top. Every row has the same strips with the same point counts. */
  rows: ShapeRow[];
  /** Flat face width / height (trim, mm). */
  faceW: Mm;
  faceH: Mm;
  /** Effective seals (top includes a hang-hole header). side = 0 for folded or gusseted edges. */
  seals: { top: Mm; bottom: Mm; side: Mm };
  /** y of the bottom seal top edge / top of the body / top edge of the top seal. */
  bodyBottomY: Mm;
  bodyTopY: Mm;
  topY: Mm;
  /** Base shape (stand-up oval, box rectangle). */
  base?: { kind: "oval"; a: Mm; b: Mm; n?: number } | { kind: "rect"; a: Mm; c: Mm };
  /** Enclosed volume of the filled body (ml). */
  volumeMl: number;
  envelope: { width: Mm; depth: Mm; height: Mm };
  /** Long axis horizontal (flow wrap): positions are rotated by orient() for display. */
  horizontal: boolean;
}

/** Enough rows / columns to carry film wrinkles of ~7 mm wavelength (about 10k triangles a pack). */
const ROWS = 56;
const COLS = 40;

/** Superellipse exponent of the stand-up pouch cross-section (< 2 = pointed ends at the side seals). */
const STANDUP_LENS = 1.35;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (e0: number, e1: number, v: number) => {
  const t = clamp01((v - e0) / Math.max(1e-9, e1 - e0));
  return t * t * (3 - 2 * t);
};

// ---------------------------------------------------------------------------------------------
// Cross-section curves
// ---------------------------------------------------------------------------------------------

/** Points (x, z) and cumulative arc of a front curve sampled from x = -a to x = a. */
interface Curve {
  x: number[];
  z: number[];
  arc: number[];
}

/** Cosine-spaced parameter in [-1, 1], dense near the edges where the slope is steep. */
function uAt(k: number, m: number): number {
  return -Math.cos((Math.PI * k) / m);
}

function sampleCurve(a: number, zf: (u: number) => number, m = 64): Curve {
  const x: number[] = [];
  const z: number[] = [];
  const arc: number[] = [];
  let acc = 0;
  for (let k = 0; k <= m; k++) {
    const u = uAt(k, m);
    const px = a * u;
    const pz = zf(u);
    if (k > 0) acc += Math.hypot(px - x[k - 1], pz - z[k - 1]);
    x.push(px);
    z.push(pz);
    arc.push(acc);
  }
  return { x, z, arc };
}

/** Superellipse lens half (front): z = b (1 - |u|^n)^(1/n). */
const lens = (b: number, n: number) => (u: number) => b * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(u), n)), 1 / n);

/** Solve the half width a so that the front curve's arc length equals `width`. */
function solveHalfWidth(width: number, zf: (a: number) => (u: number) => number): Curve {
  let lo = 1e-3;
  let hi = width / 2;
  let best = sampleCurve(hi, zf(hi));
  if (best.arc[best.arc.length - 1] <= width + 1e-6) return best;
  for (let it = 0; it < 40; it++) {
    const mid = (lo + hi) / 2;
    const c = sampleCurve(mid, zf(mid));
    const L = c.arc[c.arc.length - 1];
    best = c;
    if (Math.abs(L - width) < 1e-4) break;
    if (L > width) hi = mid;
    else lo = mid;
  }
  return best;
}

/** Resample a curve at evenly spaced flat positions (arc length), returning `cols`+1 points. */
function resample(c: Curve, cols: number, sOffset: number): RowPoint[] {
  const L = c.arc[c.arc.length - 1];
  const out: RowPoint[] = [];
  let k = 0;
  for (let j = 0; j <= cols; j++) {
    const target = (L * j) / cols;
    while (k < c.arc.length - 2 && c.arc[k + 1] < target) k++;
    const span = c.arc[k + 1] - c.arc[k];
    const f = span > 1e-9 ? clamp01((target - c.arc[k]) / span) : 0;
    out.push({ x: c.x[k] + (c.x[k + 1] - c.x[k]) * f, z: c.z[k] + (c.z[k + 1] - c.z[k]) * f, s: sOffset + target });
  }
  return out;
}

/** Back strip from a front strip (mirror through the Y axis; viewer-left of the back is +x). */
const mirrorBack = (pts: RowPoint[]): RowPoint[] => pts.map((p) => ({ x: -p.x, z: -p.z, s: p.s }));

/** Area of a closed polygon in the x-z plane. */
function polygonArea(pts: { x: number; z: number }[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a += p.x * q.z - q.x * p.z;
  }
  return Math.abs(a) / 2;
}

function rowArea(row: ShapeRow): number {
  return polygonArea(row.strips.flatMap((s) => s.pts));
}

/**
 * Place rows along a centre-line profile z = depth(u), u = 0..1 over the (unknown) visible
 * height Y, so that consecutive rows are exactly `length / n` apart along the curve. Y is solved
 * so the whole curve has the flat film length. Returns u per row and Y.
 */
function arcRows(depth: (u: number) => number, length: number, n: number): { u: number[]; Y: number } {
  const M = 480;
  const zs: number[] = [];
  for (let k = 0; k <= M; k++) zs.push(depth(k / M));
  const total = (Y: number) => {
    let acc = 0;
    for (let k = 1; k <= M; k++) acc += Math.hypot(Y / M, zs[k] - zs[k - 1]);
    return acc;
  };
  let lo = 0;
  let hi = length;
  if (total(0) >= length) hi = 0;
  for (let it = 0; it < 50 && hi > 0; it++) {
    const mid = (lo + hi) / 2;
    if (total(mid) > length) hi = mid;
    else lo = mid;
  }
  const Y = (lo + hi) / 2;
  const cum = [0];
  for (let k = 1; k <= M; k++) cum.push(cum[k - 1] + Math.hypot(Y / M, zs[k] - zs[k - 1]));
  const L = cum[M];
  const u: number[] = [];
  let k = 0;
  for (let i = 0; i <= n; i++) {
    const target = (L * i) / n;
    while (k < M - 1 && cum[k + 1] < target) k++;
    const f = clamp01((target - cum[k]) / Math.max(1e-12, cum[k + 1] - cum[k]));
    u.push((k + f) / M);
  }
  return { u, Y };
}

// ---------------------------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------------------------

function pillow(cfg: FlexConfig): FlexShape {
  const def = definitionFor(cfg.code);
  const c = def.construction;
  const { W, H } = cfg.dims;
  const top = headerHeight(cfg.code, cfg.options);
  const bottom = c.bottomFold ? 0 : c.seals.bottom;
  const side = c.seals.side;
  const Wi = W - 2 * side;
  const Hi = H - top - bottom;
  const bMax = Math.min(0.45 * Wi, 0.45 * Hi, (cfg.fill * c.maxThicknessRatio * Math.min(Wi, Hi)) / 2);
  const p = c.endExponent;
  const env = (t: number) => {
    const lowT = c.bottomFold ? 0.3 : 0.5;
    const lowP = c.bottomFold ? p * 0.5 : p;
    const lo = Math.pow(Math.sin((Math.PI / 2) * clamp01(t / lowT)), lowP);
    const hi = Math.pow(Math.sin((Math.PI / 2) * clamp01((1 - t) / 0.5)), p);
    return lo * hi;
  };
  const dl = Hi / ROWS;
  const { u, Y } = arcRows((t) => bMax * env(t), Hi, ROWS);
  const rows: ShapeRow[] = u.map((t, i) => {
    const b = bMax * env(t);
    const curve = b < 1e-6 ? sampleCurve(Wi / 2, () => 0) : solveHalfWidth(Wi, () => lens(b, c.sectionExponent));
    const front = resample(curve, COLS, side);
    return { y: bottom + Y * t, tFlat: H - bottom - i * dl, strips: [{ panel: "front", pts: front }, { panel: "back", pts: mirrorBack(front) }] };
  });
  return finish(cfg, "pillow", rows, { top, bottom, side }, undefined, c.orientation === "horizontal");
}
function standup(cfg: FlexConfig): FlexShape {
  const def = definitionFor(cfg.code);
  const c = def.construction;
  const { W, H } = cfg.dims;
  const G = cfg.dims.G ?? def.defaultDims.G ?? W * 0.5;
  const top = headerHeight(cfg.code, cfg.options);
  const side = c.seals.side;
  const Wi = W - 2 * side;
  const Hi = H - top;
  const fill = cfg.fill;
  const b0 = Math.min(0.48 * Wi, (G / 2) * (0.1 + 0.9 * fill));
  const tf = 0.35 + 0.55 * fill;
  const half = (t: number) => {
    const above = t < tf ? 1 : 1 - 0.65 * smooth(0, 1, (t - tf) / Math.max(1e-6, 1 - tf));
    return b0 * Math.pow(1 - t, 0.9) * (1 + (c.maxThicknessRatio + 0.05) * fill * Math.sin(Math.PI * t)) * above;
  };
  const dl = Hi / ROWS;
  const { u, Y } = arcRows(half, Hi, ROWS);
  const rows: ShapeRow[] = u.map((t, i) => {
    const b = half(t);
    // front and back meet at the side seals at an angle: an eye-shaped (pointed) lens, not an
    // ellipse, so the faces stay nearly full width down to the base like a real doypack
    const curve = b < 1e-6 ? sampleCurve(Wi / 2, () => 0) : solveHalfWidth(Wi, () => lens(b, STANDUP_LENS));
    const front = resample(curve, COLS, side);
    return { y: Y * t, tFlat: H - i * dl, strips: [{ panel: "front", pts: front }, { panel: "back", pts: mirrorBack(front) }] };
  });
  const a = rows[0].strips[0].pts[COLS].x;
  return finish(cfg, "standup", rows, { top, bottom: 0, side }, { kind: "oval", a, b: half(0), n: STANDUP_LENS }, false);
}

function box(cfg: FlexConfig): FlexShape {
  const def = definitionFor(cfg.code);
  const c = def.construction;
  const { W, H } = cfg.dims;
  const G = cfg.dims.G ?? def.defaultDims.G ?? W * 0.6;
  const top = headerHeight(cfg.code, cfg.options);
  /** Side-gusset bags fold the bottom G/2 of each face into the block base. */
  const foldBase = c.backFin > 0 && c.cornerFins === 0 ? G / 2 : 0;
  const Hb = H - foldBase - top;
  const Lc = Math.min((G / 2) * 1.3, 0.45 * Hb);
  const uStart = (1 - Lc / Hb) * (0.5 + 0.5 * cfg.fill);
  const cAt = (u: number) => (u <= uStart ? G / 2 : (G / 2) * Math.cos((Math.PI / 2) * clamp01((u - uStart) / Math.max(1e-6, 1 - uStart))));
  const bAt = (u: number) => cfg.fill * c.maxThicknessRatio * W * Math.pow(Math.sin(Math.PI * clamp01(u)), 0.5) * (cAt(u) / (G / 2));
  const dl = Hb / ROWS;
  const { u: us, Y } = arcRows((u) => cAt(u) + bAt(u), Hb, ROWS);
  const items = us.map((u) => {
    const cz = cAt(u);
    const b = bAt(u);
    const zf = (x: number) => cz + b * (1 - x * x);
    const curve = b < 1e-6 ? sampleCurve(W / 2, zf) : solveHalfWidth(W, () => zf);
    return { curve, cz, b, y: Y * u };
  });
  const gussetCols = 12;
  const rows: ShapeRow[] = items.map((it, i) => {
    const front = resample(it.curve, COLS, 0);
    const a = front[front.length - 1].x;
    const cz = it.cz;
    const d = Math.sqrt(Math.max(0, (G / 2) ** 2 - cz * cz));
    const gusset = (sign: 1 | -1): RowPoint[] => {
      // right gusset seen from +x runs z = +c -> -c (viewer-left is +z); left gusset runs -c -> +c
      const pts: RowPoint[] = [];
      for (let k = 0; k <= gussetCols; k++) {
        const s = (G * k) / gussetCols;
        const h = s <= G / 2 ? s / (G / 2) : (s - G / 2) / (G / 2);
        let x: number;
        let z: number;
        if (s <= G / 2) {
          x = a - d * h;
          z = cz * (1 - h);
        } else {
          x = a - d * (1 - h);
          z = -cz * h;
        }
        pts.push({ x: sign * x, z: sign * z, s });
      }
      return pts;
    };
    return {
      y: it.y,
      tFlat: H - foldBase - i * dl,
      strips: [
        { panel: "front", pts: front },
        { panel: "gussetRight", pts: gusset(1) },
        { panel: "back", pts: mirrorBack(front) },
        { panel: "gussetLeft", pts: gusset(-1) },
      ],
    };
  });
  const a = rows[0].strips[0].pts[COLS].x;
  return finish(cfg, "box", rows, { top, bottom: 0, side: 0 }, { kind: "rect", a, c: items[0].cz }, false);
}

function sleeve(cfg: FlexConfig): FlexShape {
  const { W, H } = cfg.dims;
  const C = 2 * W;
  const R0 = C / (2 * Math.PI);
  const rAt = (t: number) => R0 * (1 - cfg.fill * SLEEVE_MAX_SHRINK * smooth(0.62, 0.97, t) - cfg.fill * 0.02 * (1 - smooth(0, 0.05, t)));
  const dl = H / ROWS;
  const { u, Y } = arcRows(rAt, H, ROWS);
  const cols = 64;
  const rows: ShapeRow[] = u.map((t, i) => {
    const r = rAt(t);
    const pts: RowPoint[] = [];
    for (let j = 0; j <= cols; j++) {
      const phi = -Math.PI + (2 * Math.PI * j) / cols;
      pts.push({ x: r * Math.sin(phi), z: r * Math.cos(phi), s: (C * j) / cols });
    }
    return { y: Y * t, tFlat: H - i * dl, strips: [{ panel: "sleeve", pts }] };
  });
  return finish(cfg, "sleeve", rows, { top: 0, bottom: 0, side: 0 }, undefined, false);
}

function finish(
  cfg: FlexConfig,
  model: FlexShape["model"],
  rows: ShapeRow[],
  seals: FlexShape["seals"],
  base: FlexShape["base"],
  horizontal: boolean,
): FlexShape {
  const bodyTopY = rows[rows.length - 1].y;
  const topY = bodyTopY + seals.top;
  let vol = 0;
  for (let i = 1; i < rows.length; i++) vol += ((rowArea(rows[i]) + rowArea(rows[i - 1])) / 2) * (rows[i].y - rows[i - 1].y);
  let minX = -cfg.dims.W / 2;
  let maxX = cfg.dims.W / 2;
  let minZ = 0;
  let maxZ = 0;
  for (const r of rows)
    for (const s of r.strips)
      for (const p of s.pts) {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minZ = Math.min(minZ, p.z);
        maxZ = Math.max(maxZ, p.z);
      }
  if (model === "sleeve" || model === "box") {
    // tubes and boxes are not wider than their body
    minX = Infinity;
    maxX = -Infinity;
    for (const r of rows)
      for (const s of r.strips)
        for (const p of s.pts) {
          minX = Math.min(minX, p.x);
          maxX = Math.max(maxX, p.x);
        }
    if (model === "box") {
      minX = Math.min(minX, -cfg.dims.W / 2);
      maxX = Math.max(maxX, cfg.dims.W / 2);
    }
  }
  const def = definitionFor(cfg.code);
  const fin = def.construction.cornerFins * Math.SQRT1_2;
  const width = maxX - minX + 2 * fin;
  const depth = maxZ - minZ + 2 * fin;
  return {
    config: cfg,
    model,
    rows,
    faceW: cfg.dims.W,
    faceH: cfg.dims.H,
    seals,
    bodyBottomY: rows[0].y,
    bodyTopY,
    topY,
    base,
    volumeMl: vol / 1000,
    envelope: horizontal ? { width: topY, depth, height: width } : { width, depth, height: topY },
    horizontal,
  };
}

/** Solve the filled shape of a configured pack. */
export function solveShape(cfg: FlexConfig): FlexShape {
  switch (definitionFor(cfg.code).construction.model) {
    case "pillow":
      return pillow(cfg);
    case "standup":
      return standup(cfg);
    case "box":
      return box(cfg);
    case "sleeve":
      return sleeve(cfg);
  }
}

/**
 * Display transform: horizontal packs (flow wrap) are turned -90° about Z so the long axis runs
 * along X (top seal at +X) and the pack rests on its left edge. A rotation, so windings survive.
 */
export function orient(shape: FlexShape, p: [number, number, number]): [number, number, number] {
  if (!shape.horizontal) return p;
  return [p[1] - shape.topY / 2, -p[0] + shape.faceW / 2, p[2]];
}

/** Arc length of a strip (mm). */
export function stripLength(strip: PanelStrip): number {
  let L = 0;
  for (let i = 1; i < strip.pts.length; i++) L += Math.hypot(strip.pts[i].x - strip.pts[i - 1].x, strip.pts[i].z - strip.pts[i - 1].z);
  return L;
}

/**
 * Surface point of a panel at flat coordinates (s across from the panel's left, tFlat down from
 * the top trim edge), interpolated between rows. Returns null outside the body rows.
 */
export function panelPoint(shape: FlexShape, panel: FlexPanelId, s: number, tFlat: number): { p: [number, number, number]; n: [number, number, number] } | null {
  const rows = shape.rows;
  // rows are ordered bottom->top, tFlat decreases with the index
  if (tFlat > rows[0].tFlat + 1e-6 || tFlat < rows[rows.length - 1].tFlat - 1e-6) return null;
  let i = 0;
  while (i < rows.length - 2 && rows[i + 1].tFlat > tFlat) i++;
  const r0 = rows[i];
  const r1 = rows[i + 1];
  const f = clamp01((r0.tFlat - tFlat) / Math.max(1e-9, r0.tFlat - r1.tFlat));
  const at = (row: ShapeRow) => {
    const st = row.strips.find((x) => x.panel === panel);
    if (!st) return null;
    const pts = st.pts;
    let k = 0;
    while (k < pts.length - 2 && pts[k + 1].s < s) k++;
    const g = clamp01((s - pts[k].s) / Math.max(1e-9, pts[k + 1].s - pts[k].s));
    const extra = s < pts[0].s ? s - pts[0].s : s > pts[pts.length - 1].s ? s - pts[pts.length - 1].s : 0;
    const dx = pts[k + 1].x - pts[k].x;
    const dz = pts[k + 1].z - pts[k].z;
    const dlen = Math.hypot(dx, dz) || 1;
    return { x: pts[k].x + dx * g + (dx / dlen) * extra, z: pts[k].z + dz * g + (dz / dlen) * extra, tx: dx / dlen, tz: dz / dlen };
  };
  const a = at(r0);
  const b = at(r1);
  if (!a || !b) return null;
  const x = a.x + (b.x - a.x) * f;
  const z = a.z + (b.z - a.z) * f;
  const y = r0.y + (r1.y - r0.y) * f;
  // outward normal: the across tangent (tx, 0, tz) rotated about Y -> (-tz, 0, tx)
  const tx = a.tx + (b.tx - a.tx) * f;
  const tz = a.tz + (b.tz - a.tz) * f;
  const l = Math.hypot(tx, tz) || 1;
  return { p: [x, y, z], n: [-tz / l, 0, tx / l] };
}
