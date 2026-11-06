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
import { MODEL_GROUPS, MODEL_GROUP_NAMES, type BoxModelDef, type ModelDef, type ModelGroup, type VesselModelDef } from "./types";

export * from "./types";
export { BOX_MODELS, VESSEL_MODELS, EXCLUDED_FAMILY_MODELS, baseStructure, describeVesselModel };

export const MODELS: ModelDef[] = [...BOX_MODELS, ...VESSEL_MODELS];

const BY_CODE = new Map<string, ModelDef>(MODELS.map((m) => [m.code, m]));
const BY_SLUG = new Map<string, ModelDef>(MODELS.map((m) => [m.slug, m]));

export function modelByCode(code: string | null | undefined): ModelDef | null {
  return code ? (BY_CODE.get(code) ?? null) : null;
}

/** Slug ("mailer-box"), or a code in any case ("fefco_0203", "BTL_GLASS_…"). */
export function modelFromParam(param: string): ModelDef | null {
  const p = decodeURIComponent(param).trim();
  return BY_SLUG.get(p.toLowerCase()) ?? BY_CODE.get(p) ?? BY_CODE.get(p.toUpperCase().replace(/-/g, "_")) ?? null;
}

export function boxModel(code: string | null | undefined): BoxModelDef | null {
  const m = modelByCode(code);
  return m?.kind === "box" ? m : null;
}

export function vesselModel(code: string | null | undefined): VesselModelDef | null {
  const m = modelByCode(code);
  return m?.kind === "vessel" ? m : null;
}

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
