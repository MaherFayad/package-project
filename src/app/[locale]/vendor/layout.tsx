import type { ReactNode } from "react";
import { preloadPlexArabic } from "@/app/font-preload";
import { toLocale } from "@/i18n";
import { I18nScope } from "@/i18n/I18nScope";
// R5-PL-07: kit styles shared by this area's page, loading, error and not-found segments. With
// inlineCss each segment inlines its own CSS again, unless an ancestor layout already has it.
import "@/components/ui/Stack.module.css";
import "@/components/ui/Card.module.css";
import "@/components/ui/Button.module.css";
import "@/components/ui/Spinner.module.css";

/**
 * Vendor area root (owner: vendor portal). The two route groups bring their own
 * chrome and their own single <main id="main">:
 *   (portal)/  admin frame, role VENDOR required   -> /[locale]/vendor, /jobs, /profile, /rate-cards, /payouts
 *   apply/     marketing chrome, any visitor            -> /[locale]/vendor/apply (onboarding)
 * It adds the vendor portal namespace to the root scope dictionary (R5-PL-08).
 */
export default async function VendorAreaLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const locale = toLocale((await params).locale);
  preloadPlexArabic(locale); // app frame font (Plex), Arabic only
  return (
    <I18nScope locale={locale} scope="vendor">
      {children}
    </I18nScope>
  );
}
