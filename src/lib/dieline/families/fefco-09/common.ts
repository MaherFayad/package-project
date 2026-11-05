import type { Dims, MaterialCode, StructureParamLimits } from "@/types";
import type { DimsIssue } from "../../limits";
import { DEFAULT_CLEARANCE_MM } from "./engine";
import type { FittingDefinition, FittingPreset, OptionSpec, ResolvedFittingParams } from "./types";

export const CORRUGATED: MaterialCode[] = ["E_FLUTE_KRAFT", "E_FLUTE_WHITE", "B_FLUTE_KRAFT"];
/** Small pads and partitions are also die-cut from folding boxboard. */
export const CORRUGATED_OR_SBS: MaterialCode[] = [...CORRUGATED, "SBS_350"];

/** Host limits = the RSC (FEFCO 0201) inner size range of the core engine. */
export const RSC_HOST: StructureParamLimits = { L: { min: 100, max: 800 }, W: { min: 80, max: 600 }, H: { min: 60, max: 800 } };

const pr = (id: string, ar: string, en: string, dims: Dims, options?: FittingPreset["options"], standard?: boolean): FittingPreset => ({
  id,
  name: { ar, en },
  dims,
  ...(options ? { options } : {}),
  ...(standard ? { standard } : {}),
});

/** Common Egyptian shipping carton inner sizes (the core FEFCO 0201 presets). */
export const RSC_PRESETS: FittingPreset[] = [
  pr("small", "كرتونة صغيرة", "Small carton", { L: 200, W: 150, H: 100 }, undefined, true),
  pr("medium", "كرتونة متوسطة", "Medium carton", { L: 300, W: 200, H: 150 }, undefined, true),
  pr("large", "كرتونة كبيرة", "Large carton", { L: 400, W: 300, H: 250 }, undefined, true),
];

/** Bottle / jar shippers sold by Egyptian carton converters (inner mm, cells rows × cols). */
export const PARTITION_PRESETS: FittingPreset[] = [
  pr("oil-1l-x6", "6 زجاجات زيت 1 لتر", "6 × 1 L oil bottles", { L: 255, W: 170, H: 300 }, { rows: 2, cols: 3 }, true),
  pr("jar-500g-x12", "12 برطمان 500 جم", "12 × 500 g jars", { L: 360, W: 270, H: 130 }, { rows: 3, cols: 4 }, true),
  pr("juice-250ml-x24", "24 زجاجة عصير 250 مل", "24 × 250 ml juice bottles", { L: 360, W: 240, H: 160 }, { rows: 4, cols: 6 }),
  pr("glass-x15", "15 كوب زجاج", "15 drinking glasses", { L: 450, W: 270, H: 140 }, { rows: 3, cols: 5 }),
];

export const CLEARANCE: OptionSpec = { min: 0, max: 20, default: DEFAULT_CLEARANCE_MM };
/** Full inner height less the clearance. */
export const FULL_HEIGHT: OptionSpec = { min: 20, max: 800, default: (h, input) => h.H - (input.clearanceMm ?? DEFAULT_CLEARANCE_MM) };

export const clr = (p: ResolvedFittingParams) => p.clearanceMm ?? DEFAULT_CLEARANCE_MM;
/** Fitting outer length / width / height: host inner less the clearance. */
export const fitL = (p: ResolvedFittingParams) => p.host.L - clr(p);
export const fitW = (p: ResolvedFittingParams) => p.host.W - clr(p);
export const fitH = (p: ResolvedFittingParams) => p.host.H - clr(p);
export const hgt = (p: ResolvedFittingParams) => p.heightMm ?? fitH(p);

/** Issue when `value` must not exceed `limit`. */
export const notAbove = (path: string, value: number, limit: number): DimsIssue[] =>
  value > limit + 1e-9 ? [{ path, code: "TOO_LARGE", limit: Math.floor(limit) }] : [];

type Meta = Omit<FittingDefinition, "code" | "family" | "standard" | "slug" | "hostLimits" | "defaultHost" | "presets" | "materials" | "defaultMaterial" | "glued" | "pieces"> &
  Partial<Pick<FittingDefinition, "hostLimits" | "defaultHost" | "presets" | "materials" | "defaultMaterial" | "glued" | "pieces">> & { slug: string };

/** Fill the shared fields of a group 09 definition. */
export function fitting(m: Meta): FittingDefinition {
  return {
    family: "INTERIOR_FITTING",
    code: `FEFCO_${m.fefco.toUpperCase()}` as FittingDefinition["code"],
    standard: `FEFCO ${m.fefco}`,
    hostLimits: RSC_HOST,
    defaultHost: { L: 300, W: 200, H: 150 },
    presets: RSC_PRESETS,
    materials: CORRUGATED,
    defaultMaterial: "E_FLUTE_KRAFT",
    glued: false,
    pieces: 1,
    ...m,
    slug: `fefco-${m.fefco}-${m.slug}`,
  };
}
