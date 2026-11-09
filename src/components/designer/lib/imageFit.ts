import type { ImageLayer, ImagePlace } from "@/types";

/**
 * Image on a side, the simple way (designer: image fit). An image layer can carry a placement
 * mode (`ImageLayer.place`):
 * - "fill": covers the whole side out to the bleed, centred, aspect kept, the overflow cropped.
 * - "fit": the whole image shows inside the side's safe zone, aspect kept, at a share (`scale`,
 *   0.1..1) of the biggest size that fits, centred unless placed elsewhere.
 * The mode is resolved into the layer's box (x, y, width, height, fit) when it is set and again on
 * every size change, so the 3D texture, the print PDF and preflight read plain boxes. A layer
 * without a mode is placed freely, as before.
 */

export interface PlaceMargins {
  safeMm: number;
  bleedMm: number;
}
type Size = { width: number; height: number };
type ImageSize = Pick<ImageLayer, "pxWidth" | "pxHeight" | "crop">;

/** An opaque photo whose shape is within this ratio of the side's shape fills it. */
export const FILL_MAX_ASPECT = 1.6;
/** ...and only when it still prints at least this sharp when filling it. */
export const FILL_MIN_DPI = 100;
/** A logo (transparent or on a plain background) starts at this share of the fit size. */
export const LOGO_FIT_SCALE = 0.6;
const TOL = 0.05;

/** Width / height of the part of the image that shows (crop aware). */
export function visibleAspect(img: ImageSize): number {
  const w = Math.max(1, img.pxWidth * (img.crop?.width ?? 1));
  const h = Math.max(1, img.pxHeight * (img.crop?.height ?? 1));
  return w / h;
}

/** What an image looks like, measured on upload (see `imageLook`). */
export interface ImageLook {
  /** Some pixels are see-through (a PNG logo). */
  transparent: boolean;
  /** The border is one flat colour (a logo on white). */
  plainEdges: boolean;
}

/**
 * The default for a fresh upload: Fit for logos (transparent, or on a plain background), for
 * images whose shape is far from the side's and for images too small to fill it sharply; Fill
 * for an opaque photo close to the side's shape.
 */
export function autoPlace(img: Pick<ImageLayer, "pxWidth" | "pxHeight">, look: ImageLook, face: Size, m: PlaceMargins): ImagePlace {
  if (look.transparent || look.plainEdges) return "fit";
  const fw = face.width + 2 * m.bleedMm;
  const fh = face.height + 2 * m.bleedMm;
  const r = visibleAspect(img) / (fw / fh);
  if (Math.max(r, 1 / r) > FILL_MAX_ASPECT) return "fit";
  const mmPerPx = Math.max(fw / Math.max(1, img.pxWidth), fh / Math.max(1, img.pxHeight));
  return 25.4 / mmPerPx < FILL_MIN_DPI ? "fit" : "fill";
}

/** The biggest box with the image's shape inside the side's safe zone. */
export function fitBox(img: ImageSize, face: Size, m: PlaceMargins): Size {
  const availW = Math.max(1, face.width - 2 * m.safeMm);
  const availH = Math.max(1, face.height - 2 * m.safeMm);
  const aspect = visibleAspect(img);
  const width = Math.min(availW, availH * aspect);
  return { width, height: width / aspect };
}

/** A Fit layer's size as a share (0..1] of its biggest fit box. */
export function fitScaleOf(layer: ImageLayer, face: Size, m: PlaceMargins): number {
  return Math.min(1, Math.max(0.1, layer.width / fitBox(layer, face, m).width));
}

function centreIn(at: number, size: number, faceSize: number, safe: number) {
  const lo = safe + size / 2;
  const hi = faceSize - safe - size / 2;
  return lo > hi ? faceSize / 2 : Math.min(hi, Math.max(lo, at));
}

/** Resolve a placement mode into the layer's box on a side of `face` size. */
export function placeImage(layer: ImageLayer, face: Size, m: PlaceMargins, mode: ImagePlace, opts: { scale?: number; at?: { x: number; y: number } } = {}): ImageLayer {
  if (mode === "fill") {
    return { ...layer, place: "fill", fit: "cover", rotation: 0, x: face.width / 2, y: face.height / 2, width: face.width + 2 * m.bleedMm, height: face.height + 2 * m.bleedMm };
  }
  const box = fitBox(layer, face, m);
  const k = Math.min(1, Math.max(0.1, opts.scale ?? 1));
  const width = box.width * k;
  const height = box.height * k;
  const at = opts.at ?? { x: face.width / 2, y: face.height / 2 };
  return {
    ...layer,
    place: "fit",
    fit: "contain",
    rotation: 0,
    width,
    height,
    x: centreIn(at.x, width, face.width, m.safeMm),
    y: centreIn(at.y, height, face.height, m.safeMm),
  };
}

/** Does the layer's box still match its mode (after a drag, a rotation, a typed size...)? */
export function keepsPlace(layer: ImageLayer, face: Size, m: PlaceMargins): boolean {
  if (!layer.place || layer.rotation) return false;
  if (layer.place === "fill") {
    const want = placeImage(layer, face, m, "fill");
    return Math.abs(layer.x - want.x) < TOL && Math.abs(layer.y - want.y) < TOL && Math.abs(layer.width - want.width) < TOL && Math.abs(layer.height - want.height) < TOL;
  }
  const box = fitBox(layer, face, m);
  const s = m.safeMm;
  return (
    Math.abs(layer.width / layer.height / visibleAspect(layer) - 1) < 0.01 &&
    layer.width <= box.width + TOL &&
    layer.x - layer.width / 2 >= s - TOL &&
    layer.y - layer.height / 2 >= s - TOL &&
    layer.x + layer.width / 2 <= face.width - s + TOL &&
    layer.y + layer.height / 2 <= face.height - s + TOL
  );
}

const sameCrop = (a: ImageLayer["crop"], b: ImageLayer["crop"]) =>
  a === b || (!!a && !!b && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height);

/**
 * After an edit: a new crop re-resolves the mode (Fill keeps covering, Fit keeps its share); any
 * other change that breaks the mode (dragged, rotated, stretched, a typed size) makes the image
 * freely placed from then on.
 */
export function settlePlace(before: ImageLayer | null, next: ImageLayer, face: Size, m: PlaceMargins): ImageLayer {
  if (!next.place) return next;
  if (before && !sameCrop(before.crop, next.crop)) {
    const scale = next.place === "fit" && before.place === "fit" ? fitScaleOf(before, face, m) : undefined;
    return placeImage(next, face, m, next.place, { scale, at: next.place === "fit" ? { x: next.x, y: next.y } : undefined });
  }
  if (keepsPlace(next, face, m)) return next;
  const free = { ...next };
  delete free.place;
  return free;
}

/** Keep the mode right when the side changes size (box dims, style). */
export function replaceOnResize(layer: ImageLayer, oldFace: Size, newFace: Size, m: PlaceMargins): ImageLayer {
  if (layer.place === "fill") return placeImage(layer, newFace, m, "fill");
  const scale = fitScaleOf(layer, oldFace, m);
  const at = { x: layer.x * (newFace.width / oldFace.width), y: layer.y * (newFace.height / oldFace.height) };
  return placeImage(layer, newFace, m, "fit", { scale, at });
}
