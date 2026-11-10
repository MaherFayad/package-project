import { z } from "zod";
import {
  FACE_IDS,
  FINISH_CODES,
  MATERIAL_CODES,
  STRUCTURE_CODES,
  emptyArtwork,
  type ArtworkLayer,
  type DesignDoc,
  type Dims,
  type FaceId,
  type FinishCode,
  type ImageLayer,
  type MaterialCode,
  type PrintSides,
  type PrintSurface,
  type ShapeLayer,
  type StructureCode,
  type TextLayer,
} from "@/types";
import { DEFAULT_DIMS, defaultMaterialFor, materialFitsStructure } from "@/lib/dieline";
import { DESIGN_FINISH_CODES } from "@/types";
import type { ModelDef } from "@/lib/library";
import { modelByCode, modelSourceOf } from "@/lib/library/registry";
import { baseOf, vesselPrintMaterials } from "@/lib/library/doc";
import { fitScaleOf, placeImage, replaceOnResize, type PlaceMargins } from "./imageFit";

/** Max items per design (both sides together). Keeps saves and textures small. */
export const MAX_LAYERS = 60;
/** Max characters of a data: URL image (≈ 6 MB of base64). */
export const MAX_IMAGE_SRC = 8_000_000;
/** Max characters in one text item. */
export const MAX_TEXT = 500;

/** Face sizes in mm, from `DielineModel.faces`. */
export type FaceSizes = Partial<Record<FaceId, { width: number; height: number }>>;

export function newId(prefix = "l"): string {
  const rnd =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return `${prefix}_${rnd}`;
}

/**
 * Added by 3D integration: a new design for ANY library model (core structure, family box
 * style or container). Boxes start at the model's default (or given) size and first board;
 * containers at their default preset with their default print surfaces.
 */
export function createModelDoc(m: ModelDef, input: { dims?: Dims; materialCode?: MaterialCode; presetId?: string; name?: string } = {}): DesignDoc {
  if (m.kind === "box") {
    const materialCode = input.materialCode && m.materials.includes(input.materialCode) ? input.materialCode : m.materials[0];
    const preset = input.presetId ? m.presets.find((p) => p.id === input.presetId) : undefined;
    const dims = input.dims ?? preset?.dims ?? m.presets.find((p) => p.standard)?.dims ?? m.defaultDims;
    return {
      v: 1,
      name: input.name ?? "",
      structureCode: m.baseFor(materialCode),
      ...(m.source === "core" ? {} : { modelCode: m.code }),
      dims: { ...dims },
      materialCode,
      finishCode: "NONE",
      printSides: "OUTSIDE",
      artwork: emptyArtwork(),
      ...(m.code === "GABLE_BOX" ? { features: { handle: true } } : {}),
    };
  }
  const preset = m.presets.find((p) => p.id === (input.presetId ?? m.defaultPresetId)) ?? m.presets[0];
  const surfaces = [...m.defaultSurfaces];
  const allowed = vesselPrintMaterials(m, surfaces);
  const materialCode = input.materialCode && allowed.includes(input.materialCode) ? input.materialCode : allowed[0];
  return {
    v: 1,
    name: input.name ?? "",
    structureCode: baseOf(m, materialCode),
    modelCode: m.code,
    dims: { L: 100, W: 1, H: 100 },
    materialCode,
    finishCode: "NONE",
    printSides: "OUTSIDE",
    artwork: emptyArtwork(),
    vessel: {
      dims: { ...preset.dims },
      presetId: preset.id,
      container: m.defaultContainer,
      closure: m.defaultClosure,
      closureColor: m.closures.find((c) => c.code === m.defaultClosure)?.defaultColor ?? "WHITE",
      content: m.defaultLiquid,
      fill: m.fillable ? 0.8 : 0,
      surfaces,
    },
  };
}

