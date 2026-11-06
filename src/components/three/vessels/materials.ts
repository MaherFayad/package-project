import {
  CanvasTexture,
  Color,
  DoubleSide,
  FrontSide,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  type Material,
  type Plane,
  type Texture,
} from "three";
import { CLOSURE_COLORS, LIQUIDS, type ClosureColorCode, type LabelFinishCode, type LabelStockCode, type LiquidCode, type VesselMaterialCode } from "@/lib/vessels";
import type { PartRole } from "./closures";

/**
 * Materials for containers, closures, product and labels.
 * quality "high": glass uses MeshPhysicalMaterial transmission (real refraction, one extra pass).
 * quality "low" (phones / weak GPUs): no transmission, alpha-blended glass with strong
 * reflections; looks close and costs no extra render pass.
 * World scale: the vessel group is in mm scaled by 0.001, so `thickness` is in mm (object space)
 * and `attenuationDistance` is in metres (world space).
 */
export type VesselQuality = "high" | "low";

interface GlassLook {
  color: string;
  roughness: number;
  attenuation: string;
  attenuationDistance: number;
  /** alpha used without transmission */
  opacity: number;
  ior: number;
  thickness: number;
}

const GLASS: Partial<Record<VesselMaterialCode, GlassLook>> = {
  GLASS_CLEAR: { color: "#ffffff", roughness: 0.03, attenuation: "#eef6f2", attenuationDistance: 0.06, opacity: 0.16, ior: 1.5, thickness: 2.2 },
  GLASS_AMBER: { color: "#e39a3c", roughness: 0.05, attenuation: "#7a3a06", attenuationDistance: 0.006, opacity: 0.55, ior: 1.5, thickness: 2.2 },
  GLASS_FROSTED: { color: "#ffffff", roughness: 0.42, attenuation: "#f2f5f4", attenuationDistance: 0.08, opacity: 0.5, ior: 1.5, thickness: 2.2 },
  PET_CLEAR: { color: "#f6fbff", roughness: 0.06, attenuation: "#e8f3fb", attenuationDistance: 0.2, opacity: 0.12, ior: 1.57, thickness: 0.4 },
};

/** Alpha-blended (no transmission) look where the surface colour alone is wrong. */
const LOW_PATH: Partial<Record<VesselMaterialCode, { color: string; opacity: number }>> = {
  GLASS_AMBER: { color: "#8a4b12", opacity: 0.8 },
};

export function isTransparentVessel(code: VesselMaterialCode): boolean {
  return code in GLASS;
}

/**
 * Container body. `thinMode` forces alpha blending even in high quality: used when the product
 * itself is water-clear, so the liquid can take the transmission pass instead (three.js does not
 * render transmissive objects inside other transmissive objects).
 */
export function createVesselMaterial(code: VesselMaterialCode, quality: VesselQuality, opts: { thinMode?: boolean; kraftMap?: Texture | null; tint?: string | null } = {}): Material {
  const mat = baseVesselMaterial(code, quality, opts);
  if (opts.tint && "color" in mat) {
    const m = mat as MeshPhysicalMaterial;
    m.color.set(opts.tint);
    // tinted glass: the colour comes from absorption through the wall, not only the surface
    if (m.transmission > 0) {
      m.attenuationColor.set(opts.tint);
      m.attenuationDistance = Math.min(m.attenuationDistance || 0.01, 0.01);
    }
  }
  return mat;
}

