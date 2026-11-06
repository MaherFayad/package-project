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
 */

export const UPLOAD_SCOPES = ["portfolio", "qc", "cert", "apply"] as const;
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
const KEY_RE = /^(portfolio|qc|cert|apply)\/([A-Za-z0-9_-]{1,40})\/([A-Za-z0-9_-]{8,64})\.(png|jpg|webp|pdf)$/;

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
 */
export function canReadFile(
  key: ParsedKey,
  viewer: Viewer | null,
  orderParties?: { vendorId: string; buyerId: string } | null,
  portfolioStatus?: string | null,
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
    case "qc":
      return Boolean(orderParties && (orderParties.vendorId === viewer.vendorId || orderParties.buyerId === viewer.id));
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
