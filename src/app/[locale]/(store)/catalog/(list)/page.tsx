import type { Metadata } from "next";
import { getT, toLocale } from "@/i18n";
import { JsonLd } from "@/components/store/JsonLd";
import { breadcrumbJsonLd } from "@/components/store/jsonld";
import { siteUrl } from "@/lib/env";
import { formatNumber } from "@/lib/format";
import { CatalogueBrowser } from "@/components/catalogue/CatalogueBrowser";
import { COPY, fill } from "@/components/catalogue/copy";
import { getCatalogueData } from "@/components/catalogue/server";
import rs from "@/components/marketing/restyle/restyle.module.css";
import { Sheet } from "@/components/marketing/kit/Sheet";
import { Display, Eyebrow, Lead } from "@/components/marketing/kit/Display";

type Props = { params: Promise<{ locale: string }> };

/** Instant-price badges follow the live printer list (cached 5 minutes, as getCatalogueData). */
export const revalidate = 300;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = toLocale((await params).locale);
  return {
    title: COPY.metaTitle[locale],
    description: COPY.metaDescription[locale],
    alternates: { canonical: `/${locale}/catalog`, languages: { ar: "/ar/catalog", en: "/en/catalog" } },
  };
}

/**
 * Worldwide packaging catalogue: every 3D model (boxes, cartons, rigid, tubes, food service,
 * flexible, glass, plastic, cosmetic / pharma, metal, envelopes, bulk) by family and
 * sub-family, filtered to what is available in Egypt by default.
 */
export default async function CatalogPage({ params }: Props) {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  const base = siteUrl();
  const data = await getCatalogueData();
  return (
    <div className={rs.page}>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: t("nav.home"), url: `${base}/${locale}` },
          { name: t("nav.catalog"), url: `${base}/${locale}/catalog` },
        ])}
      />
      <Sheet tone="dark" hero className={`${rs.heroCompact} ${rs.glow}`} aria-labelledby="catalogue-title">
        <Eyebrow className="m-enter">{COPY.eyebrow[locale]}</Eyebrow>
        <Display as="h1" size="64" id="catalogue-title" className="m-enter-lcp">
          {COPY.title[locale]}
        </Display>
        <Lead className="m-enter-lcp">{fill(COPY.lead[locale], { count: formatNumber(data.counts.total) })}</Lead>
        <dl className={`${rs.stats} m-enter`}>
          {[
            [data.counts.total, COPY.statModels],
            [data.counts.designer, COPY.statDesigner],
            [data.counts.egypt, COPY.statEgypt],
            [data.counts.instant, COPY.statInstant],
          ].map(([n, label]) => (
            <div key={(label as { en: string }).en} className={rs.stat}>
              <dt className={rs.statLabel}>{(label as { ar: string; en: string })[locale]}</dt>
              <dd className={rs.statNum}>{formatNumber(n as number)}</dd>
            </div>
          ))}
        </dl>
      </Sheet>
      <Sheet tone="white" className={rs.sheetTop} aria-label={COPY.eyebrow[locale]}>
        <CatalogueBrowser locale={locale} cards={data.cards} taxonomy={data.taxonomy} />
      </Sheet>
    </div>
  );
}
