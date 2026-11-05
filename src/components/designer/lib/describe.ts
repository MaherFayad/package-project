import type { ArtworkLayer, FaceId, PrintSurface } from "@/types";
import type { DictKey, TFunction } from "@/i18n/types";
import { formatNumber } from "@/lib/format";

export type PositionKey =
  | "top-left"
  | "top-center"
  | "top-right"
  | "middle-left"
  | "middle-center"
  | "middle-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

/** Where a layer's centre sits on its face, in thirds (as seen from outside; never mirrored). */
export function positionKey(l: Pick<ArtworkLayer, "x" | "y">, face: { width: number; height: number }): PositionKey {
  const col = l.x < face.width / 3 ? "left" : l.x > (face.width * 2) / 3 ? "right" : "center";
  const row = l.y < face.height / 3 ? "top" : l.y > (face.height * 2) / 3 ? "bottom" : "middle";
  return `${row}-${col}` as PositionKey;
}

const mm = (n: number) => formatNumber(Math.round(n));

/** Short label for a layer ("Text “Bloom”", "Image"). */
export function layerName(l: ArtworkLayer, t: TFunction): string {
  if (l.kind === "text") {
    const txt = l.text.trim().replace(/\s+/g, " ");
    return `${t("designer.layer.text")} “${txt.length > 24 ? `${txt.slice(0, 23)}…` : txt}”`;
  }
  if (l.kind === "image") return t("designer.layer.image");
  return t(l.shape === "ellipse" ? "designer.artwork.ellipse" : "designer.artwork.rect");
}

/** Full sentence for one layer, e.g. "Image, 60 × 40 mm, centred, rotated 15°". */
export function describeLayer(l: ArtworkLayer, face: { width: number; height: number }, t: TFunction): string {
  const pos = t(`designer.describe.pos.${positionKey(l, face)}` as DictKey);
  let s: string;
  if (l.kind === "text") {
    const txt = l.text.trim().replace(/\s+/g, " ");
    s = t("designer.describe.text", { text: txt.length > 40 ? `${txt.slice(0, 39)}…` : txt, size: formatNumber(l.fontSizePt, 1), pos });
  } else if (l.kind === "image") {
    s = t("designer.describe.image", { w: mm(l.width), h: mm(l.height), pos });
  } else {
    s = t("designer.describe.shape", { shape: layerName(l, t), w: mm(l.width), h: mm(l.height), pos });
  }
  const sep = t("designer.describe.sep");
  const rot = Math.round(l.rotation);
  if (rot % 360 !== 0) s += sep + t("designer.describe.rotated", { deg: rot });
  if (l.hidden) s += sep + t("designer.describe.hidden");
  return s;
}

export interface FaceDescription {
  face: FaceId;
  surface: PrintSurface;
  heading: string;
  summary: string;
  items: { id: string; text: string; layer: ArtworkLayer }[];
}

/** Accessible description of one panel and everything on it (top-most item first). */
export function describeFace(
  face: FaceId,
  surface: PrintSurface,
  size: { width: number; height: number },
  layers: ArtworkLayer[],
  t: TFunction,
): FaceDescription {
  const on = layers.filter((l) => l.face === face && l.surface === surface).reverse();
  const heading = t("designer.describe.face", { face: t(`designer.faces.${face}` as DictKey), w: mm(size.width), h: mm(size.height) });
  const summary = on.length === 0 ? t("designer.layers.empty") : on.length === 1 ? t("designer.describe.oneItem") : t("designer.describe.items", { count: on.length });
  return { face, surface, heading, summary, items: on.map((l) => ({ id: l.id, text: describeLayer(l, size, t), layer: l })) };
}
