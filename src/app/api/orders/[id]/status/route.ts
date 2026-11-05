import { z } from "zod";
import { ORDER_STATUSES } from "@/types";
import { apiRequireRole } from "@/lib/auth";
import { OrderTransitionError } from "@/lib/orders/state";
import { OrderError, actorOf, shipOrder, transitionOrder } from "@/lib/orders/service";

/**
 * POST /api/orders/:id/status — move an order along the state machine (vendor staff for their
 * own orders, admins for any). Body: { to: OrderStatus, note?: string }. `to: "SHIPPED"` also
 * books the courier and returns the tracking number. Buyers use the order page actions instead.
 *
 * 200 { ok, trackingNumber? } · 400 INVALID_BODY · 401/403 · 404 · 409 INVALID_TRANSITION | FORBIDDEN_TRANSITION | INVALID_STATE
 */
const Body = z.object({ to: z.enum(ORDER_STATUSES), note: z.string().trim().max(500).optional() });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await apiRequireRole(["VENDOR", "ADMIN"]);
  if (user instanceof Response) return user;
  const { id } = await params;
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success || !/^[\w-]{1,64}$/.test(id)) return Response.json({ error: "INVALID_BODY" }, { status: 400 });
  try {
    if (p.data.to === "SHIPPED") {
      const r = await shipOrder(id, actorOf(user));
      return Response.json({ ok: true, trackingNumber: r.trackingNumber });
    }
    await transitionOrder(id, p.data.to, actorOf(user), p.data.note);
    return Response.json({ ok: true });
  } catch (e) {
    if (e instanceof OrderTransitionError) return Response.json({ error: e.code }, { status: 409 });
    if (e instanceof OrderError) {
      const status = e.code === "NOT_FOUND" ? 404 : e.code === "FORBIDDEN" ? 403 : 409;
      return Response.json({ error: e.code }, { status });
    }
    throw e;
  }
}
