import type { Dims } from "@/types";
import type { Affine } from "@/lib/dieline";
import {
  deskewMask,
  estimateSkew,
  extractSegments,
  hex,
  lineMask,
  ridges,
  silhouette,
  strokeColors,
  toWork,
  type Seg,
} from "./extract";
import {
  apply,
  coarseCost,
  houghInit,
  panelGaps,
  dimsOf,
  fitLin,
  geoOf,
  guessScale,
  legalDims,
  linearise,
  mergePos,
  mul,
  orientAffine,
  type DetStructure,
  type Fit,
  type Geo,
  type Z,
  type Pos,
} from "./match";
import { makeGrid, rasterScore, type RasterScore, type ScoreGrid } from "./score";
import { usableDpi } from "./dpi";
import type { DetectCandidate, DetectModel, DetectOptions, DetectOverlay, DetectResult, DetectedLine, PxSeg, RgbaImage } from "./types";

/** Models kept after the layout prefilter, and after the line fit. */
const PREFILTER_KEEP = 28;
const FINE_KEEP = 12;
/** Hypotheses per short-listed model that get the full check. */
const VERIFY_HYPS = 2;
/** Distinct line fits per model carried to the raster checks. */
const HYPS_PER_MODEL = 3;
/** Raster evaluations per hypothesis in the final refinement. */
const REFINE_EVALS = 40;
/** Leading models refined on the raster match. */
const REFINE_TOP = 4;
/** First-round placements per axis (see `fitLin`). */
const ALIGNS: [number, number][] = [
  [0, 0],
  [1, 1],
  [2, 2],
  [1, 2],
  [2, 1],
];
/** Best candidate score from which the detector says it found the box. */
export const FOUND_SCORE = 0.6;

/**
 * Detect which library box an uploaded full artwork (with its dieline drawn on it) is, and at
 * what size. Pure and synchronous; run it in a Web Worker for big images (see ./worker.ts).
 */
/**
 * Precompute the image-independent part of the matching (each model's dieline at its default
 * size, linearised in 8 orientations: about 4 builds per model, ~1 s for the 274 boxes). Call
 * it once when the worker starts so the first upload is fast. Later calls are free.
 */
export function prepareModels(models: readonly DetectModel[]): number {
  let n = 0;
  for (const m of models) if (linearise(m, m.defaultDims)) n++;
  return n;
}

