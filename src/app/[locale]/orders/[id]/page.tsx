import type { Metadata } from "next";
import { Download, FileText, Receipt } from "lucide-react";
import type { Dims, DisputeStatus, Locale, OrderStatus, PaymentMethod, ProductionEventType, ShipmentStatus, ShippingAddress } from "@/types";
import { getT, pick, toLocale, type DictKey, type TFunction } from "@/i18n";
import { requireUser } from "@/lib/auth/session";
import { fromJson } from "@/lib/json";
import { formatDate, formatDateTime, formatDims } from "@/lib/format";
import { formatEgyptPhone } from "@/lib/phone";
import { getOrderForViewer, moneyOf, syncShipments, type OrderDetail } from "@/lib/orders/service";
import { BUYER_STEPS, buyerStepIndex, canBuyerCancel, canOpenDispute, canReview, isPaidStatus, stoppedStepIndex } from "@/lib/orders/state";
import { paymentTone, statusTone } from "@/lib/orders/status-tone";
import { modelPoster } from "@/lib/orders/poster";
import { governorateKey } from "@/lib/orders/governorates";
import type { TrackingEvent } from "@/lib/shipping";
import {
  Badge,
  Banner,
  BlockStack,
  Button,
  Card,
  EmptyState,
  EmptyBoxIllustration,
  Icon,
  InlineStack,
  Inset,
  Layout,
  LayoutSection,
  Link,
  Page,
  PriceTag,
  Stepper,
  Text,
  Thumbnail,
  Timeline,
  type TimelineGroup,
} from "@/components/ui";
import { PaidHeader } from "../_components/PaidHeader";
import { CancelOrderButton, DisputeForm, ReorderButton, ReviewForm } from "../_components/OrderActions";
import styles from "../_components/orders.module.css";

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
function eventText(t: TFunction, type: ProductionEventType, note: string | null, internal: boolean): { content: string; detail?: string } | null {
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
  const content = t(`orders.detail.events.${type}` as DictKey);
  if (!note) return { content };
  if (type === "PAYMENT_CONFIRMED") return { content, detail: t(`paymentMethods.${note as PaymentMethod}` as DictKey) };
  if (type === "ORDER_PLACED" && code?.[1] === "REORDER") return { content, detail: t("orders.detail.notes.REORDER", { number: code[2] ?? "" }) };
  // B-04: proof approved with red print-check issues ("PREFLIGHT:1E/0W:ACK", written by the service).
  if (type === "PROOF_APPROVED" && code?.[1] === "PREFLIGHT" && note!.endsWith(":ACK")) return { content, detail: t("orders.detail.notes.PREFLIGHT_OVERRIDE") };
  if (code && !internal && type !== "SHIPPED") return { content };
  return { content, detail: note };
}

