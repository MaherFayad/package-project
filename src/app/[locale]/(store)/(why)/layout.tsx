import type { ReactNode } from "react";
import { toLocale } from "@/i18n";
import { I18nScope } from "@/i18n/I18nScope";

/**
 * /why-elba and /pricing (owner: r6-why). A route group (no URL segment) so the dictionary keys
 * these pages reach (checkout's line labels via the shared price computation, the marquee
 * controls) load in their own "why" scope instead of the root scope every page ships (R5-PL-08).
 */
export default async function WhyLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  return (
    <I18nScope locale={toLocale((await params).locale)} scope="why">
      {children}
    </I18nScope>
  );
}
