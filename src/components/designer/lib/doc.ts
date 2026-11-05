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

const surfaceSchema = z.object({
  background: hex.nullable(),
  layers: z.array(layerSchema).max(MAX_LAYERS),
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
  })
  .refine((d) => d.artwork.outside.layers.length + d.artwork.inside.layers.length <= MAX_LAYERS, {
    message: "TOO_MANY_LAYERS",
  })
  .refine((d) => materialFitsStructure(d.materialCode, d.structureCode), { message: "MATERIAL_MISMATCH", path: ["materialCode"] });

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
export function rescaleArtwork(doc: DesignDoc, oldFaces: FaceSizes, newFaces: FaceSizes): { doc: DesignDoc; removed: number } {
  let removed = 0;
  const fix = (layers: ArtworkLayer[]) =>
    layers.flatMap((l) => {
      const nf = newFaces[l.face];
      if (!nf) {
        removed++;
        return [];
      }
      const of = oldFaces[l.face] ?? nf;
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
