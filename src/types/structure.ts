import type { LocalizedText, Mm } from "./common";
import type { BagHandleChoice } from "./bag";

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
  "FEFCO_0320", // Two-piece full telescope box: HSC base (FEFCO 0200) + HSC lid, corrugated
  "ECMA_CLB", //   Tuck top, crash-lock (automatic) bottom, ECMA A60.20, folding carton
  "ECMA_SLB", //   Tuck top, 1-2-3 snap-lock bottom, ECMA A55.20, folding carton
  "FEFCO_0422", // Self-locking display / shelf tray, corrugated
  "GABLE_BOX", //  Gable carry box with handle, snap-lock bottom, folding carton
  "PAPER_TUBE", // Cylindrical paper tube (composite can) with telescoping lid
  "RIGID_BOX", //  Rigid set-up box, lid and base (greyboard wrapped in printed paper)
  // Added by 3D integration: printed parts for containers (bottles, jars, cans, tins, pouches, tubes).
  "ROLL_LABEL", //    Die-cut roll labels and shrink sleeves (sized from the container's print areas)
  "PRINTED_POUCH", // Printed flexible laminate pouch (stand-up, flat, gusset bags)
  "PRINTED_TUBE", //  Printed laminate / PE squeeze tube body
  // Added by bags: paper carrier bags (kraft machine bags and laminated art-paper boutique bags).
  "PAPER_BAG", //     Paper carrier bag: tube with side gussets, pasted block bottom, top turnover, handles
] as const;
export type StructureCode = (typeof STRUCTURE_CODES)[number];

/** RIGID = wrapped greyboard set-up boxes; TUBE = spiral-wound paper tubes (composite cans). */
export type StructureFamily = "CORRUGATED" | "FOLDING_CARTON" | "RIGID" | "TUBE" | "LABEL" | "FLEXIBLE" | "PAPER_BAG";

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

/**
 * Optional construction features a structure may support (see STRUCTURES[code].features in
 * src/lib/dieline). Every field is optional; unsupported ones are ignored by the engine.
 * Stored in DesignDoc.features (Json) so the dieline, 3D view and price agree.
 */
export interface StructureFeatures {
  /** Die-cut window on one face, optionally closed with clear film glued inside. */
  window?: { face: FaceId; widthRatio?: number; heightRatio?: number; film?: boolean } | null;
  /** Half-round finger cut on the front opening edge. */
  thumbNotch?: boolean;
  /** Hand-hole / handle cut-outs. */
  handle?: boolean;
  /** Perforated tear-open strip. */
  tearStrip?: boolean;
  /** Divider grid inside the box (rows along W, cols along L; 1 = no divider that way). */
  partitions?: { rows: number; cols: number } | null;
  /** Lid depth for two-piece boxes (mm, inner). Default per structure. */
  lidHeightMm?: number;
  /** Lowered display front (shelf-ready trays). */
  displayFront?: boolean;
  /** Added by bags: handle type and colour of a paper carrier bag. Absent = the model's default. */
  bagHandle?: BagHandleChoice | null;
}
