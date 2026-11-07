import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_COOKIE } from "@/lib/auth/constants";
import { applySecurityHeaders } from "@/lib/security-headers";
import { isKnownMissing, NOT_FOUND_SEGMENT } from "@/lib/routing/static-404";

const LOCALES = ["ar", "en"];
const DEFAULT_LOCALE = "ar";
const YEAR = 60 * 60 * 24 * 365;

/**
 * Security headers for every page: the SAME full set as next.config.ts (a header set here replaces
 * the config one, so a shorter policy here would drop the CSP). HSTS only for production HTTPS
 * requests (local builds and e2e run over plain HTTP).
 */
function secure(req: NextRequest, res: NextResponse): NextResponse {
  const https = req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
  applySecurityHeaders(res.headers, { dev: process.env.NODE_ENV !== "production", https });
  return res;
}

/**
 * Locale routing: every page lives under /{ar|en}/...
 * "/" and any un-prefixed page path redirect to the preferred locale
 * (cookie elba_locale, else Arabic). API, Next internals and files are skipped.
 * Visiting a locale path remembers it, so "/" later returns to the language last used
 * (also when the language came from a shared link, not the switcher).
 */
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const first = pathname.split("/")[1] ?? "";
  const cookieLocale = req.cookies.get(LOCALE_COOKIE)?.value;
  if (LOCALES.includes(first)) {
    // Forward the locale to Server Components (request header), and echo it for debugging.
    const reqHeaders = new Headers(req.headers);
    reqHeaders.set("x-elba-locale", first);
    // Added by designer (R2-01): the design layout validates the model segment above its
    // hydration Suspense boundary, so an unknown model still answers a real 404.
    reqHeaders.set("x-elba-path", pathname);
    // Added by designer (R8-01): the start page answers its storefront deep links with a real 307
    // from above its Suspense boundary, so it needs the query too.
    reqHeaders.set("x-elba-search", req.nextUrl.search);
    // R6-RS-11: URLs that are certainly unknown get the server-rendered 404 page with HTTP 404 instead
    // of a notFound() that Next only renders on the client (src/lib/routing/static-404.ts).
    const missing = isKnownMissing(pathname.replace(/\/+$/, "").split("/").slice(2));
    const res = missing
      ? NextResponse.rewrite(new URL(`/${first}/${NOT_FOUND_SEGMENT}`, req.url), { status: 404, request: { headers: reqHeaders } })
      : NextResponse.next({ request: { headers: reqHeaders } });
    res.headers.set("x-elba-locale", first);
    if (cookieLocale !== first) {
      res.cookies.set(LOCALE_COOKIE, first, { path: "/", maxAge: YEAR, sameSite: "lax" });
    }
    return secure(req, res);
  }
  const locale = cookieLocale && LOCALES.includes(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;
  const url = req.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  url.search = search;
  return secure(req, NextResponse.redirect(url));
}

export const config = {
  matcher: ["/((?!api|_next|seed|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)"],
};
