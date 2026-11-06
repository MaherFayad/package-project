"use client";

import { Canvas } from "@react-three/fiber";
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { ACESFilmicToneMapping, AgXToneMapping, NeutralToneMapping, type ToneMapping } from "three";
import { defaultMaxDpr } from "./hooks";
import { KEY_SHORTCUTS, RendererSettings, ShaderWarmup, registerDebugRenderer } from "./perf";
import type { ScreenshotOptions } from "./screenshot";
import styles from "./PackagingScene.module.css";

/**
 * One WebGL canvas for any engine content (owner: 3D engine).
 *
 * `PackagingScene` and `VesselScene` are this canvas plus one content component each. A page that
 * switches between a box and a container (the designer) renders `<EngineCanvas>` once and swaps
 * `<PackagingSceneContent>` / `<VesselSceneContent>` inside it, so the WebGL context, the
 * environment map and compiled programs survive the switch (PERF-09).
 *
 * The wrapper is the accessible viewer: role="application", label, keyboard hint, keyboard
 * alternative to dragging (WCAG 2.5.7) routed to whichever content is mounted, visible focus.
 */

export type ViewName = "iso" | "front" | "back" | "left" | "right" | "top" | "bottom";

/** View API a content component registers with its canvas (angles in degrees). */
export interface EngineViewApi {
  canvas: HTMLCanvasElement;
  rotate(deltaAzimuthDeg: number, deltaPolarDeg?: number): void;
  zoom(factor: number): void;
  reset(): void;
  setView(view: ViewName): void;
  screenshot(opts?: ScreenshotOptions): Promise<Blob>;
  /** Called after a keyboard action (e.g. to stop a turntable). */
  onKeyboard?(): void;
}

interface EngineCanvasContextValue {
  register(api: EngineViewApi | null): void;
  /** A content component mounted and drew its first frame. */
  contentReady(): void;
}

const EngineCanvasContext = createContext<EngineCanvasContextValue | null>(null);

/** Content components register their view API so the canvas keyboard reaches them. */
export function useRegisterViewApi(apiRef: { current: EngineViewApi | null }) {
  const ctx = useContext(EngineCanvasContext);
  useEffect(() => {
    if (!ctx) return;
    // a stable proxy: the content replaces apiRef.current on every render
    const proxy: EngineViewApi = {
      get canvas() {
        return apiRef.current!.canvas;
      },
      rotate: (a, p) => apiRef.current?.rotate(a, p),
      zoom: (f) => apiRef.current?.zoom(f),
      reset: () => apiRef.current?.reset(),
      setView: (v) => apiRef.current?.setView(v),
      screenshot: (o) => (apiRef.current ? apiRef.current.screenshot(o) : Promise.reject(new Error("3D view not ready"))),
      onKeyboard: () => apiRef.current?.onKeyboard?.(),
    };
    ctx.register(proxy);
    // report the first frame of this content (after a model / kind switch too)
    let r2 = 0;
    const r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => ctx.contentReady());
    });
    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
      ctx.register(null);
    };
  }, [ctx, apiRef]);
}

export type EngineToneMapping = "neutral" | "aces" | "agx";
export const TONE_MAPPING: Record<EngineToneMapping, ToneMapping> = {
  neutral: NeutralToneMapping,
  aces: ACESFilmicToneMapping,
  agx: AgXToneMapping,
};

export interface EngineCanvasProps {
  children?: ReactNode;
  /** Accessible name of the viewer (localise it). */
  ariaLabel?: string;
  /** aria-roledescription (localise it). Default "3D viewer". */
  roleDescription?: string;
  /** Keyboard instructions read by screen readers (localise it). */
  keyboardHint?: string;
  /** Shown when WebGL is unavailable. */
  fallback?: ReactNode;
  /** Arrow keys / +/- / PageUp/PageDown / 0 / Home on the focused viewer. Default true. */
  enableKeyboard?: boolean;
  /** Cap for devicePixelRatio (default 1.5 on touch / ≤4-core devices, else 2). */
  maxDpr?: number;
  className?: string;
  style?: CSSProperties;
  /** Called once the WebGL canvas exists. */
  onReady?: () => void;
  /** Called after each content component (box / container) mounts and has drawn its first frame, i.e. after every switch. */
  onContentReady?: () => void;
  /** Image shown until the first compiled frame, then cross-faded to the canvas. */
  poster?: string;
  /** Default "neutral" (Khronos PBR Neutral: keeps approved sRGB colours). */
  toneMapping?: EngineToneMapping;
  exposure?: number;
  /** Extra props for the wrapper element (e.g. data-testid). */
  wrapperProps?: Record<`data-${string}`, string | undefined>;
}

