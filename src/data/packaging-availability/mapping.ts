import type { StructureCode } from "@/types";
import type { VesselKind } from "@/lib/vessels/types";
import { AVAILABILITY } from "./data";
import type { AvailabilityEntry } from "./types";

/**
 * Join helpers for the integrator: model code / standard code / family -> availability entry.
 * Lookups fall back from the most specific key to the family, so a new model code still gets
 * family-level data until it is mapped here.
 */

/** Current structure codes (src/types/structure.ts). Partial so new codes compile before they are mapped. */
export const STRUCTURE_TO_AVAILABILITY: Partial<Record<StructureCode, string>> = {
  FEFCO_0427: "corrugated/fefco-04",
  FEFCO_0201: "corrugated/fefco-02",
  FEFCO_0320: "corrugated/fefco-03",
  FEFCO_0422: "corrugated/fefco-04",
  PIZZA: "corrugated/fefco-04",
  ECMA_RTE: "folding-carton/ecma-tuck",
  ECMA_STE: "folding-carton/ecma-tuck",
  ECMA_CLB: "folding-carton/ecma-glued",
  ECMA_SLB: "folding-carton/ecma-glued",
  SLEEVE: "folding-carton/ecma-sleeve",
  GABLE_BOX: "folding-carton/ecma-special",
  PAPER_TUBE: "paper-tube/retail-tube",
  RIGID_BOX: "rigid-box/lid-base",
};

/** Current vessel kinds (src/lib/vessels/types.ts). */
export const VESSEL_TO_AVAILABILITY: Partial<Record<VesselKind, string>> = {
  ROUND_BOTTLE: "rigid-plastic/pet-bottle",
  BOSTON_ROUND: "glass/cosmetic-glass",
  DROPPER_BOTTLE: "glass/cosmetic-glass",
  PUMP_BOTTLE: "cosmetic-pharma/cosmetic-bottle",
  PERFUME_SQUARE: "glass/cosmetic-glass",
  WIDE_JAR: "glass/glass-jar",
  CAN: "metal/beverage-can",
  ROUND_TIN: "metal/tin",
  STAND_UP_POUCH: "flexible/stand-up-pouch",
  SQUEEZE_TUBE: "cosmetic-pharma/squeeze-tube",
};

/**
 * Industry style code -> entry. Accepts "FEFCO 0427", "FEFCO_0427", "0427", "ECMA A60.20",
 * "A60.20". FEFCO maps by series (first two digits); ECMA by series letter and known codes.
 */
export function availabilityForStandard(code: string): AvailabilityEntry | undefined {
  const c = code.trim().toUpperCase().replace(/_/g, " ");
  const fefco = c.match(/^(?:FEFCO\s*)?(\d{2})(\d{2})$/);
  if (fefco) return AVAILABILITY[`corrugated/fefco-${fefco[1]}`] ?? AVAILABILITY.corrugated;
  const ecma = c.match(/^(?:ECMA\s*)?([A-F])(\d{2})(?:\.\d{2})?$/);
  if (ecma) {
    const [, series, num] = ecma;
    const n = Number(num);
    if (series === "A" && n >= 50) return AVAILABILITY["folding-carton/ecma-glued"];
    if (series === "A" && n >= 20) return AVAILABILITY["folding-carton/ecma-tuck"];
    if (series === "A") return AVAILABILITY["folding-carton/ecma-sleeve"];
    if (series === "B") return AVAILABILITY["folding-carton/ecma-tray"];
    return AVAILABILITY["folding-carton/ecma-special"];
  }
  return undefined;
}

/** Key lookup with fallback "a/b/c" -> "a/b" -> "a". */
export function availabilityForSlug(slug: string): AvailabilityEntry | undefined {
  const parts = slug.split("/");
  while (parts.length) {
    const hit = AVAILABILITY[parts.join("/")];
    if (hit) return hit;
    parts.pop();
  }
  return undefined;
}

export interface AvailabilityQuery {
  structureCode?: string;
  vesselKind?: string;
  /** "FEFCO 0427", "ECMA A60.20" */
  standard?: string;
  family?: string;
  subFamily?: string;
}

/** Most specific match wins: structure/vessel code, then standard code, then family/sub-family. */
export function availabilityFor(q: AvailabilityQuery): AvailabilityEntry | undefined {
  const s = q.structureCode && STRUCTURE_TO_AVAILABILITY[q.structureCode as StructureCode];
  if (s) return AVAILABILITY[s];
  const v = q.vesselKind && VESSEL_TO_AVAILABILITY[q.vesselKind as VesselKind];
  if (v) return AVAILABILITY[v];
  if (q.standard) {
    const hit = availabilityForStandard(q.standard);
    if (hit) return hit;
  }
  if (q.family) return availabilityForSlug(q.subFamily ? `${q.family}/${q.subFamily}` : q.family);
  return undefined;
}

/** Children of a family, for catalogue filters. */
export function subFamiliesOf(family: string): AvailabilityEntry[] {
  return Object.values(AVAILABILITY).filter((e) => e.family === family);
}
