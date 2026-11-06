import type { Metadata } from "next";
import { toLocale } from "@/i18n";
import { UiShowcase } from "./UiShowcase";

export const metadata: Metadata = {
  title: "UI kit",
  robots: { index: false, follow: false },
};

/** Developer showcase of every UI kit component, in Arabic (/ar/dev/ui) and English (/en/dev/ui). */
export default async function UiShowcasePage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = toLocale((await params).locale);
  return <UiShowcase locale={locale} />;
}
