/**
 * FEFCO group 02: slotted-type boxes (0200–0231 as published in the FEFCO-ESBO Code).
 *
 *   import { DEFINITIONS, DEFINITION_BY_CODE, buildFefco02Dieline } from "@/lib/dieline/families/fefco-02";
 *   const model = buildFefco02Dieline(DEFINITION_BY_CODE.FEFCO_0203, { L: 400, W: 300, H: 300 }, { thicknessMm: 3 });
 *
 * Each definition's `generate(dims, t, features)` has the shared `Generator` signature
 * (src/lib/dieline/structures.ts), so the integrator can register it in GENERATORS once
 * the codes join `StructureCode`.
 */
export { DEFINITIONS, DEFINITION_BY_CODE } from "./definitions";
export { GENERATORS, END_LAYERS, defaultParams } from "./styles";
export {
  buildFefco02Dieline,
  tryBuildFefco02Dieline,
  validateFefco02Dims,
  validateFefco02Params,
  supportedFeatures,
  DEFAULT_BLEED_MM,
  DEFAULT_SAFE_MM,
  type Fefco02Options,
  type Validation,
} from "./assemble";
export * from "./types";