export function createDesignDoc(input: {
  structureCode: StructureCode;
  dims?: Dims;
  materialCode?: MaterialCode;
  finishCode?: FinishCode;
  printSides?: PrintSides;
  name?: string;
}): DesignDoc {
  const material =
    input.materialCode && materialFitsStructure(input.materialCode, input.structureCode)
      ? input.materialCode
      : defaultMaterialFor(input.structureCode);
  return {
    v: 1,
    name: input.name ?? "",
    structureCode: input.structureCode,
    dims: { ...(input.dims ?? DEFAULT_DIMS[input.structureCode]) },
    materialCode: material,
    finishCode: input.finishCode ?? "NONE",
    printSides: input.printSides ?? "OUTSIDE",
    artwork: emptyArtwork(),
  };
}

// ───────────────────────── validation (API boundary + localStorage) ─────────────────────────

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const pct = z.number().finite().min(0).max(100);
/** A saved brand colour (designer: brand colours). The spot reference is free text for the printer. */
export const brandColorSchema = z.object({
  name: z.string().trim().min(1).max(40),
  hex,
  cmyk: z.tuple([pct, pct, pct, pct]).optional(),
  spot: z.string().trim().max(60).optional(),
});
export const MAX_BRAND_COLORS = 12;
const mm = z.number().finite().min(-5000).max(5000);
const size = z.number().finite().min(0.5).max(5000);

const base = {
  id: z.string().min(1).max(64).regex(/^[\w-]+$/),
  face: z.enum(FACE_IDS),
  surface: z.enum(["outside", "inside"]),
  x: mm,
  y: mm,
  width: size,
  height: size,
  rotation: z.number().finite().min(-3600).max(3600),
  opacity: z.number().min(0).max(1).optional(),
  locked: z.boolean().optional(),
  hidden: z.boolean().optional(),
};

/** Only raster data URLs (SVGs are rasterised on upload) or same-origin paths are stored. */
const imageSrc = z
  .string()
  .max(MAX_IMAGE_SRC)
  .refine((s) => /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(s) || /^\/[\w\-./]+\.(png|jpe?g|webp|svg)$/.test(s), {
    message: "INVALID_IMAGE_SRC",
  });

export const imageLayerSchema = z.object({
  ...base,
  kind: z.literal("image"),
  src: imageSrc,
  pxWidth: z.number().int().min(1).max(20000),
  pxHeight: z.number().int().min(1).max(20000),
  fit: z.enum(["contain", "cover", "stretch"]).optional(),
  place: z.enum(["fill", "fit"]).optional(),
  crop: z
    .object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), width: z.number().min(0.01).max(1), height: z.number().min(0.01).max(1) })
    .refine((c) => c.x + c.width <= 1.0001 && c.y + c.height <= 1.0001, { message: "CROP_OUTSIDE" })
    .optional(),
});

export const textLayerSchema = z.object({
  ...base,
  kind: z.literal("text"),
  text: z.string().max(MAX_TEXT),
  fontFamily: z.enum(["IBM Plex Sans Arabic", "Inter"]),
  fontSizePt: z.number().finite().min(1).max(400),
  fontWeight: z.union([z.literal(400), z.literal(500), z.literal(600), z.literal(700)]),
  color: hex,
  align: z.enum(["start", "center", "end"]),
  direction: z.enum(["rtl", "ltr", "auto"]),
});

export const shapeLayerSchema = z.object({
  ...base,
  kind: z.literal("shape"),
  shape: z.enum(["rect", "ellipse", "line"]),
  fill: hex.nullable(),
  stroke: hex.nullable(),
  strokeWidthMm: z.number().finite().min(0).max(100),
});

export const layerSchema = z.discriminatedUnion("kind", [imageLayerSchema, textLayerSchema, shapeLayerSchema]);

