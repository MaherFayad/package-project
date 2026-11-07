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
  // R5-3Q-G-21: the window option cut nothing: the front film now carries an alpha mask built from
  // the model's windowUv (the unprinted clear window) unless the caller brings its own.
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

/**
 * Alpha mask for the front face: white (opaque printed film) with the window rectangle at ~12 %
 * (clear film: still shows its gloss), in the face's UV space. alphaMap reads the green channel;
 * a DataTexture is not flipped, so row 0 is v = 0.
 */
export function windowMaskTexture(w: { u0: number; v0: number; u1: number; v1: number }, size = 256): DataTexture {
  const data = new Uint8Array(size * size * 4);
  const [ua, ub] = [Math.min(w.u0, w.u1), Math.max(w.u0, w.u1)];
  const [va, vb] = [Math.min(w.v0, w.v1), Math.max(w.v0, w.v1)];
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size;
      const v = (y + 0.5) / size;
      const a = u >= ua && u <= ub && v >= va && v <= vb ? 30 : 255;
      const k = (y * size + x) * 4;
      data[k] = data[k + 1] = data[k + 2] = a;
      data[k + 3] = 255;
    }
  const tex = new DataTexture(data, size, size, RGBAFormat);
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearFilter;
  tex.needsUpdate = true;
  return tex;
}
