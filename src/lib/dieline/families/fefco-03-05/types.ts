import type { Dims, DimsPreset, LocalizedText, MaterialCode, StructureFamily, StructureFeatures, StructureParamLimits } from "@/types";
import type { FeatureSupport } from "../../features";
import type { StructureDraft } from "../../structures";
import type { DielineModel } from "../../types";

/**
 * LOCAL SHARED TYPES (see README "Integrator notes").
 *
 * `StructureCode` in src/types is a closed union, so this family uses string codes
 * ("FEFCO_0300" …) until the integrator adds them to STRUCTURE_CODES. Everything else
 * mirrors `StructureDef` from ../../registry.ts, plus the generator and sub-family.
 */
export type FefcoTelescopeSlideCode = `FEFCO_03${string}` | `FEFCO_05${string}`;

export type FamilyUse = "ecommerce" | "food" | "cosmetics" | "apparel" | "retail" | "gift" | "shipping" | "industrial";

export type SubFamily =
  | "telescope-tray-lid" //  cross-shaped tray + tray lid (full or partial telescope)
  | "telescope-slotted" //   slotted tubes (HSC/RSC) telescoping
  | "telescope-caps" //      tube or slotted body with separate caps (3 pieces)
  | "telescope-octabin" //   octagonal bulk bins
  | "slide-sleeve" //        single sleeve (outer sleeve for other cases)
  | "slide-set"; //          sleeve + inner sleeve / liner / wrap sliding into each other

export type Generator = (dims: Dims, t: number, features: StructureFeatures) => StructureDraft;

export interface FamilyStructureDef {
  code: FefcoTelescopeSlideCode;
  slug: string;
  family: StructureFamily;
  group: "03" | "05";
  subFamily: SubFamily;
  /** Industry style reference ("FEFCO 0301"). */
  standard: string;
  name: LocalizedText;
  description: LocalizedText;
  params: StructureParamLimits;
  defaultDims: Dims;
  presets: DimsPreset[];
  materials: MaterialCode[];
  features: FeatureSupport;
  shape: "box" | "octagon";
  /** Separately cut blanks (registry StructureDef allows 1 | 2; caps sets have 3). */
  pieces: 1 | 2 | 3;
  /** Labels of the blanks, in order (main body first). */
  pieceLabels: string[];
  glued: boolean;
  uses: FamilyUse[];
  /** Default lid / cap depth for two- and three-piece styles (inner mm), from dims. */
  lidDepth?: (dims: Dims) => number;
  generate: Generator;
}

/** DielineModel with a family string code (until StructureCode is widened). */
export type FamilyDielineModel = Omit<DielineModel, "structureCode"> & { structureCode: FefcoTelescopeSlideCode };
