import Link from "next/link";
import { Badge, Card, Icon, Layout, LayoutSection, Text } from "@/components/marketing/mkui";
import { BadgeCheck, Package, Ruler } from "lucide-react";
import type { Dims, Locale } from "@/types";
import { getT, pick } from "@/i18n";
import type { DictKey } from "@/i18n";
import { formatDims, formatNumber } from "@/lib/format";
import { designHref, formatCm, sizeHref, sizeSlug, SEO_SIZES, structureHref } from "./catalog";
import { materialsFor, type MaterialView, type PriceFrom, type StructureView } from "./data";
import { PriceFromTable } from "./PriceFromTable";
import type { VendorListItem } from "./vendor-filters";
import styles from "./store.module.css";

/** The hero render is about 74% of a phone viewport (was declared 92vw, which picked the full file). */
const HERO_SIZES = "(min-width: 1024px) 600px, 74vw";
import rs from "@/components/marketing/restyle/restyle.module.css";
import dt from "@/components/marketing/restyle/detail.module.css";
import { Sheet } from "@/components/marketing/kit/Sheet";
import { Glow } from "@/components/marketing/kit/Glow";
import { Display, Eyebrow, Lead } from "@/components/marketing/kit/Display";
import { HeroTitle } from "@/components/marketing/kit/HeroTitle";
import { Pill, PillRow } from "@/components/marketing/kit/Pill";
import { renderSrc } from "@/components/marketing/assets";
import { HeroImage } from "@/components/marketing/HeroImage";
import { SAMPLE_LABEL } from "@/components/marketing/kit/assets";

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
    {
      content: name,
      url: currentSize ? structureHref(locale, structure.code) : undefined,
    },
    ...(currentSize
      ? [
          {
            content: `${formatCm(currentSize)} ${locale === "ar" ? "سم" : "cm"}`,
          },
        ]
      : []),
  ];
  const cta = designHref(locale, {
    structure: structure.code,
    dims,
    material: price.material,
  });

  return (
    <div className={rs.page}>
      <Sheet tone="dark" hero className={`${rs.heroCompact} ${rs.clip}`} aria-labelledby="structure-title">
        <Glow color="violet" x="85%" y="0%" size="70vmax" />
        <Glow color="green" x="5%" y="110%" size="45vmax" />
        <div className={rs.split}>
          <div>
            <nav aria-label={t("store.breadcrumb")} className={`${rs.crumbs} m-enter`}>
              <ol>
                {crumbs.map((c, i) => (
                  <li key={i}>{c.url ? <Link href={c.url}>{c.content}</Link> : <span aria-current="page">{c.content}</span>}</li>
                ))}
              </ol>
            </nav>
            <Eyebrow className="m-enter">{t(`marketing.boxes.family.${structure.family}` as DictKey)}</Eyebrow>
            {/* The size-page title holds a bidi-isolated "250 × 180 × 80 mm" (CR-62); HeroTitle splits on
                spaces into inline blocks, which would break the isolate and reorder the numbers in RTL. */}
            {currentSize ? (
              <Display as="h1" size="64" id="structure-title" className="m-enter-lcp">
                {title}
              </Display>
            ) : (
              <HeroTitle size="64" id="structure-title" text={title} />
            )}
            <Lead className="m-enter-lcp">{intro}</Lead>
            <ul className={`${rs.chips} m-enter`} style={{ ["--m-i" as string]: 4 }}>
              {/^FEFCO_/.test(structure.code) ? (
                <li>
                  <Package size={18} aria-hidden />
                  <bdi>{structure.code.replace("_", " ")}</bdi>
                </li>
              ) : null}
              <li>
                <Ruler size={18} aria-hidden />
                <span className={rs.num}>{formatDims(dims, locale)}</span>
              </li>
              <li>
                <BadgeCheck size={18} aria-hidden />
                {t("store.structure.minimumValue")}
              </li>
            </ul>
            <PillRow className="m-enter">
              <Pill href={cta} size="lg">
                {t("store.structure.designCta")}
              </Pill>
              <Pill href="#prices" variant="outline" size="lg">
                {t("mk.nav.pricing")}
              </Pill>
            </PillRow>
          </div>
          <figure className={rs.figure}>
            <div className={`${rs.mediaCard} m-enter-scale`} style={{ ["--m-i" as string]: 2 }}>
              {/* The hero render is the LCP on phones: AVIF, preloaded from <head> (R4-MK-06). */}
              <HeroImage src={renderSrc(structure.code)} sizes={HERO_SIZES} alt={t("marketing.boxes.renderAlt", { name })} width={960} height={720} />
            </div>
            <figcaption className={`${rs.small} ${rs.sampleNote}`}>{SAMPLE_LABEL[locale]}</figcaption>
          </figure>
        </div>
      </Sheet>
      <Sheet tone="white" className={rs.sheetTop}>
        <Layout>
          <LayoutSection>
            <div className={dt.stack}>
              <div id="prices" style={{ scrollMarginBlockStart: 96 }} />
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
                        <bdi>
                          {t("store.structure.rangeValue", {
                            min: formatNumber(p[k].min),
                            max: formatNumber(p[k].max),
                          })}
                        </bdi>
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
                    <dd>
                      {(["MATTE_LAMINATION", "GLOSS_LAMINATION", "SPOT_UV"] as const)
                        .map((f) => t(`finishes.${f}` as DictKey))
                        .join(locale === "ar" ? "، " : ", ")}
                    </dd>
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
                        <span>
                          {t("store.structure.materialSpec", {
                            gsm: m.gsm,
                            mm: m.thicknessMm,
                          })}
                        </span>{" "}
                        {m.foodSafe ? <Badge tone="info">{t("store.structure.foodSafe")}</Badge> : null}
                      </dd>
                    </div>
                  ))}
                </dl>
              </Card>
            </div>
          </LayoutSection>

          <LayoutSection variant="oneThird" as="aside" aria-label={t("store.structure.designCta")}>
            <div className={dt.stack}>
              <Card tone="dark">
                <div className={styles.ctaCard}>
                  <Text as="h2" variant="headingMd">
                    {name}
                  </Text>
                  <Text as="p" numeric>
                    {formatDims(dims, locale)}
                  </Text>
                  <Pill href={cta} size="lg" className={styles.ctaFull}>
                    {t("store.structure.designCta")}
                  </Pill>
                  <Text as="p" variant="bodySm" tone="subdued">
                    {t("store.structure.designHint")}
                  </Text>
                </div>
              </Card>
              {makers.length ? (
                <Card title={t("store.structure.vendorsTitle")} as="section">
                  <div className={styles.prose}>
                    <Text as="p" tone="subdued">
                      {t("store.structure.vendorsCount", {
                        count: makers.length,
                      })}
                    </Text>
                    <ul className={`${styles.plainList} ${styles.makerList}`}>
                      {makers.slice(0, 5).map((v) => (
                        <li key={v.id} className={styles.designRow}>
                          <div className={styles.designMain}>
                            <Link href={`/${locale}/vendors/${v.slug}`}>{pick(locale, v.name.ar, v.name.en)}</Link>
                            <Text as="span" variant="bodySm" tone="subdued">
                              {t(`cities.${v.city}` as DictKey)} ·{" "}
                              {t("store.vendors.leadValue", {
                                days: v.leadTimeDays,
                              })}
                            </Text>
                          </div>
                        </li>
                      ))}
                    </ul>
                    <Link href={`/${locale}/vendors?structure=${structure.code}`} className={styles.textLink}>
                      {t("store.home.vendorsAll")}
                    </Link>
                  </div>
                </Card>
              ) : null}
            </div>
          </LayoutSection>
        </Layout>
      </Sheet>
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
