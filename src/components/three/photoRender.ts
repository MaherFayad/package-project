import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  Group,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  NeutralToneMapping,
  NoBlending,
  NoColorSpace,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  RectAreaLight,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  type Camera,
  type Texture,
} from "three";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass.js";

/**
 * "Photo render": a path-traced studio shot of the live box (three-gpu-pathtracer, loaded on
 * demand). The live model is cloned into an offscreen scene with its own lights and paper
 * materials (soft area key + fill, gradient studio sky, a ground that catches a soft shadow),
 * so the live view, its materials and its renderer are never touched.
 *
 * Backgrounds:
 *  - "studio": a light seamless backdrop, rendered as is (opaque PNG).
 *  - "transparent": the box on a see-through PNG with only its shadow. The ground's shadow is
 *    recovered as the ratio of the render to a quick render of the empty ground (differential
 *    rendering), and the box pixels come from a raster coverage mask.
 */

export interface PhotoRenderOptions {
  /** Output size in px. Default 1600 x 1200. */
  width?: number;
  height?: number;
  /** Path-tracing samples per pixel. Default 1024. */
  samples?: number;
  /** Default "studio". */
  background?: "studio" | "transparent";
  /** Backdrop colour for "studio". */
  backdrop?: string;
  /** 0..1 */
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
  /** Stop sampling early (at least 32 samples) after this long, not counting the shader compile. Default 30 s. */
  maxMs?: number;
}

export interface PhotoRenderResult {
  blob: Blob;
  samples: number;
  ms: number;
  /** True when the GPU could not path-trace and the supersampled screenshot was used instead. */
  fallback?: boolean;
}

/** Thrown when this device cannot path-trace (no WebGL2 float render targets). */
export class PhotoRenderUnsupportedError extends Error {}

const abortError = () => new DOMException("Photo render cancelled", "AbortError");
export const isAbortError = (e: unknown) => e instanceof DOMException && e.name === "AbortError";

/** Things a render creates and frees afterwards. */
type Owned = { dispose(): void };

type FakeShader = { uniforms: Record<string, { value: unknown }>; vertexShader: string; fragmentShader: string };

/** The finish uniforms a patched board material injects at compile time (foil, spot UV, ink tone). */
function finishUniformsOf(m: Material, renderer: WebGLRenderer): Record<string, { value: unknown }> {
  if (m.onBeforeCompile === Material.prototype.onBeforeCompile) return {};
  const fake: FakeShader = { uniforms: {}, vertexShader: "", fragmentShader: "" };
  try {
    m.onBeforeCompile(fake as never, renderer);
  } catch {
    return {};
  }
  return fake.uniforms;
}

type Drawable = HTMLCanvasElement | HTMLImageElement | ImageBitmap | OffscreenCanvas;
function drawableOf(t: Texture | null | undefined): Drawable | null {
  const img = t?.image as unknown;
  if (!img) return null;
  if (typeof HTMLCanvasElement !== "undefined" && img instanceof HTMLCanvasElement) return img;
  if (typeof HTMLImageElement !== "undefined" && img instanceof HTMLImageElement) return img.complete ? img : null;
  if (typeof ImageBitmap !== "undefined" && img instanceof ImageBitmap) return img;
  if (typeof OffscreenCanvas !== "undefined" && img instanceof OffscreenCanvas) return img;
  return null;
}
const sizeOf = (d: Drawable) => ("naturalWidth" in d ? { w: d.naturalWidth, h: d.naturalHeight } : { w: d.width, h: d.height });

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

