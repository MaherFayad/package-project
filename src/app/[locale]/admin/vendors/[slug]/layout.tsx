import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { isAdminSession } from "@/lib/auth/session";

/**
 * R5-PL-03 (platform → admin): the record is checked HERE, above the Suspense boundary, so an
 * unknown vendor answers a real 404 (a notFound() inside the streaming boundary answered 200). The
 * page keeps its own check.
 *
 * No Suspense boundary here on purpose: under load the page streamed into a hidden segment while
 * React also client-rendered the boundary, so the admin order page showed two copies of its banner
 * (journeys J5 on mobile). The detail page renders in one pass; list pages keep their skeleton.
 */
export default async function Layout({ children, params }: { children: ReactNode; params: Promise<{ slug: string }> }) {
  // R6-SEC-02: no lookup for a non-admin (the admin layout redirects them): same answer either way.
  if (!(await isAdminSession())) return null;
  const { slug: raw } = await params;
  const key = (() => {
    try {
      return decodeURIComponent(raw);
    } catch {
      return ""; // malformed escape: not a record
    }
  })();
  if (!(/^[\w-]{1,80}$/.test(key) && (await db.vendor.findUnique({ where: { slug: key }, select: { id: true } })))) notFound();
  return children;
}
