import { Suspense, type ReactNode } from "react";
import { notFound } from "next/navigation";
import { toLocale } from "@/i18n";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { canViewOrder } from "@/lib/orders/state";

/**
 * Order guard (order page and invoice). The id is checked HERE, above the hydration Suspense
 * boundary: thrown inside it, notFound() streamed as 200 + noindex. An unknown order and another
 * buyer's order both answer the same 404 (never 403), so order ids cannot be probed.
 */
export default async function OrderLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string; id: string }> }) {
  const { locale: raw, id } = await params;
  const locale = toLocale(raw);
  const user = await requireUser(locale, `/${locale}/orders/${encodeURIComponent(id)}`);
  if (!/^[\w-]{1,64}$/.test(id)) notFound();
  const order = await db.order.findFirst({ where: { OR: [{ id }, { number: id }] }, select: { buyerId: true, vendorId: true, paidAt: true } });
  if (!order || !canViewOrder(order, user)) notFound();
  return <Suspense fallback={null}>{children}</Suspense>;
}
