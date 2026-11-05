"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls } from "@react-three/drei";
import {
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from "react";
import { NeutralToneMapping, PerspectiveCamera, Spherical, Vector3 } from "three";
import { boundsAt, maxStage, type DielineModel } from "@/lib/dieline";
import { defaultMaxDpr, usePrefersReducedMotion } from "./hooks";
import { MM, PackagingModel, type PackagingModelProps } from "./PackagingModel";
import { captureScreenshot, type ScreenshotOptions } from "./screenshot";
import { FinishedPackagingModel, type SurfaceFinishProps } from "./finishes/FinishedPackagingModel";
import { StudioStage, type StageOptions } from "./finishes/StudioStage";
import { AUTO_ROTATE, easeInOutCubic } from "./finishes/motion";
import styles from "./PackagingScene.module.css";

export type ViewName = "iso" | "front" | "back" | "left" | "right" | "top" | "bottom";

/** Imperative API (keyboard/button controls, export). Angles in degrees. */
export interface PackagingSceneHandle {
  /** Orbit around the box. Positive azimuth turns the box to the left (camera moves right). */
  rotate(deltaAzimuthDeg: number, deltaPolarDeg?: number): void;
  /** Multiply the camera distance (< 1 zooms in). */
  zoom(factor: number): void;
  /** Back to the default 3/4 view, framed for the current fold target. */
  reset(): void;
  setView(view: ViewName): void;
  /** Render a PNG/JPEG/WebP at any resolution (default: 2× the canvas). */
  screenshot(opts?: ScreenshotOptions): Promise<Blob>;
  getCanvas(): HTMLCanvasElement | null;
}

export interface PackagingSceneProps extends Omit<PackagingModelProps, "foldProgress"> {
  /** Target fold (0 = flat, 1 = closed). Animates toward it unless reduced motion. */
  foldProgress: number;
  /** Default true. When false (or prefers-reduced-motion) the fold jumps. */
  animateFold?: boolean;
  /** Full flat→closed duration. Default 1200 ms. */
  foldDurationMs?: number;
  /** Re-frame the camera when the fold target or structure changes. Default true. */
  autoFit?: boolean;
  /** Bump after repainting an artwork canvas so the frame is redrawn. */
  artworkVersion?: number | string;
  handleRef?: Ref<PackagingSceneHandle | null>;
  /** Accessible name of the viewer (localise it). */
  ariaLabel?: string;
  /** aria-roledescription (localise it). Default "3D viewer". */
  roleDescription?: string;
  /** Keyboard instructions read by screen readers (localise it). */
  keyboardHint?: string;
  /** Text shown when WebGL is unavailable. */
  fallback?: ReactNode;
  /** Arrow keys / +/- / 0 on the focused viewer. Default true. */
  enableKeyboard?: boolean;
  shadows?: boolean;
  /** Cap for devicePixelRatio (default 1.5 on touch / ≤4-core devices, else 2). */
  maxDpr?: number;
  className?: string;
  style?: CSSProperties;
  /** Called once the WebGL canvas exists. */
  onReady?: () => void;
  /** Extra scene content (e.g. a product inside the box). */
  children?: ReactNode;
  /** Added by finishes: real finishes (foil, spot UV, emboss, laminations, kraft fibre) from a ModelConfig. */
  surfaceFinish?: SurfaceFinishProps;
  /** Added by finishes: studio set (context scene, dimension overlay). Replaces the default lights. */
  stage?: StageOptions;
  /** Added by finishes: slow turntable after a few idle seconds; pauses on any interaction. Off under reduced motion. */
  autoRotate?: boolean;
  /** Added by finishes: image shown until the first 3D frame renders, then cross-faded to the canvas. */
  poster?: string;
}

interface RigApi extends Omit<PackagingSceneHandle, "getCanvas"> {
  canvas: HTMLCanvasElement;
}

const DEG = Math.PI / 180;
const DEFAULT_VIEW = { theta: 32 * DEG, phi: 62 * DEG };
const VIEWS: Record<ViewName, { theta: number; phi: number }> = {
  iso: DEFAULT_VIEW,
  front: { theta: 0, phi: 88 * DEG },
  back: { theta: 180 * DEG, phi: 88 * DEG },
  left: { theta: -90 * DEG, phi: 88 * DEG },
  right: { theta: 90 * DEG, phi: 88 * DEG },
  top: { theta: 0, phi: 1 * DEG },
  bottom: { theta: 0, phi: 179 * DEG },
};
const MIN_PHI = 0.5 * DEG;
const MAX_PHI = 179.5 * DEG;

/** Distance + look-at target that frame the box at a fold progress. */
function frameFor(dieline: DielineModel, progress: number, camera: PerspectiveCamera) {
  const size = boundsAt(dieline, progress).getSize(new Vector3()).multiplyScalar(MM);
  const radius = Math.max(size.length() / 2, 0.01);
  const vfov = camera.fov * DEG;
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
  const fov = Math.min(vfov, hfov);
  return { distance: (radius / Math.sin(fov / 2)) * 1.2, target: new Vector3(0, size.y / 2, 0), size };
}

interface Tween {
  from: Spherical;
  to: Spherical;
  fromT: Vector3;
  toT: Vector3;
  t: number;
  dur: number;
}

function Rig({
  dieline,
  foldTarget,
  animateFold,
  foldDurationMs,
  autoFit,
  progressRef,
  apiRef,
  artworkVersion,
  shadows,
  stage,
  autoRotate = false,
}: {
  dieline: DielineModel;
  foldTarget: number;
  animateFold: boolean;
  foldDurationMs: number;
  autoFit: boolean;
  progressRef: { current: number };
  apiRef: { current: RigApi | null };
  artworkVersion?: number | string;
  shadows: boolean;
  stage?: StageOptions;
  autoRotate?: boolean;
}) {
  const { camera, gl, scene, invalidate, controls } = useThree();
  const reduced = usePrefersReducedMotion();
  const cam = camera as PerspectiveCamera;
  const orbit = controls as unknown as { target: Vector3; update(): void; minDistance: number; maxDistance: number } | null;
  const localTarget = useRef(new Vector3());
  const tween = useRef<Tween | null>(null);
  const targetRef = useRef(foldTarget);
  const motion = animateFold && !reduced;
  // Structures with more fold stages (lock bottoms, lids, dividers) get a little more time
  // so every step stays readable; capped so it never drags.
  const foldMs = foldDurationMs * Math.min(1.8, Math.max(1, (maxStage(dieline) + 1) / 4));

  const getTarget = () => orbit?.target ?? localTarget.current;
  const spherical = () => new Spherical().setFromVector3(cam.position.clone().sub(getTarget()));

  const place = (s: Spherical, target: Vector3) => {
    s.phi = Math.min(MAX_PHI, Math.max(MIN_PHI, s.phi));
    getTarget().copy(target);
    cam.position.setFromSpherical(s).add(target);
    cam.lookAt(target);
    orbit?.update();
    invalidate();
  };

  const goTo = (to: Spherical, target: Vector3, animate: boolean, dur = 450) => {
    if (!animate || reduced) {
      tween.current = null;
      place(to, target);
      return;
    }
    const from = spherical();
    let d = to.theta - from.theta;
    d = ((((d + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
    to.theta = from.theta + d;
    tween.current = { from, to, fromT: getTarget().clone(), toT: target.clone(), t: 0, dur };
    invalidate();
  };

  // Distance limits from the flat and closed frames.
  const limits = useMemo(() => {
    const flat = frameFor(dieline, 0, cam);
    const closed = frameFor(dieline, 1, cam);
    return { min: closed.distance * 0.25, max: Math.max(flat.distance, closed.distance) * 3 };
  }, [dieline, cam]);

  useEffect(() => {
    if (!orbit) return;
    orbit.minDistance = limits.min;
    orbit.maxDistance = limits.max;
  }, [orbit, limits]);

  // Initial framing per structure.
  const framedFor = useRef<string | null>(null);
  useEffect(() => {
    const key = `${dieline.structureCode}:${orbit ? 1 : 0}`;
    const f = frameFor(dieline, progressRef.current, cam);
    if (framedFor.current !== key) {
      framedFor.current = key;
      place(new Spherical(f.distance, DEFAULT_VIEW.phi, DEFAULT_VIEW.theta), f.target);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dieline, orbit]);

  // New fold target (or new size): animate the fold and re-frame.
  useEffect(() => {
    targetRef.current = foldTarget;
    if (autoFit) {
      const f = frameFor(dieline, foldTarget, cam);
      const s = spherical();
      s.radius = f.distance;
      goTo(s, f.target, motion, foldMs * Math.min(1, Math.abs(foldTarget - progressRef.current)) || 300);
    }
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foldTarget, dieline, autoFit]);

  useEffect(() => {
    invalidate();
  }, [artworkVersion, invalidate]);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 1 / 20);
    let busy = false;
    const cur = progressRef.current;
    const tgt = targetRef.current;
    if (cur !== tgt) {
      if (!motion) progressRef.current = tgt;
      else {
        const step = (delta * 1000) / Math.max(1, foldMs);
        progressRef.current = cur < tgt ? Math.min(tgt, cur + step) : Math.max(tgt, cur - step);
      }
      busy = progressRef.current !== tgt;
    }
    const tw = tween.current;
    if (tw) {
      tw.t = Math.min(1, tw.t + (delta * 1000) / tw.dur);
      const e = easeInOutCubic(tw.t);
      const s = new Spherical(
        tw.from.radius + (tw.to.radius - tw.from.radius) * e,
        tw.from.phi + (tw.to.phi - tw.from.phi) * e,
        tw.from.theta + (tw.to.theta - tw.from.theta) * e,
      );
      place(s, tw.fromT.clone().lerp(tw.toT, e));
      if (tw.t >= 1) tween.current = null;
      else busy = true;
    }
    // Idle turntable: eases in after AUTO_ROTATE.idleMs without input; any input pauses it.
    if (autoRotate && !reduced && !busy && !tween.current) {
      const idle = performance.now() - lastInput.current;
      if (idle > AUTO_ROTATE.idleMs) {
        const ramp = easeInOutCubic((idle - AUTO_ROTATE.idleMs) / AUTO_ROTATE.rampMs);
        const s = spherical();
        s.theta += AUTO_ROTATE.degPerSec * DEG * delta * ramp;
        place(s, getTarget().clone());
        busy = true;
      }
    }
    if (busy) invalidate();
  });

  // Track user input for the idle turntable (pointer, wheel, keys, orbit drags, API calls).
  const lastInput = useRef(typeof performance !== "undefined" ? performance.now() : 0);
  const wakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const poke = () => {
    lastInput.current = performance.now();
    if (wakeTimer.current) clearTimeout(wakeTimer.current);
    if (autoRotate && !reduced) wakeTimer.current = setTimeout(() => invalidate(), AUTO_ROTATE.idleMs + 30);
  };
  useEffect(() => {
    const el = gl.domElement;
    const root = el.closest("[role=application]") ?? el;
    const onInput = () => poke();
    root.addEventListener("pointerdown", onInput);
    root.addEventListener("wheel", onInput, { passive: true });
    root.addEventListener("keydown", onInput);
    poke();
    return () => {
      root.removeEventListener("pointerdown", onInput);
      root.removeEventListener("wheel", onInput);
      root.removeEventListener("keydown", onInput);
      if (wakeTimer.current) clearTimeout(wakeTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, autoRotate, reduced]);

  // Imperative API for the outer component.
  useEffect(() => {
    apiRef.current = {
      canvas: gl.domElement,
      rotate(dAz, dPolar = 0) {
        poke();
        tween.current = null;
        const s = spherical();
        s.theta += dAz * DEG;
        s.phi -= dPolar * DEG;
        place(s, getTarget().clone());
      },
      zoom(factor) {
        poke();
        tween.current = null;
        const s = spherical();
        s.radius = Math.min(limits.max, Math.max(limits.min, s.radius * factor));
        place(s, getTarget().clone());
      },
      reset() {
        poke();
        const f = frameFor(dieline, targetRef.current, cam);
        goTo(new Spherical(f.distance, DEFAULT_VIEW.phi, DEFAULT_VIEW.theta), f.target, true);
      },
      setView(view) {
        poke();
        const v = VIEWS[view];
        const f = frameFor(dieline, targetRef.current, cam);
        goTo(new Spherical(f.distance, v.phi, v.theta), f.target, true);
      },
      async screenshot(opts) {
        // make sure the fold state is final before capturing
        return captureScreenshot(gl, scene, cam, opts);
      },
    };
    return () => {
      apiRef.current = null;
    };
  });

  const closedSize = useMemo(() => boundsAt(dieline, 1).getSize(new Vector3()).multiplyScalar(MM), [dieline]);
  const extent = Math.max(closedSize.x, closedSize.z, 0.05);

  return (
    <>
      {stage ? (
        <StudioStage
          {...stage}
          size={{ x: closedSize.x, y: closedSize.y, z: closedSize.z }}
          outerMm={dieline.closedOuter}
          shadows={shadows}
          progressRef={progressRef}
        />
      ) : (
        <>
        <hemisphereLight args={["#ffffff", "#d9d4cc", 0.9]} />
        <directionalLight position={[2.5, 4, 3]} intensity={1.6} />
        <directionalLight position={[-3, 2, -2]} intensity={0.35} />
        <Environment resolution={64} frames={1} environmentIntensity={0.55}>
          <Lightformer form="rect" intensity={2} position={[0, 5, 2]} scale={[8, 4, 1]} />
          <Lightformer form="rect" intensity={1} position={[-5, 1, -1]} rotation-y={Math.PI / 2} scale={[6, 2, 1]} />
          <Lightformer form="rect" intensity={1} position={[5, 1, 1]} rotation-y={-Math.PI / 2} scale={[6, 2, 1]} />
        </Environment>
        {shadows ? (
          <ContactShadows
            position={[0, -0.0005, 0]}
            scale={extent * 4}
            far={Math.max(closedSize.y, extent) * 1.5}
            blur={2.2}
            opacity={0.45}
            resolution={512}
            color="#3a2e22"
          />
        ) : null}
        </>
      )}
      <OrbitControls makeDefault enablePan={false} enableDamping={!reduced} dampingFactor={0.12} rotateSpeed={0.8} />
    </>
  );
}

/**
 * Full 3D viewer: lighting, soft contact shadow, orbit controls, camera framing,
 * fold animation (prefers-reduced-motion aware), keyboard control and screenshot export.
 * Client-only: load it with `PackagingSceneLazy` (next/dynamic, ssr: false).
 */
export function PackagingScene(props: PackagingSceneProps) {
  const {
    dieline,
    artworkTextures,
    material,
    finish,
    printInside,
    castShadow,
    foldProgress,
    animateFold = true,
    foldDurationMs = 1200,
    autoFit = true,
    artworkVersion,
    handleRef,
    ariaLabel = "3D preview of the box",
    roleDescription = "3D viewer",
    keyboardHint = "Arrow keys rotate, plus and minus zoom, 0 resets the view.",
    fallback,
    enableKeyboard = true,
    shadows = true,
    maxDpr,
    className,
    style,
    onReady,
    children,
    surfaceFinish,
    stage,
    autoRotate,
    poster,
  } = props;
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!poster) return;
    // never hide the viewer for long if the first frame is slow or WebGL fails
    const t = setTimeout(() => setReady(true), 4000);
    return () => clearTimeout(t);
  }, [poster]);
  const progressRef = useRef(Math.min(1, Math.max(0, foldProgress)));
  const apiRef = useRef<RigApi | null>(null);
  const hintId = useId();
  const [dprCap] = useState(() => maxDpr ?? defaultMaxDpr());

  useImperativeHandle(
    handleRef,
    (): PackagingSceneHandle => ({
      rotate: (a, p) => apiRef.current?.rotate(a, p),
      zoom: (f) => apiRef.current?.zoom(f),
      reset: () => apiRef.current?.reset(),
      setView: (v) => apiRef.current?.setView(v),
      screenshot: (o) => (apiRef.current ? apiRef.current.screenshot(o) : Promise.reject(new Error("3D view not ready"))),
      getCanvas: () => apiRef.current?.canvas ?? null,
    }),
    [],
  );

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!enableKeyboard || e.altKey || e.ctrlKey || e.metaKey) return;
    const api = apiRef.current;
    if (!api) return;
    const step = e.shiftKey ? 5 : 15;
    switch (e.key) {
      case "ArrowLeft":
        api.rotate(-step);
        break;
      case "ArrowRight":
        api.rotate(step);
        break;
      case "ArrowUp":
        api.rotate(0, step * 0.66);
        break;
      case "ArrowDown":
        api.rotate(0, -step * 0.66);
        break;
      case "+":
      case "=":
        api.zoom(0.85);
        break;
      case "-":
      case "_":
        api.zoom(1 / 0.85);
        break;
      case "0":
      case "Home":
        api.reset();
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  return (
    <div
      className={[styles.viewport, className].filter(Boolean).join(" ")}
      style={style}
      tabIndex={enableKeyboard ? 0 : undefined}
      role="application"
      aria-roledescription={roleDescription}
      aria-label={ariaLabel}
      aria-describedby={hintId}
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
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        camera={{ fov: 30, near: 0.005, far: 60, position: [0.4, 0.35, 0.7] }}
        onCreated={({ gl }) => {
          gl.toneMapping = NeutralToneMapping;
          gl.setClearColor(0x000000, 0);
          onReady?.();
          // reveal after the first frame has been drawn (poster cross-fade)
          requestAnimationFrame(() => requestAnimationFrame(() => setReady(true)));
        }}
        fallback={fallback ?? <div className={styles.fallback}>3D preview is not available on this device.</div>}
      >
        <Rig
          dieline={dieline}
          foldTarget={Math.min(1, Math.max(0, foldProgress))}
          animateFold={animateFold}
          foldDurationMs={foldDurationMs}
          autoFit={autoFit}
          progressRef={progressRef}
          apiRef={apiRef}
          artworkVersion={artworkVersion}
          shadows={shadows}
          stage={stage}
          autoRotate={autoRotate}
        />
        {surfaceFinish ? (
          <FinishedPackagingModel
            dieline={dieline}
            artworkTextures={artworkTextures}
            printInside={printInside}
            castShadow={castShadow}
            foldProgress={progressRef}
            surfaceFinish={surfaceFinish}
          />
        ) : (
          <PackagingModel
            dieline={dieline}
            artworkTextures={artworkTextures}
            material={material}
            finish={finish}
            printInside={printInside}
            castShadow={castShadow}
            foldProgress={progressRef}
          />
        )}
        {children}
      </Canvas>
    </div>
  );
}
