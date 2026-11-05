import type { ReactNode } from "react";
import { toLocale } from "@/i18n";
import { AppProvider } from "@/components/ui";
import { StoreShell } from "@/components/store/StoreShell";

/** Public share links (owner: designer). Store chrome; renders <main id="main"> via StoreShell. */
export default async function ShareLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const locale = toLocale((await params).locale);
  return (
    <AppProvider locale={locale}>
      <StoreShell locale={locale}>{children}</StoreShell>
    </AppProvider>
  );
}
