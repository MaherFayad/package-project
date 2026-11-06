import type { ReactNode } from "react";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { toLocale } from "@/i18n";

/** Unknown paths under a locale get the buyer-facing chrome around the 404 (CR-04). */
export default async function MissingLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <MarketingShell locale={toLocale(locale)}>{children}</MarketingShell>;
}
