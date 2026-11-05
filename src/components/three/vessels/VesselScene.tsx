"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls } from "@react-three/drei";
import { useEffect, useId, useImperativeHandle, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode, type Ref } from "react";
import { NeutralToneMapping, PerspectiveCamera, Spherical, Vector3 } from "three";
import { defaultMaxDpr, usePrefersReducedMotion } from "../hooks";
import { captureScreenshot } from "../screenshot";
import type { PackagingSceneHandle, ViewName } from "../PackagingScene";
import { VesselModel, type VesselModelProps } from "./VesselModel";
import type { VesselQuality } from "./materials";
import styles from "../PackagingScene.module.css";

/** Same imperative API as the box viewer, so <ViewControls> works unchanged. */
export type VesselSceneHandle = PackagingSceneHandle;

export interface VesselSceneProps extends Omit<VesselModelProps, "quality" | "animate"> {
  /** Closed size of the container incl. closure (mm): width (x), depth (z), height (y). */
  envelope: { width: number; depth: number; height: number };
  /** "auto" (default): low on touch / ≤4-core devices, high elsewhere. */
  quality?: VesselQuality | "auto";
  /** Animations on (default). Off when the user prefers reduced motion. */
  animate?: boolean;
  /** Slow turntable spin until the user interacts. Default false. Never with reduced motion. */
  turntable?: boolean;
  handleRef?: Ref<VesselSceneHandle | null>;
  ariaLabel?: string;
  roleDescription?: string;
  keyboardHint?: string;
  fallback?: ReactNode;
  maxDpr?: number;
  className?: string;
  style?: CSSProperties;
  onReady?: () => void;
  onInteract?: () => void;
}

const DEG = Math.PI / 180;
const DEFAULT_VIEW = { theta: 26 * DEG, phi: 76 * DEG };
const VIEWS: Record<ViewName, { theta: number; phi: number }> = {
  iso: DEFAULT_VIEW,
  front: { theta: 0, phi: 86 * DEG },
  back: { theta: 180 * DEG, phi: 86 * DEG },
  left: { theta: -90 * DEG, phi: 86 * DEG },
  right: { theta: 90 * DEG, phi: 86 * DEG },
  top: { theta: 0, phi: 4 * DEG },
  bottom: { theta: 0, phi: 176 * DEG },
};
const MIN_PHI = 2 * DEG;
const MAX_PHI = 178 * DEG;

function frame(env: { width: number; depth: number; height: number }, camera: PerspectiveCamera) {
  const size = new Vector3(env.width, env.height, env.depth).multiplyScalar(0.001);
  const radius = Math.max(size.length() / 2, 0.01);
  const vfov = camera.fov * DEG;
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
  const fov = Math.min(vfov, hfov);
  return { distance: (radius / Math.sin(fov / 2)) * 1.08, target: new Vector3(0, size.y * 0.47, 0), size };
}

interface RigApi extends Omit<PackagingSceneHandle, "getCanvas"> {
  canvas: HTMLCanvasElement;
}

