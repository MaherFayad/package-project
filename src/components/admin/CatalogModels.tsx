"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { BlockStack, InlineStack } from "@/components/ui/Stack";
import { Button } from "@/components/ui/Button";
import { EmptyBoxIllustration, EmptyState } from "@/components/ui/EmptyState";
import { IndexFilters, IndexTable, IndexTableCell, IndexTableRow, IndexTableRowLink, type AppliedFilter } from "@/components/ui/IndexTable";
import { MetricsStrip } from "@/components/ui/MetricsStrip";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/Select";
import { Text } from "@/components/ui/Text";
import { useI18n } from "@/i18n/client";
import type { DictKey } from "@/i18n";
import { formatNumber } from "@/lib/format";
import { MODEL_GROUPS, MODEL_GROUP_NAMES } from "@/lib/library/types";
import { matchesQuery } from "@/lib/library/search";
import { AVAILABILITY_VIEWS, inAvailabilityView, type AvailabilityView } from "./lib/availability";
import type { CatalogModelRow } from "./server/queries";
import { adminStyles } from "./charts";

const PAGE_SIZE = 50;

function AvailabilityBadge({ m }: { m: Pick<CatalogModelRow, "instant" | "vendorIds"> }) {
  const { t } = useI18n();
  return m.instant ? (
    <Badge tone="success" progress="complete">
      {t("admin.catalog.models.instantCount", { count: formatNumber(m.vendorIds.length) })}
    </Badge>
  ) : (
    <Badge tone="warning" progress="incomplete">
      {t("admin.catalog.models.quoteOnly")}
    </Badge>
  );
}

function asView(v: string | null): AvailabilityView {
  return (AVAILABILITY_VIEWS as readonly string[]).includes(v ?? "") ? (v as AvailabilityView) : "all";
}

/**
 * Catalogue → Models: every library model a buyer can design, and whether vendors in Egypt can
 * price it instantly (an active vendor has an active rate card for the style and board it is made
 * as) or it is quote-only. Filters: availability view, search, group, vendor (?vendor=slug, linked
 * from the vendor page).
 */
