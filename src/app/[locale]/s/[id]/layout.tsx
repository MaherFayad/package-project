import { Suspense, type ReactNode } from "react";
import { notFound } from "next/navigation";
import { getShared } from "./shared";

/**
 * Share-link guard. The token is checked HERE, above the loading and hydration boundaries, so an
 * unknown, revoked or anonymous design's link answers a real 404 instead of 200 + noindex.
 */
export default async function ShareLayout({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Same rules as the page (token shape, an account owns the design, the document parses).
  if (!(await getShared(id))) notFound();
  return <Suspense fallback={null}>{children}</Suspense>;
}
