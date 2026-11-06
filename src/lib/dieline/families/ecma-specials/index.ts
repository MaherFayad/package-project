/**
 * ECMA specials family: non-tuck folding carton groups and special styles (glued trays,
 * hinged-lid trays, sleeves and wraps, wallets and folders, pillow, polygonal cartons,
 * carriers, counter display, liquid cartons). See README.md for the model list and the
 * integration steps.
 */
export { DEFINITIONS, DEFINITIONS_BY_CODE } from "./definitions";
export type { EcmaDraft, EcmaSpecialDef, EcmaSpecialSubFamily, EcmaSpecialUse } from "./types";
export { familyDimsSchema, familyFeatures, generateFamilyDieline, tryGenerateFamilyDieline, validateFamilyDims } from "./assemble";
export { beersTray, brightwoodTray, cornerGlueFlaps, fourCornerTray, hingedTuckTray, sixCornerTray, trayFrame } from "./trays";
export { lockWrap, openSleeve } from "./sleeves";
export { endFlapWallet, pivotForGap, presentationFolder } from "./folders";
export { CONE_FACETS, PILLOW_STRIPS, cone, coneSectorDeg, ngonSide, pillowLens, pillowPack, polygonalCarton } from "./shapes";
export { withDeepParts } from "./kit";
export { basketCarrier, basketHandleRise, counterDisplay, cupCarrier, cupHoleDiameter, cupsPerSide, displayFrontHeight, gableCarry, type BasketGrid } from "./carriers";
export { GABLE_FIN_MM, LS_STRIP_MM, asepticBrick, bodyVolumeMl, gableTopCarton } from "./liquid";
