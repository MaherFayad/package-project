"use client";

import { useMemo, useState } from "react";
import type { Locale, OrderStatus } from "@/types";
import { useI18n } from "@/i18n/client";
import type { DictKey } from "@/i18n";
import { statusBadge } from "@/lib/orders/state";
import {
  Badge,
  EmptyBoxIllustration,
  EmptyState,
  IndexFilters,
  IndexTable,
  IndexTableCell,
  IndexTableRow,
  IndexTableRowLink,
  PriceTag,
  Text,
} from "@/components/ui";

export interface OrderRow {
  id: string;
  number: string;
  placedAt: string;
  placedLabel: string;
  vendor: string;
  quantity: number;
  totalPiasters: number;
  status: OrderStatus;
  paymentStatus: "PAID" | "PENDING" | "REFUNDED";
}

const VIEWS: { id: string; match: (s: OrderStatus) => boolean }[] = [
  { id: "all", match: () => true },
  { id: "active", match: (s) => ["PAID", "PROOF_APPROVED", "ACCEPTED", "IN_PRODUCTION", "QC_PENDING", "READY_TO_SHIP", "SHIPPED"].includes(s) },
  { id: "unpaid", match: (s) => s === "PENDING_PAYMENT" },
  { id: "done", match: (s) => s === "DELIVERED" },
];

/** Buyer's orders: index table with views + search (screen 07 pattern). */
export function OrdersTable({ rows, locale }: { rows: OrderRow[]; locale: Locale }) {
  const { t } = useI18n();
  const [view, setView] = useState(0);
  const [q, setQ] = useState("");
  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => VIEWS[view].match(r.status) && (!needle || r.number.toLowerCase().includes(needle) || r.vendor.toLowerCase().includes(needle)));
  }, [rows, view, q]);

  return (
    <IndexTable
      resourceName={{ singular: t("orders.resource.singular"), plural: t("orders.resource.plural") }}
      caption={t("orders.title")}
      toolbar={
        <IndexFilters
          views={VIEWS.map((v) => ({ id: `orders-view-${v.id}`, content: t(`orders.views.${v.id}` as DictKey) }))}
          selectedView={view}
          onSelectView={setView}
          queryValue={q}
          onQueryChange={setQ}
          onQueryClear={() => setQ("")}
          queryPlaceholder={t("orders.searchPlaceholder")}
        />
      }
      headings={[
        { title: t("orders.col.order") },
        { title: t("orders.col.date") },
        { title: t("orders.col.printer") },
        { title: t("orders.col.items"), alignment: "end" },
        { title: t("orders.col.total"), alignment: "end" },
        { title: t("orders.col.payment") },
        { title: t("orders.col.status") },
      ]}
      emptyState={
        <EmptyState compact heading={t("orders.noResults")} image={<EmptyBoxIllustration size={80} />} />
      }
    >
      {visible.map((r) => {
        const b = statusBadge(r.status);
        return (
          <IndexTableRow key={r.id} id={r.id} strikethrough={r.status === "CANCELLED"}>
            <IndexTableCell>
              <IndexTableRowLink url={`/${locale}/orders/${r.id}`}>
                <Text as="span" fontWeight="semibold">
                  <bdi>{r.number}</bdi>
                </Text>
              </IndexTableRowLink>
            </IndexTableCell>
            <IndexTableCell>{r.placedLabel}</IndexTableCell>
            <IndexTableCell>{r.vendor}</IndexTableCell>
            <IndexTableCell alignment="end" numeric>
              {r.quantity.toLocaleString("en-US")}
            </IndexTableCell>
            <IndexTableCell alignment="end" numeric>
              <PriceTag amount={r.totalPiasters} locale={locale} />
            </IndexTableCell>
            <IndexTableCell>
              <Badge tone={r.paymentStatus === "PAID" ? "neutral" : r.paymentStatus === "REFUNDED" ? "critical" : "warning"} progress={r.paymentStatus === "PAID" ? "complete" : "incomplete"}>
                {t(`payment.status.${r.paymentStatus}` as DictKey)}
              </Badge>
            </IndexTableCell>
            <IndexTableCell>
              <Badge tone={b.tone} progress={b.progress}>
                {t(`orderStatus.${r.status}` as DictKey)}
              </Badge>
            </IndexTableCell>
          </IndexTableRow>
        );
      })}
    </IndexTable>
  );
}
