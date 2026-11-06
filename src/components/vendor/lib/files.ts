/**
 * Upload rules and file-type sniffing (pure). Files are checked by their first bytes, never by
 * the name or the browser's MIME type. SVG is refused on purpose (it can carry scripts and would
 * be served from our origin).
 *
 * Keys look like `<scope>/<ownerId>/<random>.<ext>`:
 *   portfolio/<vendorId>/…   public (shown on the storefront vendor profile)
 *   qc/<orderId>/…           private: the order's vendor, its buyer, admins
 *   cert/<vendorId>/…        private: that vendor's staff, admins
 *   apply/<userId>/…         private: the applicant, admins
 *   dispute/<orderId>/…      private: the order's buyer (who reported the problem), admins
 */

export const UPLOAD_SCOPES = ["portfolio", "qc", "cert", "apply", "dispute"] as const;
export type UploadScope = (typeof UPLOAD_SCOPES)[number];

export type SniffedType = "image/png" | "image/jpeg" | "image/webp" | "application/pdf";

export const EXT_BY_TYPE: Record<SniffedType, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "application/pdf": "pdf",
};
export const TYPE_BY_EXT: Record<string, SniffedType> = { png: "image/png", jpg: "image/jpeg", webp: "image/webp", pdf: "application/pdf" };

const IMAGES: SniffedType[] = ["image/png", "image/jpeg", "image/webp"];
const IMAGES_AND_PDF: SniffedType[] = [...IMAGES, "application/pdf"];

export const UPLOAD_RULES: Record<UploadScope, { types: SniffedType[]; maxBytes: number; accept: string; public: boolean }> = {
  // Public only after review (B-08): see canReadFile().
  portfolio: { types: IMAGES, maxBytes: 8 * 1024 * 1024, accept: "image/png,image/jpeg,image/webp", public: true },
  qc: { types: IMAGES, maxBytes: 10 * 1024 * 1024, accept: "image/png,image/jpeg,image/webp", public: false },
  cert: { types: IMAGES_AND_PDF, maxBytes: 10 * 1024 * 1024, accept: "image/png,image/jpeg,image/webp,application/pdf", public: false },
  apply: { types: IMAGES_AND_PDF, maxBytes: 10 * 1024 * 1024, accept: "image/png,image/jpeg,image/webp,application/pdf", public: false },
  // Added by checkout round 9: photos a buyer adds to "Report a problem" (max 5 per report).
  dispute: { types: IMAGES, maxBytes: 10 * 1024 * 1024, accept: "image/png,image/jpeg,image/webp", public: false },
};

/** Detect the real type from magic bytes. */
export function sniffType(bytes: Uint8Array): SniffedType | null {
  const b = bytes;
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) {
    return "image/png";
  }
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && // RIFF
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 // WEBP
  ) {
    return "image/webp";
  }
  if (b.length >= 5 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d) return "application/pdf"; // %PDF-
  return null;
}

export type UploadCheck = { ok: true; type: SniffedType; ext: string } | { ok: false; error: "EMPTY" | "TOO_LARGE" | "TYPE" };

export function checkUpload(scope: UploadScope, bytes: Uint8Array): UploadCheck {
  const rule = UPLOAD_RULES[scope];
  if (bytes.length === 0) return { ok: false, error: "EMPTY" };
  if (bytes.length > rule.maxBytes) return { ok: false, error: "TOO_LARGE" };
  const type = sniffType(bytes);
  if (!type || !rule.types.includes(type)) return { ok: false, error: "TYPE" };
  return { ok: true, type, ext: EXT_BY_TYPE[type] };
}

const OWNER_RE = /^[A-Za-z0-9_-]{1,40}$/;
const KEY_RE = /^(portfolio|qc|cert|apply|dispute)\/([A-Za-z0-9_-]{1,40})\/([A-Za-z0-9_-]{8,64})\.(png|jpg|webp|pdf)$/;

export function buildKey(scope: UploadScope, ownerId: string, randomId: string, ext: string): string {
  if (!OWNER_RE.test(ownerId)) throw new Error("bad owner id");
  const key = `${scope}/${ownerId}/${randomId}.${ext}`;
  if (!KEY_RE.test(key)) throw new Error("bad key");
  return key;
}

export interface ParsedKey {
  scope: UploadScope;
  ownerId: string;
  file: string;
  ext: string;
  type: SniffedType;
}

