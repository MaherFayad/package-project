import Link from "next/link";
import type { Locale, Piasters } from "@/types";
import { getT, pick } from "@/i18n";
import type { DictKey } from "@/i18n";
import { formatMoney } from "@/lib/format";
import { Badge, Button } from "@/components/ui";
import { designHref, structureHref, structureImage } from "./catalog";
import type { StructureView } from "./data";
import styles from "./store.module.css";

/** Catalogue card: illustration, name, family badge, "from" price, details + design CTA. */
export function StructureCard({
  locale,
  structure,
  fromPiasters,
  headingLevel = "h3",
}: {
  locale: Locale;
  structure: StructureView;
  fromPiasters: Piasters | null;
  headingLevel?: "h2" | "h3";
}) {
  const t = getT(locale);
  const H = headingLevel;
  const name = pick(locale, structure.name.ar, structure.name.en);
  const p = structure.params;
  return (
    <article className={styles.productCard}>
      <div className={styles.productMedia}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={structureImage(structure.code)} alt="" loading="lazy" decoding="async" width={320} height={240} />
      </div>
      <div className={styles.productBody}>
        <div className={styles.badges}>
          <Badge tone={structure.family === "CORRUGATED" ? "neutral" : "info"}>
            {t(`store.catalog.family.${structure.family}` as DictKey)}
          </Badge>
        </div>
        <H className={styles.cardTitle}>
          <Link href={structureHref(locale, structure.code)} className={styles.productLink}>
            {name}
          </Link>
        </H>
        <p className={`${styles.muted} ${styles.small}`}>{pick(locale, structure.description.ar, structure.description.en)}</p>
        <p className={styles.small}>
          {t("store.catalog.sizeRange", {
            range: `${p.L.min}–${p.L.max} × ${p.W.min}–${p.W.max} × ${p.H.min}–${p.H.max} ${t("common.mm")}`,
          })}
        </p>
        <p>
          <strong>
            {fromPiasters != null ? (
              t("store.catalog.fromPrice", { price: formatMoney(fromPiasters, locale) })
            ) : (
              t("store.catalog.priceOnRequest")
            )}
          </strong>
        </p>
        <div className={styles.productActions}>
          <Button url={designHref(locale, { structure: structure.code })} variant="primary">
            {t("store.catalog.designFree")}
          </Button>
          <Button url={structureHref(locale, structure.code)} accessibilityLabel={`${t("store.catalog.details")}: ${name}`}>
            {t("store.catalog.details")}
          </Button>
        </div>
      </div>
    </article>
  );
}
