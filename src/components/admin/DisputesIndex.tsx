"use client";

import { Gavel } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Badge, EmptyBoxIllustration, EmptyState, IndexFilters, IndexTable, IndexTableCell, IndexTableRow, IndexTableRowLink, Page } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import type { DictKey } from "@/i18n";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { asDisputeView, DISPUTE_VIEWS, inDisputeView, isOpenDispute } from "./lib/ops";

export interface DisputeRow {
  id: string;
  reason: string;
  status: string;
  createdAt: string;
  orderNumber: string;
  totalPiasters: number;
  vendorNameAr: string;
  vendorNameEn: string;
  buyerName: string;
}

export function DisputeStatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const open = isOpenDispute(status);
  return (
    <Badge tone={status === "OPEN" ? "attention" : status === "UNDER_REVIEW" ? "info" : status === "REJECTED" ? "neutral" : "success"} progress={open ? (status === "OPEN" ? "incomplete" : "partiallyComplete") : "complete"}>
      {t(`admin.disputes.statuses.${status}` as DictKey)}
    </Badge>
  );
}

export function DisputesIndex({ rows }: { rows: DisputeRow[] }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, start] = useTransition();
  const view = asDisputeView(params.get("view"));
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () => rows.filter((r) => inDisputeView(r.status, view) && (!q || r.orderNumber.toLowerCase().includes(q) || r.buyerName.toLowerCase().includes(q))),
    [rows, view, q],
  );
  const counts = Object.fromEntries(DISPUTE_VIEWS.map((v) => [v, rows.filter((r) => inDisputeView(r.status, v)).length])) as Record<(typeof DISPUTE_VIEWS)[number], number>;

  return (
    <Page fullWidth title={t("admin.disputes.title")} titleIcon={Gavel}>
      <IndexTable
        resourceName={{ singular: t("admin.disputes.resourceSingular"), plural: t("admin.disputes.resourcePlural") }}
        caption={t("admin.disputes.title")}
        rowIds={shown.map((r) => r.id)}
        toolbar={
          <IndexFilters
            views={DISPUTE_VIEWS.map((v) => ({ id: `disputes-${v}`, content: t(`admin.disputes.views.${v}` as DictKey), badge: counts[v] ? formatNumber(counts[v]) : undefined }))}
            selectedView={DISPUTE_VIEWS.indexOf(view)}
            onSelectView={(i) => start(() => router.replace(`${pathname}${DISPUTE_VIEWS[i] === "open" ? "" : `?view=${DISPUTE_VIEWS[i]}`}`, { scroll: false }))}
            queryValue={query}
            onQueryChange={setQuery}
            queryPlaceholder={t("admin.orders.search")}
          />
        }
        headings={[
          { title: t("admin.disputes.columns.order") },
          { title: t("admin.disputes.columns.reason") },
          { title: t("admin.disputes.columns.buyer") },
          { title: t("admin.disputes.columns.vendor") },
          { title: t("admin.disputes.columns.opened") },
          { title: t("admin.disputes.columns.value"), alignment: "end" },
          { title: t("admin.disputes.columns.status") },
        ]}
        emptyState={
          <EmptyState heading={t("admin.disputes.empty")} image={<EmptyBoxIllustration size={96} />} compact>
            {t("admin.disputes.emptyBody")}
          </EmptyState>
        }
      >
        {shown.map((r) => (
          <IndexTableRow key={r.id} id={r.id}>
            <IndexTableCell>
              <IndexTableRowLink url={`/${locale}/admin/disputes/${r.id}`}>
                <bdi>{r.orderNumber}</bdi>
              </IndexTableRowLink>
            </IndexTableCell>
            <IndexTableCell>{t(`admin.disputes.reasons.${r.reason}` as DictKey)}</IndexTableCell>
            <IndexTableCell>{r.buyerName || t("admin.users.noName")}</IndexTableCell>
            <IndexTableCell>{locale === "ar" ? r.vendorNameAr : r.vendorNameEn}</IndexTableCell>
            <IndexTableCell>
              <time dateTime={r.createdAt}>{formatDate(r.createdAt, locale, "medium")}</time>
            </IndexTableCell>
            <IndexTableCell alignment="end" numeric>
              {formatMoney(r.totalPiasters, locale)}
            </IndexTableCell>
            <IndexTableCell>
              <DisputeStatusBadge status={r.status} />
            </IndexTableCell>
          </IndexTableRow>
        ))}
      </IndexTable>
    </Page>
  );
}
