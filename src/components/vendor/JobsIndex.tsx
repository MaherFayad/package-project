"use client";

import { ClipboardList } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  Button,
  Checkbox,
  EmptyBoxIllustration,
  EmptyState,
  IndexFilters,
  IndexTable,
  IndexTableCell,
  IndexTableRow,
  IndexTableRowLink,
  Page,
  Select,
  BlockStack,
  Tabs,
  Text,
  type AppliedFilter,
} from "@/components/ui";
import { useI18n } from "@/i18n/client";
import type { DictKey } from "@/i18n";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { STRUCTURE_CODES } from "@/types";
import { countByView, filterJobs, JOB_SORTS, JOB_VIEWS, type JobSort, type JobView } from "./lib/jobs";
import { DueLabel, JobStatusBadge, useProductName } from "./JobBits";
import type { JobListItemDTO } from "./types";
import styles from "./vendor.module.css";

const PANEL_ID = "vendor-jobs-results";

function asView(v: string | null): JobView {
  return (JOB_VIEWS as readonly string[]).includes(v ?? "") ? (v as JobView) : "all";
}
function asSort(v: string | null): JobSort {
  return (JOB_SORTS as readonly string[]).includes(v ?? "") ? (v as JobSort) : "due";
}

/** Jobs index: view tabs with counts · "Search and filter" · filters (style, due soon) · sort; state lives in the URL. */
export function JobsIndex({ jobs }: { jobs: JobListItemDTO[] }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const view = asView(params.get("view"));
  const sort = asSort(params.get("sort"));
  const structure = params.get("structure");
  const dueSoonOnly = params.get("due") === "soon";
  const [query, setQuery] = useState(params.get("q") ?? "");

  const setParam = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    const qs = next.toString();
    startTransition(() => router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false }));
  };

  const counts = useMemo(() => countByView(jobs), [jobs]);
  const rows = useMemo(() => filterJobs(jobs, { view, query, structure, dueSoonOnly, sort }), [jobs, view, query, structure, dueSoonOnly, sort]);
  const structureName = (code: string) => t(`structures.${code}` as DictKey);
  const productName = useProductName();

  const applied: AppliedFilter[] = [];
  if (structure) applied.push({ key: "structure", label: t("vendorPortal.jobs.appliedStructure", { name: structureName(structure) }), onRemove: () => setParam({ structure: null }) });
  if (dueSoonOnly) applied.push({ key: "due", label: t("vendorPortal.jobs.appliedDue"), onRemove: () => setParam({ due: null }) });

  const clearAll = () => {
    setQuery("");
    setParam({ q: null, structure: null, due: null, view: null });
  };

  const views = JOB_VIEWS.map((v) => ({
    id: `jobs-view-${v}`,
    content: t(`vendorPortal.views.${v}` as DictKey),
    badge: counts[v] > 0 ? formatNumber(counts[v]) : undefined,
    panelID: PANEL_ID,
  }));
  const selectView = (i: number) => setParam({ view: JOB_VIEWS[i] === "all" ? null : JOB_VIEWS[i]! });

  const filtered = Boolean(query || structure || dueSoonOnly || view !== "all");

  return (
    <Page fullWidth title={t("vendorPortal.jobs.title")} titleIcon={ClipboardList}>
      {/* The view tabs control this region; the tab row sits on its own line so long view names
          never collide with the search field (Polaris IndexFilters anatomy). */}
      <div id={PANEL_ID} role="tabpanel" aria-label={views[JOB_VIEWS.indexOf(view)]!.content} className={styles.JobsTable}>
      <IndexTable
          resourceName={{ singular: t("vendorPortal.jobs.resourceSingular"), plural: t("vendorPortal.jobs.resourcePlural") }}
          caption={t("vendorPortal.jobs.title")}
          rowIds={rows.map((r) => r.id)}
          headings={[
            { title: t("vendorPortal.jobs.columns.job") },
            { title: t("vendorPortal.jobs.columns.placed") },
            { title: t("vendorPortal.jobs.columns.product") },
            { title: t("vendorPortal.jobs.columns.quantity"), alignment: "end" },
            { title: t("vendorPortal.jobs.columns.due") },
            { title: t("vendorPortal.jobs.columns.status") },
            { title: t("vendorPortal.jobs.columns.payout"), alignment: "end" },
          ]}
          toolbar={
            <>
            <div className={styles.ViewTabs}>
              <Tabs tabs={views} selected={JOB_VIEWS.indexOf(view)} onSelect={selectView} accessibilityLabel={t("vendorPortal.jobs.title")} />
            </div>
            <IndexFilters
              queryValue={query}
              onQueryChange={(v) => {
                setQuery(v);
                setParam({ q: v.trim() || null });
              }}
              queryPlaceholder={t("vendorPortal.jobs.search")}
              filterLabel={t("vendorPortal.jobs.filters")}
              filters={
                <BlockStack gap="300">
                  <Select
                    label={t("vendorPortal.jobs.structure")}
                    value={structure ?? ""}
                    onChange={(v) => setParam({ structure: v || null })}
                    options={[{ label: t("vendorPortal.jobs.anyStructure"), value: "" }, ...STRUCTURE_CODES.map((c) => ({ label: structureName(c), value: c }))]}
                  />
                  <Checkbox label={t("vendorPortal.jobs.dueSoonOnly")} checked={dueSoonOnly} onChange={(on) => setParam({ due: on ? "soon" : null })} />
                </BlockStack>
              }
              appliedFilters={applied}
              sortLabel={t("vendorPortal.jobs.sort.label")}
              sortOptions={JOB_SORTS.map((s) => ({ label: t(`vendorPortal.jobs.sort.${s}` as DictKey), value: s }))}
              sortSelected={sort}
              onSort={(v) => setParam({ sort: v === "due" ? null : v })}
            />
            </>
          }
          emptyState={
            <EmptyState
              heading={filtered ? t("vendorPortal.jobs.emptyFilteredTitle") : t("vendorPortal.jobs.emptyTitle")}
              image={<EmptyBoxIllustration size={96} />}
              compact
              action={filtered ? <Button onClick={clearAll}>{t("vendorPortal.jobs.clearFilters")}</Button> : undefined}
            >
              {filtered ? t("vendorPortal.jobs.emptyFilteredBody") : t("vendorPortal.jobs.emptyBody")}
            </EmptyState>
          }
          footer={
            rows.length ? (
              <Text as="p" tone="subdued" alignment="center" variant="bodySm">
                {t("vendorPortal.jobs.count", { count: formatNumber(rows.length) })}
              </Text>
            ) : undefined
          }
        >
          {rows.map((j) => (
            <IndexTableRow key={j.id} id={j.id} tone={j.status === "CANCELLED" || j.status === "REFUNDED" ? "subdued" : undefined}>
              <IndexTableCell>
                <IndexTableRowLink url={`/${locale}/vendor/jobs/${j.number}`}>
                  <bdi>{j.number}</bdi>
                </IndexTableRowLink>
                {/* Phones: Polaris condensed row (everything in one cell, other columns hidden). */}
                <div className={styles.Condensed}>
                  <JobStatusBadge job={j} />
                  <Text as="span" tone="subdued" variant="bodySm">
                    {productName(j)} · {t("vendorPortal.common.pcs", { count: formatNumber(j.quantity) })}
                  </Text>
                  <span className={styles.CondensedMeta}>
                    <DueLabel dueDate={j.dueDate} status={j.status} compact />
                    <Text as="span" numeric fontWeight="semibold">
                      {formatMoney(j.vendorCostPiasters, locale)}
                    </Text>
                  </span>
                </div>
              </IndexTableCell>
              <IndexTableCell className={styles.WideOnly}>
                <time dateTime={j.placedAt}>{formatDate(j.placedAt, locale, "medium")}</time>
              </IndexTableCell>
              <IndexTableCell className={styles.WideOnly}>
                {productName(j)}
                <Text as="span" tone="subdued" variant="bodySm">
                  {j.model && j.model.code !== j.structureCode ? <> · <bdi dir="ltr">{j.model.standard}</bdi></> : null}
                  {" · "}
                  <bdi>{j.buyerName}</bdi>
                </Text>
              </IndexTableCell>
              <IndexTableCell className={styles.WideOnly} alignment="end" numeric>
                {formatNumber(j.quantity)}
              </IndexTableCell>
              <IndexTableCell className={styles.WideOnly}>
                <DueLabel dueDate={j.dueDate} status={j.status} compact />
              </IndexTableCell>
              <IndexTableCell className={styles.WideOnly}>
                <JobStatusBadge job={j} />
              </IndexTableCell>
              <IndexTableCell className={styles.WideOnly} alignment="end" numeric>
                {formatMoney(j.vendorCostPiasters, locale)}
              </IndexTableCell>
            </IndexTableRow>
          ))}
        </IndexTable>
      </div>
    </Page>
  );
}
