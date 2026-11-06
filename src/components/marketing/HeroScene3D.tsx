"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_DIMS, boardAppearance, defaultMaterialFor, generateDielineForMaterial, paintArtworkSurface, surfaceCanvasSize } from "@/lib/dieline";
import { PackagingSceneLazy, type PackagingSceneHandle } from "@/components/three";
import { useArtworkTexture } from "@/components/three/hooks";
import { STRUCTURE_THEME, sampleArtwork } from "./sampleArtwork";

const CODE = "FEFCO_0427" as const;
/** Degrees per second of the hero turntable. */
const SPEED = 16;

function resolveFont() {
  const v = getComputedStyle(document.documentElement).getPropertyValue("--font-inter").trim();
  return v ? `${v}, system-ui, sans-serif` : "Inter, system-ui, sans-serif";
}

export interface HeroScene3DProps {
  playing: boolean;
  poster: string;
  labels: { viewer: string; roleDescription: string; keyboardHint: string; unsupported: string };
  onReady?: () => void;
  onInteract?: () => void;
}

/**
 * The live hero box (loaded lazily by HeroVisual): the same mailer, size, board and sample
 * artwork as the static poster (scripts/marketing/CapturePage.tsx), so the swap is seamless.
 * Real dieline, real fold, real board. Turns slowly while `playing` and on screen.
 */
export default function HeroScene3D({ playing, poster, labels, onReady, onInteract }: HeroScene3DProps) {
  const material = defaultMaterialFor(CODE);
  const model = useMemo(() => generateDielineForMaterial(CODE, DEFAULT_DIMS[CODE], material), [material]);
  const handle = useRef<PackagingSceneHandle>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const c = document.createElement("canvas");
    const size = surfaceCanvasSize(model, 1536);
    c.width = size.width;
    c.height = size.height;
    const paint = () => {
      const ctx = c.getContext("2d");
      if (!ctx || cancelled) return;
      paintArtworkSurface(ctx, model, sampleArtwork(model, STRUCTURE_THEME[CODE]), {
        surface: "outside",
        pxPerMm: size.pxPerMm,
        boardColor: boardAppearance(material).outside,
        resolveFont,
      });
      setCanvas(c);
      setVersion((v) => v + 1);
    };
    paint();
    document.fonts?.ready.then(paint).catch(() => undefined);
    return () => {
      cancelled = true;
      c.width = 0;
      c.height = 0;
    };
  }, [model, material]);
  const texture = useArtworkTexture(canvas, version);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    let visible = true;
    const io = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver(([e]) => (visible = e.isIntersecting)) : null;
    if (wrap.current) io?.observe(wrap.current);
    const tick = (now: number) => {
      const dt = Math.min(now - last, 64);
      last = now;
      if (visible && document.visibilityState === "visible") handle.current?.rotate((SPEED * dt) / 1000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      io?.disconnect();
    };
  }, [playing]);

  return (
    <div ref={wrap} style={{ inlineSize: "100%", blockSize: "100%" }} onPointerDown={onInteract} onFocusCapture={onInteract}>
      <PackagingSceneLazy
        dieline={model}
        material={material}
        finish="MATTE_LAMINATION"
        foldProgress={1}
        animateFold={false}
        artworkTextures={{ outside: texture }}
        artworkVersion={version}
        handleRef={handle}
        poster={poster}
        ariaLabel={labels.viewer}
        roleDescription={labels.roleDescription}
        keyboardHint={labels.keyboardHint}
        fallback={<p>{labels.unsupported}</p>}
        onReady={onReady}
      />
    </div>
  );
}
