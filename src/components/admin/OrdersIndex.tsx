"use client";

import { ClipboardList } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  Badge,
  BlockStack,
  Button,
  EmptyBoxIllustration,
  EmptyState,
  IndexFilters,
  IndexTable,
  IndexTableCell,
  IndexTableRow,
  IndexTableRowLink,
  InlineStack,
  MetricsStrip,
  Page,
  Select,
  Text,
  type AppliedFilter,
} from "@/components/ui";
import { useI18n } from "@/i18n/client";
import type { DictKey } from "@/i18n";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { statusBadge } from "@/lib/orders/state";
import type { OrderStatus } from "@/types";
import { adminStyles } from "./charts";
import { asOrderView, countByOrderView, filterOrders, ORDER_SORTS, ORDER_VIEWS, type AdminOrderRow, type OrderSort } from "./lib/orders";

function asSort(v: string | null): OrderSort {
  return (ORDER_SORTS as readonly string[]).includes(v ?? "") ? (v as OrderSort) : "newest";
}

/** Admin wording first (PAID reads "Awaiting vendor": the money is in, the next step is the vendor). */
const ADMIN_STATUS_LABELS = new Set(["PAID"]);

export function OrderStatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const b = statusBadge(status as OrderStatus);
  return (
    <Badge tone={b.tone} progress={b.progress}>
      {t((ADMIN_STATUS_LABELS.has(status) ? `admin.orders.statusLabel.${status}` : `orderStatus.${status}`) as DictKey)}
    </Badge>
  );
}

