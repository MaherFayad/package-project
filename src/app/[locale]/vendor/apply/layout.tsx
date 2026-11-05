import type { ReactNode } from "react";
import { StoreShell } from "@/components/store/StoreShell";
import { toLocale } from "@/i18n";

/** Vendor onboarding uses the buyer-facing shell (applicants are not vendors yet). One <main id="main"> via StoreShell. */
export default async function ApplyLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const locale = toLocale((await params).locale);
  return <StoreShell locale={locale}>{children}</StoreShell>;
}
