import type { Dims, FaceId, PrintSurface, StructureCode, StructureFeatures } from "./structure";
import type { FinishCode, MaterialCode, PrintSides } from "./material";

/**
 * Artwork layer placed on ONE face of the box.
 * Coordinates are in millimetres relative to the face's top-left corner
 * (x to the right, y down, as seen from outside the closed box; never mirrored in RTL).
 * (x, y) is the CENTRE of the layer. rotation is degrees clockwise.
 * Because positions are face-relative, layers survive dimension changes; the designer
 * should clamp/scale layers that fall outside the face after a resize.
 */
interface LayerBase {
  id: string;
  face: FaceId;
  surface: PrintSurface;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity?: number; // 0..1, default 1
  locked?: boolean;
  hidden?: boolean;
}

export interface ImageLayer extends LayerBase {
  kind: "image";
  /** Data URL (unsaved) or uploaded asset URL. */
  src: string;
  /** Intrinsic pixel size, used by preflight to compute effective DPI. */
  pxWidth: number;
  pxHeight: number;
  fit?: "contain" | "cover" | "stretch";
}

export interface TextLayer extends LayerBase {
  kind: "text";
  text: string;
  fontFamily: "IBM Plex Sans Arabic" | "Inter";
  fontSizePt: number;
  fontWeight: 400 | 500 | 600 | 700;
  color: string; // #RRGGBB
  align: "start" | "center" | "end";
  direction: "rtl" | "ltr" | "auto";
}

export interface ShapeLayer extends LayerBase {
  kind: "shape";
  shape: "rect" | "ellipse" | "line";
  fill: string | null; // #RRGGBB
  stroke: string | null;
  strokeWidthMm: number;
}

export type ArtworkLayer = ImageLayer | TextLayer | ShapeLayer;
export type ArtworkLayerKind = ArtworkLayer["kind"];

/** Per printed surface: a background colour + ordered layers (index 0 = bottom). */
export interface ArtworkSurface {
  background: string | null; // #RRGGBB or null = bare board colour
  layers: ArtworkLayer[];
}

/** Stored in Design.artwork (Json). */
export interface Artwork {
  outside: ArtworkSurface;
  inside: ArtworkSurface; // ignored for pricing/printing unless printSides === "BOTH"
}

/**
 * The full serialisable design document. This is what the designer edits, what is
 * saved (Design row columns + artwork Json), what a Proof snapshots and hashes, and
 * what the pricing engine and dieline engine consume.
 */
export interface DesignDoc {
  v: 1;
  id?: string; // DB id once saved
  name: string;
  structureCode: StructureCode;
  dims: Dims;
  materialCode: MaterialCode;
  finishCode: FinishCode;
  printSides: PrintSides;
  artwork: Artwork;
  /** Optional structure features (window, handle, partitions…). Absent = none. */
  features?: StructureFeatures;
}

export function emptyArtwork(): Artwork {
  return {
    outside: { background: null, layers: [] },
    inside: { background: null, layers: [] },
  };
}

/** Preflight results the designer shows ("Ready to print" when no errors). */
export type PreflightSeverity = "error" | "warning" | "info";
export interface PreflightIssue {
  code:
    | "LOW_DPI"
    | "OUTSIDE_SAFE_ZONE"
    | "CROSSES_FOLD"
    | "ON_GLUE_FLAP"
    | "MISSING_BLEED"
    | "TEXT_TOO_SMALL"
    | "EMPTY_DESIGN";
  severity: PreflightSeverity;
  layerId?: string;
  face?: FaceId;
  /** Dictionary key under `preflight.*` for the localized message. */
  messageKey: string;
}
