/**
 * Eager (non-lazy) 3D engine exports. Importing this module pulls three.js + R3F into the
 * importing chunk, so only import it from code that is itself lazy-loaded (e.g. a
 * designer canvas loaded with next/dynamic). Page-level code should use
 * `PackagingSceneLazy` from "@/components/three".
 */
export { PackagingScene, type PackagingSceneHandle, type PackagingSceneProps, type ViewName } from "./PackagingScene";
export { PackagingModel, MM, type PackagingModelProps, type ArtworkTextures } from "./PackagingModel";
export { useArtworkTexture, usePrefersReducedMotion, defaultMaxDpr } from "./hooks";
export { captureScreenshot, downloadBlob, type ScreenshotOptions } from "./screenshot";
export { createBoardMaterials, configureArtworkTexture, type BoardMaterialSet } from "./boardMaterials";
export { buildPanelGeometry } from "./panelGeometry";
