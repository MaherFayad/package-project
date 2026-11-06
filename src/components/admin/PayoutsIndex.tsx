"use client";

import { Wallet } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { BlockStack, EmptyBoxIllustration, EmptyState, IndexFilters, IndexTable, IndexTableCell, IndexTableRow, IndexTableRowLink, InlineStack, MetricsStrip, Page, Text } from "@/components/ui";
import { adminStyles } from "./charts";
import { useI18n } from "@/i18n/client";
import type { DictKey } from "@/i18n";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { asPayoutView, inPayoutView, nextPayoutStep, PAYOUT_VIEWS } from "./lib/payouts";
import { PayoutStatusBadge, PayoutStepButton } from "./PayoutActions";
import type { AdminPayoutRow } from "./server/queries";

/** Vendor payouts: what ops must raise, approve or pay, then what is scheduled and what is paid. */
export function PayoutsIndex({ rows }: { rows: AdminPayoutRow[] }) {
  const { t, locale } = useI18n();
  const pathname = usePathname();
  const params = useSearchParams();
  const [view, setView] = useState(asPayoutView(params.get("view")));
  const [query, setQuery] = useState(params.get("q") ?? "");
  const setParam = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    const qs = next.toString();
    window.history.replaceState(null, "", `${pathname}${qs ? `?${qs}` : ""}`);
  };

  const counts = useMemo(() => Object.fromEntries(PAYOUT_VIEWS.map((v) => [v, rows.filter((r) => inPayoutView(r, v)).length])) as Record<(typeof PAYOUT_VIEWS)[number], number>, [rows]);
  const sum = (pred: (r: AdminPayoutRow) => boolean) => rows.filter(pred).reduce((s, r) => s + r.amountPiasters, 0);
  const q = query.trim().toLowerCase();
  const shown = rows.filter((r) => inPayoutView(r, view) && (!q || (r.orderNumber ?? "").toLowerCase().includes(q) || r.vendorName.toLowerCase().includes(q)));

  return (
    <Page fullWidth title={t("admin.payouts.title")} titleIcon={Wallet} subtitle={t("admin.payouts.subtitle")}>
      <BlockStack gap="400">
        <MetricsStrip
          accessibilityLabel={t("admin.payouts.metricsLabel")}
          metrics={[
            { label: t("admin.payouts.metrics.toApprove"), value: formatMoney(sum((r) => r.status === "PENDING" || r.status === "ON_HOLD"), locale, { alwaysDecimals: true }) },
            { label: t("admin.payouts.metrics.toPay"), value: formatMoney(sum((r) => r.status === "APPROVED"), locale, { alwaysDecimals: true }) },
            { label: t("admin.payouts.metrics.scheduled"), value: formatMoney(sum((r) => r.status === "SCHEDULED"), locale, { alwaysDecimals: true }) },
            { label: t("admin.payouts.metrics.paid"), value: formatMoney(sum((r) => r.status === "PAID"), locale, { alwaysDecimals: true }) },
          ]}
        />
        <div id="admin-payouts-table">
          <IndexTable
            resourceName={{ singular: t("admin.payouts.resourceSingular"), plural: t("admin.payouts.resourcePlural") }}
            caption={t("admin.payouts.title")}
            rowIds={shown.map((r) => r.key)}
            headings={[
              { title: t("admin.payouts.columns.order") },
              { title: t("admin.payouts.columns.vendor") },
              { title: t("admin.payouts.columns.part") },
              { title: t("admin.payouts.columns.amount"), alignment: "end" },
              { title: t("admin.payouts.columns.status") },
              { title: t("admin.payouts.columns.next"), alignment: "end" },
            ]}
            toolbar={
              <IndexFilters
                views={PAYOUT_VIEWS.map((v) => ({ id: `payouts-view-${v}`, panelID: "admin-payouts-table", content: t(`admin.payouts.views.${v}` as DictKey), badge: v !== "all" && counts[v] > 0 ? formatNumber(counts[v]) : undefined }))}
                selectedView={PAYOUT_VIEWS.indexOf(view)}
                onSelectView={(i) => {
                  const v = PAYOUT_VIEWS[i]!;
                  setView(v);
                  setParam({ view: v === "todo" ? null : v });
                }}
                queryValue={query}
                onQueryChange={(v) => {
                  setQuery(v);
                  setParam({ q: v.trim() || null });
                }}
                queryPlaceholder={t("admin.payouts.search")}
              />
            }
            emptyState={
              <EmptyState heading={view === "todo" && !q ? t("admin.payouts.emptyTodo") : t("admin.payouts.empty")} image={<EmptyBoxIllustration size={96} />} compact>
                {view === "todo" && !q ? t("admin.payouts.emptyTodoBody") : t("admin.payouts.emptyBody")}
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
            {shown.map((r) => {
              const step = nextPayoutStep(r, r.orderStatus, r.openDispute);
              return (
                <IndexTableRow key={r.key} id={r.key}>
                  <IndexTableCell>
                    <BlockStack gap="100">
                      <IndexTableRowLink url={`/${locale}/admin/orders/${r.orderNumber}`}>
                        <bdi>{r.orderNumber}</bdi>
                      </IndexTableRowLink>
                      {/* Phones: the table scrolls, so the part, amount, status and next step sit in the first cell too. */}
                      <div className={adminStyles.PhoneOnly}>
                        <BlockStack gap="150">
                          <Text as="span" variant="bodySm" tone="subdued">
                            {t(`admin.payouts.kinds.${r.kind}` as DictKey)} · <bdi>{formatMoney(r.amountPiasters, locale, { alwaysDecimals: true })}</bdi>
                          </Text>
                          <InlineStack gap="200" blockAlign="center">
                            <PayoutStatusBadge status={r.status} />
                            {step && r.orderId && r.orderNumber ? <PayoutStepButton orderId={r.orderId} orderNumber={r.orderNumber} kind={r.kind} step={step} amountPiasters={r.amountPiasters} vendorName={r.vendorName} size="slim" /> : null}
                          </InlineStack>
                        </BlockStack>
                      </div>
                    </BlockStack>
                  </IndexTableCell>
                  <IndexTableCell>{r.vendorName}</IndexTableCell>
                  <IndexTableCell>
                    <BlockStack gap="050">
                      <Text as="span">{t(`admin.payouts.kinds.${r.kind}` as DictKey)}</Text>
                      <Text as="span" variant="bodySm" tone="subdued">
                        {r.date ? formatDate(r.date, locale, "medium") : t(`admin.payouts.trigger.${r.kind}` as DictKey)}
                      </Text>
                    </BlockStack>
                  </IndexTableCell>
                  <IndexTableCell alignment="end" numeric>
                    {formatMoney(r.amountPiasters, locale, { alwaysDecimals: true })}
                  </IndexTableCell>
                  <IndexTableCell>
                    <PayoutStatusBadge status={r.status} />
                  </IndexTableCell>
                  <IndexTableCell alignment="end">
                    {step && r.orderId && r.orderNumber ? (
                      <span className={adminStyles.DesktopOnly}>
                      <PayoutStepButton orderId={r.orderId} orderNumber={r.orderNumber} kind={r.kind} step={step} amountPiasters={r.amountPiasters} vendorName={r.vendorName} size="slim" />
                      </span>
                    ) : (
                      <Text as="span" tone="subdued" variant="bodySm">
                        {r.openDispute && r.kind === "BALANCE" && r.status !== "PAID" ? t("admin.payouts.disputeHold") : t("admin.common.none")}
                      </Text>
                    )}
                  </IndexTableCell>
                </IndexTableRow>
              );
            })}
          </IndexTable>
        </div>
      </BlockStack>
    </Page>
  );
}