export function detectDieline(img: RgbaImage, opts: DetectOptions = {}): DetectResult {
  const timings: Record<string, number> = {};
  let t = now();
  const lap = (k: string) => {
    const n = now();
    timings[k] = Math.round(n - t);
    t = n;
  };

  // Step 1: strokes.
  const work = toWork(img);
  const { w, h, f } = work;
  const rd = ridges(work);
  const { colors } = strokeColors(work, rd);
  const mask = lineMask(work, rd, colors);
  lap("strokes");

  // Step 2: deskew, segments, silhouette.
  const skew = estimateSkew(mask, w, h);
  const m2 = deskewMask(mask, w, h, skew);
  const rawSegs = extractSegments(m2, w, h);
  // Silhouette and raster checks run on a coarse grid (long side about 400 px): the stroke mask
  // max-pooled, so thin strokes survive and small gaps close.
  const q = Math.max(1, Math.ceil(Math.max(w, h) / 400));
  const gw = Math.ceil(w / q);
  const gh = Math.ceil(h / q);
  const pooled = orPool(m2, w, h, q);
  const silG = silhouette(pooled, gw, gh);
  const sil = silG ? { sil: silG.sil, box: { x0: silG.box.x0 * q, y0: silG.box.y0 * q, x1: silG.box.x1 * q + q - 1, y1: silG.box.y1 * q + q - 1 } } : null;
  lap("vectorise");

  const boxOf = (segs: Seg[]) => {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const s of segs) {
      const [ax, ay, bx, by] = s.o === "h" ? [s.a, s.pos, s.b, s.pos] : [s.pos, s.a, s.pos, s.b];
      x0 = Math.min(x0, ax, bx);
      x1 = Math.max(x1, ax, bx);
      y0 = Math.min(y0, ay, by);
      y1 = Math.max(y1, ay, by);
    }
    return { x0, y0, x1, y1 };
  };
  const solid = rawSegs.filter((s) => s.fill >= 0.3);
  const box = sil ? sil.box : solid.length ? boxOf(solid) : { x0: 0, y0: 0, x1: w - 1, y1: h - 1 };
  const size = Math.max(box.x1 - box.x0, box.y1 - box.y0, 1);
  const margin = 0.02 * size;
  const segs = solid.filter((s) => {
    const len = s.b - s.a;
    if (len < 0.03 * size) return false;
    // Short broken runs are artwork (text, QR codes); a short crease is rarely worth the risk.
    if (s.fill < 0.75 && len < 0.12 * size) return false;
    const [cx, cy] = s.o === "h" ? [(s.a + s.b) / 2, s.pos] : [s.pos, (s.a + s.b) / 2];
    return cx >= box.x0 - margin && cx <= box.x1 + margin && cy >= box.y0 - margin && cy <= box.y1 + margin;
  });
  const tol = 0.004 * size;
  const minW = 0.03 * size;
  const det: DetStructure = {
    xs: mergePos(segs.filter((s) => s.o === "v").map((s): Pos => ({ pos: s.pos, w: s.b - s.a })), tol, minW),
    ys: mergePos(segs.filter((s) => s.o === "h").map((s): Pos => ({ pos: s.pos, w: s.b - s.a })), tol, minW),
    box,
    size,
  };

  // Deskewed working px → full-resolution image px.
  const undeskew = rotationAffine(skew, w, h);
  const toFull: Affine = mul([f, 0, 0, f, (f - 1) / 2, (f - 1) / 2], undeskew);
  const px = (x: number, y: number) => round2(apply(toFull, x, y));
  const lineOut: DetectedLine[] = segs.map((s) => {
    const a = s.o === "h" ? px(s.a, s.pos) : px(s.pos, s.a);
    const b = s.o === "h" ? px(s.b, s.pos) : px(s.pos, s.b);
    return { x1: a.x, y1: a.y, x2: b.x, y2: b.y, orientation: s.o, fill: Math.round(s.fill * 100) / 100, kind: s.fill >= 0.85 ? "cut" : "crease" };
  });
  let ink = 0;
  for (let i = 0; i < mask.length; i++) ink += mask[i];
  const lines = {
    colors: colors.map(hex),
    skewDeg: Math.round(skew * 100) / 100,
    segments: lineOut,
    dieBox: sil || segs.length ? [px(box.x0, box.y0), px(box.x1, box.y0), px(box.x1, box.y1), px(box.x0, box.y1)] : null,
    distinctX: det.xs.length,
    distinctY: det.ys.length,
    inkShare: Math.round((ink / mask.length) * 10000) / 10000,
  };

  const explicit = opts.pxPerMm && Number.isFinite(opts.pxPerMm) && opts.pxPerMm > 0 ? opts.pxPerMm : null;
  const metaDpi = usableDpi(opts.dpi);
  const pxPerMm = explicit ?? (metaDpi ? metaDpi / 25.4 : null);
  const dpi = pxPerMm ? pxPerMm * 25.4 : null;
  const sKnown = pxPerMm ? pxPerMm / f : null;
  const base: DetectResult = { found: false, lines, candidates: [], overlay: null, pxPerMm, timings };
  if (opts.debug) base.debug = { work: { w, h, f }, lineMask: m2, grid: { w: gw, h: gh, q }, silhouette: sil?.sil ?? null };
  const models = opts.models ?? [];
  const structured = det.xs.length >= 2 && det.ys.length >= 2 && segs.length >= 4;
  if (!models.length || !structured) {
    lap("match");
    return base;
  }

  // Step 3a: prefilter, every model in 8 orientations: one quick line fit from its default size
  // stretched onto the art (the linearisations are image-independent and cached: `prepareModels`).
  const pre: { m: DetectModel; cost: number; layout: number; orients: number[] }[] = [];
  for (const m of models) {
    const lins = linearise(m, m.defaultDims);
    if (!lins) continue;
    const scores = lins.map((lin) => {
      const sz = orientedSize(lin, lin.D0);
      const s = sKnown ?? Math.sqrt(((box.x1 - box.x0) * (box.y1 - box.y0)) / Math.max(1, sz[0] * sz[1]));
      return fitLin(lin, det, s, lin.D0, [0, 0]).score;
    });
    // Second opinion: the normalised layout at the default size (no solve), which survives art
    // whose flaps differ from the template where the quick fit locks onto the wrong lines.
    const g = geoOf(m, m.defaultDims);
    const layout = g ? lins.map((lin) => coarseCost(g, lin.o, det)) : lins.map(() => 1);
    const orients = scores.map((c, o) => ({ c, o })).sort((a, b) => b.c - a.c).slice(0, 2).map((x) => x.o);
    const los = layout.map((c, o) => ({ c, o })).sort((a, b) => a.c - b.c).slice(0, 2).map((x) => x.o);
    for (const o of los) if (!orients.includes(o)) orients.push(o);
    pre.push({ m, cost: -scores[orients[0]], layout: layout[los[0]], orients });
  }
  pre.sort((a, b) => a.cost - b.cost);
  const byLayout = [...pre].sort((a, b) => a.layout - b.layout);
  const kept = [...new Set([...pre.slice(0, PREFILTER_KEEP), ...byLayout.slice(0, PREFILTER_KEEP)])];
  lap("prefilter");

  // Step 3b: line fit (linearised dims solve) in 8 orientations from a few start sizes.
  const fits: { m: DetectModel; fit: Fit; hyps: Fit[] }[] = [];
  const gaps = panelGaps(det, 6);
  for (const { m, orients } of kept) {
    const lins = linearise(m, m.defaultDims);
    if (!lins) continue;
    const starts = uniqueDims([m.defaultDims, ...m.presets.map((p) => p.dims)].map((d) => legalDims(m, d))).slice(0, 3);
    const all: Fit[] = [];
    for (const o of orients) {
      const lin = lins[o];
      for (const st of starts) {
        const sz = orientedSize(lin, st);
        const s = sKnown ?? Math.sqrt(((box.x1 - box.x0) * (box.y1 - box.y0)) / Math.max(1, sz[0] * sz[1]));
        for (const align of ALIGNS) all.push(fitLin(lin, det, s, st, align));
      }
      // Data-driven starts: L, W, H (px) taken from the panel sizes seen on the art, kept when
      // the template's outline then comes within 25 % of the art's.
      const sz0 = orientedSize(lin, lin.D0);
      const s = sKnown ?? Math.sqrt(((box.x1 - box.x0) * (box.y1 - box.y0)) / Math.max(1, sz0[0] * sz0[1]));
      const opts = (k: 0 | 1 | 2) => (lin.fixed[k] ? [s * [lin.D0.L, lin.D0.W, lin.D0.H][k]] : gaps);
      for (const uL of opts(0))
        for (const uW of opts(1))
          for (const uH of opts(2)) {
            const D = { L: uL / s, W: uW / s, H: uH / s };
            const sz = orientedSize(lin, D);
            const rx = (s * sz[0]) / (box.x1 - box.x0);
            const ry = (s * sz[1]) / (box.y1 - box.y0);
            if (rx < 0.75 || rx > 1.25 || ry < 0.75 || ry > 1.25) continue;
            all.push(fitLin(lin, det, s, D, [0, 0], houghInit(lin, det, s, [uL, uW, uH])));
          }
    }
    const hyps = distinctFits(all, size, HYPS_PER_MODEL);
    if (hyps.length) fits.push({ m, fit: hyps[0], hyps });
  }
  fits.sort((a, b) => b.fit.score - a.fit.score);
  if (base.debug) base.debug.det = det;
  if (base.debug) base.debug.ranks = { prefilter: pre.map((p) => `${p.m.code}:${p.cost.toFixed(3)}`), fit: fits.map((x) => `${x.m.code}:${x.fit.score.toFixed(3)}:o${x.fit.lin.o}`) };
  lap("fit");

  // Step 3c: re-linearise each kept hypothesis at its fitted size, then raster checks; a model
  // keeps its best hypothesis.
  const grid = makeGrid(cleanMask(sil?.sil ?? null, segs, gw, gh, q), sil?.sil ?? null, gw, gh, q, size);
  type Final = { m: DetectModel; fit: Fit; dims: Dims; T: Affine; rs: RasterScore; score: number; order: number };
  const orderOf = new Map(models.map((m, i) => [m, i]));
  const finals: Final[] = [];
  const finalOf = (m: DetectModel, fit: Fit, z: Z): Final | null => {
    const dims = legalDims(m, dimsOf(z, fit.s));
    const geo = geoOf(m, dims);
    if (!geo) return null;
    const T = placement(geo, fit.lin.o, fit.s, z);
    const rs = rasterScore(grid, geo, T);
    const score = 0.3 * rs.chamferModel + 0.3 * rs.chamferImage + 0.25 * (sil ? rs.silhouette : rs.chamferModel) + 0.15 * Math.max(0, fit.score);
    return { m, fit, dims, T, rs, score, order: orderOf.get(m) ?? 0 };
  };
  // Short list: line score blended with a cheap raster look (template on the art, outline) of
  // each model's hypotheses; real art with flaps unlike the template fools the line score alone.
  const quick = fits.map((x) => {
    const scored = x.hyps.map((f) => {
      const geo = geoOf(x.m, legalDims(x.m, dimsOf(f.z, f.s)));
      if (!geo) return { f, v: -1 };
      const rs = rasterScore(grid, geo, placement(geo, f.lin.o, f.s, f.z), true);
      return { f, v: 0.35 * f.score + 0.65 * (sil ? 0.5 * rs.chamferModel + 0.5 * rs.silhouette : rs.chamferModel) };
    });
    scored.sort((a, b) => b.v - a.v);
    return { m: x.m, hyps: scored.slice(0, VERIFY_HYPS).map((h) => h.f), quick: scored[0]?.v ?? -1 };
  });
  quick.sort((a, b) => b.quick - a.quick);
  lap("shortlist");
  for (const { m, hyps } of quick.slice(0, FINE_KEEP)) {
    let bestFinal: Final | null = null;
    for (const f0 of hyps) {
      let fit = f0;
      for (let round = 0; round < 1; round++) {
        const s = sKnown ?? guessScale(m, [fit.z[0], fit.z[1], fit.z[2]], fit.lin.fixed);
        const D = legalDims(m, dimsOf(fit.z, s));
        const lins = linearise(m, D);
        if (!lins) break;
        // Warm start: same pixel layout (u = s·dims in px, offsets) as the previous solution.
        const next = fitLin(lins[fit.lin.o], det, s, D, [0, 0], fit.z);
        if (next.score >= fit.score - 0.02) fit = next;
        else break;
      }
      const f = finalOf(m, fit, fit.z);
      if (f && (!bestFinal || f.score > bestFinal.score)) bestFinal = f;
    }
    if (bestFinal) finals.push(bestFinal);
  }
  finals.sort(byScore);
  // Refine the leaders on the raster match itself, then score again.
  for (let i = 0; i < Math.min(REFINE_TOP, finals.length); i++) {
    const f = finals[i];
    const r = finalOf(f.m, f.fit, refine(f.m, f.fit, grid, size, !!sil));
    if (r && r.score > f.score) finals[i] = r;
  }
  finals.sort(byScore);
  lap("verify");

  const candidates: DetectCandidate[] = finals.slice(0, opts.maxCandidates ?? 5).map(({ m, fit, dims, rs, score }) => {
    const mx = Math.max(dims.L, dims.W, dims.H);
    const prop = { L: r3(dims.L / mx), W: r3(dims.W / mx), H: r3(dims.H / mx) };
    const outDims = sKnown ? { L: r1(dims.L), W: r1(dims.W), H: r1(dims.H) } : { L: Math.round(dims.L), W: Math.round(dims.W), H: Math.round(dims.H) };
    const why =
      `${fit.pairs} of ${fit.total} straight fold and cut lines line up; ` +
      `template strokes on the art ${pct(rs.chamferModel)}, art strokes on the template ${pct(rs.chamferImage)}` +
      (sil ? `, outline overlap ${pct(rs.silhouette)}` : "") +
      `; L:W:H = ${prop.L} : ${prop.W} : ${prop.H}` +
      (sKnown ? ` at ${Math.round(dpi!)} dpi` : `; size unknown (no print resolution in the file), shown at the nearest standard size`);
    return {
      code: m.code,
      slug: m.slug,
      name: m.name?.en,
      nameAr: m.name?.ar,
      dims: outDims,
      proportions: prop,
      score: r3(Math.max(0, Math.min(1, score))),
      scaleKnown: !!sKnown,
      orientation: fit.lin.o,
      why,
      parts: { lines: r3(Math.max(0, fit.score)), chamferModel: r3(rs.chamferModel), chamferImage: r3(rs.chamferImage), silhouette: r3(rs.silhouette) },
    };
  });

  let overlay: DetectOverlay | null = null;
  const top = finals[0];
  if (top) {
    const geo = geoOf(top.m, top.dims)!;
    const sheetToDie: Affine = [1, 0, 0, 1, -geo.model.dieBounds.x, -geo.model.dieBounds.y];
    const M = mul(toFull, mul(top.T, sheetToDie));
    const mapSeg = (s: { a: { x: number; y: number }; b: { x: number; y: number } }): PxSeg => {
      const a = round2(apply(M, s.a.x, s.a.y));
      const b = round2(apply(M, s.b.x, s.b.y));
      return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
    };
    overlay = {
      code: top.m.code,
      dims: candidates[0].dims,
      transform: M,
      cut: geo.model.cutLines.map(mapSeg),
      crease: geo.model.creaseLines.map(mapSeg),
      perf: geo.model.perfLines.map(mapSeg),
      panels: geo.model.panels.map((p) => p.polygon.map((q) => round2(apply(M, q.x, q.y)))),
    };
  }
  lap("output");
  return { ...base, found: !!candidates.length && candidates[0].score >= FOUND_SCORE, candidates, overlay };
}

