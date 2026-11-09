import type { RgbaImage } from "./types";

/**
 * Step 1 and 2 of the dieline detector: find the thin dieline strokes over busy artwork and
 * vectorise them into axis-aligned segments plus the die silhouette. Pure TS, typed arrays only.
 *
 * Working raster: the upload is box-averaged down by an integer factor `f` so the long side is
 * about 1100 to 1650 px (a 1 px stroke at 2× still reads as a half-contrast ridge).
 */

export interface Work {
  w: number;
  h: number;
  /** Full-resolution px per working px. */
  f: number;
  /** Interleaved RGB, 0..255. */
  rgb: Float32Array;
}

export function toWork(img: RgbaImage): Work {
  const maxSide = Math.max(img.width, img.height);
  const f = Math.max(1, Math.round(maxSide / 1100));
  const w = Math.max(1, Math.floor(img.width / f));
  const h = Math.max(1, Math.floor(img.height / f));
  const rgb = new Float32Array(w * h * 3);
  const src = img.data;
  const inv = 1 / (f * f);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let dy = 0; dy < f; dy++) {
        let i = ((y * f + dy) * img.width + x * f) * 4;
        for (let dx = 0; dx < f; dx++, i += 4) {
          // Transparent pixels read as white paper.
          const a = src[i + 3] / 255;
          r += src[i] * a + 255 * (1 - a);
          g += src[i + 1] * a + 255 * (1 - a);
          b += src[i + 2] * a + 255 * (1 - a);
        }
      }
      const o = (y * w + x) * 3;
      rgb[o] = r * inv;
      rgb[o + 1] = g * inv;
      rgb[o + 2] = b * inv;
    }
  }
  return { w, h, f, rgb };
}

/** Ridge offsets: [dx, dy] of the two background samples either side of a thin stroke. */
const PROBES: [number, number][] = [
  [0, 2], // horizontal stroke
  [2, 0], // vertical stroke
  [0, 3],
  [3, 0],
  [2, 2], // diagonals and curves
  [2, -2],
];

export interface Ridges {
  /** Ridge strength (colour distance from the local background minus its asymmetry). */
  strength: Float32Array;
  /** Local background either side of the ridge (RGB). */
  bg: Float32Array;
}

/**
 * A stroke pixel differs from the two pixels a few px away on either side of it, while those two
 * agree with each other. Edges of big shapes fail the second test, flat areas the first.
 */
export function ridges(work: Work): Ridges {
  const { w, h, rgb } = work;
  const strength = new Float32Array(w * h);
  const bg = new Float32Array(w * h * 3);
  const m = 3;
  for (let y = m; y < h - m; y++) {
    for (let x = m; x < w - m; x++) {
      const p = y * w + x;
      const o = p * 3;
      const r0 = rgb[o];
      const g0 = rgb[o + 1];
      const b0 = rgb[o + 2];
      let best = 0;
      let br = 0;
      let bgc = 0;
      let bb = 0;
      for (let k = 0; k < PROBES.length; k++) {
        const dx = PROBES[k][0];
        const dy = PROBES[k][1];
        const oa = ((y - dy) * w + (x - dx)) * 3;
        const ob = ((y + dy) * w + (x + dx)) * 3;
        const ar = rgb[oa];
        const ag = rgb[oa + 1];
        const ab = rgb[oa + 2];
        const cr = rgb[ob];
        const cg = rgb[ob + 1];
        const cb = rgb[ob + 2];
        const mr = (ar + cr) * 0.5;
        const mg = (ag + cg) * 0.5;
        const mb = (ab + cb) * 0.5;
        const c = Math.sqrt((r0 - mr) ** 2 + (g0 - mg) ** 2 + (b0 - mb) ** 2);
        if (c <= best) continue;
        const e = Math.sqrt((ar - cr) ** 2 + (ag - cg) ** 2 + (ab - cb) ** 2);
        const s = c - 0.9 * e;
        if (s > best) {
          best = s;
          br = mr;
          bgc = mg;
          bb = mb;
        }
      }
      strength[p] = best;
      bg[o] = br;
      bg[o + 1] = bgc;
      bg[o + 2] = bb;
    }
  }
  return { strength, bg };
}

export type Rgb = [number, number, number];

/**
 * The dieline colour(s): colours of ridge pixels that sit on long straight horizontal or
 * vertical runs, weighted by contrast. Artwork rarely has long thin straight strokes; the die
 * has dozens. Returns up to `max` colours, dominant first.
 */
