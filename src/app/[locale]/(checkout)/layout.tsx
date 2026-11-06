import type { ReactNode } from "react";
import { toLocale } from "@/i18n";
import { CheckoutShell } from "./_components/CheckoutShell";

export default async function Layout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <CheckoutShell locale={toLocale(locale)}>{children}</CheckoutShell>;
}
