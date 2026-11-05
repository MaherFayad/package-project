import type { LocalizedText, Mm } from "@/types";
import type {
  ClosureKind,
  CrossSection,
  LabelSpec,
  NeckFinish,
  PrintSurfaceKind,
  Range,
  SectionPoint as _SP,
  VesselDims,
  VesselKind,
  VesselMaterialCode,
  VesselProfile,
} from "../../index";

/**
 * Local types for the bottles / jars / pails / jerrycans catalogue. They EXTEND the core
 * vessel contracts (src/lib/vessels/types.ts, registry.ts) without editing them, because the
 * core `VesselKind` union and `CrossSection` cannot hold these models yet. See README.md for
 * what the integrator must merge.
 */

export type SectionPoint = _SP;

/** Families of this catalogue (core VesselFamily only has BOTTLE and JAR of these). */
export type BottleFamily = "BOTTLE" | "JAR" | "TUB" | "PAIL" | "JERRYCAN" | "JUG";

export type BottleSubFamily =
  | "GLASS_WATER"
  | "GLASS_JUICE"
  | "GLASS_WINE"
  | "GLASS_SPARKLING"
  | "GLASS_BEER"
  | "GLASS_OIL"
  | "GLASS_SAUCE"
  | "GLASS_SPIRITS"
  | "GLASS_DAIRY"
  | "GLASS_PHARMA"
  | "PET_WATER"
  | "PET_BULK_WATER"
  | "PET_CSD"
  | "PET_JUICE"
  | "PET_PHARMA"
  | "PET_SPORTS"
  | "HDPE_PERSONAL_CARE"
  | "HDPE_HOUSEHOLD"
  | "HDPE_LUBRICANT"
  | "HDPE_DAIRY"
  | "GLASS_JAR"
  | "PET_JAR"
  | "PP_TUB"
  | "PP_PAIL"
  | "HDPE_JERRYCAN";

/**
 * Body cross-section. `rect` with cornerRatio >= depthRatio is a stadium (oval bottle);
 * `polygon` is measured across flats (D = 2 x apothem). Every section blends to a circle on
 * the neck (squareness s = 0), which is why both have the circle as their limit.
 */
export type BottleSection =
  | { kind: "round" }
  | { kind: "rect"; depthRatio: number; cornerRatio: number }
  | { kind: "polygon"; sides: number; cornerRatio: number };

/** Container materials of this catalogue (superset of the core VESSEL_MATERIAL_CODES). */
export const BOTTLE_MATERIAL_CODES = [
  "GLASS_FLINT",
  "GLASS_AMBER",
  "GLASS_GREEN",
  "GLASS_COBALT",
  "GLASS_FROSTED",
  "PET_CLEAR",
  "PET_AMBER",
  "PET_BLUE",
  "HDPE_WHITE",
  "HDPE_NATURAL",
  "HDPE_COLOURED",
  "PP_WHITE",
  "PP_NATURAL",
] as const;
export type BottleMaterialCode = (typeof BOTTLE_MATERIAL_CODES)[number];

export interface BottleMaterial {
  code: BottleMaterialCode;
  name: LocalizedText;
  kind: "GLASS" | "PET" | "HDPE" | "PP";
  /** Display colour of the container wall. */
  hex: string;
  /** 0 = opaque, 1 = water clear. */
  transmission: number;
  /** Diffuse (acid-etched / sand-blasted) surface. */
  frosted: boolean;
  /** Resin identification / glass recycling code (ISO 14021 / EU 97/129/EC: 1 PET, 2 HDPE, 5 PP, 70-72 GL). */
  recyclingCode: string;
  /** Glass protects against UV in this order: amber > green > cobalt > flint. */
  uvBlock: "high" | "medium" | "low";
  /** Nearest core material so the existing renderer can draw it before the merge. */
  coreMaterial: VesselMaterialCode;
}

/** Thread / finish family. Drives which closures fit and how the finish is drawn. */
export type FinishKind = "screw" | "ropp" | "crown" | "cork" | "bartop" | "lug" | "mason" | "snap" | "swing" | "rim";

