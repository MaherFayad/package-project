/**
 * FEFCO group 09: interior fittings (pads, liners, tubes, partitions, cushion pads, scored
 * sheets, corner and edge protectors). Every fitting is sized from its HOST box's inner
 * dims (+ cell counts / options) and carries a placement matrix into that host.
 *
 *   const def = FITTINGS.FEFCO_0933;
 *   const m = generateFitting("FEFCO_0933", { host: { L: 360, W: 270, H: 130 }, rows: 3, cols: 4 }, { thicknessMm: 1.5 });
 *   m.placement.matrix // closed fitting → host inner space
 */
import { CORNERS, PARTITIONS } from "./cells";
import { CUSHIONS, SCORED_SHEETS } from "./cushions";
import { generateFittingFor, type FittingOptions } from "./engine";
import { COMPARTMENT_LINERS, LINERS, PADS } from "./liners";
import type { FittingCode, FittingDefinition, FittingModel, FittingParams } from "./types";

export * from "./types";
export {
  chain,
  flapOn,
  fittingSchema,
  validateFittingParams,
  finalizeFitting,
  placedBounds,
  printArea,
  generateFittingFor,
  quatDeg,
  DEFAULT_BLEED_MM,
  DEFAULT_SAFE_MM,
  DEFAULT_CLEARANCE_MM,
  type FittingOptions,
  type FittingValidation,
  type ChainPanel,
} from "./engine";
export { slottedGrid, slottedStrip, cellLayout, slotWidth, type CellLayout, type SlottedGridInput } from "./partitions";
export { MIN_CELL_MM } from "./cells";

/** All FEFCO group 09 definitions, in code order. */
export const DEFINITIONS: FittingDefinition[] = [...PADS, ...LINERS, ...COMPARTMENT_LINERS, ...PARTITIONS, ...CUSHIONS, ...SCORED_SHEETS, ...CORNERS].sort((a, b) =>
  a.fefco.localeCompare(b.fefco),
);

export const FITTINGS: Record<FittingCode, FittingDefinition> = Object.fromEntries(DEFINITIONS.map((d) => [d.code, d])) as Record<FittingCode, FittingDefinition>;

export function fittingBySlug(slug: string): FittingDefinition | null {
  return DEFINITIONS.find((d) => d.slug === slug) ?? null;
}

/** Generate a fitting dieline for a host box. Throws DielineValidationError on bad input. */
export function generateFitting(code: FittingCode, params: FittingParams, options: FittingOptions): FittingModel {
  const def = FITTINGS[code];
  if (!def) throw new Error(`Unknown FEFCO 09 fitting ${code}`);
  return generateFittingFor(def, params, options);
}

/** Like generateFitting but returns null instead of throwing. */
export function tryGenerateFitting(code: FittingCode, params: FittingParams, options: FittingOptions): FittingModel | null {
  try {
    return generateFitting(code, params, options);
  } catch {
    return null;
  }
}
