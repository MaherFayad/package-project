import Link from "next/link";
import "@/styles/globals.css";
import { inter, plexArabic } from "@/app/fonts";

/**
 * Global 404 for paths outside a valid locale (rendered without the locale layout, e.g. an
 * unknown file or an unmatched path the middleware does not redirect). Unknown /ar/... and
 * /en/... paths never get here: [locale]/[...missing] renders the localized 404 with chrome.
 *
 * It has no locale, so it stays bilingual, but each language part carries its own lang/dir
 * (WCAG 3.1.2, X-03), it has a <title> (2.4.2), and it loads the tokens (via globals.css) and
 * the two brand fonts so it never falls back to Times New Roman (CR-04). It reads no request
 * API: not-found boundaries are rendered eagerly with every page, so headers() here would make
 * every route dynamic.
 */
export default function GlobalNotFound() {
  return (
    <html lang="ar" dir="rtl" className={`${inter.variable} ${plexArabic.variable}`}>
      <head>
        <title>الصفحة غير موجودة · Page not found</title>
        <meta name="robots" content="noindex" />
      </head>
      <body>
        <main
          id="main"
          style={{
            minBlockSize: "100dvh",
            display: "grid",
            placeContent: "center",
            gap: "var(--p-space-800)",
            padding: "var(--p-space-1600) var(--p-page-gutter)",
            textAlign: "center",
          }}
        >
          <section aria-labelledby="nf-ar" style={{ display: "grid", gap: "var(--p-space-300)" }}>
            <h1 id="nf-ar" style={{ margin: 0, fontSize: "var(--p-font-size-750, 2rem)", fontWeight: "var(--p-font-weight-bold)", lineHeight: 1.3 }}>
              الصفحة غير موجودة
            </h1>
            <p style={{ margin: 0, color: "var(--p-color-text-secondary)" }}>الصفحة التي تبحث عنها غير موجودة.</p>
            <p style={{ margin: 0 }}>
              <Link href="/ar" style={{ color: "var(--p-color-text)", fontWeight: "var(--p-font-weight-semibold)" }}>
                الذهاب إلى الصفحة الرئيسية
              </Link>
            </p>
          </section>
          <section lang="en" dir="ltr" aria-labelledby="nf-en" style={{ display: "grid", gap: "var(--p-space-300)" }}>
            <h2 id="nf-en" style={{ margin: 0, fontSize: "var(--p-font-size-600, 1.5rem)", fontWeight: "var(--p-font-weight-bold)", lineHeight: 1.3 }}>
              Page not found
            </h2>
            <p style={{ margin: 0, color: "var(--p-color-text-secondary)" }}>The page you are looking for does not exist.</p>
            <p style={{ margin: 0 }}>
              <Link href="/en" hrefLang="en" style={{ color: "var(--p-color-text)", fontWeight: "var(--p-font-weight-semibold)" }}>
                Go to home page
              </Link>
            </p>
          </section>
        </main>
      </body>
    </html>
  );
}
