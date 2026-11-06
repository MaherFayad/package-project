"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { CanvasTexture, type Texture } from "three";
import { configureArtworkTexture } from "./boardMaterials";

const RM_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeMedia(query: string) {
  return (cb: () => void) => {
    if (typeof window === "undefined" || !window.matchMedia) return () => {};
    const mq = window.matchMedia(query);
    mq.addEventListener("change", cb);
    return () => mq.removeEventListener("change", cb);
  };
}
const subscribeRM = subscribeMedia(RM_QUERY);

/** true when the user asked the OS to reduce motion (WCAG 2.3.3). */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeRM,
    () => (typeof window !== "undefined" && !!window.matchMedia?.(RM_QUERY).matches),
    () => false,
  );
}

/** Max device-pixel ratio for the 3D canvas: lower on touch / low-core devices. */
export { defaultMaxDpr } from "./dpr";

/**
 * Wrap a canvas (painted with paintArtworkSurface) in a texture. Bump `version` after
 * repainting to upload the new pixels. A resized canvas gets a new texture (GPU storage
 * is immutable once allocated). Disposed on unmount / when the canvas changes.
 */
export function useArtworkTexture(
  canvas: HTMLCanvasElement | OffscreenCanvas | null | undefined,
  version: number | string = 0,
): Texture | null {
  const w = canvas?.width ?? 0;
  const h = canvas?.height ?? 0;
  const texture = useMemo(
    () => (canvas && w > 0 && h > 0 ? configureArtworkTexture(new CanvasTexture(canvas as HTMLCanvasElement)) : null),
    // a new texture per canvas size
    [canvas, w, h],
  );
  useEffect(() => {
    if (texture) texture.needsUpdate = true;
  }, [texture, version]);
  useEffect(() => () => texture?.dispose(), [texture]);
  return texture;
}
