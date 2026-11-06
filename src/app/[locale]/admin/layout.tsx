import type { ReactNode } from "react";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getDictionary, toLocale } from "@/i18n";
import { I18nProvider } from "@/i18n/client";
import { AppProvider } from "@/components/ui";
import { AdminFrame } from "@/components/admin/AdminFrame";
import { countModeration, countOpenQuoteLeads, countPayoutsToAct } from "@/components/admin/server/queries";

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Admin area (owner: admin). Role ADMIN required for every page; server actions check the role
 * again on their own. Renders the single <main id="main"> through <Frame>.
 */
export default async function AdminLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const locale = toLocale((await params).locale);
  const user = await requireRole("ADMIN", locale, `/${locale}/admin`);
  // Orders badge = jobs ops must act on: QC review plus paid orders still waiting for a vendor.
  const [qc, applications, disputes, dataRequests, payouts, moderation, quotes] = await Promise.all([
    db.order.count({ where: { status: { in: ["QC_PENDING", "PAID"] } } }),
    db.vendorApplication.count({ where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } } }),
    db.dispute.count({ where: { status: { in: ["OPEN", "UNDER_REVIEW"] } } }),
    db.dataRequest.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    countPayoutsToAct(),
    countModeration(),
    countOpenQuoteLeads(),
  ]);
  return (
    // Full dictionary: the root layout leaves the admin namespace out of public pages.
    <I18nProvider locale={locale} dict={getDictionary(locale)}>
    <AppProvider locale={locale}>
      <AdminFrame locale={locale} userName={user.name ?? user.phone} counts={{ qc, applications, disputes, dataRequests, payouts, moderation, quotes }}>
        {children}
      </AdminFrame>
    </AppProvider>
    </I18nProvider>
  );
}
