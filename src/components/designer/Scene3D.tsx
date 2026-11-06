"use client";

import { useMemo, type Ref } from "react";
import type { Artwork, DesignFinish, FinishCode, Locale, MaterialCode } from "@/types";
import type { DielineModel } from "@/lib/dieline";
import { BOX_BOARD_CODES, type BoxBoardCode } from "@/lib/configurator";
import { formatNumber } from "@/lib/format";
import { PackagingScene, useArtworkTexture, type PackagingSceneHandle } from "@/components/three/engine";
import { resolveFont } from "./fonts";
import styles from "./designer.module.css";

/**
 * The 3D view with the designer's artwork textures. Loaded lazily (next/dynamic, ssr: false)
 * so three.js stays out of the first page load. Real finishes (foil, spot UV, emboss, soft
 * touch, kraft fibre) come from the configurator's finish materials when the design has any.
 */
export default function Scene3D({
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
}) {
  const outside = useArtworkTexture(canvases?.outside, version);
  const inside = useArtworkTexture(printInside ? canvases?.inside : null, version);
  const board = (BOX_BOARD_CODES as readonly string[]).includes(material) ? (material as BoxBoardCode) : null;
  const surfaceFinish = useMemo(
    () =>
      board && finishes?.length
        ? { board, finishes: finishes.map((f) => ({ code: f.code, ...(f.mask ? { mask: f.mask } : {}) })), artwork: artwork ?? null, images, resolveFont, version }
        : undefined,
    [board, finishes, artwork, images, version],
  );
  const stage = useMemo(
    () => (dimensions || scene !== "none" ? { context: scene, dimensions, formatMm: (mm: number) => `${formatNumber(Math.round(mm))} ${locale === "ar" ? "مم" : "mm"}` } : undefined),
    [dimensions, scene, locale],
  );
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
      ariaLabel={ariaLabel}
      roleDescription={roleDescription}
      keyboardHint={keyboardHint}
      fallback={<p className={styles.sceneFallback}>{fallback}</p>}
    />
  );
}
