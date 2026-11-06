import { Suspense, type ReactNode } from "react";
import { notFound, permanentRedirect } from "next/navigation";
import { catalogueEntryFromParam } from "@/data/catalogue";
import { STRUCTURE_LIST } from "@/lib/dieline";

const CORE_SLUGS = new Set(STRUCTURE_LIST.map((s) => s.slug));

/**
 * Catalogue model guard (page owner: catalogue). The slug is checked HERE, above the hydration
 * Suspense boundary (the (detail) shell has none of its own): inside it, the old-URL 308 and the
 * unknown-model 404 would both stream as 200 (R4-MK-09). Same rules as the page.
 */
export default async function CatalogueModelLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  if (!catalogueEntryFromParam(slug)) {
    // Old structure URLs (/catalog/<structure>) moved to /boxes/<structure>.
    if (CORE_SLUGS.has(slug)) permanentRedirect(`/${locale}/boxes/${encodeURIComponent(slug)}`);
    notFound();
  }
  return <Suspense fallback={null}>{children}</Suspense>;
}
