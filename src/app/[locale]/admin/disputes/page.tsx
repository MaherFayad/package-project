import type { Metadata } from "next";
import { Suspense } from "react";
import { getT, toLocale } from "@/i18n";
import { DisputesIndex } from "@/components/admin/DisputesIndex";
import { loadDisputes } from "@/components/admin/server/queries";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = getT(toLocale((await params).locale));
  return { title: `${t("admin.disputes.title")} · ${t("admin.title")}` };
}

export default async function AdminDisputesPage() {
  const rows = await loadDisputes();
  return (
    <Suspense>
      <DisputesIndex rows={rows} />
    </Suspense>
  );
}
