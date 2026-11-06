import type { Metadata } from "next";
import type { ReactNode } from "react";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { getT, toLocale } from "@/i18n";

/**
 * Detail pages that can 404 on their params (printer profiles, size landings). The shell renders
 * here WITHOUT its hydration Suspense boundary; each segment layout below validates its params
 * first and then wraps the page in that boundary itself. So a bad slug throws notFound() outside
 * any Suspense boundary and answers a real 404 with the full chrome (the sibling not-found.tsx
 * files), while valid pages still hydrate inside a boundary (R4-MK-09).
 */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  // The title shows only when a segment layout below throws notFound(); every page sets its own.
  // The locale layout's "%s · Elba" template still applies (to this default too, and to the
  // pages through the restated template). No robots here: it would be inherited by every valid
  // page; Next adds noindex to the 404 render itself.
  const t = getT(toLocale((await params).locale));
  return { title: { default: t("common.notFoundTitle"), template: `%s · ${t("meta.siteName")}` } };
}

export default async function DetailLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return (
    <MarketingShell locale={toLocale(locale)} boundary={false}>
      {children}
    </MarketingShell>
  );
}