function baseVesselMaterial(code: VesselMaterialCode, quality: VesselQuality, opts: { thinMode?: boolean; kraftMap?: Texture | null }): Material {
  const glass = GLASS[code];
  if (glass) {
    const transmit = quality === "high" && !opts.thinMode;
    if (transmit) {
      return new MeshPhysicalMaterial({
        color: new Color(glass.color),
        metalness: 0,
        roughness: glass.roughness,
        transmission: 1,
        thickness: glass.thickness,
        ior: glass.ior,
        attenuationColor: new Color(glass.attenuation),
        attenuationDistance: glass.attenuationDistance,
        specularIntensity: 1,
        clearcoat: code === "GLASS_FROSTED" ? 0 : 0.6,
        clearcoatRoughness: 0.05,
        envMapIntensity: 1.25,
        side: FrontSide,
      });
    }
    // R5-3Q-G-15: without transmission there is no absorption through the wall, so amber glass
    // needs its body colour and more opacity on the low path (it read pale peach)
    const low = LOW_PATH[code];
    return new MeshPhysicalMaterial({
      color: new Color(low?.color ?? glass.color),
      metalness: 0,
      roughness: glass.roughness,
      transparent: true,
      opacity: low?.opacity ?? glass.opacity,
      depthWrite: false,
      clearcoat: 1,
      clearcoatRoughness: glass.roughness * 0.5,
      envMapIntensity: 1.6,
      side: FrontSide,
    });
  }
  switch (code) {
    case "HDPE_WHITE":
      return new MeshPhysicalMaterial({ color: "#f1f0ea", roughness: 0.48, metalness: 0, sheen: 0.25, sheenRoughness: 0.6, sheenColor: new Color("#ffffff") });
    case "ALUMINIUM":
      return new MeshPhysicalMaterial({ color: "#dfe2e6", roughness: 0.24, metalness: 1, anisotropy: 0.55, anisotropyRotation: Math.PI / 2, envMapIntensity: 1.2 });
    case "TINPLATE":
      return new MeshPhysicalMaterial({ color: "#dfe1e3", roughness: 0.28, metalness: 1, envMapIntensity: 1.8 });
    case "KRAFT_POUCH":
      return new MeshStandardMaterial({ color: opts.kraftMap ? "#ffffff" : "#c39a6b", roughness: 0.92, metalness: 0, map: opts.kraftMap ?? null, side: DoubleSide });
    case "WHITE_POUCH":
      return new MeshStandardMaterial({ color: "#f4f3ef", roughness: 0.82, metalness: 0, side: DoubleSide });
    case "PE_TUBE_WHITE":
    default:
      return new MeshPhysicalMaterial({ color: "#f7f6f2", roughness: 0.32, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.2 });
  }
}

/** Product inside. Clear liquids get transmission (high quality); others are glossy and solid. */
export function createLiquidMaterial(code: LiquidCode, quality: VesselQuality, clip: Plane[]): Material {
  const l = LIQUIDS[code];
  const color = new Color(l.hex);
  if (quality === "high" && l.clarity >= 0.8) {
    return new MeshPhysicalMaterial({
      color: new Color("#ffffff"),
      transmission: 1,
      roughness: 0.02,
      ior: 1.34,
      thickness: 30,
      attenuationColor: color,
      attenuationDistance: code === "WATER" ? 0.4 : 0.05,
      clippingPlanes: clip,
      side: FrontSide,
    });
  }
  if (quality === "low" && l.clarity > 0) {
    return new MeshStandardMaterial({ color, roughness: 0.15, transparent: true, opacity: 0.35 + 0.55 * (1 - l.clarity), depthWrite: false, clippingPlanes: clip });
  }
  // a little self-light so honey and oil glow like they do against a window
  return new MeshPhysicalMaterial({
    color,
    roughness: l.clarity > 0 ? 0.12 : 0.45,
    clearcoat: l.clarity > 0 ? 0.6 : 0.1,
    emissive: color,
    emissiveIntensity: 0.08 + 0.22 * l.clarity,
    clippingPlanes: clip,
  });
}

/** Closure part materials. */
export function createClosureMaterial(role: PartRole, color: ClosureColorCode): Material {
  // an unknown code ("MATCH" handled upstream, an old saved doc) draws white, never throws
  const c = CLOSURE_COLORS[color] ?? CLOSURE_COLORS.WHITE;
  switch (role) {
    case "gasket":
      // swing-top seal: natural red rubber whatever the stopper colour
      return new MeshPhysicalMaterial({ color: "#b8312b", roughness: 0.7, sheen: 0.3, sheenRoughness: 0.6, sheenColor: new Color("#ffffff") });
    case "wire":
      return new MeshPhysicalMaterial({ color: "#c9ccd0", roughness: 0.32, metalness: 1 });
    case "rubber":
      return new MeshPhysicalMaterial({ color: color === "WHITE" || color === "NATURAL" ? "#f0eee8" : c.metal ? "#1f1f22" : c.hex, roughness: 0.62, sheen: 0.4, sheenRoughness: 0.5, sheenColor: new Color("#ffffff") });
    case "pipette":
      return new MeshPhysicalMaterial({ color: "#d9e6ea", roughness: 0.08, clearcoat: 1, metalness: 0 });
    case "dark":
      return new MeshStandardMaterial({ color: "#2a2b2d", roughness: 0.6, metalness: 0.3 });
    case "body":
      return new MeshPhysicalMaterial({ color: "#d9dce0", roughness: 0.3, metalness: 1 });
    case "capMetal":
      return c.metal
        ? new MeshPhysicalMaterial({ color: c.hex, roughness: 0.22, metalness: 1, clearcoat: 0.4 })
        : new MeshPhysicalMaterial({ color: c.hex, roughness: 0.35, metalness: 0.15, clearcoat: 0.8, clearcoatRoughness: 0.15 });
    case "cap":
    default:
      return c.metal
        ? new MeshPhysicalMaterial({ color: c.hex, roughness: 0.2, metalness: 1 })
        : new MeshPhysicalMaterial({ color: c.hex, roughness: 0.42, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.4 });
  }
}

