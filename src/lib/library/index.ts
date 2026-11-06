/**
 * Model library (owner: 3D integration). See ./types for the contract.
 *
 *   const m = modelByCode("FEFCO_0203");            // any box style or container
 *   if (m?.kind === "box") m.build(dims, { thicknessMm: 1.5 });
 *   modelGroups("en", "pouch")                      // picker: grouped + searched
 */
import type { Locale } from "@/types";
import { BOX_MODELS, EXCLUDED_FAMILY_MODELS, baseStructure } from "./boxes";
import { VESSEL_MODELS, describeVesselModel } from "./vessels";
import { matchesQuery, type ModelCard } from "./search";
import { MODEL_GROUPS, MODEL_GROUP_NAMES, type ModelDef, type ModelGroup } from "./types";
import { registerModels } from "./registry";

export * from "./types";
export { BOX_MODELS, VESSEL_MODELS, EXCLUDED_FAMILY_MODELS, baseStructure, describeVesselModel };

export const MODELS: ModelDef[] = [...BOX_MODELS, ...VESSEL_MODELS];

// Eager entry (server, scripts, tests): every model is in the registry. The browser imports
// ./registry and loads only the open family (PERF-04).
registerModels(MODELS);
export { modelByCode, modelFromParam, boxModel, vesselModel, loadModel, isModelLoaded, modelSourceOf } from "./registry";

export { normaliseSearch, matchesQuery, type ModelCard } from "./search";

export function toCard(m: ModelDef): ModelCard {
  return { code: m.code, slug: m.slug, kind: m.kind, group: m.group, standard: m.standard, name: m.name, search: m.search, simplified: m.kind === "box" && m.fidelity === "simplified" };
}

/** Picker groups (fixed order), each with its models matching the query. Empty groups dropped. */
export function modelGroups(locale: Locale, query = ""): { group: ModelGroup; name: string; models: ModelDef[] }[] {
  return MODEL_GROUPS.map((g) => ({
    group: g,
    name: MODEL_GROUP_NAMES[g][locale],
    models: MODELS.filter((m) => m.group === g && matchesQuery(m, query)),
  })).filter((g) => g.models.length > 0);
}
