import type { Mm } from "@/types";
import type { BottleSection, CrossSection } from "./types";

/**
 * Exact cross-section math for round, rounded-rectangle (incl. stadium / oval) and rounded
 * regular-polygon sections. Half width `a` is the profile radius: half the width for a rect,
 * the apothem (half across flats) for a polygon.
 *
 * Squareness s (0..1) blends the section towards a circle of the same half width: the corner
 * ratio and depth ratio move to 1, and a rounded rect / polygon with c = a IS that circle. So a
 * flask's oval body melts into its round neck with no jump in area or girth.
 */

interface Effective {
  /** Face normals (angle from +Z towards +X) and apothems. */
  normals: number[];
  apothems: Mm[];
  c: Mm;
}

const TAU = 2 * Math.PI;

function effective(sec: BottleSection, a: Mm, s: number): Effective | null {
  if (sec.kind === "round" || a <= 0) return null;
  const k = Math.min(1, Math.max(0, s));
  if (sec.kind === "rect") {
    const depth = 1 - (1 - sec.depthRatio) * k;
    const corner = 1 - (1 - sec.cornerRatio) * k;
    const c = Math.min(a * corner, a, a * depth);
    // normals: front (+Z), right (+X), back, left
    return { normals: [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2], apothems: [a * depth, a, a * depth, a], c };
  }
  const n = sec.sides;
  const corner = 1 - (1 - sec.cornerRatio) * k;
  const c = Math.min(a, a * corner);
  const normals = Array.from({ length: n }, (_, i) => (i * TAU) / n);
  return { normals, apothems: normals.map(() => a), c };
}

/** Cross-section area (mm²). */
export function bottleSectionArea(sec: BottleSection, a: Mm, s = 1): number {
  if (a <= 0) return 0;
  const e = effective(sec, a, s);
  if (!e) return Math.PI * a * a;
  if (sec.kind === "rect") {
    const w = 2 * e.apothems[1];
    const d = 2 * e.apothems[0];
    return w * d - (4 - Math.PI) * e.c * e.c;
  }
  const n = e.normals.length;
  const t = Math.tan(Math.PI / n);
  return n * a * a * t - e.c * e.c * (n * t - Math.PI);
}

/** Girth (perimeter) of the section (mm). */
export function bottleSectionPerimeter(sec: BottleSection, a: Mm, s = 1): Mm {
  if (a <= 0) return 0;
  const e = effective(sec, a, s);
  if (!e) return TAU * a;
  if (sec.kind === "rect") {
    const w = 2 * e.apothems[1];
    const d = 2 * e.apothems[0];
    return 2 * (w + d) - (8 - TAU) * e.c;
  }
  const n = e.normals.length;
  const t = Math.tan(Math.PI / n);
  return 2 * n * a * t - 2 * e.c * (n * t - Math.PI);
}

/** Depth (front to back, along Z) of the section, mm. */
export function bottleSectionDepth(sec: BottleSection, a: Mm, s = 1): Mm {
  const e = effective(sec, a, s);
  if (!e) return 2 * a;
  if (sec.kind === "rect") return 2 * e.apothems[0];
  // polygon with a flat face at the front: depth = 2 apothem if n is even
  return e.normals.length % 2 === 0 ? 2 * a : a + (a - e.c) / Math.cos(Math.PI / e.normals.length) + e.c;
}

interface Piece {
  len: number;
  at: (d: number) => { x: Mm; z: Mm };
}

/** Walk the outline: start at the centre of the front face (+Z), go towards +X. */
function pieces(e: Effective): Piece[] {
  const n = e.normals.length;
  const N = (i: number) => e.normals[((i % n) + n) % n];
  const P = (i: number) => e.apothems[((i % n) + n) % n];
  const nrm = (th: number) => ({ x: Math.sin(th), z: Math.cos(th) });
  // corner centre between face i and i+1: intersection of offset lines n_i . x = p_i - c
  const corner = (i: number) => {
    const a = nrm(N(i));
    const b = nrm(N(i + 1));
    const pa = P(i) - e.c;
    const pb = P(i + 1) - e.c;
    const det = a.x * b.z - a.z * b.x;
    return { x: (pa * b.z - pb * a.z) / det, z: (a.x * pb - b.x * pa) / det };
  };
  const out: Piece[] = [];
  for (let i = 0; i < n; i++) {
    const nm = nrm(N(i));
    const tangent = { x: nm.z, z: -nm.x }; // clockwise seen from above = towards +X from the front
    const cPrev = corner(i - 1);
    const cNext = corner(i);
    const start = { x: cPrev.x + e.c * nm.x, z: cPrev.z + e.c * nm.z };
    const end = { x: cNext.x + e.c * nm.x, z: cNext.z + e.c * nm.z };
    const len = Math.hypot(end.x - start.x, end.z - start.z);
    out.push({ len, at: (d) => ({ x: start.x + tangent.x * d, z: start.z + tangent.z * d }) });
    const th0 = N(i);
    let dth = N(i + 1) - th0;
    if (dth <= 0) dth += TAU;
    out.push({ len: e.c * dth, at: (d) => ({ x: cNext.x + e.c * Math.sin(th0 + d / Math.max(e.c, 1e-9)), z: cNext.z + e.c * Math.cos(th0 + d / Math.max(e.c, 1e-9)) }) });
  }
  // rotate the list so it starts at the middle of face 0
  const first = out[0];
  const half = first.len / 2;
  return [{ len: first.len - half, at: (d) => first.at(half + d) }, ...out.slice(1), { len: half, at: (d) => first.at(d) }];
}

/**
 * Point on the section outline at arc length u from the front centre (wraps around). This is
 * the developed (unrolled) coordinate prism labels use, so flat artwork lands undistorted.
 */
export function sectionPointAtArc(sec: BottleSection, a: Mm, u: Mm, s = 1): { x: Mm; z: Mm } {
  const e = effective(sec, a, s);
  if (!e) {
    const phi = u / a;
    return { x: a * Math.sin(phi), z: a * Math.cos(phi) };
  }
  const list = pieces(e);
  const total = list.reduce((t, p) => t + p.len, 0);
  let d = ((u % total) + total) % total;
  for (const p of list) {
    if (d <= p.len + 1e-9) return p.at(Math.min(d, p.len));
    d -= p.len;
  }
  return list[list.length - 1].at(list[list.length - 1].len);
}

/** Width of the flat part of the front face (0 for round). */
export function frontFlatWidth(sec: BottleSection, a: Mm): Mm {
  const e = effective(sec, a, 1);
  if (!e) return 0;
  return pieces(e)[0].len * 2;
}

/** The core CrossSection the renderer draws (rounded rect, rounded polygon or round). */
export function coreSectionFor(sec: BottleSection): CrossSection {
  if (sec.kind === "rect") return { kind: "roundedRect", cornerRatio: sec.cornerRatio, depthRatio: sec.depthRatio };
  if (sec.kind === "polygon") return { kind: "polygon", sides: sec.sides, cornerRatio: sec.cornerRatio };
  return { kind: "round" };
}
