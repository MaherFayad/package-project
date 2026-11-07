import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { Dims, OrderStatus } from "@/types";
import { getT, toLocale, type DictKey } from "@/i18n";
import { fromJson } from "@/lib/json";
import { boxName } from "@/lib/orders/box-name";
import { modelPoster } from "@/lib/orders/poster";
import { requireUser } from "@/lib/auth/session";
import { formatEgyptPhone } from "@/lib/phone";
import { mockPaymentsEnabled, paymentConfig } from "@/lib/payments";
import { getOrderForViewer, moneyOf, paymentView } from "@/lib/orders/service";
import { isQuoteValid } from "@/lib/orders/totals";
import { supportContact } from "@/lib/support";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState, EmptyBoxIllustration } from "@/components/ui/EmptyState";
import { Page } from "@/components/ui/Page";
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
  const item = order.items[0];

  return (
    <PaymentClient
      locale={locale}
      orderId={order.id}
      number={order.number}
      boxLabel={item ? boxName({ modelCode: item.modelCode, structureCode: item.structureCode, dims: fromJson<Dims>(item.dims) }, locale, t(`structures.${item.structureCode}` as DictKey)) : t("buyer.order")}
      thumbnail={item?.proof?.previewUrl ?? modelPoster(item?.modelCode, item?.structureCode)}
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
      support={supportContact()}
      deliveryDays={order.dueDate ? Math.max(1, Math.round((order.dueDate.getTime() - order.placedAt.getTime()) / 86_400_000)) : null}
      walletPhone={formatEgyptPhone(user.phone)}
    />
  );
}
