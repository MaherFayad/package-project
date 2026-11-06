import { DataTexture, Group, LinearFilter, Mesh, RGBAFormat, type Texture } from "three";
import { buildFlexibleModel, crimpNormalTexture, type FlexModel } from "./geometry";
import { createFilmMaterial, createHardwareMaterial } from "./materials";
import type { FlexConfig } from "./schema";
import type { FlexPanelId } from "./types";

export interface FlexGroupOptions {
  /** Artwork per panel (each texture covers that panel's print area incl. bleed). */
  artwork?: Partial<Record<FlexPanelId, Texture>>;
  /** Window mask for the front (white = film, black = window). */
  windowMask?: Texture;
  /** Scale (default 0.001: mm -> metres, like the box engine). */
  scale?: number;
}

/** Ready-to-add three.js Group for a pack (one Mesh per part, named by part id). */
export function buildFlexibleGroup(cfg: FlexConfig, opts: FlexGroupOptions = {}): { group: Group; model: FlexModel } {
  const model = buildFlexibleModel(cfg);
  const group = new Group();
  group.name = `flexible-${cfg.code}`;
  const crimp = crimpNormalTexture();
  // R6-3Q-G: the renderer never passed a window mask, so the window option drew nothing. Build it
  // from the model's window rectangle when the caller has none.
  const windowMask = opts.windowMask ?? (model.windowUv ? windowMaskTexture(model.windowUv) : undefined);
  for (const part of model.parts) {
    let material;
    if (part.role === "face" || part.role === "seal" || part.role === "fin" || part.role === "base") {
      const map = part.panel ? opts.artwork?.[part.panel] : undefined;
      material = createFilmMaterial(cfg.material, {
        map,
        normalMap: part.role === "seal" && definitionCrimp(model) ? crimp : undefined,
        alphaMap: part.id === "face-front" ? windowMask : undefined,
        doubleSided: part.doubleSided,
      });
    } else {
      material = createHardwareMaterial(part.role);
    }
    const mesh = new Mesh(part.geometry, material);
    mesh.name = part.id;
    mesh.userData = { role: part.role, panel: part.panel };
    group.add(mesh);
  }
  group.scale.setScalar(opts.scale ?? 0.001);
  return { group, model };
}

function definitionCrimp(model: FlexModel) {
  return model.config.code !== "FLEX_MAILER_BAG" && model.config.code !== "FLEX_BAG_IN_BOX";
}

/** Clear film left in the window (alpha); the rest of the front is opaque printed film. */
export const WINDOW_FILM_ALPHA = 0.16;

/**
 * Window alpha mask in the front panel's UV space (white = printed film, dark = clear window).
 * DataTexture rows run bottom-up (flipY false), the same way as the panel UV's v.
 */
export function windowMaskTexture(w: { u0: number; v0: number; u1: number; v1: number }, size = 256): DataTexture {
  const data = new Uint8Array(size * size * 4);
  const clear = Math.round(WINDOW_FILM_ALPHA * 255);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size;
      const v = (y + 0.5) / size;
      const inside = u >= w.u0 && u <= w.u1 && v >= w.v0 && v <= w.v1;
      const a = inside ? clear : 255;
      const k = (y * size + x) * 4;
      data[k] = a;
      data[k + 1] = a;
      data[k + 2] = a;
      data[k + 3] = 255;
    }
  const tex = new DataTexture(data, size, size, RGBAFormat);
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearFilter;
  tex.needsUpdate = true;
  return tex;
}
