/**
 * Finishes for the 3D viewer (owner: configuration + finishes). Eager three.js code: import
 * from lazily loaded modules only (like "@/components/three/engine").
 *
 *   <PackagingScene dieline={m} material="E_FLUTE_WHITE" foldProgress={1}
 *     surfaceFinish={{ board: cfg.material, finishes: cfg.finishes, artwork, images, version }}
 *     stage={{ context: "table", dimensions: true }} autoRotate poster="/thumb.png" />
 */
export { FinishedPackagingModel, type FinishedPackagingModelProps, type SurfaceFinishProps } from "./FinishedPackagingModel";
export { StudioStage, type StudioStageProps, type StageOptions, type StageContext } from "./StudioStage";
export { createFinishedBoardMaterials, patchFinishShader, finishTextures, type FinishedBoardMaterials, type FinishUniforms, type FinishMapTextures } from "./finishMaterial";
export { paintFinishMaps, finishMaskKey, type FinishMapCanvases, type PaintMasksOptions } from "./masks";
export * from "./looks";
export * from "./motion";
