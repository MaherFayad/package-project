import type { Metadata } from "next";
import { getT, toLocale } from "@/i18n";
import type { DictKey } from "@/i18n";
import { designHref } from "@/components/store/catalog";
import { VESSEL_RENDERS, renderDims, srcSetFor, vesselSrc } from "@/components/marketing/assets";
import { HeroImage } from "@/components/marketing/HeroImage";
import rs from "@/components/marketing/restyle/restyle.module.css";
import dt from "@/components/marketing/restyle/detail.module.css";
import { Sheet } from "@/components/marketing/kit/Sheet";
import { SAMPLE_LABEL } from "@/components/marketing/kit/assets";
import { Eyebrow, Lead } from "@/components/marketing/kit/Display";
import { HeroTitle } from "@/components/marketing/kit/HeroTitle";
import { Pill, PillRow } from "@/components/marketing/kit/Pill";
import { Stagger } from "@/components/marketing/kit/Reveal";

/** Prerendered; prices and printer data refresh hourly (ISR). */
export const revalidate = 3600;

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  return {
    title: t("marketing.bottles.title"),
    description: t("marketing.bottles.body"),
    alternates: {
      canonical: `/${locale}/bottles`,
      languages: { ar: "/ar/bottles", en: "/en/bottles" },
    },
  };
}

/**
 * Products → Bottles and labels. Label printing is not orderable yet, so this page says so
 * plainly ("Coming soon") and points to the carton that goes around the bottle meanwhile.
 * The images are renders of the 3D vessel models with sample labels.
 */
export default async function BottlesPage({ params }: Props) {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  return (
    <div className={rs.page}>
      <Sheet tone="dark" hero className={rs.heroLanding} aria-labelledby="bottles-title">
        <Eyebrow className="m-enter">{t("marketing.bottles.eyebrow")}</Eyebrow>
        <HeroTitle size="96" align="center" id="bottles-title" text={t("marketing.bottles.title")} />
        <Lead align="center" className="m-enter-lcp">
          {t("marketing.bottles.body")}
        </Lead>
        <PillRow align="center" className="m-enter">
          <Pill href={designHref(locale, { structure: "ECMA_RTE" })} size="lg">
            {t("marketing.bottles.primary")}
          </Pill>
          <Pill href={`/${locale}/boxes`} variant="outline" size="lg">
            {t("marketing.bottles.secondary")}
          </Pill>
        </PillRow>
        <div className={`${dt.showcase} m-enter-lcp`} aria-hidden="true">
          {(["dropper", "jar", "bottle", "can", "pump"] as const).map((v) => (
            <div key={v} className={dt.showcaseItem}>
              {v === "bottle" ? (
                <HeroImage src={vesselSrc(v)} sizes="(min-width: 1024px) 200px, 30vw" alt="" {...renderDims(vesselSrc(v))} />
              ) : (
                // Side renders: low priority and no preload (R4-MK-06).
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={vesselSrc(v)}
                  srcSet={srcSetFor(vesselSrc(v))}
                  sizes="(min-width: 1024px) 200px, 30vw"
                  alt=""
                  {...renderDims(vesselSrc(v))}
                  fetchPriority="low"
                  decoding="async"
                />
              )}
            </div>
          ))}
        </div>
        <p className={`${rs.small} ${rs.sampleNote} ${rs.heroLandingNote}`}>{SAMPLE_LABEL[locale]}</p>
      </Sheet>
      <Sheet tone="white" className={rs.sheetTop} aria-labelledby="vessels-title">
        <h2 id="vessels-title" className="visually-hidden">
          {t("marketing.bottles.eyebrow")}
        </h2>
        <Stagger as="ul" className={`${dt.cards} ${dt.five}`}>
          {VESSEL_RENDERS.map((v) => (
            <li key={v}>
              <article className={dt.card}>
                <div className={dt.cardMedia}>
                  <span className={`${dt.tag} ${dt.soon}`}>{t("marketing.bottles.soon")}</span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={vesselSrc(v)}
                    srcSet={srcSetFor(vesselSrc(v))}
                    sizes="(min-width: 1200px) 240px, (min-width: 560px) 46vw, 92vw"
                    alt=""
                    loading="lazy"
                    decoding="async"
                    width={360}
                    height={480}
                  />
                </div>
                <div className={dt.cardBody}>
                  <h3 className={rs.cardTitle}>{t(`marketing.bottles.items.${v}` as DictKey)}</h3>
                </div>
              </article>
            </li>
          ))}
        </Stagger>
      </Sheet>
    </div>
  );
}
