import type { Mm } from "@/types";
import { bottleBrimfulMl, buildBottleProfile, fillLevelFor } from "./builder";
import { BOTTLE_CLOSURES } from "./closures";
import { finishById } from "./finishes";
import { bottleLabelSpecs } from "./labels";
import { CONTENTS } from "./materials";
import { GLASS_BOTTLES } from "./models/glass";
import { JARS } from "./models/jars";
import { PLASTIC_BOTTLES } from "./models/plastic";
import { BULK } from "./models/bulk";
import { validateBottleDims } from "./schema";
import { bottleSectionDepth } from "./section";
import type { BottleClosureCode, BottleDefinition, BottleFinish, BottleLabelSpec, BottlePreset, BottleProfile, VesselDims } from "./types";
import type { PrintSurfaceKind } from "../../index";

export const DEFINITIONS: BottleDefinition[] = [...GLASS_BOTTLES, ...PLASTIC_BOTTLES, ...JARS, ...BULK];

const BY_CODE = new Map(DEFINITIONS.map((d) => [d.code, d]));

export function bottleDefinition(code: string): BottleDefinition {
  const d = BY_CODE.get(code);
  if (!d) throw new Error(`Unknown bottle model ${code}`);
  return d;
}

export function bottlePreset(def: BottleDefinition, id?: string): BottlePreset {
  return def.presets.find((p) => p.id === id) ?? def.presets.find((p) => p.id === def.defaultPresetId) ?? def.presets[0];
}

export function profileFor(def: BottleDefinition, dims: VesselDims, finish: BottleFinish | string = bottlePreset(def).finish): BottleProfile {
  return buildBottleProfile(def.recipe, dims, typeof finish === "string" ? finishById(finish) : finish);
}

/** Outer envelope incl. closure and handle (what a carton or shipper must hold), mm. */
export function bottleEnvelope(def: BottleDefinition, profile: BottleProfile, dims: VesselDims, closure: BottleClosureCode = def.defaultClosure) {
  let maxR = 0;
  for (const p of profile.outer) maxR = Math.max(maxR, p.r);
  const c = BOTTLE_CLOSURES[closure];
  maxR = Math.max(maxR, profile.finishR + c.extraDiameterMm / 2);
  let width = 2 * maxR;
  let depth = profile.bottleSection.kind === "round" ? width : bottleSectionDepth(profile.bottleSection, dims.D / 2, 1);
  let height = dims.H + c.heightAboveMm;
  const h = profile.handle;
  if (h && h.kind !== "bail") {
    for (const q of h.path) {
      width = Math.max(width, 2 * (Math.abs(q.x) + h.tubeRadiusMm));
      depth = Math.max(depth, 2 * (Math.abs(q.z) + h.tubeRadiusMm));
      height = Math.max(height, q.y + h.tubeRadiusMm);
    }
  }
  return { width, depth, height };
}

export interface BottleConfig {
  code: string;
  dims?: VesselDims;
  presetId?: string;
  finish?: string;
  closure?: BottleClosureCode;
  surfaces?: PrintSurfaceKind[];
}

export interface BottleDescription {
  definition: BottleDefinition;
  dims: VesselDims;
  finish: BottleFinish;
  closure: BottleClosureCode;
  profile: BottleProfile;
  labels: BottleLabelSpec[];
  brimfulMl: number;
  /** Fill line for the nominal capacity. */
  fill: { ml: number; y: Mm; headspaceMm: Mm; overfilled: boolean };
  envelope: { width: Mm; depth: Mm; height: Mm };
}

/** Everything a page needs for a configured model. Throws on invalid dims (validate first). */
export function describeBottle(cfg: BottleConfig): BottleDescription {
  const def = bottleDefinition(cfg.code);
  const preset = bottlePreset(def, cfg.presetId);
  const dims = cfg.dims ?? preset.dims;
  const v = validateBottleDims(def, dims);
  if (!v.ok) throw new Error(`Invalid dims for ${def.code}: ${v.errors.join("; ")}`);
  const finishId = cfg.finish && def.finishes.includes(cfg.finish) ? cfg.finish : preset.finish;
  const finish = finishById(finishId);
  const closure = cfg.closure && def.closures.includes(cfg.closure) && BOTTLE_CLOSURES[cfg.closure].fits.includes(finish.kind) ? cfg.closure : (def.closures.find((c) => BOTTLE_CLOSURES[c].fits.includes(finish.kind)) ?? def.defaultClosure);
  const profile = profileFor(def, dims, finish);
  const surfaces = (cfg.surfaces ?? def.defaultSurfaces).filter((s) => def.surfaces.includes(s));
  const wet = CONTENTS[def.defaultContent].clarity > 0.5 || def.subFamily.startsWith("PET_") || def.subFamily === "GLASS_BEER";
  const brim = bottleBrimfulMl(profile);
  // custom dims keep the preset's nominal / brimful ratio (same headspace convention)
  const nominal = cfg.dims ? Math.round(brim * (preset.capacityMl / bottleBrimfulMl(profileFor(def, preset.dims, preset.finish)))) : preset.capacityMl;
  return {
    definition: def,
    dims,
    finish,
    closure,
    profile,
    labels: bottleLabelSpecs(profile, dims, surfaces, { closure, wet }),
    brimfulMl: Math.round(brim),
    fill: { ml: nominal, ...fillLevelFor(profile, nominal) },
    envelope: bottleEnvelope(def, profile, dims, closure),
  };
}
