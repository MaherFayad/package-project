import type { Metadata } from "next";
import { getT, toLocale } from "@/i18n";
import { JsonLd } from "@/components/store/JsonLd";
import { breadcrumbJsonLd } from "@/components/store/jsonld";
import { siteUrl } from "@/lib/env";
import { formatNumber } from "@/lib/format";
import { CatalogueBrowser } from "@/components/catalogue/CatalogueBrowser";
import { COPY, fill } from "@/components/catalogue/copy";
import { getCatalogueData } from "@/components/catalogue/server";
import mk from "@/components/marketing/marketing.module.css";
import styles from "@/components/catalogue/catalogue.module.css";

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
  const families = data.taxonomy.length;
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: t("nav.home"), url: `${base}/${locale}` },
          { name: t("nav.catalog"), url: `${base}/${locale}/catalog` },
        ])}
      />
      <section className={`${mk.band} ${mk.bandMint}`} aria-labelledby="catalogue-title" style={{ paddingBlockStart: "clamp(48px, 6vw, 80px)", paddingBlockEnd: 40 }}>
        <div className={mk.container}>
          <span className={`${mk.eyebrow} m-enter`}>{COPY.eyebrow[locale]}</span>
          <h1 id="catalogue-title" className={`${mk.h1} m-enter`} style={{ ["--m-i" as string]: 1 }}>
            {COPY.title[locale]}
          </h1>
          <p className={`${mk.lead} m-enter`} style={{ ["--m-i" as string]: 2, marginBlockStart: 20 }}>
            {fill(COPY.lead[locale], { count: formatNumber(data.counts.total) })}
          </p>
          <dl className={`${styles.stats} m-enter`} style={{ ["--m-i" as string]: 3 }}>
            {[
              [data.counts.total, COPY.statModels],
              [data.counts.egypt, COPY.statEgypt],
              [data.counts.instant, COPY.statInstant],
              [families, COPY.statFamilies],
            ].map(([n, label]) => (
              <div key={(label as { en: string }).en} className={styles.stat}>
                <dt className={styles.statLabel}>{(label as { ar: string; en: string })[locale]}</dt>
                <dd className={styles.statNum} style={{ order: -1, margin: 0 }}>
                  {formatNumber(n as number)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
      <section className={mk.band} style={{ paddingBlockStart: 0 }} aria-label={COPY.eyebrow[locale]}>
        <div className={mk.container}>
          <CatalogueBrowser locale={locale} cards={data.cards} taxonomy={data.taxonomy} />
        </div>
      </section>
    </>
  );
}
