import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Download } from "lucide-react";
import { Badge, Banner, BlockStack, Button, Card, DataTable, InlineStack, Layout, LayoutSection, Link, Page, Text } from "@/components/ui";
import { DataRequestActions } from "@/components/admin/DataRequestActions";
import { OrderStatusBadge } from "@/components/admin/OrdersIndex";
import { loadUser } from "@/components/admin/server/queries";
import { getT, pick, toLocale, type DictKey } from "@/i18n";
import { formatDate, formatDateTime, formatMoney, formatNumber } from "@/lib/format";

type Params = Promise<{ locale: string; id: string }>;

/** Entity first (WCAG 2.4.2). The name only, never the phone number: titles end up in history and tab lists. */
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, id } = await params;
  const t = getT(toLocale(locale));
  const u = /^[\w-]{1,40}$/.test(id) ? await db.user.findUnique({ where: { id }, select: { name: true } }) : null;
  return { title: `${u?.name ? `${u.name} · ` : ""}${t("admin.users.title")} · ${t("admin.title")}` };
}

export default async function AdminUserPage({ params }: { params: Params }) {
  const { locale: raw, id } = await params;
  const locale = toLocale(raw);
  const t = getT(locale);
  const base = `/${locale}/admin`;
  const data = await loadUser(id);
  if (!data) notFound();
  const { user, requests } = data;
  const anonymised = user.phone.startsWith("deleted:");

  return (
    <Page
      title={<bdi>{user.name ?? t("admin.users.noName")}</bdi>}
      titleMetadata={<Badge tone={user.role === "ADMIN" ? "magic" : user.role === "VENDOR" ? "info" : "neutral"}>{t(`admin.users.roles.${user.role}` as DictKey)}</Badge>}
      subtitle={t("admin.users.detail.joined", { date: formatDate(user.createdAt, locale, "medium") })}
      backAction={{ content: t("admin.users.detail.back"), url: `${base}/users` }}
      primaryAction={
        anonymised ? undefined : (
          <Button icon={<Download aria-hidden="true" />} url={`/api/admin/users/${user.id}/export`} external>
            {t("admin.users.detail.export")}
          </Button>
        )
      }
    >
      <BlockStack gap="400">
        {anonymised ? <Banner tone="info">{t("admin.users.detail.anonymised")}</Banner> : null}
        <Layout>
          <LayoutSection>
            <BlockStack gap="400">
              <Card title={t("admin.users.detail.consents")}>
                <BlockStack gap="300">
                  <Text as="p" variant="bodySm" tone="subdued">
                    {t("admin.users.detail.consentsHelp")}
                  </Text>
                  {user.consents.length ? (
                    <DataTable
                      caption={t("admin.users.detail.consentCaption")}
                      columnContentTypes={["text", "text", "text", "text", "text"]}
                      headings={[
                        t("admin.users.detail.consentColumns.kind"),
                        t("admin.users.detail.consentColumns.decision"),
                        t("admin.users.detail.consentColumns.version"),
                        t("admin.users.detail.consentColumns.date"),
                        t("admin.users.detail.consentColumns.ip"),
                      ]}
                      rows={user.consents.map((c) => [
                        t(`account.consentKind.${c.kind}` as DictKey),
                        <Badge key="d" tone={c.granted ? "success" : "neutral"} progress={c.granted ? "complete" : "incomplete"}>
                          {c.granted ? t("account.granted") : t("account.withdrawn")}
                        </Badge>,
                        <bdi key="v">{c.textVersion}</bdi>,
                        formatDateTime(c.createdAt, locale),
                        <bdi key="i" dir="ltr">
                          {c.ip ?? t("admin.common.none")}
                        </bdi>,
                      ])}
                    />
                  ) : (
                    <Text as="p" tone="subdued">
                      {t("admin.users.detail.noConsents")}
                    </Text>
                  )}
                </BlockStack>
              </Card>

              <Card title={t("admin.users.detail.requests")}>
                {requests.length ? (
                  <DataTable
                    caption={t("admin.users.detail.requests")}
                    columnContentTypes={["text", "text", "text", "text"]}
                    headings={[t("admin.privacy.columns.kind"), t("admin.privacy.columns.status"), t("admin.privacy.columns.received"), <span key="h" className="visually-hidden">{t("admin.common.actionsColumn")}</span>]}
                    rows={requests.map((r) => [
                      t(`admin.privacy.kinds.${r.kind}` as DictKey),
                      t(`admin.privacy.statuses.${r.status}` as DictKey),
                      formatDate(r.createdAt, locale, "medium"),
                      <DataRequestActions key="a" requestId={r.id} userId={user.id} kind={r.kind} status={r.status} />,
                    ])}
                  />
                ) : (
                  <Text as="p" tone="subdued">
                    {t("admin.users.detail.noRequests")}
                  </Text>
                )}
              </Card>

              <Card title={t("admin.users.detail.orders")}>
                {user.orders.length ? (
                  <DataTable
                    caption={t("admin.users.detail.orders")}
                    columnContentTypes={["text", "text", "text", "numeric"]}
                    headings={[t("admin.orders.columns.order"), t("admin.orders.columns.date"), t("admin.orders.columns.status"), t("admin.orders.columns.total")]}
                    rows={user.orders.map((o) => [
                      <Link key="n" url={`${base}/orders/${o.number}`}>
                        <bdi>{o.number}</bdi>
                      </Link>,
                      formatDate(o.placedAt, locale, "medium"),
                      <OrderStatusBadge key="s" status={o.status} />,
                      formatMoney(o.totalPiasters, locale, { alwaysDecimals: true }),
                    ])}
                  />
                ) : (
                  <Text as="p" tone="subdued">
                    {t("admin.users.detail.noOrders")}
                  </Text>
                )}
              </Card>
            </BlockStack>
          </LayoutSection>
          <LayoutSection variant="oneThird" as="aside">
            <Card title={t("admin.users.detail.profile")}>
              <BlockStack gap="200">
                <Text as="p">
                  <bdi dir="ltr">{anonymised ? t("admin.common.none") : user.phone}</bdi>
                </Text>
                {user.email ? <Text as="p">{user.email}</Text> : null}
                <InlineStack gap="150">
                  <Text as="span" tone="subdued">
                    {t("admin.users.columns.marketing")}:
                  </Text>
                  <Text as="span">{user.marketingConsent ? t("admin.users.marketingOn") : t("admin.users.marketingOff")}</Text>
                </InlineStack>
                {user.vendor ? <Link url={`${base}/vendors/${user.vendor.slug}`}>{t("admin.users.detail.vendor", { name: pick(locale, user.vendor.nameAr, user.vendor.nameEn) })}</Link> : null}
                <Text as="p" variant="bodySm" tone="subdued">
                  {t("admin.users.detail.designs", { count: formatNumber(user._count.designs) })} · {t("admin.users.detail.sessions", { count: formatNumber(user._count.sessions) })}
                </Text>
                {user.lastLoginAt ? (
                  <Text as="p" variant="bodySm" tone="subdued">
                    {t("admin.users.detail.lastLogin", { date: formatDateTime(user.lastLoginAt, locale) })}
                  </Text>
                ) : null}
                <Text as="p" variant="bodySm" tone="subdued">
                  {t("admin.users.detail.exportHelp")}
                </Text>
              </BlockStack>
            </Card>
          </LayoutSection>
        </Layout>
      </BlockStack>
    </Page>
  );
}
