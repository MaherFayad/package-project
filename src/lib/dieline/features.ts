import type { FaceId, StructureCode, StructureFeatures } from "@/types";
import type { DielineBuilder } from "./builder";
import { bboxOf, centroid, clamp, dist, norm, pt, sub } from "./geometry";
import type { DielinePanel, Polygon, Pt, Rect, Segment } from "./types";

/**
 * Optional construction features (window, thumb notch, handle, tear strip, dividers…):
 * which structure supports which, and the cut geometry shared by the generators.
 */
export type FeatureKey = keyof StructureFeatures;

export interface FeatureSupport {
  /** Faces that can carry a die-cut window. Empty = no window. */
  windowFaces: FaceId[];
  thumbNotch: boolean;
  handle: boolean;
  tearStrip: boolean;
  partitions: boolean;
  /** Two-piece boxes: the lid depth can be chosen. */
  lidHeight: boolean;
  displayFront: boolean;
}

const NONE: FeatureSupport = {
  windowFaces: [],
  thumbNotch: false,
  handle: false,
  tearStrip: false,
  partitions: false,
  lidHeight: false,
  displayFront: false,
};

export const FEATURE_SUPPORT: Record<StructureCode, FeatureSupport> = {
  FEFCO_0427: { ...NONE, windowFaces: ["top"], tearStrip: true, partitions: true },
  FEFCO_0201: { ...NONE, handle: true, tearStrip: true, partitions: true },
  ECMA_RTE: { ...NONE, windowFaces: ["front", "back"], thumbNotch: true },
  ECMA_STE: { ...NONE, windowFaces: ["front", "back"], thumbNotch: true },
  PIZZA: { ...NONE, windowFaces: ["top"] },
  SLEEVE: { ...NONE, windowFaces: ["front", "top"] },
  FEFCO_0320: { ...NONE, thumbNotch: true, partitions: true, lidHeight: true, handle: true },
  ECMA_CLB: { ...NONE, windowFaces: ["front", "back"], thumbNotch: true },
  ECMA_SLB: { ...NONE, windowFaces: ["front", "back"], thumbNotch: true },
  FEFCO_0422: { ...NONE, thumbNotch: true, partitions: true, displayFront: true, handle: true },
  GABLE_BOX: { ...NONE, windowFaces: ["front", "back"], handle: true },
  PAPER_TUBE: { ...NONE, lidHeight: true },
  RIGID_BOX: { ...NONE, windowFaces: ["top"], thumbNotch: true, partitions: true, lidHeight: true },
  ROLL_LABEL: NONE,
  PRINTED_POUCH: NONE,
  PRINTED_TUBE: NONE,
};

/** Features on by default (the structure is not itself without them). */
export const DEFAULT_FEATURES: Partial<Record<StructureCode, StructureFeatures>> = {
  GABLE_BOX: { handle: true },
};

export const MAX_PARTITION_CELLS = 6;

/** Drop what the structure cannot make; clamp the rest. */
export function supportedFeatures(code: StructureCode, requested: StructureFeatures | undefined): StructureFeatures {
  const s = FEATURE_SUPPORT[code];
  const f = { ...DEFAULT_FEATURES[code], ...requested };
  const out: StructureFeatures = {};
  if (f.window && s.windowFaces.includes(f.window.face)) {
    out.window = {
      face: f.window.face,
      widthRatio: clamp(Number(f.window.widthRatio ?? 0.55) || 0.55, 0.15, 0.8),
      heightRatio: clamp(Number(f.window.heightRatio ?? 0.45) || 0.45, 0.15, 0.8),
      film: f.window.film !== false,
    };
  }
  if (f.thumbNotch && s.thumbNotch && !(f.displayFront && s.displayFront)) out.thumbNotch = true;
  if (f.handle && s.handle) out.handle = true;
  if (f.tearStrip && s.tearStrip) out.tearStrip = true;
  if (f.partitions && s.partitions) {
    const rows = clamp(Math.round(f.partitions.rows) || 1, 1, MAX_PARTITION_CELLS);
    const cols = clamp(Math.round(f.partitions.cols) || 1, 1, MAX_PARTITION_CELLS);
    if (rows > 1 || cols > 1) out.partitions = { rows, cols };
  }
  if (s.lidHeight && typeof f.lidHeightMm === "number" && Number.isFinite(f.lidHeightMm) && f.lidHeightMm > 0) out.lidHeightMm = f.lidHeightMm;
  if (f.displayFront && s.displayFront) out.displayFront = true;
  return out;
}

/* ───────────────────────── cut shapes ───────────────────────── */