/** Full artwork over the sheet (designer), with the dieline remap's original and recipe. */
export const sheetImageSchema = z
    .object({
      src: imageSrc,
      pxWidth: z.number().int().min(1).max(20000),
      pxHeight: z.number().int().min(1).max(20000),
      // designer: dieline remap (the upload as made on the printer's template, and how src was made from it)
      original: z.object({ src: imageSrc, pxWidth: z.number().int().min(1).max(20000), pxHeight: z.number().int().min(1).max(20000) }).nullable().optional(),
      remap: z
        .object({
          mode: z.enum(["model", "faces"]),
          code: z.string().max(80).optional(),
          target: z.string().max(400),
          sourcePxPerMm: z.number().min(0).max(1000),
          source: z.record(z.string(), z.unknown()).refine((v) => JSON.stringify(v).length <= 80_000, "remap source too large"),
        })
        .nullable()
        .optional(),
    });

const surfaceSchema = z.object({
  background: hex.nullable(),
  layers: z.array(layerSchema).max(MAX_LAYERS),
  sheetImage: sheetImageSchema.nullable().optional(),
});

const featuresSchema = z
  .object({
    window: z
      .object({ face: z.enum(FACE_IDS), widthRatio: z.number().min(0.1).max(0.9).optional(), heightRatio: z.number().min(0.1).max(0.9).optional(), film: z.boolean().optional() })
      .nullable()
      .optional(),
    thumbNotch: z.boolean().optional(),
    handle: z.boolean().optional(),
    tearStrip: z.boolean().optional(),
    partitions: z.object({ rows: z.number().int().min(1).max(8), cols: z.number().int().min(1).max(8) }).nullable().optional(),
    lidHeightMm: z.number().finite().positive().max(1000).optional(),
    displayFront: z.boolean().optional(),
  })
  .strip();

const designFinishSchema = z.object({
  code: z.enum(DESIGN_FINISH_CODES),
  mask: z.object({ surface: z.enum(["outside", "inside"]), layerIds: z.array(z.string().max(128)).max(200) }).optional(),
});

const vMm = z.number().finite().min(0).max(2000);
const vesselSchema = z.object({
  dims: z.object({ D: vMm, H: vMm, G: vMm.optional(), taper: vMm.optional() }),
  presetId: z.string().max(64).optional(),
  container: z.string().max(64),
  closure: z.string().max(64),
  closureColor: z.string().max(32),
  content: z.string().max(32),
  fill: z.number().min(0).max(1),
  surfaces: z.array(z.string().max(32)).min(1).max(8),
  options: z.record(z.string().max(32), z.union([z.boolean(), z.string().max(16)])).optional(),
});

/** Design.config (+ modelCode column): the DesignDoc fields added by the model library. */
export const designConfigSchema = z.object({
  modelCode: z.string().max(64).optional(),
  features: featuresSchema.optional(),
  finishes: z.array(designFinishSchema).max(12).optional(),
  vessel: vesselSchema.optional(),
  brandColors: z.array(brandColorSchema).max(MAX_BRAND_COLORS).optional(),
});

export const designDocSchema = z
  .object({
    v: z.literal(1),
    id: z.string().max(64).optional(),
    name: z.string().max(120),
    structureCode: z.enum(STRUCTURE_CODES),
    dims: z.object({ L: size, W: size, H: size }),
    materialCode: z.enum(MATERIAL_CODES),
    finishCode: z.enum(FINISH_CODES),
    printSides: z.enum(["OUTSIDE", "BOTH"]),
    artwork: z.object({ outside: surfaceSchema, inside: surfaceSchema }),
    // Added by 3D integration.
    modelCode: z.string().max(64).optional(),
    features: featuresSchema.optional(),
    finishes: z.array(designFinishSchema).max(12).optional(),
    vessel: vesselSchema.optional(),
    brandColors: z.array(brandColorSchema).max(MAX_BRAND_COLORS).optional(),
  })
  .refine((d) => d.artwork.outside.layers.length + d.artwork.inside.layers.length <= MAX_LAYERS, {
    message: "TOO_MANY_LAYERS",
  })
  .refine((d) => materialFitsStructure(d.materialCode, d.structureCode), { message: "MATERIAL_MISMATCH", path: ["materialCode"] })
  .refine((d) => modelFits(d), { message: "MODEL_MISMATCH", path: ["modelCode"] });

