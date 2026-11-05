/**
 * Bottles, jars, cans, tins, pouches and tubes (owner: vessels). Pure TypeScript: parametric
 * profiles, print areas (labels, sleeves) with bleed/safe zones, flat<->surface mapping and
 * roll-label run lengths for pricing. 3D models live in src/components/three/vessels.
 */
export * from "./types";
export {
  NECK_FINISHES,
  buildProfile,
  radiusAt,
  squarenessAt,
  sectionArea,
  sectionPerimeter,
  brimfulVolumeMl,
  volumeToHeightMl,
  silhouetteLength,
  roundCorners,
  tinLidHeight,
  tubeDims,
  pouchDims,
  type ControlPoint,
  type SectionPoint,
} from "./profile";
export { LABEL_STOCKS, LABEL_FINISHES, finishesForStock, stocksForSurface } from "./stocks";
export {
  LABEL_BLEED_MM,
  LABEL_SAFE_MM,
  WRAP_OVERLAP_MM,
  SLEEVE_BLEED_MM,
  SLEEVE_SAFE_MM,
  SLEEVE_EASE,
  SLEEVE_SEAM_MM,
  bandSpec,
  sleeveSpec,
  discSpec,
  faceSpec,
  sectorFor,
  lidTop,
  labelSpecsFor,
  flatPoint,
  surfaceUv,
  sleeveRatioAt,
} from "./labels";
export { labelRun, type LabelRun, type LabelRunOptions } from "./layout";
export {
  VESSELS,
  CLOSURE_COLORS,
  LIQUIDS,
  VESSEL_MATERIALS,
  CLOSURE_NAMES,
  presetFor,
  clampDims,
  closureHeightAbove,
  vesselEnvelope,
  describeVessel,
  type VesselDefinition,
  type ClosureColorCode,
  type LiquidCode,
  type VesselConfig,
  type VesselDescription,
} from "./registry";
export { labelSvg, type LabelSvgOptions } from "./svg";
