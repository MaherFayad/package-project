"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type Ref } from "react";
import { PerspectiveCamera, Raycaster, Spherical, Vector2, Vector3, type DirectionalLight, type Group, type Object3D } from "three";
import { MAT_INSIDE, MAT_OUTSIDE } from "./boardMaterials";
import { boundsAt, maxStage, type DielineModel } from "@/lib/dieline";
import { BOX_BOARD_CODES, type BoxBoardCode, type ConfigFinishCode } from "@/lib/configurator";
import { usePrefersReducedMotion } from "./hooks";
import { MM, PackagingModel, type PackagingModelProps } from "./PackagingModel";
import { captureScreenshot, type ScreenshotOptions } from "./screenshot";
import type { PhotoRenderOptions, PhotoRenderResult } from "./photoRender";
import { setHighlight } from "./pickHighlight";
import { FinishedPackagingModel, type SurfaceFinishProps } from "./finishes/FinishedPackagingModel";
import { StudioStage, type StageOptions } from "./finishes/StudioStage";
import { AUTO_ROTATE, easeInOutCubic, easeOutQuint } from "./finishes/motion";
import { StudioLighting } from "./lighting";
import { SoftShadow } from "./SoftShadow";
import { LiveAOAuto } from "./LiveAO";
import { InteractionDpr, useOnScreen } from "./perf";
import { applyViewInsets, normInsets, sameInsets, visibleFraction, NO_INSETS, type FitInsets } from "./fit";
import { EngineCanvas, useRegisterViewApi, type EngineToneMapping, type EngineViewApi, type PickHit, type ViewName } from "./EngineCanvas";

export type { ViewName, PickHit } from "./EngineCanvas";
export type { FitInsets } from "./fit";

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
  /** Report an overlay covering part of the canvas (px); the fit frames the model in the rest. ViewControls calls this itself. */
  setFitInsets?(insets: FitInsets | null): void;
  /** The printed board under a viewport point (client px): panel, surface and sheet mm. */
  pickAt?(clientX: number, clientY: number): PickHit | null;
  /** The box model's root object (3D export). */
  getModel?(): Object3D | null;
  /** Glow the given panels' printed surface (hover / drop target); null clears it. */
  highlight?(panelIds: readonly string[] | null, surface?: "outside" | "inside"): void;
  /** Path-traced studio image of the box (falls back to a supersampled screenshot on weak GPUs). */
  renderPhoto?(opts?: PhotoRenderOptions): Promise<PhotoRenderResult>;
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
  /** Canvas area (px) covered by overlays you render on top (a toolbar, a badge): the camera fits the model in the rest. */
  fitInsets?: FitInsets;
  /**
   * Tone mapping. Default "neutral" (Khronos PBR Neutral): keeps printed colours close to their
   * sRGB values (what a brand approves), unlike ACES / AgX which shift hue and saturation.
   */
  toneMapping?: EngineToneMapping;
  /** Tone-mapping exposure. Default 1. */
  exposure?: number;
}



type RigApi = EngineViewApi;

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

/** Legacy whole-surface finish codes → configurator coatings (masked ones need artwork masks). */
const LEGACY_COATING: Partial<Record<string, ConfigFinishCode>> = {
  MATTE_LAMINATION: "MATTE_LAMINATION",
  GLOSS_LAMINATION: "GLOSS_LAMINATION",
  SOFT_TOUCH_LAMINATION: "SOFT_TOUCH_LAMINATION",
  VARNISH: "GLOSS_VARNISH",
};

/** Frame margin: the subject fills ~75 % of the frame (leaves room for the view toolbar) (product-shot convention). */
const FRAME_MARGIN = 1.3;
const FLAT = 0.02;
/** Fold progress below which a model counts as open (lids and flaps up) for the hero view. */
const OPEN_BELOW = 0.97;
const OPEN_PHI = 50 * DEG;

