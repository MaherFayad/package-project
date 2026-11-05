import type { BoardColor, Flute, LocalizedText, MaterialCode, StructureFamily } from "@/types";
import type { LabelFinishCode, LabelStockCode } from "@/lib/vessels";

/**
 * Configurator catalogue (owner: configuration + finishes). Everything a buyer can pick on top
 * of the model and size: boards / stocks, colour modes, finishes and add-ons, with the print
 * facts the rules engine needs. Pure data, no React, no three.js.
 *
 * Print facts behind the rules (checked against printer and converter guidance, Nov 2026):
 * - Spot UV needs a sealed (coated or laminated) surface to sit on; on uncoated kraft it soaks in
 *   and loses the gloss contrast. It reads best over matte or soft-touch lamination and has no
 *   contrast over gloss lamination.
 * - Film lamination (gloss, matte, soft-touch) needs a coated, closed surface; porous uncoated
 *   stock (kraft liner) bonds poorly. Corrugated gets lamination, foil and spot UV through a
 *   litho-laminated facing (offset-printed coated sheet glued onto E/B flute), the usual white
 *   E-flute route in Egypt.
 * - Hot foil works on litho-lam and coated board; on a direct kraft liner it is possible on the
 *   smooth E-flute for bold logos, not on the washboard surface of B and BC flute.
 * - Emboss / deboss crush the flutes of corrugated board and weaken the wall, so they are only
 *   offered on solid board (SBS, rigid wrap paper, tube labels). SBS embosses best at 14-24 pt
 *   (about 0.35-0.6 mm), so SBS 300 (0.40 mm) works with shallow dies.
 * - Kraft liners print darker and duller; there is no white ink in a standard CMYK set, so
 *   white areas show the brown board. B and BC flute are printed flexo directly on the liner, so
 *   process (CMYK) photos are not offered there.
 * Flute calipers: E about 1.5 mm, B about 3 mm, BC double wall about 6.5 mm.
 */

/* ───────────────────────────── surfaces ───────────────────────────── */

/**
 * What the ink and finishes actually sit on. Rules are written per surface class, so a new
 * board only needs the right class.
 */
export type SurfaceClass =
  | "KRAFT_LINER" //     uncoated brown liner, printed directly (flexo / digital)
  | "WHITE_TOP_LINER" // uncoated white-top liner, printed flexo directly
  | "LITHO_LAM" //       offset-printed coated sheet laminated onto flute (E-flute white)
  | "COATED_BOARD" //    SBS folding boxboard, offset
  | "ART_PAPER_WRAP" //  157 gsm coated art paper wrapped over greyboard / tube
  | "LABEL_PAPER" //     semi-gloss label paper (roll labels)
  | "LABEL_FILM" //      BOPP label film (white, clear, metallic)
  | "SHRINK_FILM" //     PETG shrink sleeve (reverse printed)
  | "FLEXIBLE_FILM" //   printed laminate of a stand-up pouch
  | "PE_TUBE"; //        printed PE tube body

/* ───────────────────────────── boards (boxes) ───────────────────────────── */

export const BOX_BOARD_CODES = [
  "E_FLUTE_KRAFT",
  "E_FLUTE_WHITE",
  "B_FLUTE_KRAFT",
  "B_FLUTE_WHITE",
  "BC_FLUTE_KRAFT",
  "BC_FLUTE_WHITE",
  "SBS_300",
  "SBS_350",
  "GREYBOARD_WRAP",
  "KRAFT_TUBE",
] as const;
export type BoxBoardCode = (typeof BOX_BOARD_CODES)[number];

export interface BoxBoard {
  code: BoxBoardCode;
  family: StructureFamily;
  surface: SurfaceClass;
  flute: Flute | "BC" | null;
  color: BoardColor;
  /** Caliper in mm (drives the dieline allowances). */
  thicknessMm: number;
  gsm: number;
  name: LocalizedText;
  /** Material row the pricing engine and rate cards know. null = no rate cards yet (manual quote). */
  pricingMaterial: MaterialCode | null;
  foodSafe: boolean;
}

const b = (x: BoxBoard) => x;

