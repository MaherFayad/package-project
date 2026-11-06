import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { getT, toLocale } from "@/i18n";
import { siteUrl } from "@/lib/env";
import { VendorFiltersForm } from "@/components/store/VendorFiltersForm";
import { JsonLd } from "@/components/store/JsonLd";
import { breadcrumbJsonLd } from "@/components/store/jsonld";
import { listVendors } from "@/components/store/data";
import { activeFilterCount, filterVendors, parseVendorFilters } from "@/components/store/vendor-filters";
import { VendorShowcaseCard } from "@/components/marketing/VendorShowcaseCard";
import { renderSrc } from "@/components/marketing/assets";
import styles from "@/components/marketing/marketing.module.css";

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
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: t("nav.home"), url: `${base}/${locale}` },
          { name: t("vendors.title"), url: `${base}${action}` },
        ])}
      />
      <section className={`${styles.centerHero} ${styles.bandMint}`} aria-labelledby="vendors-title" style={{ paddingBlockEnd: "clamp(48px, 6vw, 80px)" }}>
        <div className={styles.container}>
          <span className={`${styles.eyebrow} m-enter`}>{t("marketing.vendors.eyebrow")}</span>
          <h1 id="vendors-title" className={`${styles.h1} m-enter`} style={{ ["--m-i" as string]: 1 }}>
            {t("marketing.vendors.title")}
          </h1>
          <p className={`${styles.lead} m-enter`} style={{ ["--m-i" as string]: 2 }}>
            {t("marketing.vendors.body")}
          </p>
        </div>
      </section>

      <section className={styles.band} style={{ paddingBlockStart: 48 }} aria-labelledby="results-title">
        <div className={styles.container}>
          <p className={styles.managed}>
            <ShieldCheck size={20} aria-hidden />
            <span>{t("store.vendors.managedNote")}</span>
          </p>
          <section className={styles.filtersPanel} aria-labelledby="filters-title">
            <h2 id="filters-title">{t("marketing.vendors.filters")}</h2>
            <VendorFiltersForm filters={filters} action={action} />
          </section>
          <h2 id="results-title" className={styles.results}>
            <span aria-live="polite">{t("store.vendors.results", { count: list.length })}</span>
          </h2>
          {list.length ? (
            <ul className={styles.cardGrid}>
              {list.map((v, i) => (
                <VendorShowcaseCard key={v.id} locale={locale} vendor={v} index={i} />
              ))}
            </ul>
          ) : (
            <div className={`${styles.card} ${styles.center}`} style={{ justifyItems: "center", textAlign: "center", paddingBlock: 48 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={renderSrc("FEFCO_0201")} alt="" width={160} height={120} style={{ inlineSize: 160, blockSize: "auto" }} />
              <h3 className={styles.h3}>{t("store.vendors.emptyTitle")}</h3>
              <p className={styles.body}>{t("store.vendors.emptyBody")}</p>
              <Link href={action} className={`${styles.pill} ${styles.pillOutline}`}>
                {t("store.vendors.clear")}
              </Link>
            </div>
          )}

          <div className={styles.joinBand} style={{ marginBlockStart: "clamp(64px, 8vw, 104px)" }} data-reveal="" suppressHydrationWarning>
            <div style={{ display: "grid", gap: 12 }}>
              <h2 className={styles.h2}>{t("marketing.vendors.joinTitle")}</h2>
              <p className={styles.body} style={{ color: "var(--mk-on-dark-2)" }}>
                {t("marketing.vendors.joinBody")}
              </p>
            </div>
            <Link href={`/${locale}/vendor/apply`} className={`${styles.pill} ${styles.pillLime} ${styles.pillLarge}`}>
              {t("marketing.vendors.join")}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
