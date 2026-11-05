/**
 * FEFCO group 04 (folder-type boxes and trays) family. See README.md.
 *
 *   import { DEFINITIONS, generateFamilyDieline } from "@/lib/dieline/families/fefco-04";
 *   const def = DEFINITIONS.find((d) => d.fefco === "0421")!;
 *   const model = generateFamilyDieline(def, def.defaultDims, { thicknessMm: 3 });
 */
export { DEFINITIONS, IMPLEMENTED_IN_CORE, NOT_IMPLEMENTED, definitionByCode } from "./catalog";
export { generateFamilyDieline, tryGenerateFamilyDieline, validateFamilyDims, familyDimsSchema, familyFeatures } from "./build";
export { trayKit, layersOf, type TrayKitOpts, type TopClosure, type WallKey } from "./kit";
export { wrapFolder, type WrapOpts, type EndFlapKind } from "./wraps";
export { blissContainer } from "./bliss";
export { octagonalTray } from "./octagon";
export type { Fefco04Code, Fefco04Definition, Fefco04Model, Fefco04SubFamily, FamilyGenerator } from "./types";
