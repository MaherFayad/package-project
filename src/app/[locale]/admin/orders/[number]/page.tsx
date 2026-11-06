import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { Banner } from "@/components/ui/Banner";
import { BlockStack, Box, Divider, InlineStack } from "@/components/ui/Stack";
import { Card, Inset } from "@/components/ui/Card";
import { Layout, LayoutSection } from "@/components/ui/Layout";
import { Link } from "@/components/ui/Link";
import { Page } from "@/components/ui/Page";
import { Text } from "@/components/ui/Text";
import { Timeline, type TimelineGroup } from "@/components/ui/Timeline";
import { NoteComposer, OverrideCard, QcActions, RefundCard, RoutingCard, ShipCard } from "@/components/admin/OrderActions";
import { OrderStatusBadge } from "@/components/admin/OrdersIndex";
import { adminStyles } from "@/components/admin/charts";
import { loadOrderDetail } from "@/components/admin/server/queries";
import { goodsNet, marginOf, type MetricOrder } from "@/components/admin/lib/metrics";
import { canOverrideCost, canOverridePrice, canReassign, canRefund, canReviewQc, reprintSource } from "@/components/admin/lib/orders";
import { isOpenDispute } from "@/components/admin/lib/ops";
import { requireRole } from "@/lib/auth/session";
import { getT, pick, toLocale, type DictKey, type TFunction } from "@/i18n";
import { fromJson } from "@/lib/json";
import { PayoutsCard } from "@/components/admin/PayoutActions";
import { adminPayoutStatus, nextPayoutStep } from "@/components/admin/lib/payouts";
import { payoutSchedule } from "@/components/vendor/lib/payouts";
import { modelByCode } from "@/lib/library";
import { formatDate, formatDateTime, formatDims, formatMoney, formatNumber } from "@/lib/format";
import type { Dims, Locale, ShippingAddress } from "@/types";

type Params = Promise<{ locale: string; number: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, number } = await params;
  const t = getT(toLocale(locale));
  return { title: `${decodeURIComponent(number)} · ${t("admin.orders.title")} · ${t("admin.title")}` };
}

function Row({ label, value, strong }: { label: ReactNode; value: ReactNode; strong?: boolean }) {
  return (
    <InlineStack align="space-between" gap="200" wrap={false}>
      <Text as="span" fontWeight={strong ? "semibold" : undefined}>
        {label}
      </Text>
      <Text as="span" numeric fontWeight={strong ? "semibold" : undefined}>
        {value}
      </Text>
    </InlineStack>
  );
}

function groupByDay<T extends { at: Date }>(rows: T[], locale: Locale, t: TFunction, render: (r: T) => TimelineGroup["events"][number]): TimelineGroup[] {
  const today = formatDate(new Date(), locale, "long");
  const groups = new Map<string, TimelineGroup>();
  for (const r of rows) {
    const day = formatDate(r.at, locale, "long");
    if (!groups.has(day)) groups.set(day, { title: day === today ? t("admin.order.timeline.today") : day, events: [] });
    groups.get(day)!.events.push(render(r));
  }
  return [...groups.values()];
}

