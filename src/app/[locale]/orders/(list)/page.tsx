import type { Metadata } from "next";
import type { OrderStatus } from "@/types";
import { getT, toLocale, type DictKey } from "@/i18n";
import { boxName } from "@/lib/orders/box-name";
import { requireUser } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { listBuyerOrders } from "@/lib/orders/service";
import { isPaidStatus } from "@/lib/orders/state";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState, EmptyBoxIllustration } from "@/components/ui/EmptyState";
import { Page } from "@/components/ui/Page";
import { OrdersTable, type OrderRow } from "../_components/OrdersTable";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getT(toLocale(locale))("orders.metaTitle"), robots: { index: false } };
}

/** /[locale]/orders — the buyer's orders. */
export default async function OrdersPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  const user = await requireUser(locale, `/${locale}/orders`);
  const orders = await listBuyerOrders(user.id);

  const rows: OrderRow[] = orders.map((o) => {
    const status = o.status as OrderStatus;
    return {
      id: o.id,
      number: o.number,
      placedAt: o.placedAt.toISOString(),
      placedLabel: formatDate(o.placedAt, locale),
      box: o.items[0] ? boxName({ modelCode: o.items[0].modelCode, structureCode: o.items[0].structureCode }, locale, t(`structures.${o.items[0].structureCode}` as DictKey)) : "",
      quantity: o.items.reduce((s, i) => s + i.quantity, 0),
      totalPiasters: o.totalPiasters,
      status,
      paymentStatus: status === "REFUNDED" ? "REFUNDED" : isPaidStatus(status) || o.payments.some((p) => p.status === "PAID") ? "PAID" : "PENDING",
    };
  });

  return (
    <Page title={t("orders.title")} subtitle={t("orders.subtitle")} fullWidth primaryAction={rows.length ? { content: t("orders.emptyAction"), url: `/${locale}/design` } : undefined}>
      {rows.length === 0 ? (
        <Card>
          <EmptyState
            heading={t("orders.emptyTitle")}
            image={<EmptyBoxIllustration />}
            action={
              <Button variant="primary" url={`/${locale}/design`}>
                {t("orders.emptyAction")}
              </Button>
            }
          >
            {t("orders.emptyBody")}
          </EmptyState>
        </Card>
      ) : (
        <OrdersTable rows={rows} locale={locale} />
      )}
    </Page>
  );
}
