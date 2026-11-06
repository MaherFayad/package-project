import { Suspense, type ReactNode } from "react";
import { notFound } from "next/navigation";
import { getVendorBySlug } from "@/components/store/data";

/**
 * Printer profile guard. The slug is checked HERE, above the hydration Suspense boundary (the
 * (detail) shell has none of its own), so an unknown printer answers a real 404 (inside the boundary notFound() streams as
 * 200; R4-MK-09). The page keeps its own check and ISR settings.
 */
export default async function PrinterLayout({ children, params }: { children: ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!(await getVendorBySlug(slug))) notFound();
  return <Suspense fallback={null}>{children}</Suspense>;
}
