import { DoubleSide, FrontSide, MeshPhysicalMaterial, MeshStandardMaterial, type Texture } from "three";
import type { LocalizedText } from "@/types";
import type { FilmMaterialCode } from "./types";

/**
 * Film laminates. `structure` is a generic, typical laminate (outer / inner, microns); converters
 * quote their own. Metallised and clear films print with a white underlay where artwork must be
 * opaque.
 */
export interface FilmMaterial {
  code: FilmMaterialCode;
  name: LocalizedText;
  structure: string;
  barrier: "low" | "medium" | "high";
  /** Ink needs a white underlay to look opaque. */
  whiteUnderlay: boolean;
  /** Product shows through unprinted areas. */
  transparent: boolean;
  /** Food contact grade available (EU 10/2011 / FDA 21 CFR 177 resins). */
  foodContact: boolean;
  render: { color: string; roughness: number; metalness: number; clearcoat: number; clearcoatRoughness: number; transmission: number; opacity: number };
}

export const FILM_MATERIALS: Record<FilmMaterialCode, FilmMaterial> = {
  FILM_MATTE: {
    code: "FILM_MATTE",
    name: { ar: "فيلم مطفي", en: "Matte film" },
    structure: "matte BOPP 20 / PE 60-100",
    barrier: "medium",
    whiteUnderlay: false,
    transparent: false,
    foodContact: true,
    render: { color: "#f1f0ec", roughness: 0.82, metalness: 0, clearcoat: 0, clearcoatRoughness: 0.6, transmission: 0, opacity: 1 },
  },
  FILM_GLOSS: {
    code: "FILM_GLOSS",
    name: { ar: "فيلم لامع", en: "Gloss film" },
    structure: "PET 12 / PE 60-100",
    barrier: "medium",
    whiteUnderlay: false,
    transparent: false,
    foodContact: true,
    render: { color: "#f6f6f4", roughness: 0.3, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.08, transmission: 0, opacity: 1 },
  },
  FILM_METALLISED: {
    code: "FILM_METALLISED",
    name: { ar: "فيلم معدني", en: "Metallised film" },
    structure: "PET 12 / metallised PET 12 or ALU 7 / PE 70",
    barrier: "high",
    whiteUnderlay: true,
    transparent: false,
    foodContact: true,
    render: { color: "#cfd3d8", roughness: 0.28, metalness: 0.9, clearcoat: 0.5, clearcoatRoughness: 0.1, transmission: 0, opacity: 1 },
  },
  FILM_KRAFT_LAMINATE: {
    code: "FILM_KRAFT_LAMINATE",
    name: { ar: "كرافت مبطن", en: "Kraft laminate" },
    structure: "kraft paper 50-70 g/m² / VMPET 12 / PE 70",
    barrier: "medium",
    whiteUnderlay: false,
    transparent: false,
    foodContact: true,
    render: { color: "#b98a5c", roughness: 0.92, metalness: 0, clearcoat: 0, clearcoatRoughness: 0.8, transmission: 0, opacity: 1 },
  },
  FILM_CLEAR: {
    code: "FILM_CLEAR",
    name: { ar: "فيلم شفاف", en: "Clear film" },
    structure: "PET 12 or PA 15 / PE 60-90",
    barrier: "low",
    whiteUnderlay: true,
    transparent: true,
    foodContact: true,
    render: { color: "#ffffff", roughness: 0.12, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.05, transmission: 0.85, opacity: 0.55 },
  },
};

export interface FilmMaterialOptions {
  /** Artwork texture covering the panel's print area. */
  map?: Texture;
  /** Window mask (white = opaque film, black = clear window). */
  alphaMap?: Texture;
  /** Crimp normal map for seals (texture.channel = 1). */
  normalMap?: Texture;
  doubleSided?: boolean;
}

/** three.js material for a film code. */
export function createFilmMaterial(code: FilmMaterialCode, opts: FilmMaterialOptions = {}): MeshPhysicalMaterial {
  const r = FILM_MATERIALS[code].render;
  const m = new MeshPhysicalMaterial({
    color: opts.map ? "#ffffff" : r.color,
    roughness: r.roughness,
    // printed metallised film carries a white underlay under the ink: it reads as printed film, not metal
    metalness: opts.map && code === "FILM_METALLISED" ? 0.12 : r.metalness,
    clearcoat: r.clearcoat,
    clearcoatRoughness: r.clearcoatRoughness,
    transmission: opts.map ? 0 : r.transmission,
    // printed film is opaque where it carries ink (white underlay); a mapped clear film keeps the
    // artwork's own alpha so only unprinted areas stay see-through
    transparent: r.opacity < 1 || !!opts.alphaMap,
    opacity: opts.map ? 1 : r.opacity,
    // printed clear film is single-sided: with DoubleSide the far face's artwork reads mirrored through the near one
    side: opts.doubleSided || (r.transmission > 0 && !opts.map) ? DoubleSide : FrontSide,
  });
  if (opts.map) m.map = opts.map;
  if (opts.alphaMap) m.alphaMap = opts.alphaMap;
  if (opts.normalMap) m.normalMap = opts.normalMap;
  return m;
}

/** Plain materials for hardware parts (zipper, valve, spout, tin tie, flap). */
export function createHardwareMaterial(role: "zipper" | "valve" | "spout" | "tinTie" | "flap" | "product"): MeshStandardMaterial {
  switch (role) {
    case "product":
      // neutral food tone seen through clear film (cheese, meat, snacks)
      return new MeshStandardMaterial({ color: "#d9b98a", roughness: 0.75, side: DoubleSide });
    case "valve":
      return new MeshStandardMaterial({ color: "#f2f2f2", roughness: 0.5 });
    case "spout":
      return new MeshStandardMaterial({ color: "#e8e8e8", roughness: 0.45 });
    case "tinTie":
      return new MeshStandardMaterial({ color: "#c9a14a", roughness: 0.4, metalness: 0.6, side: DoubleSide });
    case "flap":
      // R5-3Q-G: siliconised release liner over the adhesive strip is white / off-white paper, not a
      // dark grey band across the top of the print
      return new MeshStandardMaterial({ color: "#efede6", roughness: 0.6, side: DoubleSide });
    default:
      return new MeshStandardMaterial({ color: "#ffffff", roughness: 0.4, transparent: true, opacity: 0.35 });
  }
}
