/**
 * Dieline engine (owner: 3D engine). One parametric model per catalog structure drives the
 * 2D dieline (SVG/PDF), the 3D fold, texture mapping and the board area used by pricing.
 *
 *   const model = generateDieline("FEFCO_0427", { L: 250, W: 180, H: 80 }, { thicknessMm: 1.5 });
 *   dielineToSvg(model); boardArea(model).blankAreaM2; model.faces.front
 */
import type { Dims, MaterialCode, StructureCode, StructureFeatures } from "@/types";
import { generateDieline } from "./generate";
import { BOARD_SPECS } from "./materials";
import type { DielineMetrics, DielineModel } from "./types";

export * from "./types";
export { generateDieline, tryGenerateDieline, DEFAULT_BLEED_MM } from "./generate";
export {
  STRUCTURE_LIMITS,
  DEFAULT_DIMS,
  validateDims,
  clampDims,
  dimsSchema,
  DielineValidationError,
  type DimsIssue,
  type DimsIssueCode,
  type DimsValidation,
} from "./limits";
export {
  STRUCTURE_FAMILY,
  BOARD_SPECS,
  boardAppearance,
  finishSurface,
  defaultMaterialFor,
  materialFitsStructure,
  type BoardSpec,
  type BoardAppearance,
} from "./materials";
export { dielineToSvg, svg, PANEL_ROLE_LABELS, type DielineSvgOptions } from "./svg";
export { STRUCTURES, STRUCTURE_LIST, BOX_STRUCTURE_LIST, structureBySlug, type StructureDef } from "./registry";
export {
  FEATURE_SUPPORT,
  DEFAULT_FEATURES,
  MAX_PARTITION_CELLS,
  supportedFeatures,
  type FeatureSupport,
  type FeatureKey,
} from "./features";
export { tubeSegments } from "./structures";
export { structureIllustrationSvg, type IllustrationOptions } from "./illustration";
export {
  computePoses,
  boundsAt,
  computeFaces,
  panelOrder,
  rootIds,
  assemblyPoseAt,
  panelPivot,
  panelAxis,
  panelLocalPoint,
  panelFoldAmount,
  maxStage,
  rootRotationAt,
  faceTransform,
  partRect,
  applyAffine,
  composeAffine,
  smoothstep,
  FACE_FRAMES,
  type FoldInput,
  type PanelPose,
} from "./fold";
export {
  surfaceCanvasSize,
  paintArtworkSurface,
  drawLayer,
  imagePlacement,
  sheetImagePlacement,
  testPatternArtwork,
  MAX_TEXTURE_PX,
  type PaintOptions,
  type Ctx2D,
} from "./texture";

/** Board consumption of one box (for pricing). */
export function boardArea(model: DielineModel): DielineMetrics {
  return model.metrics;
}

/** Convenience: dieline for a material code (thickness from BOARD_SPECS). */
export function generateDielineForMaterial(code: StructureCode, dims: Dims, material: MaterialCode, features?: StructureFeatures): DielineModel {
  return generateDieline(code, dims, { thicknessMm: BOARD_SPECS[material].thicknessMm, features });
}

/** Blank area in m² for a structure + size + material, without keeping the model. */
export function blankAreaM2(code: StructureCode, dims: Dims, material: MaterialCode, features?: StructureFeatures): number {
  return generateDielineForMaterial(code, dims, material, features).metrics.blankAreaM2;
}
