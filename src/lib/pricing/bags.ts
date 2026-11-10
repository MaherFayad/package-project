import type { BagHandleKind, Dims, MaterialCode, Piasters, StructureFeatures } from "@/types";
import { bagDefinitionOf } from "@/lib/dieline/families/bags/definitions";
import { resolveHandle } from "@/lib/dieline/families/bags/handles";

/**
 * Store bag pricing rules (PAPER_BAG rate cards). Everything here is a BUY price (what the printer
 * charges Elba), integer piasters, ex-VAT; the engine adds the margin and 14% VAT.
 *
 * Basis (docs/audit/bags.md): public Egyptian lists for printed short runs run EGP 7 to 45 per bag
 * (AMPRO, Dotline at 500 bags; Bag 'n Pack about EGP 11 for a small 1-colour kraft bag at 300;
 * coated rope bags about EGP 50 at 1,000). The rate card tiers price a MEDIUM bag (reference paper
 * blank 0.36 m², a 26 x 12 x 35 cm twisted-handle bag) with the handle and lamination excluded;
 * this module adds the size band, the handle and the minimum order.
 */

/** Size bands by printed paper blank area (m²). Printers quote bags by size band, not per mm. */
export const BAG_SIZE_BANDS = [
  { id: "S", maxAreaM2: 0.22, refAreaM2: 0.18, name: { ar: "صغير", en: "Small" } },
  { id: "M", maxAreaM2: 0.42, refAreaM2: 0.36, name: { ar: "متوسط", en: "Medium" } },
  { id: "L", maxAreaM2: 0.66, refAreaM2: 0.55, name: { ar: "كبير", en: "Large" } },
  { id: "XL", maxAreaM2: Infinity, refAreaM2: 0.85, name: { ar: "كبير جدا", en: "Extra large" } },
] as const;
export type BagSizeBand = (typeof BAG_SIZE_BANDS)[number]["id"];

/** Reference blank area of the PAPER_BAG rate cards (the medium band). */
export const BAG_REFERENCE_AREA_M2 = 0.36;

export function bagSizeBand(paperAreaM2: number): (typeof BAG_SIZE_BANDS)[number] {
  return BAG_SIZE_BANDS.find((b) => paperAreaM2 <= b.maxAreaM2) ?? BAG_SIZE_BANDS[BAG_SIZE_BANDS.length - 1];
}

/**
 * Area ratio the engine scales the board share with: the band's reference area, so every size
 * in a band costs the same (above XL it keeps growing with the real area).
 */
export function bagAreaRatio(paperAreaM2: number, cardReferenceAreaM2: number): number {
  const band = bagSizeBand(paperAreaM2);
  const area = band.id === "XL" ? Math.max(band.refAreaM2, paperAreaM2) : band.refAreaM2;
  return area / cardReferenceAreaM2;
}

/**
 * Handle cost per bag (buy, piasters) for the medium band, materials and fixing included:
 * twisted cord + patch on the machine, flat tape, punched eyelets + threading + knots by hand,
 * die-cut board patch. Scaled by band (longer cords and ribbons on bigger bags). Estimates from
 * converter practice; no Egyptian list prices handles separately.
 */
export const BAG_HANDLE_COST: Record<BagHandleKind, Piasters> = {
  TWISTED_PAPER: 60,
  FLAT_PAPER: 45,
  COTTON_ROPE: 320,
  PP_ROPE: 220,
  SATIN_RIBBON: 380,
  GROSGRAIN_RIBBON: 420,
  DIE_CUT: 30,
  NONE: 0,
  // Plastic bags: handles cut from the film cost nothing extra (punching is in the rate card);
  // welded loops, clips, drawstrings and sewn straps are bought-in parts (estimates).
  TSHIRT: 0,
  DIE_CUT_PATCH: 8,
  KIDNEY: 0,
  SOFT_LOOP: 35,
  RIGID_CLIP: 120,
  DRAWSTRING: 25,
  SEWN_STRAP: 90,
};
const BAND_HANDLE_FACTOR: Record<BagSizeBand, number> = { S: 0.8, M: 1, L: 1.2, XL: 1.45 };

/** Board base insert + top strips of laminated bags, per bag (buy, piasters, medium band). */
export const BAG_BOARD_PARTS_COST: Piasters = 150;
const BAND_PARTS_FACTOR: Record<BagSizeBand, number> = { S: 0.6, M: 1, L: 1.5, XL: 2.2 };

/** Machine-made kraft bags vs handmade laminated art-paper bags. */
export type BagLineOf = "machine" | "handmade";
export const bagLineOfMaterial = (m: MaterialCode): BagLineOf => (m.startsWith("BAG_ART_") ? "handmade" : "machine");

