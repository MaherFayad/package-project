import type { Metadata } from "next";
import type { ReactNode } from "react";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { getT, toLocale } from "@/i18n";

/**
 * Server-rendered 404 title (WCAG 2.4.2). It lives on the layout because Next drops a page's own
 * metadata when that page throws notFound(); layout metadata still applies to the not-found render.
 */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = getT(toLocale((await params).locale));
  return { title: t("common.notFoundTitle"), robots: { index: false, follow: false } };
}

/** Unknown paths under a locale get the buyer-facing chrome around the 404 (CR-04). */
export default async function MissingLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  // boundary={false}: this route only ever renders the 404, which must keep its 404 status (a
  // notFound() inside the shell's Suspense boundary would stream as 200; R4-MK-09).
  return (
    <MarketingShell locale={toLocale(locale)} boundary={false}>
      {children}
    </MarketingShell>
  );
}