/** Hero view for a model: cylinders (rolled tubes) are shot nearer the front so centred copy is not on the silhouette. */
export function heroView(dieline: DielineModel, progress: number): { theta: number; phi: number } {
  if (progress < FLAT) return VIEWS.front; // a die-cut blank is shown face-on, like a dieline proof
  // part-folded (open lid, flaps up): look down a little more so the inside of the box shows
  const phi = progress < OPEN_BELOW ? OPEN_PHI : DEFAULT_VIEW.phi;
  const base = dieline.panels.some((p) => p.hingeKind === "roll") ? { theta: 18 * DEG, phi } : { theta: DEFAULT_VIEW.theta, phi };
  // Open on printed board (FF-15): when neither front nor right is a print face (FEFCO 09 liners,
  // dividers and pads print the side that goes against the host wall), turn the 3/4 view to the
  // largest printed side wall, so the first frame shows the artwork, not the blank side.
  const f = dieline.faces;
  if (!f || f.front || f.right) return base;
  const sides: [keyof typeof f, number][] = [
    ["back", 180 * DEG],
    ["left", -90 * DEG],
  ];
  let best: number | null = null;
  let area = 0;
  for (const [k, az] of sides) {
    const info = f[k];
    if (info && info.width * info.height > area) {
      area = info.width * info.height;
      best = az;
    }
  }
  return best === null ? base : { theta: best + base.theta, phi: base.phi };
}

/** Identity of a model for re-framing: library variants share a core structureCode, so add the panel set. */
export function modelKey(dieline: DielineModel): string {
  let h = 0;
  for (const p of dieline.panels) for (let i = 0; i < p.id.length; i++) h = (Math.imul(h, 31) + p.id.charCodeAt(i)) | 0;
  return `${dieline.structureCode}:${dieline.panels.length}:${h}`;
}

/**
 * Distance + look-at target that frame the box at a fold progress, seen from `view`. Fits the
 * projected bounding box (8 corners) rather than its bounding sphere, which left long or flat
 * models at a third of the frame.
 */
function frameFor(dieline: DielineModel, progress: number, camera: PerspectiveCamera, view: { theta: number; phi: number } = heroView(dieline, progress)) {
  const size = boundsAt(dieline, progress).getSize(new Vector3()).multiplyScalar(MM);
  const box = size.clone();
  // the scale reference can (StudioStage, +x side of the box) is part of the framed set
  if (camera.userData.elbaWithCan) {
    const extra = 2 * REF_CAN.r + Math.max(0.02, Math.max(box.x, box.z) * 0.12);
    size.x += extra;
    size.y = Math.max(size.y, REF_CAN.h);
    size.z = Math.max(size.z, 2 * REF_CAN.r);
  }
  const target = new Vector3((size.x - box.x) / 2, size.y / 2, 0);
  // overlays (toolbar) shrink the usable frame: fit inside the visible rectangle (CR-13)
  const fr = (camera.userData.elbaFit as { fx: number; fy: number } | undefined) ?? { fx: 1, fy: 1 };
  const tanV = Math.tan((camera.fov * DEG) / 2) * fr.fy;
  const tanH = Math.tan((camera.fov * DEG) / 2) * camera.aspect * fr.fx;
  const dir = new Vector3().setFromSphericalCoords(1, view.phi, view.theta);
  const right = new Vector3().crossVectors(new Vector3(0, 1, 0), dir);
  if (right.lengthSq() < 1e-8) right.set(1, 0, 0);
  right.normalize();
  const up = new Vector3().crossVectors(dir, right).normalize();
  let distance = 0.02;
  const c = new Vector3();
  for (const sx of [-0.5, 0.5])
    for (const sy of [-0.5, 0.5])
      for (const sz of [-0.5, 0.5]) {
        c.set(sx * size.x, sy * size.y, sz * size.z);
        const z = c.dot(dir);
        const need = z + Math.max(Math.abs(c.dot(right)) / tanH, Math.abs(c.dot(up)) / tanV) * FRAME_MARGIN;
        distance = Math.max(distance, need);
      }
  return { distance, target, size: box };
}

