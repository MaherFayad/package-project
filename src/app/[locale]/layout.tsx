import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { inter, plexArabic } from "@/app/fonts";
import { dirOf, getDictionary, isLocale } from "@/i18n";
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
    alternates: { languages: { ar: "/ar", en: "/en" } },
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
  return (
    <html lang={locale} dir={dirOf(locale)} className={`${inter.variable} ${plexArabic.variable}`}>
      <body>
        <a className="skip-link" href="#main">
          {dict.common.skipToContent}
        </a>
        <I18nProvider locale={locale} dict={dict}>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
