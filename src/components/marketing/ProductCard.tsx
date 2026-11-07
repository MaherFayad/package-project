import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Locale, Piasters } from "@/types";
import { getT, pick } from "@/i18n";
import { formatMoney } from "@/lib/format";
import { designHref, structureHref } from "@/components/store/catalog";
import type { StructureView } from "@/components/store/data";
import { renderSrc, srcSetFor } from "./assets";
import { Pill } from "./kit/Pill";
import styles from "./restyle/restyle.module.css";
import dt from "./restyle/detail.module.css";
import { STRUCTURES } from "@/lib/dieline/registry";
import { standardOf } from "@/data/catalogue/mapping";

/** Marketing product card (R6: grey bento tile): real 3D render of the structure, name, size range, "from" price, CTAs. */
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
          {/* CR-32: the industry code (FEFCO 0426), never the internal code ("PIZZA"). */}
          {(() => {
            const std = standardOf(structure.code, STRUCTURES[structure.code]?.standard);
            return std.code ? (
              <span className={dt.cardCode} dir="ltr">
                {`${std.system} ${std.code}`}
              </span>
            ) : null;
          })()}
          <H className={styles.cardTitle}>
            <Link href={href} className={dt.cardLink}>
              {name}
            </Link>
          </H>
          <p className={`${styles.small} ${dt.cardDesc}`}>{pick(locale, structure.description.ar, structure.description.en)}</p>
          <p className={styles.small}>
            <bdi dir="ltr" className={styles.num}>{`${p.L.min}–${p.L.max} × ${p.W.min}–${p.W.max} × ${p.H.min}–${p.H.max}`}</bdi> {t("common.mm")}
          </p>
          <p className={dt.cardPrice}>
            {fromPiasters != null
              ? t("marketing.boxes.from", {
                  price: formatMoney(fromPiasters, locale, {
                    alwaysDecimals: true,
                  }),
                })
              : t("marketing.boxes.onRequest")}
          </p>
          <div className={dt.cardActions}>
            <Pill href={designHref(locale, { structure: structure.code })} variant="dark" size="sm">
              {t("marketing.boxes.design")}
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
