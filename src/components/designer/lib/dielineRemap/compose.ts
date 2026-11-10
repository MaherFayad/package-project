import type { DielineModel, Polygon } from "@/lib/dieline";
import type { PrintSurface } from "@/types";
import type { Box, PanelPlan, RgbaImage } from "./types";

/**
 * Pixel side of the remap: paint the drawn die lines out of the art, then re-compose a sheet in
 * Elba's template layout, panel by panel, with bleed past every edge. Pure TS on typed arrays
 * (runs in the Web Worker and in Node tests).
 */

/** Hex "#rrggbb" → [r, g, b]. */
const rgbOf = (hex: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];

/**
 * Width (px) of the die lines: across a few dozen points of the detected lines, the run of pixels
 * close to the die colour. Median, at least 1.
 */
export function estimateLineWidth(img: RgbaImage, lines: readonly [number, number, number, number][], color: string | undefined): number {
  if (!color || !lines.length) return 2;
  const [cr, cg, cb] = rgbOf(color);
  const { data, width: w, height: h } = img;
  const near = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return false;
    const i = (y * w + x) * 4;
    const d = Math.abs(data[i] - cr) + Math.abs(data[i + 1] - cg) + Math.abs(data[i + 2] - cb);
    return d < 110;
  };
  const widths: number[] = [];
  const long = [...lines].sort((a, b) => Math.hypot(b[2] - b[0], b[3] - b[1]) - Math.hypot(a[2] - a[0], a[3] - a[1])).slice(0, 24);
  for (const [x1, y1, x2, y2] of long) {
    const horiz = Math.abs(x2 - x1) >= Math.abs(y2 - y1);
    for (let k = 1; k <= 5; k++) {
      const t = k / 6;
      const x = Math.round(x1 + (x2 - x1) * t);
      const y = Math.round(y1 + (y2 - y1) * t);
      let run = 0;
      let best = 0;
      for (let d = -8; d <= 8; d++) {
        const ok = horiz ? near(x, y + d) : near(x + d, y);
        run = ok ? run + 1 : 0;
        best = Math.max(best, run);
      }
      if (best > 0) widths.push(best);
    }
  }
  if (!widths.length) return 2;
  widths.sort((a, b) => a - b);
  return Math.max(1, Math.min(12, widths[Math.floor(widths.length / 2)]));
}

/**
 * Copy of the art with the straight die lines painted out: every pixel within half a line width
 * (plus antialiasing) of a line takes the colour just beyond the line on its own side, so a panel
 * sampled up to its edge, or bleed sampled across a fold, never carries the red stroke.
 */
export function paintOutLines(img: RgbaImage, lines: readonly [number, number, number, number][], widthPx: number): RgbaImage {
  const { width: w, height: h } = img;
  const src = img.data;
  const out = new Uint8ClampedArray(src);
  const half = widthPx / 2 + 1.2;
  const reach = Math.ceil(half);
  for (const [x1, y1, x2, y2] of lines) {
    const horiz = Math.abs(x2 - x1) >= Math.abs(y2 - y1);
    const a0 = Math.floor(horiz ? Math.min(x1, x2) : Math.min(y1, y2)) - reach;
    const a1 = Math.ceil(horiz ? Math.max(x1, x2) : Math.max(y1, y2)) + reach;
    for (let a = Math.max(0, a0); a <= Math.min((horiz ? w : h) - 1, a1); a++) {
      // line position at this column (row), allowing a small slope from the deskew
      const t = horiz ? (x2 === x1 ? 0 : (a - x1) / (x2 - x1)) : y2 === y1 ? 0 : (a - y1) / (y2 - y1);
      const pos = horiz ? y1 + (y2 - y1) * Math.min(1, Math.max(0, t)) : x1 + (x2 - x1) * Math.min(1, Math.max(0, t));
      const lo = Math.floor(pos - half);
      const hi = Math.ceil(pos + half);
      const before = lo - 1;
      const after = hi + 1;
      for (let b = lo; b <= hi; b++) {
        const from = b < pos ? before : after;
        const [px, py] = horiz ? [a, b] : [b, a];
        const [fx, fy] = horiz ? [a, from] : [from, a];
        if (px < 0 || py < 0 || px >= w || py >= h) continue;
        const cx = Math.min(w - 1, Math.max(0, fx));
        const cy = Math.min(h - 1, Math.max(0, fy));
        const i = (py * w + px) * 4;
        const j = (cy * w + cx) * 4;
        out[i] = src[j];
        out[i + 1] = src[j + 1];
        out[i + 2] = src[j + 2];
        out[i + 3] = 255;
      }
    }
  }
  return { data: out, width: w, height: h };
}

