import type { MaterialCode, StructureCode } from "@/types";
import { QUOTE_VALIDITY_HOURS } from "@/types";
import type { DeliveryZone } from "./types";

/**
 * Weekly-updated FX / board price index (report §5.5). Each row multiplies the BOARD share of
 * every rate-card price. `fx` reflects the EGP/USD move on imported liner and SBS since rate cards
 * were collected; `board` is the per-material mill-price index. The latest row whose
 * `effectiveFrom` is not in the future applies.
 */
export interface PriceIndexRow {
  id: string;
  effectiveFrom: string; // ISO date
  fx: number;
  board: Partial<Record<MaterialCode, number>>;
  note?: string;
}

export const PRICE_INDEX_TABLE: PriceIndexRow[] = [
  { id: "2026-W01", effectiveFrom: "2026-01-01", fx: 1, board: {}, note: "Rate card baseline" },
  {
    id: "2026-W40",
    effectiveFrom: "2026-10-01",
    fx: 1.02,
    board: { E_FLUTE_KRAFT: 1.03, E_FLUTE_WHITE: 1.03, B_FLUTE_KRAFT: 1.04, SBS_300: 1.01, SBS_350: 1.01 },
    note: "Kraft liner up after Q3 mill price rise",
  },
];

export interface ZoneRate {
  /** Courier price for the first `includedKg` (piasters, ex-VAT). */
  basePiasters: number;
  includedKg: number;
  perExtraKgPiasters: number;
  /** Truck / van price per load when the shipment is above `freightThresholdKg`. */
  freightPerLoadPiasters: number;
  transitDays: number;
}

export interface FlatPackSpec {
  /** Glued boxes ship folded flat (2 board layers, about half the blank footprint). */
  glued: boolean;
  /** Units per bundle are capped by stack height (mm). */
  maxStackMm: number;
}

export interface PricingConfig {
  /** Platform margin on vendor buy price (0.25 = 25%). */
  marginPct: number;
  /** Apply the margin to delivery too (default: delivery is priced from our own courier card). */
  marginOnShipping: boolean;
  vatRate: number;
  quoteValidityHours: number;
  maxInstantQty: number;
  /** Share of a rate-card unit price that scales with board area and the board index. */
  boardShare: number;
  /** Clamp for blank area / reference area (very small boxes still carry handling cost). */
  areaRatioMin: number;
  areaRatioMax: number;
  /** Unit-price factor by number of colours (rate cards are quoted for 4-colour CMYK). */
  colourUnitFactor: Record<number, number>;
  /** Offset setup (plates + make-ready) factor by number of colours. */
  colourSetupFactor: Record<number, number>;
  /** Extra setup for the second (inside) print side on offset (plates for the other side). */
  bothSidesSetupFactor: number;
  maxColours: number;
  digital: {
    /** Digital is offered up to this quantity (vendors with `digitalShortRun`). */
    maxQty: number;
    /** Digital unit premium over the offset rate-card unit (click + slower press). */
    unitPremium: number;
    /** Digital setup as a share of the offset setup (file prep only, no plates). */
    setupShare: number;
    /** Production days saved (no plates). */
    leadTimeSavingDays: number;
  };
  /** Days added when a new cutting die has to be made. */
  customDieExtraDays: number;
  minLeadTimeDays: number;
  /** A size counts as standard when every dim is within this tolerance of a die (mm). */
  standardToleranceMm: number;
  /** Suggest a standard size only if its inner volume is at most this much bigger. */
  suggestionMaxVolumeIncrease: number;
  shipping: {
    /** Volumetric divisor in cm³ per kg (courier standard). */
    volumetricDivisor: number;
    freightThresholdKg: number;
    /** Price multiplier when the vendor ships from another zone. */
    interZoneMultiplier: number;
    interZoneExtraDays: number;
    zones: Record<DeliveryZone, ZoneRate>;
    flatPack: Record<StructureCode, FlatPackSpec>;
  };
  /** Best-match weights (sum to 1). */
  ranking: { price: number; speed: number; quality: number };
  priceIndex: PriceIndexRow[];
}

