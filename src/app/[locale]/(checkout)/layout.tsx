import type { ReactNode } from "react";
import { preloadPlexArabic } from "@/app/font-preload";
import { toLocale } from "@/i18n";
import { I18nScope } from "@/i18n/I18nScope";
// R5-PL-07: kit styles shared by this area's page, loading, error and not-found segments. With
// inlineCss each segment inlines its own CSS again, unless an ancestor layout already has it.
import "@/components/ui/Stack.module.css";
import "@/components/ui/Card.module.css";
import "@/components/ui/Page.module.css";
import "@/components/ui/ActionList.module.css";
import "@/components/ui/Skeleton.module.css";
import "@/components/ui/Button.module.css";
import "@/components/ui/Spinner.module.css";
import "./checkout/_components/checkout.module.css";
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
  return (
    <I18nScope locale={toLocale(locale)} scope="checkout">
      <CheckoutShell locale={toLocale(locale)}>{children}</CheckoutShell>
    </I18nScope>
  );
}