/** Scanline fill of a polygon (sheet mm) into a label raster at k px per mm. */
function fillPolygon(labels: Int32Array, w: number, h: number, poly: Polygon, k: number, label: number) {
  let ymin = Infinity;
  let ymax = -Infinity;
  for (const p of poly) {
    ymin = Math.min(ymin, p.y * k);
    ymax = Math.max(ymax, p.y * k);
  }
  const y0 = Math.max(0, Math.floor(ymin));
  const y1 = Math.min(h - 1, Math.ceil(ymax));
  const xs: number[] = [];
  for (let y = y0; y <= y1; y++) {
    const yc = y + 0.5;
    xs.length = 0;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const ay = poly[i].y * k;
      const by = poly[j].y * k;
      if (ay > yc !== by > yc) xs.push(poly[i].x * k + ((yc - ay) / (by - ay)) * (poly[j].x * k - poly[i].x * k));
    }
    xs.sort((a, b) => a - b);
    for (let n = 0; n + 1 < xs.length; n += 2) {
      const xa = Math.max(0, Math.ceil(xs[n] - 0.5));
      const xb = Math.min(w - 1, Math.floor(xs[n + 1] - 0.5));
      for (let x = xa; x <= xb; x++) labels[y * w + x] = label;
    }
  }
}

/** Nearest label for every unlabelled pixel (4-neighbour BFS from all labelled pixels). */
function dilate(labels: Int32Array, w: number, h: number) {
  const queue = new Int32Array(w * h);
  let head = 0;
  let tail = 0;
  for (let i = 0; i < labels.length; i++) if (labels[i] >= 0) queue[tail++] = i;
  while (head < tail) {
    const i = queue[head++];
    const l = labels[i];
    const x = i % w;
    if (x > 0 && labels[i - 1] < 0) {
      labels[i - 1] = l;
      queue[tail++] = i - 1;
    }
    if (x < w - 1 && labels[i + 1] < 0) {
      labels[i + 1] = l;
      queue[tail++] = i + 1;
    }
    if (i >= w && labels[i - w] < 0) {
      labels[i - w] = l;
      queue[tail++] = i - w;
    }
    if (i + w < labels.length && labels[i + w] < 0) {
      labels[i + w] = l;
      queue[tail++] = i + w;
    }
  }
}

const inBox = (b: Box, x: number, y: number, g = 0) => x >= b.x0 - g && x <= b.x1 + g && y >= b.y0 - g && y <= b.y1 + g;

/** Mean colour of the art over the given boxes (a coarse grid). */
export function meanColour(img: RgbaImage, boxes: Box[]): [number, number, number] {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (const bx of boxes) {
    const step = Math.max(1, Math.floor(Math.min(bx.x1 - bx.x0, bx.y1 - bx.y0) / 24));
    for (let y = Math.max(0, Math.ceil(bx.y0)); y < Math.min(img.height, bx.y1); y += step)
      for (let x = Math.max(0, Math.ceil(bx.x0)); x < Math.min(img.width, bx.x1); x += step) {
        const i = (y * img.width + x) * 4;
        r += img.data[i];
        g += img.data[i + 1];
        b += img.data[i + 2];
        n++;
      }
  }
  return n ? [r / n, g / n, b / n] : [255, 255, 255];
}

export interface ComposeOptions {
  surface: PrintSurface;
  /** Output px per sheet mm. */
  pxPerMm: number;
}

