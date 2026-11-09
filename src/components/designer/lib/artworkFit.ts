import type { Dims, MaterialCode, StructureFeatures, StructureParamLimits, DimsPreset, StructureFamily } from "@/types";
import { BOARD_SPECS, sheetImagePlacement, type DielineModel } from "@/lib/dieline";
import { DPI_ERROR, DPI_WARNING } from "./preflight";

/**
 * Full artwork fit check (designer: artwork fit). Pure, no DOM.
 *
 * The buyer is told to design on the dieline template, whose frame is the model's sheet (die +
 * bleed, `dielineToSvg` viewBox). The sheet image is drawn to cover that frame, centred
 * (`sheetImagePlacement`), so what decides whether it lines up is the image's aspect ratio
 * against the sheet's. Resolution is the effective dpi at that size (preflight's thresholds).
 *
 * When it does not fit, `solveModelDims` looks for the same model at other sizes whose template
 * has the image's shape, and `scanModels` looks through other models (their standard sizes,
 * default size and a one-axis solve). Every aspect comes from the model's own dieline build.
 */

/** Within 1.5 % the crop is under a millimetre or two on a box sheet: it fits. */
export const FIT_TOLERANCE = 0.015;
/** Up to 5 %: a thin strip is cropped. */
export const NEAR_TOLERANCE = 0.05;

export type FitVerdict = "fits" | "near" | "off";

export interface FitCheck {
  verdict: FitVerdict;
  imageAspect: number;
  templateAspect: number;
  /** Relative aspect difference |ln(image / template)|. */
  diff: number;
  /** Share of the image cut off (0..1) and where: the sides (image wider) or top and bottom. */
  cropShare: number;
  cropEdge: "sides" | "topBottom" | null;
  /** Effective dpi at the printed size, and its level against preflight's thresholds. */
  dpi: number;
  dpiLevel: "ok" | "warning" | "error";
  /** Largest sheet (mm) the image prints at 300 dpi. */
  goodSizeMm: { width: number; height: number };
}

export const aspectOf = (w: number, h: number) => Math.max(1e-6, w) / Math.max(1e-6, h);
export const aspectDiff = (a: number, b: number) => Math.abs(Math.log(a / b));

export function templateAspect(model: Pick<DielineModel, "sheet">): number {
  return aspectOf(model.sheet.width, model.sheet.height);
}

export function checkArtworkFit(model: Pick<DielineModel, "sheet">, img: { pxWidth: number; pxHeight: number }): FitCheck {
  const imageAspect = aspectOf(img.pxWidth, img.pxHeight);
  const tpl = templateAspect(model);
  const diff = aspectDiff(imageAspect, tpl);
  const verdict: FitVerdict = diff <= FIT_TOLERANCE ? "fits" : diff <= NEAR_TOLERANCE ? "near" : "off";
  const cropShare = 1 - Math.min(imageAspect, tpl) / Math.max(imageAspect, tpl);
  const dpi = sheetImagePlacement(model, img).pxPerMm * 25.4;
  return {
    verdict,
    imageAspect,
    templateAspect: tpl,
    diff,
    cropShare,
    cropEdge: verdict === "fits" ? null : imageAspect > tpl ? "sides" : "topBottom",
    dpi,
    dpiLevel: dpi < DPI_ERROR ? "error" : dpi < DPI_WARNING ? "warning" : "ok",
    goodSizeMm: { width: (img.pxWidth / DPI_WARNING) * 25.4, height: (img.pxHeight / DPI_WARNING) * 25.4 },
  };
}

/** What the fit search needs of a library box model (BoxModelDef satisfies it). */
export interface FitModel {
  code: string;
  kind: "box";
  family: StructureFamily;
  /** Library group (BOXES, CARTONS…): with the family, what "a box like this one" means. */
  group?: string;
  limits: StructureParamLimits;
  defaultDims: Dims;
  presets: DimsPreset[];
  materials: MaterialCode[];
  build(dims: Dims, opts: { thicknessMm: number; features?: StructureFeatures }): Pick<DielineModel, "sheet">;
}

export interface FitSuggestion {
  code: string;
  dims: Dims;
  aspect: number;
  diff: number;
  /** A standard (preset) size: cheaper and faster. */
  standard: boolean;
  /** Which of L, W, H moved from the starting size (same-model solve). */
  changed: ("L" | "W" | "H")[];
  /** How far the size moved (sum of relative changes per axis). */
  change: number;
  sameFamily: boolean;
}

const AXES = ["L", "W", "H"] as const;

export function thicknessFor(m: Pick<FitModel, "materials">, material: MaterialCode): number {
  const code = m.materials.includes(material) ? material : m.materials[0];
  return BOARD_SPECS[code]?.thicknessMm ?? 1.5;
}

