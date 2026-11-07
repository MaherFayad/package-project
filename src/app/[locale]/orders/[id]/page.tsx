import { finishLabel } from "@/lib/orders/finish-label";
import { db } from "@/lib/db";
import type { Metadata } from "next";
import { Download, FileText, Receipt } from "lucide-react";
import type { Dims, DisputeStatus, Locale, OrderStatus, PaymentMethod, ProductionEventType, ShipmentStatus, ShippingAddress } from "@/types";
import { getT, pick, toLocale, type DictKey, type TFunction } from "@/i18n";
import { requireUser } from "@/lib/auth/session";
import { fromJson } from "@/lib/json";
import { formatDate, formatDateTime } from "@/lib/format";
import { formatDimsCm } from "@/lib/orders/box-name";
import { formatEgyptPhone } from "@/lib/phone";
import { getOrderForViewer, moneyOf, syncShipments, type OrderDetail } from "@/lib/orders/service";
import { canBuyerCancel, canOpenDispute, canReview, isPaidStatus } from "@/lib/orders/state";
import { BUYER_SIMPLE_TRACK, BUYER_TRACK, buyerSimpleIndex, buyerSimpleStopped, buyerStatusKey, buyerTrackIndex, buyerTrackStopped, type BuyerSimpleStep } from "@/lib/orders/buyer-track";
import { boxName } from "@/lib/orders/box-name";
import { isSampleLines } from "@/lib/orders/sample";
import { paymentTone, statusTone } from "@/lib/orders/status-tone";
import { modelPoster } from "@/lib/orders/poster";
import { governorateKey } from "@/lib/orders/governorates";
import { sellerTaxReady } from "@/lib/orders/tax-document";
import { IsolatedList } from "../_components/IsolatedList";
import type { TrackingEvent } from "@/lib/shipping";
import { Badge } from "@/components/ui/Badge";
import { Banner } from "@/components/ui/Banner";
import { BlockStack, InlineStack } from "@/components/ui/Stack";
import { Button } from "@/components/ui/Button";
import { Card, Inset } from "@/components/ui/Card";
import { EmptyState, EmptyBoxIllustration } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { Layout, LayoutSection } from "@/components/ui/Layout";
import { Link } from "@/components/ui/Link";
import { Page } from "@/components/ui/Page";
import { PriceTag } from "@/components/ui/PriceTag";
import { Stepper } from "@/components/ui/Stepper";
import { Text } from "@/components/ui/Text";
import { Thumbnail } from "@/components/ui/Thumbnail";
import { Timeline, type TimelineGroup } from "@/components/ui/Timeline";
import { PaidHeader } from "../_components/PaidHeader";
import { CancelOrderButton, DisputeForm, ReorderButton, ReviewForm } from "../_components/OrderActions";
import styles from "../_components/orders.module.css";
import { Fragment } from "react";

/** Plain name of a box board ("Natural brown cardboard"); null for labels, pouches, tubes… */
function plainBoardKey(code: string): DictKey | null {
  if (/^[EB]_FLUTE_KRAFT$/.test(code)) return "buyer.easy.board.kraft";
  if (code === "E_FLUTE_WHITE" || code.startsWith("SBS_")) return "buyer.easy.board.white";
  return null;
}

type Params = Promise<{ locale: string; id: string }>;
type Search = Promise<{ paid?: string }>;
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, id } = await params;
  return { title: getT(toLocale(locale))("orders.detail.metaTitle", { number: id.startsWith("ELB-") ? id : "" }).trim(), robots: { index: false } };
}

const NOTE_KEYS: Record<string, DictKey> = {
  INSTAPAY_SENT: "orders.detail.notes.INSTAPAY_SENT",
  REORDER: "orders.detail.notes.REORDER",
  DISPUTE_OPENED: "orders.detail.notes.DISPUTE_OPENED",
  PREPRESS_CHECK: "orders.detail.notes.PREPRESS_CHECK",
  PRINT_PDF_FAILED: "orders.detail.notes.PRINT_PDF_FAILED",
  SAMPLE_ORDER: "orders.detail.notes.SAMPLE_ORDER",
  SAMPLE_CREDIT: "orders.detail.notes.SAMPLE_CREDIT",
  SAMPLE_CREDITED: "orders.detail.notes.SAMPLE_CREDITED",
};

