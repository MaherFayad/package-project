import {
  CanvasTexture,
  Color,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  type Material,
  type Texture,
} from "three";
import type { FinishCode } from "@/types";
import { finishSurface, type BoardAppearance } from "@/lib/dieline";

/** Material slots used by panel geometry groups. */
export const MAT_OUTSIDE = 0;
export const MAT_INSIDE = 1;
export const MAT_EDGE = 2;

export interface BoardMaterialSet {
  /** [outside, inside, edge] — matches the panel geometry groups. */
  list: [Material, Material, Material];
  dispose(): void;
}

function makeCanvas(w: number, h: number): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

/** Cheap fibre/noise tile for unprinted board (repeats every ~40 mm). */
function fibreTexture(base: string, strength: number, sheet: { width: number; height: number }): Texture | null {
  const size = 128;
  const c = makeCanvas(size, size);
  const ctx = c?.getContext("2d");
  if (!c || !ctx) return null;
  // createImageData + manual fill: getImageData would read back from a GPU canvas (pipeline stall)
  const rgb = { r: 0, g: 0, b: 0 };
  new Color(base).getRGB(rgb, SRGBColorSpace);
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    img.data[i] = rgb.r * 255;
    img.data[i + 1] = rgb.g * 255;
    img.data[i + 2] = rgb.b * 255;
    img.data[i + 3] = 255;
  }
  // Deterministic LCG so every load looks the same.
  let seed = 1234567;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rnd() - 0.5) * 2 * strength;
    img.data[i] = Math.max(0, Math.min(255, img.data[i] + n));
    img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n * 0.9));
    img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n * 0.7));
  }
  ctx.putImageData(img, 0, 0);
  // a few longer fibres
  ctx.globalAlpha = 0.08;
  ctx.strokeStyle = "#000";
  for (let i = 0; i < 60; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const a = rnd() * Math.PI;
    const l = 4 + rnd() * 10;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.repeat.set(sheet.width / 40, sheet.height / 40);
  tex.anisotropy = 4;
  return tex;
}

/**
 * Corrugated cut edge: liners top and bottom with the flute wave between.
 * Edge UVs run u = mm along the edge / flute pitch, v = 0 (printed side) … 1 (inside).
 */
function fluteTexture(edge: string, flute: string, liner: string, inner: string = liner): Texture | null {
  const w = 64;
  const h = 32;
  const c = makeCanvas(w, h);
  const ctx = c?.getContext("2d");
  if (!c || !ctx) return null;
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, w, h);
  // dark gaps between flutes
  ctx.fillStyle = "rgba(60,40,20,0.35)";
  ctx.fillRect(0, 4, w, h - 8);
  ctx.strokeStyle = flute;
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let x = 0; x <= w; x++) {
    const y = h / 2 + Math.sin((x / w) * Math.PI * 2) * (h / 2 - 5);
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.fillStyle = liner;
  ctx.fillRect(0, 0, w, 4);
  // the inside liner keeps its own colour (white-top board is white on the print side only)
  ctx.fillStyle = inner;
  ctx.fillRect(0, h - 4, w, 4);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = RepeatWrapping;
  tex.anisotropy = 2;
  return tex;
}

export interface BoardMaterialInput {
  appearance: BoardAppearance;
  finish?: FinishCode;
  outsideMap?: Texture | null;
  insideMap?: Texture | null;
  sheet: { width: number; height: number };
  /** Show the inside print only when the design prints both sides. */
  printInside?: boolean;
}

/** Build PBR materials for a board. Call `dispose()` when done. */
export function createBoardMaterials(input: BoardMaterialInput): BoardMaterialSet {
  const { appearance, finish, sheet } = input;
  const surface = finishSurface(finish, appearance);
  const owned: (Material | Texture)[] = [];

  const outsideMap = input.outsideMap ?? fibreTexture(appearance.outside, appearance.fluteColor ? 10 : 3, sheet);
  if (!input.outsideMap && outsideMap) owned.push(outsideMap);
  // (Ink-on-kraft tinting lives in the finished-board shader, which can tell printed pixels from the
  // liner-coloured background; configurator boards always render through it.)
  const outsideParams = {
    color: new Color(outsideMap ? "#ffffff" : appearance.outside),
    map: outsideMap ?? null,
    roughness: surface.roughness,
    metalness: 0,
  };
  const outside =
    surface.clearcoat > 0
      ? new MeshPhysicalMaterial({ ...outsideParams, clearcoat: surface.clearcoat, clearcoatRoughness: Math.max(0.08, surface.roughness * 0.6) })
      : new MeshStandardMaterial(outsideParams);

  const insideTex = input.printInside && input.insideMap ? input.insideMap : fibreTexture(appearance.inside, appearance.fluteColor ? 10 : 3, sheet);
  if (insideTex && insideTex !== input.insideMap) owned.push(insideTex);
  const inside = new MeshStandardMaterial({
    color: new Color(insideTex ? "#ffffff" : appearance.inside),
    map: insideTex ?? null,
    roughness: input.printInside && input.insideMap ? surface.roughness : 0.95,
    metalness: 0,
  });

  const edgeTex = appearance.fluteColor ? fluteTexture(appearance.edge, appearance.fluteColor, appearance.outside, appearance.inside) : null;
  if (edgeTex) owned.push(edgeTex);
  const edge = new MeshStandardMaterial({
    color: new Color(edgeTex ? "#ffffff" : appearance.edge),
    map: edgeTex,
    roughness: 0.95,
    metalness: 0,
  });
  owned.push(outside, inside, edge);

  return {
    list: [outside, inside, edge],
    dispose() {
      for (const o of owned) o.dispose();
    },
  };
}

/** Configure a texture that holds an artwork canvas (sRGB, mipmaps, anisotropy). */
export function configureArtworkTexture(tex: Texture, anisotropy = 4): Texture {
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = anisotropy;
  tex.generateMipmaps = true;
  return tex;
}
