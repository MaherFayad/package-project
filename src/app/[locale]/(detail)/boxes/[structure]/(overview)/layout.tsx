import { Suspense, type ReactNode } from "react";
import { notFound } from "next/navigation";
import { getStructureBySlug } from "@/components/store/data";

/**
 * Box style guard. The slug is checked HERE, above the hydration Suspense boundary (the (detail)
 * shell has none of its own), so an unknown style answers a real 404 (R4-MK-09). This replaces
 * `dynamicParams = false`, which made every style 404 after an admin edit purged the "/[locale]"
 * layout path under `next start` (R8-01).
 */
export default async function StructureLayout({ children, params }: { children: ReactNode; params: Promise<{ structure: string }> }) {
  const { structure } = await params;
  if (!(await getStructureBySlug(structure))) notFound();
  return <Suspense fallback={null}>{children}</Suspense>;
}
