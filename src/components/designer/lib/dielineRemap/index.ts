/**
 * Panel remap (designer: full artwork made on the buyer's own printer template).
 *
 * The detector (../dielineDetect) says which library box the uploaded dieline is and where its
 * template sits on the art. This module turns that into a new sheet image in Elba's template
 * layout, so the CLOSED 3D box, preflight and the print PDF (Elba's printer cuts Elba's die) all
 * show every visible face with the right part of the art:
 *
 *   const source = remapSourceFrom(res, res.candidates[0], candidateModel, detectionImage, "outside", scale);
 *   const { image, report } = remapSheet(originalPixels, elbaModel, source, candidateModel, { surface: "outside" });
 *
 * 1. The candidate's panels are snapped to the lines drawn on the art (another tuck depth or flap
 *    shape still maps edge to edge).
 * 2. Each of Elba's panels takes the source panel at the same place of the closed box (fold poses,
 *    normalised to a unit cube): front from front, lid from lid, a rolled-in wall from the art's
 *    rolled-in wall. Panels with no counterpart get their parent's art mirrored across the fold.
 * 3. The die lines are painted out of the art, then the sheet is re-composed with bleed past every
 *    edge. No model matched: the six faces are found by topology instead (./faces.ts).
 *
 * Pure TS (no DOM): runs in the detector's Web Worker and in Node tests.
 */
import type { DielineModel } from "@/lib/dieline";
import type { PrintSurface } from "@/types";
import type { DetectCandidate, DetectResult } from "../dielineDetect/types";
import { composeSheet, estimateLineWidth, paintOutLines } from "./compose";
import { planFromFaces, planFromModel, snapPanels } from "./correspond";
import { faceLinesOf, findFaces } from "./faces";
import type { PanelPlan, RemapReport, RemapSource, RgbaImage } from "./types";

export type * from "./types";
export { pairPanels, closedFrames, snapPanels, planFromModel, planFromFaces, invertAffine } from "./correspond";
export { composeSheet, paintOutLines, estimateLineWidth, meanColour } from "./compose";
export { findFaces, rectCells, faceLinesOf } from "./faces";
export { faceAgreement, rankScore } from "./rank";

/** Longest side of a re-composed sheet (same cap as a full artwork upload). */
export const REMAP_MAX_PX = 7000;
/** Densest output (px per mm): finer than this adds nothing on a 3D view or at 300 dpi. */
const MAX_PX_PER_MM = 12;
/** Least output density: enough for crisp panel edges in 3D even from a small upload. */
const MIN_PX_PER_MM = 3;

/** True when the die is the same mirrored left to right (most mailers and trays). */
export function mirrorSymmetric(model: DielineModel): boolean {
  const cx = model.dieBounds.x + model.dieBounds.width / 2;
  const tol = 0.01 * Math.max(model.dieBounds.width, model.dieBounds.height);
  // a mirror swaps the left and right walls
  const twin = (r: string) => (r === "left" ? "right" : r === "right" ? "left" : r);
  return model.panels.every((p) => {
    const mx = 2 * cx - (p.bbox.x + p.bbox.width);
    return model.panels.some((q) => q.role === twin(p.role) && Math.abs(q.bbox.x - mx) <= tol && Math.abs(q.bbox.y - p.bbox.y) <= tol && Math.abs(q.bbox.width - p.bbox.width) <= tol && Math.abs(q.bbox.height - p.bbox.height) <= tol);
  });
}

/**
 * What to remap from, in the ORIGINAL image's pixels (`scale` = detection px / original px, as
 * `imageForDetection` returns it). `candidate` and its model (built at `candidate.fitDims`) give the
 * model mode; without them, or when the faces mode is asked for, the faces are found by topology.
 * Inside prints are taken as drawn on the inside template (mirrored); when the die is the same
 * both ways round the detector cannot tell, so that reading wins.
 */