/** Stroke pixels worth comparing (grid res): the die outline plus the straight lines. */
function cleanMask(sil: Uint8Array | null, segs: Seg[], w: number, h: number, q: number): Uint8Array {
  const out = new Uint8Array(w * h);
  if (sil) {
    for (let y = 1; y < h - 1; y++)
      for (let x = 1; x < w - 1; x++) {
        const p = y * w + x;
        if (sil[p] && (!sil[p - 1] || !sil[p + 1] || !sil[p - w] || !sil[p + w])) out[p] = 1;
      }
  }
  for (const s of segs) {
    const pos = Math.min(s.o === "h" ? h - 1 : w - 1, Math.floor(s.pos / q));
    for (let k = Math.floor(s.a / q); k <= Math.floor(s.b / q); k++) {
      const p = s.o === "h" ? pos * w + k : k * w + pos;
      if (p >= 0 && p < out.length) out[p] = 1;
    }
  }
  return out;
}

/** Max (OR) pooling of a mask by q. */
function orPool(m: Uint8Array, w: number, h: number, q: number): Uint8Array {
  if (q === 1) return m;
  const gw = Math.ceil(w / q);
  const out = new Uint8Array(gw * Math.ceil(h / q));
  for (let y = 0; y < h; y++) {
    const row = Math.floor(y / q) * gw;
    for (let x = 0; x < w; x++) if (m[y * w + x]) out[row + Math.floor(x / q)] = 1;
  }
  return out;
}

