import { requireAdminPage } from "@/lib/auth/session";
import type { Metadata } from "next";
import { Suspense } from "react";
import { getT, toLocale } from "@/i18n";
import { AuditIndex } from "@/components/admin/AuditIndex";
import { loadAudit } from "@/components/admin/server/queries";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = getT(toLocale((await params).locale));
  return { title: `${t("admin.audit.title")} · ${t("admin.title")}` };
}

export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<{ entity?: string; action?: string; q?: string }> }) {
  await requireAdminPage(); // R6-SEC-09: the layout redirect does not stop this page rendering
  const sp = await searchParams;
  const rows = await loadAudit({ entityType: sp.entity ?? null, action: sp.action ?? null, q: sp.q?.slice(0, 100) ?? null });
  return (
    <Suspense>
      <AuditIndex rows={rows.map((r) => ({ ...r, before: r.before === null ? null : JSON.stringify(r.before, null, 2), after: r.after === null ? null : JSON.stringify(r.after, null, 2) }))} />
    </Suspense>
  );
}
