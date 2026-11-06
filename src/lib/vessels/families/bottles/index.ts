/**
 * Bottles, jars, tubs, pails and jerrycans catalogue (owner: bottles family agent).
 * Pure TypeScript on top of src/lib/vessels: parametric lathe profiles with exact
 * cross-sections, print areas with bleed/safe zones, flat <-> surface mapping, fill levels.
 */
export * from "./types";
export { FINISHES, finishById, type FinishId } from "./finishes";
export { BOTTLE_CLOSURES, closureFits } from "./closures";
export { BOTTLE_MATERIALS, CONTENTS } from "./materials";
export { bottleSectionArea, bottleSectionPerimeter, bottleSectionDepth, sectionPointAtArc, frontFlatWidth, coreSectionFor } from "./section";
export { buildBottleProfile, bottleVolumeToMl, bottleBrimfulMl, bottleGirthAt, fillLevelFor, halfWidthAt, sectionFor, bodyRadii } from "./builder";
export { bottleLabelSpecs, bottleSleeveSpec, surfacePoint, type LabelOptions } from "./labels";
export { dimsSchemaFor, validateBottleDims, definitionSchema, type DimsResult } from "./schema";
export {
  DEFINITIONS,
  bottleDefinition,
  bottlePreset,
  profileFor,
  finishForDims,
  bottleEnvelope,
  describeBottle,
  type BottleConfig,
  type BottleDescription,
} from "./registry";