/** Strict parse (no traversal, no unknown scopes). */
export function parseKey(key: string): ParsedKey | null {
  const m = KEY_RE.exec(key);
  if (!m) return null;
  return { scope: m[1] as UploadScope, ownerId: m[2]!, file: `${m[3]}.${m[4]}`, ext: m[4]!, type: TYPE_BY_EXT[m[4]!]! };
}

/** Public URL the app uses for a stored key. */
export function fileUrl(key: string): string {
  return `/api/vendor/files/${key}`;
}

/** Inverse of fileUrl for values we stored ourselves (returns null for seed paths like /seed/...). */
export function keyFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const prefix = "/api/vendor/files/";
  if (!url.startsWith(prefix)) return null;
  const key = url.slice(prefix.length);
  return parseKey(key) ? key : null;
}

export interface Viewer {
  id: string;
  role: "BUYER" | "VENDOR" | "ADMIN";
  vendorId: string | null;
}

/**
 * Who may read a file. `orderParties` must be looked up for `qc/` keys (vendor + buyer of the order);
 * `portfolioStatus` for `portfolio/` keys (the VendorPortfolioItem row pointing at the file).
 * B-08: a portfolio photo is public only once Elba APPROVED it. PENDING, REJECTED or orphan files
 * (no row) are readable by the owning vendor and admins only, so a leaked URL shows nothing.
 * R4: the buyer sees a QC photo only once Elba ops APPROVED it (`qcStatus`, the QcPhoto row). Before
 * that it is unreviewed vendor content: text written on a sheet or the packing could carry the
 * vendor's phone number, and a rejected photo may show a defect ops is still sorting out.
 */
export function canReadFile(
  key: ParsedKey,
  viewer: Viewer | null,
  orderParties?: { vendorId: string; buyerId: string } | null,
  portfolioStatus?: string | null,
  qcStatus?: string | null,
): boolean {
  if (key.scope === "portfolio" && portfolioStatus === "APPROVED") return true;
  if (!viewer) return false;
  if (viewer.role === "ADMIN") return true;
  switch (key.scope) {
    case "portfolio":
      return viewer.vendorId === key.ownerId;
    case "cert":
      return viewer.vendorId === key.ownerId;
    case "apply":
      return viewer.id === key.ownerId;
    case "dispute":
      // The buyer's own report photos; the printer does not see them (ops shares what is needed).
      return !!orderParties && orderParties.buyerId === viewer.id;
    case "qc":
      if (!orderParties) return false;
      if (viewer.vendorId && orderParties.vendorId === viewer.vendorId) return true;
      return orderParties.buyerId === viewer.id && qcStatus === "APPROVED";
    default:
      return false;
  }
}

/** Format bytes for help text ("8 MB"). */
export function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${Math.round(n / (1024 * 1024))} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

/* ───────────── R4: image metadata ───────────── */

/**
 * Remove metadata from an uploaded image before it is stored: EXIF (GPS position of the plant,
 * camera owner, "Artist" / "Copyright" / "ImageDescription" text a vendor could fill with a phone
 * number), XMP, IPTC, comments and PNG text chunks. Portfolio photos become public, QC photos reach
 * the buyer, so neither may carry hidden contact details or location (B-08; PDPL 151/2020 data
 * minimisation). Pixels are untouched. JPEG keeps its orientation (a minimal EXIF block with only
 * that tag) and its ICC colour profile. Returns null when the file is not a well-formed image.
 */
export function stripImageMetadata(bytes: Uint8Array, type: SniffedType): Uint8Array | null {
  try {
    if (type === "image/jpeg") return stripJpeg(bytes);
    if (type === "image/png") return stripPng(bytes);
    if (type === "image/webp") return stripWebp(bytes);
    return bytes;
  } catch {
    return null;
  }
}

