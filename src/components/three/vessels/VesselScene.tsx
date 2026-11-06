"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { Lightformer, OrbitControls } from "@react-three/drei";
import { memo, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type Ref } from "react";
import { PerspectiveCamera, Spherical, Vector3, type Object3D } from "three";
import { defaultMaxDpr, usePrefersReducedMotion } from "../hooks";
import { AUTO_ROTATE, easeInOutCubic } from "../finishes/motion";
import { captureScreenshot } from "../screenshot";
import { SoftShadow } from "../SoftShadow";
import { EnvironmentScene } from "../lighting";
import { InteractionDpr, useOnScreen } from "../perf";
import type { PackagingSceneHandle } from "../PackagingScene";
import { EngineCanvas, useRegisterViewApi, type EngineViewApi, type ViewName } from "../EngineCanvas";
import { VesselModel, type VesselModelProps } from "./VesselModel";
import type { VesselQuality } from "./materials";

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
  /** Added by 3D integration: draw this object (metres, standing on y = 0) instead of the container model (flexible packs). */
  customObject?: Object3D | null;
  /** Image (e.g. the model thumbnail) shown until the first compiled frame, then cross-faded (X-11). */
  poster?: string;
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

type RigApi = EngineViewApi;

function Rig({
  envelope,
  apiRef,
  turntable,
  reduced,
  interacted,
  sceneKey,
  onKeyboard,
}: {
  envelope: VesselSceneProps["envelope"];
  apiRef: { current: RigApi | null };
  turntable: boolean;
  reduced: boolean;
  interacted: { current: boolean };
  sceneKey: string;
  onKeyboard?: () => void;
}) {
  const { camera, gl, scene, invalidate, controls } = useThree();
  const regress = useThree((s) => s.performance.regress);
  const onScreen = useOnScreen(gl.domElement);
  useEffect(() => onScreen.subscribe(() => invalidate()), [onScreen, invalidate]);
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

  const lastInput = useRef(typeof performance !== "undefined" ? performance.now() : 0);
  const wake = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (wake.current && clearTimeout(wake.current)), []);
  useFrame((_, raw) => {
    const delta = Math.min(raw, 1 / 20);
    let busy = false;
    if (interacted.current) {
      interacted.current = false;
      lastInput.current = performance.now();
      if (wake.current) clearTimeout(wake.current);
      if (turntable && !reduced) wake.current = setTimeout(() => invalidate(), AUTO_ROTATE.idleMs + 30);
    }
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
    } else if (turntable && !reduced && onScreen.current) {
      // Same idle turntable as the box viewer: starts after AUTO_ROTATE.idleMs without input,
      // eases in, pauses on any input and resumes once idle again (WCAG 2.2.2).
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

  useEffect(() => {
    apiRef.current = {
      canvas: gl.domElement,
      onKeyboard,
      rotate(dAz, dPolar = 0) {
        interacted.current = true;
        regress();
        tween.current = null;
        const s = spherical();
        s.theta += dAz * DEG;
        s.phi -= dPolar * DEG;
        place(s, getTarget().clone());
      },
      zoom(factor) {
        interacted.current = true;
        regress();
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
      <VesselLights />
      <SoftShadow scale={extent * 5} far={Math.max(f.size.y, extent)} blur={2.6} opacity={0.45} contactOpacity={0.5} color="#2b2620" />
      <OrbitControls makeDefault enablePan={false} enableDamping={!reduced} dampingFactor={0.1} rotateSpeed={0.75} onStart={() => (interacted.current = true)} regress />
      <InteractionDpr />
    </>
  );
}

/** Studio softboxes tuned for glass and metal (two tall strips give glass its long highlights). Memoised: see lighting.tsx. */
const VesselLights = memo(function VesselLights() {
  return (
    <>
      <ambientLight intensity={0.25} />
      <directionalLight position={[2.5, 4, 3]} intensity={1.4} />
      <directionalLight position={[-3, 2.2, -2]} intensity={0.45} color="#dfe8ff" />
      <EnvironmentScene resolution={256} intensity={0.9}>
        <color attach="background" args={["#202020"]} />
        <Lightformer form="rect" intensity={3} position={[-2.2, 1.2, 1.6]} rotation-y={Math.PI / 4} scale={[0.6, 4, 1]} />
        <Lightformer form="rect" intensity={2.2} position={[2.4, 1.2, 1.2]} rotation-y={-Math.PI / 3} scale={[0.5, 4, 1]} />
        <Lightformer form="rect" intensity={1.6} position={[0, 4, 0]} rotation-x={Math.PI / 2} scale={[4, 4, 1]} />
        <Lightformer form="rect" intensity={0.8} position={[0, 0.6, -3]} scale={[6, 1.5, 1]} color="#ffeedd" />
        <Lightformer form="ring" intensity={1.2} position={[1.5, 2.5, 3]} scale={0.8} />
        {/* broad front fill: tinplate and aluminium need something bright to mirror (V-13) */}
        <Lightformer form="rect" intensity={0.8} position={[0, 1, 5]} scale={[10, 3, 1]} />
      </EnvironmentScene>
    </>
  );
});

/** Props of the vessel scene content (everything except the canvas / wrapper props). */
export type VesselSceneContentProps = Omit<VesselSceneProps, "ariaLabel" | "roleDescription" | "keyboardHint" | "fallback" | "maxDpr" | "className" | "style" | "onReady" | "poster">;

/**
 * The container scene without its own canvas (render it inside `<EngineCanvas>`, as
 * `VesselScene` does). `handleRef` and the canvas keyboard both reach it.
 */
export function VesselSceneContent(props: VesselSceneContentProps) {
  const { envelope, quality = "auto", animate = true, turntable = false, handleRef, onInteract, customObject, ...model } = props;
  const reduced = usePrefersReducedMotion();
  const apiRef = useRef<RigApi | null>(null);
  const [autoQuality] = useState<VesselQuality>(() => (defaultMaxDpr() < 2 ? "low" : "high"));
  const q: VesselQuality = quality === "auto" ? autoQuality : quality;
  const interacted = useRef(false);
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  useLayoutEffect(() => {
    if (camera.fov !== 28) {
      camera.fov = 28;
      camera.updateProjectionMatrix();
    }
  }, [camera]);
  // pointer input on the viewer pauses the turntable
  const onInteractRef = useRef(onInteract);
  onInteractRef.current = onInteract;
  useEffect(() => {
    const root = gl.domElement.closest("[role=application]") ?? gl.domElement;
    const on = () => {
      interacted.current = true;
      onInteractRef.current?.();
      invalidate();
    };
    root.addEventListener("pointerdown", on);
    return () => root.removeEventListener("pointerdown", on);
  }, [gl, invalidate]);

  useRegisterViewApi(apiRef);
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

  const sceneKey = `${model.kind}`;
  return (
    <>
      <Rig envelope={envelope} apiRef={apiRef} turntable={turntable} reduced={reduced} interacted={interacted} sceneKey={sceneKey} onKeyboard={() => onInteractRef.current?.()} />
      {customObject ? <primitive object={customObject} /> : <VesselModel {...model} quality={q} animate={animate && !reduced} />}
    </>
  );
}

/**
 * 3D viewer for bottles, jars, cans, tins, pouches and tubes: studio lighting, contact shadow,
 * orbit + keyboard controls, framing, animations (prefers-reduced-motion aware), screenshots.
 * Client-only: load with `VesselSceneLazy`. Equivalent to `<EngineCanvas><VesselSceneContent/></EngineCanvas>`.
 */
export function VesselScene(props: VesselSceneProps) {
  const { ariaLabel = "3D preview of the container", roleDescription, keyboardHint, fallback, maxDpr, className, style, onReady, poster, ...content } = props;
  return (
    <EngineCanvas
      ariaLabel={ariaLabel}
      roleDescription={roleDescription}
      keyboardHint={keyboardHint}
      fallback={fallback}
      maxDpr={maxDpr}
      className={className}
      style={style}
      onReady={onReady}
      poster={poster}
    >
      <VesselSceneContent {...content} />
    </EngineCanvas>
  );
}
