import type { Metadata } from "next";
import { NotFoundState } from "@/components/marketing/NotFoundState";
import { getDictionary, toLocale } from "@/i18n";
import { LOCALES } from "@/types";

/**
 * The 404 the middleware rewrites known-missing URLs to, with HTTP 404 (src/lib/routing/static-404.ts).
 * It renders the marketing 404 state without throwing notFound(), so it is server-rendered with its
 * CSS and paints before the JavaScript loads (R6-RS-11). The URL in the address bar stays the
 * visitor's own.
 */
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const d = getDictionary(toLocale((await params).locale));
  return { title: d.common.notFoundTitle, robots: { index: false, follow: true } };
}

export default function PageNotFound() {
  return <NotFoundState />;
}
