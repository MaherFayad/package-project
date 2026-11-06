import type { BoardAppearance } from "@/lib/dieline";
import { boardAppearance } from "@/lib/dieline";
import { BOX_BOARDS, FINISHES, type BoxBoardCode, type ConfigFinishCode, type FinishChoice } from "@/lib/configurator";

/**
 * PBR "looks" for every board and finish. Pure numbers (no three.js) so they are shared by
 * the 3D materials, 2D previews and unit tests. Colours are sRGB hex.
 *
 * Calibration notes:
 * - Metal foils are metalness 1 with the foil's specular colour as albedo (gold F0 is about
 *   (1.0, 0.78, 0.34); printed foils read a little paler and rougher than polished metal).
 * - Gloss lamination is a clear film: low base roughness plus a strong, sharp clear coat.
 * - Soft-touch is very rough with a soft white sheen at grazing angles and slightly deeper ink.
 * - Spot UV is a thick clear coat with near-mirror roughness inside its mask.
 */

export interface SurfaceLook {
  roughness: number;
  /** Clear coat on the whole surface (lamination / varnish). */
  clearcoat: number;
  clearcoatRoughness: number;
  /** Velvet sheen (soft-touch). */
  sheen: number;
  sheenRoughness: number;
  /** Multiplier on the printed colour (soft-touch deepens ink a little). */
  inkTone: number;
  /** Reflection strength from the studio environment. */
  envIntensity: number;
}

export interface FoilLook {
  color: string;
  roughness: number;
}

export const FOIL_LOOKS: Record<"FOIL_GOLD" | "FOIL_SILVER" | "FOIL_ROSE_GOLD", FoilLook> = {
  FOIL_GOLD: { color: "#e9c46a", roughness: 0.24 },
  FOIL_SILVER: { color: "#d9dade", roughness: 0.2 },
  FOIL_ROSE_GOLD: { color: "#e7a98f", roughness: 0.26 },
};

export const SPOT_UV_LOOK = { clearcoat: 1, clearcoatRoughness: 0.03 } as const;

/** Relief height in the bump map: emboss up, deboss down (0..1 around 0.5 = flat). */
export const RELIEF_LEVEL = { EMBOSS: 1, DEBOSS: 0 } as const;
/** Bump strength in three.js units for a 2048 px sheet. */
export const RELIEF_BUMP_SCALE = 4;

export type CoatingCode = Extract<ConfigFinishCode, "MATTE_LAMINATION" | "GLOSS_LAMINATION" | "SOFT_TOUCH_LAMINATION" | "GLOSS_VARNISH" | "MATTE_VARNISH">;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Unfinished printed surface, per board appearance. */
export function baseLook(app: BoardAppearance): SurfaceLook {
  return { roughness: app.roughness, clearcoat: 0, clearcoatRoughness: 0.3, sheen: 0, sheenRoughness: 0.8, inkTone: 1, envIntensity: app.fluteColor ? 0.45 : 0.7 };
}

/** Look of the printed surface after a coating (or none). */
export function coatingLook(coating: CoatingCode | null, app: BoardAppearance): SurfaceLook {
  const base = baseLook(app);
  switch (coating) {
    case "GLOSS_LAMINATION":
      return { ...base, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.03, envIntensity: 1 };
    case "MATTE_LAMINATION":
      // matte film: kills the paper sheen and lifts blacks a touch
      return { ...base, roughness: 0.85, clearcoat: 0, inkTone: 0.97, envIntensity: 0.45 };
    case "SOFT_TOUCH_LAMINATION":
      // deep and velvety; sheen only at grazing angles (a strong sheen reads as dusty haze face-on)
      return { ...base, roughness: 0.93, clearcoat: 0, sheen: 0.18, sheenRoughness: 0.5, inkTone: 0.92, envIntensity: 0.55 };
    case "GLOSS_VARNISH":
      return { ...base, roughness: clamp01(app.roughness * 0.7), clearcoat: 0.6, clearcoatRoughness: 0.12, envIntensity: 0.85 };
    case "MATTE_VARNISH":
      return { ...base, roughness: clamp01(app.roughness + 0.15) };
    default:
      return base;
  }
}

export function coatingOf(finishes: readonly FinishChoice[]): CoatingCode | null {
  const c = finishes.find((f) => FINISHES[f.code].group === "coating");
  return (c?.code as CoatingCode | undefined) ?? null;
}

/** Linear blend of two looks (finish crossfade). */
export function mixLook(a: SurfaceLook, b: SurfaceLook, t: number): SurfaceLook {
  const m = (x: number, y: number) => x + (y - x) * t;
  return {
    roughness: m(a.roughness, b.roughness),
    clearcoat: m(a.clearcoat, b.clearcoat),
    clearcoatRoughness: m(a.clearcoatRoughness, b.clearcoatRoughness),
    sheen: m(a.sheen, b.sheen),
    sheenRoughness: m(a.sheenRoughness, b.sheenRoughness),
    inkTone: m(a.inkTone, b.inkTone),
    envIntensity: m(a.envIntensity, b.envIntensity),
  };
}

/** Appearance for any configurator board, including boards the dieline catalogue lacks (B white, BC). */
export function configBoardAppearance(code: BoxBoardCode): BoardAppearance {
  const b = BOX_BOARDS[code];
  if (b.pricingMaterial) return boardAppearance(b.pricingMaterial);
  const kraft = b.color === "KRAFT";
  const pitch = b.flute === "BC" ? 7 : 6.5;
  return {
    outside: kraft ? "#b98d5e" : "#eeebe3",
    inside: "#a87d50",
    edge: "#c9a476",
    fluteColor: "#8f6a42",
    flutePitchMm: pitch,
    roughness: kraft ? 0.92 : 0.88,
  };
}

/** Number of flute layers on the cut edge (BC double wall shows two). */
export function fluteLayers(code: BoxBoardCode): 0 | 1 | 2 {
  const f = BOX_BOARDS[code].flute;
  return f === "BC" ? 2 : f ? 1 : 0;
}
