import { formatTaxId } from "@/lib/orders/company";
import { governorateKey } from "@/lib/orders/governorates";
import type { Metadata } from "next";
import type { Dims, PaymentMethod, ShippingAddress } from "@/types";
import { getT, toLocale, type DictKey } from "@/i18n";
import { requireUser } from "@/lib/auth/session";
import { fromJson } from "@/lib/json";
import { formatDate, formatDims } from "@/lib/format";
import { getOrderForViewer, moneyOf } from "@/lib/orders/service";
import { invoiceBreakdown } from "@/lib/orders/totals";
import { Banner, BlockStack, Button, Card, InlineGrid, Inset, Page, PriceTag, Text } from "@/components/ui";
import { PrintButton } from "../../_components/PrintButton";
import styles from "../../_components/orders.module.css";

type Params = Promise<{ locale: string; id: string }>;
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getT(toLocale(locale))("orders.invoice.metaTitle", { number: "" }).trim(), robots: { index: false } };
}

/**
 * /[locale]/orders/[id]/invoice — tax invoice view (VAT 14% breakdown) with the Egyptian Tax
 * Authority e-invoice fields as placeholders until the ETA integration submits it.
 * Seller tax details come from ELBA_TAX_ID / ELBA_COMMERCIAL_REGISTER / ELBA_ETA_ACTIVITY_CODE.
 */