/** A library model, its board / print material and its base structure agree. */
function modelFits(d: { modelCode?: string; structureCode: StructureCode; materialCode: MaterialCode; vessel?: unknown }): boolean {
  if (!d.modelCode) return true;
  const m = modelByCode(d.modelCode);
  // In the browser only the open family is loaded (PERF-04): accept a known code here; the server
  // (eager library) validates fully on save.
  if (!m) return typeof window !== "undefined" && !!modelSourceOf(d.modelCode);
  if (m.kind === "box") return m.materials.includes(d.materialCode) && m.baseFor(d.materialCode) === d.structureCode;
  return !!d.vessel && vesselPrintMaterials(m).concat(vesselPrintMaterials(m, ["SHRINK_SLEEVE"])).includes(d.materialCode) && baseOf(m, d.materialCode) === d.structureCode;
}

/** Parse untrusted JSON into a DesignDoc, or null. */
export function parseDesignDoc(value: unknown): DesignDoc | null {
  const r = designDocSchema.safeParse(value);
  return r.success ? (r.data as DesignDoc) : null;
}

// ───────────────────────── layer helpers ─────────────────────────

export function allLayers(doc: DesignDoc): ArtworkLayer[] {
  return [...doc.artwork.outside.layers, ...doc.artwork.inside.layers];
}

export function findLayer(doc: DesignDoc, id: string | null | undefined): ArtworkLayer | null {
  if (!id) return null;
  return allLayers(doc).find((l) => l.id === id) ?? null;
}

export function layerCount(doc: DesignDoc): number {
  return doc.artwork.outside.layers.length + doc.artwork.inside.layers.length;
}

/** Immutably apply `fn` to the layer with `id` (on whichever surface holds it). */
export function updateLayer(doc: DesignDoc, id: string, patch: Partial<ArtworkLayer> | ((l: ArtworkLayer) => ArtworkLayer)): DesignDoc {
  const apply = (layers: ArtworkLayer[]) =>
    layers.map((l) => (l.id === id ? (typeof patch === "function" ? patch(l) : ({ ...l, ...patch } as ArtworkLayer)) : l));
  return {
    ...doc,
    artwork: {
      outside: { ...doc.artwork.outside, layers: apply(doc.artwork.outside.layers) },
      inside: { ...doc.artwork.inside, layers: apply(doc.artwork.inside.layers) },
    },
  };
}

export function addLayer(doc: DesignDoc, layer: ArtworkLayer): DesignDoc {
  if (layerCount(doc) >= MAX_LAYERS) return doc;
  const s = doc.artwork[layer.surface];
  return { ...doc, artwork: { ...doc.artwork, [layer.surface]: { ...s, layers: [...s.layers, layer] } } };
}

export function removeLayer(doc: DesignDoc, id: string): DesignDoc {
  const f = (layers: ArtworkLayer[]) => layers.filter((l) => l.id !== id);
  return {
    ...doc,
    artwork: {
      outside: { ...doc.artwork.outside, layers: f(doc.artwork.outside.layers) },
      inside: { ...doc.artwork.inside, layers: f(doc.artwork.inside.layers) },
    },
  };
}

/** Move a layer up (+1, toward the top of the stack) or down (-1) within its surface. */
export function reorderLayer(doc: DesignDoc, id: string, delta: 1 | -1): DesignDoc {
  const layer = findLayer(doc, id);
  if (!layer) return doc;
  const layers = [...doc.artwork[layer.surface].layers];
  const i = layers.findIndex((l) => l.id === id);
  const j = i + delta;
  if (j < 0 || j >= layers.length) return doc;
  [layers[i], layers[j]] = [layers[j], layers[i]];
  return { ...doc, artwork: { ...doc.artwork, [layer.surface]: { ...doc.artwork[layer.surface], layers } } };
}

