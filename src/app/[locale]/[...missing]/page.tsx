import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getT, toLocale } from "@/i18n";

/**
 * Catch-all for unknown paths under /ar and /en (CR-04, X-03). Without it they fell through to
 * the global app/not-found.tsx (no chrome, no locale). Throwing here renders the sibling
 * not-found.tsx inside MarketingShell, in the page language, with a 404 status.
 * /api, /_next and files never reach it: they are not under [locale] (see middleware matcher).
 */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = getT(toLocale((await params).locale));
  // Server-rendered title (WCAG 2.4.2): the not-found render otherwise keeps the site default.
  return { title: t("common.notFoundTitle"), robots: { index: false, follow: false } };
}

export default function MissingPage(): never {
  notFound();
}
