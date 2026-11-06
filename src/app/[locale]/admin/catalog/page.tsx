import { requireAdminPage } from "@/lib/auth/session";
import type { Metadata } from "next";
import { Suspense } from "react";
import { getT, toLocale } from "@/i18n";
import { CatalogManager } from "@/components/admin/CatalogManager";
import { loadCatalog } from "@/components/admin/server/queries";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = getT(toLocale((await params).locale));
  return { title: `${t("admin.catalog.title")} · ${t("admin.title")}` };
}

export default async function AdminCatalogPage() {
  await requireAdminPage(); // R6-SEC-09: the layout redirect does not stop this page rendering
  const data = await loadCatalog();
  return (
    <Suspense>
      <CatalogManager data={data} />
    </Suspense>
  );
}