function Rig({
  envelope,
  apiRef,
  turntable,
  reduced,
  interacted,
  sceneKey,
}: {
  envelope: VesselSceneProps["envelope"];
  apiRef: { current: RigApi | null };
  turntable: boolean;
  reduced: boolean;
  interacted: { current: boolean };
  sceneKey: string;
}) {
  const { camera, gl, scene, invalidate, controls } = useThree();
  const cam = camera as PerspectiveCamera;
  const orbit = controls as unknown as { target: Vector3; update(): void; minDistance: number; maxDistance: number } | null;
  const localTarget = useRef(new Vector3());
  const tween = useRef<{ from: Spherical; to: Spherical; fromT: Vector3; toT: Vector3; t: number; dur: number } | null>(null);
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
  const goTo = (to: Spherical, target: Vector3, animate: boolean, dur = 650) => {
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

  const f = useMemo(() => frame(envelope, cam), [envelope.width, envelope.height, envelope.depth, cam]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!orbit) return;
    orbit.minDistance = f.distance * 0.3;
    orbit.maxDistance = f.distance * 3;
  }, [orbit, f]);

  // new container: fly in from a little further away; same container resized: re-frame
  const framedKey = useRef<string | null>(null);
  useEffect(() => {
    const first = framedKey.current === null;
    const changed = framedKey.current !== sceneKey;
    framedKey.current = sceneKey;
    if (first || changed) {
      if (!reduced) place(new Spherical(f.distance * 1.45, DEFAULT_VIEW.phi - 10 * DEG, DEFAULT_VIEW.theta - 50 * DEG), f.target);
      goTo(new Spherical(f.distance, DEFAULT_VIEW.phi, DEFAULT_VIEW.theta), f.target, true, 1100);
    } else {
      const s = spherical();
      s.radius = f.distance;
      goTo(s, f.target, true, 500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneKey, f, orbit]);

  useFrame((_, raw) => {
    const delta = Math.min(raw, 1 / 20);
    let busy = false;
    const tw = tween.current;
    if (tw) {
      tw.t = Math.min(1, tw.t + (delta * 1000) / tw.dur);
      const e = 1 - Math.pow(1 - tw.t, 3);
      place(
        new Spherical(tw.from.radius + (tw.to.radius - tw.from.radius) * e, tw.from.phi + (tw.to.phi - tw.from.phi) * e, tw.from.theta + (tw.to.theta - tw.from.theta) * e),
        tw.fromT.clone().lerp(tw.toT, e),
      );
      if (tw.t >= 1) tween.current = null;
      else busy = true;
    } else if (turntable && !reduced && !interacted.current) {
      const s = spherical();
      s.theta += delta * 0.35;
      place(s, getTarget().clone());
      busy = true;
    }
    if (busy) invalidate();
  });

  useEffect(() => {
    apiRef.current = {
      canvas: gl.domElement,
      rotate(dAz, dPolar = 0) {
        interacted.current = true;
        tween.current = null;
        const s = spherical();
        s.theta += dAz * DEG;
        s.phi -= dPolar * DEG;
        place(s, getTarget().clone());
      },
      zoom(factor) {
        interacted.current = true;
        tween.current = null;
        const s = spherical();
        s.radius = Math.min(f.distance * 3, Math.max(f.distance * 0.3, s.radius * factor));
        place(s, getTarget().clone());
      },
      reset() {
        goTo(new Spherical(f.distance, DEFAULT_VIEW.phi, DEFAULT_VIEW.theta), f.target, true);
      },
      setView(view) {
        interacted.current = true;
        const v = VIEWS[view];
        goTo(new Spherical(f.distance, v.phi, v.theta), f.target, true);
      },
      screenshot: (opts) => captureScreenshot(gl, scene, cam, opts),
    };
    return () => {
      apiRef.current = null;
    };
  });

  const extent = Math.max(f.size.x, f.size.z, 0.04);
  return (
    <>
      <ambientLight intensity={0.25} />
      <directionalLight position={[2.5, 4, 3]} intensity={1.4} />
      <directionalLight position={[-3, 2.2, -2]} intensity={0.45} color="#dfe8ff" />
      {/* studio softboxes: two tall strips give glass its long highlights */}
      <Environment resolution={256} frames={1} environmentIntensity={0.9}>
        <Lightformer form="rect" intensity={3} position={[-2.2, 1.2, 1.6]} rotation-y={Math.PI / 4} scale={[0.6, 4, 1]} />
        <Lightformer form="rect" intensity={2.2} position={[2.4, 1.2, 1.2]} rotation-y={-Math.PI / 3} scale={[0.5, 4, 1]} />
        <Lightformer form="rect" intensity={1.6} position={[0, 4, 0]} rotation-x={Math.PI / 2} scale={[4, 4, 1]} />
        <Lightformer form="rect" intensity={0.8} position={[0, 0.6, -3]} scale={[6, 1.5, 1]} color="#ffeedd" />
        <Lightformer form="ring" intensity={1.2} position={[1.5, 2.5, 3]} scale={0.8} />
      </Environment>
      <ContactShadows position={[0, -0.0004, 0]} scale={extent * 5} far={Math.max(f.size.y, extent)} blur={2.6} opacity={0.42} resolution={512} color="#2b2620" />
      <OrbitControls makeDefault enablePan={false} enableDamping={!reduced} dampingFactor={0.1} rotateSpeed={0.75} onStart={() => (interacted.current = true)} />
    </>
  );
}

/**
 * 3D viewer for bottles, jars, cans, tins, pouches and tubes: studio lighting, contact shadow,
 * orbit + keyboard controls, framing, animations (prefers-reduced-motion aware), screenshots.
 * Client-only: load with `VesselSceneLazy`.
 */
export function VesselScene(props: VesselSceneProps) {
  const {
    envelope,
    quality = "auto",
    animate = true,
    turntable = false,
    handleRef,
    ariaLabel = "3D preview of the container",
    roleDescription = "3D viewer",
    keyboardHint = "Arrow keys rotate, plus and minus zoom, 0 resets the view.",
    fallback,
    maxDpr,
    className,
    style,
    onReady,
    onInteract,
    ...model
  } = props;
  const reduced = usePrefersReducedMotion();
  const apiRef = useRef<RigApi | null>(null);
  const hintId = useId();
  const [dprCap] = useState(() => maxDpr ?? defaultMaxDpr());
  const [autoQuality] = useState<VesselQuality>(() => (defaultMaxDpr() < 2 ? "low" : "high"));
  const q: VesselQuality = quality === "auto" ? autoQuality : quality;
  const interacted = useRef(false);

  useImperativeHandle(
    handleRef,
    (): VesselSceneHandle => ({
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
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const api = apiRef.current;
    if (!api) return;
    const step = e.shiftKey ? 5 : 15;
    const map: Record<string, () => void> = {
      ArrowLeft: () => api.rotate(-step),
      ArrowRight: () => api.rotate(step),
      ArrowUp: () => api.rotate(0, step * 0.66),
      ArrowDown: () => api.rotate(0, -step * 0.66),
      "+": () => api.zoom(0.85),
      "=": () => api.zoom(0.85),
      "-": () => api.zoom(1 / 0.85),
      _: () => api.zoom(1 / 0.85),
      "0": () => api.reset(),
      Home: () => api.reset(),
    };
    const fn = map[e.key];
    if (!fn) return;
    fn();
    onInteract?.();
    e.preventDefault();
  };

  const sceneKey = `${model.kind}`;
  return (
    <div
      className={[styles.viewport, className].filter(Boolean).join(" ")}
      style={style}
      tabIndex={0}
      role="application"
      aria-roledescription={roleDescription}
      aria-label={ariaLabel}
      aria-describedby={hintId}
      onKeyDown={onKeyDown}
      onPointerDown={() => {
        interacted.current = true;
        onInteract?.();
      }}
      dir="ltr"
    >
      <span id={hintId} className={styles.hint}>
        {keyboardHint}
      </span>
      <Canvas
        className={styles.canvas}
        frameloop="demand"
        dpr={[1, dprCap]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance", localClippingEnabled: true } as never}
        camera={{ fov: 28, near: 0.005, far: 40, position: [0.3, 0.25, 0.6] }}
        onCreated={({ gl }) => {
          gl.toneMapping = NeutralToneMapping;
          gl.localClippingEnabled = true;
          gl.setClearColor(0x000000, 0);
          onReady?.();
        }}
        fallback={fallback ?? <div className={styles.fallback}>3D preview is not available on this device.</div>}
      >
        <Rig envelope={envelope} apiRef={apiRef} turntable={turntable} reduced={reduced} interacted={interacted} sceneKey={sceneKey} />
        <VesselModel {...model} quality={q} animate={animate && !reduced} />
      </Canvas>
    </div>
  );
}
