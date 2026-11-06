import type { Metadata } from "next";
import Link from "next/link";
import { getT, toLocale } from "@/i18n";
import type { DictKey } from "@/i18n";
import { designHref } from "@/components/store/catalog";
import { VESSEL_RENDERS, renderDims, srcSetFor, vesselSrc } from "@/components/marketing/assets";
import { HeroImage } from "@/components/marketing/HeroImage";
import styles from "@/components/marketing/marketing.module.css";

/** Prerendered; prices and printer data refresh hourly (ISR). */
export const revalidate = 3600;

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  return {
    title: t("marketing.bottles.title"),
    description: t("marketing.bottles.body"),
    alternates: { canonical: `/${locale}/bottles`, languages: { ar: "/ar/bottles", en: "/en/bottles" } },
  };
}

const TINTS: Record<(typeof VESSEL_RENDERS)[number], string> = { jar: "#f6e7cf", bottle: "#dfe7f1", dropper: "#e8eef4", pump: "#ecece8", can: "#e6efe0" };

/**
 * Products → Bottles and labels. Label printing is not orderable yet, so this page says so
 * plainly ("Coming soon") and points to the carton that goes around the bottle meanwhile.
 * The images are renders of the 3D vessel models with sample labels.
 */
export default async function BottlesPage({ params }: Props) {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  return (
    <>
      <section className={`${styles.centerHero} ${styles.bandMint}`} aria-labelledby="bottles-title">
        <div className={styles.container}>
          <span className={`${styles.eyebrow} m-enter`}>{t("marketing.bottles.eyebrow")}</span>
          <h1 id="bottles-title" className={`${styles.h1} m-enter-lcp`} style={{ ["--m-i" as string]: 1 }}>
            {t("marketing.bottles.title")}
          </h1>
          <p className={`${styles.lead} m-enter-lcp`} style={{ ["--m-i" as string]: 2 }}>
            {t("marketing.bottles.body")}
          </p>
          <div className={`${styles.actions} m-enter`} style={{ ["--m-i" as string]: 3 }}>
            <Link href={designHref(locale, { structure: "ECMA_RTE" })} className={`${styles.pill} ${styles.pillLarge}`}>
              {t("marketing.bottles.primary")}
            </Link>
            <Link href={`/${locale}/boxes`} className={`${styles.pill} ${styles.pillOutline} ${styles.pillLarge}`}>
              {t("marketing.bottles.secondary")}
            </Link>
          </div>
          <div className={`${styles.heroShowcase} m-enter-lcp`} style={{ ["--m-i" as string]: 4 }} aria-hidden="true">
            {(["dropper", "jar", "bottle", "can", "pump"] as const).map((v) => (
              <div key={v} className={styles.showcaseItem}>
                {v === "bottle" ? (
                  <HeroImage src={vesselSrc(v)} sizes="(min-width: 1024px) 200px, 30vw" alt="" {...renderDims(vesselSrc(v))} />
                ) : (
                  // Side renders: low priority and no preload (R4-MK-06).
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={vesselSrc(v)} srcSet={srcSetFor(vesselSrc(v))} sizes="(min-width: 1024px) 200px, 30vw" alt="" {...renderDims(vesselSrc(v))} fetchPriority="low" decoding="async" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className={styles.band} aria-labelledby="vessels-title">
        <div className={styles.container}>
          <h2 id="vessels-title" className="visually-hidden">
            {t("marketing.bottles.eyebrow")}
          </h2>
          <ul className={`${styles.productGrid} ${styles.five}`}>
            {VESSEL_RENDERS.map((v, i) => (
              <li key={v} data-reveal="" suppressHydrationWarning style={{ ["--m-i" as string]: i % 4 }}>
                <article className={`${styles.card} ${styles.productCard}`}>
                  <div className={styles.productMedia} style={{ ["--tile-bg" as string]: TINTS[v] }}>
                    <span className={`${styles.tag} ${styles.tagSoon} ${styles.soonBadge}`}>{t("marketing.bottles.soon")}</span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={vesselSrc(v)} srcSet={srcSetFor(vesselSrc(v))} sizes="(min-width: 1200px) 240px, (min-width: 560px) 46vw, 92vw" alt="" loading="lazy" decoding="async" width={360} height={480} />
                  </div>
                  <div className={styles.productBody}>
                    <h3 className={styles.h3}>{t(`marketing.bottles.items.${v}` as DictKey)}</h3>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
