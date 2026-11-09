/** Accepted upload types (SVG is rasterised to PNG so only raster data is stored). */
export const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,image/svg+xml";
export const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
/** Longest side kept after upload (enough for ~300 dpi on a 250 mm panel). */
export const IMAGE_MAX_PX = 3000;
/** SVGs are drawn at this size (their vector detail is kept up to here). */
const SVG_RASTER_PX = 2000;

/**
 * Longest data URL kept per image (R10-01). The design is saved as one JSON body capped at 12 MB
 * (api/designs MAX_BODY_BYTES); a 9.7 MB PNG under the 10 MB upload limit became a 13 MB data URL,
 * every save answered 413 and the work was never stored. ~3 M characters (≈ 2.2 MB of image)
 * leaves room for several images plus the document.
 */
export const IMAGE_MAX_SRC_CHARS = 3_000_000;

/** Why an upload was refused, for a specific message (WCAG 3.3.1 / 3.3.3). */
export type UploadErrorKind = "type" | "size" | "decode";
export class UploadError extends Error {
  constructor(readonly kind: UploadErrorKind) {
    super(kind);
  }
}
const ACCEPTED = /^image\/(png|jpeg|webp|svg\+xml)$/;

/** The reason a file is refused before reading it, or null. */
export function rejectReason(file: Pick<File, "type" | "size" | "name">): UploadErrorKind | null {
  const svgByName = file.name.toLowerCase().endsWith(".svg");
  if (!ACCEPTED.test(file.type) && !svgByName) return "type";
  if (file.size > IMAGE_MAX_BYTES) return "size";
  return null;
}

export interface PreparedImage {
  src: string;
  pxWidth: number;
  pxHeight: number;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new UploadError("decode"));
    img.src = url;
  });
}

/**
 * Turn an uploaded file into a data URL we can store: SVGs are rasterised (scripts in SVG never
 * run in an <img>, and the server only accepts raster data), big photos are scaled down.
 */
/** Limits for one upload. Full-sheet artwork gets a larger budget than a face image. */
export interface PrepareOptions {
  maxPx?: number;
  maxChars?: number;
  /** No transparency needed (a full print sheet): encode as JPEG, smaller. */
  opaque?: boolean;
}

/** Full artwork over the whole dieline: up to 7000 px (300 dpi on a ~590 mm sheet). */
export const SHEET_IMAGE_OPTIONS: PrepareOptions = { maxPx: 7000, maxChars: 6_500_000, opaque: true };

export async function prepareImage(file: File, opts: PrepareOptions = {}): Promise<PreparedImage> {
  const maxPx = opts.maxPx ?? IMAGE_MAX_PX;
  const maxChars = opts.maxChars ?? IMAGE_MAX_SRC_CHARS;
  const svgPx = opts.maxPx ? Math.max(SVG_RASTER_PX, Math.min(opts.maxPx, 6000)) : SVG_RASTER_PX;
  const refused = rejectReason(file);
  if (refused) throw new UploadError(refused);
  const isSvg = file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg");
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    let w = img.naturalWidth || 0;
    let h = img.naturalHeight || 0;
    if (isSvg) {
      if (!w || !h) {
        w = svgPx;
        h = svgPx;
      }
      const k = svgPx / Math.max(w, h);
      w = Math.round(w * k);
      h = Math.round(h * k);
    } else if (Math.max(w, h) > maxPx) {
      const k = maxPx / Math.max(w, h);
      w = Math.round(w * k);
      h = Math.round(h * k);
    }
    if (!w || !h) throw new UploadError("decode");
    // Base64 adds a third: keep the file as is only when its data URL fits the budget.
    const keepOriginal = !isSvg && w === img.naturalWidth && /^image\/(png|jpeg|webp)$/.test(file.type) && file.size * 1.37 < maxChars;
    if (keepOriginal) {
      const src = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(new Error("read"));
        r.readAsDataURL(file);
      });
      return { src, pxWidth: w, pxHeight: h };
    }
    // PNG keeps transparency (logos); photos go to JPEG to stay small. Too big for the budget:
    // WebP (keeps transparency, much smaller), then step the size down (R10-01).
    const png = !opts.opaque && (isSvg || file.type === "image/png" || file.type === "image/webp");
    const encode = (cw: number, ch: number, type: string) => {
      const canvas = document.createElement("canvas");
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new UploadError("decode");
      if (type === "image/jpeg") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, cw, ch);
      }
      ctx.drawImage(img, 0, 0, cw, ch);
      return canvas.toDataURL(type, type === "image/png" ? undefined : 0.9);
    };
    let src = encode(w, h, png ? "image/png" : "image/jpeg");
    const lossy = png ? "image/webp" : "image/jpeg";
    for (let k = 1; src.length > maxChars && k > 0.2; k *= 0.8) {
      const cw = Math.max(1, Math.round(w * k));
      const ch = Math.max(1, Math.round(h * k));
      src = encode(cw, ch, lossy);
      if (src.length <= maxChars) return { src, pxWidth: cw, pxHeight: ch };
    }
    if (src.length > maxChars) throw new UploadError("size");
    return { src, pxWidth: w, pxHeight: h };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Measure a prepared image for the Fill / Fit default (designer: image fit): see-through pixels,
 * and whether its border is one flat colour (a logo on white). Read on a 64 px copy; an image that
 * cannot be read counts as a plain photo.
 */
export async function imageLook(src: string): Promise<{ transparent: boolean; plainEdges: boolean }> {
  try {
    const img = await loadImage(src);
    const n = 64;
    const canvas = document.createElement("canvas");
    canvas.width = n;
    canvas.height = n;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return { transparent: false, plainEdges: false };
    ctx.drawImage(img, 0, 0, n, n);
    const d = ctx.getImageData(0, 0, n, n).data;
    let clear = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] < 245) clear++;
    const edge: number[] = [];
    for (let k = 0; k < n; k++) for (const [x, y] of [[k, 0], [k, n - 1], [0, k], [n - 1, k]]) edge.push((y * n + x) * 4);
    const mean = [0, 1, 2].map((c) => edge.reduce((s, i) => s + d[i + c], 0) / edge.length);
    const flat = edge.filter((i) => Math.abs(d[i] - mean[0]) + Math.abs(d[i + 1] - mean[1]) + Math.abs(d[i + 2] - mean[2]) < 30).length;
    return { transparent: clear > n * n * 0.005, plainEdges: flat >= edge.length * 0.92 };
  } catch {
    return { transparent: false, plainEdges: false };
  }
}
