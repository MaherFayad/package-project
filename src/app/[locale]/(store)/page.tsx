import type { Metadata } from "next";
import { BadgeCheck, Boxes, CreditCard, PackageOpen, Truck } from "lucide-react";
import { getT, toLocale } from "@/i18n";
import type { DictKey } from "@/i18n";
import { siteUrl } from "@/lib/env";
import { Banner, Button, Icon } from "@/components/ui";
import { HeroBox } from "@/components/store/HeroBox";
import { StructureCard } from "@/components/store/StructureCard";
import { VendorCard } from "@/components/store/VendorCard";
import { Faq } from "@/components/store/Faq";
import { JsonLd } from "@/components/store/JsonLd";
import { faqJsonLd } from "@/components/store/jsonld";
import { designHref, structureImage } from "@/components/store/catalog";
import { getLowestUnit, listStructures, listVendors } from "@/components/store/data";
import { filterVendors } from "@/components/store/vendor-filters";
import styles from "@/components/store/store.module.css";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  return {
    title: { absolute: `${t("meta.siteName")} · ${t("meta.tagline")}` },
    description: t("meta.description"),
    alternates: { canonical: `/${locale}`, languages: { ar: "/ar", en: "/en" } },
    openGraph: { title: t("meta.tagline"), description: t("meta.description"), url: `${siteUrl()}/${locale}`, siteName: t("meta.siteName"), locale: locale === "ar" ? "ar_EG" : "en_EG", type: "website" },
  };
}

const VALUES = [
  { key: "design", icon: PackageOpen },
  { key: "minimums", icon: Boxes },
  { key: "vendors", icon: BadgeCheck },
  { key: "pay", icon: CreditCard },
  { key: "delivery", icon: Truck },
] as const;

export default async function HomePage({ params, searchParams }: Props) {
  const locale = toLocale((await params).locale);
  const sp = await searchParams;
  const t = getT(locale);
  const [structures, vendors] = await Promise.all([listStructures(), listVendors()]);
  const prices = await Promise.all(structures.map((s) => getLowestUnit(s.code, s.defaultDims)));
  const featured = filterVendors(vendors, { sort: "recommended" }).slice(0, 3);
  const faq = [1, 2, 3, 4, 5, 6].map((n) => ({
    q: t(`store.home.faq.q${n}` as DictKey),
    a: t(`store.home.faq.a${n}` as DictKey),
  }));

  return (
    <div className={styles.page}>
      <JsonLd data={faqJsonLd(faq)} />
      <div className={styles.stack}>
        {sp.denied ? (
          <Banner tone="warning">{t("store.deniedBanner")}</Banner>
        ) : null}

        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>
              <span className={styles.eyebrowDot} aria-hidden="true" />
              {t("store.home.eyebrow")}
            </span>
            <h1 id="hero-title" className={styles.heroTitle}>
              {t("home.heroTitle")}
            </h1>
            <p className={styles.heroBody}>{t("home.heroBody")}</p>
            <div className={styles.productActions}>
              <Button url={designHref(locale, { structure: "FEFCO_0427" })} variant="primary" size="large">
                {t("home.ctaDesign")}
              </Button>
              <Button url={`/${locale}/catalog`} size="large">
                {t("home.ctaCatalog")}
              </Button>
            </div>
            <p className={styles.heroNote}>{t("store.home.heroNote")}</p>
          </div>
          <HeroBox
            locale={locale}
            poster={structureImage("FEFCO_0427")}
            labels={{
              viewer: t("store.home.viewerLabel"),
              roleDescription: t("viewer.roleDescription"),
              keyboardHint: t("viewer.keyboardHint"),
              pause: t("store.home.pause"),
              play: t("store.home.play"),
              unsupported: t("viewer.unsupported"),
            }}
          />
        </section>

        <section className={styles.section} aria-labelledby="values-title">
          <h2 id="values-title" className={styles.sectionTitle}>
            {t("store.home.valueTitle")}
          </h2>
          <ul className={`${styles.grid} ${styles.plainList}`}>
            {VALUES.map(({ key, icon }) => (
              <li key={key} className={styles.valueCard}>
                <span className={styles.valueIcon}>
                  <Icon source={icon} />
                </span>
                <h3 className={styles.cardTitle}>{t(`store.home.value.${key}Title` as DictKey)}</h3>
                <p className={styles.muted}>{t(`store.home.value.${key}Body` as DictKey)}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.section} aria-labelledby="how-title">
          <h2 id="how-title" className={styles.sectionTitle}>
            {t("store.home.howTitle")}
          </h2>
          <ol className={`${styles.steps} ${styles.grid}`}>
            {[1, 2, 3, 4].map((n) => (
              <li key={n} className={`${styles.valueCard} ${styles.step}`}>
                <span className={styles.stepNum} aria-hidden="true">
                  {n}
                </span>
                <div>
                  <h3 className={styles.cardTitle}>
                    <span className="visually-hidden">{t("store.home.stepLabel", { n })}: </span>
                    {t(`store.home.how.s${n}Title` as DictKey)}
                  </h3>
                  <p className={styles.muted}>{t(`store.home.how.s${n}Body` as DictKey)}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.section} aria-labelledby="catalog-title">
          <div className={styles.sectionHead}>
            <div className={styles.headerBlock}>
              <h2 id="catalog-title" className={styles.sectionTitle}>
                {t("store.home.catalogTitle")}
              </h2>
              <p className={styles.sectionBody}>{t("store.home.catalogBody")}</p>
            </div>
            <Button url={`/${locale}/catalog`} variant="plain">
              {t("store.home.catalogAll")}
            </Button>
          </div>
          <div className={styles.grid}>
            {structures.map((s, i) => (
              <StructureCard key={s.code} locale={locale} structure={s} fromPiasters={prices[i]} />
            ))}
          </div>
        </section>

        {featured.length ? (
          <section className={styles.section} aria-labelledby="vendors-title">
            <div className={styles.sectionHead}>
              <div className={styles.headerBlock}>
                <h2 id="vendors-title" className={styles.sectionTitle}>
                  {t("store.home.vendorsTitle")}
                </h2>
                <p className={styles.sectionBody}>{t("store.home.vendorsBody")}</p>
              </div>
              <Button url={`/${locale}/vendors`} variant="plain">
                {t("store.home.vendorsAll")}
              </Button>
            </div>
            <div className={`${styles.grid} ${styles.gridWide}`}>
              {featured.map((v) => (
                <VendorCard key={v.id} locale={locale} vendor={v} />
              ))}
            </div>
          </section>
        ) : null}

        <section className={styles.section} aria-labelledby="faq-title">
          <h2 id="faq-title" className={styles.sectionTitle}>
            {t("store.home.faqTitle")}
          </h2>
          <Faq items={faq} />
        </section>

        <section className={styles.band} aria-labelledby="cta-title">
          <div>
            <h2 id="cta-title">{t("store.home.ctaTitle")}</h2>
            <p>{t("store.home.ctaBody")}</p>
          </div>
          <Button url={designHref(locale, { structure: "FEFCO_0427" })} size="large">
            {t("home.ctaDesign")}
          </Button>
        </section>
      </div>
    </div>
  );
}
