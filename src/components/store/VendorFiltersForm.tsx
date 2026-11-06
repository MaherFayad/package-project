import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { getT } from "@/i18n";
import type { DictKey } from "@/i18n";
import { EGYPT_CITIES, STRUCTURE_CODES, type Locale } from "@/types";
import { FILTER_FINISHES, LEAD_TIME_OPTIONS, VENDOR_SORTS, type VendorFilters } from "./vendor-filters";
import styles from "@/components/marketing/marketing.module.css";

/**
 * Vendor directory filters. A plain GET form: works without JavaScript, every state has a
 * shareable URL, and nothing changes until "Apply filters" is pressed (WCAG 3.2.2).
 *
 * R4-MK-04: a server component in the marketing language (native selects and checkboxes, pill
 * submit, ink text link), two selects per row on phones. It was a client island built from the
 * admin kit (Select, Checkbox, Button), which put three Polaris stylesheets (Form, Button,
 * Spinner, CheckoutShell) in front of first paint on /vendors and rendered an admin blue link.
 */
export function VendorFiltersForm({ locale, filters, action }: { locale: Locale; filters: VendorFilters; action: string }) {
  const t = getT(locale);
  const opt = (value: string, label: string) => ({ value, label });
  const selects: { name: string; label: string; value: string; options: { value: string; label: string }[] }[] = [
    { name: "city", label: t("store.vendors.city"), value: filters.city ?? "", options: [opt("", t("store.vendors.anyCity")), ...EGYPT_CITIES.map((c) => opt(c, t(`cities.${c}` as DictKey)))] },
    { name: "structure", label: t("store.vendors.structure"), value: filters.structure ?? "", options: [opt("", t("store.vendors.anyStructure")), ...STRUCTURE_CODES.map((c) => opt(c, t(`structures.${c}` as DictKey)))] },
    { name: "finish", label: t("store.vendors.finish"), value: filters.finish ?? "", options: [opt("", t("store.vendors.anyFinish")), ...FILTER_FINISHES.map((f) => opt(f, t(`finishes.${f}` as DictKey)))] },
    { name: "maxLead", label: t("store.vendors.leadTime"), value: filters.maxLead ? String(filters.maxLead) : "", options: [opt("", t("store.vendors.anyLeadTime")), ...LEAD_TIME_OPTIONS.map((d) => opt(String(d), t("store.vendors.leadUpTo", { days: d })))] },
    { name: "sort", label: t("store.vendors.sort"), value: filters.sort, options: VENDOR_SORTS.map((s) => opt(s, t(`store.vendors.sortOption.${s}` as DictKey))) },
  ];
  return (
    <form method="get" action={action} className={styles.vf} aria-label={t("store.vendors.filtersTitle")}>
      <div className={styles.vfGrid}>
        {selects.map((s) => (
          <div key={s.name} className={styles.vfField}>
            <label htmlFor={`vf-${s.name}`}>{s.label}</label>
            <span className={styles.vfSelectWrap}>
              <select id={`vf-${s.name}`} name={s.name} defaultValue={s.value} className={styles.vfSelect}>
                {s.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} aria-hidden className={styles.vfChevron} />
            </span>
          </div>
        ))}
      </div>
      <div className={styles.vfFoot}>
        <div className={styles.vfChecks}>
          <label className={styles.vfCheck}>
            <input type="checkbox" name="foodSafe" value="1" defaultChecked={!!filters.foodSafe} />
            <span>{t("store.vendors.foodSafeOnly")}</span>
          </label>
          <label className={styles.vfCheck}>
            <input type="checkbox" name="digital" value="1" defaultChecked={!!filters.digital} />
            <span>{t("store.vendors.digital")}</span>
          </label>
        </div>
        <div className={styles.vfActions}>
          <Link href={action} className={styles.textLink}>
            {t("store.vendors.clear")}
          </Link>
          <button type="submit" className={styles.pill}>
            {t("store.vendors.apply")}
          </button>
        </div>
      </div>
    </form>
  );
}
