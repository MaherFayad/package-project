import { requireAdminPage } from "@/lib/auth/session";
import type { Metadata } from "next";
import { Suspense } from "react";
import { db } from "@/lib/db";
import { getT, pick, toLocale } from "@/i18n";
import { OrdersIndex } from "@/components/admin/OrdersIndex";
import { loadOrderRows } from "@/components/admin/server/queries";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = getT(toLocale((await params).locale));
  return { title: `${t("admin.orders.title")} · ${t("admin.title")}` };
}

export default async function AdminOrdersPage({ params }: { params: Promise<{ locale: string }> }) {
  await requireAdminPage(); // R6-SEC-09: the layout redirect does not stop this page rendering
  const locale = toLocale((await params).locale);
  const [rows, vendors, openDisputes] = await Promise.all([
    loadOrderRows(locale),
    db.vendor.findMany({ orderBy: { nameEn: "asc" }, select: { id: true, nameAr: true, nameEn: true } }),
    db.dispute.count({ where: { status: { in: ["OPEN", "UNDER_REVIEW"] } } }),
  ]);
  return (
    <Suspense>
      <OrdersIndex rows={rows} vendors={vendors.map((v) => ({ id: v.id, name: pick(locale, v.nameAr, v.nameEn) }))} openDisputes={openDisputes} />
    </Suspense>
  );
}
