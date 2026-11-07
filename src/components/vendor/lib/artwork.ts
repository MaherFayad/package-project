/**
 * P-01 (simplicity 2026-11): what the buyer put on each face, read from the approved proof
 * snapshot, so a printer can see the artwork before accepting. Pure, no DB.
 * The print-ready PDF stays locked until acceptance; this is a preview only.
 */
import type { DesignDoc, FaceId, PrintSurface } from "@/types";

export interface FaceArtworkDTO {
  surface: PrintSurface;
  face: FaceId;
  /** Small image layers (logos, photos) safe to show in an <img>; never SVG. */
  images: string[];
  /** Images too large (or of an unsafe type) to inline; counted only. */
  moreImages: number;
  texts: string[];
  shapes: number;
}

export interface ArtworkSummaryDTO {
  faces: FaceArtworkDTO[];
  /** Surface background colours (#RRGGBB), when the buyer set one. */
  backgrounds: Partial<Record<PrintSurface, string>>;
  /** A full-sheet print file laid over the dieline. */
  sheetImage: Partial<Record<PrintSurface, string | true>>;
}

const MAX_INLINE_BYTES = 200_000;
const MAX_IMAGES = 8;
const MAX_TEXT = 80;

/** Raster data URLs or our own paths only (no SVG: scripts; no off-site or protocol-relative URLs). */
export function safeImageSrc(src: unknown): string | null {
  if (typeof src !== "string") return null;
  if (/^data:image\/(png|jpeg|webp);base64,/i.test(src)) return src.length <= MAX_INLINE_BYTES ? src : null;
  if (src.startsWith("/") && !src.startsWith("//") && !/\.svg(\?|$)/i.test(src)) return src;
  return null;
}

const FACE_ORDER: FaceId[] = ["front", "top", "back", "left", "right", "bottom"];

export function summariseArtwork(doc: Pick<DesignDoc, "artwork"> | null | undefined): ArtworkSummaryDTO {
  const out: ArtworkSummaryDTO = { faces: [], backgrounds: {}, sheetImage: {} };
  if (!doc?.artwork) return out;
  let inlined = 0;
  for (const surface of ["outside", "inside"] as const) {
    const s = doc.artwork[surface];
    if (!s) continue;
    if (s.background) out.backgrounds[surface] = s.background;
    if (s.sheetImage?.src) out.sheetImage[surface] = safeImageSrc(s.sheetImage.src) ?? true;
    const byFace = new Map<FaceId, FaceArtworkDTO>();
    for (const l of s.layers ?? []) {
      if (l.hidden) continue;
      const f = byFace.get(l.face) ?? { surface, face: l.face, images: [], moreImages: 0, texts: [], shapes: 0 };
      byFace.set(l.face, f);
      if (l.kind === "image") {
        const src = inlined < MAX_IMAGES ? safeImageSrc(l.src) : null;
        if (src) {
          f.images.push(src);
          inlined++;
        } else f.moreImages++;
      } else if (l.kind === "text") {
        const t = l.text.trim().replace(/\s+/g, " ");
        if (t) f.texts.push(t.length > MAX_TEXT ? `${t.slice(0, MAX_TEXT - 1)}…` : t);
      } else f.shapes++;
    }
    out.faces.push(...[...byFace.values()].sort((a, b) => FACE_ORDER.indexOf(a.face) - FACE_ORDER.indexOf(b.face)));
  }
  return out;
}

/** True when the buyer added nothing to print (plain board, maybe a background colour). */
export function isBlankArtwork(a: ArtworkSummaryDTO): boolean {
  return a.faces.length === 0 && Object.keys(a.sheetImage).length === 0;
}