/** Inverse deskew (deskewed → image) as an affine about the raster centre. */
function rotationAffine(deg: number, w: number, h: number): Affine {
  if (!deg) return [1, 0, 0, 1, 0, 0];
  const t = (deg * Math.PI) / 180;
  const c = Math.cos(t);
  const s = Math.sin(t);
  const cx = w / 2;
  const cy = h / 2;
  return [c, s, -s, c, cx - c * cx + s * cy, cy - s * cx - c * cy];
}

/** Die-local mm → deskewed working px for a fit. */
function placement(geo: Geo, o: number, s: number, z: readonly number[]): Affine {
  const { A } = orientAffine(o, geo.W, geo.H);
  return mul([s, 0, 0, s, z[3], z[4]], A);
}

/**
 * Pattern search on the raster match (template strokes on the art, outline overlap) around a
 * line fit: lets each model settle where its whole drawing, curves included, sits best.
 */
function refine(m: DetectModel, fit: Fit, grid: ScoreGrid, size: number, hasSil: boolean): Z {
  const evalZ = (z: Z) => {
    const geo = geoOf(m, legalDims(m, dimsOf(z, fit.s)));
    if (!geo) return -1;
    const rs = rasterScore(grid, geo, placement(geo, fit.lin.o, fit.s, z), true);
    return hasSil ? 0.5 * rs.chamferModel + 0.5 * rs.silhouette : rs.chamferModel;
  };
  let z: Z = [...fit.z];
  let best = evalZ(z);
  let step = 0.008 * size;
  let evals = 0;
  while (step >= 0.0015 * size && evals < REFINE_EVALS) {
    let moved = false;
    for (let k = 0; k < 5; k++) {
      if (k < 3 && fit.lin.fixed[k]) continue;
      for (const dir of [1, -1]) {
        const t = [...z] as Z;
        t[k] += dir * step;
        const v = evalZ(t);
        evals++;
        if (v > best + 1e-4) {
          best = v;
          z = t;
          moved = true;
          break;
        }
      }
    }
    if (!moved) step /= 2;
  }
  return z;
}