const toLin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** Most common colour of an artwork sheet (the unprinted board), sampled on a coarse grid. */
function dominantColor(px: Uint8ClampedArray, w: number, h: number): [number, number, number] {
  const counts = new Map<number, number>();
  const step = Math.max(1, Math.floor(Math.min(w, h) / 96));
  for (let y = 0; y < h; y += step)
    for (let x = 0; x < w; x += step) {
      const i = (y * w + x) * 4;
      const key = ((px[i] >> 3) << 10) | ((px[i + 1] >> 3) << 5) | (px[i + 2] >> 3);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  let best = 0;
  let bestN = -1;
  for (const [k, n] of counts) if (n > bestN) [best, bestN] = [k, n];
  return [((best >> 10) & 31) * 8 + 4, ((best >> 5) & 31) * 8 + 4, (best & 31) * 8 + 4];
}

interface SurfaceMaps {
  map: Texture;
  /** G = roughness, B = metalness (the glTF layout the path tracer reads). */
  orm: Texture;
}

/**
 * Bake a printed sheet for the path tracer: ink-on-kraft tint and hot-foil colour into the colour
 * map, and a roughness/metalness map where paper is matte, ink a little glossier and foil metal.
 */
function bakePrintedSheet(
  src: Texture,
  opts: { paperRough: number; inkRough: number; foil: Texture | null; foilRough: number; inkOnBoard: Color | null; maxSize: number },
): SurfaceMaps | null {
  const art = drawableOf(src);
  if (!art) return null;
  const { w: aw, h: ah } = sizeOf(art);
  if (!aw || !ah) return null;
  const k = Math.min(1, opts.maxSize / Math.max(aw, ah));
  const w = Math.max(1, Math.round(aw * k));
  const h = Math.max(1, Math.round(ah * k));
  const colorC = canvas(w, h);
  const ctx = colorC.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(art, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  const px = img.data;

  let foilPx: Uint8ClampedArray | null = null;
  const foilArt = drawableOf(opts.foil);
  if (foilArt) {
    const fc = canvas(w, h).getContext("2d", { willReadFrequently: true });
    if (fc) {
      fc.drawImage(foilArt, 0, 0, w, h);
      foilPx = fc.getImageData(0, 0, w, h).data;
    }
  }

  const bg = opts.inkOnBoard
    ? ([opts.inkOnBoard.r, opts.inkOnBoard.g, opts.inkOnBoard.b].map((c) => Math.round(Math.pow(c, 1 / 2.2) * 255)) as [number, number, number])
    : dominantColor(px, w, h);
  let tint: [number, number, number] | null = null;
  if (opts.inkOnBoard) {
    const m = Math.max(bg[0], bg[1], bg[2], 1);
    tint = [0, 1, 2].map((i) => 1 + ((bg[i] / m) - 1) * 0.85) as [number, number, number];
  }

  const ormC = canvas(w, h);
  const octx = ormC.getContext("2d");
  if (!octx) return null;
  const orm = octx.createImageData(w, h);
  const o = orm.data;
  const paperG = Math.round(opts.paperRough * 255);
  const inkG = Math.round(opts.inkRough * 255);
  const foilG = Math.round(opts.foilRough * 255);
  for (let i = 0; i < px.length; i += 4) {
    const dr = px[i] - bg[0];
    const dg = px[i + 1] - bg[1];
    const db = px[i + 2] - bg[2];
    const dist = Math.sqrt(dr * dr + dg * dg + db * db) / 441;
    // above the board's own fibre noise (about 0.05 on kraft), so bare board stays evenly matte
    const ink = Math.min(1, Math.max(0, (dist - 0.09) / 0.08));
    if (tint && ink > 0) {
      for (let c = 0; c < 3; c++) px[i + c] = px[i + c] * (1 + (tint[c] - 1) * ink);
    }
    let rough = paperG + (inkG - paperG) * ink;
    let metal = 0;
    if (foilPx) {
      const a = foilPx[i + 3] / 255;
      if (a > 0) {
        for (let c = 0; c < 3; c++) px[i + c] = px[i + c] + (foilPx[i + c] - px[i + c]) * a;
        rough = rough + (foilG - rough) * a;
        metal = a * 255;
      }
    }
    o[i] = 255;
    o[i + 1] = rough;
    o[i + 2] = metal;
    o[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  octx.putImageData(orm, 0, 0);

  const map = new CanvasTexture(colorC);
  map.colorSpace = SRGBColorSpace;
  const ormT = new CanvasTexture(ormC);
  ormT.colorSpace = NoColorSpace;
  for (const t of [map, ormT]) {
    t.flipY = src.flipY;
    t.wrapS = src.wrapS;
    t.wrapT = src.wrapT;
    t.offset.copy(src.offset);
    t.repeat.copy(src.repeat);
    t.rotation = src.rotation;
    t.center.copy(src.center);
    t.channel = src.channel;
  }
  return { map, orm: ormT };
}

const num = (u: Record<string, { value: unknown }>, k: string, d: number) => (typeof u[k]?.value === "number" ? (u[k].value as number) : d);
const tex = (u: Record<string, { value: unknown }>, k: string) => {
  const v = u[k]?.value as Texture | undefined;
  return v && (v as Texture).isTexture ? v : null;
};
/** 1 x 1 placeholder masks (no foil / no spot UV) are DataTextures; real masks are canvases. */
const realMask = (t: Texture | null) => (t && drawableOf(t) ? t : null);

/** Physically based paper / ink / foil for one live material. */
function photoMaterial(src: Material, renderer: WebGLRenderer, owned: Set<Owned>, maxTex: number): Material {
  if (!(src instanceof MeshStandardMaterial)) {
    const m = new MeshStandardMaterial({ color: "#d8d2c6", roughness: 0.85 });
    owned.add(m);
    return m;
  }
  const phys = src instanceof MeshPhysicalMaterial ? src : null;
  const u = finishUniformsOf(src, renderer);
  const clearcoat = phys && phys.clearcoat > 0.02 ? phys.clearcoat : 0;
  const sheen = phys && phys.sheen > 0.02 ? phys.sheen : 0;
  const coated = clearcoat > 0.02;
  // matte board ~0.8, ink a little glossier; under a film the film decides
  const paperRough = coated ? Math.min(0.9, src.roughness) : Math.min(0.92, Math.max(0.74, src.roughness));
  const inkRough = coated ? paperRough : Math.max(0.45, paperRough - 0.22);
  const inkTone = num(u, "elbaInkTone", 1);
  const inkOnBoard = num(u, "elbaInkOnBoard", 0) > 0.5 ? ((u.elbaBoardColor?.value as Color | undefined) ?? null) : null;
  const foil = realMask(tex(u, "elbaFoilMap"));
  const spotUv = realMask(tex(u, "elbaFinishMap"));

  const m = new MeshPhysicalMaterial({
    color: src.color.clone().multiplyScalar(inkTone),
    roughness: paperRough,
    metalness: 0,
    side: src.side,
    transparent: src.transparent,
    opacity: src.opacity,
    alphaMap: src.alphaMap,
    alphaTest: src.alphaTest,
    normalMap: src.normalMap,
    emissive: src.emissive,
    emissiveMap: src.emissiveMap,
    emissiveIntensity: src.emissiveIntensity,
  });
  if (phys) {
    m.transmission = phys.transmission;
    m.thickness = phys.thickness;
    m.ior = phys.ior;
  }
  if (src.metalness > 0.5) {
    // already a metal (a studio prop): keep it
    m.metalness = src.metalness;
    m.roughness = src.roughness;
  }
  owned.add(m);

  const map = src.map;
  // a printed sheet (artwork canvas), not a repeating board / flute tile
  const img = drawableOf(map);
  const isSheet = map && img && map.repeat.x === 1 && map.repeat.y === 1 && Math.max(sizeOf(img).w, sizeOf(img).h) > 256;
  const baked = map && isSheet ? bakePrintedSheet(map, { paperRough, inkRough, foil, foilRough: num(u, "elbaFoilRough", 0.25), inkOnBoard, maxSize: maxTex }) : null;
  if (baked) {
    owned.add(baked.map).add(baked.orm);
    m.map = baked.map;
    m.roughnessMap = baked.orm;
    m.metalnessMap = baked.orm;
    m.roughness = 1;
    m.metalness = 1;
  } else if (map) {
    m.map = map;
  }
  if (clearcoat) {
    m.clearcoat = clearcoat;
    m.clearcoatRoughness = phys?.clearcoatRoughness ?? 0.1;
  } else if (spotUv) {
    m.clearcoat = 1;
    m.clearcoatMap = spotUv;
    m.clearcoatRoughness = num(u, "elbaUvRough", 0.06);
  }
  if (sheen && phys) {
    m.sheen = sheen;
    m.sheenRoughness = phys.sheenRoughness;
    m.sheenColor.copy(phys.sheenColor);
  }
  return m;
}

/** Clone the model for the path tracer: world transform baked in, glow overlays and lines removed. */
function cloneForPhoto(model: Object3D, renderer: WebGLRenderer, owned: Set<Owned>, maxTex: number): Object3D {
  model.updateWorldMatrix(true, true);
  const root = model.clone(true);
  model.matrixWorld.decompose(root.position, root.quaternion, root.scale);
  const drop: Object3D[] = [];
  root.traverse((o) => {
    if (o !== root && (o.userData?.elbaHighlight || !o.visible || !(o instanceof Mesh || o.type === "Group" || o.type === "Object3D"))) drop.push(o);
  });
  for (const o of drop) o.removeFromParent();
  const cache = new Map<Material, Material>();
  const convert = (s: Material) => {
    let c = cache.get(s);
    if (!c) cache.set(s, (c = s.visible ? photoMaterial(s, renderer, owned, maxTex) : s));
    return c;
  };
  const meshes: Mesh[] = [];
  root.traverse((o) => {
    if (o instanceof Mesh) meshes.push(o);
  });
  for (const o of meshes) {
    if (!Array.isArray(o.material)) {
      o.material = convert(o.material);
      continue;
    }
    // the path tracer (0.0.24) gives each mesh ONE material slot: split multi-material panels
    // (outside / inside / cut edge groups) into one mesh per group
    const mats = o.material;
    const holder = new Group();
    const geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
    if (geo !== o.geometry) owned.add(geo);
    for (const g of geo.groups) {
      const m = mats[g.materialIndex ?? 0];
      if (!m?.visible || g.count <= 0) continue;
      const part = new BufferGeometry();
      for (const [name, attr] of Object.entries(geo.attributes)) {
        const a = attr as BufferAttribute;
        part.setAttribute(name, new BufferAttribute(a.array.slice(g.start * a.itemSize, (g.start + g.count) * a.itemSize), a.itemSize, a.normalized));
      }
      owned.add(part);
      holder.add(new Mesh(part, convert(m)));
    }
    // the holder takes the mesh's place (same transform, same children)
    holder.position.copy(o.position);
    holder.quaternion.copy(o.quaternion);
    holder.scale.copy(o.scale);
    for (const c of [...o.children]) holder.add(c);
    (o.parent ?? root).add(holder);
    o.removeFromParent();
  }
  return root;
}

const frame = () => new Promise<number>((r) => requestAnimationFrame(r));

type PathTracerModule = typeof import("three-gpu-pathtracer");
type PathTracer = InstanceType<PathTracerModule["WebGLPathTracer"]>;
interface Engine {
  el: HTMLCanvasElement;
  renderer: WebGLRenderer;
  tracer: PathTracer;
  idle: ReturnType<typeof setTimeout> | null;
  extra: Owned[];
}

/**
 * One offscreen renderer + path tracer, kept for a few minutes after a render: its fragment
 * shader is large (ANGLE / D3D11 can take most of a minute to compile it the first time), so a
 * second render (another angle, the see-through variant) starts sampling at once.
 */
let engine: Engine | null = null;
let busy = false;
/** Denoise the final frame (only when the time budget cut sampling short). */
let denoiseFinal = false;
const IDLE_MS = 5 * 60_000;

/** Free the photo renderer's GPU context now (it also frees itself after a few idle minutes). */
export function disposePhotoRenderer() {
  if (!engine) return;
  if (engine.idle) clearTimeout(engine.idle);
  engine.tracer.dispose();
  for (const o of engine.extra) o.dispose();
  engine.renderer.dispose();
  engine.renderer.forceContextLoss();
  engine = null;
}

function getEngine(mod: PathTracerModule): Engine {
  if (engine) {
    if (engine.idle) clearTimeout(engine.idle);
    engine.idle = null;
    return engine;
  }
  const el = canvas(4, 4);
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas: el, antialias: true, alpha: true, preserveDrawingBuffer: true, premultipliedAlpha: false, powerPreference: "high-performance" });
  } catch {
    throw new PhotoRenderUnsupportedError("WebGL2 unavailable");
  }
  const gl = renderer.getContext();
  if (!(gl instanceof WebGL2RenderingContext) || !gl.getExtension("EXT_color_buffer_float")) {
    renderer.dispose();
    renderer.forceContextLoss();
    throw new PhotoRenderUnsupportedError("No float render targets");
  }
  renderer.setPixelRatio(1);
  renderer.toneMapping = NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);

  const tracer = new mod.WebGLPathTracer(renderer);
  tracer.bounces = 3;
  // keep the default transmissiveBounces (10): lower values leave ~1/3 of the pixels black in 0.0.24
  tracer.renderDelay = 0;
  tracer.minSamples = 1;
  tracer.fadeDuration = 0;
  tracer.rasterizeScene = false;
  tracer.renderToCanvas = false;
  tracer.dynamicLowRes = false;
  tracer.tiles.set(2, 2);
  const maxTex = Math.min(2048, renderer.capabilities.maxTextureSize);
  tracer.textureSize.set(maxTex, maxTex);
  // Set the shader features this scene uses BEFORE the first setScene: the tracer flips them in
  // onBeforeRender otherwise, and every flip is another full compile.
  const ptm = (tracer as unknown as { _pathTracer?: { material?: { setDefine?(k: string, v: number): void } } })._pathTracer?.material;
  ptm?.setDefine?.("FEATURE_DOF", 0);
  ptm?.setDefine?.("FEATURE_FOG", 0);
  ptm?.setDefine?.("FEATURE_BACKGROUND_MAP", 1);
  // Multiple importance sampling makes the shader ~10x slower to compile on ANGLE / D3D11 (about
  // 55 s instead of 6 s on a desktop GPU); the extra grain without it is cleaned by more samples
  // and the edge-preserving denoise on the final frame.
  ptm?.setDefine?.("FEATURE_MIS", 0);
  // final frame: edge-preserving denoise (keeps print edges and type sharp), tone mapped
  const denoise = new FullScreenQuad(new mod.DenoiseMaterial({ sigma: 1.6, kSigma: 1, threshold: 0.04, blending: NoBlending, transparent: false }));
  const defaultDraw = tracer.renderToCanvasCallback;
  tracer.renderToCanvasCallback = (target, r, q) => {
    // a converged frame is drawn as is: the filter only blots fine paper grain into mottling
    if (!denoiseFinal) return defaultDraw(target, r, q);
    const m = denoise.material as InstanceType<PathTracerModule["DenoiseMaterial"]>;
    m.map = target.texture;
    const auto = r.autoClear;
    r.autoClear = false;
    denoise.render(r);
    r.autoClear = auto;
  };
  engine = { el, renderer, tracer, idle: null, extra: [denoise, denoise.material] };
  return engine;
}

