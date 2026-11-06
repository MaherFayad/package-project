import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { preload } from "react-dom";
import { inter, plexArabic, PLEX_PRELOAD_WEIGHTS } from "@/app/fonts";
import { interPreloadUrl, plexArabicPreloadUrls } from "@/app/font-preload";
import { dirOf, getDictionary, getPublicDictionary, isLocale } from "@/i18n";
import type { Dictionary } from "@/i18n/types";
import { I18nProvider } from "@/i18n/client";
import { LOCALES } from "@/types";
import { VisitBeacon } from "@/lib/analytics/VisitBeacon";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const d = getDictionary(locale);
  return {
    title: { default: `${d.meta.siteName} · ${d.meta.tagline}`, template: `%s · ${d.meta.siteName}` },
    description: d.meta.description,
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
    // No site-wide hreflang here: alternates must point at the SAME page in the other
    // language, so each page sets its own (`alternates.languages`). A layout-level
    // { ar: "/ar", en: "/en" } told search engines every page was a translation of home.
  };
}

/**
 * Dictionary sent to the browser on every page (it is serialised into the HTML's RSC payload).
 * `legal` (the long policy texts) and `notify` (email / SMS templates) are read only by server
 * code, so they stay out of the client copy: ~9 KB raw less in every page (PERF-R4-05).
 */
function clientDictionary(locale: "ar" | "en"): Dictionary {
  const { legal: _legal, notify: _notify, ...rest } = getPublicDictionary(locale);
  void _legal;
  void _notify;
  return rest as Dictionary;
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f1f1f1",
};

/**
 * Locale shell: <html lang dir>, fonts, i18n provider. Deliberately chrome-free:
 * each area adds its own chrome in its route-group layout —
 *   (store), (auth), orders, s, vendor/apply layouts -> marketing chrome (MarketingShell)
 *   (checkout)/layout.tsx -> minimal white checkout header (CheckoutShell)
 *   design/layout.tsx -> full-screen designer chrome
 *   vendor/layout.tsx, admin/layout.tsx -> admin frame (top bar + side navigation)
 */
export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  // Arabic pages only: preload the two Plex Arabic cuts used above the fold (PERF-05).
  // Inter (Latin) carries spaces, punctuation and digits in Arabic text too, so it is preloaded on
  // both locales, but at LOW priority on Arabic pages: there it must not compete with the
  // render-blocking CSS and the Plex cuts (R4-MK-05). Not preloading it at all deferred it to
  // ~5 s on Slow 4G and the swap re-reported the Arabic H1 as a later LCP.
  if (locale === "ar") {
    for (const href of plexArabicPreloadUrls(PLEX_PRELOAD_WEIGHTS)) {
      preload(href, { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
    }
  }
  const interHref = interPreloadUrl();
  if (interHref) preload(interHref, { as: "font", type: "font/woff2", crossOrigin: "anonymous", fetchPriority: locale === "ar" ? "low" : "high" });
  return (
    <html lang={locale} dir={dirOf(locale)} className={`${inter.variable} ${plexArabic.variable}`}>
      <body>
        <a className="skip-link" href="#main">
          {dict.common.skipToContent}
        </a>
        <I18nProvider locale={locale} dict={clientDictionary(locale)}>
          {children}
        </I18nProvider>
        {/* First-party `visit` event (B-19): one beacon per browser session, no third-party pixel. */}
        <VisitBeacon locale={locale} />
      </body>
    </html>
  );
}
