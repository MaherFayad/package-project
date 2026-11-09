/**
 * Image resolution from file metadata (no DOM): JPEG JFIF density, JPEG EXIF XResolution,
 * PNG pHYs. Returns dots per inch, or null when the file says nothing usable.
 *
 * 72 and 96 dpi are what most tools write when nobody chose a resolution, so `usableDpi`
 * treats them (and anything outside 100..2400) as unknown.
 */
export function readImageDpi(bytes: Uint8Array): number | null {
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return pngDpi(bytes);
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) return jpegDpi(bytes);
  return null;
}

export function usableDpi(dpi: number | null | undefined): number | null {
  if (!dpi || !Number.isFinite(dpi)) return null;
  if (Math.abs(dpi - 72) < 0.5 || Math.abs(dpi - 96) < 0.5) return null;
  return dpi >= 100 && dpi <= 2400 ? dpi : null;
}

const u16 = (b: Uint8Array, i: number, le = false) => (le ? b[i] | (b[i + 1] << 8) : (b[i] << 8) | b[i + 1]);
const u32 = (b: Uint8Array, i: number, le = false) =>
  le ? (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0 : ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;

function pngDpi(b: Uint8Array): number | null {
  let i = 8;
  while (i + 12 <= b.length) {
    const len = u32(b, i);
    const type = String.fromCharCode(b[i + 4], b[i + 5], b[i + 6], b[i + 7]);
    if (type === "pHYs" && len >= 9) {
      const ppx = u32(b, i + 8);
      const unit = b[i + 16];
      return unit === 1 && ppx > 0 ? ppx * 0.0254 : null;
    }
    if (type === "IDAT" || type === "IEND") return null;
    i += 12 + len;
  }
  return null;
}

function jpegDpi(b: Uint8Array): number | null {
  let i = 2;
  let jfif: number | null = null;
  while (i + 4 <= b.length && b[i] === 0xff) {
    const marker = b[i + 1];
    if (marker === 0xda || marker === 0xd9) break; // image data: no more headers
    const len = u16(b, i + 2);
    const start = i + 4;
    if (marker === 0xe0 && len >= 14 && b[start] === 0x4a && b[start + 1] === 0x46 && b[start + 2] === 0x49 && b[start + 3] === 0x46) {
      const units = b[start + 7];
      const xd = u16(b, start + 8);
      if (xd > 0 && units === 1) jfif = xd;
      else if (xd > 0 && units === 2) jfif = xd * 2.54;
    }
    if (marker === 0xe1 && len >= 16 && b[start] === 0x45 && b[start + 1] === 0x78 && b[start + 2] === 0x69 && b[start + 3] === 0x66) {
      const exif = exifDpi(b, start + 6, len - 8);
      if (exif) return exif;
    }
    i += 2 + len;
  }
  return jfif;
}

function exifDpi(b: Uint8Array, t: number, size: number): number | null {
  if (t + 8 > b.length) return null;
  const le = b[t] === 0x49;
  const ifd = t + u32(b, t + 4, le);
  if (ifd + 2 > b.length || ifd > t + size) return null;
  const n = u16(b, ifd, le);
  let xres: number | null = null;
  let unit = 2;
  for (let k = 0; k < n; k++) {
    const e = ifd + 2 + k * 12;
    if (e + 12 > b.length) break;
    const tag = u16(b, e, le);
    if (tag === 0x011a) {
      const off = t + u32(b, e + 8, le);
      if (off + 8 <= b.length) {
        const num = u32(b, off, le);
        const den = u32(b, off + 4, le);
        if (den) xres = num / den;
      }
    } else if (tag === 0x0128) unit = u16(b, e + 8, le);
  }
  if (!xres) return null;
  return unit === 3 ? xres * 2.54 : xres;
}
