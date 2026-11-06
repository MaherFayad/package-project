import type { Metadata } from "next";
import { getT, toLocale } from "@/i18n";
import { JsonLd } from "@/components/store/JsonLd";
import { breadcrumbJsonLd } from "@/components/store/jsonld";
import { BoxesLanding } from "@/components/marketing/BoxesLanding";
import { ModelLinks } from "@/components/designer/ModelLinks";
import { siteUrl } from "@/lib/env";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  return {
    title: t("store.catalog.metaTitle"),
    description: t("store.catalog.metaDescription"),
    alternates: { canonical: `/${locale}/catalog`, languages: { ar: "/ar/catalog", en: "/en/catalog" } },
  };
}

/** Box styles catalogue: the boxes-and-cartons category landing (also served at /boxes). */
export default async function CatalogPage({ params }: Props) {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  const base = siteUrl();
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: t("nav.home"), url: `${base}/${locale}` },
          { name: t("nav.catalog"), url: `${base}/${locale}/catalog` },
        ])}
      />
      <BoxesLanding locale={locale} library={<ModelLinks locale={locale} />} />
    </>
  );
}
