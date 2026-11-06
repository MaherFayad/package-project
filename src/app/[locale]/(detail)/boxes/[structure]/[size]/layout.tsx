import { Suspense, type ReactNode } from "react";
import { notFound } from "next/navigation";
import { parseValidSize, structureFromSlug } from "@/components/store/catalog";

/**
 * Size landing guard. Style and size are checked HERE, above the hydration Suspense boundary
 * (the (detail) shell has none of its own), so an unknown style or an out-of-range size answers a real 404 (R4-MK-09).
 */
export default async function SizeLayout({ children, params }: { children: ReactNode; params: Promise<{ structure: string; size: string }> }) {
  const { structure, size } = await params;
  const code = structureFromSlug(structure);
  if (!code || !parseValidSize(code, size)) notFound();
  return <Suspense fallback={null}>{children}</Suspense>;
}
