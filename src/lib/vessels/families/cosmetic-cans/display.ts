import type { LiquidCode } from "../../registry";
import type { PrintSurfaceKind } from "../../types";
import type { CatalogueSurfaceKind, CatalogueVesselDefinition } from "./types";

/**
 * How the core 3D renderer should SHOW a catalogue model whose real print processes or contents the
 * core cannot express (audit 3d-cans-flexible E-02, E-03). Pure data; the print specs, pricing and
 * dielines keep using the catalogue surfaces.
 */

/**
 * Core display surface(s) for a catalogue print surface. Direct print, in-mould labels and printed
 * lids are decorated all over the body, so the closest core look is a full wrap on round bodies and
 * front + back panels on square / oval ones. Rect lid tops have no core lid label yet (null).
 */
export function displaySurfacesFor(def: CatalogueVesselDefinition, s: CatalogueSurfaceKind): PrintSurfaceKind[] {
  const round = def.geometry !== "extrusion";
  switch (s) {
    case "WRAP":
    case "FRONT":
    case "BACK":
    case "SHRINK_SLEEVE":
    case "NECK":
    case "LID":
      return [s];
    case "DIRECT_PRINT":
    case "IML":
      return round ? ["WRAP"] : ["FRONT", "BACK"];
    case "LID_TOP":
    case "LID_FOIL":
      return round ? ["LID"] : [];
    default:
      return [];
  }
}

const uniq = <T>(a: T[]) => [...new Set(a)];

/** Display surfaces offered and selected by default (order kept, duplicates dropped). */
export function displaySurfaces(def: CatalogueVesselDefinition): { surfaces: PrintSurfaceKind[]; defaultSurfaces: PrintSurfaceKind[] } {
  const surfaces = uniq(def.surfaces.flatMap((s) => displaySurfacesFor(def, s)));
  const defaults = uniq(def.defaultSurfaces.flatMap((s) => displaySurfacesFor(def, s)));
  return { surfaces: surfaces.length ? surfaces : ["WRAP"], defaultSurfaces: defaults.length ? defaults : [surfaces[0] ?? "WRAP"] };
}

/** Product shown inside clear containers: perfume is clear, serums tinted, creams opaque. */
const LIQUID_BY_CODE: Partial<Record<string, LiquidCode>> = {
  "COS-DROPPER": "SERUM",
  "COS-SERUM": "SERUM",
  "COS-PERFUME-ROUND": "PERFUME",
  "COS-PERFUME-OVAL": "PERFUME",
  "COS-ROLL-ON": "SERUM",
  "COS-LIP-GLOSS": "HIBISCUS",
  "COS-NAIL-POLISH": "HIBISCUS",
  "PH-VIAL": "WATER",
  "PH-AMPOULE": "WATER",
  "PH-EYE-DROP": "WATER",
  "CUP-DELI": "WATER",
};

export function displayLiquid(def: CatalogueVesselDefinition): LiquidCode {
  return LIQUID_BY_CODE[def.code] ?? (def.family === "CAN" ? "COLA" : def.family === "PHARMA" ? "SERUM" : "CREAM");
}
