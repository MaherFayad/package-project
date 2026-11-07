import type { Metadata } from "next";
import Link from "next/link";
import { getT, toLocale } from "@/i18n";
import type { DictKey } from "@/i18n";
import { designHref } from "@/components/store/catalog";
import { getReferenceUnit, listStructures } from "@/components/store/data";
import { formatMoney } from "@/lib/format";
import { VESSEL_RENDERS, renderDims, srcSetFor, vesselSrc } from "@/components/marketing/assets";
import { HeroImage } from "@/components/marketing/HeroImage";
import rs from "@/components/marketing/restyle/restyle.module.css";
import dt from "@/components/marketing/restyle/detail.module.css";
import { Sheet } from "@/components/marketing/kit/Sheet";
import { SAMPLE_LABEL } from "@/components/marketing/kit/assets";
import { Eyebrow, Lead } from "@/components/marketing/kit/Display";
import { HeroTitle } from "@/components/marketing/kit/HeroTitle";
import { Pill, PillRow } from "@/components/marketing/kit/Pill";
import { Grid } from "@/components/marketing/kit/Grid";

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
 * The designer model each render opens. Vessels are priced instantly as their label (ROLL_LABEL,
 * order mode "instant") and ordered from the designer like a box (R3-02).
 */
const VESSEL_MODEL: Record<(typeof VESSEL_RENDERS)[number], string> = {
  jar: "wide-jar",
  bottle: "round-bottle",
  dropper: "dropper-bottle",
  pump: "pump-bottle",
  can: "beverage-can-two-piece",
};

/**
 * Products → Bottles and labels. Labels are orderable: each card opens its container in the
 * designer, which prices the label and has the order button. The price line is the same
 * reference price the home card shows (ROLL_LABEL, default size, 500 pieces), so the two agree.
 * The images are renders of the 3D vessel models with sample labels.
 */
export default async function BottlesPage({ params }: Props) {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  const label = (await listStructures()).find((x) => x.code === "ROLL_LABEL");
  const price = label ? await getReferenceUnit("ROLL_LABEL", label.defaultDims).catch(() => null) : null;
  return (
    <div className={rs.page}>
      <Sheet tone="dark" hero className={rs.heroLanding} aria-labelledby="bottles-title">
        <Eyebrow className="m-enter">{t("marketing.bottles.eyebrow")}</Eyebrow>
        <HeroTitle size="64" align="center" id="bottles-title" text={t("marketing.bottles.title")} />
        <Lead align="center" className="m-enter-lcp">
          {t("marketing.bottles.body")}
        </Lead>
        {price != null ? (
          <p className={`${rs.small} ${rs.sampleNote} ${rs.heroLandingNote} m-enter`}>{t("marketing.bottles.price", { price: formatMoney(price, locale, { alwaysDecimals: true }) })}</p>
        ) : null}
        <PillRow align="center" className="m-enter">
          <Pill href="#vessels" size="lg">
            {t("marketing.bottles.primary")}
          </Pill>
          <Pill href={designHref(locale, { structure: "ECMA_RTE" })} variant="outline" size="lg">
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
      <Sheet tone="white" id="vessels" aria-labelledby="vessels-title">
        <h2 id="vessels-title" className="visually-hidden">
          {t("marketing.bottles.eyebrow")}
        </h2>
        <Grid as="ul" cols={5} colsMd={2} colsSm={1} className={dt.cards}>
          {VESSEL_RENDERS.map((v, i) => (
            <li key={v} data-reveal="" suppressHydrationWarning style={{ ["--m-i" as string]: i % 4 }}>
              <article className={dt.card}>
                <div className={dt.cardMedia}>
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
                  <h3 className={rs.cardTitle}>
                    <Link href={`/${locale}/design/${VESSEL_MODEL[v]}`} prefetch={false} className={dt.cardLink}>
                      {t(`marketing.bottles.items.${v}` as DictKey)}
                    </Link>
                  </h3>
                  <p className={rs.small}>{t("marketing.bottles.instant")}</p>
                </div>
              </article>
            </li>
          ))}
        </Grid>
      </Sheet>
    </div>
  );
}
