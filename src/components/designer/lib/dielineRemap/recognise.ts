import type { DielineModel } from "@/lib/dieline";
import type { Dims, PrintSurface } from "@/types";
import { FOUND_SCORE, detectDieline } from "../dielineDetect/detect";
import { geoOf } from "../dielineDetect/match";
import type { DetectCandidate, DetectModel, DetectResult } from "../dielineDetect/types";
import { findFaces } from "./faces";
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
  const lineList = res.lines.segments.map((s) => [s.x1, s.y1, s.x2, s.y2] as [number, number, number, number]);
  const size = Math.max(1, ...lineList.flatMap((l) => [Math.abs(l[2] - l[0]), Math.abs(l[3] - l[1])]));
  const faces = findFaces(
    lineList.filter((l, i) => res.lines.segments[i].fill >= 0.75 || Math.hypot(l[2] - l[0], l[3] - l[1]) >= 0.2 * size),
    opts.surface === "inside",
  );
  const byCode = new Map(models.map((m) => [m.code, m]));
  const ranked: (Recognised & { cand: DetectCandidate; model: DielineModel })[] = [];
  for (const c of res.candidates) {
    const m = byCode.get(c.code);
    const model = m ? geoOf(m, c.fitDims)?.model : null;
    if (!m || !model) continue;
    const agreement = faceAgreement(model, c.transform, faces);
    const source = remapSourceFrom(res, c, model, image, opts.surface, scale);
    if (!source) continue;
    ranked.push({ code: c.code, slug: c.slug, name: c.name, nameAr: c.nameAr, dims: c.dims, proportions: c.proportions, scaleKnown: c.scaleKnown, score: c.score, agreement, rank: rankScore(c.score, agreement), source, cand: c, model });
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

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
