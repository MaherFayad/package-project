import type { ReactNode } from "react";
import { requireRole } from "@/lib/auth/session";
import { toLocale } from "@/i18n";

/**
 * admin area layout — FOUNDATION PLACEHOLDER. Owner: admin agent.
 * Guarded by requireRole("ADMIN"). Replace with the admin frame (top bar + side navigation)
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
  await requireRole("ADMIN", locale, `/${locale}/admin`);
  return <main id="main">{children}</main>;
}
