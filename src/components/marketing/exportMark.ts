/**
 * Attribution mark for standard-size PNG exports (B-22 / B-03, marketing half).
 *
 * The social loop needs every posted mockup to carry a small, tasteful credit and a short URL:
 * "Design your box on Elba · elba.eg" / "صمم علبتك على علبة · elba.eg". HD exports stay clean
 * (G2: the plan allows unmarked exports; the mark is a nudge, not a lock).
 *
 * The designer calls `stampExportMark(blob, { locale })` on the standard PNG before download.
 * Design: a white pill (92% opacity) in the bottom END corner (right in English, left in Arabic),
 * the box glyph in brand kraft, ink text at about 2.2% of the image width; never more than
 * 46% of the width, so it cannot cover the product.
 */

export type MarkLocale = "ar" | "en";

const COPY: Record<MarkLocale, string> = {
  ar: "صمم علبتك على علبة",
  en: "Design your box on Elba",
};

/** Short host for the mark: the configured public site, or the brand domain. */
export function markHost(siteUrl: string | undefined = process.env.NEXT_PUBLIC_SITE_URL): string {
  try {
    const h = new URL(siteUrl ?? "").hostname.replace(/^www\./, "");
    if (h && h !== "localhost" && !/^\d+\.\d+\.\d+\.\d+$/.test(h)) return h;
  } catch {
    /* fall through */
  }
  return "elba.eg";
}

export function markText(locale: MarkLocale, host = markHost()): string {
  return `${COPY[locale]} · ${host}`;
}

export interface MarkLayout {
  fontPx: number;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Glyph square (x, y, size) and text anchor x. */
  glyph: { x: number; y: number; s: number };
  textX: number;
  textY: number;
}

/**
 * Pure geometry (unit tested): where the pill, glyph and text go for an image of
 * `width` x `height` and a measured text width at `fontPx`.
 */
export function markLayout(width: number, height: number, textWidthAtFont: (fontPx: number) => number, dir: "rtl" | "ltr"): MarkLayout {
  let fontPx = Math.max(7, Math.round(width * 0.022));
  const pad = () => Math.round(fontPx * 0.75);
  const glyphS = () => Math.round(fontPx * 1.05);
  const gap = () => Math.round(fontPx * 0.5);
  const pillW = () => pad() * 2 + glyphS() + gap() + Math.ceil(textWidthAtFont(fontPx));
  while (pillW() > width * 0.46 && fontPx > 7) fontPx -= 1;
  const h = Math.round(fontPx * 2.2);
  const w = pillW();
  const margin = Math.round(Math.min(width, height) * 0.03);
  const x = dir === "rtl" ? margin : width - margin - w;
  const y = height - margin - h;
  const gs = glyphS();
  const glyphX = dir === "rtl" ? x + w - pad() - gs : x + pad();
  const textX = dir === "rtl" ? glyphX - gap() : glyphX + gs + gap();
  return { fontPx, x, y, w, h, glyph: { x: glyphX, y: Math.round(y + (h - gs) / 2), s: gs }, textX, textY: Math.round(y + h / 2) };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draws the mark onto a canvas already holding the export image. */
export function drawExportMark(ctx: CanvasRenderingContext2D, width: number, height: number, locale: MarkLocale, host = markHost()) {
  const dir = locale === "ar" ? "rtl" : "ltr";
  const text = markText(locale, host);
  const family = locale === "ar" ? `"IBM Plex Sans Arabic", Inter, system-ui, sans-serif` : `Inter, system-ui, sans-serif`;
  const font = (px: number) => `600 ${px}px ${family}`;
  const L = markLayout(width, height, (px) => {
    ctx.font = font(px);
    return ctx.measureText(text).width;
  }, dir);

  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.12)";
  ctx.shadowBlur = Math.round(L.fontPx * 0.8);
  ctx.shadowOffsetY = Math.round(L.fontPx * 0.15);
  ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
  roundRect(ctx, L.x, L.y, L.w, L.h, L.h / 2);
  ctx.fill();
  ctx.restore();

  // Box glyph: a kraft cube face with a lid line (the wordmark's mark, simplified).
  ctx.save();
  const g = L.glyph;
  ctx.fillStyle = "#c8913f";
  roundRect(ctx, g.x, g.y, g.s, g.s, Math.max(2, g.s * 0.18));
  ctx.fill();
  ctx.fillStyle = "#a8722a";
  ctx.fillRect(g.x, g.y + g.s * 0.36, g.s, Math.max(1, g.s * 0.1));
  ctx.restore();

  ctx.save();
  ctx.font = font(L.fontPx);
  ctx.fillStyle = "#1a1a1a";
  ctx.textBaseline = "middle";
  ctx.direction = dir;
  ctx.textAlign = dir === "rtl" ? "right" : "left";
  ctx.fillText(text, L.textX, L.textY);
  ctx.restore();
}

/** Returns a new PNG blob with the mark stamped on (standard exports only). */
export async function stampExportMark(png: Blob, opts: { locale: MarkLocale; host?: string }): Promise<Blob> {
  const bmp = await createImageBitmap(png);
  const canvas = document.createElement("canvas");
  canvas.width = bmp.width;
  canvas.height = bmp.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return png;
  ctx.drawImage(bmp, 0, 0);
  bmp.close?.();
  try {
    await document.fonts?.ready;
  } catch {
    /* draw with the fallback font */
  }
  drawExportMark(ctx, canvas.width, canvas.height, opts.locale, opts.host ?? markHost());
  return await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b ?? png), "image/png"));
}