export default async function AdminOrderPage({ params }: { params: Params }) {
  const { locale: raw, number } = await params;
  const locale = toLocale(raw);
  const t = getT(locale);
  const admin = await requireRole("ADMIN", locale, `/${locale}/admin/orders/${number}`);
  const data = await loadOrderDetail(decodeURIComponent(number));
  const base = `/${locale}/admin`;
  if (!data) notFound();
  const { order, vendorOptions, actors, reprints, auditRows } = data;
  const m = order as unknown as MetricOrder;
  const goods = goodsNet(m);
  const margin = marginOf(m);
  const addr = fromJson<ShippingAddress | null>(order.shippingAddress);
  const source = reprintSource(order.notes);
  const showQc = order.qcPhotos.length > 0 || order.status === "QC_PENDING";

  // Timeline: production events + admin audit rows, newest first.
  const events = [
    ...order.productionEvents.map((e) => ({ kind: "event" as const, id: e.id, at: e.createdAt, type: e.type, note: e.note, actor: e.actorId ? actors[e.actorId]?.name ?? null : null })),
    ...auditRows.map((a) => ({ kind: "audit" as const, id: a.id, at: a.createdAt, type: a.action, note: a.summary, actor: a.actorPhone })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  const groups = groupByDay(events, locale, t, (e) => {
    const time = (
      <time dateTime={e.at.toISOString()}>
        {new Intl.DateTimeFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB", { timeStyle: "short", timeZone: "Africa/Cairo" }).format(e.at)}
      </time>
    );
    if (e.kind === "audit") {
      return {
        id: e.id,
        time,
        tone: e.type === "ORDER_REFUND" || e.type === "ORDER_QC_REJECT" ? "critical" : "attention",
        content: (
          <span>
            <Text as="span" fontWeight="semibold">
              {t(`admin.audit.actions.${e.type}` as DictKey)}
            </Text>
            {e.note ? <span className={adminStyles.PreWrap} dir="auto">{`: ${e.note.replace(/^[\w-]+:\s?/, "")}`}</span> : null}
          </span>
        ),
        details: e.actor ? <bdi dir="ltr">{e.actor}</bdi> : undefined,
      };
    }
    return {
      id: e.id,
      time,
      tone: e.type === "QC_REJECTED" || e.type === "CANCELLED" || e.type === "VENDOR_DECLINED" ? "critical" : e.type === "DELIVERED" || e.type === "QC_APPROVED" ? "success" : "default",
      content: (
        <span>
          {t(`admin.order.events.${e.type}` as DictKey)}
          {e.note ? <Text as="span" tone="subdued">{" · "}<bdi>{e.note}</bdi></Text> : null}
        </span>
      ),
    };
  });

  const vendorName = pick(locale, order.vendor.nameAr, order.vendor.nameEn);
  /** Library model name when the buyer designed one (Design.modelCode), else the core style name. */
  const libraryName = (modelCode: string | null, structureCode: string) => {
    const lib = modelByCode(modelCode);
    return lib ? pick(locale, lib.name.ar, lib.name.en) : t(`structures.${structureCode}` as DictKey);
  };

  return (
    <Page
      title={<bdi>{order.number}</bdi>}
      titleMetadata={
        <InlineStack gap="150">
          <OrderStatusBadge status={order.status} />
          {order.disputes.some((d) => isOpenDispute(d.status)) ? <Badge tone="critical">{t("admin.orders.dispute")}</Badge> : null}
          {source ? <Badge tone="info">{t("admin.orders.reprint")}</Badge> : null}
        </InlineStack>
      }
      subtitle={
        <>
          {t("admin.order.placed", { date: formatDateTime(order.placedAt, locale) })}
          {source ? ` · ${t("admin.order.reprintOf", { number: source })}` : ""}
        </>
      }
      backAction={{ content: t("admin.order.back"), url: `${base}/orders` }}
    >
      <Layout>
        <LayoutSection>
          <BlockStack gap="400">
            {order.status === "PAID" ? (
              // The next ops step for a paid order; on phones the vendor card sits far below, so surface it here.
              <Banner tone="warning" title={t("admin.order.routing.awaitingTitle", { vendor: vendorName })} action={canReassign(order.status) ? { content: t("admin.order.routing.change"), url: "#order-vendor" } : undefined}>
                {t("admin.order.routing.awaiting")}
              </Banner>
            ) : null}
            {showQc ? (
              <Card title={t("admin.order.qc.title")}>
                <BlockStack gap="300">
                  {order.qcPhotos.length ? (
                    <>
                      <Text as="p" tone="subdued" variant="bodySm">
                        {t("admin.order.qc.help")}
                      </Text>
                      <div className={adminStyles.Photos}>
                        {order.qcPhotos.map((p, i) => (
                          <figure key={p.id} style={{ margin: 0 }}>
                            <a href={p.url} target="_blank" rel="noreferrer">
                              {/* eslint-disable-next-line @next/next/no-img-element -- private upload served by the API, not optimisable */}
                              <img className={adminStyles.Photo} src={p.url} alt={t("admin.order.qc.photo", { n: i + 1, kind: t(`admin.order.qc.kinds.${p.kind}` as DictKey) })} />
                            </a>
                            <figcaption>
                              <InlineStack gap="100" blockAlign="center">
                                <Text as="span" variant="bodySm">
                                  {t(`admin.order.qc.kinds.${p.kind}` as DictKey)}
                                </Text>
                                <Badge size="small" tone={p.status === "APPROVED" ? "success" : p.status === "REJECTED" ? "critical" : "attention"} progress={p.status === "PENDING" ? "incomplete" : "complete"}>
                                  {t(`admin.order.qc.statuses.${p.status}` as DictKey)}
                                </Badge>
                              </InlineStack>
                              {p.reviewNote ? (
                                <Text as="p" variant="bodySm" tone="subdued">
                                  <bdi>{p.reviewNote}</bdi>
                                </Text>
                              ) : null}
                            </figcaption>
                          </figure>
                        ))}
                      </div>
                    </>
                  ) : (
                    <Text as="p" tone="subdued">
                      {t("admin.order.qc.noPhotos")}
                    </Text>
                  )}
                  {canReviewQc(order.status, order.qcPhotos) ? <QcActions orderId={order.id} /> : null}
                </BlockStack>
              </Card>
            ) : null}

            {order.status === "READY_TO_SHIP" ? <ShipCard orderId={order.id} /> : null}

            <Card title={t("admin.order.items")}>
              <BlockStack gap="300">
                {order.items.map((it) => (
                  <Inset key={it.id}>
                    <InlineStack align="space-between" gap="300" blockAlign="start">
                      <BlockStack gap="100">
                        <Text as="p" fontWeight="semibold">
                          {libraryName(it.modelCode, it.structureCode)}{" "}
                          <Text as="span" tone="subdued">
                            <bdi dir="ltr">{formatDims(fromJson<Dims>(it.dims), locale)}</bdi>
                          </Text>
                        </Text>
                        {modelByCode(it.modelCode) ? (
                          // The buyer designed a library model; the vendor produces and prices it as its base style.
                          <Text as="p" variant="bodySm" tone="subdued">
                            {t("admin.order.madeAs", { standard: modelByCode(it.modelCode)!.standard, style: t(`structures.${it.structureCode}` as DictKey) })}
                          </Text>
                        ) : null}
                        <Text as="p" variant="bodySm" tone="subdued">
                          {t("admin.order.spec", {
                            material: t(`materials.${it.materialCode}` as DictKey),
                            finish: t(`finishes.${it.finishCode}` as DictKey),
                            sides: t(`admin.order.sides.${it.printSides === "BOTH" ? "BOTH" : "OUTSIDE"}` as DictKey),
                          })}
                        </Text>
                        {it.printPdfUrl ? (
                          <Link url={`/api/orders/${order.id}/print-pdf?item=${it.id}`} external>
                            {t("admin.order.printPdf")}
                          </Link>
                        ) : null}
                      </BlockStack>
                      <BlockStack gap="100" align="end">
                        <Text as="p" numeric alignment="end">
                          <bdi>
                            {formatNumber(it.quantity)} × {formatMoney(it.unitPiasters, locale, { alwaysDecimals: true })}
                          </bdi>
                        </Text>
                        <Text as="p" numeric fontWeight="semibold" alignment="end">
                          {formatMoney(it.lineTotalPiasters, locale, { alwaysDecimals: true })}
                        </Text>
                      </BlockStack>
                    </InlineStack>
                  </Inset>
                ))}
              </BlockStack>
            </Card>

            <Card title={t("admin.order.money.title")}>
              <BlockStack gap="300">
                <Inset>
                  <BlockStack gap="200">
                    <Row label={t("admin.order.money.goods")} value={formatMoney(goods, locale, { alwaysDecimals: true })} />
                    <Row label={t("admin.order.money.delivery")} value={formatMoney(order.shippingPiasters, locale, { alwaysDecimals: true })} />
                    <Row label={t("admin.order.money.vat")} value={formatMoney(order.vatPiasters, locale, { alwaysDecimals: true })} />
                    <Divider />
                    <Row label={t("admin.order.money.total")} value={formatMoney(order.totalPiasters, locale, { alwaysDecimals: true })} strong />
                  </BlockStack>
                </Inset>
                <Inset>
                  <BlockStack gap="200">
                    <Row label={t("admin.order.money.vendorCost")} value={formatMoney(order.vendorCostPiasters, locale, { alwaysDecimals: true })} />
                    <Row label={t("admin.order.money.margin")} value={formatMoney(margin, locale, { alwaysDecimals: true })} strong />
                  </BlockStack>
                </Inset>
                {order.payments.length ? (
                  <BlockStack gap="100">
                    <Text as="h3" variant="headingXs">
                      {t("admin.order.money.payments")}
                    </Text>
                    {order.payments.map((p) => (
                      <InlineStack key={p.id} align="space-between" gap="200">
                        <Text as="span" variant="bodySm">
                          {t(`paymentMethods.${p.method}` as DictKey)} · {formatDateTime(p.createdAt, locale)}
                        </Text>
                        <InlineStack gap="150" blockAlign="center">
                          <Text as="span" numeric variant="bodySm">
                            {formatMoney(p.amountPiasters, locale, { alwaysDecimals: true })}
                          </Text>
                          <Badge size="small" tone={p.status === "PAID" ? "neutral" : p.status === "REFUNDED" ? "critical" : "warning"} progress={p.status === "PAID" ? "complete" : "incomplete"}>
                            {t(`admin.orders.paymentStatus.${p.status}` as DictKey)}
                          </Badge>
                        </InlineStack>
                      </InlineStack>
                    ))}
                  </BlockStack>
                ) : null}
              </BlockStack>
            </Card>

            <BlockStack gap="200">
              <Box paddingInline={{ xs: "400", md: "0" }}>
                <Text as="h2" variant="headingMd">
                  {t("admin.order.timeline.title")}
                </Text>
              </Box>
              <Timeline groups={groups} composer={<NoteComposer orderId={order.id} userName={admin.name ?? admin.phone} />} />
            </BlockStack>
          </BlockStack>
        </LayoutSection>

        <LayoutSection variant="oneThird" as="aside">
          <BlockStack gap="400">
            <Card title={t("admin.order.buyer.title")}>
              <BlockStack gap="200">
                <Link url={`${base}/users/${order.buyer.id}`}><bdi>{order.buyer.name ?? t("admin.users.noName")}</bdi></Link>
                <Text as="p">
                  <bdi dir="ltr">{order.buyer.phone}</bdi>
                </Text>
                {order.buyer.email ? <Text as="p">{order.buyer.email}</Text> : null}
                {addr ? (
                  <BlockStack gap="050">
                    <Text as="h3" variant="headingXs">
                      {t("admin.order.buyer.address")}
                    </Text>
                    <Text as="p" variant="bodySm">
                      <bdi>{addr.name}</bdi>
                      <br />
                      <bdi>{[addr.street, addr.building, addr.city, addr.governorate].filter(Boolean).join(", ")}</bdi>
                    </Text>
                  </BlockStack>
                ) : null}
              </BlockStack>
            </Card>

            <RoutingCard
              orderId={order.id}
              currentVendorId={order.vendorId}
              canReassign={canReassign(order.status)}
              vendorCostPiasters={order.vendorCostPiasters}
              goodsPiasters={goods}
              jobLabel={order.items[0] ? `${t(`structures.${order.items[0].structureCode}` as DictKey)} · ${t(`materials.${order.items[0].materialCode}` as DictKey)}` : ""}
              vendors={vendorOptions.map((v) => ({ id: v.id, name: pick(locale, v.nameAr, v.nameEn), capable: v.capable }))}
              vendor={
                <BlockStack gap="100">
                  <Link url={`${base}/vendors/${order.vendor.slug}`}>{vendorName}</Link>
                  <Text as="p" variant="bodySm" tone="subdued">
                    {t(`admin.vendors.statuses.${order.vendor.status}` as DictKey)}
                    {order.dueDate ? ` · ${t("admin.order.vendorCard.due", { date: formatDate(order.dueDate, locale, "medium") })}` : ""}
                  </Text>
                </BlockStack>
              }
            />

            <PayoutsCard
              orderId={order.id}
              orderNumber={order.number}
              vendorName={vendorName}
              parts={payoutSchedule([order], order.payouts).map((r) => ({ kind: r.kind, amountPiasters: r.amountPiasters, status: adminPayoutStatus(r, order.status), date: r.date, step: nextPayoutStep(r, order.status, order.disputes.some((d) => isOpenDispute(d.status))), held: r.kind === "BALANCE" && r.status !== "PAID" && order.disputes.some((d) => isOpenDispute(d.status)) }))}
            />

            <OverrideCard
              orderId={order.id}
              status={order.status}
              money={order}
              goodsPiasters={goods}
              vendorCostPiasters={order.vendorCostPiasters}
              canPrice={canOverridePrice(order.status)}
              canCost={canOverrideCost(order.status)}
            />

            <RefundCard orderId={order.id} number={order.number} totalPiasters={order.totalPiasters} canRefund={canRefund(order.status, order.payments)} />

            {order.disputes.length ? (
              <Card title={t("admin.order.disputes.title")}>
                <BlockStack gap="200">
                  {order.disputes.map((d) => (
                    <InlineStack key={d.id} align="space-between" gap="200">
                      <Link url={`${base}/disputes/${d.id}`}>{t(`admin.disputes.reasons.${d.reason}` as DictKey)}</Link>
                      <Badge tone={isOpenDispute(d.status) ? "attention" : "neutral"} progress={isOpenDispute(d.status) ? "incomplete" : "complete"}>
                        {t(`admin.disputes.statuses.${d.status}` as DictKey)}
                      </Badge>
                    </InlineStack>
                  ))}
                </BlockStack>
              </Card>
            ) : null}

            {reprints.length ? (
              <Card title={t("admin.order.reprints.title")}>
                <BlockStack gap="200">
                  {reprints.map((r) => (
                    <InlineStack key={r.number} align="space-between" gap="200">
                      <Link url={`${base}/orders/${r.number}`}>
                        <bdi>{r.number}</bdi>
                      </Link>
                      <OrderStatusBadge status={r.status} />
                    </InlineStack>
                  ))}
                </BlockStack>
              </Card>
            ) : null}

            {order.shipments.length ? (
              <Card title={t("admin.order.shipments.title")}>
                <BlockStack gap="100">
                  {order.shipments.map((s) => (
                    <Text as="p" key={s.id} variant="bodySm">
                      {t(`admin.order.shipments.statuses.${s.status}` as DictKey)}
                      {s.trackingNumber ? (
                        <>
                          {" · "}
                          <bdi dir="ltr">{t("admin.order.shipments.tracking", { number: s.trackingNumber })}</bdi>
                        </>
                      ) : null}
                    </Text>
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
