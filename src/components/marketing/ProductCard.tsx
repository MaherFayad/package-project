import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Locale, Piasters } from "@/types";
import { getT, pick } from "@/i18n";
import { formatMoney } from "@/lib/format";
import { designHref, structureHref } from "@/components/store/catalog";
import type { StructureView } from "@/components/store/data";
import { TILE_BG, renderSrc } from "./assets";
import styles from "./marketing.module.css";

/** Marketing product card: real 3D render of the structure, name, size range, "from" price, CTAs. */
export function ProductCard({
  locale,
  structure,
  fromPiasters,
  headingLevel = "h3",
  index = 0,
}: {
  locale: Locale;
  structure: StructureView;
  fromPiasters: Piasters | null;
  headingLevel?: "h2" | "h3";
  index?: number;
}) {
  const t = getT(locale);
  const H = headingLevel;
  const name = pick(locale, structure.name.ar, structure.name.en);
  const p = structure.params;
  const href = structureHref(locale, structure.code);
  return (
    <li data-reveal="" suppressHydrationWarning style={{ ["--m-i" as string]: index % 3 }}>
      <article className={`${styles.card} ${styles.productCard}`}>
        <div className={styles.productMedia} style={{ ["--tile-bg" as string]: TILE_BG[structure.code] }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={renderSrc(structure.code)} alt={t("marketing.boxes.renderAlt", { name })} loading="lazy" decoding="async" width={480} height={360} />
        </div>
        <div className={styles.productBody}>
          <span className={styles.productCode}>{structure.code.replace("_", " ")}</span>
          <H className={styles.h3}>
            <Link href={href} className={styles.cardLink}>
              {name}
            </Link>
          </H>
          <p className={styles.small}>{pick(locale, structure.description.ar, structure.description.en)}</p>
          <p className={styles.small}>
            <bdi dir="ltr" className={styles.num}>{`${p.L.min}–${p.L.max} × ${p.W.min}–${p.W.max} × ${p.H.min}–${p.H.max}`}</bdi> {t("common.mm")}
          </p>
          <p className={styles.productPrice}>
            {fromPiasters != null ? t("marketing.boxes.from", { price: formatMoney(fromPiasters, locale) }) : t("marketing.boxes.onRequest")}
          </p>
          <div className={styles.productActions}>
            <Link href={designHref(locale, { structure: structure.code })} className={`${styles.pill} ${styles.pillSmall}`}>
              {t("marketing.boxes.design")}
            </Link>
            <Link href={href} className={`${styles.pill} ${styles.pillSmall} ${styles.pillOutline}`} aria-label={`${t("store.catalog.details")}: ${name}`}>
              {t("store.catalog.details")}
              <ArrowRight size={16} aria-hidden className={styles.flipRtl} />
            </Link>
          </div>
        </div>
      </article>
    </li>
  );
}