const u16 = (b: Uint8Array, i: number, le = false) => (le ? b[i]! | (b[i + 1]! << 8) : (b[i]! << 8) | b[i + 1]!);
const u32 = (b: Uint8Array, i: number, le = false) => (le ? (b[i]! | (b[i + 1]! << 8) | (b[i + 2]! << 16) | (b[i + 3]! << 24)) >>> 0 : ((b[i]! << 24) | (b[i + 1]! << 16) | (b[i + 2]! << 8) | b[i + 3]!) >>> 0);
const ascii = (b: Uint8Array, i: number, n: number) => String.fromCharCode(...b.subarray(i, i + n));

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** EXIF orientation (1..8) from an APP1 payload, or 1. */
function exifOrientation(seg: Uint8Array): number {
  if (seg.length < 14 || ascii(seg, 0, 6) !== "Exif\0\0") return 1;
  const t = seg.subarray(6);
  const le = ascii(t, 0, 2) === "II";
  const ifd = u32(t, 4, le);
  if (ifd + 2 > t.length) return 1;
  const n = u16(t, ifd, le);
  for (let k = 0; k < n; k++) {
    const e = ifd + 2 + k * 12;
    if (e + 12 > t.length) break;
    if (u16(t, e, le) === 0x0112) {
      const v = u16(t, e + 8, le);
      return v >= 1 && v <= 8 ? v : 1;
    }
  }
  return 1;
}

function stripJpeg(b: Uint8Array): Uint8Array | null {
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  const parts: Uint8Array[] = [b.subarray(0, 2)];
  let i = 2;
  let orientation = 1;
  let insertAt = 1; // after SOI (and after JFIF APP0 when present)
  while (i < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1]!;
    if (marker === 0xff) {
      i++;
      continue;
    }
    if (marker === 0xda) {
      // Start of scan: the rest is image data.
      parts.push(b.subarray(i));
      break;
    }
    if (marker === 0xd9) {
      parts.push(b.subarray(i, i + 2));
      break;
    }
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      parts.push(b.subarray(i, i + 2));
      i += 2;
      continue;
    }
    const len = u16(b, i + 2);
    if (len < 2 || i + 2 + len > b.length) return null;
    const seg = b.subarray(i, i + 2 + len);
    const payload = b.subarray(i + 4, i + 2 + len);
    const isApp = marker >= 0xe0 && marker <= 0xef;
    if (marker === 0xe1) orientation = Math.max(orientation, exifOrientation(payload));
    const keep =
      (!isApp && marker !== 0xfe) ||
      (marker === 0xe0 && ascii(payload, 0, 4) === "JFIF") ||
      (marker === 0xe2 && ascii(payload, 0, 11) === "ICC_PROFILE") ||
      (marker === 0xee && ascii(payload, 0, 5) === "Adobe");
    if (keep) {
      parts.push(seg);
      if (marker === 0xe0 && parts.length === 2) insertAt = 2;
    }
    i += 2 + len;
  }
  if (orientation !== 1) {
    // Minimal big-endian EXIF: one IFD0 entry, Orientation (0x0112, SHORT, 1).
    const exif = new Uint8Array([
      0xff, 0xe1, 0x00, 0x22, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00, 0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08,
      0x00, 0x01, 0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, orientation, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);
    parts.splice(insertAt, 0, exif);
  }
  return concat(parts);
}

const PNG_DROP = new Set(["tEXt", "zTXt", "iTXt", "eXIf", "tIME"]);

function stripPng(b: Uint8Array): Uint8Array | null {
  const parts: Uint8Array[] = [b.subarray(0, 8)];
  let i = 8;
  while (i + 12 <= b.length) {
    const len = u32(b, i);
    const type = ascii(b, i + 4, 4);
    const end = i + 12 + len;
    if (end > b.length) return null;
    if (!PNG_DROP.has(type)) parts.push(b.subarray(i, end));
    i = end;
    if (type === "IEND") break;
  }
  return concat(parts);
}

function stripWebp(b: Uint8Array): Uint8Array | null {
  const parts: Uint8Array[] = [];
  let i = 12;
  while (i + 8 <= b.length) {
    const type = ascii(b, i, 4);
    const len = u32(b, i + 4, true);
    const end = i + 8 + len + (len & 1);
    if (i + 8 + len > b.length) return null;
    if (type === "VP8X") {
      const c = b.slice(i, Math.min(end, b.length));
      c[8] = c[8]! & ~0x0c; // clear the EXIF (0x08) and XMP (0x04) flags
      parts.push(c);
    } else if (type !== "EXIF" && type !== "XMP ") {
      parts.push(b.subarray(i, Math.min(end, b.length)));
    }
    i = end;
  }
  const body = concat(parts);
  const head = new Uint8Array(12);
  head.set(b.subarray(0, 12));
  const size = body.length + 4;
  head[4] = size & 0xff;
  head[5] = (size >>> 8) & 0xff;
  head[6] = (size >>> 16) & 0xff;
  head[7] = (size >>> 24) & 0xff;
  return concat([head, body]);
}
