import type { ReactNode } from "react";
import { preloadPlexArabic } from "@/app/font-preload";
import { getDictionary, toLocale } from "@/i18n";
import { I18nProvider } from "@/i18n/client";

/**
 * Vendor area root (owner: vendor portal). The two route groups bring their own
 * chrome and their own single <main id="main">:
 *   (portal)/  admin frame, role VENDOR required   -> /[locale]/vendor, /jobs, /profile, /rate-cards, /payouts
 *   apply/     marketing chrome, any visitor            -> /[locale]/vendor/apply (onboarding)
 * It mounts the full dictionary: the root layout leaves the vendor portal namespace out of public pages.
 */
export default async function VendorAreaLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const locale = toLocale((await params).locale);
  preloadPlexArabic(locale); // app frame font (Plex), Arabic only
  return (
    <I18nProvider locale={locale} dict={getDictionary(locale)}>
      {children}
    </I18nProvider>
  );
}
