import type { ReactNode } from "react";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { toLocale } from "@/i18n";

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
    <MarketingShell locale={toLocale(locale)} boundary={false}>
      {children}
    </MarketingShell>
  );
}
