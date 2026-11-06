import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BlockStack, InlineStack } from "@/components/ui/Stack";
import { Card } from "@/components/ui/Card";
import { Layout, LayoutSection } from "@/components/ui/Layout";
import { Link } from "@/components/ui/Link";
import { Page } from "@/components/ui/Page";
import { Text } from "@/components/ui/Text";
import { DisputeDecision } from "@/components/admin/DisputeDecision";
import { DisputeStatusBadge } from "@/components/admin/DisputesIndex";
import { OrderStatusBadge } from "@/components/admin/OrdersIndex";
import { adminStyles } from "@/components/admin/charts";
import { loadDispute } from "@/components/admin/server/queries";
import { canRefund } from "@/components/admin/lib/orders";
import { isolate } from "@/components/admin/lib/bidi";
import { fileUrl, parseKey } from "@/components/vendor/lib/files";
import { getT, pick, toLocale, type DictKey } from "@/i18n";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";

type Params = Promise<{ locale: string; id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, id } = await params;
  const t = getT(toLocale(locale));
  const d = /^[\w-]{1,40}$/.test(id) ? await db.dispute.findUnique({ where: { id }, select: { order: { select: { number: true } } } }) : null;
  // a11y R6-AX-11 (WCAG 2.4.2): a missing record says so in the tab title too.
  return { title: `${d ? `${d.order.number} · ` : `${t("admin.common.notFoundTitle")} · `}${t("admin.disputes.title")} · ${t("admin.title")}` };
}

export default async function AdminDisputePage({ params }: { params: Params }) {
  const { locale: raw, id } = await params;
  const locale = toLocale(raw);
  const t = getT(locale);
  const base = `/${locale}/admin`;
  const data = await loadDispute(id);
  if (!data) notFound();
  const { dispute: d, vendors, reprints, auditRows, paidToVendorPiasters } = data;
  const order = d.order;
  const buyerPhotos = (Array.isArray(d.photos) ? d.photos : []).filter((k): k is string => typeof k === "string" && parseKey(k)?.scope === "dispute").map(fileUrl);

  return (
    <Page
      title={t("admin.disputes.detail.title", { number: order.number })}
      titleMetadata={<DisputeStatusBadge status={d.status} />}
      subtitle={t("admin.disputes.detail.opened", { date: formatDateTime(d.createdAt, locale), name: isolate(d.openedBy.name ?? d.openedBy.phone) })}
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
                  <span className={adminStyles.PreWrap} dir="auto">{d.description}</span>
                </Text>
              </BlockStack>
            </Card>
            {buyerPhotos.length ? (
              // Added by checkout round 9: the buyer's photos with the report (private uploads).
              <Card title={t("admin.disputes.detail.buyerPhotos", { count: buyerPhotos.length })}>
                <div className={adminStyles.Photos} data-testid="dispute-buyer-photos">
                  {buyerPhotos.map((url, i) => (
                    <a key={url} href={url} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element -- private upload served by the API */}
                      <img className={adminStyles.Photo} src={url} alt={t("admin.disputes.detail.buyerPhoto", { n: i + 1 })} />
                    </a>
                  ))}
                </div>
              </Card>
            ) : null}
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
              reason={d.reason}
              originalQuantity={order.items.reduce((s, i) => s + i.quantity, 0)}
              originalCostPiasters={order.vendorCostPiasters}
              paidToVendorPiasters={paidToVendorPiasters}
              vendors={vendors.map((v) => ({ id: v.id, name: pick(locale, v.nameAr, v.nameEn) }))}
            />
            {d.resolution || d.resolvedAt ? (
              <Card title={t("admin.disputes.detail.resolution")}>
                <BlockStack gap="100">
                  {d.resolution ? (
                    <Text as="p">
                      <span className={adminStyles.PreWrap} dir="auto">{d.resolution}</span>
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
                  {formatMoney(order.totalPiasters, locale, { alwaysDecimals: true })}
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
                <Link url={`${base}/users/${d.openedBy.id}`}><bdi>{d.openedBy.name ?? t("admin.users.noName")}</bdi></Link>
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
