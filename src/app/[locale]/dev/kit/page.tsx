import type { Metadata } from "next";
import { toLocale } from "@/i18n";
import { KitGallery } from "./KitGallery";

export const metadata: Metadata = {
  title: "Marketing kit",
  robots: { index: false, follow: false },
};

/** Developer gallery of every marketing kit component (/ar/dev/kit, /en/dev/kit). Not in the sitemap; disallowed in robots.txt. */
export default async function KitPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = toLocale((await params).locale);
  return <KitGallery locale={locale} />;
}
