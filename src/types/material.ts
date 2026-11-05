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
] as const;
export type MaterialCode = (typeof MATERIAL_CODES)[number];

export type BoardType = "CORRUGATED" | "SBS" | "GREYBOARD" | "TUBE";
export type Flute = "E" | "B";
export type BoardColor = "KRAFT" | "WHITE";

/** Must match Finish.code in the DB. */
export const FINISH_CODES = ["NONE", "MATTE_LAMINATION", "GLOSS_LAMINATION", "SPOT_UV"] as const;
export type FinishCode = (typeof FINISH_CODES)[number];

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
