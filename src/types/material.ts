import type { StructureFamily } from "./structure";

/** Must match Material.code in the DB. */
export const MATERIAL_CODES = [
  "E_FLUTE_KRAFT",
  "E_FLUTE_WHITE",
  "B_FLUTE_KRAFT",
  "SBS_300",
  "SBS_350",
  "GREYBOARD_WRAP", // 2 mm greyboard wrapped in 157 gsm printed art paper (rigid boxes)
  "KRAFT_TUBE", //     spiral-wound kraft tube, 1.5 mm wall, printed paper label (tubes)
  // Added by 3D integration: label stocks and flexible laminates (containers).
  "LABEL_PAPER", //        semi-gloss label paper, permanent acrylic adhesive
  "LABEL_WHITE_BOPP", //   white BOPP film label (wet / chilled)
  "LABEL_CLEAR_BOPP", //   clear BOPP film label ("no label" look)
  "LABEL_METALLIC_BOPP", // metallised BOPP label
  "SHRINK_PETG", //        PETG shrink sleeve film, 50 micron
  "POUCH_PET_PE", //       PET 12 / PE 80 laminate (printed reverse on the PET)
  "POUCH_KRAFT_PE", //     kraft paper / PE laminate
  "TUBE_PE", //            co-extruded PE tube body (offset or silkscreen printed)
  // Added by bags: carrier bag papers (src/lib/dieline/families/bags).
  "BAG_KRAFT_80", //       brown kraft 80 gsm (SOS and light carrier bags)
  "BAG_KRAFT_120", //      brown kraft 120 gsm (carrier bags)
  "BAG_WHITE_KRAFT_120", // bleached white kraft 120 gsm
  "BAG_ART_170", //        coated art paper 170 gsm, laminated (boutique bags)
  "BAG_ART_210", //        coated art paper 210 gsm, laminated
  "BAG_ART_250", //        coated art paper 250 gsm, laminated
] as const;
export type MaterialCode = (typeof MATERIAL_CODES)[number];

export type BoardType = "CORRUGATED" | "SBS" | "GREYBOARD" | "TUBE" | "LABEL" | "FILM" | "PAPER";
export type Flute = "E" | "B";
export type BoardColor = "KRAFT" | "WHITE";

/** Must match Finish.code in the DB. */
export const FINISH_CODES = [
  "NONE",
  "MATTE_LAMINATION",
  "GLOSS_LAMINATION",
  "SPOT_UV",
  // Added by 3D integration: priced from rate-card surcharges like the others.
  "SOFT_TOUCH_LAMINATION",
  "VARNISH",
  "HOT_FOIL",
  "EMBOSS",
  "DEBOSS",
] as const;
export type FinishCode = (typeof FINISH_CODES)[number];

/**
 * Added by configurator: finishes a printer can offer that rate cards do not price yet
 * (quoted manually). Listed per vendor in VendorCapabilities.extraFinishes.
 */
export const EXTRA_FINISH_CODES = ["SOFT_TOUCH_LAMINATION", "VARNISH", "HOT_FOIL", "EMBOSS", "DEBOSS"] as const;
export type ExtraFinishCode = (typeof EXTRA_FINISH_CODES)[number];

/** OUTSIDE = 1 side printed, BOTH = outside + inside. */
export type PrintSides = "OUTSIDE" | "BOTH";

export interface MaterialInfo {
  code: MaterialCode;
  family: StructureFamily;
  boardType: BoardType;
  flute: Flute | null;
  color: BoardColor;
  gsm: number;
  thicknessMm: number;
  name: { ar: string; en: string };
  foodSafe: boolean;
}
