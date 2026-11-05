import type { Metadata } from "next";
import { getT, toLocale } from "@/i18n";
import type { DictKey } from "@/i18n";
import { Breadcrumbs, Card, EmptyBoxIllustration, EmptyState } from "@/components/ui";
import { StructureCard } from "@/components/store/StructureCard";
import { JsonLd } from "@/components/store/JsonLd";
import { breadcrumbJsonLd } from "@/components/store/jsonld";
import { getLowestUnit, listStructures } from "@/components/store/data";
import { siteUrl } from "@/lib/env";
import type { StructureFamily } from "@/types";
import styles from "@/components/store/store.module.css";

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

const FAMILIES: StructureFamily[] = ["CORRUGATED", "FOLDING_CARTON"];

export default async function CatalogPage({ params }: Props) {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  const structures = await listStructures();
  const prices = new Map(await Promise.all(structures.map(async (s) => [s.code, await getLowestUnit(s.code, s.defaultDims)] as const)));
  const base = siteUrl();

  return (
    <div className={styles.page}>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: t("nav.home"), url: `${base}/${locale}` },
          { name: t("nav.catalog"), url: `${base}/${locale}/catalog` },
        ])}
      />
      <div className={styles.stack}>
        <div className={styles.headerBlock}>
          <Breadcrumbs items={[{ content: t("nav.home"), url: `/${locale}` }, { content: t("nav.catalog") }]} />
          <h1 className={styles.pageTitle}>{t("catalog.title")}</h1>
          <p className={styles.lead}>{t("store.catalog.intro")}</p>
        </div>
        {structures.length === 0 ? (
          <Card>
            <EmptyState heading={t("store.catalog.emptyTitle")} image={<EmptyBoxIllustration />}>
              {t("store.catalog.emptyBody")}
            </EmptyState>
          </Card>
        ) : (
          FAMILIES.map((family) => {
            const list = structures.filter((s) => s.family === family);
            if (!list.length) return null;
            return (
              <section key={family} className={styles.section} aria-labelledby={`fam-${family}`}>
                <h2 id={`fam-${family}`} className={styles.sectionTitle}>
                  {t(`store.catalog.family.${family}` as DictKey)}
                </h2>
                <div className={styles.grid}>
                  {list.map((s) => (
                    <StructureCard key={s.code} locale={locale} structure={s} fromPiasters={prices.get(s.code) ?? null} />
                  ))}
                </div>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
