import type { Metadata } from "next";
import { Suspense } from "react";
import { getT, toLocale } from "@/i18n";
import { QuoteLeadsIndex } from "@/components/admin/QuoteLeadsIndex";
import { loadQuoteLeads } from "@/components/admin/server/queries";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = getT(toLocale((await params).locale));
  return { title: `${t("admin.quotes.title")} · ${t("admin.title")}` };
}

export default async function AdminQuotesPage({ params }: { params: Promise<{ locale: string }> }) {
  const now = new Date();
  const rows = await loadQuoteLeads(toLocale((await params).locale), now);
  return (
    <Suspense>
      <QuoteLeadsIndex rows={rows} now={now.toISOString()} />
    </Suspense>
  );
}