export interface BottleFinish extends NeckFinish {
  id: string;
  kind: FinishKind;
  /** Standard or trade designation the dimensions follow. */
  standard: string;
  /** Bore (inner) diameter at the mouth, mm. */
  boreMm: Mm;
  /** PET preforms carry a support (transfer) ring under the thread. */
  supportRing?: boolean;
  /** Tamper band bead under the thread (closure has a breakable band). */
  tamperBead?: boolean;
  /** Dimensions verified against a published drawing/standard (false = typical value). */
  verified: boolean;
}

export const BOTTLE_CLOSURE_CODES = [
  "SCREW_CAP",
  "SCREW_CAP_TE",
  "CHILD_RESISTANT_CAP",
  "ROPP_CAP",
  "POURER_CAP",
  "CROWN_26",
  "CROWN_29",
  "NATURAL_CORK",
  "SPARKLING_CORK",
  "BAR_TOP",
  "SWING_TOP",
  "FLIP_TOP",
  "SPORTS_CAP",
  "ORIFICE_REDUCER_CAP",
  "LUG_LID",
  "MASON_LID_BAND",
  "SNAP_CAP_NON_SPILL",
  "VENTED_SCREW_CAP",
  "MEASURE_CAP",
  "TAMPER_LID",
] as const;
export type BottleClosureCode = (typeof BOTTLE_CLOSURE_CODES)[number];

export interface BottleClosure {
  code: BottleClosureCode;
  name: LocalizedText;
  /** Finish families it fits. */
  fits: FinishKind[];
  /** Height above the finish top (mm), for framing and the box envelope. */
  heightAboveMm: Mm;
  /** Skirt goes this far down the finish (mm, 0 = sits on top). */
  skirtMm: Mm;
  /** Closure outer diameter = finish T + this (mm). */
  extraDiameterMm: Mm;
  tamperEvident: boolean;
  /** Flat top that takes a printed disc label / top print. */
  printableTop: boolean;
  /** Nearest core closure for the existing renderer. */
  coreClosure: ClosureKind;
}

export type BaseStyle =
  | { kind: "flat" }
  | { kind: "punt"; depthMm: Mm }
  | { kind: "petaloid"; feet: number; clearanceMm: Mm }
  | { kind: "stackRing" };

/** Handle drawn outside the lathe body (tube along a centre line, mm, container axes). */
export interface HandleSpec {
  kind: "integrated" | "bail" | "clip";
  path: { x: Mm; y: Mm; z: Mm }[];
  tubeRadiusMm: Mm;
}

/** Zone on the wall (exactly straight in the silhouette: cylinder or cone frustum). */
export interface WallZone {
  y0: Mm;
  y1: Mm;
  r0: Mm;
  r1: Mm;
}

/**
 * Profile of a catalogue model. It IS a core VesselProfile (so existing helpers and the lathe
 * renderer accept it) with the exact section and extras on top.
 */
export interface BottleProfile extends VesselProfile {
  outer: SectionPoint[];
  /** Exact body section (core `section` holds the nearest CrossSection). */
  bottleSection: BottleSection;
  base: BaseStyle;
  /** Straight neck zone for neck labels / capsules (if the neck is long enough). */
  neckZone?: WallZone;
  handle?: HandleSpec;
  /** Lowest y the inside reaches (base thickness incl. punt). */
  innerBaseY: Mm;
}

export type ShoulderStyle = "cone" | "ogive" | "boston" | "flat" | "none";

/**
 * Shape recipe: proportions (fractions of H, of R = D/2) plus thicknesses in mm. One recipe
 * per model; `buildBottleProfile` turns recipe + dims + finish into an exact profile.
 */
