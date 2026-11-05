import type { Dims, DimsPreset, LocalizedText, StructureCode, StructureFeatures, StructureParamLimits } from "@/types";
import type { StructureDraft } from "../../structures";
import type { DielineModel, Segment } from "../../types";

/**
 * Local types of the rigid / tube / bulk / envelope catalogue family.
 *
 * The shared `StructureCode`, `StructureFamily` and `MaterialCode` unions are closed and owned
 * by the 3D engine, so this folder defines its own catalogue codes, family names and material
 * codes. The integrator widens the shared unions (see README.md).
 */

/** Top-level family. ENVELOPE is new (not yet in the shared StructureFamily union). */
export type CatalogueFamily = "RIGID" | "TUBE" | "CORRUGATED" | "ENVELOPE";

export type CatalogueUse =
  | "ecommerce"
  | "food"
  | "cosmetics"
  | "apparel"
  | "retail"
  | "gift"
  | "shipping"
  | "industrial"
  | "stationery"
  | "jewellery";

/**
 * Material codes this family can be made from. Codes that already exist in the shared
 * MATERIAL_CODES keep their name (GREYBOARD_WRAP, KRAFT_TUBE, B_FLUTE_KRAFT); the others are
 * proposed additions.
 */
export const FAMILY_MATERIAL_CODES = [
  "GREYBOARD_WRAP", // 2 mm greyboard + 157 gsm wrap (existing)
  "GREYBOARD_1500_WRAP", // 1.5 mm greyboard + 157 gsm wrap (small / light rigid boxes)
  "GREYBOARD_2500_WRAP", // 2.5 mm greyboard + 157 gsm wrap (large rigid boxes)
  "KRAFT_TUBE", // spiral-wound kraft tube, 1.5 mm wall, printed label (existing)
  "WHITE_TUBE", // spiral-wound tube with white liner, 1.5 mm wall, printed label
  "B_FLUTE_KRAFT", // single wall B flute, ~3 mm (existing)
  "BC_FLUTE_KRAFT", // double wall BC flute, ~7 mm (pallet boxes)
  "AAA_TRIPLE_KRAFT", // triple wall, ~15 mm (octabins)
  "OFFSET_PAPER_100", // 100 gsm white offset paper (envelopes)
  "KRAFT_PAPER_120", // 120 gsm brown kraft (envelopes, mailer bags)
  "CARD_PAPER_160", // 160 gsm coloured / textured paper (greeting card envelopes)
  "PADDED_KRAFT", // kraft outer + paper-cushion padding, ~3.5 mm (padded mailers)
] as const;
export type FamilyMaterialCode = (typeof FAMILY_MATERIAL_CODES)[number];

export interface FamilyMaterial {
  code: FamilyMaterialCode;
  family: CatalogueFamily;
  /** Caliper used by the dieline compensation and the 3D board thickness (mm). */
  thicknessMm: number;
  name: LocalizedText;
  /** true when the code already exists in the shared MATERIAL_CODES. */
  shared: boolean;
}

export interface FamilyFeatureSupport {
  /** Faces that can carry a die-cut window (film is glued inside). */
  windowFaces: ("front" | "top")[];
  thumbNotch: boolean;
  /** Lid / cap / neck depth can be chosen (StructureFeatures.lidHeightMm). */
  lidHeight: boolean;
  partitions: boolean;
  /** Perforated tear-open strip (mailer bags). */
  tearStrip: boolean;
  handle: boolean;
}

export interface GenerateOptions {
  /** Material (thickness comes from FAMILY_MATERIALS unless thicknessMm is given). */
  material?: FamilyMaterialCode;
  thicknessMm?: number;
  /** Default 3 mm. */
  bleedMm?: number;
  /** Default 3 mm (5 mm corrugated). */
  safeMm?: number;
  features?: StructureFeatures;
}

/** Dieline model of a catalogue item: the shared model plus its catalogue code. */
export type FamilyDielineModel = DielineModel & {
  /** Catalogue code of this family (e.g. "RIGID_BOOK_MAGNETIC"). */
  catalogCode: string;
};

/** Generator draft: the shared StructureDraft plus edges that are neither cut nor crease. */
export type FamilyDraft = StructureDraft & {
  /**
   * Edges shared by two neighbouring panels of one continuous sheet that the panel tree
   * cannot hinge (tube turn-ins, the far side of a window). Drawn as nothing.
   */
  virtualEdges?: Segment[];
};

export type FamilyGenerator = (dims: Dims, t: number, features: StructureFeatures) => FamilyDraft;

/** One greyboard / insert part of a rigid box (cut sizes for the vendor). */
export interface BoardPart {
  label: string;
  widthMm: number;
  heightMm: number;
  qty: number;
}

/** Construction notes shown to vendors (rigid boxes, tubes). */
export interface ConstructionSpec {
  boards: BoardPart[];
  /** Extra components: magnets, ribbon, film, metal ends. */
  extras: string[];
}

export interface CatalogueDefinition {
  /** Catalogue code (proposed new StructureCode). */
  code: string;
  slug: string;
  family: CatalogueFamily;
  subFamily: string;
  /** Industry reference ("FEFCO 0201", "ISO 269 (C4)") or "none". */
  standard: string;
  name: LocalizedText;
  description: LocalizedText;
  /** Inner mm, except envelopes (finished size, as ISO 269 states it). */
  params: StructureParamLimits;
  defaultDims: Dims;
  presets: DimsPreset[];
  materials: FamilyMaterialCode[];
  defaultMaterial: FamilyMaterialCode;
  features: FamilyFeatureSupport;
  /** Features on by default (window on a window box). */
  defaultFeatures?: StructureFeatures;
  /** "cylinder": L = W = diameter. "flat": envelope (W = contents thickness). */
  shape: "box" | "cylinder" | "octagon" | "flat";
  pieces: number;
  glued: boolean;
  uses: CatalogueUse[];
  /** Closest existing shared StructureCode (renderer / pricing fallback until integrated). */
  baseCode: StructureCode;
  /** Validate inner dims against limits and rules (zod). */
  validate(dims: Dims): DimsCheck;
  /** Build the dieline. Throws FamilyValidationError on bad dims. */
  generate(dims: Dims, options?: GenerateOptions): FamilyDielineModel;
  /** Construction notes (greyboard parts, magnets…). */
  construction?(dims: Dims, options?: GenerateOptions): ConstructionSpec;
}

export type DimsCheck = { ok: true; dims: Dims } | { ok: false; issues: { path: string; message: string }[] };
