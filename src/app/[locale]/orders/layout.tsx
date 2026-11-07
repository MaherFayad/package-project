import type { ReactNode } from "react";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { toLocale } from "@/i18n";
import { I18nScope } from "@/i18n/I18nScope";
// R5-PL-07: kit styles shared by this area's page, loading, error and not-found segments. With
// inlineCss each segment inlines its own CSS again, unless an ancestor layout already has it.
import "@/components/ui/Card.module.css";
import "@/components/ui/Page.module.css";
import "@/components/ui/ActionList.module.css";
import "@/components/ui/Button.module.css";
import "@/components/ui/Spinner.module.css";

export default async function Layout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // No hydration boundary in the shell: the [id] layout checks the order first and then adds it,
  // so an unknown or someone else's order answers a real 404 (not 200 + noindex, R4-MK-09).
  return (
    <I18nScope locale={toLocale(locale)} scope="orders">
      <MarketingShell locale={toLocale(locale)} boundary={false}>
        {children}
      </MarketingShell>
    </I18nScope>
  );
}