/** Timeline entry text for an event; internal codes are hidden from buyers. */
function eventText(t: TFunction, type: ProductionEventType, note: string | null, internal: boolean, refunded = false): { content: string; detail?: string } | null {
  const code = note?.match(/^([A-Z_]+)(?::(.*))?$/);
  if (type === "NOTE") {
    if (code && NOTE_KEYS[code[1]]) {
      const key = NOTE_KEYS[code[1]];
      return { content: t(key, { number: code[2] ?? "" }), detail: code[1] === "DISPUTE_OPENED" && code[2] ? t(`orders.dispute.reasons.${code[2]}` as DictKey) : undefined };
    }
    if (code) return internal ? { content: note! } : null;
    // R4 (vendor audit): free-text notes are written by the vendor to the Elba team ("Only you and the
    // Elba team can see notes"), so buyers never see them (they could also carry contact details).
    return note && internal ? { content: t("orders.detail.events.NOTE"), detail: note } : null;
  }
  // R7-01: a refund closes the order with a CANCELLED event; say "cancelled and refunded" there.
  const key = (refunded && type === "CANCELLED" ? "buyer.refund.event" : `orders.detail.events.${type}`) as DictKey;
  // Unknown event types (written by a newer service) show a neutral label, never the raw key.
  const content = t(key) === key ? t("buyer.refund.unknownEvent") : t(key);
  if (!note) return { content };
  if (type === "PAYMENT_CONFIRMED") return { content, detail: t(`paymentMethods.${note as PaymentMethod}` as DictKey) };
  if (type === "ORDER_PLACED" && code?.[1] === "REORDER") return { content, detail: t("orders.detail.notes.REORDER", { number: code[2] ?? "" }) };
  // B-04: proof approved with red print-check issues ("PREFLIGHT:1E/0W:ACK", written by the service).
  if (type === "PROOF_APPROVED" && code?.[1] === "PREFLIGHT" && note!.endsWith(":ACK")) return { content, detail: t("orders.detail.notes.PREFLIGHT_OVERRIDE") };
  // R7-02: buyers never see free text on an event. Vendors and staff write these notes through the
  // status API (a decline reason, a QC remark) and they can carry contact details or internal
  // wording (managed marketplace, B-08). Only the courier's tracking number on SHIPPED is shown.
  if (!internal && type !== "SHIPPED") return { content };
  return { content, detail: note };
}

