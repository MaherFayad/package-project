import { FACE_IDS, type ArtworkLayer, type FaceId, type PrintSurface } from "@/types";
import { faceTransform, partRect, type DielineModel } from "@/lib/dieline";

export interface P {
  x: number;
  y: number;
}

/** Corners of a layer's (rotated) box in face-local mm: TL, TR, BR, BL (before rotation). */
export function layerQuad(l: Pick<ArtworkLayer, "x" | "y" | "width" | "height" | "rotation">): P[] {
  const r = (l.rotation * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  const hw = l.width / 2;
  const hh = l.height / 2;
  return [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ].map(([u, v]) => ({ x: l.x + u * c - v * s, y: l.y + u * s + v * c }));
}

export function bboxOf(points: P[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
}

function project(poly: P[], ax: P) {
  let min = Infinity;
  let max = -Infinity;
  for (const p of poly) {
    const d = p.x * ax.x + p.y * ax.y;
    min = Math.min(min, d);
    max = Math.max(max, d);
  }
  return { min, max };
}

function axesOf(poly: P[]): P[] {
  const out: P[] = [];
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const len = Math.hypot(ex, ey);
    if (len < 1e-9) continue;
    out.push({ x: -ey / len, y: ex / len });
  }
  // A segment (2 points) also needs its own direction as an axis.
  if (n === 2) {
    const ex = poly[1].x - poly[0].x;
    const ey = poly[1].y - poly[0].y;
    const len = Math.hypot(ex, ey);
    if (len > 1e-9) out.push({ x: ex / len, y: ey / len });
  }
  return out;
}

/**
 * Separating-axis test for two convex shapes (polygons or a 2-point segment).
 * Returns true only when they overlap by more than `eps` mm (touching edges do not count).
 */
export function convexOverlap(a: P[], b: P[], eps = 0.5): boolean {
  if (a.length < 2 || b.length < 2) return false;
  for (const ax of [...axesOf(a), ...axesOf(b)]) {
    const pa = project(a, ax);
    const pb = project(b, ax);
    // Penetration depth: works for a degenerate (segment) projection too.
    const overlap = Math.min(pa.max - pb.min, pb.max - pa.min);
    if (overlap <= eps) return false;
  }
  return true;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export type Placement = "center" | "top" | "bottom" | "topStart" | "topEnd" | "fill";

/**
 * Quick logo placement inside a face's safe zone (single-pointer alternative to dragging).
 * "topStart"/"topEnd" are the face's left/right as seen from outside (never mirrored).
 */
export function placeLayer<T extends ArtworkLayer>(layer: T, face: { width: number; height: number }, where: Placement, safeMm: number): T {
  const s = safeMm;
  if (where === "fill") {
    const availW = Math.max(1, face.width - 2 * s);
    const availH = Math.max(1, face.height - 2 * s);
    const aspect = layer.width / layer.height;
    let w = availW;
    let h = w / aspect;
    if (h > availH) {
      h = availH;
      w = h * aspect;
    }
    const next = { ...layer, x: face.width / 2, y: face.height / 2, width: w, height: h, rotation: 0 };
    if (next.kind === "text") (next as T & { fontSizePt: number }).fontSizePt = Math.max(4, Math.round((layer as unknown as { fontSizePt: number }).fontSizePt * (w / layer.width) * 10) / 10);
    return next;
  }
  const b = bboxOf(layerQuad(layer));
  const hw = (b.maxX - b.minX) / 2;
  const hh = (b.maxY - b.minY) / 2;
  const left = s + hw;
  const right = face.width - s - hw;
  const top = s + hh;
  const bottom = face.height - s - hh;
  const cx = face.width / 2;
  const cy = face.height / 2;
  const pos: Record<Exclude<Placement, "fill">, P> = {
    center: { x: cx, y: cy },
    top: { x: cx, y: top },
    bottom: { x: cx, y: bottom },
    topStart: { x: left, y: top },
    topEnd: { x: right, y: top },
  };
  const p = pos[where];
  // When the item is bigger than the safe zone, fall back to the centre on that axis.
  return { ...layer, x: left > right ? cx : p.x, y: top > bottom ? cy : p.y };
}

/** Scale a layer about its centre (text scales its font size too). */
export function scaleLayer<T extends ArtworkLayer>(layer: T, factor: number): T {
  const f = clamp(factor, 0.05, 20);
  const w = clamp(layer.width * f, 1, 5000);
  const real = w / layer.width;
  const next = { ...layer, width: w, height: clamp(layer.height * real, 1, 5000) };
  if (next.kind === "text") (next as unknown as { fontSizePt: number }).fontSizePt = clamp(Math.round(next.fontSizePt * real * 10) / 10, 1, 400);
  return next;
}

/** Normalise an angle to (-180, 180]. */
export function normAngle(deg: number): number {
  let a = deg % 360;
  if (a <= -180) a += 360;
  if (a > 180) a -= 360;
  return Math.round(a * 10) / 10;
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * The face (and the point on it, face-local mm) under a 3D pick: the face whose part on the hit
 * panel contains the sheet point. A panel that is not part of any face (a glue flap, a dust flap)
 * gives null.
 */
export function faceAtHit(model: DielineModel, hit: { panelId: string; surface: PrintSurface; sheet: { x: number; y: number } }): { face: FaceId; surface: PrintSurface; at: { x: number; y: number } } | null {
  let fallback: { face: FaceId; surface: PrintSurface; at: { x: number; y: number } } | null = null;
  for (const id of FACE_IDS) {
    const info = model.faces[id];
    if (!info) continue;
    for (const part of info.parts) {
      if (part.panelId !== hit.panelId) continue;
      const [a, b, c, d, e, f] = faceTransform(info, part, hit.surface);
      const det = a * d - b * c;
      if (Math.abs(det) < 1e-9) continue;
      const dx = hit.sheet.x - e;
      const dy = hit.sheet.y - f;
      const at = { x: (d * dx - c * dy) / det, y: (-b * dx + a * dy) / det };
      const r = partRect(info, part, hit.surface);
      const tol = 2;
      if (at.x >= r.x - tol && at.x <= r.x + r.width + tol && at.y >= r.y - tol && at.y <= r.y + r.height + tol) return { face: id, surface: hit.surface, at };
      fallback ??= { face: id, surface: hit.surface, at: { x: info.width / 2, y: info.height / 2 } };
    }
  }
  return fallback;
}
