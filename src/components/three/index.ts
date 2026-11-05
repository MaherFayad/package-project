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
export type { PackagingSceneHandle, PackagingSceneProps, ViewName } from "./PackagingScene";
export type { ArtworkTextures, PackagingModelProps } from "./PackagingModel";
export type { ScreenshotOptions } from "./screenshot";
export { PackagingSceneLazy } from "./LazyPackagingScene";
export { ViewControls, DEFAULT_VIEW_CONTROL_LABELS, type ViewControlsLabels } from "./ViewControls";
