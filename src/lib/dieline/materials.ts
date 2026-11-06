import type { BoardColor, FinishCode, Flute, MaterialCode, StructureCode, StructureFamily } from "@/types";

/** Mirrors Structure.family in the seed. */
export const STRUCTURE_FAMILY: Record<StructureCode, StructureFamily> = {
  FEFCO_0427: "CORRUGATED",
  FEFCO_0201: "CORRUGATED",
  ECMA_RTE: "FOLDING_CARTON",
  ECMA_STE: "FOLDING_CARTON",
  PIZZA: "CORRUGATED",
  SLEEVE: "FOLDING_CARTON",
  FEFCO_0320: "CORRUGATED",
  ECMA_CLB: "FOLDING_CARTON",
  ECMA_SLB: "FOLDING_CARTON",
  FEFCO_0422: "CORRUGATED",
  GABLE_BOX: "FOLDING_CARTON",
  PAPER_TUBE: "TUBE",
  RIGID_BOX: "RIGID",
  ROLL_LABEL: "LABEL",
  PRINTED_POUCH: "FLEXIBLE",
  PRINTED_TUBE: "FLEXIBLE",
};

export interface BoardSpec {
  code: MaterialCode;
  family: StructureFamily;
  thicknessMm: number;
  flute: Flute | null;
  /** Colour of the printed (outside) liner. */
  color: BoardColor;
}

/** Mirrors Material rows in the seed (thickness drives the dieline allowances). */
export const BOARD_SPECS: Record<MaterialCode, BoardSpec> = {
  E_FLUTE_KRAFT: { code: "E_FLUTE_KRAFT", family: "CORRUGATED", thicknessMm: 1.5, flute: "E", color: "KRAFT" },
  E_FLUTE_WHITE: { code: "E_FLUTE_WHITE", family: "CORRUGATED", thicknessMm: 1.5, flute: "E", color: "WHITE" },
  B_FLUTE_KRAFT: { code: "B_FLUTE_KRAFT", family: "CORRUGATED", thicknessMm: 3, flute: "B", color: "KRAFT" },
  SBS_300: { code: "SBS_300", family: "FOLDING_CARTON", thicknessMm: 0.4, flute: null, color: "WHITE" },
  SBS_350: { code: "SBS_350", family: "FOLDING_CARTON", thicknessMm: 0.48, flute: null, color: "WHITE" },
  // 2 mm greyboard + 157 gsm wrap paper (~0.15 mm): the wall a rigid box is built from.
  GREYBOARD_WRAP: { code: "GREYBOARD_WRAP", family: "RIGID", thicknessMm: 2.15, flute: null, color: "WHITE" },
  // Spiral-wound kraft tube wall with a printed paper label.
  KRAFT_TUBE: { code: "KRAFT_TUBE", family: "TUBE", thicknessMm: 1.5, flute: null, color: "WHITE" },
  // Label stocks (face + adhesive + liner calipers do not matter for flat labels; face only).
  LABEL_PAPER: { code: "LABEL_PAPER", family: "LABEL", thicknessMm: 0.08, flute: null, color: "WHITE" },
  LABEL_WHITE_BOPP: { code: "LABEL_WHITE_BOPP", family: "LABEL", thicknessMm: 0.06, flute: null, color: "WHITE" },
  LABEL_CLEAR_BOPP: { code: "LABEL_CLEAR_BOPP", family: "LABEL", thicknessMm: 0.05, flute: null, color: "WHITE" },
  LABEL_METALLIC_BOPP: { code: "LABEL_METALLIC_BOPP", family: "LABEL", thicknessMm: 0.06, flute: null, color: "WHITE" },
  SHRINK_PETG: { code: "SHRINK_PETG", family: "LABEL", thicknessMm: 0.05, flute: null, color: "WHITE" },
  // Flexible laminates (pouches) and tube bodies.
  POUCH_PET_PE: { code: "POUCH_PET_PE", family: "FLEXIBLE", thicknessMm: 0.1, flute: null, color: "WHITE" },
  POUCH_KRAFT_PE: { code: "POUCH_KRAFT_PE", family: "FLEXIBLE", thicknessMm: 0.15, flute: null, color: "KRAFT" },
  TUBE_PE: { code: "TUBE_PE", family: "FLEXIBLE", thicknessMm: 0.4, flute: null, color: "WHITE" },
};

