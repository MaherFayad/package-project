import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { preload } from "react-dom";
import { inter, plexArabic, PLEX_PRELOAD_WEIGHTS } from "@/app/fonts";
import { plexArabicPreloadUrls } from "@/app/font-preload";
import { dirOf, getDictionary, getPublicDictionary, isLocale } from "@/i18n";
import { I18nProvider } from "@/i18n/client";
import { LOCALES } from "@/types";

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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f1f1f1",
};

/**
 * Locale shell: <html lang dir>, fonts, i18n provider. Deliberately chrome-free:
 * each area adds its own chrome in its route-group layout —
 *   (store)/layout.tsx, (checkout)/layout.tsx, orders/layout.tsx, (auth)/layout.tsx -> store header/footer
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
  if (locale === "ar") {
    for (const href of plexArabicPreloadUrls(PLEX_PRELOAD_WEIGHTS)) {
      preload(href, { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
    }
  }
  return (
    <html lang={locale} dir={dirOf(locale)} className={`${inter.variable} ${plexArabic.variable}`}>
      <body>
        <a className="skip-link" href="#main">
          {dict.common.skipToContent}
        </a>
        <I18nProvider locale={locale} dict={getPublicDictionary(locale)}>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
