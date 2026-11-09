import type { Affine } from "@/lib/dieline";
import { apply, type Geo } from "./match";
import { distanceTransform } from "./extract";

/**
 * Raster checks for the short list: the template drawn in the detected frame is compared with
 * the clean stroke mask (chamfer both ways, truncated) and the die silhouette (IoU), on the
 * coarse grid (long side about 400 px, q working px per cell).
 */

export interface ScoreGrid {
  w: number;
  h: number;
  /** Working px per grid px. */
  q: number;
  det: Uint8Array;
  detDT: Float32Array;
  detPts: number[];
  sil: Uint8Array | null;
  silArea: number;
  tau: number;
  /** Scratch for polygon fills (cell = gen when filled in the current pass). */
  stamp: Uint32Array;
  gen: number;
}

export function makeGrid(det: Uint8Array, sil: Uint8Array | null, w: number, h: number, q: number, dieSize: number): ScoreGrid {
  let silArea = 0;
  if (sil) for (let i = 0; i < sil.length; i++) silArea += sil[i];
  const detPts: number[] = [];
  for (let i = 0; i < det.length; i++) if (det[i]) detPts.push(i);
  return { w, h, q, det, detDT: distanceTransform(det, w, h), detPts, sil, silArea, tau: Math.max(1.5, (0.012 * dieSize) / q), stamp: new Uint32Array(w * h), gen: 0 };
}

export interface RasterScore {
  chamferModel: number;
  chamferImage: number;
  silhouette: number;
}

/** `T` maps die-local mm to working px. `cheap` skips the art-to-template chamfer (refinement). */
export function rasterScore(grid: ScoreGrid, geo: Geo, T: Affine, cheap = false): RasterScore {
  const { w, h, q, tau } = grid;
  const G: Affine = [T[0] / q, T[1] / q, T[2] / q, T[3] / q, T[4] / q, T[5] / q];
  const model = new Uint8Array(w * h);
  let cm = 0;
  let n = 0;
  for (const s of geo.segs) {
    const a = apply(G, s.ax, s.ay);
    const b = apply(G, s.bx, s.by);
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(1, Math.ceil(len));
    for (let i = 0; i <= steps; i++) {
      const x = Math.round(a.x + ((b.x - a.x) * i) / steps);
      const y = Math.round(a.y + ((b.y - a.y) * i) / steps);
      if (x < 0 || y < 0 || x >= w || y >= h) {
        cm += 1;
        n++;
        continue;
      }
      const p = y * w + x;
      model[p] = 1;
      cm += Math.min(1, grid.detDT[p] / tau);
      n++;
    }
  }
  let ci = grid.detPts.length;
  if (!cheap) {
    const mDT = distanceTransform(model, w, h);
    ci = 0;
    for (const p of grid.detPts) ci += Math.min(1, mDT[p] / tau);
  }
  let silhouette = 0;
  if (grid.sil) {
    const gen = ++grid.gen;
    let inter = 0;
    let area = 0;
    const sil = grid.sil;
    const mark = (p: number) => {
      if (grid.stamp[p] === gen) return;
      grid.stamp[p] = gen;
      area++;
      inter += sil[p];
    };
    for (const poly of geo.polys) fillPolygon(mark, w, h, poly.map((p) => apply(G, p.x, p.y)));
    const uni = area + grid.silArea - inter;
    silhouette = uni ? inter / uni : 0;
  }
  return { chamferModel: n ? 1 - cm / n : 0, chamferImage: grid.detPts.length ? 1 - ci / grid.detPts.length : 0, silhouette };
}

/** Even-odd scanline fill of one polygon: calls `mark` for every covered cell. */
export function fillPolygon(mark: (p: number) => void, w: number, h: number, poly: { x: number; y: number }[]): void {
  if (poly.length < 3) return;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const p of poly) {
    y0 = Math.min(y0, p.y);
    y1 = Math.max(y1, p.y);
  }
  const ys = Math.max(0, Math.floor(y0));
  const ye = Math.min(h - 1, Math.ceil(y1));
  const xs: number[] = [];
  for (let y = ys; y <= ye; y++) {
    const cy = y + 0.5;
    xs.length = 0;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      if ((a.y <= cy && b.y > cy) || (b.y <= cy && a.y > cy)) xs.push(a.x + ((cy - a.y) / (b.y - a.y)) * (b.x - a.x));
    }
    xs.sort((m, n) => m - n);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xa = Math.max(0, Math.ceil(xs[k] - 0.5));
      const xb = Math.min(w - 1, Math.floor(xs[k + 1] - 0.5));
      for (let x = xa; x <= xb; x++) mark(y * w + x);
    }
  }
}
