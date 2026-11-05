/**
 * FEFCO group 06 (rigid-type / bliss boxes) and group 07 (ready-glued cases and trays).
 *
 *   import { DEFINITIONS, generateFamilyDieline } from "@/lib/dieline/families/fefco-06-07";
 *   const def = DEFINITIONS.find((d) => d.code === "FEFCO_0711")!;
 *   const model = generateFamilyDieline(def, def.defaultDims, { thicknessMm: 3 });
 */
import { ALL_DEFINITIONS } from "./definitions";

export const DEFINITIONS = ALL_DEFINITIONS;

export { GROUP_06, GROUP_07, AUTO_BOTTOM_SEQUENCE } from "./definitions";
export { generateFamilyDieline, tryGenerateFamilyDieline, validateFamilyDims, familyDimsSchema, printAreaM2, BLEED_MM, SAFE_MM } from "./build";
export { blissBox, tubeWithCaps, halfShells, type BlissOpts } from "./group06";
export { autoBottomCase, autoBottomTelescope, cellTube, readyGluedTray, type CaseOpts, type TrayOpts } from "./group07";
export { crashLockBottom, caseTube, caseTop, webCorner, type CaseTop } from "./parts";
export type { FamilyCode, FamilyStructureDef, FamilyDielineModel, FefcoSubFamily, FoldStep, Use } from "./types";

export function definitionByCode(code: string) {
  return DEFINITIONS.find((d) => d.code === code) ?? null;
}
