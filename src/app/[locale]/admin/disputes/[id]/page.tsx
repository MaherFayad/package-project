import type { Metadata } from "next";
import { BlockStack, Card, InlineStack, Layout, LayoutSection, Link, Page, Text } from "@/components/ui";
import { DisputeDecision } from "@/components/admin/DisputeDecision";
import { DisputeStatusBadge } from "@/components/admin/DisputesIndex";
import { OrderStatusBadge } from "@/components/admin/OrdersIndex";
import { NotFoundCard } from "@/components/admin/NotFoundCard";
import { adminStyles } from "@/components/admin/charts";
import { loadDispute } from "@/components/admin/server/queries";
import { canRefund } from "@/components/admin/lib/orders";
import { getT, pick, toLocale, type DictKey } from "@/i18n";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";

type Params = Promise<{ locale: string; id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const t = getT(toLocale((await params).locale));
  return { title: `${t("admin.disputes.title")} · ${t("admin.title")}` };
}

export default async function AdminDisputePage({ params }: { params: Params }) {
  const { locale: raw, id } = await params;
  const locale = toLocale(raw);
  const t = getT(locale);
  const base = `/${locale}/admin`;
  const data = await loadDispute(id);
  if (!data) return <NotFoundCard locale={locale} backUrl={`${base}/disputes`} backLabel={t("admin.disputes.detail.back")} />;
  const { dispute: d, vendors, reprints, auditRows } = data;
  const order = d.order;

  return (
    <Page
      title={t("admin.disputes.detail.title", { number: order.number })}
      titleMetadata={<DisputeStatusBadge status={d.status} />}
      subtitle={t("admin.disputes.detail.opened", { date: formatDateTime(d.createdAt, locale), name: d.openedBy.name ?? d.openedBy.phone })}
      backAction={{ content: t("admin.disputes.detail.back"), url: `${base}/disputes` }}
    >
      <Layout>
        <LayoutSection>
          <BlockStack gap="400">
            <Card title={t("admin.disputes.detail.description")}>
              <BlockStack gap="200">
                <Text as="p" fontWeight="semibold">
                  {t(`admin.disputes.reasons.${d.reason}` as DictKey)}
                </Text>
                <Text as="p">
                  <span className={adminStyles.PreWrap}>{d.description}</span>
                </Text>
              </BlockStack>
            </Card>
            {order.qcPhotos.length ? (
              <Card title={t("admin.disputes.detail.qcPhotos")}>
                <div className={adminStyles.Photos}>
                  {order.qcPhotos.map((p, i) => (
                    <a key={p.id} href={p.url} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element -- private upload served by the API */}
                      <img className={adminStyles.Photo} src={p.url} alt={t("admin.order.qc.photo", { n: i + 1, kind: t(`admin.order.qc.kinds.${p.kind}` as DictKey) })} />
                    </a>
                  ))}
                </div>
              </Card>
            ) : null}
            <DisputeDecision
              disputeId={d.id}
              status={d.status}
              originalVendorId={order.vendorId}
              refundable={canRefund(order.status, order.payments)}
              vendors={vendors.map((v) => ({ id: v.id, name: pick(locale, v.nameAr, v.nameEn) }))}
            />
            {d.resolution || d.resolvedAt ? (
              <Card title={t("admin.disputes.detail.resolution")}>
                <BlockStack gap="100">
                  {d.resolution ? (
                    <Text as="p">
                      <span className={adminStyles.PreWrap}>{d.resolution}</span>
                    </Text>
                  ) : null}
                  {d.resolvedAt ? (
                    <Text as="p" variant="bodySm" tone="subdued">
                      {t("admin.disputes.detail.resolvedOn", { date: formatDate(d.resolvedAt, locale, "medium") })}
                    </Text>
                  ) : null}
                </BlockStack>
              </Card>
            ) : null}
            {auditRows.length ? (
              <Card title={t("admin.vendors.detail.history")}>
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
                        {formatDateTime(a.createdAt, locale)} · <bdi dir="ltr">{a.actorPhone}</bdi>
                      </Text>
                    </li>
                  ))}
                </BlockStack>
              </Card>
            ) : null}
          </BlockStack>
        </LayoutSection>
        <LayoutSection variant="oneThird" as="aside">
          <BlockStack gap="400">
            <Card title={t("admin.disputes.detail.order")}>
              <BlockStack gap="200">
                <InlineStack gap="200" blockAlign="center">
                  <Link url={`${base}/orders/${order.number}`}>
                    <bdi>{order.number}</bdi>
                  </Link>
                  <OrderStatusBadge status={order.status} />
                </InlineStack>
                <Text as="p" numeric>
                  {formatMoney(order.totalPiasters, locale)}
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  {pick(locale, order.vendor.nameAr, order.vendor.nameEn)}
                </Text>
                {order.items[0] ? (
                  <Text as="p" variant="bodySm" tone="subdued">
                    {t(`structures.${order.items[0].structureCode}` as DictKey)} · {order.items[0].quantity}
                  </Text>
                ) : null}
              </BlockStack>
            </Card>
            <Card title={t("admin.order.buyer.title")}>
              <BlockStack gap="100">
                <Link url={`${base}/users/${d.openedBy.id}`}>{d.openedBy.name ?? t("admin.users.noName")}</Link>
                <Text as="p" variant="bodySm">
                  <bdi dir="ltr">{d.openedBy.phone}</bdi>
                </Text>
              </BlockStack>
            </Card>
            {reprints.length ? (
              <Card title={t("admin.disputes.detail.reprints")}>
                <BlockStack gap="200">
                  {reprints.map((r) => (
                    <InlineStack key={r.number} gap="200" align="space-between">
                      <Link url={`${base}/orders/${r.number}`}>
                        <bdi>{r.number}</bdi>
                      </Link>
                      <OrderStatusBadge status={r.status} />
                    </InlineStack>
                  ))}
                </BlockStack>
              </Card>
            ) : null}
          </BlockStack>
        </LayoutSection>
      </Layout>
    </Page>
  );
}
