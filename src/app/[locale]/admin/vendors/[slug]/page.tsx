import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Badge, BlockStack, Card, DataTable, InlineStack, Layout, LayoutSection, Link, MetricsStrip, Page, Text, Tooltip } from "@/components/ui";
import { adminStyles } from "@/components/admin/charts";
import { HealthBadge } from "@/components/admin/HealthBadge";
import { OrderStatusBadge } from "@/components/admin/OrdersIndex";
import { VendorStatusActions } from "@/components/admin/VendorActions";
import { loadVendorDetail, vendorModelCoverage } from "@/components/admin/server/queries";
import { getT, pick, toLocale, type DictKey } from "@/i18n";
import { formatDate, formatDateTime, formatMoney, formatNumber, formatPercent } from "@/lib/format";

type Params = Promise<{ locale: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  const locale = toLocale(raw);
  const t = getT(locale);
  // Entity first (WCAG 2.4.2, CR-49): "Nile Pack · Vendors · Admin".
  const v = /^[\w-]{1,80}$/.test(slug) ? await db.vendor.findUnique({ where: { slug }, select: { nameAr: true, nameEn: true } }) : null;
  return { title: `${v ? `${pick(locale, v.nameAr, v.nameEn)} · ` : ""}${t("admin.vendors.title")} · ${t("admin.title")}` };
}

export default async function AdminVendorPage({ params }: { params: Params }) {
  const { locale: raw, slug } = await params;
  const locale = toLocale(raw);
  const t = getT(locale);
  const base = `/${locale}/admin`;
  const data = await loadVendorDetail(slug);
  if (!data) notFound();
  const { vendor, orders, score, application, auditRows } = data;
  const models = await vendorModelCoverage(vendor.id);
  const name = pick(locale, vendor.nameAr, vendor.nameEn);
  // Capabilities: active rate cards grouped by box style (one row per style, materials listed).
  const rateCardGroups = [
    ...vendor.rateCards
      .filter((r) => r.active)
      .reduce((m, r) => m.set(r.structure.code, [...new Set([...(m.get(r.structure.code) ?? []), r.material.code])]), new Map<string, string[]>()),
  ];
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
            { label: t("admin.vendors.scorecard.orders"), value: <span className={adminStyles.MetricStack}><span className={adminStyles.MetricNum}>{formatNumber(score.orders)}</span><span className={adminStyles.MetricSub}>{formatMoney(score.gmvPiasters, locale, { alwaysDecimals: true })}</span></span> },
            { label: t("admin.vendors.scorecard.onTime"), value: <span className={adminStyles.MetricStack}><span className={adminStyles.MetricNum}>{pct(score.onTimePct)}</span><span className={adminStyles.MetricSub}>{`${t("admin.vendors.scorecard.delivered")}: ${formatNumber(score.delivered)}`}</span></span> },
            { label: t("admin.vendors.scorecard.reprint"), value: pct(score.reprintPct) },
            { label: t("admin.vendors.scorecard.dispute"), value: pct(score.disputePct) },
            { label: t("admin.vendors.scorecard.qcPass"), value: pct(score.qcPassPct) },
            { label: t("admin.vendors.scorecard.rating"), value: score.rating === null ? t("admin.common.none") : formatNumber(score.rating, 1) },
            {
              label: (
                <Tooltip content={t("admin.vendors.scorecard.healthHelp")} dotted>
                  {t("admin.vendors.scorecard.health")}
                </Tooltip>
              ),
              value: score.health === null ? t("admin.common.none") : <HealthBadge score={score.health} label={t("admin.vendors.scorecard.health")} delivered={score.delivered} earlyLabel={t("admin.vendors.scorecard.early")} />,
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
                      <OrderStatusBadge key="s" status={o.status} />,
                      formatMoney(o.totalPiasters, locale, { alwaysDecimals: true }),
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
                  <BlockStack gap="200" as="ul" className={adminStyles.PlainList}>
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
                    {t("admin.vendors.detail.noHistory")}
                  </Text>
                )}
              </Card>
            </BlockStack>
          </LayoutSection>
          <LayoutSection variant="oneThird" as="aside">
            <BlockStack gap="400">
              <Card title={t("admin.vendors.detail.publicProfile")}>
                <BlockStack gap="200">
                  {vendor.status === "ACTIVE" ? (
                    <Link url={`/${locale}/vendors/${vendor.slug}`} external>
                      {t("admin.vendors.detail.openProfile")}
                    </Link>
                  ) : (
                    <Text as="p" variant="bodySm" tone="subdued">
                      {t("admin.vendors.detail.profileHidden")}
                    </Text>
                  )}
                  {application ? <Link url={`${base}/vendors/applications/${application.id}`}>{t("admin.vendors.detail.application")}</Link> : null}
                </BlockStack>
              </Card>
              <Card title={t("admin.vendors.detail.staff")}>
                {vendor.staff.length ? (
                  <BlockStack gap="200" as="ul" className={adminStyles.PlainList}>
                    {vendor.staff.map((s) => (
                      <li key={s.id}>
                        <Link url={`${base}/users/${s.id}`}><bdi>{s.name ?? t("admin.users.noName")}</bdi></Link>
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
                  {vendor.status === "ACTIVE" ? (
                    <Link url={`${base}/catalog?vendor=${vendor.slug}`}>
                      {t("admin.vendors.detail.modelsCount", { count: formatNumber(models.priced), total: formatNumber(models.total) })}
                    </Link>
                  ) : null}
                  <BlockStack gap="200" as="ul" className={adminStyles.PlainList}>
                    {rateCardGroups.map(([code, materials]) => (
                      <li key={code}>
                        <Text as="p" variant="bodySm" fontWeight="semibold">
                          {t(`structures.${code}` as DictKey)}
                        </Text>
                        <Text as="p" variant="bodySm" tone="subdued">
                          {materials.map((m) => t(`materials.${m}` as DictKey)).join(locale === "ar" ? "، " : ", ")}
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
