"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Artwork, ArtworkSurface, MaterialCode, TextLayer } from "@/types";
import { boardAppearance, paintArtworkSurface, surfaceCanvasSize, type DielineModel } from "@/lib/dieline";
import { resolveFont } from "./fonts";

/**
 * Decoded images for every ImageLayer src in the artwork. `version` bumps when a new image
 * finishes loading so dependants repaint.
 */
export function useImageCache(artwork: Artwork) {
  const cache = useRef(new Map<string, HTMLImageElement>());
  const [version, setVersion] = useState(0);
  const srcs = useMemo(() => {
    const s = new Set<string>();
    for (const side of [artwork.outside, artwork.inside]) for (const l of side.layers) if (l.kind === "image") s.add(l.src);
    return [...s];
  }, [artwork]);
  useEffect(() => {
    let alive = true;
    for (const src of srcs) {
      if (cache.current.has(src)) continue;
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        if (!alive) return;
        cache.current.set(src, img);
        setVersion((v) => v + 1);
      };
      img.src = src;
    }
    return () => {
      alive = false;
    };
  }, [srcs]);
  return { images: cache.current as Map<string, CanvasImageSource>, version };
}

/** Re-render once web fonts are ready (canvas text uses them). */
export function useFontsReady(): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    if (typeof document !== "undefined" && document.fonts?.ready) {
      void document.fonts.ready.then(() => alive && setN((v) => v + 1));
    }
    return () => {
      alive = false;
    };
  }, []);
  return n;
}

/**
 * One canvas per printed surface, painted in sheet space with paintArtworkSurface. The 3D model
 * maps them onto the panels; the dieline view draws them flat. Repaints are batched to one per
 * animation frame (drags stay smooth on mid-range phones).
 */
/** Preview-only hint on an empty design ("Your logo" on the lid). Never stored, never printed. */
export interface ArtworkPlaceholder {
  text: string;
  fontFamily: TextLayer["fontFamily"];
  direction: TextLayer["direction"];
  color: string;
}

/** The outside surface to paint: the real artwork, or (when it is empty) the placeholder hint. */
export function previewSurface(model: DielineModel, art: ArtworkSurface, placeholder?: ArtworkPlaceholder | null): ArtworkSurface {
  if (!placeholder || art.layers.length > 0 || art.background) return art;
  const face = model.faces.top && model.faces.top.height > 30 ? "top" : model.faces.front ? "front" : null;
  const info = face ? model.faces[face] : null;
  if (!face || !info) return art;
  const pt = Math.max(8, Math.min(48, (info.width * 0.6) / (placeholder.text.length * 0.19), info.height * 0.3 * 2.83));
  const layer: TextLayer = {
    id: "__placeholder",
    kind: "text",
    face,
    surface: "outside",
    x: info.width / 2,
    y: info.height / 2,
    width: info.width * 0.7,
    height: info.height * 0.35,
    rotation: 0,
    opacity: 0.75,
    text: placeholder.text,
    fontFamily: placeholder.fontFamily,
    fontSizePt: Math.round(pt),
    fontWeight: 600,
    color: placeholder.color,
    align: "center",
    direction: placeholder.direction,
  };
  return { background: null, layers: [layer] };
}

export function useArtworkCanvases(
  model: DielineModel | null,
  artwork: Artwork,
  material: MaterialCode,
  printInside: boolean,
  maxPx = 2048,
  placeholder?: ArtworkPlaceholder | null,
) {
  const [canvases, setCanvases] = useState<{ outside: HTMLCanvasElement; inside: HTMLCanvasElement } | null>(null);
  const [version, setVersion] = useState(0);
  const { images, version: imgVersion } = useImageCache(artwork);
  const fonts = useFontsReady();

  useEffect(() => {
    setCanvases({ outside: document.createElement("canvas"), inside: document.createElement("canvas") });
  }, []);

  useEffect(() => {
    if (!canvases || !model) return;
    const raf = requestAnimationFrame(() => {
      const size = surfaceCanvasSize(model, maxPx);
      const look = boardAppearance(material);
      const sides = printInside ? (["outside", "inside"] as const) : (["outside"] as const);
      for (const surface of sides) {
        const c = canvases[surface];
        if (c.width !== size.width || c.height !== size.height) {
          c.width = size.width;
          c.height = size.height;
        }
        const ctx = c.getContext("2d");
        if (!ctx) continue;
        paintArtworkSurface(ctx, model, surface === "outside" ? previewSurface(model, artwork.outside, placeholder) : artwork[surface], {
          surface,
          pxPerMm: size.pxPerMm,
          boardColor: surface === "outside" ? look.outside : look.inside,
          images,
          resolveFont,
        });
      }
      setVersion((v) => v + 1);
    });
    return () => cancelAnimationFrame(raf);
  }, [canvases, model, artwork, material, printInside, images, imgVersion, fonts, maxPx, placeholder]);

  return { canvases, version, images, imgVersion, fonts };
}
