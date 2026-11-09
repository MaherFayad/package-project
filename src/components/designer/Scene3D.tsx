"use client";

import { memo, useMemo, type Ref } from "react";
import type { Artwork, DesignFinish, FinishCode, Locale, MaterialCode } from "@/types";
import type { DielineModel } from "@/lib/dieline";
import { BOX_BOARD_CODES, type BoxBoardCode } from "@/lib/configurator";
import { formatNumber } from "@/lib/format";
import { PackagingScene, PackagingSceneContent, useArtworkTexture, type PackagingSceneHandle } from "@/components/three/engine";
import { resolveFont } from "./fonts";
import { finishPreview } from "./lib/config";
import styles from "./designer.module.css";

/**
 * The 3D view with the designer's artwork textures. Loaded lazily (next/dynamic, ssr: false)
 * so three.js stays out of the first page load. Real finishes (foil, spot UV, emboss, soft
 * touch, kraft fibre) come from the configurator's finish materials when the design has any.
 */
/** Memoised so panel / price updates do not re-render the 3D view (PERF-18). */
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
  embedded = false,
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
  /** Render only the scene content, inside a parent `<EngineCanvas>` (PERF-09: one WebGL context for every model). */
  embedded?: boolean;
}) {
  const outside = useArtworkTexture(canvases?.outside, version);
  const inside = useArtworkTexture(printInside ? canvases?.inside : null, version);
  const board = (BOX_BOARD_CODES as readonly string[]).includes(material) ? (material as BoxBoardCode) : null;
  // FN-02: masked finishes with no artwork yet preview over the whole main face (lib/config finishPreview).
  const finishView = useMemo(() => (finishes?.length && artwork ? finishPreview(finishes, artwork, model) : null), [finishes, artwork, model]);
  const surfaceFinish = useMemo(
    () => (board && finishView ? { board, finishes: finishView.finishes, artwork: finishView.artwork, images, resolveFont, version } : undefined),
    [board, finishView, images, version],
  );
  const stage = useMemo(
    // cm, like the size everywhere else a buyer sees it (one decimal, none when whole)
    () => (dimensions || scene !== "none" ? { context: scene, dimensions, formatMm: (mm: number) => `${formatNumber(Math.round(mm) / 10, Number.isInteger(Math.round(mm) / 10) ? 0 : 1)} ${locale === "ar" ? "سم" : "cm"}` } : undefined),
    [dimensions, scene, locale],
  );
  const content = {
    dieline: model,
    material,
    finish,
    foldProgress,
    artworkTextures: { outside, inside },
    artworkVersion: version,
    printInside,
    handleRef,
    surfaceFinish,
    stage,
    autoRotate: turntable,
  };
  if (embedded) return <PackagingSceneContent {...content} />;
  return (
    <PackagingScene
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
      poster={poster}
      onReady={onReady}
      ariaLabel={ariaLabel}
      roleDescription={roleDescription}
      keyboardHint={keyboardHint}
      fallback={<p className={styles.sceneFallback}>{fallback}</p>}
    />
  );
});
