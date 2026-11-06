import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { getT, toLocale } from "@/i18n";
import { siteUrl } from "@/lib/env";
import { VendorFiltersForm } from "@/components/store/VendorFiltersForm";
import { JsonLd } from "@/components/store/JsonLd";
import { breadcrumbJsonLd } from "@/components/store/jsonld";
import { listVendors } from "@/components/store/data";
import { activeFilterCount, filterVendors, parseVendorFilters } from "@/components/store/vendor-filters";
import { VendorShowcaseCard } from "@/components/marketing/VendorShowcaseCard";
import { renderSrc, srcSetFor } from "@/components/marketing/assets";
import styles from "@/components/marketing/marketing.module.css";
import rs from "@/components/marketing/restyle/restyle.module.css";
import dt from "@/components/marketing/restyle/detail.module.css";
import { Sheet } from "@/components/marketing/kit/Sheet";
import { Display, Eyebrow, Lead } from "@/components/marketing/kit/Display";
import { Pill } from "@/components/marketing/kit/Pill";
import { Reveal } from "@/components/marketing/kit/Reveal";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  const filtered = activeFilterCount(parseVendorFilters(await searchParams)) > 0;
  return {
    title: t("vendors.title"),
    description: t("store.vendors.metaDescription"),
    alternates: { canonical: `/${locale}/vendors`, languages: { ar: "/ar/vendors", en: "/en/vendors" } },
    // Filtered views are near-duplicates of the directory: keep them out of the index.
    robots: filtered ? { index: false, follow: true } : undefined,
  };
}

/** Printers directory, marketing style: centred hero, filters, printer cards, "become a printer" band. */
export default async function VendorsPage({ params, searchParams }: Props) {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  const filters = parseVendorFilters(await searchParams);
  const all = await listVendors();
  const list = filterVendors(all, filters);
  const base = siteUrl();
  const action = `/${locale}/vendors`;

  return (
    <div className={rs.page}>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: t("nav.home"), url: `${base}/${locale}` },
          { name: t("vendors.title"), url: `${base}${action}` },
        ])}
      />
      <Sheet tone="dark" hero container="narrow" className={`${rs.heroCompact} ${rs.heroCenter}`} aria-labelledby="vendors-title">
        <Eyebrow className="m-enter">{t("marketing.vendors.eyebrow")}</Eyebrow>
        <Display as="h1" size="64" align="center" id="vendors-title" className="m-enter-lcp">
          {t("marketing.vendors.title")}
        </Display>
        <Lead align="center" className="m-enter-lcp">
          {t("marketing.vendors.body")}
        </Lead>
        <p className={`${rs.small} ${rs.inlineIcon} m-enter`} style={{ marginBlockStart: 24 }}>
          <ShieldCheck size={18} aria-hidden />
          <span>{t("store.vendors.managedNote")}</span>
        </p>
      </Sheet>

      <Sheet tone="white" className={rs.sheetTop} aria-labelledby="results-title">
        <section className={dt.tile} aria-labelledby="filters-title">
          <h2 id="filters-title" className={rs.cardTitle}>
            {t("marketing.vendors.filters")}
          </h2>
          <VendorFiltersForm locale={locale} filters={filters} action={action} />
        </section>
        <h2 id="results-title" className={dt.results}>
          <span aria-live="polite">{t("store.vendors.results", { count: list.length })}</span>
        </h2>
        {list.length ? (
          <ul className={styles.cardGrid}>
            {list.map((v, i) => (
              <VendorShowcaseCard key={v.id} locale={locale} vendor={v} index={i} />
            ))}
          </ul>
        ) : (
          <div className={`${dt.tile} ${rs.heroCenter}`} style={{ justifyItems: "center", paddingBlock: 48 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={renderSrc("FEFCO_0201")}
              srcSet={srcSetFor(renderSrc("FEFCO_0201"))}
              sizes="160px"
              loading="lazy"
              decoding="async"
              alt=""
              width={160}
              height={120}
              style={{ inlineSize: 160, blockSize: "auto" }}
            />
            <h3 className={rs.cardTitle}>{t("store.vendors.emptyTitle")}</h3>
            <p className={rs.muted} style={{ margin: 0 }}>
              {t("store.vendors.emptyBody")}
            </p>
            <Pill href={action} variant="outline-dark" size="lg">
              {t("store.vendors.clear")}
            </Pill>
          </div>
        )}
      </Sheet>

      <Sheet tone="green" aria-labelledby="join-title">
        <Reveal className={rs.head} style={{ marginBlockEnd: 0, alignItems: "center" }}>
          <div>
            <Display size="56" id="join-title">
              {t("marketing.vendors.joinTitle")}
            </Display>
            <Lead>{t("marketing.vendors.joinBody")}</Lead>
          </div>
          <Pill href={`/${locale}/vendor/apply`} size="lg">
            {t("marketing.vendors.join")}
          </Pill>
        </Reveal>
      </Sheet>
    </div>
  );
}
