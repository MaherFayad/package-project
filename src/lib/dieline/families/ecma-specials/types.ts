import type { Dims, DimsPreset, LocalizedText, MaterialCode, StructureFamily, StructureFeatures, StructureParamLimits } from "@/types";
import type { FeatureSupport } from "../../features";
import type { StructureDraft } from "../../structures";
import type { Segment } from "../../types";

/**
 * Local types of the ECMA specials family. They mirror `StructureDef` (src/lib/dieline/registry.ts)
 * but the code is a plain string: these structures are not yet members of the shared
 * `StructureCode` union (the integrator adds them, see README.md).
 */

/** Sub-families used by the catalogue filters. */
export type EcmaSpecialSubFamily =
  | "glued-tray" //       B40 / B44 glued corner trays (four-corner, Beers, Brightwood)
  | "hinged-lid-tray" //  F20.40 / F20.41 trays with a lid hinged on the back wall
  | "sleeve-wrap" //      A01 open sleeve, E30 wrap-around
  | "wallet-folder" //    F60.9x wallets, presentation folders
  | "curved" //           F70 pillow pack, cone
  | "polygonal" //        C10.40 / C10.50 hexagon, octagon
  | "carrier" //          gable carry box, cup carrier, bottle baskets
  | "display" //          counter display with tear-off header
  | "liquid"; //          gable-top liquid carton, aseptic brick

export type EcmaSpecialUse = "ecommerce" | "food" | "cosmetics" | "apparel" | "retail" | "gift" | "shipping" | "beverage" | "dairy" | "stationery" | "media";

export interface EcmaSpecialDef {
  /** Proposed StructureCode (to be added to STRUCTURE_CODES by the integrator). */
  code: string;
  slug: string;
  family: StructureFamily;
  subFamily: EcmaSpecialSubFamily;
  /**
   * Industry reference printers recognise: an ECMA Code (2009 revised edition) style number
   * such as "ECMA B40.20.00.00", an ECMA group reference when the closure digits are not
   * catalogued ("ECMA E23 group"), or "none" for non-ECMA generic styles.
   */
  standard: string;
  name: LocalizedText;
  description: LocalizedText;
  /**
   * What L, W, H mean for this style (inner mm unless noted). Shown as field labels.
   */
  axes: { L: LocalizedText; W: LocalizedText; H: LocalizedText };
  params: StructureParamLimits;
  defaultDims: Dims;
  presets: DimsPreset[];
  materials: MaterialCode[];
  features: FeatureSupport;
  /** Features on by default (the style is not itself without them). */
  defaultFeatures?: StructureFeatures;
  shape: "box" | "cylinder" | "cone" | "flat";
  /** Separately cut blanks (dividers included). */
  pieces: number;
  /** Delivered glued flat (needs a folder-gluer) vs. flat unglued. */
  glued: boolean;
  /** Shipped knocked-down (flat) or erected / set-up. */
  delivery: "flat" | "set-up" | "reel-fed";
  uses: EcmaSpecialUse[];
  typicalUses: LocalizedText[];
  generate: (dims: Dims, t: number, features: StructureFeatures) => EcmaDraft;
  /** Nominal capacity (ml) for liquid cartons, from the inner dims. */
  capacityMl?: (dims: Dims) => number;
}

/** StructureDraft plus creases joining two panels that are not parent/child (corner webs). */
export interface EcmaDraft extends StructureDraft {
  joins?: Segment[];
}