/**
 * Path-trace `model` from `camera`'s point of view. Rejects with an AbortError when `signal`
 * aborts, and with PhotoRenderUnsupportedError when the GPU cannot do it (call the screenshot
 * fallback then).
 */
export async function renderPhoto(model: Object3D, camera: Camera, opts: PhotoRenderOptions = {}): Promise<PhotoRenderResult> {
  const t0 = performance.now();
  const width = Math.round(opts.width ?? 1600);
  const height = Math.round(opts.height ?? 1200);
  const target = Math.max(1, opts.samples ?? 1024);
  const maxMs = opts.maxMs ?? 30_000;
  const transparent = opts.background === "transparent";
  const backdrop = new Color(opts.backdrop ?? "#efeeeb");
  const { signal, onProgress } = opts;
  const check = () => {
    if (signal?.aborted) throw abortError();
  };
  check();
  if (busy) throw new Error("A photo render is already running");
  busy = true;

  const owned = new Set<Owned>();
  let eng: Engine | null = null;
  try {
    const mod = await import("three-gpu-pathtracer");
    check();
    eng = getEngine(mod);
    const { el, renderer, tracer } = eng;
    const gpuMax = renderer.capabilities.maxTextureSize;
    if (Math.max(width, height) > gpuMax) throw new PhotoRenderUnsupportedError("Output larger than the GPU allows");
    const maxTex = Math.min(2048, gpuMax);
    renderer.setSize(width, height, false);

    // ── scene ─────────────────────────────────────────────────────
    const scene = new Scene();
    const box = cloneForPhoto(model, renderer, owned, maxTex);
    scene.add(box);
    scene.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(box);
    const size = bounds.getSize(new Vector3());
    const center = bounds.getCenter(new Vector3());
    const s = Math.max(size.x, size.y, size.z, 0.02);

    const cam = new PerspectiveCamera();
    if (camera instanceof PerspectiveCamera) {
      cam.fov = camera.fov;
      cam.near = camera.near;
      cam.far = camera.far;
    }
    camera.updateMatrixWorld();
    camera.matrixWorld.decompose(cam.position, cam.quaternion, cam.scale);
    cam.aspect = width / height;
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();

    // ground: a wide board under the box (the studio sweep, and the shadow catcher)
    const groundGeo = new PlaneGeometry(s * 80, s * 80);
    const groundMat = new MeshStandardMaterial({ color: transparent ? "#f4f4f4" : backdrop, roughness: 0.95, metalness: 0 });
    owned.add(groundGeo).add(groundMat);
    const ground = new Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(center.x, bounds.min.y - s * 0.0005, center.z);
    scene.add(ground);

    // soft studio sky: bright top, darker floor bounce
    const env = new mod.GradientEquirectTexture(128);
    env.topColor.set("#ffffff");
    env.bottomColor.set("#6f6c68");
    env.exponent = 1.6;
    env.update();
    owned.add(env);
    scene.environment = env;
    scene.environmentIntensity = 0.55;
    // a colour background in both modes (the ground fills the frame; the see-through PNG gets its
    // alpha from the coverage mask), so both modes share one compiled shader
    scene.background = transparent ? new Color("#f4f4f4") : backdrop.clone();

    // lights follow the camera: a large soft key above-left, a weak fill right, a rim behind
    const toCam = cam.position.clone().sub(center).setY(0).normalize();
    if (toCam.lengthSq() < 1e-6) toCam.set(0, 0, 1);
    const right = new Vector3().crossVectors(new Vector3(0, 1, 0), toCam).normalize();
    const addLight = (intensity: number, wMul: number, offset: Vector3) => {
      const l = new RectAreaLight(0xffffff, intensity, s * wMul, s * wMul);
      l.position.copy(center).add(offset.multiplyScalar(s));
      l.lookAt(center);
      scene.add(l);
    };
    addLight(KEY, 2.4, right.clone().multiplyScalar(-1.5).addScaledVector(toCam, 0.35).add(new Vector3(0, 3.0, 0)));
    addLight(FILL, 2.6, right.clone().multiplyScalar(2.2).addScaledVector(toCam, 0.8).add(new Vector3(0, 1.0, 0)));
    addLight(RIM, 1.6, toCam.clone().multiplyScalar(-2.2).add(new Vector3(0, 2.0, 0)));
    scene.updateMatrixWorld(true);

    // ── coverage mask of the box (transparent mode) ──────────────
    let mask: Uint8ClampedArray | null = null;
    if (transparent) {
      const white = new MeshBasicMaterial({ color: 0xffffff });
      owned.add(white);
      const bg0 = scene.background;
      const env0 = scene.environment;
      ground.visible = false;
      scene.overrideMaterial = white;
      scene.background = null;
      scene.environment = null;
      renderer.render(scene, cam);
      const mc = canvas(width, height).getContext("2d", { willReadFrequently: true });
      if (mc) {
        mc.drawImage(el, 0, 0);
        mask = mc.getImageData(0, 0, width, height).data;
      }
      scene.overrideMaterial = null;
      scene.background = bg0;
      scene.environment = env0;
      ground.visible = true;
    }

    // ── path tracing ──────────────────────────────────────────────
    // sync BVH build: box models are a few thousand triangles (the async path needs a worker)
    tracer.setScene(scene, cam);
    check();

    /** Progressive samples; the first shader compile reports as the first part of the bar. */
    const trace = async (goal: number, budgetMs: number, report: (f: number) => void) => {
      const start = performance.now();
      let sampling = 0;
      let perFrame = 1;
      let last = await frame();
      while (tracer.samples < goal) {
        check();
        for (let i = 0; i < perFrame && tracer.samples < goal; i++) tracer.renderSample();
        const now = await frame();
        const dt = now - last;
        last = now;
        if ((tracer as unknown as { isCompiling?: boolean }).isCompiling) {
          if (now - start > 150_000) throw new PhotoRenderUnsupportedError("Path tracer shader did not compile");
          report(COMPILE_SHARE * (1 - Math.exp(-(now - start) / 25_000)));
          continue;
        }
        sampling ||= now;
        // keep the page responsive: aim for ~30-50 ms frames
        if (dt < 34) perFrame = Math.min(perFrame + 1, 64);
        else if (dt > 60 && perFrame > 1) perFrame--;
        const from = now - start > 1500 ? COMPILE_SHARE : 0;
        report(from + (1 - from) * Math.min(1, tracer.samples / goal));
        if (now - sampling > budgetMs && tracer.samples >= 32) break;
      }
      // one more sample drawn to the canvas
      denoiseFinal = tracer.samples < 256;
      tracer.renderToCanvas = true;
      tracer.renderSample();
      tracer.renderToCanvas = false;
      return Math.floor(tracer.samples);
    };

    const mainShare = transparent ? 0.9 : 1;
    const samples = await trace(target, maxMs, (f) => onProgress?.(f * mainShare));
    const out = canvas(width, height);
    const octx = out.getContext("2d", { willReadFrequently: true });
    if (!octx) throw new Error("No 2D canvas");
    octx.drawImage(el, 0, 0);

    if (transparent && mask) {
      const full = octx.getImageData(0, 0, width, height);
      // the empty ground at quarter size (it is smooth), scaled back up for the ratio
      box.removeFromParent();
      const qw = Math.max(1, Math.round(width / 4));
      const qh = Math.max(1, Math.round(height / 4));
      renderer.setSize(qw, qh, false);
      tracer.setScene(scene, cam);
      check();
      // quarter size: a full sample count costs a sixteenth, and keeps the ratio free of grain
      await trace(target, 10_000, (f) => onProgress?.(mainShare + f * (1 - mainShare)));
      const bc = canvas(width, height).getContext("2d", { willReadFrequently: true });
      if (!bc) throw new Error("No 2D canvas");
      bc.imageSmoothingEnabled = true;
      bc.imageSmoothingQuality = "high";
      bc.drawImage(el, 0, 0, qw, qh, 0, 0, width, height);
      const empty = bc.getImageData(0, 0, width, height).data;
      const px = full.data;
      for (let i = 0; i < px.length; i += 4) {
        const m = mask[i] / 255;
        const lb = 0.2126 * toLin(empty[i] / 255) + 0.7152 * toLin(empty[i + 1] / 255) + 0.0722 * toLin(empty[i + 2] / 255);
        const la = 0.2126 * toLin(px[i] / 255) + 0.7152 * toLin(px[i + 1] / 255) + 0.0722 * toLin(px[i + 2] / 255);
        // ignore the last few percent (sampling noise), so the far floor is fully see-through
        const shadow = lb > 1e-4 ? Math.min(1, Math.max(0, (1 - la / lb - 0.07) / 0.93)) * SHADOW_STRENGTH : 0;
        const a = m + (1 - m) * shadow;
        if (a <= 0) {
          px[i] = px[i + 1] = px[i + 2] = px[i + 3] = 0;
          continue;
        }
        // straight alpha: box colour where covered, black shadow elsewhere
        const k = m / a;
        px[i] *= k;
        px[i + 1] *= k;
        px[i + 2] *= k;
        px[i + 3] = Math.round(a * 255);
      }
      octx.putImageData(full, 0, 0);
    }
    onProgress?.(1);
    const blob = await new Promise<Blob>((resolve, reject) => out.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG encoding failed"))), "image/png"));
    const ms = Math.round(performance.now() - t0);
    console.info(`[elba] photo render: ${width}x${height}, ${samples} samples, ${ms} ms`);
    return { blob, samples, ms };
  } catch (e) {
    // a failed or cancelled render may leave the tracer mid-state: start clean next time
    if (!isAbortError(e)) disposePhotoRenderer();
    throw e;
  } finally {
    busy = false;
    for (const o of owned) o.dispose();
    if (engine) {
      engine.renderer.setSize(4, 4, false);
      engine.idle = setTimeout(disposePhotoRenderer, IDLE_MS);
    }
  }
}

/** Light intensities (path-tracer radiance units) and the shadow catcher's strength. */
const KEY = 7;
const FILL = 0.8;
const RIM = 2.2;
const SHADOW_STRENGTH = 0.92;
/** Share of the progress bar given to the first shader compile. */
const COMPILE_SHARE = 0.35;
