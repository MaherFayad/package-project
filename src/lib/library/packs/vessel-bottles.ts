import { labelSpecsFor } from "@/lib/vessels";
import * as BTL from "@/lib/vessels/families/bottles";
import type { VesselModelDef, VesselOption } from "../types";
import { LIQUID_OF_CONTENT, isSurface, labelArea, search } from "./common-vessel";


/** Bottle closures drawn with an engine closure style instead of their core screw cap (X-01). */
const BOTTLE_CLOSURE_STYLE: Partial<Record<string, string>> = {
  ROPP_CAP: "ROPP",
  POURER_CAP: "POURER",
  CROWN_26: "CROWN",
  CROWN_29: "CROWN",
  NATURAL_CORK: "CORK_CAPSULE",
  SPARKLING_CORK: "SPARKLING",
};

export const models: VesselModelDef[] = BTL.DEFINITIONS.map((def) => {
  const preset = BTL.bottlePreset(def);
  const coreKind = def.coreKind;
  const containers: VesselOption[] = def.materials.map((m) => {
    const mat = BTL.BOTTLE_MATERIALS[m];
    // the core material is only the nearest look: carry the real colour when it differs (X-01)
    return { code: m, name: mat.name, core: mat.coreMaterial, ...(mat.code !== mat.coreMaterial ? { tint: mat.hex } : {}) };
  });
  const closures: VesselOption[] = def.closures.map((c) => {
    // A wine ROPP is a BVS 30H60 (Stelvin) shell 60 mm long; the engine ROPP style is a fixed 18 mm
    // skirt, so wine bottles keep the smooth metal LUG_LID drawn over the whole finishH (R5-3Q-F-02).
    if (c === "ROPP_CAP" && def.finishes.includes("BVS_30H60")) return { code: c, name: BTL.BOTTLE_CLOSURES[c].name, core: "LUG_LID" };
    const style = BOTTLE_CLOSURE_STYLE[c];
    return { code: c, name: BTL.BOTTLE_CLOSURES[c].name, core: BTL.BOTTLE_CLOSURES[c].coreClosure, ...(style ? { closureStyle: style } : {}) };
  });
  return {
    kind: "vessel",
    code: def.code,
    slug: def.slug,
    group: "BOTTLES_JARS",
    source: "vessel-bottles",
    standard: def.standard === "none" ? (preset.finish ?? "") : def.standard,
    name: def.name,
    description: def.description,
    search: search(def.code, def.code.replace(/_/g, " "), def.name.en, def.name.ar, def.standard, def.subFamily, ...def.typicalUses.map((u) => `${u.en} ${u.ar}`)),
    render: "lathe",
    coreKind,
    limits: def.limits,
    axes: { D: "diameter", ...(def.limits.G ? { G: "depth" as const } : {}) },
    presets: def.presets.map((p) => ({ id: p.id, name: p.name, capacityMl: p.capacityMl, dims: p.dims })),
    defaultPresetId: def.defaultPresetId,
    containers,
    defaultContainer: def.defaultMaterial,
    closures,
    defaultClosure: def.defaultClosure,
    surfaces: def.surfaces.filter(isSurface),
    defaultSurfaces: def.defaultSurfaces.filter(isSurface),
    fillable: def.fillable,
    defaultLiquid: LIQUID_OF_CONTENT[def.defaultContent] ?? "WATER",
    pricing: "LABEL",
    // `closure` (the design's chosen closure) picks the neck finish it fits (R6-3Q-F-01)
    describe(dims, surfaces, presetId, _container?: string, _options?: unknown, closure?: string) {
      const p = BTL.bottlePreset(def, presetId);
      const v = BTL.validateBottleDims(def, dims);
      if (!v.ok) throw new Error(`Invalid dims for ${def.code}`);
      const finish = BTL.finishForConfig(def, dims, p.finish, closure);
      const profile = BTL.profileFor(def, dims, finish);
      const labels = labelSpecsFor(coreKind, dims, profile, surfaces.filter(isSurface));
      const fitted = def.closures.find((c) => c === closure && BTL.closureFits(c, finish));
      return { profile, areas: labels.map(labelArea), envelope: BTL.bottleEnvelope(def, profile, dims, fitted) };
    },
  } satisfies VesselModelDef;
});