export function strokeColors(work: Work, rd: Ridges, max = 2): { colors: Rgb[]; weights: number[] } {
  const { w, h, rgb } = work;
  const { strength } = rd;
  const T = 28;
  const minRun = Math.max(14, Math.round(0.035 * Math.max(w, h)));
  const BINS = 16;
  const sumR = new Float64Array(BINS ** 3);
  const sumG = new Float64Array(BINS ** 3);
  const sumB = new Float64Array(BINS ** 3);
  const wt = new Float64Array(BINS ** 3);
  // Each pixel weighs its run's length: the die's strokes run for hundreds of px, a QR code's or
  // a text block's ridges for a few dozen, however strong their contrast.
  const add = (p: number, ww: number) => {
    const o = p * 3;
    const bi = ((rgb[o] >> 4) * BINS + (rgb[o + 1] >> 4)) * BINS + (rgb[o + 2] >> 4);
    sumR[bi] += rgb[o] * ww;
    sumG[bi] += rgb[o + 1] * ww;
    sumB[bi] += rgb[o + 2] * ww;
    wt[bi] += ww;
  };
  // Runs along rows (horizontal strokes) and columns (vertical strokes), gaps up to 1 px.
  const scan = (n: number, len: number, at: (i: number, j: number) => number) => {
    for (let i = 0; i < n; i++) {
      let start = -1;
      let last = -1;
      for (let j = 0; j <= len; j++) {
        const on = j < len && strength[at(i, j)] > T;
        if (on) {
          if (start < 0) start = j;
          last = j;
        } else if (start >= 0 && j - last > 2) {
          const len = last - start + 1;
          if (len >= minRun) for (let k = start; k <= last; k++) if (strength[at(i, k)] > T) add(at(i, k), len * strength[at(i, k)] ** 2);
          start = -1;
        }
      }
    }
  };
  scan(h, w, (y, x) => y * w + x);
  scan(w, h, (x, y) => y * w + x);

  const colors: Rgb[] = [];
  const weights: number[] = [];
  const taken = new Uint8Array(BINS ** 3);
  for (let n = 0; n < max; n++) {
    // Densest 3×3×3 neighbourhood of bins not taken yet.
    let bestW = 0;
    let bestI = -1;
    for (let i = 0; i < wt.length; i++) {
      if (!wt[i] || taken[i]) continue;
      const r = Math.floor(i / (BINS * BINS));
      const g = Math.floor(i / BINS) % BINS;
      const b = i % BINS;
      let s = 0;
      for (let dr = -1; dr <= 1; dr++)
        for (let dg = -1; dg <= 1; dg++)
          for (let db = -1; db <= 1; db++) {
            const rr = r + dr;
            const gg = g + dg;
            const bb = b + db;
            if (rr < 0 || gg < 0 || bb < 0 || rr >= BINS || gg >= BINS || bb >= BINS) continue;
            const j = (rr * BINS + gg) * BINS + bb;
            if (!taken[j]) s += wt[j];
          }
      if (s > bestW) {
        bestW = s;
        bestI = i;
      }
    }
    if (bestI < 0) break;
    if (n > 0 && bestW < 0.5 * weights[0]) break;
    const r = Math.floor(bestI / (BINS * BINS));
    const g = Math.floor(bestI / BINS) % BINS;
    const b = bestI % BINS;
    let sr = 0;
    let sg = 0;
    let sb = 0;
    let sw = 0;
    for (let dr = -2; dr <= 2; dr++)
      for (let dg = -2; dg <= 2; dg++)
        for (let db = -2; db <= 2; db++) {
          const rr = r + dr;
          const gg = g + dg;
          const bb = b + db;
          if (rr < 0 || gg < 0 || bb < 0 || rr >= BINS || gg >= BINS || bb >= BINS) continue;
          const j = (rr * BINS + gg) * BINS + bb;
          if (taken[j]) continue;
          // Use the core (±1) for the colour, take ±2 so the next colour is really different.
          if (Math.abs(dr) <= 1 && Math.abs(dg) <= 1 && Math.abs(db) <= 1) {
            sr += sumR[j];
            sg += sumG[j];
            sb += sumB[j];
            sw += wt[j];
          }
          taken[j] = 1;
        }
    colors.push([sr / sw, sg / sw, sb / sw]);
    weights.push(bestW);
  }
  return { colors, weights };
}

/**
 * Stroke mask: ridge pixels whose colour lies between the local background and a stroke colour
 * (antialiased and JPEG-blurred strokes are partial mixes), within a residual.
 */
