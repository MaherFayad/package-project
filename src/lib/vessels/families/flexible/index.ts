/**
 * Flexible packaging family (owner: flexible-catalogue agent). Pure-TS definitions, zod limits,
 * print layouts and a filled-shape solver, plus three.js geometry builders. See README.md.
 */
export * from "./types";
export * from "./constants";
export { DEFINITIONS, DEFINITION_BY_CODE, definitionFor, resolveOptions, NO_OPTIONS, ALL_OPTION_KEYS } from "./definitions";
export { flexConfigSchema, parseFlexConfig, safeParseFlexConfig, defaultFlexConfig, headerHeight, type FlexConfig } from "./schema";
export { printLayout, panelUv, rectUv, windowRect, PANEL_NAMES, isTube, baseFoldMm } from "./layout";
export { solveShape, panelPoint, stripLength, orient, type FlexShape, type ShapeRow, type PanelStrip, type RowPoint } from "./shape";
export { buildFlexibleModel, crimpNormalTexture, wrinkleAt, type FlexModel, type FlexMeshPart, type FlexPartRole } from "./geometry";
export { FILM_MATERIALS, createFilmMaterial, createHardwareMaterial, type FilmMaterial, type FilmMaterialOptions } from "./materials";
export { buildFlexibleGroup, type FlexGroupOptions } from "./group";
export { flexDisplayEnvelope, defaultPrintPanels } from "./display";
