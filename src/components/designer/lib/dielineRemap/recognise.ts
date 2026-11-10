import type { DielineModel } from "@/lib/dieline";
import type { Dims, PrintSurface } from "@/types";
import { FOUND_SCORE, detectDieline } from "../dielineDetect/detect";
import { geoOf } from "../dielineDetect/match";
import type { DetectCandidate, DetectModel, DetectResult } from "../dielineDetect/types";
import { faceLinesOf, findFaces } from "./faces";
import { remapSheet, remapSourceFrom, scaleSource } from "./index";
import { faceAgreement, rankScore } from "./rank";
import type { RemapReport, RemapSource, RgbaImage } from "./types";

/** One recognised box for the designer's card. */
export interface Recognised {
  code: string;
  slug?: string;
  name?: string;
  nameAr?: string;
  /** Inner dims (mm) to apply; proportions × a likely size when the scale is unknown. */
  dims: Dims;
  proportions: Dims;
  scaleKnown: boolean;
  score: number;
  /** Face agreement 0..1 (null when the faces could not be read by topology). */
  agreement: number | null;
  rank: number;
  /** What to remap from when this one is applied (original image px). */
  source: RemapSource;
}

export interface RecogniseResult {
  /** A model scored at least FOUND_SCORE: `matches[0]` is it. */
  found: boolean;
  /** Up to 4, best first. */
  matches: Recognised[];
  /** What drove the sheet: the best match, or the six faces found by topology, or nothing. */
  source: RemapSource | null;
  /** Re-composed sheet for the open model, or null when nothing could be read. */
  image: RgbaImage | null;
  report: RemapReport | null;
  timings: Record<string, number>;
  lines: DetectResult["lines"];
}

/** Library models a full printed sheet can be: fittings (pads, dividers) go inside another box. */
export const recognisable = (m: DetectModel) => (m as { source?: string }).source !== "fefco-09";

/** Any `RemapSource` in original px, back to the working image's px. */
export function sourceAt(src: RemapSource, scale: number): RemapSource {
  return scaleSource(src, scale);
}

/**
 * Detect, rank for the designer, and re-compose the sheet for the open model (`target`), all in
 * one go (the Web Worker's "recognise"). `image` is the working copy (`imageForDetection`);
 * `scale` = its px / the stored original's px, so every stored transform is in original px.
 */
export function recognise(
  image: RgbaImage,
  opts: { models: readonly DetectModel[]; dpi?: number | null; pxPerMm?: number | null; surface: PrintSurface; target: DielineModel | null; scale?: number },
): RecogniseResult {
  const scale = opts.scale ?? 1;
  const models = opts.models.filter(recognisable);
  const res = detectDieline(image, { models, dpi: opts.dpi, pxPerMm: opts.pxPerMm, maxCandidates: 8 });
  const t0 = now();
  const faces = findFaces(faceLinesOf(res.lines.segments), opts.surface === "inside");
  const byCode = new Map(models.map((m) => [m.code, m]));
  const ranked: (Recognised & { cand: DetectCandidate; model: DielineModel })[] = [];
  for (const c of res.candidates) {
    const m = byCode.get(c.code);
    const model = m ? geoOf(m, c.fitDims)?.model : null;
    if (!m || !model) continue;
    const agreement = faceAgreement(model, c.transform, faces);
    const source = remapSourceFrom(res, c, model, image, opts.surface, scale);
    if (!source) continue;
    const r = snapRatios(model, source.snapped ?? {});
    const dims = { L: Math.round(c.dims.L * r.L * 10) / 10, W: Math.round(c.dims.W * r.W * 10) / 10, H: Math.round(c.dims.H * r.H * 10) / 10 };
    if (!c.scaleKnown) for (const k of ["L", "W", "H"] as const) dims[k] = Math.round(dims[k]);
    const mx = Math.max(dims.L, dims.W, dims.H);
    const proportions = { L: r3(dims.L / mx), W: r3(dims.W / mx), H: r3(dims.H / mx) };
    ranked.push({ code: c.code, slug: c.slug, name: c.name, nameAr: c.nameAr, dims, proportions, scaleKnown: c.scaleKnown, score: c.score, agreement, rank: rankScore(c.score, agreement), source, cand: c, model });
  }
  ranked.sort((a, b) => (Math.abs(a.rank - b.rank) > 0.003 ? b.rank - a.rank : 0));
  const found = !!ranked.length && ranked[0].score >= FOUND_SCORE && (ranked[0].agreement == null || ranked[0].agreement >= 0.35);
  const source = found ? ranked[0].source : remapSourceFrom(res, null, null, image, opts.surface, scale);
  let out: RgbaImage | null = null;
  let report: RemapReport | null = null;
  if (source && opts.target) {
    const r = remapSheet(image, opts.target, scaleSource(source, scale), found ? ranked[0].model : null, { surface: opts.surface });
    out = r.image;
    report = r.report;
  }
  const timings = { ...res.timings, remap: Math.round(now() - t0) };
  return {
    found,
    matches: ranked.slice(0, 4).map((r) => ({ code: r.code, slug: r.slug, name: r.name, nameAr: r.nameAr, dims: r.dims, proportions: r.proportions, scaleKnown: r.scaleKnown, score: r.score, agreement: r.agreement, rank: r.rank, source: r.source })),
    source,
    image: out,
    report,
    timings,
    lines: res.lines,
  };
}

/** The candidate model a stored model-mode source was fitted with. */
export function candidateModelOf(src: RemapSource, models: readonly DetectModel[]): DielineModel | null {
  if (src.mode !== "model" || !src.code || !src.fitDims) return null;
  const m = models.find((x) => x.code === src.code);
  return m ? (geoOf(m, src.fitDims)?.model ?? null) : null;
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;

/**
 * How much the art's own panels differ from the fitted template's, per dimension: the lid's two
 * sides (L, W) and the front wall's height (H), after snapping to the drawn lines. The detector's
 * fit balances every line of the die; the faces are what the buyer measures.
 */
export function snapRatios(model: DielineModel, snapped: Record<string, [number, number, number, number]>): Dims {
  const extent = (face: "top" | "front", axis: "x" | "y"): number | null => {
    const info = model.faces[face];
    if (!info?.parts.length) return null;
    const part = [...info.parts].sort((a, b) => b.rect.width * b.rect.height - a.rect.width * a.rect.height)[0];
    const p = model.panels.find((q) => q.id === part.panelId);
    const sn = snapped[part.panelId];
    if (!p || !sn) return null;
    const t = part.transform;
    // the sheet axis this face axis runs along
    const sheetX = axis === "x" ? Math.abs(t[0]) >= Math.abs(t[1]) : Math.abs(t[2]) >= Math.abs(t[3]);
    const r = sheetX ? (sn[2] - sn[0]) / p.bbox.width : (sn[3] - sn[1]) / p.bbox.height;
    return r > 0.8 && r < 1.25 ? r : null;
  };
  return { L: extent("top", "x") ?? 1, W: extent("top", "y") ?? 1, H: extent("front", "y") ?? 1 };
}

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
