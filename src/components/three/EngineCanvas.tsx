"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { ACESFilmicToneMapping, AgXToneMapping, NeutralToneMapping, type ToneMapping } from "three";
import { defaultMaxDpr } from "./hooks";
import { KEY_SHORTCUTS, RendererSettings, ShaderWarmup, registerDebugRenderer, yieldToMain } from "./perf";
import type { ScreenshotOptions } from "./screenshot";
import type { PhotoRenderOptions, PhotoRenderResult } from "./photoRender";
import type { FitInsets } from "./fit";
import { useOptionalI18n } from "@/i18n/client";
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
  /** Overlay insets in px (see fit.ts). */
  setFitInsets?(insets: FitInsets | null): void;
  /** What printed board is under a viewport point (client px), or null. */
  pickAt?(clientX: number, clientY: number): PickHit | null;
  /** The model's root object (for 3D export). */
  getModel?(): import("three").Object3D | null;
  /** Glow the given panels' printed surface (hover / drop target); null clears it. */
  highlight?(panelIds: readonly string[] | null, surface?: "outside" | "inside"): void;
  /** Path-traced studio image of the model (see photoRender.ts). */
  renderPhoto?(opts?: PhotoRenderOptions): Promise<PhotoRenderResult>;
}

/** A point on the printed board under the pointer: panel, printed surface and sheet position (mm). */
export interface PickHit {
  panelId: string;
  surface: "outside" | "inside";
  /** Sheet coordinates in mm (origin top-left of the printed sheet, x right, y down). */
  sheet: { x: number; y: number };
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
      setFitInsets: (i) => apiRef.current?.setFitInsets?.(i),
      pickAt: (x, y) => apiRef.current?.pickAt?.(x, y) ?? null,
      getModel: () => apiRef.current?.getModel?.() ?? null,
      highlight: (ids, s) => apiRef.current?.highlight?.(ids, s),
      renderPhoto: (o) => (apiRef.current?.renderPhoto ? apiRef.current.renderPhoto(o) : Promise.reject(new Error("3D view not ready"))),
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

/** Draws a frame when `on` turns true (the safety reveal starts the frameloop without a warm-up). */
function DrawWhen({ on }: { on: boolean }) {
  const invalidate = useThree((st) => st.invalidate);
  useEffect(() => {
    if (on) invalidate();
  }, [on, invalidate]);
  return null;
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
  // R4-CR-01: the canvas is revealed in one step once its shaders are compiled AND the content has
  // drawn its first frame, never cross-faded. Until then the page's poster (or ours) is the only
  // image: no half-built frame shows through it, so there is no double image. Our own poster then
  // fades out over --motion-fast; a page that owns its poster fades it on onContentReady, which
  // fires at the reveal.
  const [warm, setWarm] = useState(false);
  // R6-R1: no frame is drawn until ShaderWarmup has built the programs in slices; the first render
  // would otherwise link them all in one long task
  const [compiled, setCompiled] = useState(false);
  const [contentSeen, setContentSeen] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    // never hide the viewer for long if the first frame is slow or WebGL fails
    const t = setTimeout(() => setTimedOut(true), 4000);
    return () => clearTimeout(t);
  }, []);
  const ready = (warm && contentSeen) || timedOut;
  const hintId = useId();
  const [dprCap] = useState(() => maxDpr ?? defaultMaxDpr());
  const api = useRef<EngineViewApi | null>(null);
  const register = useCallback((a: EngineViewApi | null) => {
    api.current = a;
  }, []);
  const contentReadyRef = useRef(onContentReady);
  contentReadyRef.current = onContentReady;
  // the first content-ready waits for the reveal (so a page poster fades exactly as the canvas
  // appears); later ones (model / kind switches) are reported at once
  const revealed = useRef(false);
  const pendingReady = useRef(false);
  const contentReady = useCallback(() => {
    setContentSeen(true);
    if (revealed.current) contentReadyRef.current?.();
    else pendingReady.current = true;
  }, []);
  useEffect(() => {
    if (!ready || revealed.current) return;
    revealed.current = true;
    if (pendingReady.current) {
      pendingReady.current = false;
      contentReadyRef.current?.();
    }
  }, [ready]);
  const ctx = useMemo(() => ({ register, contentReady }), [register, contentReady]);
  const tm = TONE_MAPPING[toneMapping] ?? NeutralToneMapping;
  const onWarm = useCallback(() => setWarm(true), []);
  const onCompiled = useCallback(() => setCompiled(true), []);
  // R6-R1: the renderer (context, drawing buffer) and the scene mount in separate tasks
  const [mountContent, setMountContent] = useState(false);

  // a11y R4-10 (WCAG 4.1.3): keyboard view changes are confirmed in a polite status, debounced
  // 300 ms so holding an arrow key gives one message ("Rotate left"), not one per step.
  const i18n = useOptionalI18n();
  const VIEW_SAY = {
    left: i18n?.t("viewer.rotateLeft") ?? "Rotate left",
    right: i18n?.t("viewer.rotateRight") ?? "Rotate right",
    up: i18n?.t("viewer.tiltUp") ?? "Tilt up",
    down: i18n?.t("viewer.tiltDown") ?? "Tilt down",
    zoomIn: i18n?.t("viewer.zoomIn") ?? "Zoom in",
    zoomOut: i18n?.t("viewer.zoomOut") ?? "Zoom out",
    reset: i18n?.t("viewer.reset") ?? "Reset view",
  };
  const [said, setSaid] = useState("");
  const sayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (sayTimer.current) clearTimeout(sayTimer.current);
  }, []);
  const say = (text: string) => {
    if (sayTimer.current) clearTimeout(sayTimer.current);
    setSaid("");
    sayTimer.current = setTimeout(() => setSaid(text), 300);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!enableKeyboard || e.altKey || e.ctrlKey || e.metaKey) return;
    const a = api.current;
    if (!a) return;
    const step = e.shiftKey ? 5 : 15;
    switch (e.key) {
      case "ArrowLeft":
        a.rotate(-step);
        say(VIEW_SAY.left);
        break;
      case "ArrowRight":
        a.rotate(step);
        say(VIEW_SAY.right);
        break;
      case "ArrowUp":
        a.rotate(0, step * 0.66);
        say(VIEW_SAY.up);
        break;
      case "ArrowDown":
        a.rotate(0, -step * 0.66);
        say(VIEW_SAY.down);
        break;
      case "+":
      case "=":
      case "PageUp":
        a.zoom(0.85);
        say(VIEW_SAY.zoomIn);
        break;
      case "-":
      case "_":
      case "PageDown":
        a.zoom(1 / 0.85);
        say(VIEW_SAY.zoomOut);
        break;
      case "0":
      case "Home":
        a.reset();
        say(VIEW_SAY.reset);
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
      {enableKeyboard ? (
        <span className={styles.hint} role="status">
          {said}
        </span>
      ) : null}
      {poster ? <div aria-hidden="true" className={styles.poster} data-hidden={ready ? "true" : undefined} style={{ backgroundImage: `url(${JSON.stringify(poster)})` }} /> : null}
      <Canvas
        className={styles.canvas}
        data-reveal={ready ? "shown" : "hidden"}
        frameloop={compiled || timedOut ? "demand" : "never"}
        dpr={[1, dprCap]}
        // PCF soft shadow maps: the key light shades flaps, walls and the inside of open boxes
        shadows="soft"
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
          void yieldToMain().then(() => setMountContent(true));
        }}
        fallback={fallback ?? <div className={styles.fallback}>3D preview is not available on this device.</div>}
      >
        {/* compile every shader before the canvas fades in (no first-interaction hitch), then reveal */}
        <DrawWhen on={timedOut} />
        <RendererSettings toneMapping={tm} exposure={exposure} />
        {mountContent ? (
          <>
            <ShaderWarmup onDone={onWarm} onCompiled={onCompiled} />
            <EngineCanvasContext.Provider value={ctx}>{children}</EngineCanvasContext.Provider>
          </>
        ) : null}
      </Canvas>
    </div>
  );
}