export function duplicateLayer(doc: DesignDoc, id: string, offsetMm = 5): { doc: DesignDoc; id: string | null } {
  const layer = findLayer(doc, id);
  if (!layer || layerCount(doc) >= MAX_LAYERS) return { doc, id: null };
  const copy = { ...layer, id: newId(), x: layer.x + offsetMm, y: layer.y + offsetMm } as ArtworkLayer;
  return { doc: addLayer(doc, copy), id: copy.id };
}

/**
 * "Put it on every side": copy an item onto every other outside side (not the bottom) that is at
 * least `minMm` on both edges and does not carry the same picture or text yet. Each copy takes the
 * same share of its side's width as the original (capped at 80 % of the side's height), centred.
 */
export function copyToSides(doc: DesignDoc, id: string, faces: FaceSizes, minMm = 25, margins?: PlaceMargins): { doc: DesignDoc; added: number } {
  const layer = findLayer(doc, id);
  const from = layer ? faces[layer.face] : undefined;
  if (!layer || !from || layer.surface !== "outside") return { doc, added: 0 };
  const same = (l: ArtworkLayer) =>
    l.kind === layer.kind && (l.kind === "image" ? l.src === (layer as ImageLayer).src : l.kind === "text" ? l.text === (layer as TextLayer).text : false);
  let next = doc;
  let added = 0;
  for (const f of FACE_IDS) {
    const size = faces[f];
    if (f === layer.face || f === "bottom" || !size || size.width < minMm || size.height < minMm) continue;
    if (next.artwork.outside.layers.some((l) => l.face === f && same(l))) continue;
    if (layerCount(next) >= MAX_LAYERS) break;
    let k = (size.width * (layer.width / from.width)) / layer.width;
    if (layer.height * k > size.height * 0.8) k = (size.height * 0.8) / layer.height;
    let copy = { ...layer, id: newId(), face: f, x: size.width / 2, y: size.height / 2, width: layer.width * k, height: layer.height * k } as ArtworkLayer;
    // An image with a Fill / Fit mode keeps it on every side (image fit).
    if (copy.kind === "image" && copy.place && margins) {
      const scale = copy.place === "fit" ? fitScaleOf(layer as ImageLayer, from, margins) : undefined;
      copy = placeImage(copy, size, margins, copy.place, { scale });
    }
    if (copy.kind === "text") copy.fontSizePt = Math.max(4, Math.round(copy.fontSizePt * k * 10) / 10);
    next = addLayer(next, copy);
    added++;
  }
  return { doc: next, added };
}

export function setBackground(doc: DesignDoc, surface: PrintSurface, color: string | null): DesignDoc {
  return { ...doc, artwork: { ...doc.artwork, [surface]: { ...doc.artwork[surface], background: color } } };
}

// ───────────────────────── factories ─────────────────────────

const PT_PER_MM = 72 / 25.4;
const ARABIC = /[؀-ۿ]/;

export function makeTextLayer(face: FaceId, surface: PrintSurface, faceSize: { width: number; height: number }, text: string): TextLayer {
  const arabic = ARABIC.test(text);
  // About a fifth of the shorter side, between 8 and 72 pt.
  const sizePt = Math.round(Math.min(72, Math.max(8, Math.min(faceSize.width, faceSize.height) * 0.2 * PT_PER_MM)));
  const sizeMm = sizePt / PT_PER_MM;
  return {
    id: newId(),
    kind: "text",
    face,
    surface,
    x: faceSize.width / 2,
    y: faceSize.height / 2,
    width: Math.max(10, Math.min(faceSize.width * 0.8, sizeMm * Math.max(4, text.length) * 0.65)),
    height: sizeMm * 1.4,
    rotation: 0,
    text,
    fontFamily: arabic ? "IBM Plex Sans Arabic" : "Inter",
    fontSizePt: sizePt,
    fontWeight: 700,
    color: "#303030",
    align: "center",
    direction: "auto",
  };
}

