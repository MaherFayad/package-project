import type { Dims, DimsPreset, LocalizedText, MaterialCode, StructureCode, StructureFamily, StructureFeatures, StructureParamLimits } from "@/types";
import type { DielineModel, FeatureSupport } from "@/lib/dieline";
import type { LabelSpec, LiquidCode, VesselDims, VesselKind, VesselProfile, Range } from "@/lib/vessels";

/**
 * Model library (owner: 3D integration). ONE catalogue of everything the free designer can show
 * and the pricing engine can price: the 13 core structures, every family dieline generator
 * (FEFCO 02, 03/05, 04, 06/07, 09, ECMA tuck + specials, food service, rigid + tubes) and the
 * containers we print labels / sleeves for (bottles, jars, cans, tins, pouches, tubes).
 *
 * Boxes are priced through the rate card of their BASE core structure (the printer's
 * construction family: slotted case, mailer, tray, folding carton, rigid, tube) with the board
 * area of THEIR OWN dieline, so the price always matches the die. Vessels are priced as roll
 * labels / shrink sleeves (label area × stock) or, for pouches and tubes, as direct print.
 */

/** Picker groups, in display order. */
export const MODEL_GROUPS = ["BOXES", "CARTONS", "RIGID", "TRAYS", "TUBES", "BOTTLES_JARS", "POUCHES", "CANS"] as const;
export type ModelGroup = (typeof MODEL_GROUPS)[number];

export const MODEL_GROUP_NAMES: Record<ModelGroup, LocalizedText> = {
  BOXES: { ar: "علب كرتون مضلع", en: "Boxes" },
  CARTONS: { ar: "علب كرتون دوبلكس", en: "Cartons" },
  RIGID: { ar: "علب صلبة", en: "Rigid boxes" },
  TRAYS: { ar: "صواني", en: "Trays" },
  TUBES: { ar: "أنابيب", en: "Tubes" },
  BOTTLES_JARS: { ar: "زجاجات وبرطمانات", en: "Bottles and jars" },
  POUCHES: { ar: "أكياس", en: "Pouches" },
  CANS: { ar: "علب معدنية", en: "Cans" },
};

/** Which generator library a model comes from. */
export type ModelSource =
  | "core"
  | "fefco-02"
  | "fefco-03-05"
  | "fefco-04"
  | "fefco-06-07"
  | "fefco-09"
  | "ecma-tuck"
  | "ecma-specials"
  | "foodservice"
  | "rigid-tubes"
  | "vessel-core"
  | "vessel-bottles"
  | "vessel-cosmetic"
  | "vessel-flexible";

interface ModelBase {
  /** Unique model code (core StructureCode, family code or vessel code). Stored as Design.modelCode. */
  code: string;
  /** URL slug (unique). */
  slug: string;
  group: ModelGroup;
  source: ModelSource;
  /** Industry reference ("FEFCO 0203", "ECMA A20.20", "PCO 1881 neck"). */
  standard: string;
  name: LocalizedText;
  description: LocalizedText;
  /** Lower-case search text (codes, both names, standard). */
  search: string;
}

export interface BoxModelDef extends ModelBase {
  kind: "box";
  family: StructureFamily;
  shape: "box" | "cylinder" | "octagon" | "flat";
  limits: StructureParamLimits;
  defaultDims: Dims;
  presets: DimsPreset[];
  /** Boards a printer makes it from that our rate cards price. */
  materials: MaterialCode[];
  features: FeatureSupport;
  /** Core structure whose rate card, rules and dies this model is priced with (per board). */
  baseFor(material: MaterialCode): StructureCode;
  /** Build the dieline (inner mm). Throws on invalid dims. */
  build(dims: Dims, opts: { thicknessMm: number; features?: StructureFeatures }): DielineModel;
  fidelity: "exact" | "simplified";
  /** Open-top style (trays, half slotted, displays, open sleeves): fully folded reads "Assembled", not "Closed". */
  openTop?: boolean;
}

/** A choice of a vessel model (container material or closure) and what the renderer draws. */
export interface VesselOption {
  code: string;
  name: LocalizedText;
  /** Core renderer code: VesselMaterialCode for containers, ClosureKind for closures. */
  core: string;
  /** Added by 3D engine (X-01): body colour (sRGB hex) when the core material is only the nearest look (green / cobalt glass, coloured plastics). */
  tint?: string;
  /** Added by 3D engine (X-01): closure style the core kind cannot express ("CROWN" | "ROPP" | "CORK_CAPSULE" | "SPARKLING" | "POURER"). */
  closureStyle?: string;
}

/** One flat print area of a container (label, sleeve, pouch panel, tube body). mm. */
export interface PrintArea {
  id: string;
  /** PrintSurfaceKind (WRAP, FRONT…) or a flexible panel id (front, back, gussetLeft…). */
  kind: string;
  name: LocalizedText;
  trimWidthMm: number;
  trimHeightMm: number;
  bleedMm: number;
  safeMm: number;
  trimAreaM2: number;
  /** Lathe models: the label spec the 3D model wraps. */
  spec?: LabelSpec;
  /** Flexible models: panel id in the film model. */
  panel?: string;
}

export interface VesselDescription {
  profile: VesselProfile | null;
  areas: PrintArea[];
  envelope: { width: number; depth: number; height: number };
  /** Flexible models: the film config the 3D group is built from. */
  flex?: unknown;
}

export interface VesselModelDef extends ModelBase {
  kind: "vessel";
  /** "lathe": VesselModel (bottles, jars, cans, tins, tubes). "flexible": film pack group. */
  render: "lathe" | "flexible";
  /** Core renderer kind (closures, label maths, pouch / tube geometry). */
  coreKind: VesselKind;
  limits: { D: Range; H: Range; G?: Range; taper?: Range };
  /** How to label D and G in the size form. */
  axes: { D: "diameter" | "width"; G?: "gusset" | "depth" };
  presets: { id: string; name: LocalizedText; capacityMl?: number; dims: VesselDims }[];
  defaultPresetId: string;
  containers: VesselOption[];
  defaultContainer: string;
  closures: VesselOption[];
  defaultClosure: string;
  surfaces: string[];
  defaultSurfaces: string[];
  fillable: boolean;
  defaultLiquid: LiquidCode;
  pricing: "LABEL" | "POUCH" | "TUBE";
  /** Profile, print areas and envelope for a size. Throws on invalid dims. */
  describe(dims: VesselDims, surfaces: string[], presetId?: string): VesselDescription;
}

export type ModelDef = BoxModelDef | VesselModelDef;

export type { VesselDims };
