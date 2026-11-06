import Link from "next/link";
import { BadgeCheck, Clock, MapPin, Star, Timer } from "lucide-react";
import type { Locale } from "@/types";
import { getT, pick } from "@/i18n";
import type { DictKey } from "@/i18n";
import { formatNumber } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import type { VendorListItem } from "./vendor-filters";
import styles from "./store.module.css";

/** Vendor directory card. No contact details: Elba is a managed marketplace. */
export function VendorCard({ locale, vendor, headingLevel = "h3" }: { locale: Locale; vendor: VendorListItem; headingLevel?: "h2" | "h3" }) {
  const t = getT(locale);
  const H = headingLevel;
  const name = pick(locale, vendor.name.ar, vendor.name.en);
  const href = `/${locale}/vendors/${vendor.slug}`;
  return (
    <article className={styles.productCard} data-testid="vendor-card">
      <div className={styles.productBody}>
        <div className={styles.vendorHead}>
          {vendor.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={vendor.logoUrl} alt="" className={styles.vendorLogo} width={48} height={48} loading="lazy" />
          ) : null}
          <div>
            <H className={styles.cardTitle}>
              <Link href={href} className={styles.productLink}>
                {name}
              </Link>
            </H>
            <p className={`${styles.muted} ${styles.small}`}>
              <Icon source={MapPin} size="small" /> {t(`cities.${vendor.city}` as DictKey)}
            </p>
          </div>
        </div>
        <div className={styles.badges}>
          {vendor.verified ? (
            <Badge tone="success" icon={<Icon source={BadgeCheck} size="small" />}>
              {t("vendors.verified")}
            </Badge>
          ) : null}
          {vendor.foodSafe ? <Badge tone="info">{t("vendors.foodSafe")}</Badge> : null}
          {vendor.capabilities.digitalShortRun ? <Badge>{t("store.vendors.digital")}</Badge> : null}
        </div>
        <ul className={styles.metaList}>
          <li>
            <Icon source={Star} size="small" />
            <span>
              {t("store.vendors.ratingValue", { rating: vendor.rating.toFixed(1), count: formatNumber(vendor.ratingCount) })}
            </span>
          </li>
          <li>
            <Icon source={Clock} size="small" />
            <span>{t("store.vendors.onTimeValue", { pct: formatNumber(vendor.onTimePct) })}</span>
          </li>
          <li>
            <Icon source={Timer} size="small" />
            <span>{t("store.vendors.leadValue", { days: vendor.leadTimeDays })}</span>
          </li>
        </ul>
        <p className={`${styles.small} ${styles.muted}`}>
          {vendor.capabilities.structures.map((s) => t(`structures.${s}` as DictKey)).join(" · ")}
        </p>
        <p className={styles.small}>{t("store.vendors.minQty", { qty: formatNumber(vendor.minOrderQty) })}</p>
        <div className={styles.productActions}>
          <Button url={href} accessibilityLabel={`${t("store.vendors.viewProfile")}: ${name}`}>
            {t("store.vendors.viewProfile")}
          </Button>
        </div>
      </div>
    </article>
  );
}