export const BOX_BOARDS: Record<BoxBoardCode, BoxBoard> = {
  E_FLUTE_KRAFT: b({ code: "E_FLUTE_KRAFT", family: "CORRUGATED", surface: "KRAFT_LINER", flute: "E", color: "KRAFT", thicknessMm: 1.5, gsm: 420, name: { ar: "كرتون مضلع E بني", en: "E-flute kraft" }, pricingMaterial: "E_FLUTE_KRAFT", foodSafe: true }),
  E_FLUTE_WHITE: b({ code: "E_FLUTE_WHITE", family: "CORRUGATED", surface: "LITHO_LAM", flute: "E", color: "WHITE", thicknessMm: 1.5, gsm: 450, name: { ar: "كرتون مضلع E أبيض", en: "E-flute white" }, pricingMaterial: "E_FLUTE_WHITE", foodSafe: true }),
  B_FLUTE_KRAFT: b({ code: "B_FLUTE_KRAFT", family: "CORRUGATED", surface: "KRAFT_LINER", flute: "B", color: "KRAFT", thicknessMm: 3, gsm: 500, name: { ar: "كرتون مضلع B بني", en: "B-flute kraft" }, pricingMaterial: "B_FLUTE_KRAFT", foodSafe: true }),
  B_FLUTE_WHITE: b({ code: "B_FLUTE_WHITE", family: "CORRUGATED", surface: "WHITE_TOP_LINER", flute: "B", color: "WHITE", thicknessMm: 3, gsm: 520, name: { ar: "كرتون مضلع B أبيض", en: "B-flute white" }, pricingMaterial: null, foodSafe: true }),
  BC_FLUTE_KRAFT: b({ code: "BC_FLUTE_KRAFT", family: "CORRUGATED", surface: "KRAFT_LINER", flute: "BC", color: "KRAFT", thicknessMm: 6.5, gsm: 800, name: { ar: "كرتون مضلع مزدوج BC بني", en: "BC double wall kraft" }, pricingMaterial: null, foodSafe: false }),
  BC_FLUTE_WHITE: b({ code: "BC_FLUTE_WHITE", family: "CORRUGATED", surface: "WHITE_TOP_LINER", flute: "BC", color: "WHITE", thicknessMm: 6.5, gsm: 820, name: { ar: "كرتون مضلع مزدوج BC أبيض", en: "BC double wall white" }, pricingMaterial: null, foodSafe: false }),
  SBS_300: b({ code: "SBS_300", family: "FOLDING_CARTON", surface: "COATED_BOARD", flute: null, color: "WHITE", thicknessMm: 0.4, gsm: 300, name: { ar: "كرتون دوبلكس أبيض 300 جم", en: "SBS 300 gsm" }, pricingMaterial: "SBS_300", foodSafe: true }),
  SBS_350: b({ code: "SBS_350", family: "FOLDING_CARTON", surface: "COATED_BOARD", flute: null, color: "WHITE", thicknessMm: 0.48, gsm: 350, name: { ar: "كرتون دوبلكس أبيض 350 جم", en: "SBS 350 gsm" }, pricingMaterial: "SBS_350", foodSafe: true }),
  GREYBOARD_WRAP: b({ code: "GREYBOARD_WRAP", family: "RIGID", surface: "ART_PAPER_WRAP", flute: null, color: "WHITE", thicknessMm: 2.15, gsm: 1400, name: { ar: "كرتون مقوى 2 مم مغلف بورق مطبوع", en: "2 mm greyboard, printed wrap" }, pricingMaterial: "GREYBOARD_WRAP", foodSafe: false }),
  KRAFT_TUBE: b({ code: "KRAFT_TUBE", family: "TUBE", surface: "ART_PAPER_WRAP", flute: null, color: "WHITE", thicknessMm: 1.5, gsm: 1000, name: { ar: "أنبوبة كرتون بملصق مطبوع", en: "Kraft tube, printed label" }, pricingMaterial: "KRAFT_TUBE", foodSafe: true }),
};

export function isCorrugated(board: BoxBoard): boolean {
  return board.family === "CORRUGATED";
}

/* ───────────────────────────── stocks (vessels) ───────────────────────────── */

/** Label stocks plus "printed on the container itself" (pouches, tubes). */
export const VESSEL_STOCK_CODES = ["PAPER_SEMIGLOSS", "WHITE_BOPP", "CLEAR_BOPP", "METALLIC_BOPP", "PETG_SHRINK", "DIRECT_PRINT"] as const;
export type VesselStockCode = (typeof VESSEL_STOCK_CODES)[number];

export const VESSEL_STOCK_SURFACE: Record<VesselStockCode, SurfaceClass> = {
  PAPER_SEMIGLOSS: "LABEL_PAPER",
  WHITE_BOPP: "LABEL_FILM",
  CLEAR_BOPP: "LABEL_FILM",
  METALLIC_BOPP: "LABEL_FILM",
  PETG_SHRINK: "SHRINK_FILM",
  DIRECT_PRINT: "FLEXIBLE_FILM", // refined per kind in the rules (tube = PE_TUBE)
};

export const DIRECT_PRINT_NAME: LocalizedText = { ar: "طباعة مباشرة على العبوة", en: "Printed on the pack itself" };

export function isLabelStock(code: VesselStockCode): code is LabelStockCode {
  return code !== "DIRECT_PRINT";
}

/* ───────────────────────────── colour ───────────────────────────── */