/** Size of StudioStage's reference can (keep in sync with CAN_R / CAN_H there), metres. */
const REF_CAN = { r: 0.0331, h: 0.1152 };

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
  fitInsets,
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
  fitInsets?: FitInsets;
}) {
  const { camera, gl, scene, invalidate, controls } = useThree();
  const size = useThree((s) => s.size);
  const regress = useThree((s) => s.performance.regress);
  const reduced = usePrefersReducedMotion();
  const cam = camera as PerspectiveCamera;
  const orbit = controls as unknown as { target: Vector3; update(): void; minDistance: number; maxDistance: number } | null;
  const localTarget = useRef(new Vector3());
  const tween = useRef<Tween | null>(null);
  const targetRef = useRef(foldTarget);
  /** Eased fold: from → to over `dur` ms (easeInOutCubic), so a fold starts and lands softly. */
  const foldTween = useRef<{ from: number; to: number; t: number; dur: number } | null>(null);
  const onScreen = useOnScreen(gl.domElement);
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

  // Visible rectangle: insets from props (fitInsets) and from overlays that report themselves
  // (ViewControls → handle.setFitInsets). Shift the projection centre and re-fit the distance.
  const [apiInsets, setApiInsets] = useState<Required<FitInsets>>(NO_INSETS);
  const insets = useMemo(() => normInsets(fitInsets, apiInsets), [fitInsets, apiInsets]);
  const appliedInsets = useRef<Required<FitInsets> | null>(null);
  // The scale-reference can is framed with the box (frameFor reads this flag); re-fit on toggle.
  const withCan = stage?.context === "reference";
  const appliedCan = useRef<boolean | null>(null);
  useLayoutEffect(() => {
    cam.userData.elbaWithCan = withCan;
    const prev = appliedCan.current;
    appliedCan.current = withCan;
    if (prev !== null && prev !== withCan && autoFit) {
      const s = spherical();
      const f = frameFor(dieline, targetRef.current, cam, { theta: s.theta, phi: s.phi });
      s.radius = f.distance;
      goTo(s, f.target, true, 400);
    }
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cam, withCan]);
  useLayoutEffect(() => {
    applyViewInsets(cam, size, insets);
    cam.userData.elbaFit = visibleFraction(size, insets);
    cam.updateProjectionMatrix();
    const prev = appliedInsets.current;
    appliedInsets.current = insets;
    if (prev && !sameInsets(prev, insets) && autoFit) {
      const s = spherical();
      const f = frameFor(dieline, targetRef.current, cam, { theta: s.theta, phi: s.phi });
      s.radius = f.distance;
      goTo(s, f.target, true, 300);
    }
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cam, size.width, size.height, insets]);

  // Distance limits from the flat and closed frames.
  const limits = useMemo(() => {
    const flat = frameFor(dieline, 0, cam);
    const closed = frameFor(dieline, 1, cam);
    return { min: closed.distance * 0.25, max: Math.max(flat.distance, closed.distance) * 3 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dieline, cam, withCan]);

  useEffect(() => {
    if (!orbit) return;
    orbit.minDistance = limits.min;
    orbit.maxDistance = limits.max;
  }, [orbit, limits]);

  // Framing. First mount (and when the orbit controls attach): place the camera. Another
  // structure: glide (eased) back to the 3/4 hero view framed for it. Same structure with a new
  // fold target or size: keep the user's angle, ease the distance.
  const framedFor = useRef<{ code: string; orbit: boolean } | null>(null);
  useEffect(() => {
    targetRef.current = foldTarget;
    const from = progressRef.current;
    if (from !== foldTarget) {
      foldTween.current = motion ? { from, to: foldTarget, t: 0, dur: Math.max(250, foldMs * Math.abs(foldTarget - from)) } : null;
      if (!motion) progressRef.current = foldTarget;
    }
    const prev = framedFor.current;
    const key = modelKey(dieline);
    framedFor.current = { code: key, orbit: !!orbit };
    const hero = heroView(dieline, foldTarget);
    if (!prev || prev.orbit !== !!orbit) {
      const start = motion ? from : foldTarget;
      const v0 = heroView(dieline, start);
      const f = frameFor(dieline, start, cam, v0);
      place(new Spherical(f.distance, v0.phi, v0.theta), f.target);
      if (autoFit && motion && from !== foldTarget) {
        const g = frameFor(dieline, foldTarget, cam, hero);
        goTo(new Spherical(g.distance, hero.phi, hero.theta), g.target, true, foldMs * Math.abs(foldTarget - from));
      }
    } else if (prev.code !== key) {
      const f = frameFor(dieline, foldTarget, cam, hero);
      goTo(new Spherical(f.distance, hero.phi, hero.theta), f.target, motion, 700);
    } else if (autoFit) {
      const dur = Math.max(350, foldMs * Math.min(1, Math.abs(foldTarget - from)));
      if (from < FLAT !== foldTarget < FLAT) {
        // flat ↔ folded: swing between the face-on proof view and the 3/4 hero view
        const f = frameFor(dieline, foldTarget, cam, hero);
        goTo(new Spherical(f.distance, hero.phi, hero.theta), f.target, motion, dur);
      } else {
        const s = spherical();
        const f = frameFor(dieline, foldTarget, cam, { theta: s.theta, phi: s.phi });
        s.radius = f.distance;
        goTo(s, f.target, motion, dur);
      }
    }
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foldTarget, dieline, autoFit, orbit]);

  useEffect(() => {
    invalidate();
  }, [artworkVersion, invalidate]);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 1 / 20);
    let busy = false;
    const ft = foldTween.current;
    if (ft) {
      ft.t = Math.min(1, ft.t + (delta * 1000) / ft.dur);
      progressRef.current = ft.from + (ft.to - ft.from) * easeInOutCubic(ft.t);
      if (ft.t >= 1) {
        progressRef.current = ft.to;
        foldTween.current = null;
      } else busy = true;
    } else if (progressRef.current !== targetRef.current) {
      progressRef.current = targetRef.current;
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
    // Off-screen or hidden viewers do not spin (no frames, no battery).
    if (autoRotate && !reduced && !busy && !tween.current && onScreen.current) {
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
  // resume the turntable when the viewer scrolls back into view
  useEffect(() => onScreen.subscribe(() => invalidate()), [onScreen, invalidate]);

  // Imperative API for the outer component.
  useEffect(() => {
    apiRef.current = {
      canvas: gl.domElement,
      rotate(dAz, dPolar = 0) {
        poke();
        regress();
        tween.current = null;
        const s = spherical();
        s.theta += dAz * DEG;
        s.phi -= dPolar * DEG;
        place(s, getTarget().clone());
      },
      zoom(factor) {
        poke();
        regress();
        tween.current = null;
        const s = spherical();
        s.radius = Math.min(limits.max, Math.max(limits.min, s.radius * factor));
        place(s, getTarget().clone());
      },
      reset() {
        poke();
        const v = heroView(dieline, targetRef.current);
        const f = frameFor(dieline, targetRef.current, cam, v);
        goTo(new Spherical(f.distance, v.phi, v.theta), f.target, true, 600);
      },
      setView(view) {
        poke();
        const v = VIEWS[view];
        const f = frameFor(dieline, targetRef.current, cam, v);
        goTo(new Spherical(f.distance, v.phi, v.theta), f.target, true, 600);
      },
      async screenshot(opts) {
        return captureScreenshot(gl, scene, cam, opts);
      },
      setFitInsets(i) {
        setApiInsets(i ? normInsets(i) : NO_INSETS);
      },
      pickAt(clientX, clientY) {
        const rect = gl.domElement.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;
        const ndc = new Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
        const ray = new Raycaster();
        ray.setFromCamera(ndc, cam);
        for (const hit of ray.intersectObjects(scene.children, true)) {
          const panelId = hit.object.userData?.panelId as string | undefined;
          if (!panelId) continue;
          const slot = hit.face?.materialIndex;
          // cut edges carry a flute tile, not sheet UVs: look at the next surface behind
          if (!hit.uv || (slot !== MAT_OUTSIDE && slot !== MAT_INSIDE)) continue;
          return {
            panelId,
            surface: slot === MAT_INSIDE ? "inside" : "outside",
            sheet: { x: hit.uv.x * dieline.sheet.width, y: (1 - hit.uv.y) * dieline.sheet.height },
          };
        }
        return null;
      },
      getModel() {
        let found: Object3D | null = null;
        scene.traverse((o) => {
          if (!found && o.userData?.elbaModel) found = o;
        });
        return found;
      },
      highlight(ids, surface = "outside") {
        setHighlight(scene, ids, surface);
        invalidate();
      },
      async renderPhoto(opts = {}) {
        let model = null as Object3D | null;
        scene.traverse((o) => {
          if (!model && o.userData?.elbaModel) model = o;
        });
        if (!model) throw new Error("3D view not ready");
        // the path tracer (and this module) load only when a photo render is asked for
        const photo = await import("./photoRender");
        try {
          return await photo.renderPhoto(model, cam, opts);
        } catch (e) {
          if (photo.isAbortError(e)) throw e;
          console.warn("[elba] photo render unavailable, using the supersampled screenshot", e);
          const t0 = performance.now();
          const studio = opts.background !== "transparent";
          const blob = await captureScreenshot(gl, scene, cam, { width: opts.width ?? 1600, height: opts.height ?? 1200, supersample: 2, background: studio ? (opts.backdrop ?? "#efeeeb") : null });
          return { blob, samples: 0, ms: Math.round(performance.now() - t0), fallback: true };
        }
      },
    };
    return () => {
      apiRef.current = null;
    };
  });

  const closedSize = useMemo(() => boundsAt(dieline, 1).getSize(new Vector3()).multiplyScalar(MM), [dieline]);
  const flatSize = useMemo(() => boundsAt(dieline, 0).getSize(new Vector3()).multiplyScalar(MM), [dieline]);
  // the shadow area covers the flat sheet too, so unfolding never clips it
  const extent = Math.max(closedSize.x, closedSize.z, flatSize.x * 0.6, flatSize.z * 0.6, 0.05);
  // key-light shadow camera: covers the model at any fold (the flat sheet included)
  const shadowRadius = 0.55 * Math.max(closedSize.length(), flatSize.length(), 0.05);

  return (
    <>
      {stage ? (
        <StudioStage
          {...stage}
          size={{ x: closedSize.x, y: closedSize.y, z: closedSize.z }}
          outerMm={dieline.closedOuter}
          shadowRadius={shadowRadius}
          shadows={shadows}
          progressRef={progressRef}
        />
      ) : (
        <>
          <StudioLighting shadowRadius={shadows ? shadowRadius : 0} />
          {shadows ? <SoftShadow scale={extent * 4} far={Math.max(closedSize.y, extent) * 1.5} blur={2.4} opacity={0.5} contactOpacity={0.55} /> : null}
        </>
      )}
      {/* ambient occlusion (creases, inside of open boxes) on desktop-class GPUs; see LiveAO.tsx */}
      {shadows ? <LiveAOAuto radius={Math.min(0.09, Math.max(0.01, 0.2 * Math.max(closedSize.x, closedSize.y, closedSize.z)))} /> : null}
      <OrbitControls makeDefault enablePan={false} enableDamping={!reduced} dampingFactor={0.12} rotateSpeed={0.8} regress />
      <InteractionDpr />
    </>
  );
}

/**
 * Eased swap-in when the structure changes: the new model grows from 94 % with a soft landing
 * (280 ms) instead of popping. Skipped under reduced motion and on first mount.
 */
function SwapIn({ swapKey, children }: { swapKey: string; children: ReactNode }) {
  const ref = useRef<Group>(null);
  const reduced = usePrefersReducedMotion();
  const invalidate = useThree((s) => s.invalidate);
  const anim = useRef<{ key: string; t: number } | null>(null);
  useEffect(() => {
    const first = anim.current === null;
    anim.current = { key: swapKey, t: first || reduced ? 1 : 0 };
    invalidate();
  }, [swapKey, reduced, invalidate]);
  useFrame((_, dt) => {
    const a = anim.current;
    const g = ref.current;
    if (!a || !g || a.t >= 1) return;
    a.t = Math.min(1, a.t + Math.min(dt, 1 / 20) / 0.28);
    const s = 0.94 + 0.06 * easeOutQuint(a.t);
    g.scale.setScalar(s);
    if (a.t < 1) invalidate();
  });
  return <group ref={ref}>{children}</group>;
}

/** Props of the scene content (everything except the canvas / wrapper props). */
export type PackagingSceneContentProps = Omit<
  PackagingSceneProps,
  "ariaLabel" | "roleDescription" | "keyboardHint" | "fallback" | "enableKeyboard" | "maxDpr" | "className" | "style" | "onReady" | "poster" | "toneMapping" | "exposure"
>;

/**
 * The box scene without its own canvas: rig, lights, contact shadow, orbit controls, fold and
 * framing, the model. Render it inside `<EngineCanvas>` (that is what `PackagingScene` does);
 * `handleRef` and the canvas keyboard both reach it.
 */
export function PackagingSceneContent(props: PackagingSceneContentProps) {
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
    shadows = true,
    children,
    surfaceFinish,
    stage,
    autoRotate,
    fitInsets,
  } = props;
  const progressRef = useRef(Math.min(1, Math.max(0, foldProgress)));
  const apiRef = useRef<RigApi | null>(null);
  useRegisterViewApi(apiRef);
  // Every configurator board renders through the finished-board materials (kraft grain and
  // fibre relief, ink on kraft, real flute / liner edges) even before a finish is chosen, so the
  // very first render already reads as printed board, not a flat-coloured block (CR-15).
  const finish0 = finish && finish !== "NONE" ? LEGACY_COATING[finish] : null;
  const boardFinish = useMemo<SurfaceFinishProps | undefined>(() => {
    if (surfaceFinish || typeof material !== "string" || !(BOX_BOARD_CODES as readonly string[]).includes(material)) return undefined;
    if (finish && finish !== "NONE" && !finish0) return undefined; // masked legacy finish: keep the legacy look
    return { board: material as BoxBoardCode, finishes: finish0 ? [{ code: finish0 }] : [] };
  }, [surfaceFinish, material, finish, finish0]);
  const effectiveFinish = surfaceFinish ?? boardFinish;
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  useLayoutEffect(() => {
    if (camera.fov !== 30) {
      camera.fov = 30;
      camera.updateProjectionMatrix();
    }
  }, [camera]);

  useImperativeHandle(
    handleRef,
    (): PackagingSceneHandle => ({
      rotate: (a, p) => apiRef.current?.rotate(a, p),
      zoom: (f) => apiRef.current?.zoom(f),
      reset: () => apiRef.current?.reset(),
      setView: (v) => apiRef.current?.setView(v),
      screenshot: (o) => (apiRef.current ? apiRef.current.screenshot(o) : Promise.reject(new Error("3D view not ready"))),
      getCanvas: () => apiRef.current?.canvas ?? null,
      setFitInsets: (i) => apiRef.current?.setFitInsets?.(i),
      pickAt: (x, y) => apiRef.current?.pickAt?.(x, y) ?? null,
      getModel: () => apiRef.current?.getModel?.() ?? null,
      highlight: (ids, s) => apiRef.current?.highlight?.(ids, s),
      renderPhoto: (o) => (apiRef.current?.renderPhoto ? apiRef.current.renderPhoto(o) : Promise.reject(new Error("3D view not ready"))),
    }),
    [],
  );

  return (
    <>
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
        fitInsets={fitInsets}
      />
      <SwapIn swapKey={modelKey(dieline)}>
        {effectiveFinish ? (
          <FinishedPackagingModel
            dieline={dieline}
            artworkTextures={artworkTextures}
            printInside={printInside}
            castShadow={castShadow}
            foldProgress={progressRef}
            surfaceFinish={effectiveFinish}
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
      </SwapIn>
      <FoilSweep active={!!effectiveFinish?.finishes.some((f) => f.code.startsWith("FOIL_"))} sweepKey={`${modelKey(dieline)}|${effectiveFinish?.finishes.map((f) => f.code).join(",") ?? ""}`} />
      {children}
    </>
  );
}

/**
 * R4-CR-10: one soft light sweep across the model when it carries hot foil, so the foil reads as
 * metal (a highlight travels over it) instead of flat ochre ink. Runs once, 1.5 s, after the model
 * or its finishes change and the view has been still for 0.6 s; never loops (WCAG 2.2.2) and is
 * skipped under prefers-reduced-motion (WCAG 2.3.3). The light stays mounted at zero intensity so
 * toggling it never recompiles the board shaders.
 */
function FoilSweep({ active, sweepKey }: { active: boolean; sweepKey: string }) {
  const light = useRef<DirectionalLight>(null);
  const reduced = usePrefersReducedMotion();
  const invalidate = useThree((s) => s.invalidate);
  const state = useRef<{ key: string; t: number } | null>(null);
  useEffect(() => {
    if (!active || reduced) {
      state.current = null;
      if (light.current) light.current.intensity = 0;
      invalidate();
      return;
    }
    // start after a short settle (fold / camera tweens land first)
    state.current = { key: sweepKey, t: -0.6 };
    invalidate();
  }, [active, reduced, sweepKey, invalidate]);
  useFrame((_, dt) => {
    const s = state.current;
    const l = light.current;
    if (!s || !l) return;
    s.t += Math.min(dt, 0.05);
    const p = s.t / 1.5;
    if (p >= 1) {
      l.intensity = 0;
      state.current = null;
      invalidate();
      return;
    }
    if (p > 0) {
      // a front-left to front-right arc above the model; intensity eases in and out
      const a = (-0.9 + 1.8 * p) * Math.PI * 0.5;
      l.position.set(Math.sin(a) * 3, 2.6, Math.cos(a) * 3);
      l.intensity = 1.6 * Math.sin(Math.PI * p);
    }
    invalidate();
  });
  return <directionalLight ref={light} intensity={0} position={[0, 2.6, 3]} color="#fffaf0" />;
}

/**
 * Full 3D viewer: lighting, soft contact shadow, orbit controls, camera framing,
 * fold animation (prefers-reduced-motion aware), keyboard control and screenshot export.
 * Client-only: load it with `PackagingSceneLazy` (next/dynamic, ssr: false).
 * Equivalent to `<EngineCanvas …><PackagingSceneContent …/></EngineCanvas>`.
 */
export function PackagingScene(props: PackagingSceneProps) {
  const {
    ariaLabel = "3D preview of the box",
    roleDescription,
    keyboardHint,
    fallback,
    enableKeyboard,
    maxDpr,
    className,
    style,
    onReady,
    poster,
    toneMapping,
    exposure,
    ...content
  } = props;
  return (
    <EngineCanvas
      ariaLabel={ariaLabel}
      roleDescription={roleDescription}
      keyboardHint={keyboardHint}
      fallback={fallback}
      enableKeyboard={enableKeyboard}
      maxDpr={maxDpr}
      className={className}
      style={style}
      onReady={onReady}
      poster={poster}
      toneMapping={toneMapping}
      exposure={exposure}
    >
      <PackagingSceneContent {...content} />
    </EngineCanvas>
  );
}
