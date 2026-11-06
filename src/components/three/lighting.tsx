"use client";

import { Environment, Lightformer } from "@react-three/drei";
import { memo, useEffect, useMemo } from "react";
import { BackSide, Color, ShaderMaterial, SphereGeometry } from "three";

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

export interface StudioEnvironmentProps {
  /** Overall strength of reflections (default 1). */
  intensity?: number;
  /** Cube map size. Default 256 (sharp enough for gloss, cheap to render once). */
  resolution?: number;
}

/** Softbox environment for reflections (foil, gloss, spot UV). Rendered once. */
export const StudioEnvironment = memo(function StudioEnvironment({ intensity = 1, resolution = 256 }: StudioEnvironmentProps) {
  return (
    <Environment resolution={resolution} frames={1} environmentIntensity={0.7 * intensity}>
      <Cyclorama top="#a8a8a8" horizon="#8a8a8a" bottom="#77716a" />
      {/* overhead softbox */}
      <Lightformer form="rect" intensity={2.6} position={[0, 5, 0.5]} rotation-x={Math.PI / 2} scale={[7, 5, 1]} />
      {/* key strip front-left: the long highlight that sells foil and gloss */}
      <Lightformer form="rect" intensity={4} position={[-3.2, 1.6, 2.8]} rotation-y={Math.PI / 4} scale={[1.2, 5, 1]} />
      {/* rim strip back-right */}
      <Lightformer form="rect" intensity={2.2} position={[3.4, 1.4, -2.2]} rotation-y={(-3 * Math.PI) / 4} scale={[1, 4, 1]} />
      {/* front fill card */}
      <Lightformer form="rect" intensity={0.9} position={[0, 1, 5]} scale={[10, 3, 1]} />
      {/* small round kicker: a crisp specular dot on metals */}
      <Lightformer form="circle" intensity={3} position={[2.6, 3, 3]} scale={0.8} />
    </Environment>
  );
});

/** Direct lights of the studio rig. */
export const StudioLights = memo(function StudioLights({ intensity = 1 }: { intensity?: number }) {
  return (
    <>
      <hemisphereLight args={["#f4f6ff", "#e6dccd", 0.35 * intensity]} />
      <directionalLight position={[-2.4, 4.2, 3.2]} intensity={1.25 * intensity} color="#fff8ee" />
      <directionalLight position={[3, 1.6, 2.4]} intensity={0.35 * intensity} color="#f2f5ff" />
      <directionalLight position={[2.6, 2.4, -3.4]} intensity={0.55 * intensity} color="#e4ecff" />
    </>
  );
});

/** Direct lights + environment, the default set behind every box viewer. */
export const StudioLighting = memo(function StudioLighting({ intensity = 1 }: { intensity?: number }) {
  return (
    <>
      <StudioLights intensity={intensity} />
      <StudioEnvironment intensity={intensity} />
    </>
  );
});
