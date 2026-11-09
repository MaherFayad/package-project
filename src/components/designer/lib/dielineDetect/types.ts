import type { Dims, StructureFeatures, StructureParamLimits, DimsPreset, LocalizedText, MaterialCode } from "@/types";
import type { Affine, DielineModel } from "@/lib/dieline";

/**
 * Dieline detector types (designer: full artwork). Pure data, no DOM: everything here crosses a
 * Web Worker boundary with structured clone.
 */

/** RGBA pixels (ImageData-compatible: `ctx.getImageData(...)` passes straight in). */
export interface RgbaImage {
  data: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
}

/** What the detector needs of a library box model (`BoxModelDef` satisfies it). */
export interface DetectModel {
  code: string;
  slug?: string;
  name?: LocalizedText;
  kind?: string;
  limits: StructureParamLimits;
  defaultDims: Dims;
  presets: DimsPreset[];
  materials?: MaterialCode[];
  build(dims: Dims, opts: { thicknessMm: number; features?: StructureFeatures }): DielineModel;
}

export interface DetectOptions {
  /** Box models to match against (`await loadBoxModels()`). Empty or missing: lines only. */
  models?: readonly DetectModel[];
  /** Image resolution from file metadata (`readImageDpi`). Ignored unless plausible (100..2400). */
  dpi?: number | null;
  /** Known scale (image px per mm), e.g. from a measurement the buyer typed. Wins over `dpi`. */
  pxPerMm?: number | null;
  /** How many ranked candidates to return (default 5). */
  maxCandidates?: number;
  /** Debug: keep the working rasters in the result (`debug`). */
  debug?: boolean;
}

/** Image pixel space of the uploaded image (full resolution, x right, y down). */
export interface PxSeg {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface DetectedLine extends PxSeg {
  orientation: "h" | "v";
  /** Share of the line's length that is inked: about 1 for a solid cut, lower for a dashed crease. */
  fill: number;
  kind: "cut" | "crease";
}

export interface DetectedLines {
  /** Stroke colours found (hex, dominant first). */
  colors: string[];
  /** Small rotation of the artwork, degrees (lines were deskewed by this before matching). */
  skewDeg: number;
  /** Straight axis-aligned strokes, image px. */
  segments: DetectedLine[];
  /** Die outline's bounding box (deskewed frame mapped back to image px, as 4 corners). */
  dieBox: { x: number; y: number }[] | null;
  /** Distinct vertical / horizontal line positions found (count), a quick structure summary. */
  distinctX: number;
  distinctY: number;
  /** Stroke pixels found / image pixels. */
  inkShare: number;
}

export interface DetectCandidate {
  code: string;
  slug?: string;
  name?: string;
  nameAr?: string;
  /** Inner dims (mm). Absolute only when `scaleKnown`; otherwise proportions at a likely size. */
  dims: Dims;
  /** Fitted proportions, longest dimension = 1. */
  proportions: Dims;
  /** 0..1, higher is better. */
  score: number;
  scaleKnown: boolean;
  /** 0..7: rotation (k × 90° clockwise, low 2 bits) and mirror (bit 2) of the template on the art. */
  orientation: number;
  why: string;
  /** Part scores (0..1). */
  parts: { lines: number; chamferModel: number; chamferImage: number; silhouette: number };
}

/** The top candidate's template in the image's pixel space, to draw over the upload. */
export interface DetectOverlay {
  code: string;
  dims: Dims;
  /** Sheet mm (DielineModel space) → image px, canvas `setTransform` order. */
  transform: Affine;
  cut: PxSeg[];
  crease: PxSeg[];
  perf: PxSeg[];
  /** Die outline polygons (one per panel), image px. */
  panels: { x: number; y: number }[][];
}

export interface DetectResult {
  found: boolean;
  lines: DetectedLines;
  candidates: DetectCandidate[];
  overlay: DetectOverlay | null;
  /** px per mm used for absolute sizes (from metadata), null when unknown. */
  pxPerMm: number | null;
  timings: Record<string, number>;
  debug?: {
    work: { w: number; h: number; f: number };
    /** Deskewed stroke mask (working res). */
    lineMask: Uint8Array;
    /** Coarse grid the silhouette and raster checks use (working px per cell: q). */
    grid: { w: number; h: number; q: number };
    /** Die silhouette (grid res). */
    silhouette: Uint8Array | null;
    ranks?: { prefilter: string[]; fit: string[] };
    det?: unknown;
  };
}
