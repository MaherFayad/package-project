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
import { boundsAt, type DielineModel } from "@/lib/dieline";
import { defaultMaxDpr, usePrefersReducedMotion } from "./hooks";
import { MM, PackagingModel, type PackagingModelProps } from "./PackagingModel";
import { captureScreenshot, type ScreenshotOptions } from "./screenshot";
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
}) {
  const { camera, gl, scene, invalidate, controls } = useThree();
  const reduced = usePrefersReducedMotion();
  const cam = camera as PerspectiveCamera;
  const orbit = controls as unknown as { target: Vector3; update(): void; minDistance: number; maxDistance: number } | null;
  const localTarget = useRef(new Vector3());
  const tween = useRef<Tween | null>(null);
  const targetRef = useRef(foldTarget);
  const motion = animateFold && !reduced;

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
      goTo(s, f.target, motion, foldDurationMs * Math.min(1, Math.abs(foldTarget - progressRef.current)) || 300);
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
        const step = (delta * 1000) / Math.max(1, foldDurationMs);
        progressRef.current = cur < tgt ? Math.min(tgt, cur + step) : Math.max(tgt, cur - step);
      }
      busy = progressRef.current !== tgt;
    }
    const tw = tween.current;
    if (tw) {
      tw.t = Math.min(1, tw.t + (delta * 1000) / tw.dur);
      const e = tw.t * tw.t * (3 - 2 * tw.t);
      const s = new Spherical(
        tw.from.radius + (tw.to.radius - tw.from.radius) * e,
        tw.from.phi + (tw.to.phi - tw.from.phi) * e,
        tw.from.theta + (tw.to.theta - tw.from.theta) * e,
      );
      place(s, tw.fromT.clone().lerp(tw.toT, e));
      if (tw.t >= 1) tween.current = null;
      else busy = true;
    }
    if (busy) invalidate();
  });

  // Imperative API for the outer component.
  useEffect(() => {
    apiRef.current = {
      canvas: gl.domElement,
      rotate(dAz, dPolar = 0) {
        tween.current = null;
        const s = spherical();
        s.theta += dAz * DEG;
        s.phi -= dPolar * DEG;
        place(s, getTarget().clone());
      },
      zoom(factor) {
        tween.current = null;
        const s = spherical();
        s.radius = Math.min(limits.max, Math.max(limits.min, s.radius * factor));
        place(s, getTarget().clone());
      },
      reset() {
        const f = frameFor(dieline, targetRef.current, cam);
        goTo(new Spherical(f.distance, DEFAULT_VIEW.phi, DEFAULT_VIEW.theta), f.target, true);
      },
      setView(view) {
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
  } = props;
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
      <Canvas
        className={styles.canvas}
        frameloop="demand"
        dpr={[1, dprCap]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        camera={{ fov: 30, near: 0.005, far: 60, position: [0.4, 0.35, 0.7] }}
        onCreated={({ gl }) => {
          gl.toneMapping = NeutralToneMapping;
          gl.setClearColor(0x000000, 0);
          onReady?.();
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
        />
        <PackagingModel
          dieline={dieline}
          artworkTextures={artworkTextures}
          material={material}
          finish={finish}
          printInside={printInside}
          castShadow={castShadow}
          foldProgress={progressRef}
        />
        {children}
      </Canvas>
    </div>
  );
}
