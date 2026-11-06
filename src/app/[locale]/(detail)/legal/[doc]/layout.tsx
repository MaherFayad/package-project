import { Suspense, type ReactNode } from "react";
import { notFound } from "next/navigation";
import { isLegalDoc } from "@/components/store/legal";

/**
 * Legal page guard. The doc id is checked HERE, above the hydration Suspense boundary (the
 * (detail) shell has none of its own), so an unknown doc answers a real 404 (R4-MK-09). This
 * replaces `dynamicParams = false`, which made every legal page 404 after an admin edit purged the
 * "/[locale]" layout path under `next start` (R8-01).
 */
export default async function LegalLayout({ children, params }: { children: ReactNode; params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  if (!isLegalDoc(doc)) notFound();
  return <Suspense fallback={null}>{children}</Suspense>;
}