/** Template aspect of a model at a size, or NaN when the size does not build. */
export function aspectAt(m: FitModel, dims: Dims, thicknessMm: number, features?: StructureFeatures): number {
  try {
    const s = m.build(dims, { thicknessMm, features }).sheet;
    return s.width > 0 && s.height > 0 ? s.width / s.height : NaN;
  } catch {
    return NaN;
  }
}

const roundDims = (d: Dims): Dims => ({ L: Math.round(d.L), W: Math.round(d.W), H: Math.round(d.H) });
const relChange = (a: Dims, b: Dims) => AXES.reduce((s, k) => s + Math.abs(a[k] - b[k]) / Math.max(1, b[k]), 0);

/**
 * Solve one axis of `from` (inside the model's limits) so the template aspect equals `target`.
 * Sampled scan for a sign change, then bisection; the root nearest the starting value wins.
 */
export function solveAxis(m: FitModel, from: Dims, axis: "L" | "W" | "H", target: number, thicknessMm: number, features?: StructureFeatures, samples = 14): Dims | null {
  const { min, max } = m.limits[axis];
  if (!(max > min)) return null;
  const g = (x: number) => {
    const a = aspectAt(m, { ...from, [axis]: x }, thicknessMm, features);
    return Number.isFinite(a) ? Math.log(a / target) : NaN;
  };
  let best: number | null = null;
  let prevX = min;
  let prevG = g(min);
  for (let i = 1; i <= samples; i++) {
    const x = min + ((max - min) * i) / samples;
    const gx = g(x);
    if (Number.isFinite(prevG) && Number.isFinite(gx) && Math.sign(prevG) !== Math.sign(gx)) {
      let lo = prevX;
      let hi = x;
      let glo = prevG;
      for (let k = 0; k < 10; k++) {
        const mid = (lo + hi) / 2;
        const gm = g(mid);
        if (!Number.isFinite(gm)) break;
        if (Math.sign(gm) === Math.sign(glo)) {
          lo = mid;
          glo = gm;
        } else hi = mid;
      }
      const root = (lo + hi) / 2;
      if (best === null || Math.abs(root - from[axis]) < Math.abs(best - from[axis])) best = root;
    }
    prevX = x;
    prevG = gx;
  }
  if (best === null) return null;
  return roundDims({ ...from, [axis]: Math.min(max, Math.max(min, best)) });
}

function suggestion(m: FitModel, dims: Dims, target: number, thicknessMm: number, features: StructureFeatures | undefined, from: Dims, sameFamily: boolean, standard: boolean): FitSuggestion | null {
  const aspect = aspectAt(m, dims, thicknessMm, features);
  if (!Number.isFinite(aspect)) return null;
  const diff = aspectDiff(aspect, target);
  if (diff > FIT_TOLERANCE) return null;
  return { code: m.code, dims, aspect, diff, standard, changed: AXES.filter((k) => dims[k] !== from[k]), change: relChange(dims, from), sameFamily };
}

/**
 * The same model at other sizes whose template matches `target`, best first: standard sizes,
 * then sizes that keep the height, then the smallest change.
 */
export function solveModelDims(m: FitModel, from: Dims, target: number, opts: { material: MaterialCode; features?: StructureFeatures }): FitSuggestion[] {
  const th = thicknessFor(m, opts.material);
  const out: FitSuggestion[] = [];
  for (const p of m.presets) {
    const s = suggestion(m, roundDims(p.dims), target, th, opts.features, from, true, true);
    if (s) out.push(s);
  }
  for (const axis of AXES) {
    const d = solveAxis(m, from, axis, target, th, opts.features);
    const s = d && suggestion(m, d, target, th, opts.features, from, true, false);
    if (s) out.push(s);
  }
  return rankSame(dedupe(out));
}

