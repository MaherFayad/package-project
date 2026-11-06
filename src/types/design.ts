import type { Dims, FaceId, PrintSurface, StructureCode, StructureFeatures } from "./structure";
import type { FinishCode, MaterialCode, PrintSides } from "./material";
import type { Mm } from "./common";

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
  /**
   * Added by 3D integration. Model from the library (src/lib/library): a family box style
   * ("FEFCO_0203", "ECMA_TUCK_STE"…) or a container ("ROUND_BOTTLE", "BTL_GLASS_…"). Absent =
   * the core structure itself. `structureCode` stays the BASE structure the model is priced and
   * produced as (its rate card), so orders, vendors and invoices keep working unchanged.
   */
  modelCode?: string;
  /** Added by 3D integration: every finish (foil, emboss, soft touch…) with its artwork mask. `finishCode` = the main one. */
  finishes?: DesignFinish[];
  /** Added by 3D integration: container settings when `modelCode` is a vessel. */
  vessel?: DesignVessel;
}

/** Finishes a buyer can pick in the designer (mirrors CONFIG_FINISH_CODES in src/lib/configurator). */
export const DESIGN_FINISH_CODES = [
  "MATTE_LAMINATION",
  "GLOSS_LAMINATION",
  "SOFT_TOUCH_LAMINATION",
  "GLOSS_VARNISH",
  "MATTE_VARNISH",
  "SPOT_UV",
  "FOIL_GOLD",
  "FOIL_SILVER",
  "FOIL_ROSE_GOLD",
  "EMBOSS",
  "DEBOSS",
] as const;
export type DesignFinishCode = (typeof DESIGN_FINISH_CODES)[number];

/** How each designer finish is charged on rate cards (FinishCode surcharges). */
export const PRICED_FINISH_OF: Record<DesignFinishCode, FinishCode> = {
  MATTE_LAMINATION: "MATTE_LAMINATION",
  GLOSS_LAMINATION: "GLOSS_LAMINATION",
  SOFT_TOUCH_LAMINATION: "SOFT_TOUCH_LAMINATION",
  GLOSS_VARNISH: "VARNISH",
  MATTE_VARNISH: "VARNISH",
  SPOT_UV: "SPOT_UV",
  FOIL_GOLD: "HOT_FOIL",
  FOIL_SILVER: "HOT_FOIL",
  FOIL_ROSE_GOLD: "HOT_FOIL",
  EMBOSS: "EMBOSS",
  DEBOSS: "DEBOSS",
};

/** Every priced finish of a design (main finish + the designer's finish list), no duplicates, no NONE. */
export function designPricedFinishes(doc: Pick<DesignDoc, "finishCode" | "finishes">): FinishCode[] {
  const out = new Set<FinishCode>();
  if (doc.finishCode !== "NONE") out.add(doc.finishCode);
  for (const f of doc.finishes ?? []) out.add(PRICED_FINISH_OF[f.code]);
  return [...out].sort();
}

export interface DesignFinish {
  code: DesignFinishCode;
  /** Masked finishes (foil, spot UV, emboss): the artwork layers that carry it. Empty = the whole main face. */
  mask?: { surface: PrintSurface; layerIds: string[] };
}

/** A container design: size, what it is made of, what it holds and which surfaces carry print. */
export interface DesignVessel {
  /** D diameter/width, H height, G gusset/depth, taper (mm). */
  dims: { D: Mm; H: Mm; G?: Mm; taper?: Mm };
  presetId?: string;
  /** Container material code of the model (glass, PET, aluminium…). */
  container: string;
  /** Closure code of the model. */
  closure: string;
  closureColor: string;
  /** Product shown inside (transparent containers). */
  content: string;
  /** 0..1 */
  fill: number;
  /** Print surfaces (WRAP, FRONT, BACK, SHRINK_SLEEVE, NECK, LID, flexible panels). */
  surfaces: string[];
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
