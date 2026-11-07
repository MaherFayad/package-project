import { requireAdminPage } from "@/lib/auth/session";
import type { Metadata } from "next";
import { FileLock2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { BlockStack } from "@/components/ui/Stack";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/IndexTable";
import { EmptyBoxIllustration, EmptyState } from "@/components/ui/EmptyState";
import { Link } from "@/components/ui/Link";
import { Page } from "@/components/ui/Page";
import { Text } from "@/components/ui/Text";
import { DataRequestActions } from "@/components/admin/DataRequestActions";
import { loadDataRequests } from "@/components/admin/server/queries";
import { canDecideRequest, maskPhone } from "@/components/admin/lib/ops";
import { getT, toLocale, type DictKey } from "@/i18n";
import type { Locale } from "@/types";
import { formatCount, formatDate } from "@/lib/format";
import styles from "./privacy.module.css";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = getT(toLocale((await params).locale));
  return { title: `${t("admin.privacy.title")} · ${t("admin.title")}` };
}

/** PDPL (Law 151/2020): data-subject requests must be answered within 30 days. */
const RESPONSE_DAYS = 30;

type Row = Awaited<ReturnType<typeof loadDataRequests>>[number];

function statusTone(status: string) {
  return status === "COMPLETED" ? "success" : status === "REJECTED" ? "neutral" : status === "IN_PROGRESS" ? "info" : "attention";
}

export default async function AdminPrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  await requireAdminPage(); // R6-SEC-09: the layout redirect does not stop this page rendering
  const locale: Locale = toLocale((await params).locale);
  const t = getT(locale);
  const rows = await loadDataRequests();
  const now = Date.now();
  const due = (createdAt: string) => {
    const left = Math.ceil((new Date(createdAt).getTime() + RESPONSE_DAYS * 86_400_000 - now) / 86_400_000);
    return left < 0 ? (
      <Badge key="due" tone="critical">{t("admin.privacy.overdue")}</Badge>
    ) : (
      <Text key="due" as="span" tone={left <= 7 ? "caution" : undefined}>
        {t("admin.privacy.dueIn", { days: formatCount(left, "day", locale) })}
      </Text>
    );
  };
  const user = (r: Row) => (
    <BlockStack key="u" gap="0">
      <Link url={`/${locale}/admin/users/${r.userId}`}>{r.userName || t("admin.users.noName")}</Link>
      <Text as="span" variant="bodySm" tone="subdued">
        <bdi dir="ltr" className={styles.phone}>
          {maskPhone(r.userPhone)}
        </bdi>
      </Text>
    </BlockStack>
  );
  const status = (r: Row) => (
    <Badge key="s" tone={statusTone(r.status)} progress={canDecideRequest(r.status) ? "incomplete" : "complete"}>
      {t(`admin.privacy.statuses.${r.status}` as DictKey)}
    </Badge>
  );
  const dueCell = (r: Row) =>
    canDecideRequest(r.status) ? due(r.createdAt) : r.completedAt ? formatDate(r.completedAt, locale, "medium") : t("admin.common.none");
  const actions = (r: Row) => <DataRequestActions key="a" requestId={r.id} userId={r.userId} kind={r.kind} status={r.status} />;

  return (
    <Page fullWidth title={t("admin.privacy.title")} titleIcon={<FileLock2 aria-hidden="true" />} subtitle={t("admin.privacy.subtitle")}>
      <Card padding="0">
        {rows.length ? (
          <>
            <div className={styles.table}>
              <DataTable
                caption={t("admin.privacy.title")}
                columnContentTypes={["text", "text", "text", "text", "text", "text"]}
                headings={[t("admin.privacy.columns.user"), t("admin.privacy.columns.kind"), t("admin.privacy.columns.status"), t("admin.privacy.columns.received"), t("admin.privacy.columns.due"), <span key="h" className="visually-hidden">{t("admin.common.actionsColumn")}</span>]}
                rows={rows.map((r) => [user(r), t(`admin.privacy.kinds.${r.kind}` as DictKey), status(r), formatDate(r.createdAt, locale, "medium"), dueCell(r), actions(r)])}
              />
            </div>
            <ul className={styles.list} aria-label={t("admin.privacy.title")}>
              {rows.map((r) => (
                <li key={r.id} className={styles.item}>
                  <div className={styles.itemHead}>
                    {user(r)}
                    {status(r)}
                  </div>
                  <dl className={styles.meta}>
                    <dt>{t("admin.privacy.columns.kind")}</dt>
                    <dd>{t(`admin.privacy.kinds.${r.kind}` as DictKey)}</dd>
                    <dt>{t("admin.privacy.columns.received")}</dt>
                    <dd>{formatDate(r.createdAt, locale, "medium")}</dd>
                    <dt>{t("admin.privacy.columns.due")}</dt>
                    <dd>{dueCell(r)}</dd>
                  </dl>
                  {actions(r)}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <EmptyState heading={t("admin.privacy.empty")} image={<EmptyBoxIllustration size={96} />} compact>
            {t("admin.privacy.emptyBody")}
          </EmptyState>
        )}
      </Card>
    </Page>
  );
}
