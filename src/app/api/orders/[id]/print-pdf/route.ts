import { apiRequireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { printPdfBytes } from "@/lib/orders/service";
import { canDownloadPrintFile } from "@/lib/orders/state";
import { rateLimit } from "@/lib/rate-limit";

/**
 * GET /api/orders/:id/print-pdf?item=<itemId> — print-ready dieline PDF. Only for paid orders:
 * the buyer and admins, and the order's vendor staff only once they ACCEPTED the job (same lock
 * as /api/vendor/jobs/:id/print-pdf). 404 otherwise, so ids are not confirmed (never free).
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await apiRequireRole();
  if (user instanceof Response) return user;
  const rl = rateLimit("orders:print-pdf", user.id, 30, 600_000);
  if (!rl.ok) return Response.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } });
  const { id } = await params;
  if (!/^[\w-]{1,64}$/.test(id)) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  const order = await db.order.findUnique({ where: { id }, select: { id: true, buyerId: true, vendorId: true, status: true, items: { select: { id: true }, take: 1 } } });
  if (!order || !canDownloadPrintFile(order, user)) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  const itemId = new URL(req.url).searchParams.get("item") ?? order.items[0]?.id ?? "";
  if (!/^[\w-]{1,64}$/.test(itemId)) return Response.json({ error: "NOT_AVAILABLE" }, { status: 404 });
  const file = await printPdfBytes(order.id, itemId);
  if (!file) return Response.json({ error: "NOT_AVAILABLE" }, { status: 404 });
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${file.filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