export function remapSourceFrom(
  res: Pick<DetectResult, "lines">,
  candidate: Pick<DetectCandidate, "code" | "fitDims" | "transform"> | null,
  candidateModel: DielineModel | null,
  detectionImage: RgbaImage,
  surface: PrintSurface,
  scale = 1,
): RemapSource | null {
  const k = 1 / (scale || 1);
  const detLines = res.lines.segments.map((s) => [s.x1, s.y1, s.x2, s.y2] as [number, number, number, number]);
  const lines = detLines.map((l) => l.map((v) => Math.round(v * k * 100) / 100) as [number, number, number, number]);
  const lineColor = res.lines.colors[0];
  const lineWidthPx = Math.round(estimateLineWidth(detectionImage, detLines, lineColor) * k * 100) / 100;
  if (candidate && candidateModel) {
    const T0 = candidate.transform;
    let T: typeof T0 = [T0[0] * k, T0[1] * k, T0[2] * k, T0[3] * k, T0[4] * k, T0[5] * k];
    const det = T[0] * T[3] - T[1] * T[2];
    const wantMirror = surface === "inside";
    if (det < 0 !== wantMirror && mirrorSymmetric(candidateModel)) {
      // Same die either way round: read the art the way its slot expects (outside as seen from
      // outside, inside as seen from inside), so left and right walls get the right art.
      const W2 = 2 * (candidateModel.dieBounds.x + candidateModel.dieBounds.width / 2);
      T = [-T[0], -T[1], T[2], T[3], T[0] * W2 + T[4], T[1] * W2 + T[5]];
    }
    return { mode: "model", code: candidate.code, fitDims: candidate.fitDims, transform: T.map(r6) as typeof T, snapped: snapPanels(candidateModel, T, lines), lineWidthPx, lines, lineColor };
  }
  const faces = findFaces(faceLinesOf(res.lines.segments), surface === "inside");
  if (!faces || !faces.top || !faces.bottom) return null;
  return { mode: "faces", faces, lineWidthPx, lines, lineColor };
}

const r6 = (v: number) => Math.round(v * 1e6) / 1e6;

/** Source px per target mm on the visible faces (median), the art's real print density. */
function sourceDensity(target: DielineModel, plans: PanelPlan[]): number {
  const faceIds = new Set(Object.values(target.faces).flatMap((f) => f?.parts.map((p) => p.panelId) ?? []));
  const d = plans
    .filter((p) => faceIds.has(p.panelId) && p.maps.length && p.via !== "reflect")
    .map((p) => Math.sqrt(Math.abs(p.maps[0].A[0] * p.maps[0].A[3] - p.maps[0].A[1] * p.maps[0].A[2])))
    .sort((a, b) => a - b);
  return d.length ? d[Math.floor(d.length / 2)] : 0;
}

export interface RemapOptions {
  surface: PrintSurface;
  /** Output density; default: the art's own, at least 3 px/mm, at most 12 px/mm or 7000 px. */
  pxPerMm?: number;
}

/** Re-compose one printed surface of `target` from the original art. */
export function remapSheet(original: RgbaImage, target: DielineModel, source: RemapSource, candidateModel: DielineModel | null, opts: RemapOptions): { image: RgbaImage; report: RemapReport; plans: PanelPlan[] } {
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  const plans = source.mode === "model" && candidateModel ? planFromModel(target, candidateModel, source, opts.surface) : planFromFaces(target, source);
  const density = sourceDensity(target, plans);
  const cap = REMAP_MAX_PX / Math.max(target.sheet.width, target.sheet.height);
  const pxPerMm = opts.pxPerMm ?? Math.min(cap, MAX_PX_PER_MM, Math.max(MIN_PX_PER_MM, density));
  const clean = paintOutLines(original, source.lines, source.lineWidthPx);
  const image = composeSheet(clean, target, plans, { surface: opts.surface, pxPerMm });
  const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();
  return {
    image,
    plans,
    report: {
      panels: plans.map((p) => ({ panelId: p.panelId, via: p.via, source: p.maps[0]?.source })),
      width: image.width,
      height: image.height,
      pxPerMm: Math.round(pxPerMm * 1000) / 1000,
      sourcePxPerMm: Math.round(density * 1000) / 1000,
      ms: Math.round(t1 - t0),
    },
  };
}

/** A source in original px, at another pixel scale (`k` = new px / original px). */
export function scaleSource(src: RemapSource, k: number): RemapSource {
  if (k === 1) return src;
  const pt = (p: { x: number; y: number }) => ({ x: p.x * k, y: p.y * k });
  return {
    ...src,
    transform: src.transform ? (src.transform.map((v) => v * k) as typeof src.transform) : undefined,
    lineWidthPx: src.lineWidthPx * k,
    lines: src.lines.map((l) => l.map((v) => v * k) as [number, number, number, number]),
    faces: src.faces
      ? Object.fromEntries(Object.entries(src.faces).map(([f, v]) => [f, v && { ...v, origin: pt(v.origin), width: v.width * k, height: v.height * k }]))
      : undefined,
  };
}
