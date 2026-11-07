"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { CustomBlending, DstColorFactor, OneFactor, ShaderMaterial, ZeroFactor, AddEquation, type WebGLRenderer } from "three";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass.js";

/**
 * Ambient occlusion for the live box view (owner: 3D engine).
 *
 * three's own GTAO (no extra dependency) computed at half resolution from a normal/depth pass,
 * denoised, then multiplied over the normally rendered frame. The frame itself keeps the
 * canvas's MSAA, tone mapping and transparent background: no float beauty target, no output
 * pass. AO is applied in display space (after tone mapping), which reads the same at these
 * strengths and costs one fullscreen multiply.
 *
 * What it adds: the inside of an open box darkens toward its corners, flaps and lids shade the
 * walls they meet, creases read as creases. Off on phones, low-core machines and software GL
 * (see `liveAoSupported`); the frameloop stays on demand, so an idle view costs nothing.
 */

/** Whether this renderer should run live AO: desktop-class GPU only. */
export function liveAoSupported(gl: WebGLRenderer): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (new URLSearchParams(window.location.search).has("noao")) return false;
  } catch {
    /* ignore */
  }
  if (window.matchMedia?.("(pointer: coarse)").matches) return false;
  if ((navigator.hardwareConcurrency ?? 4) <= 4) return false;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (mem !== undefined && mem < 4) return false;
  try {
    const ctx = gl.getContext();
    const info = ctx.getExtension("WEBGL_debug_renderer_info");
    const name = String(info ? ctx.getParameter(info.UNMASKED_RENDERER_WEBGL) : ctx.getParameter(ctx.RENDERER));
    if (/swiftshader|llvmpipe|software|basic render/i.test(name)) return false;
  } catch {
    /* unknown renderer: keep AO */
  }
  return true;
}

/** Multiplies the AO buffer over the frame already on screen; alpha is left as it is. */
function multiplyMaterial() {
  return new ShaderMaterial({
    uniforms: { tAO: { value: null }, intensity: { value: 1 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tAO; uniform float intensity; varying vec2 vUv;
      void main() { float ao = texture2D(tAO, vUv).r; gl_FragColor = vec4(vec3(mix(1.0, ao, intensity)), 1.0); }`,
    depthTest: false,
    depthWrite: false,
    transparent: true,
    blending: CustomBlending,
    blendEquation: AddEquation,
    blendSrc: DstColorFactor,
    blendDst: ZeroFactor,
    blendEquationAlpha: AddEquation,
    blendSrcAlpha: ZeroFactor,
    blendDstAlpha: OneFactor,
  });
}

/** AO buffer at CSS-pixel resolution: half the drawing buffer on 2x screens, full size at 1x. */
const aoScale = (dpr: number) => Math.min(1, 1 / Math.max(1, dpr));

/**
 * Mount inside the canvas to render the scene with AO. `radius` is the occlusion reach in metres
 * (scale it with the model: ~8 % of its size). Takes over rendering (useFrame priority 1).
 */
export function LiveAO({ radius, intensity = 0.9 }: { radius: number; intensity?: number }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);
  const invalidate = useThree((s) => s.invalidate);

  const res = useMemo(() => {
    const pass = new GTAOPass(scene, camera, 64, 64);
    pass.output = GTAOPass.OUTPUT.Off;
    const mat = multiplyMaterial();
    mat.uniforms.tAO.value = pass.pdRenderTarget.texture;
    return { pass, mat, quad: new FullScreenQuad(mat) };
  }, [scene, camera]);
  useEffect(
    () => () => {
      res.pass.dispose();
      res.mat.dispose();
      res.quad.dispose();
    },
    [res],
  );

  useEffect(() => {
    const k = dpr * aoScale(dpr);
    res.pass.setSize(Math.max(1, Math.round(size.width * k)), Math.max(1, Math.round(size.height * k)));
    invalidate();
  }, [res, size.width, size.height, dpr, invalidate]);

  useEffect(() => {
    res.pass.updateGtaoMaterial({ radius, distanceExponent: 1.4, thickness: radius * 0.6, scale: 1.15, samples: 12, distanceFallOff: 1, screenSpaceRadius: false });
    res.pass.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, radiusExponent: 1, rings: 2, samples: 12 });
    res.mat.uniforms.intensity.value = intensity;
    invalidate();
  }, [res, radius, intensity, invalidate]);

  useFrame(() => {
    gl.setRenderTarget(null);
    gl.render(scene, camera);
    // the normal / depth pass must not redraw the key light's 2048 px shadow map
    const autoShadow = gl.shadowMap.autoUpdate;
    gl.shadowMap.autoUpdate = false;
    try {
      res.pass.render(gl, null as never, null as never, 0, false);
    } finally {
      gl.shadowMap.autoUpdate = autoShadow;
    }
    const autoClear = gl.autoClear;
    gl.autoClear = false;
    gl.setRenderTarget(null);
    res.quad.render(gl);
    gl.autoClear = autoClear;
  }, 1);

  return null;
}

/** `LiveAO` where the device can afford it (decided once per renderer), nothing elsewhere. */
export function LiveAOAuto({ radius }: { radius: number }) {
  const gl = useThree((s) => s.gl);
  const on = useMemo(() => liveAoSupported(gl), [gl]);
  return on ? <LiveAO radius={radius} /> : null;
}
