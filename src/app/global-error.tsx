"use client";

/**
 * Last-resort boundary for errors thrown by the root or locale layout (R5-PL-01). It replaces the
 * whole document, so it renders its own <html>/<body>, has no i18n context and stays bilingual
 * like the root 404 (each part carries its own lang/dir, WCAG 3.1.2), with a title (2.4.2).
 *
 * Self-contained on purpose: no globals.css, no next/font, literal values instead of tokens.
 * Next keeps this boundary in every page's tree and embeds its CSS in each RSC payload, so
 * importing the global sheet here added a second copy of the tokens and @font-face rules
 * (~30 KB raw) to every page (R5-PL-04). Plain <a> links: a full reload rebuilds the layout.
 */
const FONT = 'system-ui, -apple-system, "Segoe UI", "Noto Sans Arabic", Tahoma, sans-serif';
const INK = "#303030";
const button = {
  minBlockSize: 44, // WCAG 2.5.8
  padding: "0 20px",
  borderRadius: 999,
  border: `1.5px solid ${INK}`,
  background: INK,
  color: "#ffffff",
  font: "inherit",
  fontWeight: 600,
  cursor: "pointer",
} as const;
const link = { color: INK, fontWeight: 600 } as const;
const part = { display: "grid", gap: 12, justifyItems: "center" } as const;
const row = { margin: 0, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", justifyContent: "center" } as const;
const muted = { margin: 0, color: "#616161" } as const;

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  console.error(error);
  return (
    <html lang="ar" dir="rtl">
      <head>
        <title>تعذر تحميل الصفحة · Page failed to load</title>
        <meta name="robots" content="noindex" />
      </head>
      <body style={{ margin: 0, background: "#f1f1f1", color: INK, fontFamily: FONT, lineHeight: 1.5 }}>
        <main
          id="main"
          role="alert"
          style={{ minBlockSize: "100dvh", boxSizing: "border-box", display: "grid", placeContent: "center", gap: 32, padding: "64px 16px", textAlign: "center" }}
        >
          <section aria-labelledby="ge-ar" style={part}>
            <h1 id="ge-ar" style={{ margin: 0, fontSize: "2rem", fontWeight: 700, lineHeight: 1.3 }}>
              تعذر تحميل هذه الصفحة
            </h1>
            <p style={muted}>حاول مرة أخرى. إذا تكررت المشكلة، عد بعد بضع دقائق.</p>
            <p style={row}>
              <button type="button" onClick={() => reset()} style={button}>
                إعادة المحاولة
              </button>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- full reload on purpose: the layout is broken */}
              <a href="/ar" style={link}>
                الذهاب إلى الصفحة الرئيسية
              </a>
            </p>
          </section>
          <section lang="en" dir="ltr" aria-labelledby="ge-en" style={part}>
            <h2 id="ge-en" style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700, lineHeight: 1.3 }}>
              We couldn&apos;t load this page
            </h2>
            <p style={muted}>Please try again. If it keeps happening, come back in a few minutes.</p>
            <p style={row}>
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