/**
 * Minimum order per bag line. Egyptian sellers: printed kraft from 200 (Bag 'n Pack), printed bags
 * from 500 (AMPRO, Dotline), coated rope bags from 1,000 (Al-Hadaf); luxury makers abroad from 200
 * to 300. We take 200 for kraft and 300 for laminated bags, so the first instant tiers are 250 and
 * 500.
 */
export const BAG_MOQ: Record<BagLineOf, number> = { machine: 200, handmade: 300 };

export interface BagCostExtras {
  band: (typeof BAG_SIZE_BANDS)[number];
  handle: BagHandleKind;
  /** Buy price per bag of the handle (piasters, may be fractional before rounding). */
  handleUnit: number;
  /** Buy price per bag of the board parts (base insert, strips). */
  partsUnit: number;
  moq: number;
}

/** Size band, handle and parts of a bag quote. `modelCode` absent = the core twisted kraft bag. */
export function bagCostExtras(input: { modelCode?: string; features?: StructureFeatures | null; material: MaterialCode; paperAreaM2: number }): BagCostExtras {
  const def = bagDefinitionOf(input.modelCode ?? "BAG_TWISTED_KRAFT") ?? bagDefinitionOf("BAG_TWISTED_KRAFT")!;
  const handle = resolveHandle(def, input.features?.bagHandle).kind;
  const band = bagSizeBand(input.paperAreaM2);
  return {
    band,
    handle,
    handleUnit: BAG_HANDLE_COST[handle] * BAND_HANDLE_FACTOR[band.id],
    partsUnit: def.baseInsert ? BAG_BOARD_PARTS_COST * BAND_PARTS_FACTOR[band.id] : 0,
    moq: BAG_MOQ[bagLineOfMaterial(input.material)],
  };
}

/** Rough paper blank area for a size without a model (glue seam + 2 faces + 2 gussets) x (height + turnover + bottom). */
export function estimateBagPaperArea(d: Dims): number {
  return ((2 * (d.L + d.W) + 18) * (d.H + 40 + d.W / 2 + 15)) / 1e6;
}

/* ───────────────────────── plastic (film) and non-woven bags ───────────────────────── */

/**
 * Egypt's extended producer responsibility fee on plastic shopping bags: EGP 37.5 per kg of bags
 * sold locally, Prime Minister's Decree 662/2025 (Official Gazette 9 bis (B), 2 Mar 2025, under
 * Article 17 of Waste Management Law 202/2020), in force about 3 June 2025, paid by producers and
 * importers of ES 3040 bags. Passed through at cost (no Elba margin) as its own quote line.
 */
export const PLASTIC_BAG_EPR_PIASTERS_PER_KG: Piasters = 3_750;

/**
 * Minimum order of film bags by weight (no Egyptian printer publishes one; short-run printers sell
 * printed bags "with no minimum", factories ship free above 500 kg). 5 kg is our instant floor;
 * non-woven bags start at 100 pieces (AMPRO cloth bags).
 */
export const FILM_MOQ_KG = 5;
export const NONWOVEN_MOQ_PCS = 100;

/** Share of a film bag's price that scales with its weight (resin and film dominate the cost). */
export const FILM_WEIGHT_SHARE = 0.9;

export interface PlasticCostExtras {
  handle: BagHandleKind;
  handleUnit: number;
  /** Bag weight (kg). */
  weightKg: number;
  /** EPR fee per bag (piasters, may be fractional); 0 for reusable non-woven bags. */
  eprUnit: number;
  moq: number;
}

export function plasticCostExtras(input: { modelCode?: string; features?: StructureFeatures | null; material: MaterialCode; gsm: number; areaM2: number }): PlasticCostExtras {
  const def = bagDefinitionOf(input.modelCode ?? "PBAG_DIECUT") ?? bagDefinitionOf("PBAG_DIECUT")!;
  const handle = resolveHandle(def, input.features?.bagHandle).kind;
  const weightKg = (input.areaM2 * input.gsm) / 1000;
  const nonwoven = input.material.startsWith("NONWOVEN_");
  return {
    handle,
    // A plain die-cut hole in film costs nothing extra (the paper die-cut cost is its board patch).
    handleUnit: handle === "DIE_CUT" ? 0 : BAG_HANDLE_COST[handle],
    weightKg,
    eprUnit: nonwoven ? 0 : weightKg * PLASTIC_BAG_EPR_PIASTERS_PER_KG,
    moq: nonwoven ? NONWOVEN_MOQ_PCS : Math.ceil(FILM_MOQ_KG / Math.max(weightKg, 1e-6)),
  };
}
