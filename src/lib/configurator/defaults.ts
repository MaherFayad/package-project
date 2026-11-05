import type { StructureCode } from "@/types";
import { DEFAULT_DIMS, defaultMaterialFor } from "@/lib/dieline";
import { VESSELS, type VesselKind } from "@/lib/vessels";
import type { BoxConfig, ModelConfig, VesselConfigInput } from "./schema";

/** A sensible, valid starting config for a box structure. */
export function defaultBoxConfig(code: StructureCode, quantity = 250): BoxConfig {
  return {
    v: 1,
    model: { type: "box", code },
    size: { mode: "custom", dims: { ...DEFAULT_DIMS[code] } },
    material: defaultMaterialFor(code),
    printSides: "OUTSIDE",
    colour: { mode: "CMYK", spots: [] },
    finishes: [],
    addOns: { windowFilm: null, insert: null, handle: code === "GABLE_BOX", tearStrip: false },
    structure: {},
    quantity,
  };
}

/** A sensible, valid starting config for a container (default preset, default label areas). */
export function defaultVesselConfig(kind: VesselKind, quantity = 1000): VesselConfigInput {
  const def = VESSELS[kind];
  const surfaces = [...def.defaultSurfaces];
  const direct = kind === "STAND_UP_POUCH" || kind === "SQUEEZE_TUBE";
  return {
    v: 1,
    model: { type: "vessel", code: kind },
    size: { mode: "preset", presetId: def.defaultPresetId },
    material: direct ? "DIRECT_PRINT" : surfaces.includes("SHRINK_SLEEVE") ? "PETG_SHRINK" : "WHITE_BOPP",
    container: def.defaultMaterial,
    surfaces,
    printSides: "OUTSIDE",
    colour: { mode: "CMYK", spots: [] },
    finishes: [],
    addOns: { windowFilm: null, insert: null, handle: false, tearStrip: false },
    quantity,
  };
}

export function defaultConfig(model: ModelConfig["model"]): ModelConfig {
  return model.type === "box" ? defaultBoxConfig(model.code) : defaultVesselConfig(model.code);
}
