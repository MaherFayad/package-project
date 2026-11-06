"use client";

import { memo, useMemo, type Ref } from "react";
import type { Artwork, DesignFinish, FinishCode, Locale, MaterialCode } from "@/types";
import type { DielineModel } from "@/lib/dieline";
import { BOX_BOARD_CODES, type BoxBoardCode } from "@/lib/configurator";
import { formatNumber } from "@/lib/format";
import { EngineCanvas, PackagingSceneContent, useArtworkTexture, type PackagingSceneHandle } from "@/components/three/engine";
import { resolveFont } from "./fonts";
import { finishPreview } from "./lib/config";
import styles from "./designer.module.css";

/**
 * The 3D view with the designer's artwork textures. Loaded lazily (next/dynamic, ssr: false)
 * so three.js stays out of the first page load. Real finishes (foil, spot UV, emboss, soft
 * touch, kraft fibre) come from the configurator's finish materials when the design has any.
 */
export interface BoxContentProps {
  model: DielineModel;
  material: MaterialCode;
  finish: FinishCode;
  finishes?: DesignFinish[];
  artwork?: Artwork;
  images?: Map<string, CanvasImageSource>;
  foldProgress: number;
  canvases: { outside: HTMLCanvasElement; inside: HTMLCanvasElement } | null;
  version: number;
  printInside: boolean;
  handleRef: Ref<PackagingSceneHandle | null>;
  dimensions?: boolean;
  scene?: "none" | "table" | "shelf" | "reference";
  turntable?: boolean;
  locale?: Locale;
}

/**
 * The box scene without a canvas: render it inside `<EngineCanvas>` (the designer's
 * `DesignStage` keeps one canvas for boxes and containers, PERF-09).
 */
export const BoxContent = memo(function BoxContent({
  model,
  material,
  finish,
  finishes,
  artwork,
  images,
  foldProgress,
  canvases,
  version,
  printInside,
  handleRef,
  dimensions = false,
  scene = "none",
  turntable = false,
  locale = "en",
}: BoxContentProps) {
  const outside = useArtworkTexture(canvases?.outside, version);
  const inside = useArtworkTexture(printInside ? canvases?.inside : null, version);
  const board = (BOX_BOARD_CODES as readonly string[]).includes(material) ? (material as BoxBoardCode) : null;
  const finishView = useMemo(() => (finishes?.length && artwork ? finishPreview(finishes, artwork, model) : null), [finishes, artwork, model]);
  const surfaceFinish = useMemo(
    () => (board && finishView ? { board, finishes: finishView.finishes, artwork: finishView.artwork, images, resolveFont, version } : undefined),
    [board, finishView, images, version],
  );
  const stage = useMemo(
    () => (dimensions || scene !== "none" ? { context: scene, dimensions, formatMm: (mm: number) => `${formatNumber(Math.round(mm))} ${locale === "ar" ? "مم" : "mm"}` } : undefined),
    [dimensions, scene, locale],
  );
  return (
    <PackagingSceneContent
      dieline={model}
      material={material}
      finish={finish}
      foldProgress={foldProgress}
      artworkTextures={{ outside, inside }}
      artworkVersion={version}
      printInside={printInside}
      handleRef={handleRef}
      surfaceFinish={surfaceFinish}
      stage={stage}
      autoRotate={turntable}
    />
  );
});

/** Box viewer with its own canvas (share page, proof). Memoised so panel / price updates do not re-render it (PERF-18). */
export default memo(function Scene3D({
  model,
  material,
  finish,
  finishes,
  artwork,
  images,
  foldProgress,
  canvases,
  version,
  printInside,
  handleRef,
  dimensions = false,
  scene = "none",
  turntable = false,
  locale = "en",
  ariaLabel,
  roleDescription,
  keyboardHint,
  fallback,
  poster,
  onReady,
}: {
  model: DielineModel;
  material: MaterialCode;
  finish: FinishCode;
  finishes?: DesignFinish[];
  artwork?: Artwork;
  images?: Map<string, CanvasImageSource>;
  foldProgress: number;
  canvases: { outside: HTMLCanvasElement; inside: HTMLCanvasElement } | null;
  version: number;
  printInside: boolean;
  handleRef: Ref<PackagingSceneHandle | null>;
  dimensions?: boolean;
  scene?: "none" | "table" | "shelf" | "reference";
  turntable?: boolean;
  locale?: Locale;
  ariaLabel: string;
  roleDescription: string;
  keyboardHint: string;
  fallback: string;
  /** Shown until the first 3D frame (the model's picker thumbnail). */
  poster?: string;
  /** First frame rendered (the stage fades its poster out). */
  onReady?: () => void;
}) {
  return (
    <EngineCanvas poster={poster} onReady={onReady} ariaLabel={ariaLabel} roleDescription={roleDescription} keyboardHint={keyboardHint} fallback={<p className={styles.sceneFallback}>{fallback}</p>}>
      <BoxContent
        model={model}
        material={material}
        finish={finish}
        finishes={finishes}
        artwork={artwork}
        images={images}
        foldProgress={foldProgress}
        canvases={canvases}
        version={version}
        printInside={printInside}
        handleRef={handleRef}
        dimensions={dimensions}
        scene={scene}
        turntable={turntable}
        locale={locale}
      />
    </EngineCanvas>
  );
});