/** An image sized to half the face (keeping aspect), centred. */
export function makeImageLayer(
  face: FaceId,
  surface: PrintSurface,
  faceSize: { width: number; height: number },
  img: { src: string; pxWidth: number; pxHeight: number },
): ImageLayer {
  const aspect = img.pxWidth / img.pxHeight;
  let w = faceSize.width * 0.5;
  let h = w / aspect;
  if (h > faceSize.height * 0.5) {
    h = faceSize.height * 0.5;
    w = h * aspect;
  }
  return {
    id: newId(),
    kind: "image",
    face,
    surface,
    x: faceSize.width / 2,
    y: faceSize.height / 2,
    width: w,
    height: h,
    rotation: 0,
    src: img.src,
    pxWidth: img.pxWidth,
    pxHeight: img.pxHeight,
    fit: "contain",
  };
}

export function makeShapeLayer(face: FaceId, surface: PrintSurface, faceSize: { width: number; height: number }, shape: "rect" | "ellipse", fill = "#303030"): ShapeLayer {
  const s = Math.min(faceSize.width, faceSize.height) * 0.4;
  return {
    id: newId(),
    kind: "shape",
    face,
    surface,
    x: faceSize.width / 2,
    y: faceSize.height / 2,
    width: s,
    height: s,
    rotation: 0,
    shape,
    fill,
    stroke: null,
    strokeWidthMm: 0,
  };
}

// ───────────────────────── geometry changes ─────────────────────────

/**
 * Keep artwork where the user put it after a size or style change: positions scale with the
 * face, sizes are kept unless the item no longer fits (then it shrinks, keeping its aspect).
 * Items on faces the new style does not have are removed; `removed` counts them.
 */
export function rescaleArtwork(doc: DesignDoc, oldFaces: FaceSizes, newFaces: FaceSizes, margins?: PlaceMargins): { doc: DesignDoc; removed: number } {
  let removed = 0;
  const fix = (layers: ArtworkLayer[]) =>
    layers.flatMap((l) => {
      const nf = newFaces[l.face];
      if (!nf) {
        removed++;
        return [];
      }
      const of = oldFaces[l.face] ?? nf;
      // Fill / Fit images are placed again on the new side (image fit).
      if (l.kind === "image" && l.place && margins) return [replaceOnResize(l, of, nf, margins)];
      const sx = nf.width / of.width;
      const sy = nf.height / of.height;
      const fit = Math.min(1, nf.width / l.width, nf.height / l.height);
      const next = { ...l, x: l.x * sx, y: l.y * sy, width: l.width * fit, height: l.height * fit } as ArtworkLayer;
      if (next.kind === "text" && fit < 1) next.fontSizePt = Math.max(4, Math.round(next.fontSizePt * fit * 10) / 10);
      return [next];
    });
  const out: DesignDoc = {
    ...doc,
    artwork: {
      outside: { ...doc.artwork.outside, layers: fix(doc.artwork.outside.layers) },
      inside: { ...doc.artwork.inside, layers: fix(doc.artwork.inside.layers) },
    },
  };
  return { doc: out, removed };
}

/** Face sizes from a dieline model's `faces`. */
export function faceSizesOf(faces: Partial<Record<FaceId, { width: number; height: number }>> | null | undefined): FaceSizes {
  const out: FaceSizes = {};
  for (const f of FACE_IDS) {
    const info = faces?.[f];
    if (info) out[f] = { width: info.width, height: info.height };
  }
  return out;
}

/** Strip data: URLs (for a quota-limited localStorage copy). */
export function withoutInlineImages(doc: DesignDoc): DesignDoc {
  const f = (layers: ArtworkLayer[]) => layers.filter((l) => !(l.kind === "image" && l.src.startsWith("data:")));
  return {
    ...doc,
    artwork: {
      outside: { ...doc.artwork.outside, layers: f(doc.artwork.outside.layers) },
      inside: { ...doc.artwork.inside, layers: f(doc.artwork.inside.layers) },
    },
  };
}
