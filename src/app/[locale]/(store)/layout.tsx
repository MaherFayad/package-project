import type { ReactNode } from "react";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { toLocale } from "@/i18n";

/** Public pages (home, products, printers, legal, account) use the marketing-site chrome. */
export default async function Layout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <MarketingShell locale={toLocale(locale)}>{children}</MarketingShell>;
}
