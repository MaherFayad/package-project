import type { LocalizedText, Mm } from "./common";

/**
 * Catalog structure codes (FEFCO for corrugated, ECMA for folding cartons).
 * Must match Structure.code in the DB (seeded in prisma/seed.ts).
 */
export const STRUCTURE_CODES = [
  "FEFCO_0427", // Mailer / e-commerce box (roll end tuck front), corrugated
  "FEFCO_0201", // Regular slotted container (RSC) shipping box, corrugated
  "ECMA_RTE", //   Reverse tuck end folding carton
  "ECMA_STE", //   Straight tuck end folding carton
  "PIZZA", //      Pizza / food box (FEFCO 0426-style), corrugated
  "SLEEVE", //     Sleeve (open both ends wrap), folding carton
] as const;
export type StructureCode = (typeof STRUCTURE_CODES)[number];

export type StructureFamily = "CORRUGATED" | "FOLDING_CARTON";

/** Inner dimensions in millimetres. L = length (front width), W = width (depth), H = height. */
export interface Dims {
  L: Mm;
  W: Mm;
  H: Mm;
}

export interface Range {
  min: Mm;
  max: Mm;
}

/** Stored in Structure.params (Json). */
export interface StructureParamLimits {
  L: Range;
  W: Range;
  H: Range;
  /** Extra rule hints the dieline engine enforces (e.g. "W <= L" for pizza). */
  rules?: string[];
}

/** Stored in Structure.presets (Json). */
export interface DimsPreset {
  id: string; // e.g. "shoe", "perfume-50ml", "pizza-30"
  name: LocalizedText;
  dims: Dims;
  /** A vendor already owns a die for this size: cheaper + faster (pricing applies discount). */
  standard?: boolean;
}

/** Plain serialisable view of a Structure row (dictionary-free). */
export interface StructureInfo {
  code: StructureCode;
  slug: string;
  family: StructureFamily;
  name: LocalizedText;
  description: LocalizedText;
  params: StructureParamLimits;
  defaultDims: Dims;
  presets: DimsPreset[];
}

/**
 * Semantic faces of a closed box. The dieline engine (src/lib/dieline) maps every
 * physical panel to one of these so artwork is placed by face, not by dieline coordinates.
 * Not every structure has every face (a SLEEVE has no top/bottom).
 */
export const FACE_IDS = ["front", "back", "left", "right", "top", "bottom"] as const;
export type FaceId = (typeof FACE_IDS)[number];

/** Which surface of the board is printed. */
export type PrintSurface = "outside" | "inside";