export interface ShapeRecipe {
  section: "round" | "rect" | "polygon";
  sides?: number;
  cornerRatio?: number;
  /** Depth / width when the dims have no G (rect sections). */
  defaultDepthRatio?: number;
  glass: boolean;
  wallMm: Mm;
  /** Glass or plastic thickness under the product (excluding any punt). */
  baseMm: Mm;
  base: { kind: "flat" } | { kind: "punt"; depth: number } | { kind: "petaloid"; feet: number; clearance: number } | { kind: "stackRing" };
  /** Heel (bottom edge) radius as a fraction of R. */
  heel: number;
  /** Fraction of H where the shoulder starts (top of the body). */
  bodyTop: number;
  shoulder: ShoulderStyle;
  /** Corner rounding for cone/flat shoulders, fraction of R. */
  shoulderRound?: number;
  /** Straight neck length, fraction of H (0 = finish sits on the shoulder). */
  neckLen: number;
  /** Neck outer radius minus the finish root radius, at the neck base / top (mm). */
  neckFlare: Mm;
  neckTop?: Mm;
  /** Grip ribs (centre heights, fractions of H) and their depth (mm). */
  ribs?: number[];
  ribDepth?: Mm;
  /** Hourglass grip zone: centre and height as fractions of H, depth as fraction of R. */
  waist?: { y: number; h: number; depth: number };
  /** Which end of the body is narrower when dims.taper > 0. */
  taper?: "in" | "out";
  /** Body label zone [from, to] as fractions of H (must lie on the straight body). */
  label: [number, number];
  handle?: "jerrycan" | "jug" | "bail" | "clip";
}

export interface BottlePreset {
  id: string;
  name: LocalizedText;
  /** Nominal (labelled) capacity, ml. Jars/tubs state grams in the name. */
  capacityMl: number;
  dims: VesselDims;
  /** Finish id (see FINISHES). */
  finish: string;
  /** Common in the Egyptian market. */
  egypt: boolean;
  source: string;
}

export interface BottleDefinition {
  /** Catalogue code, e.g. "BTL_GLASS_WINE_BORDEAUX". */
  code: string;
  slug: string;
  family: BottleFamily;
  subFamily: BottleSubFamily;
  name: LocalizedText;
  description: LocalizedText;
  /** Published standard the shape/finish follows ("none" if it is a trade shape). */
  standard: string;
  /** Nearest core kind (renderer fallback before the merge). */
  coreKind: VesselKind;
  recipe: ShapeRecipe;
  materials: BottleMaterialCode[];
  defaultMaterial: BottleMaterialCode;
  /** Finishes (thread standards) offered; presets pick one. */
  finishes: string[];
  closures: BottleClosureCode[];
  defaultClosure: BottleClosureCode;
  limits: { D: Range; H: Range; G?: Range; taper?: Range };
  /** H / D must stay inside this range (keeps the shape recognisable). */
  aspect: Range;
  presets: BottlePreset[];
  defaultPresetId: string;
  surfaces: PrintSurfaceKind[];
  defaultSurfaces: PrintSurfaceKind[];
  typicalUses: LocalizedText[];
  /** Product shown inside (transparent containers). */
  fillable: boolean;
  defaultContent: ContentCode;
}

export type ContentCode =
  | "WATER"
  | "JUICE"
  | "RED_WINE"
  | "WHITE_WINE"
  | "SPARKLING"
  | "BEER"
  | "OLIVE_OIL"
  | "HOT_SAUCE"
  | "SPIRIT"
  | "MILK"
  | "SYRUP"
  | "COLA"
  | "SHAMPOO"
  | "DETERGENT"
  | "MOTOR_OIL"
  | "HONEY"
  | "JAM"
  | "NUT_BUTTER"
  | "PICKLES"
  | "TAHINI"
  | "HALAWA"
  | "PAINT"
  | "NONE";

/** Label spec with how the flat artwork maps onto the 3D surface. */
export interface BottleLabelSpec extends LabelSpec {
  /**
   * cylinder / cone: core band mapping (phi = angle). prism: developed arc length around a
   * non-round section (placement r0/r1 hold the girth-equivalent radius P / 2 pi).
   * developedFace: FRONT/BACK on a non-round section, face x0..x1 = arc length from the
   * face centre. sleeve: conforms to the silhouette. disc: flat on a closure/lid.
   */
  mapping: "cylinder" | "cone" | "prism" | "developedFace" | "sleeve" | "disc";
  /** Safe zone rectangle in flat print coordinates (origin top-left of the print area). */
  safeRect: { x: Mm; y: Mm; width: Mm; height: Mm };
}

export type { CrossSection, Mm, VesselDims };