/** Rounded rectangle centred at (cx, cy), corners approximated with `seg` segments. */
export function roundedRect(cx: number, cy: number, w: number, h: number, r: number, seg = 4): Polygon {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  const out: Polygon = [];
  const corners: [number, number, number][] = [
    [cx + w / 2 - rr, cy - h / 2 + rr, -Math.PI / 2],
    [cx + w / 2 - rr, cy + h / 2 - rr, 0],
    [cx - w / 2 + rr, cy + h / 2 - rr, Math.PI / 2],
    [cx - w / 2 + rr, cy - h / 2 + rr, Math.PI],
  ];
  for (const [x, y, a0] of corners) {
    if (rr < 0.01) {
      out.push(pt(x, y));
      continue;
    }
    for (let i = 0; i <= seg; i++) {
      const a = a0 + (i / seg) * (Math.PI / 2);
      out.push(pt(x + Math.cos(a) * rr, y + Math.sin(a) * rr));
    }
  }
  // Stadiums (r = h / 2) make neighbouring arcs share an end point: drop duplicates.
  return out.filter((q, i) => {
    const prev = out[(i - 1 + out.length) % out.length];
    return Math.hypot(q.x - prev.x, q.y - prev.y) > 1e-6;
  });
}

/** Hand-hole: a stadium (rounded slot) centred at (cx, cy). */
export function stadium(cx: number, cy: number, w: number, h: number, horizontal = true): Polygon {
  return horizontal ? roundedRect(cx, cy, w, h, h / 2, 6) : roundedRect(cx, cy, w, h, w / 2, 6);
}

const near = (a: Pt, b: Pt, tol = 1e-3) => dist(a, b) < tol;

/**
 * Cut a half-round finger notch into a panel edge (the edge from `a` to `b` must be one of
 * its outline edges and must be a cut, not a crease). The notch is centred on the edge.
 */
export function notchPanel(panel: DielinePanel, [a, b]: [Pt, Pt], radius: number, seg = 10): boolean {
  const poly = panel.polygon;
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % n];
    const forward = near(p, a) && near(q, b);
    const backward = near(p, b) && near(q, a);
    if (!forward && !backward) continue;
    const len = dist(p, q);
    const r = Math.min(radius, len * 0.35);
    if (r < 2) return false;
    const d = norm(sub(q, p));
    const c = centroid(poly);
    let inward = pt(-d.y, d.x);
    const mid = pt((p.x + q.x) / 2, (p.y + q.y) / 2);
    if (inward.x * (c.x - mid.x) + inward.y * (c.y - mid.y) < 0) inward = pt(-inward.x, -inward.y);
    const arc: Pt[] = [];
    for (let k = 0; k <= seg; k++) {
      const ang = Math.PI - (k / seg) * Math.PI; // from -d side to +d side
      const along = Math.cos(ang) * r;
      const into = Math.sin(ang) * r;
      arc.push(pt(mid.x + d.x * along + inward.x * into, mid.y + d.y * along + inward.y * into));
    }
    panel.polygon = [...poly.slice(0, i + 1), ...arc, ...poly.slice(i + 1)];
    panel.bbox = bboxOf(panel.polygon);
    return true;
  }
  return false;
}

/** Window: rounded aperture centred in an (axis-aligned) panel, with an optional film patch. */
export function cutWindow(b: DielineBuilder, panelId: string, win: NonNullable<StructureFeatures["window"]>, opts: { margin?: number } = {}) {
  const panel = b.byId(panelId);
  const box = panel.bbox;
  const margin = opts.margin ?? 8;
  const w = Math.max(10, Math.min(box.width * (win.widthRatio ?? 0.55), box.width - 2 * margin));
  const h = Math.max(10, Math.min(box.height * (win.heightRatio ?? 0.45), box.height - 2 * margin));
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const hole = roundedRect(cx, cy, w, h, Math.min(6, w * 0.15, h * 0.15));
  panel.holes = [...(panel.holes ?? []), hole];
  if (win.film !== false) {
    const grow = Math.min(10, margin - 1);
    const fw = Math.min(w + 2 * grow, box.width - 2);
    const fh = Math.min(h + 2 * grow, box.height - 2);
    b.films.push({ panelId, polygon: roundedRect(cx, cy, fw, fh, 0, 1) });
  }
}

/** Two parallel perforations `gap` mm apart, `offset` mm from segment `edge`, toward `toward`. */
export function tearStripLines(edge: Segment, toward: Pt, offset: number, gap = 8, trim = 2): Segment[] {
  const d = norm(sub(edge.b, edge.a));
  let nrm = pt(-d.y, d.x);
  const mid = pt((edge.a.x + edge.b.x) / 2, (edge.a.y + edge.b.y) / 2);
  if (nrm.x * (toward.x - mid.x) + nrm.y * (toward.y - mid.y) < 0) nrm = pt(-nrm.x, -nrm.y);
  const line = (o: number): Segment => ({
    a: pt(edge.a.x + d.x * trim + nrm.x * o, edge.a.y + d.y * trim + nrm.y * o),
    b: pt(edge.b.x - d.x * trim + nrm.x * o, edge.b.y - d.y * trim + nrm.y * o),
  });
  return [line(offset), line(offset + gap)];
}

/** Horizontal tear band across axis-aligned wall panels, `fromTop` mm below their top edge. */
export function tearBand(b: DielineBuilder, panelIds: string[], fromTop: number, gap = 8) {
  for (const id of panelIds) {
    const r: Rect = b.byId(id).bbox;
    const y = r.y + Math.min(fromTop, r.height * 0.6);
    for (const yy of [y, y + gap]) b.perfLines.push({ a: pt(r.x + 1, yy), b: pt(r.x + r.width - 1, yy) });
  }
}
