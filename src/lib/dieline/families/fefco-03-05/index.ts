/**
 * FEFCO group 03 (telescope type) and group 05 (slide type) — parametric dielines with fold
 * data. See README.md for the model list, sources and integrator notes.
 */
export { DEFINITIONS, DEFINITION_BY_CODE } from "./definitions";
export * from "./generators";
export { generateFamilyDieline, validateFamilyDims, familyDimsSchema, familyFeatures } from "./model";
export type { FamilyStructureDef, FamilyDielineModel, FefcoTelescopeSlideCode, SubFamily, FamilyUse, Generator } from "./types";