/** Best fits that differ (orientation, dims or placement by more than 2 % of the die). */
function distinctFits(all: Fit[], size: number, n: number): Fit[] {
  const out: Fit[] = [];
  for (const f of [...all].sort((a, b) => b.score - a.score)) {
    if (f.score < 0) break;
    const same = out.some((g) => g.lin.o === f.lin.o && f.z.every((v, i) => Math.abs(v - g.z[i]) < 0.02 * size));
    if (!same) out.push(f);
    if (out.length >= n) break;
  }
  return out;
}

function orientedSize(lin: { size0: [number, number]; sizeJ: [[number, number, number], [number, number, number]]; D0: Dims }, d: Dims): [number, number] {
  const one = (i: 0 | 1) => lin.size0[i] + lin.sizeJ[i][0] * (d.L - lin.D0.L) + lin.sizeJ[i][1] * (d.W - lin.D0.W) + lin.sizeJ[i][2] * (d.H - lin.D0.H);
  return [one(0), one(1)];
}

function uniqueDims(list: Dims[]): Dims[] {
  const seen = new Set<string>();
  return list.filter((d) => {
    const k = `${Math.round(d.L)}x${Math.round(d.W)}x${Math.round(d.H)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * Higher score first; near ties (the same die under two library codes, e.g. a core model and its
 * family twin) keep the input order, so the core model wins.
 */
function byScore(this: void, a: { score: number; m: DetectModel; order?: number }, b: { score: number; m: DetectModel; order?: number }): number {
  return Math.abs(a.score - b.score) > 0.003 ? b.score - a.score : (a.order ?? 0) - (b.order ?? 0);
}

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
const r1 = (v: number) => Math.round(v * 10) / 10;
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const pct = (v: number) => `${Math.round(v * 100)}%`;
const round2 = (p: { x: number; y: number }) => ({ x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100 });
