/** Accepted upload types (SVG is rasterised to PNG so only raster data is stored). */
export const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,image/svg+xml";
export const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
/** Longest side kept after upload (enough for ~300 dpi on a 250 mm panel). */
export const IMAGE_MAX_PX = 3000;
/** SVGs are drawn at this size (their vector detail is kept up to here). */
const SVG_RASTER_PX = 2000;

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
    img.onerror = () => reject(new Error("decode"));
    img.src = url;
  });
}

/**
 * Turn an uploaded file into a data URL we can store: SVGs are rasterised (scripts in SVG never
 * run in an <img>, and the server only accepts raster data), big photos are scaled down.
 */
export async function prepareImage(file: File): Promise<PreparedImage> {
  const isSvg = file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg");
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    let w = img.naturalWidth || 0;
    let h = img.naturalHeight || 0;
    if (isSvg) {
      if (!w || !h) {
        w = SVG_RASTER_PX;
        h = SVG_RASTER_PX;
      }
      const k = SVG_RASTER_PX / Math.max(w, h);
      w = Math.round(w * k);
      h = Math.round(h * k);
    } else if (Math.max(w, h) > IMAGE_MAX_PX) {
      const k = IMAGE_MAX_PX / Math.max(w, h);
      w = Math.round(w * k);
      h = Math.round(h * k);
    }
    if (!w || !h) throw new Error("size");
    const keepOriginal = !isSvg && w === img.naturalWidth && /^image\/(png|jpeg|webp)$/.test(file.type) && file.size < 4_000_000;
    if (keepOriginal) {
      const src = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(new Error("read"));
        r.readAsDataURL(file);
      });
      return { src, pxWidth: w, pxHeight: h };
    }
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.drawImage(img, 0, 0, w, h);
    // PNG keeps transparency (logos); photos go to JPEG to stay small.
    const png = isSvg || file.type === "image/png" || file.type === "image/webp";
    const src = canvas.toDataURL(png ? "image/png" : "image/jpeg", 0.9);
    return { src, pxWidth: w, pxHeight: h };
  } finally {
    URL.revokeObjectURL(url);
  }
}
