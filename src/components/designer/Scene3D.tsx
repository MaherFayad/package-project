"use client";

import type { Ref } from "react";
import type { FinishCode, MaterialCode } from "@/types";
import type { DielineModel } from "@/lib/dieline";
import { PackagingScene, useArtworkTexture, type PackagingSceneHandle } from "@/components/three/engine";
import styles from "./designer.module.css";

/**
 * The 3D view with the designer's artwork textures. Loaded lazily (next/dynamic, ssr: false)
 * so three.js stays out of the first page load.
 */
export default function Scene3D({
  model,
  material,
  finish,
  foldProgress,
  canvases,
  version,
  printInside,
  handleRef,
  ariaLabel,
  roleDescription,
  keyboardHint,
  fallback,
}: {
  model: DielineModel;
  material: MaterialCode;
  finish: FinishCode;
  foldProgress: number;
  canvases: { outside: HTMLCanvasElement; inside: HTMLCanvasElement } | null;
  version: number;
  printInside: boolean;
  handleRef: Ref<PackagingSceneHandle | null>;
  ariaLabel: string;
  roleDescription: string;
  keyboardHint: string;
  fallback: string;
}) {
  const outside = useArtworkTexture(canvases?.outside, version);
  const inside = useArtworkTexture(printInside ? canvases?.inside : null, version);
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
      ariaLabel={ariaLabel}
      roleDescription={roleDescription}
      keyboardHint={keyboardHint}
      fallback={<p className={styles.sceneFallback}>{fallback}</p>}
    />
  );
}
