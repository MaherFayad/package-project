import type { ReactNode } from "react";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { toLocale } from "@/i18n";

/**
 * Design start page (owner: designer): the buyer-facing marketing chrome (CR-05), so a visitor
 * coming from the home page keeps the same white header and footer. Only the full-screen editor
 * (`(editor)`) keeps the dark designer bar.
 */
export default async function DesignPickerLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <MarketingShell locale={toLocale(locale)}>{children}</MarketingShell>;
}
