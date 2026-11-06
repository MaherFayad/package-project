"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { ArtworkSurface, Locale, MaterialCode } from "@/types";
import { BOARD_SPECS, boardAppearance, generateDieline, paintArtworkSurface, surfaceCanvasSize, type DielineModel } from "@/lib/dieline";
import { PackagingSceneLazy, type PackagingSceneHandle } from "@/components/three";
import { useArtworkTexture } from "@/components/three/hooks";
import { presetDims } from "./lib/catalog";
import { PRODUCT_PRESETS, type ProductPresetKey } from "./lib/paths";
import { resolveFont } from "./fonts";
import styles from "./designer.module.css";

/**
 * The start page's live 3D preview (lazy chunk: the dieline engine and three.js load only after
 * the page is idle, never in the start page's first bundle; PERF-03).
 */

/** Look of each product preview: board + a sample brand (our own words, never a real brand). */
const LOOK: Record<ProductPresetKey, { material: MaterialCode; bg: string | null; ink: string }> = {
  tshirt: { material: "E_FLUTE_WHITE", bg: "#1f3d2b", ink: "#ffffff" },
  shoe: { material: "E_FLUTE_KRAFT", bg: null, ink: "#1a1a1a" },
  perfume50: { material: "SBS_350", bg: "#e4deff", ink: "#303030" },
  pizza30: { material: "E_FLUTE_KRAFT", bg: null, ink: "#c70a24" },
};

/** Degrees per second of the slow turntable. */
const SPEED = 16;
/** Longest bounded turn (R4-24): auto-moving content stops within 8 s (WCAG 2.2.2 allows 5 s for
 * blinking; the turntable also stops for good under reduced motion). */
const TURN_MS = 8000;

function sampleArtwork(model: DielineModel, locale: Locale, look: (typeof LOOK)[ProductPresetKey]): ArtworkSurface {
  const ar = locale === "ar";
  const font = ar ? "IBM Plex Sans Arabic" : "Inter";
  const layers: ArtworkSurface["layers"] = [];
  const top = model.faces.top;
  const front = model.faces.front;
  const brand = ar ? "علامتك" : "Your brand";
  const fit = (w: number, h: number, chars: number) => Math.max(8, Math.min(72, Math.min((w * 0.7) / (chars * 0.19), h * 0.45 * 2.83)));
  if (top && top.height > 40) {
    layers.push({
      id: "s-top", kind: "text", face: "top", surface: "outside", x: top.width / 2, y: top.height / 2, width: top.width * 0.8, height: top.height * 0.4,
      rotation: 0, text: brand, fontFamily: font, fontSizePt: fit(top.width, top.height, brand.length), fontWeight: 700, color: look.ink, align: "center", direction: ar ? "rtl" : "ltr",
    });
  }
  if (front) {
    const text = top && top.height > 40 ? (ar ? "صنع في مصر" : "Made in Egypt") : brand;
    layers.push({
      id: "s-front", kind: "text", face: "front", surface: "outside", x: front.width / 2, y: front.height / 2, width: front.width * 0.9, height: front.height * 0.5,
      rotation: 0, text, fontFamily: font, fontSizePt: fit(front.width, front.height, text.length), fontWeight: 600, color: look.ink, align: "center", direction: ar ? "rtl" : "ltr",
    });
  }
  return { background: look.bg, layers };
}

export default function StartViewer({
  active,
  locale,
  playing,
  wrapRef,
  labels,
  onReady,
  turn,
  onTurnDone,
}: {
  active: ProductPresetKey;
  locale: Locale;
  playing: boolean;
  wrapRef: RefObject<HTMLDivElement | null>;
  labels: { viewer: string; roleDescription: string; keyboardHint: string; unsupported: string };
  /** First frame drawn (DesignStart then fades its poster out, R4-11). */
  onReady?: () => void;
  /**
   * R4-24 (WCAG 2.2.2): a new value starts one bounded turn: it stops after a full turn or 8 s of
   * turning, whichever comes first, then calls `onTurnDone`. `null` turns until paused (the
   * visitor pressed Play).
   */
  turn?: number | null;
  onTurnDone?: () => void;
}) {
  const doneRef = useRef(onTurnDone);
  doneRef.current = onTurnDone;
  const handle = useRef<PackagingSceneHandle>(null);
  const preset = PRODUCT_PRESETS.find((p) => p.key === active)!;
  const look = LOOK[active];
  const dieline = useMemo(
    () => generateDieline(preset.structureCode, presetDims(preset.structureCode, preset.presetId), { thicknessMm: BOARD_SPECS[look.material].thicknessMm }),
    [preset, look.material],
  );

  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const c = document.createElement("canvas");
    const size = surfaceCanvasSize(dieline, 1024);
    c.width = size.width;
    c.height = size.height;
    const paint = () => {
      const ctx = c.getContext("2d");
      if (!ctx || cancelled) return;
      paintArtworkSurface(ctx, dieline, sampleArtwork(dieline, locale, look), {
        surface: "outside",
        pxPerMm: size.pxPerMm,
        boardColor: boardAppearance(look.material).outside,
        resolveFont,
      });
      setCanvas(c);
      setVersion((v) => v + 1);
    };
    paint();
    document.fonts?.ready.then(paint).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [dieline, locale, look]);
  const texture = useArtworkTexture(canvas, version);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    let visible = true;
    let turned = 0;
    let elapsed = 0;
    const bounded = turn !== null && turn !== undefined;
    const io = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver(([e]) => (visible = e.isIntersecting)) : null;
    if (wrapRef.current) io?.observe(wrapRef.current);
    const tick = (now: number) => {
      // Wall-clock time for the 8 s budget (slow GPUs draw few frames); a capped step for the turn.
      const real = Math.min(now - last, 1000);
      const dt = Math.min(real, 64);
      last = now;
      if (visible && document.visibilityState === "visible") {
        handle.current?.rotate((SPEED * dt) / 1000);
        turned += (SPEED * dt) / 1000;
        elapsed += real;
        if (bounded && (turned >= 360 || elapsed >= TURN_MS)) {
          doneRef.current?.();
          return;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      io?.disconnect();
    };
  }, [playing, wrapRef, turn]);

  return (
    <PackagingSceneLazy
      key={active}
      dieline={dieline}
      material={look.material}
      finish="MATTE_LAMINATION"
      foldProgress={1}
      animateFold={false}
      artworkTextures={{ outside: texture }}
      artworkVersion={version}
      handleRef={handle}
      onReady={onReady}
      ariaLabel={labels.viewer}
      roleDescription={labels.roleDescription}
      keyboardHint={labels.keyboardHint}
      fallback={<p className={styles.sceneFallback}>{labels.unsupported}</p>}
    />
  );
}