/** Label face material from stock + finish (finish is applied to the whole face). */
export function createLabelMaterial(stock: LabelStockCode, finish: LabelFinishCode, map: Texture | null): Material {
  const glossy = finish === "GLOSS_VARNISH" || finish === "GLOSS_LAMINATION" || finish === "SPOT_UV";
  const matte = finish === "MATTE_VARNISH" || finish === "MATTE_LAMINATION";
  const clear = stock === "CLEAR_BOPP" || stock === "PETG_SHRINK";
  const base = {
    map,
    color: new Color("#ffffff"),
    transparent: clear,
    alphaTest: clear ? 0.02 : 0,
    side: DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  } as const;
  const mat = labelFace(stock, matte, glossy, base);
  // Opaque self-adhesive stocks: the inside of the wrap is the white face stock / adhesive, not
  // the artwork mirrored (it shows through clear glass and PET). Clear stocks keep the reversed
  // print, which is what you really see through a clear label.
  if (!clear) {
    mat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <map_fragment>",
        "#include <map_fragment>\n  if ( !gl_FrontFacing ) diffuseColor.rgb = vec3( 0.93, 0.93, 0.91 );",
      );
    };
    mat.customProgramCacheKey = () => "elba-label-liner";
  }
  return mat;
}

function labelFace(stock: LabelStockCode, matte: boolean, glossy: boolean, base: Record<string, unknown>): MeshPhysicalMaterial {
  switch (stock) {
    case "PAPER_SEMIGLOSS":
      return new MeshPhysicalMaterial({ ...base, roughness: matte ? 0.86 : glossy ? 0.3 : 0.6, clearcoat: glossy ? 1 : 0, clearcoatRoughness: 0.08, sheen: matte ? 0.3 : 0, sheenRoughness: 0.8 });
    case "WHITE_BOPP":
      return new MeshPhysicalMaterial({ ...base, roughness: matte ? 0.7 : 0.32, clearcoat: glossy ? 1 : 0.3, clearcoatRoughness: 0.06 });
    case "CLEAR_BOPP":
      return new MeshPhysicalMaterial({ ...base, roughness: matte ? 0.55 : 0.12, clearcoat: 1, clearcoatRoughness: 0.05, depthWrite: false });
    case "METALLIC_BOPP":
      return new MeshPhysicalMaterial({ ...base, roughness: matte ? 0.5 : 0.22, metalness: 0.85, clearcoat: glossy ? 1 : 0.5, clearcoatRoughness: 0.05 });
    case "PETG_SHRINK":
    default:
      return new MeshPhysicalMaterial({ ...base, roughness: matte ? 0.6 : 0.14, clearcoat: matte ? 0 : 1, clearcoatRoughness: 0.04 });
  }
}

/** Procedural kraft fibre texture (512 px, tiles). */
export function createKraftTexture(): CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#c79e70";
  ctx.fillRect(0, 0, 512, 512);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 9000; i++) {
    const x = rnd() * 512;
    const y = rnd() * 512;
    const len = 2 + rnd() * 9;
    const a = rnd() * Math.PI;
    const l = rnd();
    ctx.strokeStyle = l > 0.5 ? `rgba(120,80,40,${0.05 + rnd() * 0.12})` : `rgba(240,215,175,${0.05 + rnd() * 0.12})`;
    ctx.lineWidth = 0.6 + rnd() * 0.8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.repeat.set(3, 4);
  return tex;
}
