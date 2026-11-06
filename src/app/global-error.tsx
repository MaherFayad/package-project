"use client";

import "@/styles/globals.css";
import { inter, plexArabic } from "@/app/fonts";

/**
 * Last-resort boundary for errors thrown by the root or locale layout (R5-PL-01). It replaces the
 * whole document, so it renders its own <html>/<body>, has no i18n context and stays bilingual
 * like the root 404 (each part carries its own lang/dir, WCAG 3.1.2), with a title (2.4.2) and
 * the tokens and brand fonts (CR-04). Plain <a> links: a full reload rebuilds the broken layout.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  console.error(error);
  const button = {
    minBlockSize: 44, // WCAG 2.5.8
    padding: "0 var(--p-space-500)",
    borderRadius: 999,
    border: "1.5px solid var(--p-color-text)",
    background: "var(--p-color-text)",
    color: "#ffffff",
    font: "inherit",
    fontWeight: "var(--p-font-weight-semibold)",
    cursor: "pointer",
  } as const;
  const link = { color: "var(--p-color-text)", fontWeight: "var(--p-font-weight-semibold)" } as const;
  return (
    <html lang="ar" dir="rtl" className={`${inter.variable} ${plexArabic.variable}`}>
      <head>
        <title>تعذر تحميل الصفحة · Page failed to load</title>
        <meta name="robots" content="noindex" />
      </head>
      <body>
        <main
          id="main"
          role="alert"
          style={{
            minBlockSize: "100dvh",
            display: "grid",
            placeContent: "center",
            gap: "var(--p-space-800)",
            padding: "var(--p-space-1600) var(--p-page-gutter)",
            textAlign: "center",
          }}
        >
          <section aria-labelledby="ge-ar" style={{ display: "grid", gap: "var(--p-space-300)", justifyItems: "center" }}>
            <h1 id="ge-ar" style={{ margin: 0, fontSize: "var(--p-font-size-750, 2rem)", fontWeight: "var(--p-font-weight-bold)", lineHeight: 1.3 }}>
              تعذر تحميل هذه الصفحة
            </h1>
            <p style={{ margin: 0, color: "var(--p-color-text-secondary)" }}>حاول مرة أخرى. إذا تكررت المشكلة، عد بعد بضع دقائق.</p>
            <p style={{ margin: 0, display: "flex", gap: "var(--p-space-400)", alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
              <button type="button" onClick={() => reset()} style={button}>
                إعادة المحاولة
              </button>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- full reload on purpose: the layout is broken */}
              <a href="/ar" style={link}>
                الذهاب إلى الصفحة الرئيسية
              </a>
            </p>
          </section>
          <section lang="en" dir="ltr" aria-labelledby="ge-en" style={{ display: "grid", gap: "var(--p-space-300)", justifyItems: "center" }}>
            <h2 id="ge-en" style={{ margin: 0, fontSize: "var(--p-font-size-600, 1.5rem)", fontWeight: "var(--p-font-weight-bold)", lineHeight: 1.3 }}>
              We couldn&apos;t load this page
            </h2>
            <p style={{ margin: 0, color: "var(--p-color-text-secondary)" }}>Please try again. If it keeps happening, come back in a few minutes.</p>
            <p style={{ margin: 0, display: "flex", gap: "var(--p-space-400)", alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
              <button type="button" onClick={() => reset()} style={button}>
                Try again
              </button>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- full reload on purpose: the layout is broken */}
              <a href="/en" hrefLang="en" style={link}>
                Go to home page
              </a>
            </p>
          </section>
        </main>
      </body>
    </html>
  );
}
