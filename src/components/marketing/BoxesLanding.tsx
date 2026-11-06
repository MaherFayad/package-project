import Link from "next/link";
import type { ReactNode } from "react";
import type { Locale, StructureFamily } from "@/types";
import { getT } from "@/i18n";
import type { DictKey } from "@/i18n";
import { designHref } from "@/components/store/catalog";
import { getLowestUnit, listStructures } from "@/components/store/data";
import { HeroImage } from "./HeroImage";
import { ProductCard } from "./ProductCard";
import { renderDims, renderSrc, srcSetFor } from "./assets";
import rs from "./restyle/restyle.module.css";
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
  // The 0427 render in the hero showcase is the phone LCP. HeroImage preloads its AVIF from <head>
  // (R4-MK-06); a second webp preload here made the render download twice (PERF-R4-06 merge).
  const structures = await listStructures();
  const prices = new Map(await Promise.all(structures.map(async (s) => [s.code, await getLowestUnit(s.code, s.defaultDims)] as const)));
  const base = `/${locale}`;
  return (
    <div className={rs.page}>
      <section className={`${rs.dark} ${rs.catHero}`} aria-labelledby="boxes-title">
        <div className={rs.container}>
          <p className={`${rs.eyebrow} m-enter`}>{t("marketing.boxes.eyebrow")}</p>
          <H id="boxes-title" className={`${rs.h1xl} m-enter-lcp`} style={{ ["--m-i" as string]: 1 }}>
            {t("marketing.boxes.title")}
          </H>
          <p className={`${rs.lead} m-enter-lcp`} style={{ ["--m-i" as string]: 2 }}>
            {t("marketing.boxes.body")}
          </p>
          <div className={`${rs.actions} ${rs.actionsCenter} m-enter`} style={{ ["--m-i" as string]: 3 }}>
            <Link href={designHref(locale, { structure: "FEFCO_0427" })} className={rs.pill}>
              {t("marketing.boxes.primary")}
            </Link>
            <Link href={`${base}/vendors`} className={`${rs.pill} ${rs.pillOutline}`}>
              {t("marketing.boxes.secondary")}
            </Link>
          </div>
          <p
            className={`${rs.small} m-enter`}
            style={{
              ["--m-i" as string]: 4,
              marginBlockStart: 20,
              color: "var(--rs-on-dark-2)",
            }}
          >
            {t("marketing.boxes.already")}{" "}
            <Link href={`${base}/account`} className={rs.textLink}>
              {t("marketing.boxes.alreadyLink")}
            </Link>
          </p>
          <div className={`${rs.showcase} m-enter-lcp`} style={{ ["--m-i" as string]: 4 }} aria-hidden="true">
            {SHOWCASE.map((c) => (
              <div key={c} className={rs.showcaseItem}>
                {c === "FEFCO_0427" ? (
                  <HeroImage src={renderSrc(c)} sizes="(min-width: 1024px) 260px, 34vw" alt="" {...renderDims(renderSrc(c))} />
                ) : (
                  // Side renders: low priority and no preload, so only the LCP render competes with the CSS (R4-MK-06).
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={renderSrc(c)}
                    srcSet={srcSetFor(renderSrc(c))}
                    sizes="(min-width: 1024px) 260px, 34vw"
                    alt=""
                    {...renderDims(renderSrc(c))}
                    fetchPriority="low"
                    decoding="async"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={rs.sheet} aria-label={t("marketing.boxes.eyebrow")}>
        <div className={rs.container}>
          {FAMILIES.map((family) => {
            const list = structures.filter((s) => s.family === family);
            if (!list.length) return null;
            return (
              <section key={family} id={family} className={rs.section} aria-labelledby={`fam-${family}`} style={{ scrollMarginBlockStart: 96 }}>
                <div className={rs.head} data-reveal="" suppressHydrationWarning>
                  <div>
                    <h2 id={`fam-${family}`} className={rs.h2}>
                      {t(`marketing.boxes.family.${family}` as DictKey)}
                    </h2>
                    <p className={rs.lead}>{t(`marketing.boxes.familyBody.${family}` as DictKey)}</p>
                  </div>
                  <span className={rs.small}>{t("marketing.boxes.count", { count: list.length })}</span>
                </div>
                <ul className={`${rs.cards} ${rs.rail}`} data-rail="">
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
          <section className={`${rs.band} ${rs.bandGrey}`} aria-labelledby="all-models-title">
            <div className={rs.container}>
              <div className={rs.head} style={{ marginBlockEnd: 0 }} data-reveal="" suppressHydrationWarning>
                <div>
                  <h2 id="all-models-title" className={rs.h2}>
                    {t("library.catalog.heading")}
                  </h2>
                  <p className={rs.lead}>
                    {t("library.catalog.subtitle", {
                      count: formatNumber(MODELS.length),
                    })}
                  </p>
                </div>
                <Link href={`${base}/catalog#all-models`} className={`${rs.pill} ${rs.pillOutline}`}>
                  {t("marketing.boxes.libraryCta", {
                    count: formatNumber(MODELS.length),
                  })}
                </Link>
              </div>
            </div>
          </section>
          <section className={`${rs.dark} ${rs.glow} ${rs.cta}`} aria-labelledby="boxes-cta-title">
            <div className={rs.container} data-reveal="" suppressHydrationWarning>
              <h2 id="boxes-cta-title" className={rs.h2}>
                {t("marketing.boxes.closingTitle")}
              </h2>
              <p className={rs.lead}>{t("marketing.boxes.closingBody")}</p>
              <div className={`${rs.actions} ${rs.actionsCenter}`}>
                <Link href={designHref(locale, { structure: "FEFCO_0427" })} className={rs.pill}>
                  {t("marketing.boxes.primary")}
                </Link>
                <Link href={`${base}/vendors`} className={`${rs.pill} ${rs.pillOutline}`}>
                  {t("marketing.boxes.secondary")}
                </Link>
              </div>
            </div>
          </section>
        </>
      ) : (
        <section className={rs.band} id="all-models" aria-labelledby="all-models-title" style={{ scrollMarginBlockStart: 96 }}>
          <div className={rs.container}>
            <div className={rs.head}>
              <div>
                <h2 id="all-models-title" className={rs.h2}>
                  {t("library.catalog.heading")}
                </h2>
                <p className={rs.lead}>
                  {t("library.catalog.subtitle", {
                    count: formatNumber(MODELS.length),
                  })}
                </p>
              </div>
            </div>
            {library}
          </div>
        </section>
      )}
    </div>
  );
}
