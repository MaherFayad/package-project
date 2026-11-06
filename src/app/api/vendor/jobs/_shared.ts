import { db } from "@/lib/db";
import { apiRequireRole } from "@/lib/auth/session";

/**
 * Load an order item for a production-file download. Callers: the order's vendor staff, or ADMIN.
 * Returns a Response on failure (401/403/404).
 */
export async function loadJobItem(orderId: string, itemId: string | null) {
  const auth = await apiRequireRole(["VENDOR"]);
  if (auth instanceof Response) return auth;
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(orderId)) return new Response("Not found", { status: 404 });
  if (itemId !== null && !/^[A-Za-z0-9_-]{1,40}$/.test(itemId)) return new Response("Not found", { status: 404 });
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { proof: true } } },
  });
  // Vendors only see their own orders once paid (unpaid ones, and ones cancelled before payment,
  // are never routed to a vendor); a mismatch is a 404 so ids are not confirmed (ASVS V4.2.1).
  if (!order || (auth.role !== "ADMIN" && (!auth.vendorId || order.vendorId !== auth.vendorId || order.paidAt === null))) {
    return new Response("Not found", { status: 404 });
  }
  const item = itemId ? order.items.find((i) => i.id === itemId) : order.items[0];
  if (!item) return new Response("Not found", { status: 404 });
  return { user: auth, order, item };
}

export function safeFilename(s: string): string {
  return s.replace(/[^A-Za-z0-9_.-]+/g, "-");
}
