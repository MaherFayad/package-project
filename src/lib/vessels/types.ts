import type { LocalizedText, Mm } from "@/types";

/**
 * Bottles, jars, cans, tins, pouches and tubes that Elba prints LABELS, SLEEVES and boxes for.
 * We never make the container itself: these models exist so a buyer can see their artwork on
 * the real thing and so the print area (in mm, with bleed and safe zone) is exact.
 *
 * Coordinates (same as the box engine): mm, Y up, the container stands on y = 0 with its axis
 * on Y. "Front" faces +Z. Angles (phi) are measured from +Z towards +X, so a viewer in front
 * sees phi increase from left to right.
 */

export const VESSEL_KINDS = [
  "ROUND_BOTTLE",
  "BOSTON_ROUND",
  "DROPPER_BOTTLE",
  "PUMP_BOTTLE",
  "PERFUME_SQUARE",
  "WIDE_JAR",
  "CAN",
  "ROUND_TIN",
  "STAND_UP_POUCH",
  "SQUEEZE_TUBE",
] as const;
export type VesselKind = (typeof VESSEL_KINDS)[number];

export type VesselFamily = "BOTTLE" | "JAR" | "CAN" | "TIN" | "POUCH" | "TUBE";

/** Container material (what the container is made of; not printed by us). */
export const VESSEL_MATERIAL_CODES = [
  "GLASS_CLEAR",
  "GLASS_AMBER",
  "GLASS_FROSTED",
  "PET_CLEAR",
  "HDPE_WHITE",
  "ALUMINIUM",
  "TINPLATE",
  "KRAFT_POUCH",
  "WHITE_POUCH",
  "PE_TUBE_WHITE",
] as const;
export type VesselMaterialCode = (typeof VESSEL_MATERIAL_CODES)[number];

export const CLOSURE_KINDS = [
  "SCREW_CAP",
  "SPORTS_CAP",
  "DROPPER",
  "LOTION_PUMP",
  "MIST_PUMP",
  "LUG_LID",
  "CAN_END",
  "SLIP_LID",
  "ZIP_SEAL",
  "FLIP_TOP",
  "SCREW_TUBE_CAP",
] as const;
export type ClosureKind = (typeof CLOSURE_KINDS)[number];

/** Industry neck finish (thread standard) of a bottle or jar. */
export interface NeckFinish {
  /** e.g. "PCO 1881", "18-400", "24-410", "TO 63", "FEA 15", "202 end". */
  code: string;
  /** Outer diameter over the thread (T dimension), mm. */
  outerDiameterMm: Mm;
  /** Height of the finish above the support ring / shoulder, mm. */
  heightMm: Mm;
  thread: "screw" | "lug" | "crimp" | "seam" | "none";
}

/**
 * Size of a container. Every kind reads D and H; extras are optional:
 *  - D: body diameter (round), body width across flats (square), pouch width, tube diameter.
 *  - H: overall height of the container without its closure (pouch: flat height, tube: length
 *    from shoulder to the end of the crimp seal).
 *  - G: pouch bottom gusset (opened depth), or square bottle depth (defaults to D).
 *  - taper: how much narrower the top of the body is than the bottom (mm on the diameter).
 */
export interface VesselDims {
  D: Mm;
  H: Mm;
  G?: Mm;
  taper?: Mm;
}

export interface Range {
  min: Mm;
  max: Mm;
}

export interface VesselPreset {
  id: string;
  name: LocalizedText;
  /** Nominal (filled) capacity; jars state grams of honey in the name. */
  capacityMl: number;
  dims: VesselDims;
  neck?: NeckFinish;
  /** Where the numbers come from (supplier catalogue, standard). Shown in the dev tool. */
  source?: string;
}

/** Outer profile point: radius (half width for square sections) at height y. */
export interface ProfilePoint {
  r: Mm;
  y: Mm;
}

export type CrossSection =
  | { kind: "round" }
  /** Rounded square of half width r; corner radius = r * cornerRatio. depthRatio = depth / width. */
  | { kind: "roundedRect"; cornerRatio: number; depthRatio: number }
  /** Rounded regular polygon (hex honey jar): r is the apothem (half across flats), a flat faces the
   *  front (+Z); corner radius = r * cornerRatio. */
  | { kind: "polygon"; sides: number; cornerRatio: number };

/** Revolved (lathe) body shape. Pouch and tube are not revolved but still expose one for envelopes. */
export interface VesselProfile {
  /** Outer surface, bottom centre to the top of the finish (and a little into the bore). */
  outer: ProfilePoint[];
  section: CrossSection;
  /** Wall thickness used for the interior (liquid) and volume. */
  wallMm: Mm;
  /** Thickness of the base (glass is heavy at the bottom). */
  baseMm: Mm;
  /** Body (label panel) zone: straight or straight-tapered part of the wall. */
  body: { y0: Mm; y1: Mm; r0: Mm; r1: Mm };
  /** Shoulder zone between the body and the neck (used for neck labels). */
  shoulder?: { y0: Mm; y1: Mm; r0: Mm; r1: Mm };
  /** Top of the finish: the closure sits here. */
  finishTopY: Mm;
  /** Outer radius of the finish (thread). */
  finishR: Mm;
  /** Height of the finish (thread zone) below finishTopY. */
  finishH: Mm;
  /** Highest y the product can reach (just under the finish). */
  fillMaxY: Mm;
}

