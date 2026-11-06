"use client";

import { History } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge, BlockStack, EmptyBoxIllustration, EmptyState, IndexFilters, IndexTable, IndexTableCell, IndexTableRow, InlineGrid, Page, Select, Text, type AppliedFilter } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import type { DictKey } from "@/i18n";
import { formatDateTime, formatNumber } from "@/lib/format";
import { AUDIT_ACTIONS } from "./lib/audit";
import { adminStyles } from "./charts";

export interface AuditRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string | null;
  actorPhone: string | null;
  ip: string | null;
  createdAt: string;
  before: string | null;
  after: string | null;
}

const ENTITIES = ["ORDER", "VENDOR", "VENDOR_APPLICATION", "DISPUTE", "USER", "DATA_REQUEST", "STRUCTURE", "MATERIAL", "FINISH", "SETTINGS", "PAYOUT"] as const;

/** Append-only admin audit log with record-type and action filters (state in the URL). */
export function AuditIndex({ rows }: { rows: AuditRow[] }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, start] = useTransition();
  const entity = params.get("entity") ?? "";
  const action = params.get("action") ?? "";
  const [query, setQuery] = useState(params.get("q") ?? "");
  const setParam = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (!v) next.delete(k);
      else next.set(k, v);
    }
    const qs = next.toString();
    start(() => router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false }));
  };
  const applied: AppliedFilter[] = [];
  if (entity) applied.push({ key: "entity", label: `${t("admin.audit.entity")}: ${t(`admin.audit.entities.${entity}` as DictKey)}`, onRemove: () => setParam({ entity: null }) });
  if (action) applied.push({ key: "action", label: `${t("admin.audit.action")}: ${t(`admin.audit.actions.${action}` as DictKey)}`, onRemove: () => setParam({ action: null }) });

  return (
    <Page fullWidth title={t("admin.audit.title")} titleIcon={History} subtitle={t("admin.audit.subtitle")}>
      <IndexTable
        resourceName={{ singular: t("admin.audit.resourceSingular"), plural: t("admin.audit.resourcePlural") }}
        caption={t("admin.audit.title")}
        rowIds={rows.map((r) => r.id)}
        toolbar={
          <IndexFilters
            queryValue={query}
            onQueryChange={(v) => {
              setQuery(v);
              setParam({ q: v.trim() || null });
            }}
            queryPlaceholder={t("admin.audit.search")}
            filterLabel={t("admin.common.filters")}
            filters={
              <InlineGrid columns={1} gap="300">
                <Select
                  label={t("admin.audit.entity")}
                  value={entity}
                  onChange={(v) => setParam({ entity: v || null })}
                  options={[{ label: t("admin.audit.any"), value: "" }, ...ENTITIES.map((e) => ({ label: t(`admin.audit.entities.${e}` as DictKey), value: e }))]}
                />
                <Select
                  label={t("admin.audit.action")}
                  value={action}
                  onChange={(v) => setParam({ action: v || null })}
                  options={[{ label: t("admin.audit.any"), value: "" }, ...AUDIT_ACTIONS.map((a) => ({ label: t(`admin.audit.actions.${a}` as DictKey), value: a }))]}
                />
              </InlineGrid>
            }
            appliedFilters={applied}
          />
        }
        headings={[{ title: t("admin.audit.columns.time") }, { title: t("admin.audit.columns.action") }, { title: t("admin.audit.columns.entity") }, { title: t("admin.audit.columns.summary") }, { title: t("admin.audit.columns.actor") }]}
        emptyState={
          <EmptyState heading={t("admin.audit.empty")} image={<EmptyBoxIllustration size={96} />} compact>
            {t("admin.audit.emptyBody")}
          </EmptyState>
        }
        footer={rows.length ? <span>{t("admin.common.count", { count: formatNumber(rows.length) })}</span> : undefined}
      >
        {rows.map((r) => (
          <IndexTableRow key={r.id} id={r.id}>
            <IndexTableCell>
              <time dateTime={r.createdAt}>{formatDateTime(r.createdAt, locale)}</time>
            </IndexTableCell>
            <IndexTableCell>
              <Badge tone={r.action.includes("REFUND") || r.action.includes("REJECT") || r.action.includes("SUSPEND") || r.action.includes("ANONYMISE") ? "critical" : "neutral"}>
                {t(`admin.audit.actions.${r.action}` as DictKey)}
              </Badge>
            </IndexTableCell>
            <IndexTableCell>{t(`admin.audit.entities.${r.entityType}` as DictKey)}</IndexTableCell>
            <IndexTableCell>
              <BlockStack gap="100">
                <Text as="span">
                  <span className={adminStyles.PreWrap}>{r.summary ?? t("admin.common.none")}</span>
                </Text>
                {r.before || r.after ? (
                  <details>
                    <summary>
                      <Text as="span" variant="bodySm" tone="subdued">
                        {t("admin.audit.showChanges")}
                      </Text>
                    </summary>
                    <BlockStack gap="100">
                      {r.before ? (
                        <>
                          <Text as="span" variant="bodySm" fontWeight="semibold">
                            {t("admin.common.before")}
                          </Text>
                          <pre className={adminStyles.Json}>{r.before}</pre>
                        </>
                      ) : null}
                      {r.after ? (
                        <>
                          <Text as="span" variant="bodySm" fontWeight="semibold">
                            {t("admin.common.after")}
                          </Text>
                          <pre className={adminStyles.Json}>{r.after}</pre>
                        </>
                      ) : null}
                    </BlockStack>
                  </details>
                ) : null}
              </BlockStack>
            </IndexTableCell>
            <IndexTableCell>
              <bdi dir="ltr">{r.actorPhone ?? t("admin.common.none")}</bdi>
            </IndexTableCell>
          </IndexTableRow>
        ))}
      </IndexTable>
    </Page>
  );
}
