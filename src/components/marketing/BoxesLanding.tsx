import Link from "next/link";
import type { ReactNode } from "react";
import { preload } from "react-dom";
import type { Locale, StructureFamily } from "@/types";
import { getT } from "@/i18n";
import type { DictKey } from "@/i18n";
import { designHref } from "@/components/store/catalog";
import { getLowestUnit, listStructures } from "@/components/store/data";
import { HeroImage } from "./HeroImage";
import { ProductCard } from "./ProductCard";
import { renderDims, renderSrc, srcSetFor } from "./assets";
import styles from "./marketing.module.css";
import { MODELS } from "@/lib/library";
import { formatNumber } from "@/lib/format";

const FAMILIES: StructureFamily[] = ["CORRUGATED", "FOLDING_CARTON", "RIGID", "TUBE"];
const SHOWCASE = ["ECMA_RTE", "PIZZA", "FEFCO_0427", "GABLE_BOX", "RIGID_BOX"] as const;

/**
 * Category landing for boxes and cartons (/boxes and /catalog): centred hero with a row of
 * real 3D renders, then every structure grouped by family with its "from" price.
 */
export async function BoxesLanding({
  locale,
  titleAs = "h1",
  library,
}: {
  locale: Locale;
  titleAs?: "h1";
  /**
   * The whole model library, rendered inline (/catalog passes `<ModelLinks />`). Omitted: a link
   * band + closing CTA (/boxes). A slot, not an import: importing ModelLinks here put the model
   * picker's client chunk and 15 Polaris stylesheets in front of first paint on /boxes, which
   * never shows the library (R2-MK-02).
   */
  library?: ReactNode;
}) {
  const t = getT(locale);
  const H = titleAs;
  // The 0427 render in the hero showcase is the phone LCP: start it from <head> (PERF-R4-06).
  // Found by the parser only, it sometimes queued behind the card renders on Slow 4G (LCP 4.4-4.9 s).
  const lcpRender = renderSrc("FEFCO_0427");
  preload(lcpRender, { as: "image", imageSrcSet: srcSetFor(lcpRender), imageSizes: "(min-width: 1024px) 260px, 34vw", fetchPriority: "high" });
  const structures = await listStructures();
  const prices = new Map(await Promise.all(structures.map(async (s) => [s.code, await getLowestUnit(s.code, s.defaultDims)] as const)));
  const base = `/${locale}`;
  return (
    <>
      <section className={`${styles.centerHero} ${styles.bandMint}`} aria-labelledby="boxes-title">
        <div className={styles.container}>
          <span className={`${styles.eyebrow} m-enter`}>{t("marketing.boxes.eyebrow")}</span>
          <H id="boxes-title" className={`${styles.h1} m-enter-lcp`} style={{ ["--m-i" as string]: 1 }}>
            {t("marketing.boxes.title")}
          </H>
          <p className={`${styles.lead} m-enter-lcp`} style={{ ["--m-i" as string]: 2 }}>
            {t("marketing.boxes.body")}
          </p>
          <div className={`${styles.actions} m-enter`} style={{ ["--m-i" as string]: 3 }}>
            <Link href={designHref(locale, { structure: "FEFCO_0427" })} className={`${styles.pill} ${styles.pillLarge}`}>
              {t("marketing.boxes.primary")}
            </Link>
            <Link href={`${base}/vendors`} className={`${styles.pill} ${styles.pillOutline} ${styles.pillLarge}`}>
              {t("marketing.boxes.secondary")}
            </Link>
          </div>
          <p className={`${styles.already} m-enter`} style={{ ["--m-i" as string]: 4 }}>
            {t("marketing.boxes.already")}{" "}
            <Link href={`${base}/account`} className={styles.textLink}>
              {t("marketing.boxes.alreadyLink")}
            </Link>
          </p>
          <div className={`${styles.heroShowcase} m-enter-lcp`} style={{ ["--m-i" as string]: 4 }} aria-hidden="true">
            {SHOWCASE.map((c) => (
              <div key={c} className={styles.showcaseItem}>
                {c === "FEFCO_0427" ? (
                  <HeroImage src={renderSrc(c)} sizes="(min-width: 1024px) 260px, 34vw" alt="" {...renderDims(renderSrc(c))} />
                ) : (
                  // Side renders: low priority and no preload, so only the LCP render competes with the CSS (R4-MK-06).
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={renderSrc(c)} srcSet={srcSetFor(renderSrc(c))} sizes="(min-width: 1024px) 260px, 34vw" alt="" {...renderDims(renderSrc(c))} fetchPriority="low" decoding="async" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.band} aria-label={t("marketing.boxes.eyebrow")}>
        <div className={styles.container}>
          {FAMILIES.map((family) => {
            const list = structures.filter((s) => s.family === family);
            if (!list.length) return null;
            return (
              <section key={family} id={family} className={styles.familyBlock} aria-labelledby={`fam-${family}`} style={{ scrollMarginBlockStart: 96 }}>
                <div className={styles.sectionHeadRow} data-reveal="" suppressHydrationWarning>
                  <div>
                    <h2 id={`fam-${family}`} className={styles.h2}>
                      {t(`marketing.boxes.family.${family}` as DictKey)}
                    </h2>
                    <p className={styles.lead}>{t(`marketing.boxes.familyBody.${family}` as DictKey)}</p>
                  </div>
                  <span className={styles.small}>{t("marketing.boxes.count", { count: list.length })}</span>
                </div>
                <ul className={`${styles.productGrid} ${styles.productRail}`} data-rail="">
                  {list.map((s, i) => (
                    <ProductCard key={s.code} locale={locale} structure={s} fromPiasters={prices.get(s.code) ?? null} index={i} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </section>

      {!library ? (
        <>
          <section className={`${styles.band} ${styles.bandGrey}`} aria-labelledby="all-models-title">
            <div className={styles.container}>
              <div className={`${styles.sectionHeadRow} ${styles.flushHead}`} data-reveal="" suppressHydrationWarning>
                <div>
                  <h2 id="all-models-title" className={styles.h2}>
                    {t("library.catalog.heading")}
                  </h2>
                  <p className={styles.lead}>{t("library.catalog.subtitle", { count: formatNumber(MODELS.length) })}</p>
                </div>
                <Link href={`${base}/catalog#all-models`} className={`${styles.pill} ${styles.pillOutline} ${styles.pillLarge}`}>
                  {t("marketing.boxes.libraryCta", { count: formatNumber(MODELS.length) })}
                </Link>
              </div>
            </div>
          </section>
          <section className={`${styles.band} ${styles.dark} ${styles.ctaBand} ${styles.ctaBandCompact}`} aria-labelledby="boxes-cta-title">
            <div className={styles.ctaGridLines} aria-hidden="true" />
            <div className={styles.ctaGlow} aria-hidden="true" />
            <div className={styles.container}>
              <div className={styles.ctaInner} data-reveal="" suppressHydrationWarning>
                <h2 id="boxes-cta-title" className={`${styles.h2} ${styles.ctaTitle}`}>
                  {t("marketing.boxes.closingTitle")}
                </h2>
                <p className={styles.lead}>{t("marketing.boxes.closingBody")}</p>
                <div className={`${styles.actions} ${styles.center}`}>
                  <Link href={designHref(locale, { structure: "FEFCO_0427" })} className={`${styles.pill} ${styles.pillLime} ${styles.pillLarge}`}>
                    {t("marketing.boxes.primary")}
                  </Link>
                  <Link href={`${base}/vendors`} className={`${styles.pill} ${styles.pillGhostDark} ${styles.pillLarge}`}>
                    {t("marketing.boxes.secondary")}
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </>
      ) : (
        /* Added by 3D integration: the whole model library (every FEFCO / ECMA style, rigid box,
           tube, bottle, jar, can and pouch), each with a thumbnail drawn from its 3D model. */
        <section className={styles.band} id="all-models" aria-labelledby="all-models-title" style={{ scrollMarginBlockStart: 96 }}>
          <div className={styles.container}>
            <div className={styles.sectionHeadRow}>
              <div>
                <h2 id="all-models-title" className={styles.h2}>
                  {t("library.catalog.heading")}
                </h2>
                <p className={styles.lead}>{t("library.catalog.subtitle", { count: formatNumber(MODELS.length) })}</p>
              </div>
            </div>
            {library}
          </div>
        </section>
      )}
    </>
  );
}
