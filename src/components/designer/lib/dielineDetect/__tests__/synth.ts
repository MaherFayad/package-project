import type { Dims } from "@/types";
import type { DetectModel, RgbaImage } from "../types";
import { orientAffine, mul, apply, thicknessOf } from "../match";
import type { Affine } from "@/lib/dieline";

/**
 * Test helper: draws a library dieline over random artwork, the way a buyer's file looks
 * (coloured blobs, thin artwork strokes, the die in one colour: solid cuts, dashed creases),
 * with a small rotation and JPEG-like noise.
 */

export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

export interface SynthOptions {
  pxPerMm: number;
  orientation: number;
  rotDeg: number;
  line: [number, number, number];
  lineWidth: number;
  seed: number;
  margin?: number;
}

export interface Synth {
  img: RgbaImage;
  /** Die-local mm → image px. */
  T: Affine;
}

export function renderDieline(model: DetectModel, dims: Dims, o: SynthOptions): Synth {
  const dl = model.build(dims, { thicknessMm: thicknessOf(model) });
  const rand = rng(o.seed);
  const { A, W, H } = orientAffine(o.orientation, dl.dieBounds.width, dl.dieBounds.height);
  const margin = o.margin ?? 30;
  const w = Math.round(W * o.pxPerMm + 2 * margin);
  const h = Math.round(H * o.pxPerMm + 2 * margin);
  const t = (o.rotDeg * Math.PI) / 180;
  const c = Math.cos(t);
  const s = Math.sin(t);
  const R: Affine = [c, s, -s, c, w / 2 - c * (w / 2) + s * (h / 2), h / 2 - s * (w / 2) - c * (h / 2)];
  const T = mul(R, mul([o.pxPerMm, 0, 0, o.pxPerMm, margin, margin], mul(A, [1, 0, 0, 1, -dl.dieBounds.x, -dl.dieBounds.y])));

  const px = new Float32Array(w * h * 3);
  // Background: a soft gradient between two random colours.
  const c0 = [rand() * 255, rand() * 255, rand() * 255].map((v) => 120 + v / 2);
  const c1 = [rand() * 255, rand() * 255, rand() * 255].map((v) => 120 + v / 2);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const k = (x / w + y / h) / 2;
      const p = (y * w + x) * 3;
      for (let ch = 0; ch < 3; ch++) px[p + ch] = c0[ch] * (1 - k) + c1[ch] * k;
    }
  // Blobs: circles and rectangles in random colours.
  for (let n = 0; n < 14; n++) {
    const col = [rand() * 255, rand() * 255, rand() * 255];
    const cx = rand() * w;
    const cy = rand() * h;
    const r = (0.04 + rand() * 0.12) * Math.max(w, h);
    const rect = rand() < 0.4;
    const x0 = Math.max(0, Math.floor(cx - r));
    const x1 = Math.min(w - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r * (rect ? 0.5 : 1)));
    const y1 = Math.min(h - 1, Math.ceil(cy + r * (rect ? 0.5 : 1)));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        if (!rect && (x - cx) ** 2 + (y - cy) ** 2 > r * r) continue;
        const p = (y * w + x) * 3;
        for (let ch = 0; ch < 3; ch++) px[p + ch] = col[ch];
      }
  }
  // Thin artwork strokes (text-like scribbles), dark.
  const stroke = (ax: number, ay: number, bx: number, by: number, col: number[], width: number, dash: number[] | null) => {
    const len = Math.hypot(bx - ax, by - ay);
    if (len < 0.5) return;
    const ux = (bx - ax) / len;
    const uy = (by - ay) / len;
    const pad = width + 2;
    const xs = Math.max(0, Math.floor(Math.min(ax, bx) - pad));
    const xe = Math.min(w - 1, Math.ceil(Math.max(ax, bx) + pad));
    const ys = Math.max(0, Math.floor(Math.min(ay, by) - pad));
    const ye = Math.min(h - 1, Math.ceil(Math.max(ay, by) + pad));
    const period = dash ? dash.reduce((a, b) => a + b, 0) : 0;
    for (let y = ys; y <= ye; y++)
      for (let x = xs; x <= xe; x++) {
        const qx = x + 0.5 - ax;
        const qy = y + 0.5 - ay;
        const along = qx * ux + qy * uy;
        if (along < -0.5 || along > len + 0.5) continue;
        if (dash) {
          const m = ((along % period) + period) % period;
          if (m > dash[0]) continue;
        }
        const d = Math.abs(qx * uy - qy * ux);
        const cov = Math.max(0, Math.min(1, width / 2 + 0.5 - d));
        if (!cov) continue;
        const p = (y * w + x) * 3;
        for (let ch = 0; ch < 3; ch++) px[p + ch] = px[p + ch] * (1 - cov) + col[ch] * cov;
      }
  };
  for (let n = 0; n < 40; n++) {
    const x = rand() * w;
    const y = rand() * h;
    const a = rand() * Math.PI * 2;
    const l = 10 + rand() * 40;
    stroke(x, y, x + Math.cos(a) * l, y + Math.sin(a) * l, [30, 30, 40], 1.5 + rand() * 2, null);
  }
  // The die.
  const draw = (segs: { a: { x: number; y: number }; b: { x: number; y: number } }[], dash: number[] | null) => {
    for (const sg of segs) {
      const a = apply(T, sg.a.x, sg.a.y);
      const b = apply(T, sg.b.x, sg.b.y);
      stroke(a.x, a.y, b.x, b.y, o.line, o.lineWidth, dash);
    }
  };
  draw(dl.cutLines, null);
  draw(dl.creaseLines, [7, 4]);
  draw(dl.perfLines, [3, 3]);
  // JPEG-like noise: per-pixel noise plus 8×8 block offsets.
  const data = new Uint8ClampedArray(w * h * 4);
  const blocks = new Float32Array(Math.ceil(w / 8) * Math.ceil(h / 8) * 3).map(() => (rand() - 0.5) * 8);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      const bi = (Math.floor(y / 8) * Math.ceil(w / 8) + Math.floor(x / 8)) * 3;
      for (let ch = 0; ch < 3; ch++) data[p * 4 + ch] = px[p * 3 + ch] + (rand() - 0.5) * 12 + blocks[bi + ch];
      data[p * 4 + 3] = 255;
    }
  return { img: { data, width: w, height: h }, T };
}
