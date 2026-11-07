import { Suspense, type ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { toLocale } from "@/i18n";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { canViewBuyerOrder, canViewOrder } from "@/lib/orders/state";
import { VENDOR_VISIBLE_STATUSES } from "@/components/vendor/lib/jobs";
import type { OrderStatus } from "@/types";

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
  const order = await db.order.findFirst({ where: { OR: [{ id }, { number: id }] }, select: { number: true, status: true, buyerId: true, vendorId: true, paidAt: true } });
  if (!order) notFound();
  if (!canViewBuyerOrder(order, user)) {
    // R11-01: buyer pages carry the buyer's address and phone, so printer staff never see them
    // (R5-SEC-01); the order's own printer is sent to its job page, everyone else gets the same 404.
    if (user.role !== "BUYER" && canViewOrder(order, user) && VENDOR_VISIBLE_STATUSES.includes(order.status as OrderStatus)) redirect(`/${locale}/vendor/jobs/${encodeURIComponent(order.number)}`);
    notFound();
  }
  return <Suspense fallback={null}>{children}</Suspense>;
}
