/**
 * 3D engine components (owner: 3D engine). Client-only.
 *
 *   const viewRef = useRef<PackagingSceneHandle>(null);
 *   <PackagingSceneLazy dieline={model} material="E_FLUTE_KRAFT" finish="MATTE_LAMINATION"
 *     foldProgress={1} artworkTextures={{ outside: tex }} handleRef={viewRef} />
 *   <ViewControls handle={viewRef} labels={...} />
 *   const blob = await viewRef.current?.screenshot({ width: 2048, height: 2048 });
 *
 * This entry stays light (three.js is code-split behind PackagingSceneLazy). For the
 * eager pieces (PackagingModel, useArtworkTexture, captureScreenshot…) import
 * "@/components/three/engine" from a lazily loaded module.
 */
export type { PackagingSceneHandle, PackagingSceneProps, PackagingSceneContentProps, ViewName, PickHit } from "./PackagingScene";
export type { EngineCanvasProps } from "./EngineCanvas";
export type { ArtworkTextures, PackagingModelProps } from "./PackagingModel";
export type { ScreenshotOptions } from "./screenshot";
export { PackagingSceneLazy } from "./LazyPackagingScene";
// R6-R1: call before a dynamic import of a module that uses "@/components/three/engine"
export { loadEngineStack } from "./lazyLoad";
export { ViewControls, DEFAULT_VIEW_CONTROL_LABELS, type ViewControlsLabels } from "./ViewControls";
// Bottles, jars, cans, tins, pouches and tubes (labels and sleeves): see ./vessels
export { VesselSceneLazy, paintLabel, labelCanvasSize, type VesselSceneHandle, type VesselSceneProps, type VesselLabel, type VesselQuality, type LabelArtStyle } from "./vessels";