export default async function InvoicePage({ params }: { params: Params }) {
  const { locale: raw, id } = await params;
  const locale = toLocale(raw);
  const t = getT(locale);
  const user = await requireUser(locale, `/${locale}/orders/${encodeURIComponent(id)}/invoice`);
  const order = await getOrderForViewer(id, user);
  const back = { content: t("orders.invoice.back"), url: `/${locale}/orders/${order?.id ?? ""}` };
  const invoice = order?.invoices.find((i) => i.kind === "SALE");

  if (!order || !invoice) {
    return (
      <Page title={t("orders.title")} narrowWidth backAction={back}>
        <Banner tone="info">{order ? t("orders.invoice.notIssued") : t("checkout.errors.NOT_FOUND")}</Banner>
      </Page>
    );
  }

  const money = moneyOf(order);
  const b = invoiceBreakdown({ subtotalPiasters: money.netPiasters, vatPiasters: money.vatPiasters, shippingPiasters: money.shippingPiasters });
  const addr = fromJson<ShippingAddress>(order.shippingAddress);
  const placeholder = t("orders.invoice.placeholder");
  const paidMethod = order.payments.find((p) => p.status === "PAID")?.method as PaymentMethod | undefined;
  // R5-JR-03: the company frozen on the order at checkout; orders from before the snapshot (billing
  // null) fall back to the buyer's Organization as before.
  const billing = order.billing == null ? null : fromJson<{ company: { name: string; taxId: string; commercialRegister: string | null } | null }>(order.billing);
  const company = billing ? billing.company : order.buyer.organization ? { name: order.buyer.organization.name, taxId: order.buyer.organization.taxId ?? "", commercialRegister: order.buyer.organization.commercialRegister } : null;
  const buyerName = company?.name ?? order.buyer.name ?? addr.name;
  // Addresses store the canonical English governorate; the invoice shows it in the page language.
  const govKey = governorateKey(addr.governorate);
  const governorateLabel = govKey ? t(`governorates.${govKey}` as DictKey) : addr.governorate;

  return (
    <Page title={t("orders.invoice.title", { number: invoice.number })} subtitle={t("orders.detail.title", { number: order.number })} backAction={back} primaryAction={<PrintButton label={t("orders.invoice.print")} />}>
      <BlockStack gap="400">
        <Card>
          <div className={styles.invoice}>
            <BlockStack gap="400">
              <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
                <BlockStack gap="100">
                  <Text as="h2" variant="headingSm">
                    {t("orders.invoice.seller")}
                  </Text>
                  <Text as="p">{t("orders.invoice.sellerName")}</Text>
                  <Text as="p" tone="subdued">
                    {t("orders.invoice.sellerAddress")}
                  </Text>
                  <Text as="p" variant="bodySm">
                    {t("orders.invoice.taxId")}: <bdi>{process.env.ELBA_TAX_ID || placeholder}</bdi>
                  </Text>
                  <Text as="p" variant="bodySm">
                    {t("orders.invoice.commercialRegister")}: <bdi>{process.env.ELBA_COMMERCIAL_REGISTER || placeholder}</bdi>
                  </Text>
                </BlockStack>
                <BlockStack gap="100">
                  <Text as="h2" variant="headingSm">
                    {t("orders.invoice.buyer")}
                  </Text>
                  <Text as="p">{buyerName}</Text>
                  <Text as="p" tone="subdued">
                    {[addr.street, addr.city, governorateLabel].filter(Boolean).join(locale === "ar" ? "، " : ", ")}
                  </Text>
                  <Text as="p" variant="bodySm">
                    {t("orders.invoice.buyerTaxId")}: <bdi>{company?.taxId ? formatTaxId(company.taxId) : "-"}</bdi>
                  </Text>
                  <Text as="p" variant="bodySm">
                    {t("orders.invoice.issued")}: {formatDate(invoice.issuedAt, locale, "long")}
                  </Text>
                  <Text as="p" variant="bodySm">
                    {t("orders.invoice.orderRef")}: <bdi>{order.number}</bdi>
                  </Text>
                </BlockStack>
              </InlineGrid>

              <div className={styles.tableWrap}>
                <table className={styles.invTable} role="table">
                  <caption className="visually-hidden">{t("orders.invoice.title", { number: invoice.number })}</caption>
                  <thead role="rowgroup">
                    <tr role="row">
                      <th role="columnheader" scope="col">{t("orders.invoice.description")}</th>
                      <th role="columnheader" scope="col" className={styles.num}>
                        {t("orders.invoice.qty")}
                      </th>
                      <th role="columnheader" scope="col" className={styles.num}>
                        {t("orders.invoice.unitPrice")}
                      </th>
                      <th role="columnheader" scope="col" className={styles.num}>
                        {t("orders.invoice.amount")}
                      </th>
                    </tr>
                  </thead>
                  <tbody role="rowgroup">
                    {order.items.map((it) => (
                      <tr key={it.id} role="row">
                        <td role="cell">
                          {t("orders.invoice.goods")}:{" "}
                          {t("orders.invoice.lineDesc", {
                            structure: t(`structures.${it.structureCode}` as DictKey),
                            dims: formatDims(fromJson<Dims>(it.dims), locale),
                            material: t(`materials.${it.materialCode}` as DictKey),
                          })}
                        </td>
                        <td role="cell" className={`${styles.num} ${styles.invQty}`}>{it.quantity.toLocaleString("en-US")}</td>
                        <td role="cell" className={styles.num}>
                          <PriceTag amount={it.unitPiasters} size="small" locale={locale} />
                        </td>
                        <td role="cell" className={styles.num}>
                          <PriceTag amount={it.lineTotalPiasters} size="small" locale={locale} />
                        </td>
                      </tr>
                    ))}
                    {(money.lines ?? []).filter((l) => l.kind !== "PRODUCT").map((l, i) => (
                      <tr key={`l${i}`} role="row">
                        <td role="cell">{t((l.labelKey === "pricing.line.shipping" ? "checkout.summary.shipping" : l.labelKey) as DictKey)}</td>
                        <td role="cell" className={`${styles.num} ${styles.invQty}`}>{l.quantity.toLocaleString("en-US")}</td>
                        <td role="cell" className={styles.num}>
                          <PriceTag amount={l.unitPiasters} size="small" locale={locale} />
                        </td>
                        <td role="cell" className={styles.num}>
                          <PriceTag amount={l.totalPiasters} size="small" locale={locale} />
                        </td>
                      </tr>
                    ))}
                    {!money.lines ? (
                      <tr role="row">
                        <td role="cell">{t("checkout.summary.shipping")}</td>
                        <td role="cell" className={`${styles.num} ${styles.invQty}`}>1</td>
                        <td role="cell" className={styles.num}>
                          <PriceTag amount={b.shippingPiasters} size="small" locale={locale} />
                        </td>
                        <td role="cell" className={styles.num}>
                          <PriceTag amount={b.shippingPiasters} size="small" locale={locale} />
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              <Inset>
                <dl className={styles.lines}>
                  <div className={styles.line}>
                    <dt>{t("orders.invoice.netTotal")}</dt>
                    <dd>
                      <PriceTag amount={b.netPiasters} locale={locale} />
                    </dd>
                  </div>
                  <div className={styles.line}>
                    <dt>{t("orders.invoice.vat")}</dt>
                    <dd>
                      <PriceTag amount={b.vatPiasters} locale={locale} />
                    </dd>
                  </div>
                  <div className={`${styles.line} ${styles.total}`}>
                    <dt>{t("orders.invoice.grandTotal")}</dt>
                    <dd data-testid="invoice-total">
                      <PriceTag amount={b.totalPiasters} locale={locale} />
                    </dd>
                  </div>
                </dl>
              </Inset>
              {paidMethod ? (
                <Text as="p" variant="bodySm" tone="subdued">
                  {t("orders.invoice.paidWith", { method: t(`paymentMethods.${paidMethod}` as DictKey) })}
                </Text>
              ) : null}
            </BlockStack>
          </div>
        </Card>

        <Card title={t("orders.invoice.eta")}>
          <BlockStack gap="300">
            <dl className={styles.dl}>
              <dt>{t("orders.invoice.etaUuid")}</dt>
              <dd>
                {invoice.etaUuid ? <bdi className={styles.hash}>{invoice.etaUuid}</bdi> : placeholder}
              </dd>
              <dt>{t("orders.invoice.etaStatus")}</dt>
              <dd>{invoice.etaStatus ?? t("orders.invoice.etaPending")}</dd>
              <dt>{t("orders.invoice.etaDocType")}</dt>
              <dd>{t("orders.invoice.etaDocTypeValue")}</dd>
              <dt>{t("orders.invoice.etaInternalId")}</dt>
              <dd>
                <bdi>{invoice.number}</bdi>
              </dd>
              <dt>{t("orders.invoice.etaActivity")}</dt>
              <dd>
                <bdi>{process.env.ELBA_ETA_ACTIVITY_CODE || placeholder}</bdi>
              </dd>
              <dt>{t("orders.invoice.etaItemCode")}</dt>
              <dd>
                <bdi>{process.env.ELBA_ETA_ITEM_CODE || placeholder}</bdi>
              </dd>
            </dl>
            <Text as="p" variant="bodySm" tone="subdued">
              {t("orders.invoice.etaNote")}
            </Text>
            <div className={styles.noPrint}>
              <Button variant="plain" url={back.url}>
                {t("orders.invoice.back")}
              </Button>
            </div>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
