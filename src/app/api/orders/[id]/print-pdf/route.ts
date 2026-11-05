import { apiRequireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { canViewOrder, printPdfBytes } from "@/lib/orders/service";

/**
 * GET /api/orders/:id/print-pdf?item=<itemId> — print-ready dieline PDF. Only for PAID orders,
 * only for the buyer, the order's vendor staff and admins. 404 otherwise (never free).
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await apiRequireRole();
  if (user instanceof Response) return user;
  const { id } = await params;
  const order = await db.order.findUnique({ where: { id }, select: { id: true, buyerId: true, vendorId: true, items: { select: { id: true }, take: 1 } } });
  if (!order || !canViewOrder(order, user)) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  const itemId = new URL(req.url).searchParams.get("item") ?? order.items[0]?.id ?? "";
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
