import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";

/**
 * R5-PL-03 (platform → admin): the record is checked HERE, above the Suspense boundary, so an
 * unknown dispute answers a real 404 (a notFound() inside the streaming boundary answered 200). The
 * page keeps its own check.
 *
 * No Suspense boundary here on purpose: under load the page streamed into a hidden segment while
 * React also client-rendered the boundary, so the admin order page showed two copies of its banner
 * (journeys J5 on mobile). The detail page renders in one pass; list pages keep their skeleton.
 */
export default async function Layout({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const key = (() => {
    try {
      return decodeURIComponent(raw);
    } catch {
      return ""; // malformed escape: not a record
    }
  })();
  if (!(/^[\w-]{1,40}$/.test(key) && (await db.dispute.findUnique({ where: { id: key }, select: { id: true } })))) notFound();
  return children;
}