/** Print surfaces Elba can make for a container. */
export const PRINT_SURFACE_KINDS = ["WRAP", "FRONT", "BACK", "SHRINK_SLEEVE", "NECK", "LID"] as const;
export type PrintSurfaceKind = (typeof PRINT_SURFACE_KINDS)[number];

/** Where a print surface sits on the container (all mm, angles in radians). */
export type SurfacePlacement =
  /** On the revolved wall between y0 and y1 (cylindrical if r0 == r1, else a cone frustum). */
  | { type: "band"; y0: Mm; y1: Mm; r0: Mm; r1: Mm; phiStart: number; phiLength: number; section?: CrossSection }
  /** Shrink sleeve that conforms to the profile between y0 and y1 (full 360 degrees). */
  | { type: "sleeve"; y0: Mm; y1: Mm }
  /** Round label on top of a lid / cap at height y. */
  | { type: "disc"; y: Mm; radius: Mm }
  /** Rectangle on a flat face (square bottle panel, pouch panel). x is across the face, centred. */
  | { type: "face"; face: "front" | "back"; x0: Mm; x1: Mm; y0: Mm; y1: Mm };

export const LABEL_STOCK_CODES = ["PAPER_SEMIGLOSS", "WHITE_BOPP", "CLEAR_BOPP", "METALLIC_BOPP", "PETG_SHRINK"] as const;
export type LabelStockCode = (typeof LABEL_STOCK_CODES)[number];

export const LABEL_FINISH_CODES = ["NONE", "GLOSS_VARNISH", "MATTE_VARNISH", "GLOSS_LAMINATION", "MATTE_LAMINATION", "HOT_FOIL", "SPOT_UV", "EMBOSS"] as const;
export type LabelFinishCode = (typeof LABEL_FINISH_CODES)[number];

export interface LabelStock {
  code: LabelStockCode;
  name: LocalizedText;
  /** Face film/paper caliper, microns. */
  thicknessMicron: number;
  waterproof: boolean;
  /** Ink on clear film: unprinted areas show the container. */
  transparent: boolean;
  metallic: boolean;
  /** Heat-shrink film (sleeves only). */
  shrink?: { maxTdPct: number; designLimitPct: number; mdPct: number };
  /** Surfaces this stock can be used for. */
  surfaces: PrintSurfaceKind[];
  /** Suggested for (help text). */
  bestFor: LocalizedText;
}

export interface LabelFinish {
  code: LabelFinishCode;
  name: LocalizedText;
  /** Stocks the finish works on (empty = all except shrink). */
  stocks?: LabelStockCode[];
}

/** Flat shape of a print area. */
export type FlatShape = "rect" | "circle" | "sector";

/**
 * Printable label/sleeve spec: the flat artwork area (like a dieline) and the numbers the
 * pricing engine needs. All lengths mm. Flat coordinates: origin top-left of the PRINT area
 * (trim + bleed), x right, y down.
 */
export interface LabelSpec {
  id: string;
  kind: PrintSurfaceKind;
  name: LocalizedText;
  shape: FlatShape;
  placement: SurfacePlacement;
  /** Bounding box of the trimmed (finished) label. */
  trimWidthMm: Mm;
  trimHeightMm: Mm;
  bleedMm: Mm;
  safeMm: Mm;
  /** Print area = trim + bleed on every side. */
  printWidthMm: Mm;
  printHeightMm: Mm;
  /** Finished label area (exact for circle/sector), m². */
  trimAreaM2: number;
  /** Wrap labels: extra length that overlaps the start (part of trimWidthMm). */
  overlapMm?: Mm;
  cornerRadiusMm?: Mm;
  /** Cone labels: the unrolled annular sector (centre at apex). */
  sector?: SectorGeometry;
  /** Shrink sleeves: flat tube and shrink check. */
  sleeve?: SleeveGeometry;
  stocks: LabelStockCode[];
  defaultStock: LabelStockCode;
  finishes: LabelFinishCode[];
  warnings: string[];
}

export interface SectorGeometry {
  /** Apex in flat print coordinates. */
  apexX: Mm;
  apexY: Mm;
  innerRadiusMm: Mm;
  outerRadiusMm: Mm;
  /** Flat angle of the sector (radians). */
  angle: number;
  /** true if the apex is above the label (the container narrows upwards). */
  apexAbove: boolean;
  /** Slant height of the frustum = outer - inner radius. */
  slantMm: Mm;
}

export interface SleeveGeometry {
  /** Sleeve circumference before shrinking (largest girth + ease). */
  circumferenceMm: Mm;
  /** Flattened tube width (what the converter quotes). */
  layFlatMm: Mm;
  /** Seam overlap printed with the sleeve. */
  seamMm: Mm;
  /** Height before shrink (follows the profile, plus machine-direction allowance). */
  cutHeightMm: Mm;
  /** Largest transverse shrink needed anywhere (0..1). */
  maxShrink: number;
  /** Girth ratio (applied circumference / sleeve circumference) sampled bottom to top. */
  girthRatios: { t: number; y: Mm; ratio: number }[];
}
