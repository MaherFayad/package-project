import type { Metadata } from "next";
import { Suspense } from "react";
import { getT, toLocale } from "@/i18n";
import { PayoutsIndex } from "@/components/admin/PayoutsIndex";
import { loadPayoutRows } from "@/components/admin/server/queries";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = getT(toLocale((await params).locale));
  return { title: `${t("admin.payouts.title")} · ${t("admin.title")}` };
}

export default async function AdminPayoutsPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = toLocale((await params).locale);
  const rows = await loadPayoutRows(locale);
  return (
    <Suspense>
      <PayoutsIndex rows={rows} />
    </Suspense>
  );
}
