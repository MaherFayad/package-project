import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { getT, toLocale } from "@/i18n";
import { siteUrl } from "@/lib/env";
import { VendorFiltersForm } from "@/components/store/VendorFiltersForm";
import { JsonLd } from "@/components/store/JsonLdScript";
import { breadcrumbJsonLd } from "@/components/store/jsonld";
import { listVendors } from "@/components/store/data";
import { activeFilterCount, filterVendors, parseVendorFilters } from "@/components/store/vendor-filters";
import { VendorShowcaseCard } from "@/components/marketing/VendorShowcaseCard";
import { renderSrc, srcSetFor } from "@/components/marketing/assets";
import rs from "@/components/marketing/restyle/restyle.module.css";
import dt from "@/components/marketing/restyle/detail.module.css";
import { Sheet } from "@/components/marketing/kit/Sheet";
import { Eyebrow, Lead } from "@/components/marketing/kit/Display";
import { HeroTitle } from "@/components/marketing/kit/HeroTitle";
import { Pill } from "@/components/marketing/kit/Pill";
import { SectionHead, Stack } from "@/components/marketing/kit/SectionHead";
import { Grid } from "@/components/marketing/kit/Grid";

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
        <HeroTitle size="64" align="center" id="vendors-title" text={t("marketing.vendors.title")} />
        <Lead align="center" className="m-enter-lcp">
          {t("marketing.vendors.body")}
        </Lead>
        <p className={`${rs.small} ${rs.inlineIcon} ${rs.afterLead} m-enter`}>
          <ShieldCheck size={18} aria-hidden />
          <span>{t("store.vendors.managedNote")}</span>
        </p>
      </Sheet>

      <Sheet tone="white" aria-labelledby="results-title">
        <Stack gap="head-content">
          <section className={dt.tile} aria-labelledby="filters-title">
            <h2 id="filters-title" className={rs.cardTitle}>
              {t("marketing.vendors.filters")}
            </h2>
            <VendorFiltersForm locale={locale} filters={filters} action={action} />
          </section>
          <SectionHead id="results-title" size="20" title={<span aria-live="polite">{t("store.vendors.results", { count: list.length })}</span>}>
            {list.length ? (
              <Grid as="ul" cols={3} colsMd={2} colsSm={1} className={dt.cards}>
                {list.map((v, i) => (
                  <VendorShowcaseCard key={v.id} locale={locale} vendor={v} index={i} />
                ))}
              </Grid>
            ) : (
              <div className={`${dt.tile} ${rs.heroCenter} ${dt.empty}`}>
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
                <p className={rs.muted}>{t("store.vendors.emptyBody")}</p>
                <Pill href={action} variant="outline-dark" size="lg">
                  {t("store.vendors.clear")}
                </Pill>
              </div>
            )}
          </SectionHead>
        </Stack>
      </Sheet>

      <Sheet tone="green" y="lg" aria-labelledby="join-title">
        <SectionHead id="join-title" title={t("marketing.vendors.joinTitle")} sub={t("marketing.vendors.joinBody")}>
          <Pill href={`/${locale}/vendor/apply`} size="lg">
            {t("marketing.vendors.join")}
          </Pill>
        </SectionHead>
      </Sheet>
    </div>
  );
}
