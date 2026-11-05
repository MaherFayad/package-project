import type { Metadata } from "next";
import { getT, toLocale } from "@/i18n";
import { siteUrl } from "@/lib/env";
import { Banner, Breadcrumbs, Card, EmptyBoxIllustration, EmptyState, Button, Text } from "@/components/ui";
import { VendorCard } from "@/components/store/VendorCard";
import { VendorFiltersForm } from "@/components/store/VendorFiltersForm";
import { JsonLd } from "@/components/store/JsonLd";
import { breadcrumbJsonLd } from "@/components/store/jsonld";
import { listVendors } from "@/components/store/data";
import { activeFilterCount, filterVendors, parseVendorFilters } from "@/components/store/vendor-filters";
import styles from "@/components/store/store.module.css";

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

export default async function VendorsPage({ params, searchParams }: Props) {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  const filters = parseVendorFilters(await searchParams);
  const all = await listVendors();
  const list = filterVendors(all, filters);
  const base = siteUrl();
  const action = `/${locale}/vendors`;

  return (
    <div className={styles.page}>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: t("nav.home"), url: `${base}/${locale}` },
          { name: t("vendors.title"), url: `${base}${action}` },
        ])}
      />
      <div className={styles.stack}>
        <div className={styles.headerBlock}>
          <Breadcrumbs items={[{ content: t("nav.home"), url: `/${locale}` }, { content: t("vendors.title") }]} />
          <h1 className={styles.pageTitle}>{t("vendors.title")}</h1>
          <p className={styles.lead}>{t("store.vendors.intro")}</p>
        </div>
        <Banner tone="info">{t("store.vendors.managedNote")}</Banner>
        <Card title={t("store.vendors.filtersTitle")} as="section">
          <VendorFiltersForm filters={filters} action={action} />
        </Card>
        <section className={styles.section} aria-labelledby="results-title">
          <h2 id="results-title" className={styles.sectionTitle}>
            <span aria-live="polite">{t("store.vendors.results", { count: list.length })}</span>
          </h2>
          {list.length ? (
            <div className={`${styles.grid} ${styles.gridWide}`}>
              {list.map((v) => (
                <VendorCard key={v.id} locale={locale} vendor={v} />
              ))}
            </div>
          ) : (
            <Card>
              <EmptyState
                heading={t("store.vendors.emptyTitle")}
                headingAs="h3"
                image={<EmptyBoxIllustration />}
                action={<Button url={action}>{t("store.vendors.clear")}</Button>}
              >
                <Text as="p">{t("store.vendors.emptyBody")}</Text>
              </EmptyState>
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}
