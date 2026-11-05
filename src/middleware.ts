import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_COOKIE } from "@/lib/auth/constants";

const LOCALES = ["ar", "en"];
const DEFAULT_LOCALE = "ar";

/**
 * Locale routing: every page lives under /{ar|en}/...
 * "/" and any un-prefixed page path redirect to the preferred locale
 * (cookie elba_locale, else Arabic). API, Next internals and files are skipped.
 */
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const first = pathname.split("/")[1] ?? "";
  if (LOCALES.includes(first)) {
    const res = NextResponse.next();
    res.headers.set("x-elba-locale", first);
    return res;
  }
  const cookieLocale = req.cookies.get(LOCALE_COOKIE)?.value;
  const locale = cookieLocale && LOCALES.includes(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;
  const url = req.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  url.search = search;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!api|_next|seed|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)"],
};
