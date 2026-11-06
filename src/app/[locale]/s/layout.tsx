import type { ReactNode } from "react";
import { toLocale } from "@/i18n";
import { MarketingShell } from "@/components/marketing/MarketingShell";

/** Public share links (owner: designer). Buyer-facing marketing chrome; one <main id="main"> via MarketingShell. */
export default async function ShareLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const locale = toLocale((await params).locale);
  return <MarketingShell locale={locale}>{children}</MarketingShell>;
}