export const MAX_SPOT_INKS = 4;
export const MAX_EXTRA_SPOTS_WITH_CMYK = 2;
/** Pantone-style reference ("PMS 186 C", "186C", "Black C", "877 C") or a hex swatch. */
export const SPOT_INK_PATTERN = /^(?:(?:PMS\s?)?(?:\d{3,5}|[A-Za-z][A-Za-z ]{1,20}?)\s?[CUM]|#[0-9a-fA-F]{6})$/;

/* ───────────────────────────── finishes ───────────────────────────── */

export const CONFIG_FINISH_CODES = [
  "MATTE_LAMINATION",
  "GLOSS_LAMINATION",
  "SOFT_TOUCH_LAMINATION",
  "GLOSS_VARNISH",
  "MATTE_VARNISH",
  "SPOT_UV",
  "FOIL_GOLD",
  "FOIL_SILVER",
  "FOIL_ROSE_GOLD",
  "EMBOSS",
  "DEBOSS",
] as const;
export type ConfigFinishCode = (typeof CONFIG_FINISH_CODES)[number];

/** coating = whole surface, one per surface. Others are masked by artwork layers. */
export type FinishGroup = "coating" | "spotUv" | "foil" | "relief";

export interface FinishDef {
  code: ConfigFinishCode;
  group: FinishGroup;
  /** Needs a mask (artwork layers). */
  masked: boolean;
  name: LocalizedText;
  /** Label printing equivalent (null = not offered on labels). */
  label: LabelFinishCode | null;
}

const fd = (x: FinishDef) => x;

export const FINISHES: Record<ConfigFinishCode, FinishDef> = {
  MATTE_LAMINATION: fd({ code: "MATTE_LAMINATION", group: "coating", masked: false, name: { ar: "سلوفان مطفي", en: "Matte lamination" }, label: "MATTE_LAMINATION" }),
  GLOSS_LAMINATION: fd({ code: "GLOSS_LAMINATION", group: "coating", masked: false, name: { ar: "سلوفان لامع", en: "Gloss lamination" }, label: "GLOSS_LAMINATION" }),
  SOFT_TOUCH_LAMINATION: fd({ code: "SOFT_TOUCH_LAMINATION", group: "coating", masked: false, name: { ar: "سلوفان مخملي", en: "Soft-touch lamination" }, label: null }),
  GLOSS_VARNISH: fd({ code: "GLOSS_VARNISH", group: "coating", masked: false, name: { ar: "ورنيش لامع", en: "Gloss varnish" }, label: "GLOSS_VARNISH" }),
  MATTE_VARNISH: fd({ code: "MATTE_VARNISH", group: "coating", masked: false, name: { ar: "ورنيش مطفي", en: "Matte varnish" }, label: "MATTE_VARNISH" }),
  SPOT_UV: fd({ code: "SPOT_UV", group: "spotUv", masked: true, name: { ar: "يو في موضعي", en: "Spot UV" }, label: "SPOT_UV" }),
  FOIL_GOLD: fd({ code: "FOIL_GOLD", group: "foil", masked: true, name: { ar: "بصمة ذهبي", en: "Gold foil" }, label: "HOT_FOIL" }),
  FOIL_SILVER: fd({ code: "FOIL_SILVER", group: "foil", masked: true, name: { ar: "بصمة فضي", en: "Silver foil" }, label: "HOT_FOIL" }),
  FOIL_ROSE_GOLD: fd({ code: "FOIL_ROSE_GOLD", group: "foil", masked: true, name: { ar: "بصمة روز جولد", en: "Rose gold foil" }, label: "HOT_FOIL" }),
  EMBOSS: fd({ code: "EMBOSS", group: "relief", masked: true, name: { ar: "طباعة بارزة", en: "Emboss" }, label: "EMBOSS" }),
  DEBOSS: fd({ code: "DEBOSS", group: "relief", masked: true, name: { ar: "طباعة غائرة", en: "Deboss" }, label: null }),
};

/** At most this many foil colours per job (each colour is a separate pass and die). */
export const MAX_FOIL_COLOURS = 2;

/* ───────────────────────────── add-ons ───────────────────────────── */

export const ADD_ON_KEYS = ["windowFilm", "insert", "handle", "tearStrip"] as const;
export type AddOnKey = (typeof ADD_ON_KEYS)[number];

export const ADD_ON_NAMES: Record<AddOnKey, LocalizedText> = {
  windowFilm: { ar: "نافذة بفيلم شفاف", en: "Window with clear film" },
  insert: { ar: "حشوة داخلية", en: "Insert" },
  handle: { ar: "مقبض", en: "Handle" },
  tearStrip: { ar: "شريط فتح", en: "Tear strip" },
};

export const INSERT_KINDS = ["DIVIDERS", "CARD_INSERT", "FOAM_EVA"] as const;
export type InsertKind = (typeof INSERT_KINDS)[number];
export const INSERT_NAMES: Record<InsertKind, LocalizedText> = {
  DIVIDERS: { ar: "فواصل كرتون", en: "Card dividers" },
  CARD_INSERT: { ar: "حشوة كرتون مفرغة", en: "Die-cut card insert" },
  FOAM_EVA: { ar: "حشوة فوم", en: "Foam insert" },
};

/* ───────────────────────────── quantity ───────────────────────────── */

export const MIN_QUANTITY = 1;
export const MAX_QUANTITY = 1_000_000;
/** Below this most Egyptian printers will not take a job (digital short runs excepted). */
export const TYPICAL_MIN_QUANTITY = 100;
