import type { ReactNode } from "react";
import { toLocale } from "@/i18n";
import { I18nScope } from "@/i18n/I18nScope";
// R5-PL-07: kit styles shared by this area's page, loading, error and not-found segments. With
// inlineCss each segment inlines its own CSS again, unless an ancestor layout already has it.
import "@/components/ui/Stack.module.css";
import "@/components/ui/Card.module.css";
import "@/components/ui/Layout.module.css";

/** Account page: adds the account and buyer dictionary keys to the root scope (R5-PL-08). */
export default async function AccountLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  return (
    <I18nScope locale={toLocale((await params).locale)} scope="account">
      {children}
    </I18nScope>
  );
}
