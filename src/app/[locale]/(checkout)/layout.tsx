import type { ReactNode } from "react";
import { preloadPlexArabic } from "@/app/font-preload";
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
  preloadPlexArabic(locale); // app frame font (Plex), Arabic only
  return <CheckoutShell locale={toLocale(locale)}>{children}</CheckoutShell>;
}
