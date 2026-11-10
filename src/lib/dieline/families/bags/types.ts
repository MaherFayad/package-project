import type { BagFilmTone, BagGusset, BagHandleColor, BagHandleKind, Dims, DimsPreset, LocalizedText, MaterialCode, StructureParamLimits } from "@/types";
import type { FeatureSupport } from "../../features";

/** Store (carrier) bag models. The base structure of every one is the core `PAPER_BAG`. */
export const BAG_CODES = [
  "BAG_TWISTED_KRAFT",
  "BAG_FLAT_KRAFT",
  "BAG_SOS",
  "BAG_ROPE_ART",
  "BAG_GIFT_ART",
  "BAG_DIECUT_PATCH",
  "BAG_BOTTLE",
  // Added with plastic bags (base structure PLASTIC_BAG, film generator in film.ts).
  "PBAG_TSHIRT",
  "PBAG_DIECUT",
  "PBAG_KIDNEY",
  "PBAG_SOFT_LOOP",
  "PBAG_CLIP",
  "PBAG_MERCHANDISE",
  "PBAG_DRAWSTRING",
  "PBAG_NONWOVEN",
] as const;
export type BagCode = (typeof BAG_CODES)[number];

/** Construction line: automatic kraft machine bags, or handmade laminated art-paper bags. */
export type BagLine = "machine" | "handmade";

export type BagSubFamily = "kraft-carrier" | "sos" | "boutique" | "die-cut" | "bottle" | "film-tshirt" | "film-die-cut" | "film-loop-clip" | "film-merchandise" | "nonwoven";

/** What the bag is made of: paper (fold engine as boxes), PE film, or non-woven PP fabric. */
export type BagStock = "paper" | "film" | "nonwoven";
/** Picker sub-group. */
export type BagKind = "paper" | "plastic" | "reusable";

export interface BagDefinition {
  code: BagCode;
  slug: string;
  name: LocalizedText;
  description: LocalizedText;
  subFamily: BagSubFamily;
  line: BagLine;
  /** Size designation convention (no published style code exists for carrier bags). */
  standard: string;
  /** Papers in preference order (first = default). All priced on the PAPER_BAG rate cards. */
  materials: MaterialCode[];
  /** L = face width, W = gusset, H = finished height (mouth to base), crease to crease. */
  params: StructureParamLimits;
  defaultDims: Dims;
  presets: DimsPreset[];
  handles: BagHandleKind[];
  defaultHandle: BagHandleKind;
  defaultColor: BagHandleColor;
  /** Laminated art bags get a board base insert; machine kraft bags do not. */
  baseInsert: boolean;
  features: FeatureSupport;
  /** "quote": priced by a printer after a request (die-cut patch tooling, bottle bags). */
  orderMode: "instant" | "quote";
  uses: ("retail" | "apparel" | "gift" | "food" | "grocery" | "beverage" | "ecommerce" | "cosmetics")[];
  /** Added with plastic bags; absent = paper. */
  stock?: BagStock;
  /** Film bags: the gussets offered (first = default) and the film tones. */
  gussets?: BagGusset[];
  tones?: BagFilmTone[];
  defaultTone?: BagFilmTone;
  defaultFilmColor?: BagHandleColor;
}

export const bagStockOf = (d: Pick<BagDefinition, "stock">): BagStock => d.stock ?? "paper";
export const bagKindOf = (d: Pick<BagDefinition, "stock">): BagKind => (d.stock === "film" ? "plastic" : d.stock === "nonwoven" ? "reusable" : "paper");

/** One construction part of a bag that is not the printed paper blank (base board, patches). */
export interface BagPart {
  id: string;
  label: string;
  /** "board": grey chipboard (base insert, top strip); "paper": kraft patch. */
  stock: "board" | "paper";
  widthMm: number;
  heightMm: number;
  count: number;
}

/** What the generator decided (kept on the model for the spec sheet, pricing and tests). */
export interface BagSpec {
  code: BagCode;
  dims: Dims;
  turnoverMm: number;
  glueSeamMm: number;
  bottomFlapMm: number;
  gussetCreaseDeg: number;
  handle: { kind: BagHandleKind; color: BagHandleColor; hex: string; spanMm: number; loopHeightMm: number; sizeMm: number; holeDiameterMm: number | null };
  parts: BagPart[];
  /** Area of the printed paper (or film / fabric) blank alone (m²). */
  paperAreaM2: number;
  /** Plastic bags: the film tone and gusset used. */
  film?: import("@/types").BagFilmChoice;
}

export type { Dims, Range } from "@/types";
