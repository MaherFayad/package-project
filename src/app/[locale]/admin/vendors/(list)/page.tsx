import { requireAdminPage } from "@/lib/auth/session";
import type { Metadata } from "next";
import { Suspense } from "react";
import { getT, toLocale } from "@/i18n";
import { VendorsIndex } from "@/components/admin/VendorsIndex";
import { loadVendorRows } from "@/components/admin/server/queries";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = getT(toLocale((await params).locale));
  return { title: `${t("admin.vendors.title")} · ${t("admin.title")}` };
}

export default async function AdminVendorsPage() {
  await requireAdminPage(); // R6-SEC-09: the layout redirect does not stop this page rendering
  const { vendors, applications } = await loadVendorRows();
  return (
    <Suspense>
      <VendorsIndex vendors={vendors} applications={applications} />
    </Suspense>
  );
}
