import { Suspense, type ReactNode } from "react";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { AdminLoading } from "@/components/admin/AdminLoading";

/**
 * R5-PL-03 (platform → admin): the record is checked HERE, above the Suspense boundary, so an
 * unknown order answers a real 404 (a notFound() inside the streaming boundary answered 200). The
 * page keeps its own check; the skeleton boundary starts below this layout.
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
  return <Suspense fallback={<AdminLoading />}>{children}</Suspense>;
}