export function EngineCanvas({
  children,
  ariaLabel = "3D preview",
  roleDescription = "3D viewer",
  keyboardHint = "Arrow keys rotate, plus and minus zoom, 0 resets the view.",
  fallback,
  enableKeyboard = true,
  maxDpr,
  className,
  style,
  onReady,
  onContentReady,
  poster,
  toneMapping = "neutral",
  exposure = 1,
  wrapperProps,
}: EngineCanvasProps) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!poster) return;
    // never hide the viewer for long if the first frame is slow or WebGL fails
    const t = setTimeout(() => setReady(true), 4000);
    return () => clearTimeout(t);
  }, [poster]);
  const hintId = useId();
  const [dprCap] = useState(() => maxDpr ?? defaultMaxDpr());
  const api = useRef<EngineViewApi | null>(null);
  const register = useCallback((a: EngineViewApi | null) => {
    api.current = a;
  }, []);
  const contentReadyRef = useRef(onContentReady);
  contentReadyRef.current = onContentReady;
  const contentReady = useCallback(() => contentReadyRef.current?.(), []);
  const ctx = useMemo(() => ({ register, contentReady }), [register, contentReady]);
  const tm = TONE_MAPPING[toneMapping] ?? NeutralToneMapping;
  const onWarm = useCallback(() => setReady(true), []);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!enableKeyboard || e.altKey || e.ctrlKey || e.metaKey) return;
    const a = api.current;
    if (!a) return;
    const step = e.shiftKey ? 5 : 15;
    switch (e.key) {
      case "ArrowLeft":
        a.rotate(-step);
        break;
      case "ArrowRight":
        a.rotate(step);
        break;
      case "ArrowUp":
        a.rotate(0, step * 0.66);
        break;
      case "ArrowDown":
        a.rotate(0, -step * 0.66);
        break;
      case "+":
      case "=":
      case "PageUp":
        a.zoom(0.85);
        break;
      case "-":
      case "_":
      case "PageDown":
        a.zoom(1 / 0.85);
        break;
      case "0":
      case "Home":
        a.reset();
        break;
      default:
        return;
    }
    a.onKeyboard?.();
    e.preventDefault();
  };

  return (
    <div
      {...wrapperProps}
      className={[styles.viewport, className].filter(Boolean).join(" ")}
      style={style}
      tabIndex={enableKeyboard ? 0 : undefined}
      role="application"
      aria-roledescription={roleDescription}
      aria-label={ariaLabel}
      aria-describedby={hintId}
      aria-keyshortcuts={enableKeyboard ? KEY_SHORTCUTS : undefined}
      onKeyDown={onKeyDown}
      dir="ltr"
    >
      <span id={hintId} className={styles.hint}>
        {keyboardHint}
      </span>
      {poster ? <div aria-hidden="true" className={styles.poster} data-hidden={ready ? "true" : undefined} style={{ backgroundImage: `url(${JSON.stringify(poster)})` }} /> : null}
      <Canvas
        className={styles.canvas}
        data-fade={poster ? (ready ? "in" : "out") : undefined}
        frameloop="demand"
        dpr={[1, dprCap]}
        // drag / keyboard input drops the pixel ratio to 2/3 (never below 1) until 300 ms after it ends
        performance={{ min: 0.66, max: 1, debounce: 300 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance", localClippingEnabled: true } as never}
        camera={{ fov: 30, near: 0.005, far: 60, position: [0.4, 0.35, 0.7] }}
        onCreated={({ gl }) => {
          gl.toneMapping = tm;
          gl.toneMappingExposure = exposure;
          gl.localClippingEnabled = true;
          gl.setClearColor(0x000000, 0);
          registerDebugRenderer(gl);
          onReady?.();
        }}
        fallback={fallback ?? <div className={styles.fallback}>3D preview is not available on this device.</div>}
      >
        {/* compile every shader before the canvas fades in (no first-interaction hitch), then reveal */}
        <ShaderWarmup onDone={onWarm} />
        <RendererSettings toneMapping={tm} exposure={exposure} />
        <EngineCanvasContext.Provider value={ctx}>{children}</EngineCanvasContext.Provider>
      </Canvas>
    </div>
  );
}
