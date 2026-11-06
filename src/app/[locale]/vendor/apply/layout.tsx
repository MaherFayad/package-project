import type { ReactNode } from "react";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { toLocale } from "@/i18n";

/** Vendor onboarding uses the buyer-facing marketing chrome (applicants are not vendors yet). One <main id="main"> via MarketingShell. */
export default async function ApplyLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const locale = toLocale((await params).locale);
  return <MarketingShell locale={locale}>{children}</MarketingShell>;
}