export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  marginPct: 0.25,
  marginOnShipping: false,
  vatRate: 0.14,
  quoteValidityHours: QUOTE_VALIDITY_HOURS,
  maxInstantQty: 2000,
  boardShare: 0.6,
  areaRatioMin: 0.25,
  areaRatioMax: 6,
  colourUnitFactor: { 1: 0.85, 2: 0.9, 3: 0.95, 4: 1, 5: 1.08, 6: 1.15 },
  colourSetupFactor: { 1: 0.4, 2: 0.6, 3: 0.8, 4: 1, 5: 1.25, 6: 1.5 },
  bothSidesSetupFactor: 1.5,
  maxColours: 6,
  digital: { maxQty: 1000, unitPremium: 1.2, setupShare: 0.15, leadTimeSavingDays: 1 },
  customDieExtraDays: 3,
  minLeadTimeDays: 2,
  standardToleranceMm: 2,
  suggestionMaxVolumeIncrease: 0.3,
  shipping: {
    volumetricDivisor: 5000,
    freightThresholdKg: 150,
    interZoneMultiplier: 1.15,
    interZoneExtraDays: 1,
    zones: {
      GREATER_CAIRO: { basePiasters: 7000, includedKg: 5, perExtraKgPiasters: 800, freightPerLoadPiasters: 90000, transitDays: 1 },
      ALEXANDRIA: { basePiasters: 8500, includedKg: 5, perExtraKgPiasters: 1000, freightPerLoadPiasters: 160000, transitDays: 2 },
      DELTA: { basePiasters: 9000, includedKg: 5, perExtraKgPiasters: 1000, freightPerLoadPiasters: 150000, transitDays: 2 },
      CANAL: { basePiasters: 9500, includedKg: 5, perExtraKgPiasters: 1100, freightPerLoadPiasters: 170000, transitDays: 2 },
      UPPER_EGYPT: { basePiasters: 12000, includedKg: 5, perExtraKgPiasters: 1400, freightPerLoadPiasters: 280000, transitDays: 4 },
    },
    flatPack: {
      FEFCO_0427: { glued: false, maxStackMm: 300 },
      FEFCO_0201: { glued: true, maxStackMm: 300 },
      PIZZA: { glued: false, maxStackMm: 300 },
      ECMA_RTE: { glued: true, maxStackMm: 200 },
      ECMA_STE: { glued: true, maxStackMm: 200 },
      SLEEVE: { glued: true, maxStackMm: 200 },
      FEFCO_0320: { glued: true, maxStackMm: 300 },
      ECMA_CLB: { glued: true, maxStackMm: 200 },
      ECMA_SLB: { glued: true, maxStackMm: 200 },
      FEFCO_0422: { glued: false, maxStackMm: 300 },
      GABLE_BOX: { glued: true, maxStackMm: 200 },
      // Tubes and rigid boxes ship made up (not flat); stacking is by nesting height.
      PAPER_TUBE: { glued: true, maxStackMm: 400 },
      RIGID_BOX: { glued: true, maxStackMm: 400 },
      // Labels ship wound on rolls, pouches and tubes flat in cartons.
      ROLL_LABEL: { glued: false, maxStackMm: 400 },
      PRINTED_POUCH: { glued: false, maxStackMm: 400 },
      PRINTED_TUBE: { glued: true, maxStackMm: 400 },
    },
  },
  ranking: { price: 0.5, speed: 0.25, quality: 0.25 },
  priceIndex: PRICE_INDEX_TABLE,
};

/**
 * Merge a partial override (e.g. from admin settings) onto the defaults.
 * Legal/contract limits are pinned so a settings row can never break them: VAT is the statutory
 * 14% (Egyptian VAT Law 67/2016), quotes stay valid at most 72 h, and instant prices stop at
 * 2,000 units (above that a manual quote). Margins/weights stay configurable.
 */
export function makeConfig(overrides: Partial<PricingConfig> = {}): PricingConfig {
  const clamp = (v: unknown, min: number, max: number, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
  return {
    ...DEFAULT_PRICING_CONFIG,
    ...overrides,
    vatRate: DEFAULT_PRICING_CONFIG.vatRate,
    quoteValidityHours: clamp(overrides.quoteValidityHours, 1, DEFAULT_PRICING_CONFIG.quoteValidityHours, DEFAULT_PRICING_CONFIG.quoteValidityHours),
    maxInstantQty: Math.floor(clamp(overrides.maxInstantQty, 1, DEFAULT_PRICING_CONFIG.maxInstantQty, DEFAULT_PRICING_CONFIG.maxInstantQty)),
    marginPct: clamp(overrides.marginPct, 0, 5, DEFAULT_PRICING_CONFIG.marginPct),
    digital: { ...DEFAULT_PRICING_CONFIG.digital, ...overrides.digital },
    shipping: { ...DEFAULT_PRICING_CONFIG.shipping, ...overrides.shipping },
    ranking: { ...DEFAULT_PRICING_CONFIG.ranking, ...overrides.ranking },
  };
}

/** The index row in force at `now` (latest `effectiveFrom` <= now; the earliest row if none). */
export function resolvePriceIndex(table: PriceIndexRow[], now: Date): PriceIndexRow {
  const sorted = [...table].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  let current = sorted[0] ?? { id: "none", effectiveFrom: "1970-01-01", fx: 1, board: {} };
  for (const row of sorted) {
    if (new Date(row.effectiveFrom).getTime() <= now.getTime()) current = row;
  }
  return current;
}

/** Board multiplier for a material: fx × board index (defaults 1). */
export function boardMultiplier(row: PriceIndexRow, material: MaterialCode): number {
  return row.fx * (row.board[material] ?? 1);
}
