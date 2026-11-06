import { apiRequireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { canViewOrder, proofPdfBytes } from "@/lib/orders/service";

/**
 * GET /api/orders/:id/proof-pdf — the approved proof as a WATERMARKED flat PDF ("PROOF - NOT FOR
 * PRINT", no crop marks) for the buyer's records. Buyer, vendor staff, admin.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await apiRequireRole();
  if (user instanceof Response) return user;
  const rl = rateLimit("orders:proof-pdf", user.id, 30, 600_000);
  if (!rl.ok) return Response.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } });
  const { id } = await params;
  if (!/^[\w-]{1,64}$/.test(id)) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  const order = await db.order.findUnique({ where: { id }, select: { id: true, buyerId: true, vendorId: true, status: true } });
  if (!order || !canViewOrder(order, user)) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  // Unpaid orders are never routed to a vendor; its staff must not see them (ASVS V4.2.1).
  if (user.role === "VENDOR" && order.buyerId !== user.id && order.status === "PENDING_PAYMENT") {
    return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  const file = await proofPdfBytes(order.id, "PROOF - NOT FOR PRINT");
  if (!file) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${file.filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