export function lineMask(work: Work, rd: Ridges, colors: Rgb[]): Uint8Array {
  const { w, h, rgb } = work;
  const { strength, bg } = rd;
  const mask = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) {
    if (strength[p] < 12) continue;
    const o = p * 3;
    const vr = rgb[o] - bg[o];
    const vg = rgb[o + 1] - bg[o + 1];
    const vb = rgb[o + 2] - bg[o + 2];
    const vn = Math.sqrt(vr * vr + vg * vg + vb * vb);
    for (const c of colors) {
      const sr = c[0] - bg[o];
      const sg = c[1] - bg[o + 1];
      const sb = c[2] - bg[o + 2];
      const s2 = sr * sr + sg * sg + sb * sb;
      if (s2 < 400) continue; // stroke invisible on this background
      const a = (vr * sr + vg * sg + vb * sb) / s2;
      if (a < 0.22 || a > 1.4) continue;
      const res = Math.sqrt((vr - a * sr) ** 2 + (vg - a * sg) ** 2 + (vb - a * sb) ** 2);
      if (res <= 0.38 * vn + 10) {
        mask[p] = 1;
        break;
      }
    }
  }
  return mask;
}

/**
 * Small rotation (degrees, ±3°) that makes the stroke pixels line up best in row and column
 * projections. The deskew maps (x, y) → (x', y') with `rotatePt`.
 */
export function estimateSkew(mask: Uint8Array, w: number, h: number): number {
  const xs: number[] = [];
  const ys: number[] = [];
  const step = Math.max(1, Math.round(Math.sqrt(countOn(mask) / 60000)));
  let n = 0;
  for (let p = 0; p < mask.length; p++) {
    if (!mask[p]) continue;
    if (n++ % step) continue;
    xs.push(p % w);
    ys.push(Math.floor(p / w));
  }
  if (xs.length < 50) return 0;
  const cx = w / 2;
  const cy = h / 2;
  const size = Math.ceil(Math.hypot(w, h)) + 4;
  const hx = new Float64Array(size);
  const hy = new Float64Array(size);
  const sharp = (deg: number) => {
    const t = (deg * Math.PI) / 180;
    const c = Math.cos(t);
    const s = Math.sin(t);
    hx.fill(0);
    hy.fill(0);
    const off = size / 2;
    for (let i = 0; i < xs.length; i++) {
      const dx = xs[i] - cx;
      const dy = ys[i] - cy;
      const x2 = dx * c + dy * s + off;
      const y2 = -dx * s + dy * c + off;
      hx[Math.round(x2)]++;
      hy[Math.round(y2)]++;
    }
    let e = 0;
    for (let i = 0; i < size; i++) e += hx[i] * hx[i] + hy[i] * hy[i];
    return e;
  };
  let best = 0;
  let bestE = sharp(0);
  for (let d = -3; d <= 3.0001; d += 0.1) {
    const e = sharp(d);
    if (e > bestE * 1.0001) {
      bestE = e;
      best = d;
    }
  }
  const c0 = best;
  for (let d = c0 - 0.1; d <= c0 + 0.1001; d += 0.02) {
    const e = sharp(d);
    if (e > bestE * 1.0001) {
      bestE = e;
      best = d;
    }
  }
  return Math.abs(best) < 0.03 ? 0 : best;
}

function countOn(m: Uint8Array): number {
  let n = 0;
  for (let i = 0; i < m.length; i++) n += m[i];
  return n;
}

/** Deskew rotation about the raster centre: forward (image → deskewed) and back. */
export function rotatePt(x: number, y: number, w: number, h: number, deg: number, inverse = false): { x: number; y: number } {
  if (!deg) return { x, y };
  const t = ((inverse ? -deg : deg) * Math.PI) / 180;
  const c = Math.cos(t);
  const s = Math.sin(t);
  const dx = x - w / 2;
  const dy = y - h / 2;
  return { x: w / 2 + dx * c + dy * s, y: h / 2 - dx * s + dy * c };
}

export function deskewMask(mask: Uint8Array, w: number, h: number, deg: number): Uint8Array {
  if (!deg) return mask;
  const out = new Uint8Array(w * h);
  // Pull: every output pixel samples the input at its inverse-rotated position (no holes).
  const t = (-deg * Math.PI) / 180;
  const c = Math.cos(t);
  const s = Math.sin(t);
  for (let y = 0; y < h; y++) {
    const dy = y - h / 2;
    for (let x = 0; x < w; x++) {
      const dx = x - w / 2;
      const sx = Math.round(w / 2 + dx * c + dy * s);
      const sy = Math.round(h / 2 - dx * s + dy * c);
      if (sx >= 0 && sy >= 0 && sx < w && sy < h && mask[sy * w + sx]) out[y * w + x] = 1;
    }
  }
  return out;
}

