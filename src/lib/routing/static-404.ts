import { LEGAL_DOC_IDS } from "@/components/store/legal";
import { MODEL_INDEX } from "@/lib/library/model-index.generated";
import { CATALOGUE_CODES, CATALOGUE_REDIRECT_SLUGS, CATALOGUE_SLUGS, LEAF_SEGMENTS, STRUCTURE_ROUTE_SLUGS } from "./route-slugs.generated";

/**
 * R6-RS-11 / R5-PL-18: server-rendered 404s.
 *
 * In Next 15.5 a notFound() thrown while rendering a request (not at build time) never reaches the
 * HTML: the SSR shell fails, Next sends an empty `<html id="__next_error__">` document, and the
 * not-found UI renders only after the JavaScript has loaded (phone LCP 4.4 to 4.9 s, no CSS in
 * <head>). Reproduced on a minimal app with the same Next version; `experimental.globalNotFound`
 * does not change it.
 *
 * So the middleware catches the URLs it can prove are unknown without a database and rewrites them
 * to /{locale}/page-not-found with HTTP 404. That page renders normally (no throw), so it is
 * server-rendered with its CSS: unknown first segments, paths below pages that have no children,
 * unknown legal documents, editor models, catalogue models and box styles, malformed size slugs and
 * share tokens. Records that need the database (a printer, an order, an admin record, a well-formed
 * but unknown share token) and in-format sizes outside a style's limits still use notFound() and its client-rendered
 * 404.
 */
export const NOT_FOUND_SEGMENT = "page-not-found";

/** First path segments under /{locale}/ that have routes (route groups flattened). Kept in sync with
 * src/app/[locale] by src/lib/routing/__tests__/static-404.test.ts. */
export const TOP_SEGMENTS: ReadonlySet<string> = new Set([
  "account", "admin", "bags", "bottles", "boxes", "catalog", "checkout", "design", "designer", "dev", "legal",
  "login", "orders", "pricing", "s", "start", "unsubscribe", "vendor", "vendors", "why-elba",
]);

/** Share tokens are randomToken(12): 16 base64url characters (components/designer/server.ts). */
const SHARE_TOKEN = /^[A-Za-z0-9_-]{16}$/;
const LEGAL = new Set<string>(LEGAL_DOC_IDS);
const CAT_SLUGS = new Set(CATALOGUE_SLUGS);
const CAT_CODES = new Set(CATALOGUE_CODES);
const CAT_REDIRECTS = new Set(CATALOGUE_REDIRECT_SLUGS);
const STRUCTURES = new Set(STRUCTURE_ROUTE_SLUGS);
const LEAVES = new Set(LEAF_SEGMENTS);
/** Box size slug, as components/store/catalog parseSizeSlug: whole mm, "300x200x150" (x, X or ×). */
const SIZE = /^(\d{2,4})[x×X](\d{2,4})[x×X](\d{2,4})$/;

function decoded(param: string): string | null {
  try {
    return decodeURIComponent(param).trim();
  } catch {
    return null;
  }
}

/** /catalog/<param>, matched like data/catalogue catalogueEntryFromParam, plus the old structure
 * URLs that the catalogue layout redirects to /boxes/<structure>. */
export function isCatalogueParam(param: string): boolean {
  if (CAT_REDIRECTS.has(param)) return true;
  const p = decoded(param);
  return p !== null && (CAT_SLUGS.has(p.toLowerCase()) || CAT_CODES.has(p) || CAT_CODES.has(p.toUpperCase()));
}

/** Editor models, matched like lib/library modelFromParam (slug, code, or code with dashes). */
const MODEL_SLUGS = new Set(Object.values(MODEL_INDEX).map(([, slug]) => slug));
const MODEL_CODES = new Set(Object.keys(MODEL_INDEX));
export function isEditorModel(param: string): boolean {
  let p: string;
  try {
    p = decodeURIComponent(param).trim();
  } catch {
    return false;
  }
  return MODEL_SLUGS.has(p.toLowerCase()) || MODEL_CODES.has(p) || MODEL_CODES.has(p.toUpperCase().replace(/-/g, "_"));
}

/** True when `rest` (the path after /{locale}) is certainly not a page, so the static 404 can answer. */
export function isKnownMissing(rest: string[]): boolean {
  const [first = "", second, third] = rest;
  if (first === "") return false; // home
  if (first === NOT_FOUND_SEGMENT) return true; // the 404 page itself answers 404 too
  if (!TOP_SEGMENTS.has(first)) return true;
  if (first === "s") return second === undefined || !SHARE_TOKEN.test(second) || third !== undefined;
  if (first === "legal" && second !== undefined) return !LEGAL.has(second) || third !== undefined;
  if (first === "design" && second !== undefined) return !isEditorModel(second) || third !== undefined;
  // R5-PL-19: catalogue models, box styles and size pages from the generated slug sets. A size in
  // the right format but outside a style's limits still goes to the page's notFound().
  if (first === "catalog" && second !== undefined) return !isCatalogueParam(second) || third !== undefined;
  if (first === "boxes" && second !== undefined) {
    if (!STRUCTURES.has(second)) return true;
    if (third === undefined) return false;
    const size = decoded(third);
    return size === null || !SIZE.test(size) || rest.length > 3;
  }
  if (LEAVES.has(first)) return second !== undefined;
  return false;
}
