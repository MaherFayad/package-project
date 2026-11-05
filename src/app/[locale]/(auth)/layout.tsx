import type { ReactNode } from "react";
import { StoreShell } from "@/components/store/StoreShell";
import { toLocale } from "@/i18n";

export default async function Layout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <StoreShell locale={toLocale(locale)}>{children}</StoreShell>;
}