/** Sensible default board per structure family (for previews before a material is chosen). */
export function defaultMaterialFor(code: StructureCode): MaterialCode {
  switch (STRUCTURE_FAMILY[code]) {
    case "CORRUGATED":
      return "E_FLUTE_KRAFT";
    case "RIGID":
      return "GREYBOARD_WRAP";
    case "TUBE":
      return "KRAFT_TUBE";
    case "LABEL":
      return "LABEL_WHITE_BOPP";
    case "FLEXIBLE":
      return code === "PRINTED_TUBE" ? "TUBE_PE" : "POUCH_PET_PE";
    default:
      return "SBS_350";
  }
}

export function materialFitsStructure(material: MaterialCode, code: StructureCode): boolean {
  if (BOARD_SPECS[material].family !== STRUCTURE_FAMILY[code]) return false;
  // Flexible: pouches take laminates, tubes take the PE tube body.
  if (code === "PRINTED_TUBE") return material === "TUBE_PE";
  if (code === "PRINTED_POUCH") return material !== "TUBE_PE";
  return true;
}

/**
 * Visual appearance used by the 3D view and texture painter (sRGB hex colours).
 * Kept here (not in components/three) so 2D previews and tests can share it.
 */
export interface BoardAppearance {
  /** Outside liner colour (unprinted). */
  outside: string;
  /** Inside liner colour. */
  inside: string;
  /** Cut-edge base colour. */
  edge: string;
  /** Flute wave colour on the cut edge (corrugated only). */
  fluteColor: string | null;
  /** Flute pitch in mm (E ≈ 3.3, B ≈ 6.5), null for solid board. */
  flutePitchMm: number | null;
  roughness: number;
}

const KRAFT = "#b98d5e";
const KRAFT_INNER = "#a87d50";
const WHITE_LINER = "#f4f1ea";
const SBS_WHITE = "#fbfbf8";

export function boardAppearance(material: MaterialCode): BoardAppearance {
  const spec = BOARD_SPECS[material];
  if (spec.family === "CORRUGATED") {
    const pitch = spec.flute === "B" ? 6.5 : 3.3;
    return {
      outside: spec.color === "KRAFT" ? KRAFT : WHITE_LINER,
      inside: KRAFT_INNER,
      edge: "#c9a476",
      fluteColor: "#8f6a42",
      flutePitchMm: pitch,
      roughness: 0.92,
    };
  }
  if (spec.family === "RIGID") {
    // Art paper over greyboard; the paper wraps the rim, so cut edges read as paper too.
    return { outside: "#f7f5f0", inside: "#ece6da", edge: "#efebe3", fluteColor: null, flutePitchMm: null, roughness: 0.5 };
  }
  if (spec.family === "LABEL" || spec.family === "FLEXIBLE") {
    return { outside: spec.color === "KRAFT" ? KRAFT : "#fdfdfb", inside: "#f2f2ef", edge: "#ecebe6", fluteColor: null, flutePitchMm: null, roughness: 0.4 };
  }
  if (spec.family === "TUBE") {
    // The label paper is rolled over the tube's rims, so the visible edges read as label.
    return { outside: "#f8f7f3", inside: KRAFT_INNER, edge: "#e8e2d6", fluteColor: null, flutePitchMm: null, roughness: 0.55 };
  }
  return { outside: SBS_WHITE, inside: "#f0eee8", edge: "#ecebe6", fluteColor: null, flutePitchMm: null, roughness: 0.62 };
}

/** Surface roughness / clearcoat for the printed side after the finish. */
export function finishSurface(finish: FinishCode | undefined, base: BoardAppearance): { roughness: number; clearcoat: number } {
  switch (finish) {
    case "GLOSS_LAMINATION":
      return { roughness: 0.16, clearcoat: 0.8 };
    case "MATTE_LAMINATION":
      return { roughness: 0.55, clearcoat: 0 };
    case "SPOT_UV":
      return { roughness: 0.5, clearcoat: 0.25 };
    case "SOFT_TOUCH_LAMINATION":
      return { roughness: 0.78, clearcoat: 0 };
    case "VARNISH":
      return { roughness: 0.35, clearcoat: 0.3 };
    default:
      return { roughness: base.roughness, clearcoat: 0 };
  }
}
