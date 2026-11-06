import type { ReactNode } from "react";
import { toLocale } from "@/i18n";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { I18nScope } from "@/i18n/I18nScope";
// R5-PL-07: kit styles shared by this area's page, loading, error and not-found segments. With
// inlineCss each segment inlines its own CSS again, unless an ancestor layout already has it.
import "@/components/ui/Stack.module.css";
import "@/components/ui/Card.module.css";
import "@/components/ui/Page.module.css";
import "@/components/ui/Button.module.css";
import "@/components/ui/Spinner.module.css";
import "@/components/ui/ActionList.module.css";

/** Public share links (owner: designer). Buyer-facing marketing chrome; one <main id="main"> via MarketingShell. */
export default async function ShareLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const locale = toLocale((await params).locale);
  // No hydration boundary in the shell: the [id] layout checks the token first (R4-MK-09).
  return (
    <I18nScope locale={locale} scope="share">
      <MarketingShell locale={locale} boundary={false}>
        {children}
      </MarketingShell>
    </I18nScope>
  );
}
