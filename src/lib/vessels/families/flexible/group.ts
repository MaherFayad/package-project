import { Group, Mesh, type Texture } from "three";
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
  for (const part of model.parts) {
    let material;
    if (part.role === "face" || part.role === "seal" || part.role === "fin" || part.role === "base") {
      const map = part.panel ? opts.artwork?.[part.panel] : undefined;
      material = createFilmMaterial(cfg.material, {
        map,
        normalMap: part.role === "seal" && definitionCrimp(model) ? crimp : undefined,
        alphaMap: part.id === "face-front" ? opts.windowMask : undefined,
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
