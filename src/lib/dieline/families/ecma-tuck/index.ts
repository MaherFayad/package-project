/**
 * ECMA tuck-end and glued-end folding cartons (family catalogue). See README.md.
 *
 *   import { DEFINITIONS, generateEcmaDieline } from "@/lib/dieline/families/ecma-tuck";
 *   const def = DEFINITIONS.find((d) => d.code === "ECMA_HANGER_EURO")!;
 *   const model = generateEcmaDieline(def, def.defaultDims, { thicknessMm: 0.48 });
 */
export { DEFINITIONS, DEFINITION_BY_CODE } from "./definitions";
export * from "./types";
export * from "./generators";
export {
  generateEcmaDieline,
  tryGenerateEcmaDieline,
  validateEcmaDims,
  clampEcmaDims,
  supportedEcmaFeatures,
  ecmaTuckOptionsSchema,
  type EcmaDielineOptions,
  type EcmaDimsValidation,
} from "./model";
export { EURO_SLOT, ROUND_HOLE_DIAMETER, hangHolePolygon } from "./closures";