function timelineGroups(order: OrderDetail, t: TFunction, locale: Locale, internal: boolean): TimelineGroup[] {
  const groups = new Map<string, TimelineGroup>();
  const today = formatDate(new Date(), locale);
  for (const e of [...order.productionEvents].reverse()) {
    const text = eventText(t, e.type as ProductionEventType, e.note, internal);
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
          <EmptyState heading={t("checkout.errors.NOT_FOUND")} image={<EmptyBoxIllustration />} action={<Button url={`/${locale}/orders`}>{t("orders.title")}</Button>} />
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
  const invoice = order.invoices.find((i) => i.kind === "SALE");
  const proof = order.items[0]?.proof ?? null;
  const myReview = order.reviews.find((r) => r.authorId === user.id);
  const openDisputeRow = order.disputes.find((d) => d.status === "OPEN" || d.status === "UNDER_REVIEW");
  const terminal = status === "CANCELLED" || status === "REFUNDED";
  const eventTypes = order.productionEvents.map((e) => e.type as ProductionEventType);
  const firstOf = (type: ProductionEventType) => order!.productionEvents.find((e) => e.type === type)?.createdAt;
  const stepDates: Partial<Record<(typeof BUYER_STEPS)[number], Date | null | undefined>> = {
    PROOF_APPROVED: firstOf("PROOF_APPROVED") ?? proof?.approvedAt,
    PAID: order.paidAt,
    IN_PRODUCTION: firstOf("PRODUCTION_STARTED"),
    QC_PASSED: firstOf("QC_APPROVED"),
    SHIPPED: firstOf("SHIPPED"),
    DELIVERED: order.deliveredAt,
  };
  const current = terminal ? stoppedStepIndex(eventTypes) : buyerStepIndex(status);
  const stepAt = (s: (typeof BUYER_STEPS)[number]) => BUYER_STEPS.indexOf(s);
  const shipmentAhead = !terminal && current <= stepAt("SHIPPED");
  const qcAhead = !terminal && current <= stepAt("QC_PASSED");
  const steps = BUYER_STEPS.map((s, i) => ({
    id: s,
    label: t(`orders.detail.steps.${s}` as DictKey),
    description: stepDates[s] && i < current ? formatDate(stepDates[s]!, locale) : undefined,
  }));

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
      }
      subtitle={t("orders.detail.placed", { date: formatDateTime(order.placedAt, locale) })}
      backAction={{ content: t("orders.detail.back"), url: `/${locale}/orders` }}
      primaryAction={primary}
      secondaryActions={invoice ? [{ content: t("orders.detail.invoice"), url: `/${locale}/orders/${order.id}/invoice`, icon: <Icon source={Receipt} /> }] : []}
    >
      <BlockStack gap="400">
        {paid && isPaidStatus(status) ? (
          <PaidHeader
            title={t("payment.paid")}
            body={order.dueDate ? t("buyer.successBody", { vendor: vendorName, date: formatDate(order.dueDate, locale) }) : t("buyer.successBodyNoDate", { vendor: vendorName })}
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
                  <Stepper steps={steps} current={current} currentTone={terminal ? "critical" : "default"} accessibilityLabel={t("orders.detail.progress")} />
                  {order.dueDate && !terminal && status !== "DELIVERED" ? (
                    <Text as="p" variant="bodySm" tone="subdued">
                      {t("orders.detail.dueBy", { date: formatDate(order.dueDate, locale) })}
                    </Text>
                  ) : null}
                </BlockStack>
              </Card>

              <Card title={t("orders.detail.items")}>
                <BlockStack gap="300">
                  {order.items.map((item) => {
                    const dims = fromJson<Dims>(item.dims);
                    return (
                      <div className={styles.item} key={item.id}>
                        <Thumbnail source={item.proof?.previewUrl ?? modelPoster(item.modelCode, item.structureCode)} alt={t(`structures.${item.structureCode}` as DictKey)} size="large" />
                        <div className={styles.itemBody}>
                          <BlockStack gap="100">
                            <InlineStack align="space-between" gap="200">
                              <Text as="h3" variant="headingSm">
                                {t(`structures.${item.structureCode}` as DictKey)}
                              </Text>
                              <PriceTag amount={item.lineTotalPiasters} locale={locale} />
                            </InlineStack>
                            <Text as="p" variant="bodySm" tone="subdued">
                              {formatDims(dims, locale)} · {t(`materials.${item.materialCode}` as DictKey)} · {t(`finishes.${item.finishCode}` as DictKey)} ·{" "}
                              {t(`checkout.proof.sides${item.printSides === "BOTH" ? "BOTH" : "OUTSIDE"}` as DictKey)}
                            </Text>
                            <Text as="p" variant="bodySm" numeric>
                              <bdi>{item.quantity.toLocaleString("en-US")}</bdi> × <PriceTag amount={item.unitPiasters} size="small" locale={locale} />
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
                              {item.printPdfUrl && isPaidStatus(status) ? (
                                <Link url={item.printPdfUrl}>
                                  <InlineStack gap="100" as="span" blockAlign="center">
                                    <Icon source={Download} size="small" />
                                    {t("orders.detail.downloadPrint")}
                                  </InlineStack>
                                </Link>
                              ) : terminal || isPaidStatus(status) ? null : (
                                <Text as="span" variant="bodySm" tone="subdued">
                                  {t("orders.detail.printOnlyPaid")}
                                </Text>
                              )}
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
                    <dl className={styles.lines}>
                      {money.lines ? (
                        money.lines.map((l, i) => (
                          <div className={styles.line} key={i}>
                            <dt>{t((l.labelKey === "pricing.line.shipping" ? "checkout.summary.shipping" : l.labelKey) as DictKey)}</dt>
                            <dd>
                              <PriceTag amount={l.totalPiasters} size="small" locale={locale} />
                            </dd>
                          </div>
                        ))
                      ) : (
                        <>
                          <div className={styles.line}>
                            <dt>{t("pricing.line.product")}</dt>
                            <dd>
                              <PriceTag amount={money.goodsPiasters} size="small" locale={locale} />
                            </dd>
                          </div>
                          <div className={styles.line}>
                            <dt>{t("checkout.summary.shipping")}</dt>
                            <dd>
                              <PriceTag amount={money.shippingPiasters} size="small" locale={locale} />
                            </dd>
                          </div>
                        </>
                      )}
                      <div className={`${styles.line} ${styles.lineSub}`}>
                        <dt>{t("buyer.subtotalExVat")}</dt>
                        <dd>
                          <PriceTag amount={money.totalPiasters - money.vatPiasters} size="small" locale={locale} />
                        </dd>
                      </div>
                      <div className={styles.line}>
                        <dt>{t("checkout.summary.vat")}</dt>
                        <dd>
                          <PriceTag amount={money.vatPiasters} size="small" locale={locale} />
                        </dd>
                      </div>
                      <div className={`${styles.line} ${styles.total}`}>
                        <dt>{t("checkout.summary.total")}</dt>
                        <dd>
                          <PriceTag amount={money.totalPiasters} locale={locale} />
                        </dd>
                      </div>
                    </dl>
                  </Inset>
                  {paidSum > 0 || !terminal ? (
                  <Inset>
                    <div className={styles.line}>
                      <Text as="span">
                        {paidSum > 0 ? t("orders.detail.paid") : t("orders.detail.due")}
                        {paidMethod ? ` · ${t(`paymentMethods.${paidMethod}` as DictKey)}` : ""}
                      </Text>
                      <PriceTag amount={paidSum > 0 ? paidSum : money.totalPiasters} locale={locale} />
                    </div>
                  </Inset>
                  ) : null}
                  {invoice ? (
                    <InlineStack>
                      <Button variant="plain" url={`/${locale}/orders/${order.id}/invoice`}>
                        {t("orders.detail.invoice")}
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
                  <InlineStack gap="200" blockAlign="center">
                    <Text as="p">{t("orders.dispute.open", { reason: t(`orders.dispute.reasons.${openDisputeRow.reason}` as DictKey) })}</Text>
                    <Badge tone="attention">{t(`orders.dispute.status.${openDisputeRow.status as DisputeStatus}` as DictKey)}</Badge>
                  </InlineStack>
                </Card>
              ) : isBuyer && canOpenDispute(status, order.deliveredAt) ? (
                <DisputeForm orderId={order.id} />
              ) : null}

              <Card title={t("orders.detail.timeline")}>
                <Timeline groups={timelineGroups(order, t, locale, internal)} />
              </Card>
            </BlockStack>
          </LayoutSection>

          <LayoutSection variant="oneThird" as="aside" aria-label={t("orders.detail.printer")}>
            <BlockStack gap="400">
              <Card title={t("orders.detail.printer")}>
                <BlockStack gap="100">
                  <Link url={`/${locale}/vendors/${order.vendor.slug}`}>{vendorName}</Link>
                  <Text as="p" variant="bodySm" tone="subdued">
                    {pick(locale, order.vendor.cityAr, order.vendor.cityEn)}
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    <bdi>{t("checkout.offers.ratingShort", { rating: order.vendor.rating.toFixed(1), count: order.vendor.ratingCount })}</bdi> ·{" "}
                    {t("checkout.offers.onTime", { pct: Math.round(order.vendor.onTimePct) })}
                  </Text>
                </BlockStack>
              </Card>

              <Card title={t("orders.detail.address")}>
                <BlockStack gap="050">
                  <Text as="p">{address.name}</Text>
                  <Text as="p">
                    {[address.street, address.building, address.floor && `${t("checkout.address.floor")} ${address.floor}`, address.apartment && `${t("checkout.address.apartment")} ${address.apartment}`]
                      .filter(Boolean)
                      .join(locale === "ar" ? "، " : ", ")}
                  </Text>
                  <Text as="p">
                    {address.city}
                    {locale === "ar" ? "، " : ", "}
                    {govKey ? t(`governorates.${govKey}` as DictKey) : address.governorate}
                  </Text>
                  {address.landmark ? (
                    <Text as="p" tone="subdued" variant="bodySm">
                      {address.landmark}
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
                    <dt>{t("orders.detail.proofVersion", { version: "" }).trim()}</dt>
                    <dd>
                      <bdi>{proof.version}</bdi>
                    </dd>
                    {proof.approvedAt ? (
                      <>
                        <dt>{t("orders.detail.proofApproved", { date: "" }).trim()}</dt>
                        <dd>{formatDateTime(proof.approvedAt, locale)}</dd>
                      </>
                    ) : null}
                    <dt>{t("orders.detail.proofHash")}</dt>
                    <dd>
                      <span className={styles.hash} title={proof.hash}>
                        {proof.hash.slice(0, 16)}…
                      </span>
                    </dd>
                  </dl>
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