function dedupe(list: FitSuggestion[]): FitSuggestion[] {
  const seen = new Set<string>();
  return list.filter((s) => {
    const k = `${s.code}:${s.dims.L}x${s.dims.W}x${s.dims.H}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

const keepsHeight = (s: FitSuggestion) => (s.changed.includes("H") ? 1 : 0);
function rankSame(list: FitSuggestion[]): FitSuggestion[] {
  return list.sort((a, b) => Number(b.standard) - Number(a.standard) || keepsHeight(a) - keepsHeight(b) || a.change - b.change || a.diff - b.diff);
}

/**
 * Fast one-axis solve for the library scan: a sheet's width and height grow almost linearly with
 * each dimension, so a few secant steps (about six builds) land on the root when there is one.
 */
export function secantAxis(m: FitModel, from: Dims, axis: "L" | "W" | "H", target: number, thicknessMm: number, features?: StructureFeatures): Dims | null {
  const { min, max } = m.limits[axis];
  if (!(max > min)) return null;
  const clamp = (x: number) => Math.min(max, Math.max(min, x));
  const g = (x: number) => {
    const a = aspectAt(m, { ...from, [axis]: x }, thicknessMm, features);
    return Number.isFinite(a) ? Math.log(a / target) : NaN;
  };
  let x0 = clamp(from[axis]);
  let x1 = clamp(x0 + (max - min) * 0.1 * (x0 + (max - min) * 0.1 > max ? -1 : 1));
  let g0 = g(x0);
  let g1 = g(x1);
  for (let i = 0; i < 5; i++) {
    if (!Number.isFinite(g0) || !Number.isFinite(g1) || g1 === g0) return null;
    if (Math.abs(g1) <= FIT_TOLERANCE / 4) break;
    const x2 = clamp(x1 - (g1 * (x1 - x0)) / (g1 - g0));
    if (Math.abs(x2 - x1) < 0.25) break;
    x0 = x1;
    g0 = g1;
    x1 = x2;
    g1 = g(x2);
  }
  return Number.isFinite(g1) && Math.abs(g1) <= FIT_TOLERANCE ? roundDims({ ...from, [axis]: x1 }) : null;
}

/** Best match of one other model: a standard size, its default size, then a one-axis solve. */
export function matchModel(m: FitModel, target: number, opts: { material: MaterialCode; family: StructureFamily | null; group?: string; solve?: boolean }): FitSuggestion | null {
  const th = thicknessFor(m, opts.material);
  const sameFamily = m.family === opts.family && (!opts.group || m.group === opts.group);
  const from = m.defaultDims;
  const found: FitSuggestion[] = [];
  for (const p of m.presets) {
    const s = suggestion(m, roundDims(p.dims), target, th, undefined, from, sameFamily, true);
    if (s) found.push(s);
  }
  const d = suggestion(m, roundDims(from), target, th, undefined, from, sameFamily, false);
  if (d) found.push(d);
  if (!found.length && opts.solve !== false) {
    for (const axis of ["L", "H"] as const) {
      const sd = secantAxis(m, from, axis, target, th);
      const s = sd && suggestion(m, sd, target, th, undefined, from, sameFamily, false);
      if (s) {
        found.push(s);
        break;
      }
    }
  }
  return found.sort((a, b) => Number(b.standard) - Number(a.standard) || a.change - b.change || a.diff - b.diff)[0] ?? null;
}

/** Other-model results, best first: same family, closest size (to `ref` when given), standard size, closest aspect. */
export function rankOthers(list: FitSuggestion[], limit = 3): FitSuggestion[] {
  // Size closeness in coarse steps (25 % of summed change), so a standard size wins among similar sizes.
  const step = (s: FitSuggestion) => Math.round(s.change / 0.25);
  return [...list].sort((a, b) => Number(b.sameFamily) - Number(a.sameFamily) || step(a) - step(b) || Number(b.standard) - Number(a.standard) || a.change - b.change || a.diff - b.diff).slice(0, limit);
}

/**
 * Scan other models in short slices, yielding between slices so the page stays responsive, until
 * done or `budgetMs` runs out. Pass 1 tries every model's standard and default sizes (cheap);
 * pass 2 solves one axis for the models still without a match, same family first.
 */
export async function scanModels(
  models: readonly FitModel[],
  target: number,
  opts: { material: MaterialCode; family: StructureFamily | null; group?: string; skip?: string; ref?: Dims; budgetMs?: number; sliceMs?: number; now?: () => number; yieldFn?: () => Promise<void>; signal?: { aborted: boolean } },
): Promise<{ matches: FitSuggestion[]; scanned: number; complete: boolean }> {
  const now = opts.now ?? (() => (typeof performance !== "undefined" ? performance.now() : Date.now()));
  const yieldFn = opts.yieldFn ?? (() => new Promise<void>((r) => setTimeout(r, 0)));
  const start = now();
  const budget = opts.budgetMs ?? 2000;
  const slice = opts.sliceMs ?? 12;
  let sliceStart = now();
  const matches: FitSuggestion[] = [];
  const near = (m: FitModel) => Number(m.family === opts.family) + Number(!!opts.group && m.group === opts.group);
  const list = models.filter((m) => m.code !== opts.skip).sort((a, b) => near(b) - near(a));
  const solveLater: FitModel[] = [];
  let scanned = 0;
  const stop = () => !!opts.signal?.aborted || now() - start > budget;
  const breathe = async () => {
    if (now() - sliceStart > slice) {
      await yieldFn();
      sliceStart = now();
    }
  };
  for (const m of list) {
    if (stop()) return { matches: rankOthers(matches), scanned, complete: false };
    scanned++;
    const s = matchModel(m, target, { ...opts, solve: false });
    if (s) matches.push(opts.ref ? { ...s, change: relChange(s.dims, opts.ref) } : s);
    else solveLater.push(m);
    await breathe();
  }
  for (const m of solveLater) {
    if (stop()) return { matches: rankOthers(matches), scanned, complete: false };
    const s = matchModel(m, target, opts);
    if (s) matches.push(opts.ref ? { ...s, change: relChange(s.dims, opts.ref) } : s);
    await breathe();
  }
  return { matches: rankOthers(matches), scanned, complete: true };
}
