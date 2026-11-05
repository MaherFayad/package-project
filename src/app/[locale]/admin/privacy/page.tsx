import type { Metadata } from "next";
import { FileLock2 } from "lucide-react";
import { Badge, BlockStack, Card, DataTable, EmptyBoxIllustration, EmptyState, Link, Page, Text } from "@/components/ui";
import { DataRequestActions } from "@/components/admin/DataRequestActions";
import { loadDataRequests } from "@/components/admin/server/queries";
import { canDecideRequest, maskPhone } from "@/components/admin/lib/ops";
import { getT, toLocale, type DictKey } from "@/i18n";
import { formatDate, formatNumber } from "@/lib/format";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = getT(toLocale((await params).locale));
  return { title: `${t("admin.privacy.title")} · ${t("admin.title")}` };
}

const RESPONSE_DAYS = 30;

export default async function AdminPrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  const rows = await loadDataRequests();
  const now = Date.now();
  const due = (createdAt: string) => {
    const left = Math.ceil((new Date(createdAt).getTime() + RESPONSE_DAYS * 86_400_000 - now) / 86_400_000);
    return left < 0 ? (
      <Badge key="due" tone="critical">{t("admin.privacy.overdue")}</Badge>
    ) : (
      <Text key="due" as="span" tone={left <= 7 ? "caution" : undefined}>
        {t("admin.privacy.dueIn", { days: formatNumber(left) })}
      </Text>
    );
  };
  return (
    <Page fullWidth title={t("admin.privacy.title")} titleIcon={<FileLock2 aria-hidden="true" />} subtitle={t("admin.privacy.subtitle")}>
      <Card padding="0">
        {rows.length ? (
          <DataTable
            caption={t("admin.privacy.title")}
            columnContentTypes={["text", "text", "text", "text", "text", "text"]}
            headings={[t("admin.privacy.columns.user"), t("admin.privacy.columns.kind"), t("admin.privacy.columns.status"), t("admin.privacy.columns.received"), t("admin.privacy.columns.due"), ""]}
            rows={rows.map((r) => [
              <BlockStack key="u" gap="0">
                <Link url={`/${locale}/admin/users/${r.userId}`}>{r.userName || t("admin.users.noName")}</Link>
                <Text as="span" variant="bodySm" tone="subdued">
                  <bdi dir="ltr">{maskPhone(r.userPhone)}</bdi>
                </Text>
              </BlockStack>,
              t(`admin.privacy.kinds.${r.kind}` as DictKey),
              <Badge key="s" tone={r.status === "COMPLETED" ? "success" : r.status === "REJECTED" ? "neutral" : r.status === "IN_PROGRESS" ? "info" : "attention"} progress={canDecideRequest(r.status) ? "incomplete" : "complete"}>
                {t(`admin.privacy.statuses.${r.status}` as DictKey)}
              </Badge>,
              formatDate(r.createdAt, locale, "medium"),
              canDecideRequest(r.status) ? due(r.createdAt) : r.completedAt ? formatDate(r.completedAt, locale, "medium") : t("admin.common.none"),
              <DataRequestActions key="a" requestId={r.id} userId={r.userId} kind={r.kind} status={r.status} />,
            ])}
          />
        ) : (
          <EmptyState heading={t("admin.privacy.empty")} image={<EmptyBoxIllustration size={96} />} compact>
            {t("admin.privacy.emptyBody")}
          </EmptyState>
        )}
      </Card>
    </Page>
  );
}
