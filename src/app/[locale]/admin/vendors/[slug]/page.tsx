import type { Metadata } from "next";
import { Badge, BlockStack, Card, DataTable, InlineStack, Layout, LayoutSection, Link, MetricsStrip, Page, Text } from "@/components/ui";
import { VendorStatusActions } from "@/components/admin/VendorActions";
import { NotFoundCard } from "@/components/admin/NotFoundCard";
import { loadVendorDetail } from "@/components/admin/server/queries";
import { getT, pick, toLocale, type DictKey } from "@/i18n";
import { formatDate, formatDateTime, formatMoney, formatNumber, formatPercent } from "@/lib/format";

type Params = Promise<{ locale: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const t = getT(toLocale((await params).locale));
  return { title: `${t("admin.vendors.title")} · ${t("admin.title")}` };
}

export default async function AdminVendorPage({ params }: { params: Params }) {
  const { locale: raw, slug } = await params;
  const locale = toLocale(raw);
  const t = getT(locale);
  const base = `/${locale}/admin`;
  const data = await loadVendorDetail(slug);
  if (!data) return <NotFoundCard locale={locale} backUrl={`${base}/vendors`} backLabel={t("admin.vendors.detail.back")} />;
  const { vendor, orders, score, application, auditRows } = data;
  const name = pick(locale, vendor.nameAr, vendor.nameEn);
  const pct = (n: number | null) => (n === null ? t("admin.common.none") : formatPercent(n, locale));

  return (
    <Page
      title={name}
      titleMetadata={
        <InlineStack gap="150">
          <Badge tone={vendor.status === "ACTIVE" ? "success" : vendor.status === "SUSPENDED" ? "critical" : "attention"} progress={vendor.status === "ACTIVE" ? "complete" : "incomplete"}>
            {t(`admin.vendors.statuses.${vendor.status}` as DictKey)}
          </Badge>
          <Badge tone={vendor.verified ? "info" : "neutral"}>{vendor.verified ? t("admin.vendors.verified") : t("admin.vendors.unverified")}</Badge>
        </InlineStack>
      }
      subtitle={`${pick(locale, vendor.cityAr, vendor.cityEn)} · ${t("admin.vendors.detail.joined", { date: formatDate(vendor.joinedAt, locale, "medium") })}`}
      backAction={{ content: t("admin.vendors.detail.back"), url: `${base}/vendors` }}
      primaryAction={<VendorStatusActions vendorId={vendor.id} name={name} status={vendor.status} verified={vendor.verified} />}
    >
      <BlockStack gap="400">
        <MetricsStrip
          accessibilityLabel={t("admin.vendors.scorecard.title")}
          metrics={[
            { label: t("admin.vendors.scorecard.orders"), value: formatNumber(score.orders), trend: formatMoney(score.gmvPiasters, locale) },
            { label: t("admin.vendors.scorecard.onTime"), value: pct(score.onTimePct), trend: `${t("admin.vendors.scorecard.delivered")}: ${formatNumber(score.delivered)}` },
            { label: t("admin.vendors.scorecard.reprint"), value: pct(score.reprintPct) },
            { label: t("admin.vendors.scorecard.dispute"), value: pct(score.disputePct) },
            { label: t("admin.vendors.scorecard.qcPass"), value: pct(score.qcPassPct) },
            { label: t("admin.vendors.scorecard.rating"), value: score.rating === null ? t("admin.common.none") : formatNumber(score.rating, 1) },
            {
              label: t("admin.vendors.scorecard.health"),
              value: score.health === null ? t("admin.common.none") : formatNumber(score.health),
              trend: t("admin.vendors.scorecard.healthHelp"),
            },
          ]}
        />
        <Layout>
          <LayoutSection>
            <BlockStack gap="400">
              <Card title={t("admin.vendors.detail.recentOrders")}>
                {orders.length ? (
                  <DataTable
                    caption={t("admin.vendors.detail.recentOrders")}
                    columnContentTypes={["text", "text", "text", "numeric"]}
                    headings={[t("admin.orders.columns.order"), t("admin.orders.columns.date"), t("admin.orders.columns.status"), t("admin.orders.columns.total")]}
                    rows={orders.slice(0, 20).map((o) => [
                      <Link key={o.id} url={`${base}/orders/${o.number}`}>
                        <bdi>{o.number}</bdi>
                      </Link>,
                      formatDate(o.placedAt, locale, "medium"),
                      t(`orderStatus.${o.status}` as DictKey),
                      formatMoney(o.totalPiasters, locale),
                    ])}
                  />
                ) : (
                  <Text as="p" tone="subdued">
                    {t("admin.vendors.detail.noOrders")}
                  </Text>
                )}
              </Card>
              <Card title={t("admin.vendors.detail.history")}>
                {auditRows.length ? (
                  <BlockStack gap="200" as="ul">
                    {auditRows.map((a) => (
                      <li key={a.id}>
                        <Text as="p">
                          <Text as="span" fontWeight="semibold">
                            {t(`admin.audit.actions.${a.action}` as DictKey)}
                          </Text>
                          {a.summary ? ` · ${a.summary}` : ""}
                        </Text>
                        <Text as="p" variant="bodySm" tone="subdued">
                          {formatDateTime(a.createdAt, locale)}
                        </Text>
                      </li>
                    ))}
                  </BlockStack>
                ) : (
                  <Text as="p" tone="subdued">
                    {t("admin.common.none")}
                  </Text>
                )}
              </Card>
            </BlockStack>
          </LayoutSection>
          <LayoutSection variant="oneThird" as="aside">
            <BlockStack gap="400">
              <Card title={t("admin.vendors.detail.publicProfile")}>
                <BlockStack gap="200">
                  <Link url={`/${locale}/vendors/${vendor.slug}`}>{`/${locale}/vendors/${vendor.slug}`}</Link>
                  {application ? <Link url={`${base}/vendors/applications/${application.id}`}>{t("admin.vendors.detail.application")}</Link> : null}
                </BlockStack>
              </Card>
              <Card title={t("admin.vendors.detail.staff")}>
                {vendor.staff.length ? (
                  <BlockStack gap="200" as="ul">
                    {vendor.staff.map((s) => (
                      <li key={s.id}>
                        <Link url={`${base}/users/${s.id}`}>{s.name ?? t("admin.users.noName")}</Link>
                        <Text as="p" variant="bodySm" tone="subdued">
                          <bdi dir="ltr">{s.phone}</bdi>
                        </Text>
                      </li>
                    ))}
                  </BlockStack>
                ) : (
                  <Text as="p" tone="subdued">
                    {t("admin.vendors.detail.noStaff")}
                  </Text>
                )}
              </Card>
              <Card title={t("admin.vendors.detail.rateCards")}>
                <BlockStack gap="200">
                  <Text as="p">{t("admin.vendors.detail.rateCardCount", { count: formatNumber(vendor.rateCards.filter((r) => r.active).length) })}</Text>
                  <BlockStack gap="100" as="ul">
                    {vendor.rateCards
                      .filter((r) => r.active)
                      .map((r) => (
                        <li key={r.id}>
                          <Text as="span" variant="bodySm">
                            {t(`structures.${r.structure.code}` as DictKey)} · {t(`materials.${r.material.code}` as DictKey)}
                          </Text>
                        </li>
                      ))}
                  </BlockStack>
                </BlockStack>
              </Card>
            </BlockStack>
          </LayoutSection>
        </Layout>
      </BlockStack>
    </Page>
  );
}
