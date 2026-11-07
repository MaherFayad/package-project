import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Locale } from "@/types";
import { getT, pick } from "@/i18n";
import { formatMoney } from "@/lib/format";
import { designHref, structureHref } from "@/components/store/catalog";
import type { PriceFromRow, StructureView } from "@/components/store/data";
import { daysWord } from "./home/copy";
import { renderSrc, srcSetFor } from "./assets";
import { Pill } from "./kit/Pill";
import styles from "./restyle/restyle.module.css";
import dt from "./restyle/detail.module.css";

/**
 * Box chooser card (R6 grey bento tile): real 3D render, everyday name, what it is for, the price
 * per box for 500 boxes and the delivery days, exactly as `getPriceFrom` returns them (ex-VAT,
 * all-in, best-match offer; R1-08). The primary action sells the printed box ("Order this box",
 * R1-05) and opens the designer, where the exact price shows; "Details" opens the box page. No
 * industry codes or size ranges on the card (R1-10): those live on the box page.
 */
export function ProductCard({
  locale,
  structure,
  row500,
  headingLevel = "h3",
  index = 0,
}: {
  locale: Locale;
  structure: StructureView;
  /** The 500-box row of `getPriceFrom` (null when the box has no instant price). */
  row500: PriceFromRow | null;
  headingLevel?: "h2" | "h3";
  index?: number;
}) {
  const t = getT(locale);
  const H = headingLevel;
  const name = pick(locale, structure.name.ar, structure.name.en);
  const href = structureHref(locale, structure.code);
  return (
    <li data-reveal="" suppressHydrationWarning style={{ ["--m-i" as string]: index % 3 }}>
      <article className={dt.card}>
        <div className={dt.cardMedia}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={renderSrc(structure.code)}
            srcSet={srcSetFor(renderSrc(structure.code))}
            sizes="(min-width: 1024px) 400px, (min-width: 560px) 46vw, 82vw"
            alt={t("marketing.boxes.renderAlt", { name })}
            loading="lazy"
            decoding="async"
            width={480}
            height={360}
          />
        </div>
        <div className={dt.cardBody}>
          <H className={styles.cardTitle}>
            <Link href={href} className={dt.cardLink}>
              {name}
            </Link>
          </H>
          <p className={`${styles.small} ${dt.cardDesc}`}>{pick(locale, structure.description.ar, structure.description.en)}</p>
          <p className={dt.cardPrice}>
            {row500
              ? t("marketing.boxes.from500", { price: formatMoney(row500.unitPiasters, locale, { alwaysDecimals: true }) })
              : t("marketing.boxes.onRequest")}
          </p>
          {row500 ? <p className={styles.small}>{t("marketing.boxes.days", { days: row500.deliveryDays, daysWord: daysWord(locale, row500.deliveryDays) })}</p> : null}
          <div className={dt.cardActions}>
            <Pill href={designHref(locale, { structure: structure.code })} variant="dark" size="sm" aria-label={t("marketing.boxes.orderLabel", { name })}>
              {t("marketing.boxes.order")}
            </Pill>
            <Pill href={href} variant="outline-dark" size="sm" aria-label={`${t("store.catalog.details")}: ${name}`}>
              {t("store.catalog.details")}
              <ArrowRight size={16} aria-hidden className={styles.flip} />
            </Pill>
          </div>
        </div>
      </article>
    </li>
  );
}
