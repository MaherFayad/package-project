import type { Dims, DimsPreset, FaceId, LocalizedText, Mm, StructureFeatures, StructureParamLimits } from "@/types";
import type { FeatureSupport } from "../../features";
import type { StructureDraft } from "../../structures";
import type { DielineModel } from "../../types";
import type { FoodMaterialCode } from "./materials";

/**
 * Local contracts of the foodservice family. Nothing here is in `src/types` yet: the
 * integrator widens `StructureCode` / `StructureFamily` and moves what is needed (see README).
 */

export const FOODSERVICE_CODES = [
  "FS_CAKE_BOX_WINDOW",
  "FS_BAKERY_BOX",
  "FS_BURGER_CLAMSHELL",
  "FS_NOODLE_PAIL",
  "FS_FRIES_SCOOP",
  "FS_SANDWICH_WEDGE",
  "FS_PIZZA_SLICE",
  "FS_PIZZA_ROUND",
  "FS_CUP_SLEEVE",
  "FS_CUP_SINGLE",
  "FS_CUP_DOUBLE",
  "FS_CUP_LID",
  "FS_BOWL",
  "FS_BOWL_LID",
  "FS_BAG_MERCHANDISE",
  "FS_BAG_BREAD_WINDOW",
  "FS_PULP_EGG_6",
  "FS_PULP_EGG_10",
  "FS_PULP_EGG_TRAY_30",
  "FS_PULP_CUP_CARRIER_2",
  "FS_PULP_CUP_CARRIER_4",
  "FS_PULP_FRUIT_TRAY",
  "FS_HANG_TAG",
  "FS_BELLY_BAND",
  "FS_GIFT_SLEEVE",
] as const;
export type FoodserviceCode = (typeof FOODSERVICE_CODES)[number];

export type FoodserviceFamily = "FOLDING_CARTON" | "CORRUGATED" | "PAPER_BAG" | "PAPER_CUP" | "MOLDED_PULP" | "FLAT_STOCK";

export type FoodserviceUse = "food" | "bakery" | "beverage" | "takeaway" | "retail" | "gift" | "grocery" | "produce" | "eggs";

interface DefinitionBase {
  code: FoodserviceCode;
  slug: string;
  name: LocalizedText;
  description: LocalizedText;
  family: FoodserviceFamily;
  subFamily: string;
  /** "FEFCO 0426", "ISO 6591-1 (measurement)", or "none" when no published style code exists. */
  standard: string;
  materials: FoodMaterialCode[];
  defaultMaterial: FoodMaterialCode;
  uses: FoodserviceUse[];
}

/* ───────────── Paperboard / paper models: a dieline folded by the core fold engine ───────────── */

export interface DielineDefinition extends DefinitionBase {
  kind: "dieline";
  /** Inner mm (bags: W face width, gusset as W, H height; see each definition's notes). */
  params: StructureParamLimits;
  defaultDims: Dims;
  presets: DimsPreset[];
  features: FeatureSupport;
  defaultFeatures?: StructureFeatures;
  shape: "box" | "bag" | "flat";
  pieces: 1 | 2;
  glued: boolean;
  /** Field labels when L/W/H mean something else (bags: width / gusset / height). */
  dimLabels?: Partial<Record<keyof Dims, LocalizedText>>;
  generate: (dims: Dims, t: number, features: StructureFeatures) => StructureDraft;
  /** Optional carry handle accessory (bags). */
  handle?: HandleKind;
}

/** A DielineModel whose structureCode is one of ours (core StructureCode not widened yet). */
export type FamilyDielineModel = Omit<DielineModel, "structureCode"> & {
  structureCode: FoodserviceCode;
  handle?: HandleSpec;
};

export type HandleKind = "flat" | "twisted";

/** Paper handle glued inside the top turnover; rendered as a strip or a rope mesh. */
export interface HandleSpec {
  kind: HandleKind;
  /** Distance between the two attachment points (mm, centre to centre). */
  spanMm: Mm;
  /** Loop height above the bag mouth (mm). */
  heightMm: Mm;
  /** Strip width (flat) or rope diameter (twisted), mm. */
  widthMm: Mm;
  /** How far the ends reach down inside the bag (glued under the turnover), mm. */
  anchorMm: Mm;
  /** Faces the two handles sit on. */
  faces: FaceId[];
}

/* ───────────── Cups, bowls and sleeves: a conical wrap on a frustum ───────────── */

export interface FrustumDims {
  /** Outer diameter at the rim (before the top curl), mm. */
  topD: Mm;
  /** Outer diameter at the bottom edge, mm. */
  bottomD: Mm;
  /** Overall height, mm. */
  H: Mm;
}

export interface FrustumRange {
  topD: { min: Mm; max: Mm };
  bottomD: { min: Mm; max: Mm };
  H: { min: Mm; max: Mm };
}

export interface FrustumPreset {
  id: string;
  name: LocalizedText;
  /** Nominal capacity (brim, ml). */
  capacityMl: number;
  dims: FrustumDims;
  standard?: boolean;
  source?: string;
}

export interface FrustumDefinition extends DefinitionBase {
  kind: "frustum";
  role: "cup" | "bowl" | "sleeve";
  wall: "single" | "double";
  limits: FrustumRange;
  defaultDims: FrustumDims;
  presets: FrustumPreset[];
}

/* ───────────── Lids: revolved (lathe) parts ───────────── */

export interface LidDims {
  /** Outer diameter of the rim the lid snaps on (= cup/bowl topD), mm. */
  rimD: Mm;
  /** Overall lid height, mm. */
  H: Mm;
}

export interface LidDefinition extends DefinitionBase {
  kind: "lathe";
  role: "cup-lid" | "bowl-lid";
  limits: { rimD: { min: Mm; max: Mm }; H: { min: Mm; max: Mm } };
  defaultDims: LidDims;
  presets: { id: string; name: LocalizedText; dims: LidDims; standard?: boolean; source?: string }[];
}

/* ───────────── Molded pulp: a height-field shell ───────────── */

export interface PulpDims {
  /** Outer footprint length (x), width (z) and height (y), mm. */
  L: Mm;
  W: Mm;
  H: Mm;
}

export interface PulpLayout {
  rows: number;
  cols: number;
  /** Cell opening diameter as a fraction of the cell pitch. */
  cellRatio: number;
  /** Has a hinged lid (egg cartons). */
  lid: boolean;
  /** Conical posts between cells (egg flats). */
  posts: boolean;
}

export interface PulpDefinition extends DefinitionBase {
  kind: "molded";
  layout: PulpLayout;
  limits: { L: { min: Mm; max: Mm }; W: { min: Mm; max: Mm }; H: { min: Mm; max: Mm } };
  defaultDims: PulpDims;
  presets: { id: string; name: LocalizedText; dims: PulpDims; standard?: boolean; source?: string }[];
}

export type FoodserviceDefinition = DielineDefinition | FrustumDefinition | LidDefinition | PulpDefinition;

/** Triangle mesh as plain arrays (wrap in a three BufferGeometry in the renderer). */
export interface MeshData {
  positions: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
}

/** Flat printable area (sheet mm, origin top-left of the print area incl. bleed, y down). */
export interface PrintArea {
  /** Trim (finished) outline. */
  trim: { x: number; y: number }[];
  /** Trim grown by the bleed. */
  bleed: { x: number; y: number }[];
  /** Keep text and logos inside. */
  safe: { x: number; y: number }[];
  widthMm: Mm;
  heightMm: Mm;
  bleedMm: Mm;
  safeMm: Mm;
  trimAreaM2: number;
}
