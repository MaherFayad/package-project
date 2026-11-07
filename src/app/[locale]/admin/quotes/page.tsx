import { requireAdminPage } from "@/lib/auth/session";
import type { Metadata } from "next";
import { Suspense } from "react";
import { getT, toLocale } from "@/i18n";
import { QuoteLeadsIndex } from "@/components/admin/QuoteLeadsIndex";
import { loadQuoteLeads, loadQuoteVendors } from "@/components/admin/server/queries";
import { loadPricingConfig } from "@/components/admin/server/settings";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = getT(toLocale((await params).locale));
  return { title: `${t("admin.quotes.title")} · ${t("admin.title")}` };
}

export default async function AdminQuotesPage({ params }: { params: Promise<{ locale: string }> }) {
  await requireAdminPage(); // R6-SEC-09: the layout redirect does not stop this page rendering
  const now = new Date();
  const locale = toLocale((await params).locale);
  const [rows, vendors, config] = await Promise.all([loadQuoteLeads(locale, now), loadQuoteVendors(locale), loadPricingConfig()]);
  return (
    <Suspense>
      <QuoteLeadsIndex rows={rows} now={now.toISOString()} vendors={vendors} validityHours={config.quoteValidityHours} />
    </Suspense>
  );
}
