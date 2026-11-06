"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  Color,
  Mesh,
  MeshBasicMaterial,
  MeshDepthMaterial,
  OrthographicCamera,
  PlaneGeometry,
  ShaderMaterial,
  WebGLRenderTarget,
  type Group,
  type Object3D,
  type Scene,
  type WebGLProgramParametersWithUniforms,
} from "three";

/**
 * Soft contact shadow for product shots (owner: 3D engine). Same look as drei's ContactShadows
 * (depth from below, two-pass gaussian blur) plus a tight contact layer that grounds the base,
 * with three differences that matter for performance:
 *
 *  - It re-renders only when something in the scene MOVED (fold, model swap, vessel animation),
 *    detected with a cheap matrix signature. Orbiting the camera, zooming and finish crossfades
 *    reuse the cached shadow, so an orbit frame costs one scene pass instead of four.
 *  - Render targets are allocated once and survive model switches (the plane and the shadow
 *    camera are rescaled instead), so switching models never allocates GPU memory.
 *  - Everything it allocates is disposed on unmount.
 *
 * Objects with `userData.noContactShadow = true` (tables, shelves) are hidden from the depth pass.
 */
export interface SoftShadowProps {
  /** Side of the square shadow area (metres). */
  scale: number;
  /** Height above the floor that still casts (metres). */
  far: number;
  /** Opacity of the wide soft shadow. Default 0.5. */
  opacity?: number;
  /** Blur of the wide shadow (drei units). Default 2.4. */
  blur?: number;
  /** Opacity of the tight contact layer (0 = off). Default 0.55. */
  contactOpacity?: number;
  /** Shadow tint (warm dark reads more natural than black on paper). */
  color?: string;
  /** Render-target size. Default 256 (blurred anyway; 512 costs 4× the fill). */
  resolution?: number;
  /** Floor height (metres). */
  y?: number;
}

const BLUR_VS = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
// 9-tap gaussian (same weights as three-stdlib's Horizontal/VerticalBlurShader), direction as a uniform.
const BLUR_FS = /* glsl */ `
uniform sampler2D tDiffuse; uniform vec2 dir; varying vec2 vUv;
void main() {
  vec4 s = vec4(0.0);
  s += texture2D(tDiffuse, vUv - 4.0 * dir) * 0.051;
  s += texture2D(tDiffuse, vUv - 3.0 * dir) * 0.0918;
  s += texture2D(tDiffuse, vUv - 2.0 * dir) * 0.12245;
  s += texture2D(tDiffuse, vUv - 1.0 * dir) * 0.1531;
  s += texture2D(tDiffuse, vUv) * 0.1633;
  s += texture2D(tDiffuse, vUv + 1.0 * dir) * 0.1531;
  s += texture2D(tDiffuse, vUv + 2.0 * dir) * 0.12245;
  s += texture2D(tDiffuse, vUv + 3.0 * dir) * 0.0918;
  s += texture2D(tDiffuse, vUv + 4.0 * dir) * 0.051;
  gl_FragColor = s;
}`;

function makeDepthMaterial(color: Color) {
  const m = new MeshDepthMaterial();
  m.depthTest = m.depthWrite = false;
  m.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.ucolor = { value: color };
    shader.fragmentShader = shader.fragmentShader
      .replace("void main() {", "uniform vec3 ucolor;\nvoid main() {")
      // darker close to the floor, fading with height
      .replace("vec4( vec3( 1.0 - fragCoordZ ), opacity );", "vec4( ucolor * fragCoordZ * 2.0, ( 1.0 - fragCoordZ ) );");
  };
  return m;
}

/** Sum of every visible mesh's world matrix (weighted), geometry id and draw range: changes iff something moved. */
function sceneSignature(root: Object3D, skip: Object3D): number {
  let sig = 0;
  let k = 1;
  root.traverseVisible((o) => {
    if (o === skip || o.userData.noContactShadow) return;
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    const e = mesh.matrixWorld.elements;
    for (let i = 0; i < 16; i++) sig += e[i] * (k + i * 0.618);
    sig += (mesh.geometry?.id ?? 0) * 0.001 * k;
    k += 1.37;
  });
  return sig;
}

