import Link from "next/link";
import type { ReactNode } from "react";
import type { Locale, StructureFamily } from "@/types";
import { getT } from "@/i18n";
import type { DictKey } from "@/i18n";
import { getLowestUnit, listStructures } from "@/components/store/data";
import { HeroImage } from "./HeroImage";
import { ProductCard } from "./ProductCard";
import { renderDims, renderSrc, srcSetFor } from "./assets";
import rs from "./restyle/restyle.module.css";
import dt from "./restyle/detail.module.css";
import { Sheet } from "./kit/Sheet";
import { SAMPLE_LABEL } from "./kit/assets";
import { Glow } from "./kit/Glow";
import { Display, Eyebrow, Lead } from "./kit/Display";
import { HeroTitle } from "./kit/HeroTitle";
import { Pill, PillRow } from "./kit/Pill";
import { Reveal } from "./kit/Reveal";
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
  // The 0427 render in the hero showcase is the phone LCP. HeroImage preloads its AVIF from <head>
  // (R4-MK-06); a second webp preload here made the render download twice (PERF-R4-06 merge).
  const structures = await listStructures();
  const prices = new Map(await Promise.all(structures.map(async (s) => [s.code, await getLowestUnit(s.code, s.defaultDims)] as const)));
  const base = `/${locale}`;
  return (
    <div className={rs.page}>
      <Sheet tone="dark" hero className={rs.heroLanding} aria-labelledby="boxes-title">
        <Eyebrow className="m-enter">{t("marketing.boxes.eyebrow")}</Eyebrow>
        <HeroTitle as={titleAs} size="96" align="center" id="boxes-title" text={t("marketing.boxes.title")} />
        <Lead align="center" className="m-enter-lcp">
          {t("marketing.boxes.body")}
        </Lead>
        <PillRow align="center" className="m-enter">
          <Pill href={`${base}/start`} size="lg">
            {t("marketing.boxes.primary")}
          </Pill>
          <Pill href={`${base}/vendors`} variant="outline" size="lg">
            {t("marketing.boxes.secondary")}
          </Pill>
        </PillRow>
        <p className={`${rs.small} m-enter`} style={{ marginBlockStart: 20 }}>
          {t("marketing.boxes.already")}{" "}
          <Link href={`${base}/account`} className={rs.textLink}>
            {t("marketing.boxes.alreadyLink")}
          </Link>
        </p>
        <div className={`${dt.showcase} m-enter-lcp`} aria-hidden="true">
          {SHOWCASE.map((c) => (
            <div key={c} className={dt.showcaseItem}>
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
        <p className={`${rs.small} ${rs.sampleNote} ${rs.heroLandingNote}`}>{SAMPLE_LABEL[locale]}</p>
      </Sheet>

      <Sheet tone="white" className={rs.sheetTop} aria-label={t("marketing.boxes.eyebrow")}>
        {FAMILIES.map((family) => {
          const list = structures.filter((s) => s.family === family);
          if (!list.length) return null;
          return (
            <section key={family} id={family} className={rs.section} aria-labelledby={`fam-${family}`} style={{ scrollMarginBlockStart: 96 }}>
              <Reveal className={rs.head}>
                <div>
                  <Display size="56" id={`fam-${family}`}>
                    {t(`marketing.boxes.family.${family}` as DictKey)}
                  </Display>
                  <Lead>{t(`marketing.boxes.familyBody.${family}` as DictKey)}</Lead>
                </div>
                <span className={rs.small}>{t("marketing.boxes.count", { count: list.length })}</span>
              </Reveal>
              <ul className={`${dt.cards} ${dt.rail}`} data-rail="">
                {list.map((s, i) => (
                  <ProductCard key={s.code} locale={locale} structure={s} fromPiasters={prices.get(s.code) ?? null} index={i} />
                ))}
              </ul>
            </section>
          );
        })}
      </Sheet>

      {!library ? (
        <>
          <Sheet tone="light" aria-labelledby="all-models-title">
            <Reveal className={rs.head} style={{ marginBlockEnd: 0 }}>
              <div>
                <Display size="56" id="all-models-title">
                  {t("library.catalog.heading")}
                </Display>
                <Lead>{t("library.catalog.subtitle", { count: formatNumber(MODELS.length) })}</Lead>
              </div>
              <Pill href={`${base}/catalog#all-models`} variant="outline-dark" size="lg">
                {t("marketing.boxes.libraryCta", { count: formatNumber(MODELS.length) })}
              </Pill>
            </Reveal>
          </Sheet>
          <Sheet tone="dark" className={rs.clip} container="narrow" aria-labelledby="boxes-cta-title">
            <Glow color="violet" x="85%" y="0%" size="70vmax" />
            <Glow color="green" x="5%" y="110%" size="45vmax" />
            <Reveal className={rs.heroCenter}>
              <Display size="64" align="center" id="boxes-cta-title">
                {t("marketing.boxes.closingTitle")}
              </Display>
              <Lead align="center">{t("marketing.boxes.closingBody")}</Lead>
              <PillRow align="center">
                <Pill href={`${base}/start`} size="lg">
                  {t("marketing.boxes.primary")}
                </Pill>
                <Pill href={`${base}/vendors`} variant="outline" size="lg">
                  {t("marketing.boxes.secondary")}
                </Pill>
              </PillRow>
            </Reveal>
          </Sheet>
        </>
      ) : (
        <Sheet tone="white" id="all-models" aria-labelledby="all-models-title" style={{ scrollMarginBlockStart: 96 }}>
          <div className={rs.head}>
            <div>
              <Display size="56" id="all-models-title">
                {t("library.catalog.heading")}
              </Display>
              <Lead>{t("library.catalog.subtitle", { count: formatNumber(MODELS.length) })}</Lead>
            </div>
          </div>
          {library}
        </Sheet>
      )}
    </div>
  );
}
