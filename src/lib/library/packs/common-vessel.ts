import type { LiquidCode, LabelSpec, PrintSurfaceKind, VesselDims, VesselKind, VesselMaterialCode, ClosureKind } from "@/lib/vessels";
import { CLOSURE_KINDS, PRINT_SURFACE_KINDS, VESSEL_MATERIAL_CODES } from "@/lib/vessels";
import type { PrintArea, VesselDescription, VesselModelDef } from "../types";

/** Shared container-model helpers for the per-family packs (PERF-04). */

export const isSurface = (s: string): s is PrintSurfaceKind => (PRINT_SURFACE_KINDS as readonly string[]).includes(s);
export const isCoreMaterial = (s: string): s is VesselMaterialCode => (VESSEL_MATERIAL_CODES as readonly string[]).includes(s);
export const isCoreClosure = (s: string): s is ClosureKind => (CLOSURE_KINDS as readonly string[]).includes(s);
export const search = (...parts: (string | undefined | null)[]) => parts.filter(Boolean).join(" ").toLowerCase();

export function labelArea(spec: LabelSpec): PrintArea {
  return {
    id: spec.id,
    kind: spec.kind,
    name: spec.name,
    trimWidthMm: spec.trimWidthMm,
    trimHeightMm: spec.trimHeightMm,
    bleedMm: spec.bleedMm,
    safeMm: spec.safeMm,
    trimAreaM2: spec.trimAreaM2,
    spec,
  };
}

/** Pricing structure of a core kind. */
export function pricingOf(kind: VesselKind): VesselModelDef["pricing"] {
  return kind === "STAND_UP_POUCH" ? "POUCH" : kind === "SQUEEZE_TUBE" ? "TUBE" : "LABEL";
}

/** Product shown in the closest core liquid. */
export const LIQUID_OF_CONTENT: Record<string, LiquidCode> = {
  WATER: "WATER",
  JUICE: "ORANGE_JUICE",
  RED_WINE: "HIBISCUS",
  WHITE_WINE: "SERUM",
  SPARKLING: "SERUM",
  BEER: "HONEY",
  OLIVE_OIL: "OLIVE_OIL",
  HOT_SAUCE: "HOT_SAUCE",
  SPIRIT: "PERFUME",
  MILK: "CREAM",
  SYRUP: "HIBISCUS",
  COLA: "COLA",
  SHAMPOO: "CREAM",
  DETERGENT: "CREAM",
  MOTOR_OIL: "OLIVE_OIL",
  HONEY: "HONEY",
  JAM: "JAM",
  NUT_BUTTER: "CREAM",
  PICKLES: "OLIVE_OIL",
  TAHINI: "CREAM",
  HALAWA: "CREAM",
  PAINT: "CREAM",
  NONE: "WATER",
};

/** Flexible film material for a design (the "container" of a flexible model). */
export function describeVesselModel(m: VesselModelDef, dims: VesselDims, surfaces: string[], presetId?: string, container?: string, options?: Record<string, boolean | string>, closure?: string): VesselDescription {
  return (m.describe as (d: VesselDims, s: string[], p?: string, c?: string, o?: Record<string, boolean | string>, cl?: string) => VesselDescription)(dims, surfaces, presetId, container, options, closure);
}
