import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { OrderStatus } from "@/types";
import { getT, toLocale } from "@/i18n";
import { requireUser } from "@/lib/auth/session";
import { mockPaymentsEnabled, paymentConfig } from "@/lib/payments";
import { getOrderForViewer, moneyOf, paymentView } from "@/lib/orders/service";
import { isQuoteValid } from "@/lib/orders/totals";
import { Button, Card, EmptyState, EmptyBoxIllustration, Page } from "@/components/ui";
import { PaymentClient } from "../../_components/PaymentClient";

type Params = Promise<{ locale: string; orderId: string }>;
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getT(toLocale(locale))("payment.title"), robots: { index: false } };
}

/** /[locale]/checkout/pay/[orderId] — pay an order awaiting payment (buyer only). */
export default async function PayPage({ params }: { params: Params }) {
  const { locale: raw, orderId } = await params;
  const locale = toLocale(raw);
  const t = getT(locale);
  const user = await requireUser(locale, `/${locale}/checkout/pay/${encodeURIComponent(orderId)}`);
  const order = await getOrderForViewer(orderId, user);
  if (!order || order.buyerId !== user.id) {
    return (
      <Page title={t("payment.title")} narrowWidth>
        <Card>
          <EmptyState heading={t("checkout.errors.NOT_FOUND")} image={<EmptyBoxIllustration />} action={<Button url={`/${locale}/orders`}>{t("orders.title")}</Button>} />
        </Card>
      </Page>
    );
  }
  if ((order.status as OrderStatus) !== "PENDING_PAYMENT") redirect(`/${locale}/orders/${order.id}`);

  const cfg = paymentConfig();
  const pending = order.payments.filter((p) => p.status === "PENDING" && p.amountPiasters === order.totalPiasters).map(paymentView);
  const resume = pending.find((p) => p.fawry && new Date(p.fawry.expiresAt).getTime() > Date.now()) ?? pending.find((p) => p.instapay) ?? null;
  const money = moneyOf(order);
  const designId = order.items[0]?.proof?.designId ?? null;

  return (
    <PaymentClient
      locale={locale}
      orderId={order.id}
      number={order.number}
      vendorName={locale === "ar" ? order.vendor.nameAr : order.vendor.nameEn}
      quantity={order.items.reduce((s, i) => s + i.quantity, 0)}
      lines={money.lines ?? []}
      vatPiasters={order.vatPiasters}
      totalPiasters={order.totalPiasters}
      validUntil={order.quote?.validUntil.toISOString() ?? null}
      expired={order.quote ? !isQuoteValid(order.quote.validUntil) : false}
      restartUrl={designId ? `/${locale}/checkout/${designId}` : `/${locale}/checkout`}
      testMode={cfg.provider === "mock" && mockPaymentsEnabled()}
      fawryHours={cfg.fawryExpiryHours}
      methods={cfg.methods}
      resume={resume}
    />
  );
}
