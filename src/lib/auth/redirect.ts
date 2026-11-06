import type { Locale } from "@/types";

const ORIGIN = "http://elba.invalid";

/**
 * Sanitise a `?next=` target to a same-origin path, or fall back to `/{locale}`.
 *
 * Plain prefix checks are not enough: browsers strip tab / CR / LF from URLs and treat `\`
 * as `/`, so "/\t/evil.com" or "/\\evil.com" become the protocol-relative "//evil.com".
 * We resolve the value with the WHATWG URL parser (what the browser will do), require that
 * it stays on our origin, and return only the normalised path + query + hash.
 */
export function safeNextPath(next: string | null | undefined, locale: Locale): string {
  const fallback = `/${locale}`;
  if (typeof next !== "string" || next.length === 0 || next.length > 2048) return fallback;
  // Reject control characters and backslashes outright: no legitimate in-app path has them.
  if (/[\u0000-\u001f\u007f\\]/.test(next)) return fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  let url: URL;
  try {
    url = new URL(next, ORIGIN);
  } catch {
    return fallback;
  }
  if (url.origin !== ORIGIN) return fallback;
  const path = `${url.pathname}${url.search}${url.hash}`;
  // Defence in depth: the normalised path must still be a single-slash, in-app path.
  if (!path.startsWith("/") || path.startsWith("//")) return fallback;
  // Never bounce back to the login page itself (redirect loop after sign-in).
  if (/^\/(ar|en)\/login(\/|$|\?)/.test(path)) return fallback;
  return path;
}
