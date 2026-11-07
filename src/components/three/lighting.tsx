"use client";

import { Lightformer } from "@react-three/drei";
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal, useThree } from "@react-three/fiber";
import { BackSide, Color, CubeCamera, DataTexture, HalfFloatType, LinearFilter, NoColorSpace, RGBAFormat, PMREMGenerator, Scene, ShaderMaterial, SphereGeometry, Vector3, WebGLCubeRenderTarget, type DirectionalLight, type WebGLRenderer } from "three";

/**
 * Studio lighting for packaging product shots (owner: 3D engine).
 *
 * Rig (classic three-point product set, all generated in the scene: no HDRI files):
 *  - key: warm-neutral directional from front-left-high, shapes the box (lit / mid / shade faces),
 *  - fill: cool sky / warm floor hemisphere, keeps shadow sides readable (never black),
 *  - rim: cool directional from back-right, separates the silhouette from the background,
 *  - environment: a light grey sweep (vertical gradient, like a photo table, so metals and gloss
 *    always have something bright to reflect; a black world turns foil brown) with an overhead softbox and two tall strip lights. The strips are
 *    what draws the long highlights on foil, spot UV and gloss lamination.
 *
 * The environment is rendered once into a 256 px cube map. It is memoised: the cube camera
 * re-renders whenever drei's <Environment> children change identity, so an unmemoised parent
 * would redraw six faces on every React update (e.g. each artwork edit).
 */

