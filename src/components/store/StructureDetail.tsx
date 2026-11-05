import Link from "next/link";
import { Ruler } from "lucide-react";
import type { Dims, Locale } from "@/types";
import { getT, pick } from "@/i18n";
import type { DictKey } from "@/i18n";
import { formatDims, formatNumber } from "@/lib/format";
import { Badge, Breadcrumbs, Button, Card, Icon, Layout, LayoutSection, Text } from "@/components/ui";
import { designHref, formatCm, sizeHref, sizeSlug, SEO_SIZES, structureHref, structureImage } from "./catalog";
import { materialsFor, type MaterialView, type PriceFrom, type StructureView } from "./data";
import { PriceFromTable } from "./PriceFromTable";
import type { VendorListItem } from "./vendor-filters";
import styles from "./store.module.css";

const RULE_KEYS: Record<string, DictKey> = {
  "H <= W": "store.structure.rule.HW",
  "L == W": "store.structure.rule.LW",
};

/**
 * Body shared by the structure page (/boxes/[structure]) and the SEO size pages
 * (/boxes/[structure]/[size]): title block, specs, sizes, materials, price-from table and
 * the "Design it free" call to action, plus the printers that make this structure.
 */
export function StructureDetail({
  locale,
  structure,
  dims,
  materials,
  price,
  vendors,
  title,
  intro,
  currentSize,
}: {
  locale: Locale;
  structure: StructureView;
  dims: Dims;
  materials: MaterialView[];
  price: PriceFrom;
  vendors: VendorListItem[];
  title: string;
  intro: string;
  /** Set on SEO size pages: highlights the chip and adds a breadcrumb level. */
  currentSize?: Dims;
}) {
  const t = getT(locale);
  const name = pick(locale, structure.name.ar, structure.name.en);
  const p = structure.params;
  const mats = materialsFor(structure.code, materials);
  const sizes = mergeSizes(structure, SEO_SIZES[structure.code] ?? [], locale);
  const makers = vendors.filter((v) => v.capabilities.structures.includes(structure.code));
  const crumbs = [
    { content: t("nav.home"), url: `/${locale}` },
    { content: t("nav.catalog"), url: `/${locale}/catalog` },
    { content: name, url: currentSize ? structureHref(locale, structure.code) : undefined },
    ...(currentSize ? [{ content: `${formatCm(currentSize)} ${locale === "ar" ? "سم" : "cm"}` }] : []),
  ];
  const cta = designHref(locale, { structure: structure.code, dims, material: price.material });

  return (
    <div className={styles.page}>
      <div className={styles.stack}>
        <div className={styles.headerBlock}>
          <Breadcrumbs items={crumbs} />
          <h1 className={styles.pageTitle}>{title}</h1>
          <p className={styles.lead}>{intro}</p>
          <div className={styles.badges}>
            <Badge tone={structure.family === "CORRUGATED" ? "neutral" : "info"}>{t(`store.catalog.family.${structure.family}` as DictKey)}</Badge>
            <Badge>{structure.code.replace("_", " ")}</Badge>
            <Badge tone="success">{t("store.structure.minimumValue")}</Badge>
          </div>
        </div>

        <Layout>
          <LayoutSection>
            <div className={styles.stack}>
              <Card>
                <div className={styles.productMedia}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={structureImage(structure.code)} alt={name} width={640} height={480} />
                </div>
              </Card>

              <PriceFromTable locale={locale} dims={dims} price={price} />

              <Card title={t("store.structure.specsTitle")} as="section">
                <dl className={styles.specs}>
                  <div className={styles.specRow}>
                    <dt>{t("store.structure.family")}</dt>
                    <dd>{t(`store.catalog.family.${structure.family}` as DictKey)}</dd>
                  </div>
                  <div className={styles.specRow}>
                    <dt>{t("store.structure.defaultSize")}</dt>
                    <dd>{formatDims(structure.defaultDims, locale)}</dd>
                  </div>
                  {(["L", "W", "H"] as const).map((k) => (
                    <div key={k} className={styles.specRow}>
                      <dt>
                        {t(`store.structure.dimension.${k}` as DictKey)} ({t("common.mm")})
                      </dt>
                      <dd>
                        <bdi>{t("store.structure.rangeValue", { min: formatNumber(p[k].min), max: formatNumber(p[k].max) })}</bdi>
                      </dd>
                    </div>
                  ))}
                  {p.rules?.length ? (
                    <div className={styles.specRow}>
                      <dt>{t("store.structure.rules")}</dt>
                      <dd>{p.rules.map((r) => (RULE_KEYS[r] ? t(RULE_KEYS[r]) : r)).join(" ")}</dd>
                    </div>
                  ) : null}
                  <div className={styles.specRow}>
                    <dt>{t("store.structure.printing")}</dt>
                    <dd>{t("store.structure.printingValue")}</dd>
                  </div>
                  <div className={styles.specRow}>
                    <dt>{t("store.structure.finishes")}</dt>
                    <dd>{(["MATTE_LAMINATION", "GLOSS_LAMINATION", "SPOT_UV"] as const).map((f) => t(`finishes.${f}` as DictKey)).join(locale === "ar" ? "، " : ", ")}</dd>
                  </div>
                  <div className={styles.specRow}>
                    <dt>{t("store.structure.minimum")}</dt>
                    <dd>{t("store.structure.minimumValue")}</dd>
                  </div>
                </dl>
              </Card>

              <Card title={t("store.structure.sizesTitle")} as="section">
                <div className={styles.prose}>
                  <Text as="p" tone="subdued">
                    {t("store.structure.sizesBody")}
                  </Text>
                  <ul className={styles.chips}>
                    {sizes.map((s) => {
                      const current = currentSize && sizeSlug(currentSize) === sizeSlug(s.dims);
                      return (
                        <li key={sizeSlug(s.dims)}>
                          <Link href={sizeHref(locale, structure.code, s.dims)} className={styles.chip} aria-current={current ? "page" : undefined}>
                            <Icon source={Ruler} size="small" />
                            <span>
                              {s.label ? `${s.label} · ` : ""}
                              {formatDims(s.dims, locale)}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                  <Text as="h3" variant="headingSm">
                    {t("store.structure.customTitle")}
                  </Text>
                  <Text as="p" tone="subdued">
                    {t("store.structure.customBody")}
                  </Text>
                </div>
              </Card>

              <Card title={t("store.structure.materialsTitle")} as="section">
                <dl className={styles.specs}>
                  {mats.map((m) => (
                    <div key={m.code} className={styles.specRow}>
                      <dt>{t(`materials.${m.code}` as DictKey)}</dt>
                      <dd>
                        <span>{t("store.structure.materialSpec", { gsm: m.gsm, mm: m.thicknessMm })}</span>{" "}
                        {m.foodSafe ? <Badge tone="info">{t("store.structure.foodSafe")}</Badge> : null}
                      </dd>
                    </div>
                  ))}
                </dl>
              </Card>
            </div>
          </LayoutSection>

          <LayoutSection variant="oneThird" as="aside" aria-label={t("store.structure.designCta")}>
            <div className={`${styles.stack} ${styles.sticky}`}>
              <Card>
                <div className={styles.ctaCard}>
                  <Text as="h2" variant="headingMd">
                    {name}
                  </Text>
                  <Text as="p" numeric>
                    {formatDims(dims, locale)}
                  </Text>
                  <Button url={cta} variant="primary" size="large" fullWidth>
                    {t("store.structure.designCta")}
                  </Button>
                  <Text as="p" variant="bodySm" tone="subdued">
                    {t("store.structure.designHint")}
                  </Text>
                </div>
              </Card>
              {makers.length ? (
                <Card title={t("store.structure.vendorsTitle")} as="section">
                  <div className={styles.prose}>
                    <Text as="p" tone="subdued">
                      {t("store.structure.vendorsCount", { count: makers.length })}
                    </Text>
                    <ul className={styles.plainList}>
                      {makers.slice(0, 5).map((v) => (
                        <li key={v.id} className={styles.designRow}>
                          <div className={styles.designMain}>
                            <Link href={`/${locale}/vendors/${v.slug}`}>{pick(locale, v.name.ar, v.name.en)}</Link>
                            <Text as="span" variant="bodySm" tone="subdued">
                              {t(`cities.${v.city}` as DictKey)} · {t("store.vendors.leadValue", { days: v.leadTimeDays })}
                            </Text>
                          </div>
                        </li>
                      ))}
                    </ul>
                    <Button url={`/${locale}/vendors?structure=${structure.code}`} variant="plain">
                      {t("store.home.vendorsAll")}
                    </Button>
                  </div>
                </Card>
              ) : null}
            </div>
          </LayoutSection>
        </Layout>
      </div>
    </div>
  );
}

/** Catalogue presets (named) first, then the remaining SEO sizes, de-duplicated. */
function mergeSizes(structure: StructureView, seo: Dims[], locale: Locale): { dims: Dims; label?: string }[] {
  const out: { dims: Dims; label?: string }[] = [];
  const seen = new Set<string>();
  for (const pr of structure.presets) {
    const k = sizeSlug(pr.dims);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ dims: pr.dims, label: pick(locale, pr.name.ar, pr.name.en) });
  }
  for (const d of seo) {
    const k = sizeSlug(d);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ dims: d });
  }
  return out;
}
