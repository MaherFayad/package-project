import type { Mm } from "@/types";
import { bottleBrimfulMl, buildBottleProfile, fillLevelFor } from "./builder";
import { BOTTLE_CLOSURES, closureFits } from "./closures";
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

/**
 * The preset's finish, or for custom dims too narrow for it, the largest finish of the same kind
 * the model offers that is no wider than the body (R5-3Q-F-16): a 58 mm lug lid on a 40 mm hex
 * jar overhung the glass by 9 mm a side. A smaller jar comes with a smaller lid, as in the trade.
 * Rim (open-top tub) finishes are sized from the body and are left alone.
 */
export function finishForDims(def: BottleDefinition, dims: VesselDims, finishId: string): BottleFinish {
  const f = finishById(finishId);
  if (f.kind === "rim") return f;
  const width = (d: VesselDims) => Math.min(d.D, d.G ?? d.D);
  // the widest neck / body ratio the model's own presets ship (+3 %; a hex jar's D is across flats,
  // so its 45 ml preset carries a TO 43 on a 42 mm body):
  // a 43 mm lug on a 50 mm juice bottle (0.86) read as a jar; its presets stay at or under 0.67
  // and a narrower bottle takes the narrower finish (R6-3Q-F-03)
  const ratio = Math.max(...def.presets.map((p) => finishById(p.finish).outerDiameterMm / width(p.dims))) + 0.03;
  const max = width(dims) * ratio;
  if (f.outerDiameterMm <= max) return f;
  const same = def.finishes.map(finishById).filter((x) => x.kind === f.kind).sort((a, b) => b.outerDiameterMm - a.outerDiameterMm);
  return same.find((x) => x.outerDiameterMm <= max) ?? same[same.length - 1] ?? f;
}

/**
 * Finish for a configuration: the preset's (sized by `finishForDims`), unless the chosen closure
 * does not fit it; then the model's first finish the closure fits (R6-3Q-F-01, reopens R5-3Q-F-12).
 * A crown on a PP 28 thread or a swing top on a ROPP finish drew the closure over the wrong neck.
 */
export function finishForConfig(def: BottleDefinition, dims: VesselDims, presetFinish: string, closure?: string): BottleFinish {
  const f = finishForDims(def, dims, presetFinish);
  const c = closure as BottleClosureCode | undefined;
  if (!c || !def.closures.includes(c) || closureFits(c, f)) return f;
  const id = def.finishes.find((x) => closureFits(c, finishById(x)));
  return id ? finishForDims(def, dims, id) : f;
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
  const finish = cfg.finish && def.finishes.includes(cfg.finish) ? finishById(cfg.finish) : finishForConfig(def, dims, preset.finish, cfg.closure);
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
