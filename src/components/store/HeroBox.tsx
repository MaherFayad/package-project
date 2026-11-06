"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import type { ArtworkSurface, Locale } from "@/types";
import { BOARD_SPECS, boardAppearance, generateDieline, paintArtworkSurface, surfaceCanvasSize, type DielineModel } from "@/lib/dieline";
import { PackagingSceneLazy, type PackagingSceneHandle } from "@/components/three";
import { useArtworkTexture } from "@/components/three/hooks";
import { Button } from "@/components/ui/Button";
import styles from "./store.module.css";

const DIMS = { L: 250, W: 180, H: 80 } as const;
const MATERIAL = "E_FLUTE_KRAFT" as const;
/** Degrees per second of auto-rotation. */
const SPEED = 18;

function resolveFont(family: "Inter" | "IBM Plex Sans Arabic") {
  const v = getComputedStyle(document.documentElement).getPropertyValue(family === "Inter" ? "--font-inter" : "--font-plex-arabic").trim();
  return v ? `${v}, system-ui, sans-serif` : `"${family}", system-ui, sans-serif`;
}

/** Demo artwork: our own wordmark on the lid, a tagline on the front. Never mirrored in RTL. */
export function heroArtwork(model: DielineModel, locale: Locale): ArtworkSurface {
  const top = model.faces.top;
  const front = model.faces.front;
  const ar = locale === "ar";
  const layers: ArtworkSurface["layers"] = [];
  if (top) {
    layers.push({
      id: "lid-mark", kind: "text", face: "top", surface: "outside", x: top.width / 2, y: top.height / 2, width: top.width * 0.8, height: top.height * 0.4,
      rotation: 0, text: ar ? "علبة" : "Elba", fontFamily: ar ? "IBM Plex Sans Arabic" : "Inter", fontSizePt: 64, fontWeight: 700,
      color: "#1a1a1a", align: "center", direction: ar ? "rtl" : "ltr",
    });
    layers.push({
      id: "lid-band", kind: "shape", shape: "rect", face: "top", surface: "outside", x: top.width / 2, y: top.height * 0.82, width: top.width, height: 10,
      rotation: 0, fill: "#1a1a1a", stroke: null, strokeWidthMm: 0,
    });
  }
  if (front) {
    layers.push({
      id: "front-tag", kind: "text", face: "front", surface: "outside", x: front.width / 2, y: front.height / 2, width: front.width * 0.9, height: front.height * 0.6,
      rotation: 0, text: ar ? "صنع في مصر" : "Made in Egypt", fontFamily: ar ? "IBM Plex Sans Arabic" : "Inter", fontSizePt: 22, fontWeight: 600,
      color: "#1a1a1a", align: "center", direction: ar ? "rtl" : "ltr",
    });
  }
  return { background: null, layers };
}

/**
 * Home hero: a live, slowly rotating 3D mailer box. Loads three.js after the page is idle and
 * shows the static illustration until then. Rotation can be paused (WCAG 2.2.2) and starts
 * paused under prefers-reduced-motion. Keyboard: the viewer itself takes arrows / +/- / 0.
 */
export function HeroBox({
  locale,
  poster,
  labels,
}: {
  locale: Locale;
  poster: string;
  labels: { viewer: string; roleDescription: string; keyboardHint: string; pause: string; play: string; unsupported: string };
}) {
  const [mounted, setMounted] = useState(false);
  const [playing, setPlaying] = useState(true);
  const handle = useRef<PackagingSceneHandle>(null);
  const dieline = useMemo(() => generateDieline("FEFCO_0427", DIMS, { thicknessMm: BOARD_SPECS[MATERIAL].thicknessMm }), []);

  // Mount the 3D view when the browser is idle (keeps first paint fast on mid-range phones).
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) setPlaying(false);
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(() => setMounted(true), { timeout: 1500 });
      return () => w.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(() => setMounted(true), 300);
    return () => window.clearTimeout(id);
  }, []);

  // Paint the artwork texture once fonts are ready.
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;
    const c = document.createElement("canvas");
    const size = surfaceCanvasSize(dieline, 1024);
    c.width = size.width;
    c.height = size.height;
    const paint = () => {
      const ctx = c.getContext("2d");
      if (!ctx || cancelled) return;
      paintArtworkSurface(ctx, dieline, heroArtwork(dieline, locale), {
        surface: "outside",
        pxPerMm: size.pxPerMm,
        boardColor: boardAppearance(MATERIAL).outside,
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
  }, [mounted, dieline, locale]);
  const texture = useArtworkTexture(canvas, version);

  // Auto-rotate while playing and the hero is on screen.
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!playing || !mounted) return;
    let raf = 0;
    let last = performance.now();
    let visible = true;
    const io = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver(([e]) => (visible = e.isIntersecting)) : null;
    if (wrapRef.current) io?.observe(wrapRef.current);
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
  }, [playing, mounted]);

  return (
    <div className={styles.heroViewer} ref={wrapRef} onPointerDown={() => setPlaying(false)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {!mounted ? <img src={poster} alt="" className={styles.heroPoster} /> : null}
      {mounted ? (
        <div className={styles.heroViewerInner} onFocusCapture={() => setPlaying(false)}>
          <PackagingSceneLazy
            dieline={dieline}
            material={MATERIAL}
            finish="MATTE_LAMINATION"
            foldProgress={1}
            animateFold={false}
            artworkTextures={{ outside: texture }}
            artworkVersion={version}
            handleRef={handle}
            ariaLabel={labels.viewer}
            roleDescription={labels.roleDescription}
            keyboardHint={labels.keyboardHint}
            fallback={<p>{labels.unsupported}</p>}
          />
        </div>
      ) : null}
      <div className={styles.heroToggle}>
        <Button
          size="slim"
          icon={playing ? Pause : Play}
          onClick={() => setPlaying((p) => !p)}
          accessibilityLabel={playing ? labels.pause : labels.play}
        />
      </div>
    </div>
  );
}