/**
 * Re-compose the art in the target model's sheet layout (the frame `paintArtworkSurface` covers
 * with a full artwork: the whole sheet, die plus bleed). Every pixel belongs to the panel it lies
 * in, or past an edge to the nearest panel (bleed: past a cut, samples run into the source panel's
 * neighbour only when that neighbour shares a fold with it in the source, else the edge pixels
 * extend). The inside comes out mirrored left to right, the way the inside template shows it.
 */
export function composeSheet(src: RgbaImage, target: DielineModel, plans: PanelPlan[], opts: ComposeOptions): RgbaImage {
  const k = opts.pxPerMm;
  const W = Math.max(1, Math.round(target.sheet.width * k));
  const H = Math.max(1, Math.round(target.sheet.height * k));
  const labels = new Int32Array(W * H).fill(-1);
  const byId = new Map(plans.map((p, i) => [p.panelId, i]));
  for (const p of target.panels) {
    const i = byId.get(p.id);
    if (i !== undefined) fillPolygon(labels, W, H, p.polygon, k, i);
  }
  const exact = new Uint8Array(W * H);
  for (let i = 0; i < labels.length; i++) exact[i] = labels[i] >= 0 ? 1 : 0;
  dilate(labels, W, H);

  const fill = meanColour(src, plans.flatMap((p) => p.maps.map((m) => m.clamp)));
  const out = new Uint8ClampedArray(W * H * 4);
  const { data: sd, width: sw, height: sh } = src;
  const mirror = opts.surface === "inside";
  const tol = 1.5;
  for (let Y = 0; Y < H; Y++) {
    const sy = (Y + 0.5) / k;
    for (let X = 0; X < W; X++) {
      const idx = Y * W + X;
      const o = (Y * W + (mirror ? W - 1 - X : X)) * 4;
      const li = labels[idx];
      const plan = li >= 0 ? plans[li] : null;
      if (!plan || !plan.maps.length) {
        out[o] = fill[0];
        out[o + 1] = fill[1];
        out[o + 2] = fill[2];
        out[o + 3] = 255;
        continue;
      }
      const sx = (X + 0.5) / k;
      let m = plan.maps[0];
      let px = m.A[0] * sx + m.A[2] * sy + m.A[4];
      let py = m.A[1] * sx + m.A[3] * sy + m.A[5];
      if (plan.maps.length > 1 && !inBox(m.clamp, px, py, tol)) {
        for (let n = 1; n < plan.maps.length; n++) {
          const c = plan.maps[n];
          const qx = c.A[0] * sx + c.A[2] * sy + c.A[4];
          const qy = c.A[1] * sx + c.A[3] * sy + c.A[5];
          if (inBox(c.clamp, qx, qy, tol)) {
            m = c;
            px = qx;
            py = qy;
            break;
          }
        }
      }
      const free = !exact[idx] && !inBox(m.clamp, px, py) && m.across.some((b) => inBox(b, px, py));
      if (!free) {
        px = Math.min(m.clamp.x1 - 0.5, Math.max(m.clamp.x0 + 0.5, px));
        py = Math.min(m.clamp.y1 - 0.5, Math.max(m.clamp.y0 + 0.5, py));
      }
      // bilinear sample (pixel centres at +0.5)
      const fx = Math.min(sw - 1, Math.max(0, px - 0.5));
      const fy = Math.min(sh - 1, Math.max(0, py - 0.5));
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const x1 = Math.min(sw - 1, x0 + 1);
      const y1 = Math.min(sh - 1, y0 + 1);
      const ax = fx - x0;
      const ay = fy - y0;
      const i00 = (y0 * sw + x0) * 4;
      const i10 = (y0 * sw + x1) * 4;
      const i01 = (y1 * sw + x0) * 4;
      const i11 = (y1 * sw + x1) * 4;
      for (let c = 0; c < 3; c++) {
        const top = sd[i00 + c] + (sd[i10 + c] - sd[i00 + c]) * ax;
        const bot = sd[i01 + c] + (sd[i11 + c] - sd[i01 + c]) * ax;
        out[o + c] = top + (bot - top) * ay;
      }
      out[o + 3] = 255;
    }
  }
  return { data: out, width: W, height: H };
}
