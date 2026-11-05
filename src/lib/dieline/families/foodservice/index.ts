/**
 * Foodservice & paper packaging family (cake/bakery boxes, takeaway cartons, pizza, cups,
 * bowls, lids, sleeves, paper bags, molded pulp, tags and wraps). See README.md.
 */
import type { Dims, StructureFeatures } from "@/types";
import { DEFINITIONS } from "./definitions";
import { FamilyValidationError, generateFamilyDieline, validateRanges, type FamilyDielineOptions } from "./engine";
import { buildCup, buildCupSleeve, type CupModel, type SleeveModel } from "./frustum";
import { buildLid, type LidModel } from "./lids";
import { FOOD_MATERIALS } from "./materials";
import { buildPulp, type PulpModel } from "./pulp";
import type { FamilyDielineModel, FoodserviceCode, FoodserviceDefinition, FrustumDims, LidDims, PulpDims } from "./types";

export { DEFINITIONS };
export * from "./types";
export * from "./materials";
export * from "./engine";
export * from "./frustum";
export * from "./lids";
export * from "./pulp";
export * from "./generators/boxes";
export * from "./generators/bags";
export * from "./generators/flat";

export function definitionByCode(code: FoodserviceCode): FoodserviceDefinition {
  const d = DEFINITIONS.find((x) => x.code === code);
  if (!d) throw new Error(`Unknown foodservice code ${code}`);
  return d;
}

export type FoodserviceModel =
  | { kind: "dieline"; model: FamilyDielineModel }
  | { kind: "frustum"; model: CupModel | SleeveModel }
  | { kind: "lathe"; model: LidModel }
  | { kind: "molded"; model: PulpModel };

/** One entry point for every model in the family (validated with zod). */
export function buildFoodservice(code: FoodserviceCode, dims: Dims | FrustumDims | LidDims | PulpDims, opts: { thicknessMm?: number; features?: StructureFeatures; bleedMm?: number } = {}): FoodserviceModel {
  const def = definitionByCode(code);
  const t = opts.thicknessMm ?? FOOD_MATERIALS[def.defaultMaterial].thicknessMm;
  switch (def.kind) {
    case "dieline": {
      const o: FamilyDielineOptions = { thicknessMm: t, features: opts.features, bleedMm: opts.bleedMm };
      return { kind: "dieline", model: generateFamilyDieline(def, dims as Dims, o) };
    }
    case "frustum": {
      const v = validateRanges(def.limits, dims as FrustumDims, ["bottomD < topD"]);
      if (!v.ok) throw new FamilyValidationError(v.issues);
      return { kind: "frustum", model: def.role === "sleeve" ? buildCupSleeve(v.value, t) : buildCup(v.value, def.wall, t) };
    }
    case "lathe": {
      const v = validateRanges(def.limits, dims as LidDims);
      if (!v.ok) throw new FamilyValidationError(v.issues);
      return { kind: "lathe", model: buildLid(def.role, v.value, FOOD_MATERIALS[def.defaultMaterial].printable) };
    }
    case "molded": {
      const v = validateRanges(def.limits, dims as PulpDims);
      if (!v.ok) throw new FamilyValidationError(v.issues);
      return { kind: "molded", model: buildPulp(v.value, def.layout) };
    }
  }
}
