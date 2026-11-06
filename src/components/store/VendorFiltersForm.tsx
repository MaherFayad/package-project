"use client";

import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Select } from "@/components/ui/Select";
import { useI18n } from "@/i18n/client";
import type { DictKey } from "@/i18n";
import { EGYPT_CITIES, STRUCTURE_CODES } from "@/types";
import { FILTER_FINISHES, LEAD_TIME_OPTIONS, VENDOR_SORTS, type VendorFilters } from "./vendor-filters";
import styles from "./store.module.css";

/**
 * Vendor directory filters. A plain GET form: works without JavaScript, every state has a
 * shareable URL, and nothing changes until "Apply filters" is pressed (WCAG 3.2.2).
 */
export function VendorFiltersForm({ filters, action }: { filters: VendorFilters; action: string }) {
  const { t } = useI18n();
  const opt = (value: string, label: string) => ({ value, label });
  return (
    <form method="get" action={action} className={styles.prose} aria-label={t("store.vendors.filtersTitle")}>
      <div className={styles.filters}>
        <Select
          label={t("store.vendors.city")}
          name="city"
          defaultValue={filters.city ?? ""}
          options={[opt("", t("store.vendors.anyCity")), ...EGYPT_CITIES.map((c) => opt(c, t(`cities.${c}` as DictKey)))]}
        />
        <Select
          label={t("store.vendors.structure")}
          name="structure"
          defaultValue={filters.structure ?? ""}
          options={[opt("", t("store.vendors.anyStructure")), ...STRUCTURE_CODES.map((c) => opt(c, t(`structures.${c}` as DictKey)))]}
        />
        <Select
          label={t("store.vendors.finish")}
          name="finish"
          defaultValue={filters.finish ?? ""}
          options={[opt("", t("store.vendors.anyFinish")), ...FILTER_FINISHES.map((f) => opt(f, t(`finishes.${f}` as DictKey)))]}
        />
        <Select
          label={t("store.vendors.leadTime")}
          name="maxLead"
          defaultValue={filters.maxLead ? String(filters.maxLead) : ""}
          options={[opt("", t("store.vendors.anyLeadTime")), ...LEAD_TIME_OPTIONS.map((d) => opt(String(d), t("store.vendors.leadUpTo", { days: d })))]}
        />
        <Select
          label={t("store.vendors.sort")}
          name="sort"
          defaultValue={filters.sort}
          options={VENDOR_SORTS.map((s) => opt(s, t(`store.vendors.sortOption.${s}` as DictKey)))}
        />
      </div>
      <div className={styles.filterChecks}>
        <Checkbox label={t("store.vendors.foodSafeOnly")} name="foodSafe" value="1" defaultChecked={!!filters.foodSafe} />
        <Checkbox label={t("store.vendors.digital")} name="digital" value="1" defaultChecked={!!filters.digital} />
      </div>
      <div className={styles.filterActions}>
        <Button submit variant="primary">
          {t("store.vendors.apply")}
        </Button>
        <Button url={action} variant="plain">
          {t("store.vendors.clear")}
        </Button>
      </div>
    </form>
  );
}
