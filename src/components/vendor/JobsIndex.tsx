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
  Text,
  type AppliedFilter,
} from "@/components/ui";
import { useI18n } from "@/i18n/client";
import type { DictKey } from "@/i18n";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { STRUCTURE_CODES } from "@/types";
import { countByView, filterJobs, JOB_SORTS, JOB_VIEWS, type JobSort, type JobView } from "./lib/jobs";
import { DueLabel, JobStatusBadge } from "./JobBits";
import type { JobListItemDTO } from "./types";

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
  }));

  const filtered = Boolean(query || structure || dueSoonOnly || view !== "all");

  return (
    <Page fullWidth title={t("vendorPortal.jobs.title")} titleIcon={ClipboardList}>
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
            <IndexFilters
              views={views}
              selectedView={JOB_VIEWS.indexOf(view)}
              onSelectView={(i) => setParam({ view: JOB_VIEWS[i] === "all" ? null : JOB_VIEWS[i]! })}
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
              </IndexTableCell>
              <IndexTableCell>
                <time dateTime={j.placedAt}>{formatDate(j.placedAt, locale, "medium")}</time>
              </IndexTableCell>
              <IndexTableCell>
                {structureName(j.structureCode)}
                <Text as="span" tone="subdued" variant="bodySm">
                  {" · "}
                  {j.buyerName}
                </Text>
              </IndexTableCell>
              <IndexTableCell alignment="end" numeric>
                {formatNumber(j.quantity)}
              </IndexTableCell>
              <IndexTableCell>
                <DueLabel dueDate={j.dueDate} status={j.status} compact />
              </IndexTableCell>
              <IndexTableCell>
                <JobStatusBadge job={j} />
              </IndexTableCell>
              <IndexTableCell alignment="end" numeric>
                {formatMoney(j.vendorCostPiasters, locale)}
              </IndexTableCell>
            </IndexTableRow>
          ))}
        </IndexTable>
    </Page>
  );
}
