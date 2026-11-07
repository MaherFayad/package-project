import type { Metadata } from "next";
import { getT, toLocale } from "@/i18n";
import { JsonLd } from "@/components/store/JsonLdScript";
import { breadcrumbJsonLd } from "@/components/store/jsonld";
import { siteUrl } from "@/lib/env";
import { CatalogueBrowser } from "@/components/catalogue/CatalogueBrowser";
import { COPY } from "@/components/catalogue/copy";
import { getCatalogueData } from "@/components/catalogue/server";
import styles from "@/components/catalogue/catalogue.module.css";
import { Sheet } from "@/components/marketing/kit/Sheet";
import { Glow } from "@/components/marketing/kit/Glow";
import { Eyebrow, Lead } from "@/components/marketing/kit/Display";
import { HeroTitle } from "@/components/marketing/kit/HeroTitle";
import { Pill } from "@/components/marketing/kit/Pill";
import { startHref } from "@/components/marketing/navModel";

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
    <div>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: t("nav.home"), url: `${base}/${locale}` },
          { name: t("nav.catalog"), url: `${base}/${locale}/catalog` },
        ])}
      />
      <Sheet tone="dark" hero className={`${styles.heroCompact} ${styles.heroClip}`} aria-labelledby="catalogue-title">
        <Glow color="violet" x="85%" y="0%" size="70vmax" />
        <Glow color="green" x="5%" y="110%" size="45vmax" />
        <Eyebrow className="m-enter">{COPY.eyebrow[locale]}</Eyebrow>
        <HeroTitle size="64" id="catalogue-title" text={COPY.title[locale]} />
        <Lead className="m-enter-lcp">{COPY.lead[locale]}</Lead>
        {/* R1-09: no counter block; the shop-style way in is the box chooser, grouped by what you sell. */}
        <div className={`${styles.pick} m-enter`}>
          <p>{COPY.pickTitle[locale]}</p>
          <Pill href={startHref(locale)} size="lg">
            {COPY.pickCta[locale]}
          </Pill>
        </div>
      </Sheet>
      <Sheet tone="white" aria-label={COPY.eyebrow[locale]}>
        <CatalogueBrowser locale={locale} cards={data.cards} taxonomy={data.taxonomy} />
      </Sheet>
    </div>
  );
}
