import type { ReactNode } from "react";
import { toLocale } from "@/i18n";
import { I18nScope } from "@/i18n/I18nScope";
// R5-PL-07: kit styles shared by this area's page, loading, error and not-found segments. With
// inlineCss each segment inlines its own CSS again, unless an ancestor layout already has it.
import "@/components/ui/Stack.module.css";
import "@/components/designer/library.module.css";

/** Designer area (picker and editor): adds the designer's dictionary keys to the root scope (R5-PL-08). */
export default async function DesignAreaLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  return (
    <I18nScope locale={toLocale((await params).locale)} scope="design">
      {children}
    </I18nScope>
  );
}