/** Admin orders index: metrics strip, view tabs with counts, "Search and filter", vendor filter, sort. */
export function OrdersIndex({ rows, vendors, openDisputes }: { rows: AdminOrderRow[]; vendors: { id: string; name: string }[]; openDisputes: number }) {
  const { t, locale } = useI18n();
  const pathname = usePathname();
  const params = useSearchParams();

  const view = asOrderView(params.get("view"));
  const sort = asSort(params.get("sort"));
  const vendorId = params.get("vendor");
  const [query, setQuery] = useState(params.get("q") ?? "");

  const setParam = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    const qs = next.toString();
    // Filtering is client-side (the page does not read searchParams), so update the URL without a
    // server round trip; a pending router.replace could otherwise race a row-link navigation.
    window.history.replaceState(null, "", `${pathname}${qs ? `?${qs}` : ""}`);
  };

  const counts = useMemo(() => countByOrderView(rows), [rows]);
  const shown = useMemo(() => filterOrders(rows, { view, query, vendorId, sort }), [rows, view, query, vendorId, sort]);
  const vendorName = vendors.find((v) => v.id === vendorId)?.name;
  const applied: AppliedFilter[] = vendorId && vendorName ? [{ key: "vendor", label: t("admin.orders.appliedVendor", { name: vendorName }), onRemove: () => setParam({ vendor: null }) }] : [];
  const filtered = Boolean(query || vendorId || view !== "all");
  const clearAll = () => {
    setQuery("");
    setParam({ q: null, vendor: null, view: null });
  };

  return (
    <Page fullWidth title={t("admin.orders.title")} titleIcon={ClipboardList}>
      <BlockStack gap="400">
        <MetricsStrip
          accessibilityLabel={t("admin.orders.metricsLabel")}
          metrics={[
            { label: t("admin.orders.metrics.total"), value: formatNumber(counts.all) },
            { label: t("admin.orders.metrics.attention"), value: formatNumber(counts.attention) },
            { label: t("admin.orders.metrics.qc"), value: formatNumber(counts.qc) },
            { label: t("admin.orders.metrics.disputes"), value: formatNumber(openDisputes) },
          ]}
        />
        <div id="admin-orders-table">
          <IndexTable
            resourceName={{ singular: t("admin.orders.resourceSingular"), plural: t("admin.orders.resourcePlural") }}
            caption={t("admin.orders.title")}
            rowIds={shown.map((r) => r.id)}
            headings={[
              { title: t("admin.orders.columns.order") },
              { title: t("admin.orders.columns.date") },
              { title: t("admin.orders.columns.buyer") },
              { title: t("admin.orders.columns.vendor") },
              { title: t("admin.orders.columns.total"), alignment: "end" },
              { title: t("admin.orders.columns.margin"), alignment: "end" },
              { title: t("admin.orders.columns.payment") },
              { title: t("admin.orders.columns.status") },
            ]}
            toolbar={
              <IndexFilters
                views={ORDER_VIEWS.map((v) => ({ id: `orders-view-${v}`, panelID: "admin-orders-table", content: t(`admin.orders.views.${v}` as DictKey), badge: counts[v] > 0 ? formatNumber(counts[v]) : undefined }))}
                selectedView={ORDER_VIEWS.indexOf(view)}
                onSelectView={(i) => setParam({ view: ORDER_VIEWS[i] === "all" ? null : ORDER_VIEWS[i]! })}
                queryValue={query}
                onQueryChange={(v) => {
                  setQuery(v);
                  setParam({ q: v.trim() || null });
                }}
                queryPlaceholder={t("admin.orders.search")}
                filterLabel={t("admin.common.filters")}
                filters={
                  <Select
                    label={t("admin.orders.vendor")}
                    value={vendorId ?? ""}
                    onChange={(v) => setParam({ vendor: v || null })}
                    options={[{ label: t("admin.orders.anyVendor"), value: "" }, ...vendors.map((v) => ({ label: v.name, value: v.id }))]}
                  />
                }
                appliedFilters={applied}
                sortLabel={t("admin.common.sortLabel")}
                sortOptions={ORDER_SORTS.map((s) => ({ label: t(`admin.orders.sort.${s}` as DictKey), value: s }))}
                sortSelected={sort}
                onSort={(v) => setParam({ sort: v === "newest" ? null : v })}
              />
            }
            emptyState={
              <EmptyState
                heading={filtered ? t("admin.orders.emptyFilteredTitle") : t("admin.orders.emptyTitle")}
                image={<EmptyBoxIllustration size={96} />}
                compact
                action={filtered ? <Button onClick={clearAll}>{t("admin.common.clearFilters")}</Button> : undefined}
              >
                {filtered ? t("admin.orders.emptyFilteredBody") : t("admin.orders.emptyBody")}
              </EmptyState>
            }
            footer={
              shown.length ? (
                <Text as="p" tone="subdued" alignment="center" variant="bodySm">
                  {t("admin.common.count", { count: formatNumber(shown.length) })}
                </Text>
              ) : undefined
            }
          >
            {shown.map((r) => (
              <IndexTableRow key={r.id} id={r.id} tone={r.status === "CANCELLED" || r.status === "REFUNDED" ? "subdued" : undefined}>
                <IndexTableCell>
                  <InlineStack gap="150" blockAlign="center" wrap={false}>
                    <IndexTableRowLink url={`/${locale}/admin/orders/${r.number}`}>
                      <bdi>{r.number}</bdi>
                    </IndexTableRowLink>
                    {r.openDispute ? (
                      <Badge tone="critical" size="small">
                        {t("admin.orders.dispute")}
                      </Badge>
                    ) : null}
                    {r.reprint ? (
                      <Badge tone="info" size="small">
                        {t("admin.orders.reprint")}
                      </Badge>
                    ) : null}
                  </InlineStack>
                  {/* Phones: the table scrolls sideways, so status and total also sit under the number. */}
                  <div className={adminStyles.PhoneOnly}>
                    <InlineStack gap="200" blockAlign="center">
                      <OrderStatusBadge status={r.status} />
                      <Text as="span" variant="bodySm" numeric>
                        <bdi>{formatMoney(r.totalPiasters, locale, { alwaysDecimals: true })}</bdi>
                      </Text>
                    </InlineStack>
                  </div>
                </IndexTableCell>
                <IndexTableCell>
                  <time dateTime={r.placedAt}>{formatDate(r.placedAt, locale, "medium")}</time>
                </IndexTableCell>
                <IndexTableCell>{r.buyerName ? <bdi>{r.buyerName}</bdi> : <bdi dir="ltr">{r.buyerPhone}</bdi>}</IndexTableCell>
                <IndexTableCell>{r.vendorName}</IndexTableCell>
                <IndexTableCell alignment="end" numeric>
                  {formatMoney(r.totalPiasters, locale, { alwaysDecimals: true })}
                </IndexTableCell>
                <IndexTableCell alignment="end" numeric>
                  {formatMoney(r.marginPiasters, locale, { alwaysDecimals: true })}
                </IndexTableCell>
                <IndexTableCell>
                  {r.paymentStatus ? (
                    <Badge tone={r.paymentStatus === "PAID" ? "neutral" : r.paymentStatus === "REFUNDED" ? "critical" : "warning"} progress={r.paymentStatus === "PAID" ? "complete" : "incomplete"}>
                      {t(`admin.orders.paymentStatus.${r.paymentStatus}` as DictKey)}
                    </Badge>
                  ) : (
                    t("admin.common.none")
                  )}
                </IndexTableCell>
                <IndexTableCell>
                  <OrderStatusBadge status={r.status} />
                </IndexTableCell>
              </IndexTableRow>
            ))}
          </IndexTable>
        </div>
      </BlockStack>
    </Page>
  );
}
