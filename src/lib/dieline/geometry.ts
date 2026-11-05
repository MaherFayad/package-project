import type { Polygon, Pt, Rect, Segment } from "./types";

export const EPS = 1e-6;

export const pt = (x: number, y: number): Pt => ({ x, y });
export const add = (a: Pt, b: Pt): Pt => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Pt, s: number): Pt => ({ x: a.x * s, y: a.y * s });
export const dot = (a: Pt, b: Pt): number => a.x * b.x + a.y * b.y;
export const cross = (a: Pt, b: Pt): number => a.x * b.y - a.y * b.x;
export const len = (a: Pt): number => Math.hypot(a.x, a.y);
export const dist = (a: Pt, b: Pt): number => len(sub(a, b));
export const norm = (a: Pt): Pt => {
  const l = len(a);
  return l < EPS ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l };
};
export const lerpPt = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

export function rectPolygon(x: number, y: number, w: number, h: number): Polygon {
  return [pt(x, y), pt(x + w, y), pt(x + w, y + h), pt(x, y + h)];
}

export function bboxOf(points: Pt[]): Rect {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Signed area (positive when vertices run clockwise on screen, i.e. y-down CCW math). */
export function signedArea(poly: Polygon): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}

export const polygonArea = (poly: Polygon): number => Math.abs(signedArea(poly));

export function centroid(poly: Polygon): Pt {
  let x = 0;
  let y = 0;
  for (const p of poly) {
    x += p.x;
    y += p.y;
  }
  return { x: x / poly.length, y: y / poly.length };
}

export function edgesOf(poly: Polygon): Segment[] {
  return poly.map((a, i) => ({ a, b: poly[(i + 1) % poly.length] }));
}

export const segLength = (s: Segment): number => dist(s.a, s.b);

/** Parameter (0..1 along s) of the projection of p onto the line through s. */
function paramOn(s: Segment, p: Pt): number {
  const d = sub(s.b, s.a);
  const l2 = dot(d, d);
  return l2 < EPS ? 0 : dot(sub(p, s.a), d) / l2;
}

function distToLine(s: Segment, p: Pt): number {
  const d = sub(s.b, s.a);
  const l = len(d);
  return l < EPS ? dist(p, s.a) : Math.abs(cross(d, sub(p, s.a))) / l;
}

export function collinear(s: Segment, o: Segment, tol = 1e-3): boolean {
  return distToLine(s, o.a) < tol && distToLine(s, o.b) < tol;
}

/** Remove from `s` every part that overlaps one of the collinear segments in `cutters`. */
export function subtractSegments(s: Segment, cutters: Segment[], tol = 1e-3): Segment[] {
  const length = segLength(s);
  if (length < tol) return [];
  let intervals: [number, number][] = [[0, 1]];
  for (const c of cutters) {
    if (!collinear(s, c, tol)) continue;
    let t0 = paramOn(s, c.a);
    let t1 = paramOn(s, c.b);
    if (t0 > t1) [t0, t1] = [t1, t0];
    const next: [number, number][] = [];
    for (const [a, b] of intervals) {
      if (t1 <= a || t0 >= b) {
        next.push([a, b]);
        continue;
      }
      if (t0 > a) next.push([a, t0]);
      if (t1 < b) next.push([t1, b]);
    }
    intervals = next;
  }
  const minT = tol / length;
  return intervals
    .filter(([a, b]) => b - a > minT)
    .map(([a, b]) => ({ a: lerpPt(s.a, s.b, a), b: lerpPt(s.a, s.b, b) }));
}

/** Fraction (0..1) of `s` covered by collinear segments in `cover`. */
export function coveredFraction(s: Segment, cover: Segment[], tol = 1e-3): number {
  const rest = subtractSegments(s, cover, tol);
  const l = segLength(s);
  if (l < EPS) return 1;
  return 1 - rest.reduce((acc, r) => acc + segLength(r), 0) / l;
}

function lineIntersection(p1: Pt, d1: Pt, p2: Pt, d2: Pt): Pt | null {
  const den = cross(d1, d2);
  if (Math.abs(den) < 1e-9) return null;
  const t = cross(sub(p2, p1), d2) / den;
  return add(p1, scale(d1, t));
}

/**
 * Offset a convex polygon outward, each edge by its own distance (0 keeps the edge).
 * Used to grow panels by the bleed on cut edges only.
 */
export function offsetConvex(poly: Polygon, distances: number[]): Polygon {
  const orient = signedArea(poly) >= 0 ? 1 : -1;
  const n = poly.length;
  const lines = poly.map((a, i) => {
    const b = poly[(i + 1) % n];
    const d = norm(sub(b, a));
    // outward normal: for clockwise-on-screen (positive signedArea) polygons, (d.y, -d.x)
    const out = orient > 0 ? pt(d.y, -d.x) : pt(-d.y, d.x);
    return { p: add(a, scale(out, distances[i] ?? 0)), d };
  });
  const result: Polygon = [];
  for (let i = 0; i < n; i++) {
    const prev = lines[(i - 1 + n) % n];
    const cur = lines[i];
    const hit = lineIntersection(prev.p, prev.d, cur.p, cur.d);
    result.push(hit ?? cur.p);
  }
  return result;
}

export function insetRect(r: Rect, by: number): Rect {
  const w = Math.max(0, r.width - 2 * by);
  const h = Math.max(0, r.height - 2 * by);
  return { x: r.x + (r.width - w) / 2, y: r.y + (r.height - h) / 2, width: w, height: h };
}

export const round = (v: number, digits = 3): number => {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
};

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
