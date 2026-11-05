"use client";

import { Users } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge, EmptyBoxIllustration, EmptyState, IndexFilters, IndexTable, IndexTableCell, IndexTableRow, IndexTableRowLink, Page, Select } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import type { DictKey } from "@/i18n";
import { formatDate, formatNumber } from "@/lib/format";
import { maskPhone } from "./lib/ops";

export interface UserRow {
  id: string;
  name: string;
  phone: string;
  role: string;
  marketingConsent: boolean;
  createdAt: string;
  orders: number;
  consents: number;
}

const ROLES = ["BUYER", "VENDOR", "ADMIN"] as const;

export function UsersIndex({ rows }: { rows: UserRow[] }) {
  const { t, locale } = useI18n();
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("");
  const q = query.trim().toLowerCase();
  const shown = useMemo(() => rows.filter((r) => (!role || r.role === role) && (!q || r.name.toLowerCase().includes(q) || r.phone.includes(q.replace(/^0/, "")))), [rows, q, role]);

  return (
    <Page fullWidth title={t("admin.users.title")} titleIcon={Users}>
      <IndexTable
        resourceName={{ singular: t("admin.users.resourceSingular"), plural: t("admin.users.resourcePlural") }}
        caption={t("admin.users.title")}
        rowIds={shown.map((r) => r.id)}
        toolbar={
          <IndexFilters
            queryValue={query}
            onQueryChange={setQuery}
            queryPlaceholder={t("admin.users.search")}
            filterLabel={t("admin.common.filters")}
            filters={
              <Select
                label={t("admin.users.roleFilter")}
                value={role}
                onChange={setRole}
                options={[{ label: t("admin.users.anyRole"), value: "" }, ...ROLES.map((r) => ({ label: t(`admin.users.roles.${r}` as DictKey), value: r }))]}
              />
            }
            appliedFilters={role ? [{ key: "role", label: `${t("admin.users.roleFilter")}: ${t(`admin.users.roles.${role}` as DictKey)}`, onRemove: () => setRole("") }] : []}
          />
        }
        headings={[
          { title: t("admin.users.columns.name") },
          { title: t("admin.users.columns.phone") },
          { title: t("admin.users.columns.role") },
          { title: t("admin.users.columns.marketing") },
          { title: t("admin.users.columns.orders"), alignment: "end" },
          { title: t("admin.users.columns.joined") },
        ]}
        emptyState={<EmptyState heading={query || role ? t("admin.users.emptyFiltered") : t("admin.users.empty")} image={<EmptyBoxIllustration size={96} />} compact />}
        footer={
          shown.length ? (
            <span>{t("admin.common.count", { count: formatNumber(shown.length) })}</span>
          ) : undefined
        }
      >
        {shown.map((r) => (
          <IndexTableRow key={r.id} id={r.id} tone={r.phone.startsWith("deleted:") ? "subdued" : undefined}>
            <IndexTableCell>
              <IndexTableRowLink url={`/${locale}/admin/users/${r.id}`}>{r.name || t("admin.users.noName")}</IndexTableRowLink>
            </IndexTableCell>
            <IndexTableCell>
              <bdi dir="ltr">{maskPhone(r.phone)}</bdi>
            </IndexTableCell>
            <IndexTableCell>
              <Badge tone={r.role === "ADMIN" ? "magic" : r.role === "VENDOR" ? "info" : "neutral"}>{t(`admin.users.roles.${r.role}` as DictKey)}</Badge>
            </IndexTableCell>
            <IndexTableCell>{r.marketingConsent ? t("admin.users.marketingOn") : t("admin.users.marketingOff")}</IndexTableCell>
            <IndexTableCell alignment="end" numeric>
              {formatNumber(r.orders)}
            </IndexTableCell>
            <IndexTableCell>
              <time dateTime={r.createdAt}>{formatDate(r.createdAt, locale, "medium")}</time>
            </IndexTableCell>
          </IndexTableRow>
        ))}
      </IndexTable>
    </Page>
  );
}
