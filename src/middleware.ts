import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_COOKIE } from "@/lib/auth/constants";

const LOCALES = ["ar", "en"];
const DEFAULT_LOCALE = "ar";
const YEAR = 60 * 60 * 24 * 365;

/**
 * Baseline security headers for every page.
 * - frame-ancestors / X-Frame-Options: no clickjacking of the login and checkout forms.
 * - nosniff, strict Referrer-Policy: ?next= and order ids do not leak to third parties.
 * - Permissions-Policy: the app needs none of these features (payment is left to the gateway).
 * - HSTS only for production HTTPS requests (local builds and e2e run over plain HTTP).
 * A full script CSP is left to the deploy config (three.js workers and Next inline runtime).
 */
function secure(req: NextRequest, res: NextResponse): NextResponse {
  res.headers.set("Content-Security-Policy", "frame-ancestors 'none'; base-uri 'self'; object-src 'none'");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), usb=()");
  const https = req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
  if (process.env.NODE_ENV === "production" && https) {
    res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
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
    const res = NextResponse.next({ request: { headers: reqHeaders } });
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