function timelineGroups(order: OrderDetail, t: TFunction, locale: Locale, internal: boolean): TimelineGroup[] {
  const groups = new Map<string, TimelineGroup>();
  const today = formatDate(new Date(), locale);
  for (const e of [...order.productionEvents].reverse()) {
    const text = eventText(t, e.type as ProductionEventType, e.note, internal, order.status === "REFUNDED");
    if (!text) continue;
    const day = formatDate(e.createdAt, locale);
    const g = groups.get(day) ?? { title: day === today ? t("orders.detail.today") : day, events: [] };
    g.events.push({
      id: e.id,
      content: text.detail ? `${text.content}: ${text.detail}` : text.content,
      time: <time dateTime={e.createdAt.toISOString()}>{new Intl.DateTimeFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-EG", { timeStyle: "short", timeZone: "Africa/Cairo" }).format(e.createdAt)}</time>,
      tone: e.type === "CANCELLED" || e.type === "QC_REJECTED" ? "critical" : e.type === "DELIVERED" || e.type === "PAYMENT_CONFIRMED" ? "success" : "default",
    });
    groups.set(day, g);
  }
  return [...groups.values()];
}

/** /[locale]/orders/[id] — order tracking (buyer; vendor staff and admins can also view). */
export default async function OrderPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { locale: raw, id } = await params;
  const { paid } = await searchParams;
  const locale = toLocale(raw);
  const t = getT(locale);
  const user = await requireUser(locale, `/${locale}/orders/${encodeURIComponent(id)}`);
  let order = await getOrderForViewer(id, user);
  if (order?.status === "SHIPPED") {
    await syncShipments(order.id);
    order = await getOrderForViewer(id, user);
  }

  if (!order) {
    return (
      <Page title={t("orders.title")} narrowWidth backAction={{ content: t("orders.detail.back"), url: `/${locale}/orders` }}>
        <Card>
          <EmptyState heading={t("buyer.orderNotFound.title")} image={<EmptyBoxIllustration />} action={<Button url={`/${locale}/orders`}>{t("buyer.orderNotFound.action")}</Button>}>
          {t("buyer.orderNotFound.body")}
        </EmptyState>
        </Card>
      </Page>
    );
  }

  const status = order.status as OrderStatus;
  const isBuyer = order.buyerId === user.id;
  const internal = user.role !== "BUYER";
  const badge = statusTone(status);
  const money = moneyOf(order);
  const address = fromJson<ShippingAddress>(order.shippingAddress);
  const govKey = governorateKey(address.governorate);
  const vendorName = pick(locale, order.vendor.nameAr, order.vendor.nameEn);
  const paidSum = order.payments.filter((p) => p.status === "PAID").reduce((s, p) => s + p.amountPiasters, 0);
  const paidMethod = order.payments.find((p) => p.status === "PAID")?.method as PaymentMethod | undefined;
  // R7-01: money returned on a refunded order is shown, with the method it went back to.
  const refundedSum = order.payments.filter((p) => p.status === "REFUNDED").reduce((s, p) => s + p.amountPiasters, 0);
  const refundedMethod = order.payments.find((p) => p.status === "REFUNDED")?.method as PaymentMethod | undefined;
  const invoice = order.invoices.find((i) => i.kind === "SALE");
  const proof = order.items[0]?.proof ?? null;
  const myReview = order.reviews.find((r) => r.authorId === user.id);
  const openDisputeRow = order.disputes.find((d) => d.status === "OPEN" || d.status === "UNDER_REVIEW");
  // R5-JR-16: the outcome of the latest closed report (and the free reprint, if any) for the buyer.
  const closedDispute = openDisputeRow ? null : (order.disputes[0] ?? null);
  const reprintOrder =
    closedDispute?.status === "RESOLVED_REPRINT"
      ? await db.order.findFirst({ where: { buyerId: order.buyerId, notes: { startsWith: `REPRINT_OF:${order.number}:${closedDispute.id}` } }, select: { id: true, number: true } })
      : null;
  const terminal = status === "CANCELLED" || status === "REFUNDED";
  const eventTypes = order.productionEvents.map((e) => e.type as ProductionEventType);
  const firstOf = (type: ProductionEventType) => order!.productionEvents.find((e) => e.type === type)?.createdAt;
  const stepDates: Partial<Record<(typeof BUYER_TRACK)[number], Date | null | undefined>> = {
    PROOF_APPROVED: firstOf("PROOF_APPROVED") ?? proof?.approvedAt,
    PAID: order.paidAt,
    PRINTER_ACCEPTED: firstOf("VENDOR_ACCEPTED"),
    IN_PRODUCTION: firstOf("PRODUCTION_STARTED"),
    QC_PASSED: firstOf("QC_APPROVED"),
    SHIPPED: firstOf("SHIPPED"),
    DELIVERED: order.deliveredAt,
  };
  const current = terminal ? buyerTrackStopped(eventTypes) : buyerTrackIndex(status);
  const stepAt = (s: (typeof BUYER_TRACK)[number]) => BUYER_TRACK.indexOf(s);
  const shipmentAhead = !terminal && current <= stepAt("SHIPPED");
  const qcAhead = !terminal && current <= stepAt("QC_PASSED");
  const steps = BUYER_TRACK.map((s, i) => ({
    id: s,
    label: t(`orders.detail.steps.${s}` as DictKey),
    description: stepDates[s] && i < current ? formatDate(stepDates[s]!, locale) : undefined,
  }));
  // R1-14: four plain stages up front; the seven production steps sit behind a disclosure.
  const simpleCurrent = terminal ? buyerSimpleStopped(eventTypes) : buyerSimpleIndex(status);
  const simpleDates: Record<BuyerSimpleStep, Date | null | undefined> = {
    RECEIVED: order.paidAt ?? order.placedAt,
    PRINTING: firstOf("PRODUCTION_STARTED") ?? firstOf("VENDOR_ACCEPTED"),
    ON_THE_WAY: firstOf("SHIPPED"),
    DELIVERED: order.deliveredAt,
  };
  const simpleSteps = BUYER_SIMPLE_TRACK.map((s, i) => ({
    id: s,
    label: t(`orders.detail.simple.${s}` as DictKey),
    description: simpleDates[s] && i < simpleCurrent ? formatDate(simpleDates[s]!, locale) : undefined,
  }));
  const itemName = (item: OrderDetail["items"][number]) =>
    boxName({ modelCode: item.modelCode, structureCode: item.structureCode, dims: fromJson<Dims>(item.dims) }, locale, t(`structures.${item.structureCode}` as DictKey));
  // R2-01: the buyer price, as on every page before payment: what was charged ex-VAT (print, setup,
  // delivery, minus the prepay discount) over the boxes. The engine's split stays behind "Price details".
  const netPiasters = money.totalPiasters - money.vatPiasters;
  const boxCount = order.items.reduce((s, i) => s + i.quantity, 0);
  const isSample = isSampleLines(money.lines);
  const inclKey: DictKey = isSample ? "buyer.easy.inclDelivery" : money.discountPiasters > 0 ? "buyer.easy.inclAll" : "buyer.easy.inclNoDiscount";
  const vendorCityKey = `cities.${order.vendor.city}` as DictKey;
  const vendorCity = t(vendorCityKey) === vendorCityKey ? null : t(vendorCityKey);

  const primary =
    isBuyer && status === "PENDING_PAYMENT" ? (
      <Button variant="primary" url={`/${locale}/checkout/pay/${order.id}`}>
        {t("orders.detail.payNow")}
      </Button>
    ) : isBuyer && isPaidStatus(status) && proof ? (
      // Reorder leads once the boxes have arrived; before that it stays a quiet secondary action.
      <ReorderButton orderId={order.id} locale={locale} primary={status === "DELIVERED"} />
    ) : undefined;

  return (
    <Page
      title={t("orders.detail.title", { number: order.number })}
      titleMetadata={
        // R2-10: a buyer reads one status, the tracker stage; staff keep payment + fulfilment badges.
        !internal ? (
          <Badge tone={badge.tone} progress={badge.progress}>
            {t(buyerStatusKey(status) as DictKey)}
          </Badge>
        ) : (
        <InlineStack gap="100">
          {paidSum > 0 || !terminal ? (
            <Badge tone={paymentTone(paidSum > 0 ? "PAID" : "PENDING").tone} progress={paymentTone(paidSum > 0 ? "PAID" : "PENDING").progress}>
              {paidSum > 0 ? t("payment.status.PAID") : t("payment.status.PENDING")}
            </Badge>
          ) : null}
          {status !== "PAID" && status !== "PENDING_PAYMENT" ? (
            <Badge tone={badge.tone} progress={badge.progress}>
              {t(`orderStatus.${status}` as DictKey)}
            </Badge>
          ) : null}
        </InlineStack>
        )
      }
      subtitle={t("orders.detail.placed", { date: formatDateTime(order.placedAt, locale) })}
      backAction={{ content: t("orders.detail.back"), url: `/${locale}/orders` }}
      primaryAction={primary}
      secondaryActions={invoice ? [{ content: t(sellerTaxReady() ? "orders.detail.invoice" : "buyer.receipt.view"), url: `/${locale}/orders/${order.id}/invoice`, icon: <Icon source={Receipt} /> }] : []}
    >
      <BlockStack gap="400">
        {paid && isPaidStatus(status) ? (
          <PaidHeader
            title={t("payment.paid")}
            body={order.dueDate ? t("buyer.successBody", { date: formatDate(order.dueDate, locale) }) : t("buyer.successBodyNoDate")}
            nextTitle={t("buyer.whatNext")}
            steps={[t("buyer.next1"), t("buyer.next2"), t("buyer.next3")]}
          />
        ) : null}
        {status === "PENDING_PAYMENT" && isBuyer ? (
          <Banner tone="warning" title={t("payment.pending")} action={{ content: t("orders.detail.payNow"), url: `/${locale}/checkout/pay/${order.id}` }} />
        ) : null}
        {terminal ? (
          <Banner
            tone={status === "REFUNDED" ? "critical" : "info"}
            action={isBuyer && proof?.designId ? { content: t("checkout.start.orderThis"), url: `/${locale}/checkout/${encodeURIComponent(proof.designId)}` } : undefined}
          >
            {t(status === "REFUNDED" ? "orders.detail.refundedNote" : "orders.detail.cancelledNote")}
          </Banner>
        ) : null}

        <Layout>
          <LayoutSection>
            <BlockStack gap="400">
              <Card title={t("orders.detail.progress")}>
                <BlockStack gap="300">
                  <Stepper steps={simpleSteps} current={simpleCurrent} currentTone={terminal ? "critical" : "default"} accessibilityLabel={t("orders.detail.progress")} />
                  {order.dueDate && !terminal && status !== "DELIVERED" ? (
                    <Text as="p" fontWeight="semibold">
                      {t("orders.detail.dueBy", { date: formatDate(order.dueDate, locale) })}
                    </Text>
                  ) : null}
                  <details className={styles.disclosure}>
                    <summary>{t("orders.detail.progressDetails")}</summary>
                    <Stepper steps={steps} current={current} currentTone={terminal ? "critical" : "default"} accessibilityLabel={t("orders.detail.progressDetails")} />
                  </details>
                </BlockStack>
              </Card>

              <Card title={t("orders.detail.items")}>
                <BlockStack gap="300">
                  {order.items.map((item) => {
                    // One item per order: it carries the whole buyer price (see netPiasters above).
                    const single = order!.items.length === 1;
                    const lineTotal = single ? netPiasters : item.lineTotalPiasters;
                    const unit = single ? Math.round(netPiasters / Math.max(1, boxCount)) : item.unitPiasters;
                    return (
                      <div className={styles.item} key={item.id}>
                        <Thumbnail source={item.proof?.previewUrl ?? modelPoster(item.modelCode, item.structureCode)} alt={itemName(item)} size="large" />
                        <div className={styles.itemBody}>
                          <BlockStack gap="100">
                            <InlineStack align="space-between" gap="200">
                              <Text as="h3" variant="headingSm">
                                {itemName(item)}
                              </Text>
                              <PriceTag alwaysDecimals amount={lineTotal} locale={locale} />
                            </InlineStack>
                            <Text as="p" variant="bodySm" tone="subdued">
                              {t(plainBoardKey(item.materialCode) ?? (`materials.${item.materialCode}` as DictKey))} · {finishLabel(item.config, item.finishCode, locale, (k) => t(k as DictKey))} · {t(`checkout.proof.sides${item.printSides === "BOTH" ? "BOTH" : "OUTSIDE"}` as DictKey)}
                            </Text>
                            <Text as="p" variant="bodySm" numeric>
                              <bdi>{item.quantity.toLocaleString("en-US")}</bdi> × <PriceTag alwaysDecimals amount={unit} size="small" locale={locale} />
                              {single ? (
                                <Text as="span" variant="bodySm" tone="subdued">
                                  {" "}
                                  {t("buyer.easy.perBoxNote")} ({t(inclKey)})
                                </Text>
                              ) : null}
                            </Text>
                            <InlineStack gap="300">
                              {item.proof ? (
                                <Link url={`/api/orders/${order!.id}/proof-pdf`}>
                                  <InlineStack gap="100" as="span" blockAlign="center">
                                    <Icon source={FileText} size="small" />
                                    {t("orders.detail.downloadProof")}
                                  </InlineStack>
                                </Link>
                              ) : null}
                              {/* R1-14: the print file is production's business; only staff get the link. */}
                              {internal && item.printPdfUrl && isPaidStatus(status) ? (
                                <Link url={item.printPdfUrl}>
                                  <InlineStack gap="100" as="span" blockAlign="center">
                                    <Icon source={Download} size="small" />
                                    {t("orders.detail.downloadPrint")}
                                  </InlineStack>
                                </Link>
                              ) : null}
                            </InlineStack>
                          </BlockStack>
                        </div>
                      </div>
                    );
                  })}
                </BlockStack>
              </Card>

              <Card title={t("orders.detail.payment")}>
                <BlockStack gap="300">
                  <Inset>
                    {/* R2-01: the visible rows add up: boxes (all-in, ex-VAT) + VAT = total. */}
                    <dl className={styles.lines}>
                      <div className={styles.line}>
                        <dt>
                          {isSample ? t("buyer.sample.line") : t("buyer.easy.boxes", { qty: boxCount })}
                          <Text as="span" variant="bodySm" tone="subdued">
                            {" "}
                            ({t(inclKey)})
                          </Text>
                        </dt>
                        <dd>
                          <PriceTag alwaysDecimals amount={netPiasters} size="small" locale={locale} />
                        </dd>
                      </div>
                      <div className={styles.line}>
                        <dt>{t("checkout.summary.vat")}</dt>
                        <dd>
                          <PriceTag alwaysDecimals amount={money.vatPiasters} size="small" locale={locale} />
                        </dd>
                      </div>
                      <div className={`${styles.line} ${styles.total}`}>
                        <dt>{t("checkout.summary.total")}</dt>
                        <dd>
                          <PriceTag alwaysDecimals amount={money.totalPiasters} locale={locale} />
                        </dd>
                      </div>
                    </dl>
                    {/* SIM-03: the engine's lines sit behind "Price details", under the rows above. */}
                    <details className={styles.disclosure}>
                      <summary>{t("buyer.easy.breakdown")}</summary>
                    <dl className={styles.lines}>
                      {money.lines ? (
                        money.lines.map((l, i) => (
                          <div className={styles.line} key={i}>
                            <dt>{t((l.labelKey === "pricing.line.shipping" ? "buyer.easy.delivery" : l.labelKey === "pricing.line.die" ? "buyer.easy.dieLine" : l.labelKey) as DictKey)}</dt>
                            <dd>
                              <PriceTag alwaysDecimals amount={l.totalPiasters} size="small" locale={locale} tone={l.totalPiasters < 0 ? "success" : "base"} />
                            </dd>
                          </div>
                        ))
                      ) : (
                        <>
                          <div className={styles.line}>
                            <dt>{t("pricing.line.product")}</dt>
                            <dd>
                              <PriceTag alwaysDecimals amount={money.goodsPiasters} size="small" locale={locale} />
                            </dd>
                          </div>
                          <div className={styles.line}>
                            <dt>{t("checkout.summary.shipping")}</dt>
                            <dd>
                              <PriceTag alwaysDecimals amount={money.shippingPiasters} size="small" locale={locale} />
                            </dd>
                          </div>
                        </>
                      )}
                      <div className={`${styles.line} ${styles.lineSub}`}>
                        <dt>{t("buyer.subtotalExVat")}</dt>
                        <dd>
                          <PriceTag alwaysDecimals amount={money.totalPiasters - money.vatPiasters} size="small" locale={locale} />
                        </dd>
                      </div>
                    </dl>
                    </details>
                  </Inset>
                  {refundedSum > 0 ? (
                    <Inset>
                      <div className={styles.line}>
                        <Text as="span">
                          {t("buyer.refund.line")}
                          {refundedMethod ? ` · ${t(`paymentMethods.${refundedMethod}` as DictKey)}` : ""}
                        </Text>
                        <PriceTag alwaysDecimals amount={refundedSum} locale={locale} tone="success" />
                      </div>
                    </Inset>
                  ) : null}
                  {paidSum > 0 || !terminal ? (
                  <Inset>
                    <div className={styles.line}>
                      <Text as="span">
                        {paidSum > 0 ? t("orders.detail.paid") : t("orders.detail.due")}
                        {paidMethod ? ` · ${t(`paymentMethods.${paidMethod}` as DictKey)}` : ""}
                      </Text>
                      <PriceTag alwaysDecimals amount={paidSum > 0 ? paidSum : money.totalPiasters} locale={locale} />
                    </div>
                  </Inset>
                  ) : null}
                  {invoice ? (
                    <InlineStack>
                      <Button variant="plain" url={`/${locale}/orders/${order.id}/invoice`}>
                        {t(sellerTaxReady() ? "orders.detail.invoice" : "buyer.receipt.view")}
                      </Button>
                    </InlineStack>
                  ) : null}
                </BlockStack>
              </Card>

              {/* R4-13: the "appears here later" empty states only while that stage is still ahead;
                  a delivered or cancelled order without a record does not promise one. */}
              {order.shipments.length === 0 && !shipmentAhead ? null : (
              <Card title={t("orders.detail.shipment")}>
                {order.shipments.length === 0 ? (
                  <Text as="p" tone="subdued">
                    {t("orders.detail.noShipment")}
                  </Text>
                ) : (
                  <BlockStack gap="400">
                    {order.shipments.map((s) => {
                      const events = fromJson<TrackingEvent[]>(s.events) ?? [];
                      const sStatus = s.status as ShipmentStatus;
                      return (
                        <BlockStack gap="200" key={s.id}>
                          <dl className={styles.dl}>
                            <dt>{t("orders.detail.courier")}</dt>
                            <dd>{t(`shipment.provider.${s.provider === "bosta" ? "bosta" : s.provider === "vendor_van" ? "vendor_van" : "mock"}` as DictKey)}</dd>
                            <dt>{t("orders.detail.tracking")}</dt>
                            <dd>
                              <bdi className={styles.hash}>{s.trackingNumber ?? "-"}</bdi>
                            </dd>
                          </dl>
                          <div>
                            <Badge tone={sStatus === "DELIVERED" ? "success" : sStatus === "RETURNED" ? "critical" : "info"} progress={sStatus === "DELIVERED" ? "complete" : "partiallyComplete"}>
                              {t(`shipment.status.${sStatus}` as DictKey)}
                            </Badge>
                          </div>
                          <ol className={styles.track}>
                            {[...events].reverse().map((e, i) => (
                              <li key={i}>
                                <Text as="span">{t(`shipment.status.${e.status}` as DictKey)}</Text>
                                <Text as="span" tone="subdued" variant="bodySm">
                                  <time dateTime={e.at}>{formatDateTime(e.at, locale)}</time>
                                </Text>
                              </li>
                            ))}
                          </ol>
                          {s.trackingNumber && s.provider !== "vendor_van" ? (
                            <Link url={`https://bosta.co/tracking-shipments?shipment-number=${encodeURIComponent(s.trackingNumber)}`} external>
                              {t("orders.detail.trackOnline")}
                            </Link>
                          ) : null}
                        </BlockStack>
                      );
                    })}
                  </BlockStack>
                )}
              </Card>
              )}

              {order.qcPhotos.length === 0 && !qcAhead ? null : (
              <Card title={t("orders.detail.qc")}>
                <BlockStack gap="300">
                  <Text as="p" variant="bodySm" tone="subdued">
                    {t("orders.detail.qcHelp")}
                  </Text>
                  {/* R4 (vendor audit): buyers see QC photos once Elba ops approved them (the file route enforces it too). */}
                  {order.qcPhotos.filter((p) => internal || p.status === "APPROVED").length === 0 ? (
                    <Text as="p" tone="subdued">
                      {t("orders.detail.noQc")}
                    </Text>
                  ) : (
                    <ul className={styles.qcGrid}>
                      {order.qcPhotos.filter((p) => internal || p.status === "APPROVED").map((p) => {
                        const kind = ["FIRST_SHEET", "PACKED_BUNDLE"].includes(p.kind) ? p.kind : "OTHER";
                        const st = ["APPROVED", "REJECTED"].includes(p.status) ? p.status : "PENDING";
                        return (
                          <li key={p.id} className={styles.qcItem}>
                            <a href={p.url} target="_blank" rel="noreferrer">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img className={styles.qcImg} src={p.url} alt={t(`orders.detail.qcKind.${kind}` as DictKey)} loading="lazy" />
                            </a>
                            <Text as="span" variant="bodySm">
                              {t(`orders.detail.qcKind.${kind}` as DictKey)}
                            </Text>
                            <div>
                              <Badge tone={st === "APPROVED" ? "success" : st === "REJECTED" ? "critical" : "attention"} size="small">
                                {t(`orders.detail.qcStatus.${st}` as DictKey)}
                              </Badge>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </BlockStack>
              </Card>
              )}

              {isBuyer && myReview ? (
                <Card title={t("orders.review.title")}>
                  <BlockStack gap="100">
                    <Text as="p" fontWeight="semibold">
                      {t("orders.review.yours", { n: myReview.rating })}
                    </Text>
                    {myReview.body ? <Text as="p">{myReview.body}</Text> : null}
                  </BlockStack>
                </Card>
              ) : isBuyer && canReview(status, false) ? (
                <ReviewForm orderId={order.id} />
              ) : null}

              {isBuyer && openDisputeRow ? (
                <Card title={t("orders.dispute.title")}>
                  {/* Takes focus when the report form is replaced by this card after sending (a11y R6-AX-07). */}
                  <div id="dispute-open" tabIndex={-1}>
                    <InlineStack gap="200" blockAlign="center">
                      <Text as="p">{t("orders.dispute.open", { reason: t(`orders.dispute.reasons.${openDisputeRow.reason}` as DictKey) })}</Text>
                      <Badge tone="attention">{t(`orders.dispute.status.${openDisputeRow.status as DisputeStatus}` as DictKey)}</Badge>
                    </InlineStack>
                  </div>
                </Card>
              ) : null}
              {isBuyer && closedDispute ? (
                <Card title={t("orders.dispute.outcomeTitle")}>
                  <BlockStack gap="200">
                    <InlineStack gap="200" blockAlign="center">
                      <Text as="p">{t("orders.dispute.last", { reason: t(`orders.dispute.reasons.${closedDispute.reason}` as DictKey) })}</Text>
                      <Badge tone={closedDispute.status === "REJECTED" ? undefined : "success"}>{t(`orders.dispute.status.${closedDispute.status as DisputeStatus}` as DictKey)}</Badge>
                    </InlineStack>
                    {reprintOrder ? <Link url={`/${locale}/orders/${reprintOrder.id}`}>{t("orders.dispute.reprintLink", { number: reprintOrder.number })}</Link> : null}
                  </BlockStack>
                </Card>
              ) : null}
              {isBuyer && !openDisputeRow && canOpenDispute(status, order.deliveredAt) ? <DisputeForm orderId={order.id} /> : null}

              <Card title={t("orders.detail.timeline")}>
                <Timeline groups={timelineGroups(order, t, locale, internal)} />
              </Card>
            </BlockStack>
          </LayoutSection>

          <LayoutSection variant="oneThird" as="aside" aria-label={t("orders.detail.printer")}>
            <BlockStack gap="400">
              {/* R1-13: Elba picked the printer and answers for the order; the buyer reads that promise,
                  not a printer profile with a rating to judge. Staff keep the printer's details. */}
              <Card title={t("orders.detail.printer")}>
                {internal ? (
                  <BlockStack gap="100">
                    <Link url={`/${locale}/vendors/${order.vendor.slug}`}>{vendorName}</Link>
                    <Text as="p" variant="bodySm" tone="subdued">
                      {pick(locale, order.vendor.cityAr, order.vendor.cityEn)}
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      {order.vendor.ratingCount > 0 ? <bdi>{t("checkout.offers.ratingShort", { rating: order.vendor.rating.toFixed(1), count: order.vendor.ratingCount })}</bdi> : t("store.vendor.newBadge")}
                      {order.vendor.onTimePublic ? ` · ${t("checkout.offers.onTime", { pct: Math.round(order.vendor.onTimePct) })}` : ""}
                    </Text>
                  </BlockStack>
                ) : (
                  <BlockStack gap="100">
                    <Text as="p" fontWeight="semibold">
                      {vendorCity ? t("buyer.easy.printerTitle", { city: vendorCity }) : t("buyer.easy.printerTitleNoCity")}
                    </Text>
                    <Text as="p" tone="subdued">
                      {t("orders.detail.printerBody")}
                    </Text>
                  </BlockStack>
                )}
              </Card>

              <Card title={t("orders.detail.address")}>
                <BlockStack gap="050">
                  {/* R4-CR-02: what the buyer typed (often Latin in an Arabic page) is isolated per part,
                      so "14 Abbas El Akkad St" never reverses around the Arabic labels and commas. */}
                  <Text as="p">
                    <bdi>{address.name}</bdi>
                  </Text>
                  <Text as="p">
                    <IsolatedList
                      sep={locale === "ar" ? "، " : ", "}
                      parts={[address.street, address.building, address.floor && `${t("checkout.address.floor")} ${address.floor}`, address.apartment && `${t("checkout.address.apartment")} ${address.apartment}`]}
                    />
                  </Text>
                  <Text as="p">
                    <IsolatedList sep={locale === "ar" ? "، " : ", "} parts={[address.city, govKey ? t(`governorates.${govKey}` as DictKey) : address.governorate]} />
                  </Text>
                  {address.landmark ? (
                    <Text as="p" tone="subdued" variant="bodySm">
                      <bdi>{address.landmark}</bdi>
                    </Text>
                  ) : null}
                  <Text as="p">
                    <bdi>{formatEgyptPhone(address.phone)}</bdi>
                  </Text>
                </BlockStack>
              </Card>

              {proof ? (
                <Card title={t("orders.detail.proof")}>
                  <dl className={styles.dl}>
                    {proof.approvedAt ? (
                      <>
                        <dt>{t("orders.detail.proofApproved", { date: "" }).trim()}</dt>
                        <dd>{formatDateTime(proof.approvedAt, locale)}</dd>
                      </>
                    ) : null}
                  </dl>
                  {/* SIM-11 / R1-14: version and file fingerprint are records for disputes; buyers never
                      see them (a hash labelled «البصمة» read as foil stamping). Staff keep them. */}
                  <details className={styles.disclosure}>
                    <summary>{t("buyer.easy.proof.details")}</summary>
                    <dl className={styles.dl}>
                      {/* The board grade behind the plain name on the item line ("Natural brown cardboard"). */}
                      {order.items
                        .filter((i) => plainBoardKey(i.materialCode))
                        .slice(0, 1)
                        .map((i) => (
                          <Fragment key={i.id}>
                            <dt>{t("checkout.proof.material")}</dt>
                            <dd>{t(`materials.${i.materialCode}` as DictKey)}</dd>
                          </Fragment>
                        ))}
                      {order.items.slice(0, 1).map((i) => (
                        <Fragment key={`size-${i.id}`}>
                          <dt>{t("checkout.proof.size")}</dt>
                          <dd>{formatDimsCm(fromJson<Dims>(i.dims), locale)}</dd>
                        </Fragment>
                      ))}
                      {internal ? (
                        <>
                          <dt>{t("orders.detail.proofVersion", { version: "" }).trim()}</dt>
                          <dd>
                            <bdi>{proof.version}</bdi>
                          </dd>
                          <dt>{t("orders.detail.proofHash")}</dt>
                          <dd>
                            <span className={styles.hash} title={proof.hash}>
                              {proof.hash.slice(0, 16)}…
                            </span>
                          </dd>
                        </>
                      ) : null}
                    </dl>
                  </details>
                </Card>
              ) : null}

              {isBuyer && canBuyerCancel(status) ? (
                <Card>
                  <CancelOrderButton orderId={order.id} />
                </Card>
              ) : null}
            </BlockStack>
          </LayoutSection>
        </Layout>
      </BlockStack>
    </Page>
  );
}
