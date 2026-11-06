import Link from "next/link";
import { BadgeCheck, Clock, MapPin, Star, Timer } from "lucide-react";
import type { Locale } from "@/types";
import { getT, pick } from "@/i18n";
import type { DictKey } from "@/i18n";
import { formatNumber } from "@/lib/format";
import type { VendorListItem } from "@/components/store/vendor-filters";
import { TILE_BG, renderSrc, srcSetFor } from "./assets";
import styles from "./marketing.module.css";

/**
 * Printer card for the marketing pages: a three-photo strip of structures this printer makes
 * (renders of our real models), name, city, trust signals and the profile link.
 * No contact details: Elba is a managed marketplace.
 */
export function VendorShowcaseCard({ locale, vendor, index = 0, headingLevel = "h3" }: { locale: Locale; vendor: VendorListItem; index?: number; headingLevel?: "h2" | "h3" }) {
  const t = getT(locale);
  const H = headingLevel;
  const name = pick(locale, vendor.name.ar, vendor.name.en);
  const href = `/${locale}/vendors/${vendor.slug}`;
  const caps = vendor.capabilities.structures;
  // Rotate the strip per card so neighbouring printers don't all lead with the same style.
  const shots = caps.length ? [0, 1, 2].map((k) => caps[(index * 2 + k) % caps.length]).filter((c, i, a) => a.indexOf(c) === i) : [];
  return (
    <li data-reveal="" suppressHydrationWarning style={{ ["--m-i" as string]: index % 3 }}>
      <article className={`${styles.card} ${styles.vendorCard}`} data-testid="vendor-card">
        <div className={styles.vendorMedia} role="img" aria-label={t("marketing.printers.sampleWork", { name })}>
          {shots.map((code) => (
            <figure key={code} style={{ ["--tile-bg" as string]: TILE_BG[code] }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={renderSrc(code)} srcSet={srcSetFor(renderSrc(code))} sizes="(min-width: 1024px) 240px, (min-width: 640px) 30vw, 60vw" alt="" loading="lazy" decoding="async" width={320} height={240} />
            </figure>
          ))}
        </div>
        <div className={styles.vendorBody}>
          <div className={styles.vendorTop}>
            {vendor.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={vendor.logoUrl} alt="" className={styles.vendorLogo} width={44} height={44} loading="lazy" />
            ) : null}
            <div>
              <H className={styles.h3}>
                <Link href={href} className={styles.cardLink}>
                  {name}
                </Link>
              </H>
              <p className={`${styles.small} ${styles.inlineIcon}`}>
                <MapPin size={16} aria-hidden /> {t(`cities.${vendor.city}` as DictKey)}
              </p>
            </div>
          </div>
          <ul className={styles.tags}>
            {vendor.verified ? (
              <li className={`${styles.tag} ${styles.tagGreen}`}>
                <BadgeCheck size={16} aria-hidden />
                {t("vendors.verified")}
              </li>
            ) : null}
            {vendor.foodSafe ? <li className={styles.tag}>{t("vendors.foodSafe")}</li> : null}
            {vendor.capabilities.digitalShortRun ? <li className={styles.tag}>{t("store.vendors.digital")}</li> : null}
          </ul>
          <ul className={styles.vendorMeta}>
            <li>
              <Star size={16} aria-hidden fill="#b98900" color="#b98900" />
              <span className={styles.num}>{t("marketing.printers.rating", { rating: vendor.rating.toFixed(1), count: formatNumber(vendor.ratingCount) })}</span>
            </li>
            <li>
              <Clock size={16} aria-hidden />
              <span>{t("marketing.printers.onTime", { pct: formatNumber(vendor.onTimePct) })}</span>
            </li>
            <li>
              <Timer size={16} aria-hidden />
              <span>{t("marketing.printers.lead", { days: vendor.leadTimeDays })}</span>
            </li>
          </ul>
          <p className={styles.small}>{t("marketing.printers.from", { qty: formatNumber(vendor.minOrderQty) })}</p>
          <div className={styles.productActions}>
            <Link href={href} className={`${styles.pill} ${styles.pillSmall} ${styles.pillOutline}`} aria-label={`${t("store.vendors.viewProfile")}: ${name}`}>
              {t("store.vendors.viewProfile")}
            </Link>
          </div>
        </div>
      </article>
    </li>
  );
}