export function ModelsPanel({
  models,
  vendors,
  structures,
}: {
  models: CatalogModelRow[];
  vendors: { id: string; slug: string; nameAr: string; nameEn: string }[];
  structures: { code: string; nameAr: string; nameEn: string }[];
}) {
  const { t, locale } = useI18n();
  const pathname = usePathname();
  const params = useSearchParams();
  const [view, setView] = useState<AvailabilityView>(asView(params.get("availability")));
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [group, setGroup] = useState(params.get("group") ?? "");
  const [vendorSlug, setVendorSlug] = useState(params.get("vendor") ?? "");
  const [page, setPage] = useState(0);

  const setParam = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    const qs = next.toString();
    // Client-side filtering: update the URL without a server round trip.
    window.history.replaceState(null, "", `${pathname}${qs ? `?${qs}` : ""}`);
    setPage(0);
  };

  const vendor = vendors.find((v) => v.slug === vendorSlug) ?? null;
  const vendorName = (v: { nameAr: string; nameEn: string }) => (locale === "ar" ? v.nameAr : v.nameEn);
  const styleName = useMemo(() => new Map(structures.map((s) => [s.code, locale === "ar" ? s.nameAr : s.nameEn])), [structures, locale]);

  const base = useMemo(() => models.filter((m) => (!group || m.group === group) && (!vendor || m.vendorIds.includes(vendor.id)) && (!query.trim() || matchesQuery({ search: `${m.code} ${m.standard} ${m.nameAr} ${m.nameEn}` }, query))), [models, group, vendor, query]);
  const counts = useMemo(() => Object.fromEntries(AVAILABILITY_VIEWS.map((v) => [v, base.filter((m) => inAvailabilityView(m, v)).length])) as Record<AvailabilityView, number>, [base]);
  const shown = base.filter((m) => inAvailabilityView(m, view));
  const pages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const pageRows = shown.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);
  const instantAll = models.filter((m) => m.instant).length;

  const applied: AppliedFilter[] = [];
  if (group) applied.push({ key: "group", label: `${t("admin.catalog.models.group")}: ${MODEL_GROUP_NAMES[group as keyof typeof MODEL_GROUP_NAMES]?.[locale] ?? group}`, onRemove: () => { setGroup(""); setParam({ group: null }); } });
  if (vendor) applied.push({ key: "vendor", label: `${t("admin.catalog.models.vendor")}: ${vendorName(vendor)}`, onRemove: () => { setVendorSlug(""); setParam({ vendor: null }); } });
  const filtered = Boolean(query.trim() || group || vendor || view !== "all");
  const clearAll = () => {
    setQuery("");
    setGroup("");
    setVendorSlug("");
    setView("all");
    setParam({ q: null, group: null, vendor: null, availability: null });
  };

  return (
    <BlockStack gap="400">
      <MetricsStrip
        accessibilityLabel={t("admin.catalog.models.metricsLabel")}
        metrics={[
          { label: t("admin.catalog.models.metrics.total"), value: formatNumber(models.length) },
          { label: t("admin.catalog.models.metrics.instant"), value: formatNumber(instantAll) },
          { label: t("admin.catalog.models.metrics.quoteOnly"), value: formatNumber(models.length - instantAll) },
          { label: t("admin.catalog.models.metrics.vendors"), value: formatNumber(vendors.length) },
        ]}
      />
      <div id="admin-models-table">
        <IndexTable
          resourceName={{ singular: t("admin.catalog.models.singular"), plural: t("admin.catalog.models.plural") }}
          caption={t("admin.catalog.models.caption")}
          rowIds={pageRows.map((m) => m.code)}
          headings={[
            { title: t("admin.catalog.models.columns.model") },
            { title: t("admin.catalog.models.columns.group") },
            { title: t("admin.catalog.models.columns.madeAs") },
            { title: t("admin.catalog.models.columns.boards"), alignment: "end" },
            { title: t("admin.catalog.models.columns.availability") },
          ]}
          toolbar={
            <IndexFilters
              views={AVAILABILITY_VIEWS.map((v) => ({ id: `models-view-${v}`, panelID: "admin-models-table", content: t(`admin.catalog.models.views.${v}` as DictKey), badge: formatNumber(counts[v]) }))}
              selectedView={AVAILABILITY_VIEWS.indexOf(view)}
              onSelectView={(i) => {
                const v = AVAILABILITY_VIEWS[i]!;
                setView(v);
                setParam({ availability: v === "all" ? null : v });
              }}
              queryValue={query}
              onQueryChange={(v) => {
                setQuery(v);
                setParam({ q: v.trim() || null });
              }}
              queryPlaceholder={t("admin.catalog.models.search")}
              filterLabel={t("admin.common.filters")}
              filters={
                <BlockStack gap="300">
                  <Select
                    label={t("admin.catalog.models.group")}
                    value={group}
                    onChange={(v) => {
                      setGroup(v);
                      setParam({ group: v || null });
                    }}
                    options={[{ label: t("admin.audit.any"), value: "" }, ...MODEL_GROUPS.map((g) => ({ label: MODEL_GROUP_NAMES[g][locale], value: g }))]}
                  />
                  <Select
                    label={t("admin.catalog.models.vendor")}
                    value={vendorSlug}
                    onChange={(v) => {
                      setVendorSlug(v);
                      setParam({ vendor: v || null });
                    }}
                    options={[{ label: t("admin.audit.any"), value: "" }, ...vendors.map((v) => ({ label: vendorName(v), value: v.slug }))]}
                  />
                </BlockStack>
              }
              appliedFilters={applied}
            />
          }
          emptyState={
            <EmptyState heading={t("admin.catalog.models.empty")} image={<EmptyBoxIllustration size={96} />} compact action={filtered ? <Button onClick={clearAll}>{t("admin.common.clearFilters")}</Button> : undefined}>
              {t("admin.catalog.models.emptyBody")}
            </EmptyState>
          }
          footer={
            shown.length ? (
              <InlineStack align="center" blockAlign="center" gap="300">
                <Pagination
                  hasPrevious={current > 0}
                  hasNext={current < pages - 1}
                  onPrevious={() => setPage(current - 1)}
                  onNext={() => setPage(current + 1)}
                  accessibilityLabel={t("admin.catalog.models.pagination")}
                  label={t("admin.catalog.models.range", { from: formatNumber(current * PAGE_SIZE + 1), to: formatNumber(current * PAGE_SIZE + pageRows.length), total: formatNumber(shown.length) })}
                />
              </InlineStack>
            ) : undefined
          }
        >
          {pageRows.map((m) => (
            <IndexTableRow key={m.code} id={m.code}>
              <IndexTableCell>
                <BlockStack gap="050">
                  <IndexTableRowLink url={`/${locale}/design/${m.slug}`}>{locale === "ar" ? m.nameAr : m.nameEn}</IndexTableRowLink>
                  <Text as="span" variant="bodySm" tone="subdued">
                    <bdi dir="ltr">{m.standard}</bdi>
                  </Text>
                  {/* Phones: availability is the point of this table, so it also sits in the first cell. */}
                  <div className={adminStyles.PhoneOnly}>
                    <AvailabilityBadge m={m} />
                  </div>
                </BlockStack>
              </IndexTableCell>
              <IndexTableCell>{MODEL_GROUP_NAMES[m.group as keyof typeof MODEL_GROUP_NAMES]?.[locale] ?? m.group}</IndexTableCell>
              <IndexTableCell>{m.styles.map((s) => styleName.get(s) ?? s).join(locale === "ar" ? "، " : ", ")}</IndexTableCell>
              <IndexTableCell alignment="end" numeric>
                {t("admin.catalog.models.boardsOf", { priced: formatNumber(m.boardsPriced), total: formatNumber(m.boardsTotal) })}
              </IndexTableCell>
              <IndexTableCell>
                <AvailabilityBadge m={m} />
              </IndexTableCell>
            </IndexTableRow>
          ))}
        </IndexTable>
      </div>
    </BlockStack>
  );
}
