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
  // R6: closures that used to collapse onto the plain screw / lug cap (R5-3Q-F-06 … F-11)
  SWING_TOP: "SWING_TOP",
  MEASURE_CAP: "MEASURE_CUP",
  FLIP_TOP: "FLIP_TOP_CAP",
  CHILD_RESISTANT_CAP: "CR_CAP",
  BAR_TOP: "BAR_TOP",
  SCREW_CAP_TE: "TE_CAP",
  VENTED_SCREW_CAP: "TE_CAP",
};

/**
 * Default closure colour of a styled option (R5-3Q-F-13): crowns and ROPP shells are bare
 * tinplate / aluminium, wine and sparkling capsules gold foil. The buyer can still recolour them.
 */
const BOTTLE_CLOSURE_COLOR: Partial<Record<string, string>> = {
  ROPP_CAP: "SILVER",
  POURER_CAP: "SILVER",
  CROWN_26: "GOLD",
  CROWN_29: "GOLD",
  NATURAL_CORK: "GOLD",
  SPARKLING_CORK: "GOLD",
};

/**
 * R5-3Q-F-12: the neck finish follows the closure. The preset's finish when the closure fits it,
 * else the model's finish of the closure's kind nearest in diameter (crown on a crown bead, swing
 * top on its wire-lug bead, not both on the PP 28 ROPP thread).
 */
function finishForClosure(def: BTL.BottleDefinition, finishId: string, closure?: string): string {
  const code = closure as BTL.BottleClosureCode | undefined;
  if (!code || !BTL.BOTTLE_CLOSURES[code]) return finishId;
  const f = BTL.finishById(finishId);
  if (BTL.closureFits(code, f)) return finishId;
  const fits = def.finishes.map(BTL.finishById).filter((x) => BTL.closureFits(code, x));
  fits.sort((a, b) => Math.abs(a.outerDiameterMm - f.outerDiameterMm) - Math.abs(b.outerDiameterMm - f.outerDiameterMm));
  return fits[0]?.id ?? finishId;
}

export const models: VesselModelDef[] = BTL.DEFINITIONS.map((def) => {
  const preset = BTL.bottlePreset(def);
  const coreKind = def.coreKind;
  const containers: VesselOption[] = def.materials.map((m) => {
    const mat = BTL.BOTTLE_MATERIALS[m];
    // the core material is only the nearest look: carry the real colour when it differs (X-01)
    return { code: m, name: mat.name, core: mat.coreMaterial, ...(mat.code !== mat.coreMaterial ? { tint: mat.hex } : {}) };
  });
  const closures: VesselOption[] = def.closures.map((c) => {
    // A wine ROPP is a BVS 30H60 (Stelvin) shell 60 mm long: the engine ROPP style draws its skirt
    // over the whole finishH now (R5-3Q-F-02), so wine bottles take the style too.
    const style = BOTTLE_CLOSURE_STYLE[c];
    const color = BOTTLE_CLOSURE_COLOR[c];
    // a style replaces a screw-cap core (the engine refuses a style over LUG_LID: swing top)
    const core = style ? "SCREW_CAP" : BTL.BOTTLE_CLOSURES[c].coreClosure;
    return { code: c, name: BTL.BOTTLE_CLOSURES[c].name, core, ...(style ? { closureStyle: style } : {}), ...(color ? { defaultColor: color } : {}) };
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
    describe(dims, surfaces, presetId, _container?: string, _options?: unknown, closure?: string) {
      const p = BTL.bottlePreset(def, presetId);
      const v = BTL.validateBottleDims(def, dims);
      if (!v.ok) throw new Error(`Invalid dims for ${def.code}`);
      const profile = BTL.profileFor(def, dims, BTL.finishForDims(def, dims, finishForClosure(def, p.finish, closure)));
      const labels = labelSpecsFor(coreKind, dims, profile, surfaces.filter(isSurface));
      return { profile, areas: labels.map(labelArea), envelope: BTL.bottleEnvelope(def, profile, dims, closure && def.closures.includes(closure as BTL.BottleClosureCode) ? (closure as BTL.BottleClosureCode) : undefined) };
    },
  } satisfies VesselModelDef;
});

