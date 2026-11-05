"use client";

import { Factory } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  Badge,
  Box,
  EmptyBoxIllustration,
  EmptyState,
  IndexFilters,
  IndexTable,
  IndexTableCell,
  IndexTableRow,
  IndexTableRowLink,
  InlineStack,
  Page,
  Text,
} from "@/components/ui";
import { useI18n } from "@/i18n/client";
import type { DictKey } from "@/i18n";
import { formatDate, formatNumber, formatPercent } from "@/lib/format";
import type { VendorRow } from "./server/queries";

const TABS = ["vendors", "applications"] as const;

export function VendorStatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  return (
    <Badge tone={status === "ACTIVE" ? "success" : status === "SUSPENDED" ? "critical" : "attention"} progress={status === "ACTIVE" ? "complete" : "incomplete"}>
      {t(`admin.vendors.statuses.${status}` as DictKey)}
    </Badge>
  );
}

export function ApplicationStatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const tone = status === "APPROVED" ? "success" : status === "REJECTED" ? "critical" : status === "UNDER_REVIEW" ? "info" : "attention";
  return (
    <Badge tone={tone} progress={status === "APPROVED" || status === "REJECTED" ? "complete" : status === "UNDER_REVIEW" ? "partiallyComplete" : "incomplete"}>
      {t(`admin.vendors.applications.statuses.${status}` as DictKey)}
    </Badge>
  );
}