/** An axis-aligned stroke in the deskewed working raster. */
export interface Seg {
  /** "h": y = pos, x from a to b. "v": x = pos, y from a to b. */
  o: "h" | "v";
  pos: number;
  a: number;
  b: number;
  /** Inked share of the length (solid ≈ 1, dashed lower). */
  fill: number;
}

/**
 * Straight horizontal and vertical strokes: row (column) runs of mask pixels with gaps up to
 * `gap` (dashed creases), at least `minLen` long, merged across the 1 to 3 rows a stroke covers.
 */
export function extractSegments(mask: Uint8Array, w: number, h: number): Seg[] {
  const maxSide = Math.max(w, h);
  const gap = Math.max(4, Math.round(0.012 * maxSide));
  const minLen = Math.max(10, Math.round(0.02 * maxSide));
  const out: Seg[] = [];
  const pass = (o: "h" | "v", n: number, len: number, at: (i: number, j: number) => number) => {
    interface G {
      a: number;
      b: number;
      last: number;
      sp: number;
      sl: number;
      ink: number;
      cover: number;
    }
    let open: G[] = [];
    const done: G[] = [];
    for (let i = 0; i < n; i++) {
      const runs: { a: number; b: number; ink: number }[] = [];
      let start = -1;
      let last = -1;
      let ink = 0;
      for (let j = 0; j <= len; j++) {
        const on = j < len && mask[at(i, j)] === 1;
        if (on) {
          if (start < 0) {
            start = j;
            ink = 0;
          }
          last = j;
          ink++;
        } else if (start >= 0 && (j === len || j - last > gap)) {
          if (last - start + 1 >= minLen) runs.push({ a: start, b: last, ink });
          start = -1;
        }
      }
      for (const r of runs) {
        const rl = r.b - r.a + 1;
        let g = open.find((q) => Math.min(q.b, r.b) - Math.max(q.a, r.a) >= 0.5 * Math.min(rl, q.b - q.a + 1));
        if (g && g.last === i) g = undefined; // one run per row and group
        if (g) {
          g.a = Math.min(g.a, r.a);
          g.b = Math.max(g.b, r.b);
          g.sp += i * r.ink;
          g.sl += r.ink;
          g.ink = Math.max(g.ink, r.ink);
          g.cover = Math.max(g.cover, rl);
          g.last = i;
        } else open.push({ a: r.a, b: r.b, last: i, sp: i * r.ink, sl: r.ink, ink: r.ink, cover: rl });
      }
      // Close groups not continued for 2 rows.
      const still: G[] = [];
      for (const g of open) (i - g.last <= 2 ? still : done).push(g);
      open = still;
    }
    done.push(...open);
    for (const g of done) {
      const length = g.b - g.a + 1;
      out.push({ o, pos: g.sp / g.sl, a: g.a, b: g.b, fill: Math.min(1, g.ink / length) });
    }
  };
  pass("h", h, w, (y, x) => y * w + x);
  pass("v", w, h, (x, y) => y * w + x);
  return out;
}

/**
 * Die silhouette: flood the background from the image border through non-stroke pixels (the
 * strokes grown by `k` px to close antialiasing gaps); what the flood cannot reach is the blank.
 * Retries with a larger `k` when the outline leaks. Null when no closed outline is found.
 */
