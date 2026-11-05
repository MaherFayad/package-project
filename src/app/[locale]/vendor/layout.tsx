import type { ReactNode } from "react";
import { requireRole } from "@/lib/auth/session";
import { toLocale } from "@/i18n";

/**
 * vendor area layout — FOUNDATION PLACEHOLDER. Owner: vendor portal agent.
 * Guarded by requireRole("VENDOR"). Replace with the admin frame (top bar + side navigation)
 * from src/components/ui once the UI kit provides it. Must render <main id="main">.
 */
export default async function Layout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const locale = toLocale((await params).locale);
  await requireRole("VENDOR", locale, `/${locale}/vendor`);
  return <main id="main">{children}</main>;
}
