"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import type { Locale, OrderStatus } from "@/types";
import { useI18n } from "@/i18n/client";
import type { DictKey } from "@/i18n";
import { paymentTone, statusTone } from "@/lib/orders/status-tone";
import {
  Badge,
  Card,
  EmptyBoxIllustration,
  Icon,
  EmptyState,
  IndexFilters,
  IndexTable,
  IndexTableCell,
  IndexTableRow,
  IndexTableRowLink,
  PriceTag,
  Text,
} from "@/components/ui";
import styles from "./orders.module.css";

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

  const filters = (
    <IndexFilters
      views={VIEWS.map((v) => ({ id: `orders-view-${v.id}`, content: t(`orders.views.${v.id}` as DictKey) }))}
      selectedView={view}
      onSelectView={setView}
      queryValue={q}
      onQueryChange={setQ}
      onQueryClear={() => setQ("")}
      queryPlaceholder={t("orders.searchPlaceholder")}
    />
  );
  const payBadge = (r: OrderRow) => (
    <Badge tone={paymentTone(r.paymentStatus).tone} progress={paymentTone(r.paymentStatus).progress}>
      {t(`payment.status.${r.paymentStatus}` as DictKey)}
    </Badge>
  );

  return (
    <>
    {/* Phones: one card per order, so status and total are never clipped off-screen. */}
    <div className={styles.phoneOnly}>
      <Card padding="0">
        {filters}
        {visible.length === 0 ? (
          <EmptyState compact heading={t("orders.noResults")} image={<EmptyBoxIllustration size={80} />} />
        ) : (
          <ul className={styles.cards} aria-label={t("orders.title")}>
            {visible.map((r) => {
              const b = statusTone(r.status);
              return (
                <li key={r.id}>
                  <Link href={`/${locale}/orders/${r.id}`} className={styles.cardRow} data-cancelled={r.status === "CANCELLED" || undefined}>
                    <span className={styles.cardMain}>
                      <span className={styles.cardTop}>
                        <Text as="span" fontWeight="semibold">
                          <bdi>{r.number}</bdi>
                        </Text>
                        <PriceTag amount={r.totalPiasters} locale={locale} alwaysDecimals />
                      </span>
                      <Text as="span" variant="bodySm" tone="subdued">
                        {r.placedLabel} · {r.vendor} · {t("orders.boxes", { qty: r.quantity.toLocaleString("en-US") })}
                      </Text>
                      <span className={styles.cardBadges}>
                        <Badge tone={b.tone} progress={b.progress}>
                          {r.status === "PAID" ? t("buyer.awaitingPrinter") : t(`orderStatus.${r.status}` as DictKey)}
                        </Badge>
                        {r.paymentStatus === "REFUNDED" ? payBadge(r) : null}
                      </span>
                    </span>
                    <span className={styles.chev} aria-hidden="true">
                      <Icon source={ChevronRight} size="small" tone="subdued" />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
    <div className={styles.wideOnly}>
    <IndexTable
      resourceName={{ singular: t("orders.resource.singular"), plural: t("orders.resource.plural") }}
      caption={t("orders.title")}
      toolbar={filters}
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
        const b = statusTone(r.status);
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
              <PriceTag amount={r.totalPiasters} locale={locale} alwaysDecimals />
            </IndexTableCell>
            <IndexTableCell>{payBadge(r)}</IndexTableCell>
            <IndexTableCell>
              <Badge tone={b.tone} progress={b.progress}>
                {r.status === "PAID" ? t("buyer.awaitingPrinter") : t(`orderStatus.${r.status}` as DictKey)}
              </Badge>
            </IndexTableCell>
          </IndexTableRow>
        );
      })}
    </IndexTable>
    </div>
    </>
  );
}