export function SoftShadow({ scale, far, opacity = 0.5, blur = 2.4, contactOpacity = 0.55, color = "#2e241a", resolution = 256, y = -0.0005 }: SoftShadowProps) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene) as Scene;
  const invalidate = useThree((s) => s.invalidate);
  const group = useRef<Group>(null);

  const res = useMemo(() => {
    const rt = () => {
      const t = new WebGLRenderTarget(resolution, resolution);
      t.texture.generateMipmaps = false;
      return t;
    };
    const tint = new Color(color);
    const blurMat = new ShaderMaterial({ uniforms: { tDiffuse: { value: null }, dir: { value: [0, 0] } }, vertexShader: BLUR_VS, fragmentShader: BLUR_FS, depthTest: false });
    const quadGeo = new PlaneGeometry(2, 2);
    const quad = new Mesh(quadGeo, blurMat);
    quad.frustumCulled = false;
    const quadCam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    quad.position.z = -0.5;
    return {
      wide: rt(),
      contact: rt(),
      scratch: rt(),
      depth: makeDepthMaterial(tint),
      tint,
      blurMat,
      quad,
      quadGeo,
      quadCam,
      planeGeo: new PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      wideMat: new MeshBasicMaterial({ transparent: true, depthWrite: false }),
      contactMat: new MeshBasicMaterial({ transparent: true, depthWrite: false }),
      cam: new OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0, 1),
    };
  }, [resolution]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(
    () => () => {
      for (const d of [res.wide, res.contact, res.scratch, res.depth, res.blurMat, res.quadGeo, res.planeGeo, res.wideMat, res.contactMat]) d.dispose();
    },
    [res],
  );
  useEffect(() => {
    res.tint.set(color);
    res.wideMat.map = res.wide.texture;
    res.contactMat.map = res.contact.texture;
  }, [res, color]);
  useEffect(() => {
    res.wideMat.opacity = opacity;
    res.contactMat.opacity = contactOpacity;
    res.wideMat.needsUpdate = res.contactMat.needsUpdate = true;
    invalidate();
  }, [res, opacity, contactOpacity, invalidate]);

  const lastSig = useRef(NaN);
  const lastKey = useRef("");

  const blurPass = (src: WebGLRenderTarget, amount: number) => {
    const px = amount / 256;
    res.blurMat.uniforms.tDiffuse.value = src.texture;
    res.blurMat.uniforms.dir.value = [px, 0];
    gl.setRenderTarget(res.scratch);
    gl.render(res.quad, res.quadCam);
    res.blurMat.uniforms.tDiffuse.value = res.scratch.texture;
    res.blurMat.uniforms.dir.value = [0, px];
    gl.setRenderTarget(src);
    gl.render(res.quad, res.quadCam);
  };

  const renderLayer = (target: WebGLRenderTarget, height: number, blurs: number[]) => {
    const cam = res.cam;
    const h = scale / 2;
    cam.left = -h;
    cam.right = h;
    cam.top = h;
    cam.bottom = -h;
    cam.near = 0;
    cam.far = height;
    cam.updateProjectionMatrix();
    gl.setRenderTarget(target);
    gl.clear();
    gl.render(scene, cam);
    for (const b of blurs) blurPass(target, b);
  };

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    scene.updateMatrixWorld();
    const sig = sceneSignature(scene, g);
    const key = `${scale}:${far}:${blur}:${resolution}:${y}`;
    if (sig === lastSig.current && key === lastKey.current) return;
    lastSig.current = sig;
    lastKey.current = key;

    // Camera looking straight up from the floor.
    res.cam.position.set(0, y, 0);
    res.cam.rotation.set(Math.PI / 2, 0, 0);
    res.cam.updateMatrixWorld();

    const hidden: Object3D[] = [];
    scene.traverseVisible((o) => {
      if (o.userData.noContactShadow) hidden.push(o);
    });
    for (const o of hidden) o.visible = false;
    g.visible = false;
    const prevOverride = scene.overrideMaterial;
    const prevBg = scene.background;
    const prevTarget = gl.getRenderTarget();
    const prevClearAlpha = gl.getClearAlpha();
    const prevClear = new Color();
    gl.getClearColor(prevClear);
    gl.setClearColor(0x000000, 0);
    scene.overrideMaterial = res.depth;
    scene.background = null;
    renderLayer(res.wide, far, [blur, blur * 0.4]);
    if (contactOpacity > 0) renderLayer(res.contact, Math.max(far * 0.12, 0.004), [0.6, 0.3]);
    scene.overrideMaterial = prevOverride;
    scene.background = prevBg;
    gl.setRenderTarget(prevTarget);
    gl.setClearColor(prevClear, prevClearAlpha);
    g.visible = true;
    for (const o of hidden) o.visible = true;
    // A change may still be settling this frame (other frame callbacks run after this one).
    invalidate();
  });

  return (
    <group ref={group} position={[0, y, 0]}>
      {/* shadow camera looks up, so its image is mirrored on z */}
      <mesh geometry={res.planeGeo} material={res.wideMat} scale={[scale, 1, -scale]} renderOrder={-1} />
      {contactOpacity > 0 ? <mesh geometry={res.planeGeo} material={res.contactMat} scale={[scale, 1, -scale]} position={[0, 0.00005, 0]} renderOrder={-1} /> : null}
    </group>
  );
}