export function VendorsIndex({
  vendors,
  applications,
}: {
  vendors: VendorRow[];
  applications: { id: string; vendorId: string; legalName: string; factoryCity: string; status: string; createdAt: string }[];
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, start] = useTransition();
  const tab = params.get("tab") === "applications" ? "applications" : "vendors";
  const [query, setQuery] = useState("");
  const pct = (n: number | null) => (n === null ? t("admin.common.none") : formatPercent(n, locale));
  const openApps = applications.filter((a) => a.status === "SUBMITTED" || a.status === "UNDER_REVIEW").length;

  const q = query.trim().toLowerCase();
  const vendorRows = useMemo(
    () => vendors.filter((v) => !q || v.nameAr.toLowerCase().includes(q) || v.nameEn.toLowerCase().includes(q) || v.slug.includes(q)),
    [vendors, q],
  );
  const appRows = useMemo(() => applications.filter((a) => !q || a.legalName.toLowerCase().includes(q)), [applications, q]);

  const toolbar = (
    <IndexFilters
      views={TABS.map((v) => ({
        id: `vendors-tab-${v}`,
        content: t(`admin.vendors.tabs.${v}` as DictKey),
        badge: v === "applications" && openApps > 0 ? formatNumber(openApps) : v === "vendors" ? formatNumber(vendors.length) : undefined,
      }))}
      selectedView={TABS.indexOf(tab)}
      onSelectView={(i) => start(() => router.replace(`${pathname}${TABS[i] === "applications" ? "?tab=applications" : ""}`, { scroll: false }))}
      queryValue={query}
      onQueryChange={setQuery}
      queryPlaceholder={t("admin.vendors.search")}
    />
  );

  return (
    <Page fullWidth title={t("admin.vendors.title")} titleIcon={Factory}>
      {tab === "vendors" ? (
        <IndexTable
          resourceName={{ singular: t("admin.vendors.resourceSingular"), plural: t("admin.vendors.resourcePlural") }}
          caption={t("admin.vendors.title")}
          rowIds={vendorRows.map((v) => v.id)}
          toolbar={toolbar}
          headings={[
            { title: t("admin.vendors.columns.vendor") },
            { title: t("admin.vendors.columns.city") },
            { title: t("admin.vendors.columns.status") },
            { title: t("admin.vendors.columns.orders"), alignment: "end" },
            { title: t("admin.vendors.columns.onTime"), alignment: "end" },
            { title: t("admin.vendors.columns.reprint"), alignment: "end" },
            { title: t("admin.vendors.columns.rating"), alignment: "end" },
            { title: t("admin.vendors.columns.health"), alignment: "end" },
          ]}
          emptyState={
            <EmptyState heading={t("admin.vendors.empty")} image={<EmptyBoxIllustration size={96} />} compact>
              {t("admin.vendors.emptyBody")}
            </EmptyState>
          }
        >
          {vendorRows.map((v) => (
            <IndexTableRow key={v.id} id={v.id} tone={v.status === "SUSPENDED" ? "subdued" : undefined}>
              <IndexTableCell>
                <InlineStack gap="150" blockAlign="center" wrap={false}>
                  <IndexTableRowLink url={`/${locale}/admin/vendors/${v.slug}`}>{locale === "ar" ? v.nameAr : v.nameEn}</IndexTableRowLink>
                  {v.verified ? (
                    <Badge tone="info" size="small">
                      {t("admin.vendors.verified")}
                    </Badge>
                  ) : null}
                </InlineStack>
              </IndexTableCell>
              <IndexTableCell>{t(`cities.${v.city}` as DictKey)}</IndexTableCell>
              <IndexTableCell>
                <VendorStatusBadge status={v.status} />
              </IndexTableCell>
              <IndexTableCell alignment="end" numeric>
                {formatNumber(v.score.orders)}
              </IndexTableCell>
              <IndexTableCell alignment="end" numeric>
                {pct(v.score.onTimePct)}
              </IndexTableCell>
              <IndexTableCell alignment="end" numeric>
                {pct(v.score.reprintPct)}
              </IndexTableCell>
              <IndexTableCell alignment="end" numeric>
                {v.score.rating === null ? t("admin.common.none") : formatNumber(v.score.rating, 1)}
              </IndexTableCell>
              <IndexTableCell alignment="end" numeric>
                {v.score.health === null ? t("admin.common.none") : formatNumber(v.score.health)}
              </IndexTableCell>
            </IndexTableRow>
          ))}
        </IndexTable>
      ) : (
        <IndexTable
          resourceName={{ singular: t("admin.vendors.applications.resourceSingular"), plural: t("admin.vendors.applications.resourcePlural") }}
          caption={t("admin.vendors.tabs.applications")}
          rowIds={appRows.map((a) => a.id)}
          toolbar={toolbar}
          headings={[
            { title: t("admin.vendors.applications.columns.company") },
            { title: t("admin.vendors.applications.columns.city") },
            { title: t("admin.vendors.applications.columns.submitted") },
            { title: t("admin.vendors.applications.columns.status") },
          ]}
          emptyState={
            <EmptyState heading={t("admin.vendors.applications.empty")} image={<EmptyBoxIllustration size={96} />} compact>
              {t("admin.vendors.applications.emptyBody")}
            </EmptyState>
          }
        >
          {appRows.map((a) => (
            <IndexTableRow key={a.id} id={a.id}>
              <IndexTableCell>
                <IndexTableRowLink url={`/${locale}/admin/vendors/applications/${a.id}`}>{a.legalName}</IndexTableRowLink>
              </IndexTableCell>
              <IndexTableCell>{t(`cities.${a.factoryCity}` as DictKey)}</IndexTableCell>
              <IndexTableCell>
                <time dateTime={a.createdAt}>{formatDate(a.createdAt, locale, "medium")}</time>
              </IndexTableCell>
              <IndexTableCell>
                <ApplicationStatusBadge status={a.status} />
              </IndexTableCell>
            </IndexTableRow>
          ))}
        </IndexTable>
      )}
      {tab === "vendors" ? (
        <Box paddingBlockStart="300" paddingInline={{ xs: "400", md: "0" }}>
          <Text as="p" variant="bodySm" tone="subdued" alignment="center">
            {t("admin.vendors.columns.health")}: {t("admin.vendors.scorecard.healthHelp")}
          </Text>
        </Box>
      ) : null}
    </Page>
  );
}
