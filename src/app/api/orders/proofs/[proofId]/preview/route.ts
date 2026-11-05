import { apiRequireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { getFile } from "@/lib/orders/storage";
import { canViewOrder } from "@/lib/orders/service";

/** GET /api/orders/proofs/:proofId/preview — the 3D render captured at approval (private). */
export async function GET(_req: Request, { params }: { params: Promise<{ proofId: string }> }) {
  const user = await apiRequireRole();
  if (user instanceof Response) return user;
  const { proofId } = await params;
  if (!/^[\w-]{1,64}$/.test(proofId)) return new Response(null, { status: 404 });
  const proof = await db.proof.findUnique({
    where: { id: proofId },
    select: { approvedById: true, orderItems: { select: { order: { select: { buyerId: true, vendorId: true } } } } },
  });
  const allowed =
    proof && (proof.approvedById === user.id || user.role === "ADMIN" || proof.orderItems.some((i) => canViewOrder(i.order, user)));
  if (!allowed) return new Response(null, { status: 404 });
  const bytes = await getFile(`proofs/${proofId}.img`);
  if (!bytes) return new Response(null, { status: 404 });
  const type = bytes[0] === 0x89 ? "image/png" : "image/jpeg";
  return new Response(new Uint8Array(bytes), { headers: { "Content-Type": type, "Cache-Control": "private, max-age=86400", "X-Content-Type-Options": "nosniff" } });
}