export function silhouette(mask: Uint8Array, w: number, h: number): { sil: Uint8Array; box: { x0: number; y0: number; x1: number; y1: number }; area: number } | null {
  for (const k of [1, 2, 3, 5]) {
    const wall = dilate(mask, w, h, k);
    const outside = new Uint8Array(w * h);
    const stack: number[] = [];
    const push = (p: number) => {
      if (!wall[p] && !outside[p]) {
        outside[p] = 1;
        stack.push(p);
      }
    };
    for (let x = 0; x < w; x++) {
      push(x);
      push((h - 1) * w + x);
    }
    for (let y = 0; y < h; y++) {
      push(y * w);
      push(y * w + w - 1);
    }
    while (stack.length) {
      const p = stack.pop()!;
      const x = p % w;
      if (x > 0) push(p - 1);
      if (x < w - 1) push(p + 1);
      if (p >= w) push(p - w);
      if (p < w * (h - 1)) push(p + w);
    }
    const sil = new Uint8Array(w * h);
    let area = 0;
    let x0 = w;
    let y0 = h;
    let x1 = -1;
    let y1 = -1;
    for (let p = 0; p < w * h; p++) {
      if (outside[p]) continue;
      sil[p] = 1;
      area++;
    }
    // Keep the largest blobs only (a closed letter outside the die is not part of it).
    const kept = keepLargeComponents(sil, w, h, 0.02);
    area = 0;
    for (let p = 0; p < w * h; p++) {
      if (!kept[p]) continue;
      area++;
      const x = p % w;
      const y = (p - x) / w;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    const boxArea = (x1 - x0 + 1) * (y1 - y0 + 1);
    // A sound blank fills a fair share of its own box and is not a sliver of the image.
    if (area > 0.04 * w * h && area > 0.3 * boxArea) return { sil: erode(kept, w, h, k), box: { x0: x0 + k, y0: y0 + k, x1: x1 - k, y1: y1 - k }, area };
  }
  return null;
}

function keepLargeComponents(m: Uint8Array, w: number, h: number, minShare: number): Uint8Array {
  const label = new Int32Array(w * h);
  const sizes: number[] = [0];
  const stack: number[] = [];
  for (let p0 = 0; p0 < w * h; p0++) {
    if (!m[p0] || label[p0]) continue;
    const id = sizes.length;
    let n = 0;
    label[p0] = id;
    stack.push(p0);
    while (stack.length) {
      const p = stack.pop()!;
      n++;
      const x = p % w;
      const nb = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w];
      for (const q of nb) if (q >= 0 && q < w * h && m[q] && !label[q]) {
        label[q] = id;
        stack.push(q);
      }
    }
    sizes.push(n);
  }
  const max = Math.max(0, ...sizes);
  const out = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) if (label[p] && sizes[label[p]] >= Math.max(minShare * w * h, 0.15 * max)) out[p] = 1;
  return out;
}

/** Square dilation by k px (two 1D passes). */
export function dilate(m: Uint8Array, w: number, h: number, k: number): Uint8Array {
  const tmp = new Uint8Array(w * h);
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    let lastOn = -1e9;
    for (let x = 0; x < w; x++) {
      if (m[y * w + x]) lastOn = x;
      if (x - lastOn <= k) tmp[y * w + x] = 1;
    }
    lastOn = 1e9;
    for (let x = w - 1; x >= 0; x--) {
      if (m[y * w + x]) lastOn = x;
      if (lastOn - x <= k) tmp[y * w + x] = 1;
    }
  }
  for (let x = 0; x < w; x++) {
    let lastOn = -1e9;
    for (let y = 0; y < h; y++) {
      if (tmp[y * w + x]) lastOn = y;
      if (y - lastOn <= k) out[y * w + x] = 1;
    }
    lastOn = 1e9;
    for (let y = h - 1; y >= 0; y--) {
      if (tmp[y * w + x]) lastOn = y;
      if (lastOn - y <= k) out[y * w + x] = 1;
    }
  }
  return out;
}

function erode(m: Uint8Array, w: number, h: number, k: number): Uint8Array {
  const inv = new Uint8Array(w * h);
  for (let i = 0; i < inv.length; i++) inv[i] = m[i] ? 0 : 1;
  const d = dilate(inv, w, h, k);
  for (let i = 0; i < d.length; i++) d[i] = d[i] ? 0 : 1;
  return d;
}

/**
 * Exact Euclidean distance transform (Felzenszwalb & Huttenlocher): distance in px from every
 * pixel to the nearest set pixel of `m`.
 */
export function distanceTransform(m: Uint8Array, w: number, h: number): Float32Array {
  const INF = 1e12;
  const f = new Float64Array(Math.max(w, h));
  const d = new Float64Array(Math.max(w, h));
  const v = new Int32Array(Math.max(w, h));
  const z = new Float64Array(Math.max(w, h) + 1);
  const grid = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) grid[i] = m[i] ? 0 : INF;
  const pass1 = (n: number) => {
    let k = 0;
    v[0] = 0;
    z[0] = -INF;
    z[1] = INF;
    for (let q = 1; q < n; q++) {
      let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) {
        k--;
        s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      }
      k++;
      v[k] = q;
      z[k] = s;
      z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < n; q++) {
      while (z[k + 1] < q) k++;
      d[q] = (q - v[k]) ** 2 + f[v[k]];
    }
  };
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = grid[y * w + x];
    pass1(h);
    for (let y = 0; y < h; y++) grid[y * w + x] = d[y];
  }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = grid[y * w + x];
    pass1(w);
    for (let x = 0; x < w; x++) out[y * w + x] = Math.sqrt(d[x]);
  }
  return out;
}

export const hex = (c: Rgb) => `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
