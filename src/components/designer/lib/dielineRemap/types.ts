import type { Dims, FaceId, PrintSurface } from "@/types";
import type { Affine } from "@/lib/dieline";

/**
 * Panel remap types (designer: full artwork from the buyer's own printer template). Pure data:
 * everything here crosses the Web Worker boundary and is stored with the design.
 */

/** RGBA pixels (ImageData-compatible). */
export interface RgbaImage {
  data: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
}

/** Axis-aligned rectangle, x0 < x1 and y0 < y1. */
export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** How one target panel's pixels were found. */
export type PanelVia =
  /** a source panel sits at the same place of the closed box (closed-pose match) */
  | "match"
  /** one of the six visible faces, found by topology (no library model matched) */
  | "face"
  /** no counterpart: the parent panel's art mirrored across the fold (hidden when closed) */
  | "reflect"
  /** nothing to take from: the mean colour of the art */
  | "fill";

/** One way to fill a target panel: target sheet mm → source image px, then clamp to `clamp`. */
export interface PanelMap {
  A: Affine;
  /** The source panel's area (px): samples are clamped inside it (edge extend). */
  clamp: Box;
  /** Source panels adjacent across a fold: bleed may sample into these unclamped. */
  across: Box[];
  /** Source panel id (candidate model) or face, for the report. */
  source: string;
}

export interface PanelPlan {
  panelId: string;
  via: PanelVia;
  maps: PanelMap[];
}

/** What the remap was made from, stored with the sheet image so it can run again on a new size. */
export interface RemapSource {
  mode: "model" | "faces";
  /** Candidate model code (mode "model"). */
  code?: string;
  /** Candidate inner dims the transform belongs to (mode "model"). */
  fitDims?: Dims;
  /** Candidate sheet mm → original image px (mode "model"). */
  transform?: Affine;
  /** Candidate panel boxes after snapping to the art's lines, candidate sheet mm (mode "model"). */
  snapped?: Record<string, [number, number, number, number]>;
  /** The six faces in original image px with their upright frames (mode "faces"). */
  faces?: Partial<Record<FaceId, SourceFace>>;
  /** Width of the die lines in original px (they are painted out before sampling). */
  lineWidthPx: number;
  /** Die lines (original px), painted out of the source before sampling. */
  lines: [number, number, number, number][];
  /** Die colour (hex) the lines are drawn in. */
  lineColor?: string;
}

/**
 * A visible face found in the art: its corner where the face's own top-left is, and the unit
 * axes (image px) of the face's "right" and "down" as seen from outside the closed box.
 */
export interface SourceFace {
  origin: { x: number; y: number };
  right: { x: number; y: number };
  down: { x: number; y: number };
  width: number;
  height: number;
}

/** Remap request for one printed surface. */
export interface RemapRequest {
  surface: PrintSurface;
  source: RemapSource;
  /** Output density, px per target sheet mm. */
  pxPerMm: number;
}

export interface RemapReport {
  panels: { panelId: string; via: PanelVia; source?: string }[];
  /** Output size (px) and density. */
  width: number;
  height: number;
  pxPerMm: number;
  /** Source px per target mm on the visible faces (the real print resolution). */
  sourcePxPerMm: number;
  ms: number;
}
