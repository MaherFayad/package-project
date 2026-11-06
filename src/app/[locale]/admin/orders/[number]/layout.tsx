import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";

/**
 * R5-PL-03 (platform → admin): the record is checked HERE, above the Suspense boundary, so an
 * unknown order answers a real 404 (a notFound() inside the streaming boundary answered 200). The
 * page keeps its own check.
 *
 * No Suspense boundary here on purpose: under load the page streamed into a hidden segment while
 * React also client-rendered the boundary, so the admin order page showed two copies of its banner
 * (journeys J5 on mobile). The detail page renders in one pass; list pages keep their skeleton.
 */
export default async function Layout({ children, params }: { children: ReactNode; params: Promise<{ number: string }> }) {
  const { number: raw } = await params;
  const key = (() => {
    try {
      return decodeURIComponent(raw);
    } catch {
      return ""; // malformed escape: not a record
    }
  })();
  if (!(/^[\w-]{1,64}$/.test(key) && (await db.order.findFirst({ where: { OR: [{ number: key }, { id: key }] }, select: { id: true } })))) notFound();
  return children;
}