/** Cyclorama: bright top, mid-grey horizon, darker floor (linear, before tone mapping). */
function Cyclorama({ top, horizon, bottom }: { top: string; horizon: string; bottom: string }) {
  const { geo, mat } = useMemo(() => {
    const geo = new SphereGeometry(40, 32, 16);
    const mat = new ShaderMaterial({
      side: BackSide,
      depthWrite: false,
      uniforms: { top: { value: new Color(top) }, horizon: { value: new Color(horizon) }, bottom: { value: new Color(bottom) } },
      vertexShader: /* glsl */ `varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; varying vec3 vDir;
        void main() {
          float y = vDir.y;
          vec3 c = y > 0.0 ? mix(horizon, top, smoothstep(0.0, 0.85, y)) : mix(horizon, bottom, smoothstep(0.0, 0.5, -y));
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    return { geo, mat };
  }, [top, horizon, bottom]);
  useEffect(() => () => (geo.dispose(), mat.dispose()), [geo, mat]);
  return <mesh geometry={geo} material={mat} />;
}

/**
 * Environment map from a small in-scene light set (owner: 3D engine). Same idea as drei's
 * <Environment> with children (render a virtual scene into a cube once, prefilter it for PBR), but
 * it owns the prefiltered (PMREM) target. With drei, three prefilters the cube render target
 * internally and never frees that copy (its cache only listens for disposal of non-render-target
 * textures): +2 textures / framebuffers (~7 MB) on every mount. Harmless while the canvas dies
 * with its scene, a leak once contents swap inside one shared EngineCanvas. Here both the cube
 * target and the PMREM target are disposed on unmount.
 */
/** One prefilter generator per renderer: its blur shaders compile once, not on every content swap. */
const PMREMS = new WeakMap<WebGLRenderer, PMREMGenerator>();
function pmremFor(gl: WebGLRenderer): PMREMGenerator {
  let g = PMREMS.get(gl);
  if (!g) PMREMS.set(gl, (g = new PMREMGenerator(gl)));
  return g;
}

export function EnvironmentScene({ resolution = 256, intensity = 1, children }: { resolution?: number; intensity?: number; children: ReactNode }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);
  const [virtual] = useState(() => new Scene());
  const fbo = useMemo(() => new WebGLCubeRenderTarget(resolution, { type: HalfFloatType }), [resolution]);
  const cubeCam = useMemo(() => new CubeCamera(0.1, 1000, fbo), [fbo]);
  useEffect(() => () => fbo.dispose(), [fbo]);
  // children are committed into the virtual scene before this layout effect runs
  useLayoutEffect(() => {
    const autoClear = gl.autoClear;
    gl.autoClear = true;
    cubeCam.update(gl, virtual);
    gl.autoClear = autoClear;
    const target = pmremFor(gl).fromCubemap(fbo.texture);
    const prev = scene.environment;
    const prevIntensity = scene.environmentIntensity;
    scene.environment = target.texture;
    scene.environmentIntensity = intensity;
    invalidate();
    return () => {
      if (scene.environment === target.texture) scene.environment = prev;
      scene.environmentIntensity = prevIntensity;
      target.dispose();
    };
  }, [gl, scene, virtual, fbo, cubeCam, intensity, invalidate]);
  return createPortal(<>{children}</>, virtual);
}

export interface StudioEnvironmentProps {
  /** Overall strength of reflections (default 1). */
  intensity?: number;
  /** Cube map size. Default 256 (sharp enough for gloss, cheap to render once). */
  resolution?: number;
}

/**
 * Diffuser falloff for a softbox (64 px, shared): a bright plateau that rolls off over the outer
 * ~35 % like the fabric of a real softbox, so reflections on gloss and the broad highlight on
 * matte board have soft edges instead of the hard rectangle of a flat emissive card.
 */
let softboxTex: DataTexture | null = null;
function softboxMap(): DataTexture {
  if (softboxTex) return softboxTex;
  const n = 64;
  const data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const u = Math.abs((x + 0.5) / n - 0.5) * 2;
      const v = Math.abs((y + 0.5) / n - 0.5) * 2;
      const r = Math.pow(Math.pow(u, 4) + Math.pow(v, 4), 0.25); // superellipse: rounded corners
      const t = Math.min(1, Math.max(0, (1 - r) / 0.35));
      const a = Math.round(255 * t * t * (3 - 2 * t) * (0.9 + 0.1 * (1 - r)));
      const i = (y * n + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = a;
      data[i + 3] = 255;
    }
  softboxTex = new DataTexture(data, n, n, RGBAFormat);
  softboxTex.colorSpace = NoColorSpace;
  softboxTex.magFilter = softboxTex.minFilter = LinearFilter;
  softboxTex.needsUpdate = true;
  return softboxTex;
}

/** The whole light set turns ~18° off the camera axis (a three-quarter studio, not a flat front rig). */
const ENV_TURN = (18 * Math.PI) / 180;

/** Softbox environment for reflections (foil, gloss, spot UV). Rendered once. */
export const StudioEnvironment = memo(function StudioEnvironment({ intensity = 1, resolution = 256 }: StudioEnvironmentProps) {
  const soft = softboxMap();
  return (
    <EnvironmentScene resolution={resolution} intensity={0.42 * intensity}>
      <Cyclorama top="#a8a8a8" horizon="#8a8a8a" bottom="#77716a" />
      <group rotation-y={ENV_TURN}>
      {/* overhead softbox */}
      <Lightformer form="rect" map={soft} intensity={3.1} position={[0, 5, 0.5]} rotation-x={Math.PI / 2} scale={[7, 5, 1]} />
      {/* key strip front-left: the long highlight that sells foil and gloss */}
      <Lightformer form="rect" map={soft} intensity={4.6} position={[-3.2, 1.6, 2.8]} rotation-y={Math.PI / 4} scale={[1.2, 5, 1]} />
      {/* rim strip back-right */}
      <Lightformer form="rect" map={soft} intensity={2.6} position={[3.4, 1.4, -2.2]} rotation-y={(-3 * Math.PI) / 4} scale={[1, 4, 1]} />
      {/* front fill card, and a tall front-right softbox (R4-CR-10): most light on a vertical face
          comes from this environment, where the overhead softbox only reaches the lid. Without them
          the sides of dark prints sat at 35 % of the lid's luminance. */}
      <Lightformer form="rect" map={soft} intensity={2.6} position={[0, 1, 5]} scale={[10, 3, 1]} />
      <Lightformer form="rect" map={soft} intensity={3.5} position={[4.2, 1.2, 2.6]} rotation-y={Math.PI / 3} scale={[3, 4, 1]} />
      <Lightformer form="rect" map={soft} intensity={1.4} position={[5, 0.6, -0.4]} rotation-y={Math.PI / 2} scale={[4, 3, 1]} />
      {/* floor bounce (R4-L01): a white sweep under the product lights down-facing faces, so a
          tilted underside reads as the same board one to two stops down, not near black */}
      <Lightformer form="rect" intensity={1.6} color="#f3ede4" position={[0, -3.2, 0.6]} rotation-x={-Math.PI / 2} scale={[8, 6, 1]} />
      {/* small round kicker: a crisp specular dot on metals */}
      <Lightformer form="circle" intensity={3} position={[2.6, 3, 3]} scale={0.8} />
      </group>
    </EnvironmentScene>
  );
});

/** Key light direction (front-left-high), normalised. */
const KEY_DIR = new Vector3(-2.4, 4.2, 3.2).normalize();

/**
 * The key light. With `shadowRadius` (metres, bounding radius of the model) it casts real soft
 * shadows: flaps shade the walls under them, an open box is darker inside, and every fold reads
 * as depth instead of one flat colour. The shadow camera is fitted to the model so the map's
 * texels stay well under a millimetre.
 */
function KeyLight({ intensity, shadowRadius }: { intensity: number; shadowRadius: number }) {
  const ref = useRef<DirectionalLight>(null);
  const invalidate = useThree((s) => s.invalidate);
  const r = Math.max(0.02, shadowRadius);
  useLayoutEffect(() => {
    const l = ref.current;
    if (!l) return;
    l.position.copy(KEY_DIR).multiplyScalar(r * 4);
    l.target.position.set(0, r * 0.3, 0);
    l.target.updateMatrixWorld();
    const cam = l.shadow.camera;
    cam.left = -r;
    cam.right = r;
    cam.top = r;
    cam.bottom = -r;
    cam.near = r * 0.5;
    cam.far = r * 8;
    cam.updateProjectionMatrix();
    l.shadow.needsUpdate = true;
    invalidate();
  }, [r, invalidate]);
  return (
    <directionalLight
      ref={ref}
      intensity={2.3 * intensity}
      color="#fff8ee"
      castShadow={shadowRadius > 0}
      shadow-mapSize-width={2048}
      shadow-mapSize-height={2048}
      shadow-radius={3}
      shadow-bias={-0.0002}
      shadow-normalBias={Math.max(0.0004, r * 0.002)}
    />
  );
}

/** Direct lights of the studio rig. `shadowRadius` (metres) turns on the key light's shadows. */
export const StudioLights = memo(function StudioLights({ intensity = 1, shadowRadius = 0 }: { intensity?: number; shadowRadius?: number }) {
  return (
    <>
      <hemisphereLight args={["#f4f6ff", "#e6dccd", 0.3 * intensity]} />
      <KeyLight intensity={intensity} shadowRadius={shadowRadius} />
      {/* front-right fill (R4-CR-10): keeps the side faces of dark prints at >= 55 % of the lid's
          luminance (measured with docs/audit/tools/3d-luminance.cjs); was 0.35, side faces 35 % */}
      <directionalLight position={[3, 1.6, 2.4]} intensity={0.45 * intensity} color="#f2f5ff" />
      <directionalLight position={[2.6, 2.4, -3.4]} intensity={0.55 * intensity} color="#e4ecff" />
    </>
  );
});

/** Direct lights + environment, the default set behind every box viewer. */
export const StudioLighting = memo(function StudioLighting({ intensity = 1, shadowRadius = 0 }: { intensity?: number; shadowRadius?: number }) {
  return (
    <>
      <StudioLights intensity={intensity} shadowRadius={shadowRadius} />
      <StudioEnvironment intensity={intensity} />
    </>
  );
});
