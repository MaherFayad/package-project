import type { Metadata } from "next";
import { getT, toLocale } from "@/i18n";
import { BoxesLanding } from "@/components/marketing/BoxesLanding";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  return {
    title: t("marketing.boxes.title"),
    description: t("marketing.boxes.body"),
    // Same content as /catalog (the indexed URL).
    alternates: { canonical: `/${locale}/catalog`, languages: { ar: "/ar/catalog", en: "/en/catalog" } },
  };
}

/** Products → Boxes and cartons: category landing. */
export default async function BoxesPage({ params }: Props) {
  return <BoxesLanding locale={toLocale((await params).locale)} />;
}
