import { z } from "zod";
import { ORDER_STATUSES, type OrderStatus } from "@/types";
import { apiRequireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { MONEY_STATUSES, OrderTransitionError } from "@/lib/orders/state";
import { OrderError, actorOf, shipOrder, transitionOrder } from "@/lib/orders/service";
import { vendorMoveAllowed } from "@/lib/orders/api-rules";
import { readJsonCapped } from "../../../_lib/body";

/**
 * POST /api/orders/:id/status — move an order along the state machine (vendor staff for their
 * own orders, admins for any). Body: { to: OrderStatus, note?: string }. `to: "SHIPPED"` also
 * books the courier and returns the tracking number. Buyers use the order page actions instead.
 *
 * Vendor moves obey the same job rules as the vendor portal (accept only while awaiting and not
 * declined, QC only with the required photos, active vendors only). PAID and REFUNDED are never
 * accepted here, not even from ADMIN: they belong to the verified payment webhook and the refund
 * flow (OWASP ASVS 4.0.3 V11.1.1-V11.1.2 business-logic order, Top 10 A01/A04:2021).
 *
 * 200 { ok, trackingNumber? } · 400 INVALID_BODY · 401/403 · 404 · 409 INVALID_TRANSITION |
 * FORBIDDEN_TRANSITION | INVALID_STATE | NOT_ALLOWED · 429 RATE_LIMITED
 */
const Body = z.object({ to: z.enum(ORDER_STATUSES), note: z.string().trim().max(500).optional() }).strict();

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await apiRequireRole(["VENDOR", "ADMIN"]);
  if (user instanceof Response) return user;
  const rl = rateLimit("orders:status", user.id, 60, 60_000);
  if (!rl.ok) return Response.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } });
  const { id } = await params;
  const json = await readJsonCapped(req, 4_096);
  if (json instanceof Response) return json;
  const p = Body.safeParse(json);
  if (!p.success || !/^[\w-]{1,64}$/.test(id)) return Response.json({ error: "INVALID_BODY" }, { status: 400 });
  const to = p.data.to as OrderStatus;
  if (MONEY_STATUSES.includes(to)) return Response.json({ error: "FORBIDDEN_TRANSITION" }, { status: 409 });

  if (user.role === "VENDOR") {
    const order = await db.order.findUnique({
      where: { id },
      select: {
        status: true,
        paidAt: true,
        vendorId: true,
        vendor: { select: { status: true } },
        productionEvents: { select: { type: true, createdAt: true } },
        qcPhotos: { select: { kind: true, status: true } },
      },
    });
    // Another vendor's order is a 404, not a 403, so order ids are not confirmed (ASVS V4.2.1).
    if (!order || !user.vendorId || order.vendorId !== user.vendorId) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
    if (order.vendor.status !== "ACTIVE") return Response.json({ error: "FORBIDDEN" }, { status: 403 });
    const verdict = vendorMoveAllowed({ status: order.status, paidAt: order.paidAt, events: order.productionEvents, qcPhotos: order.qcPhotos }, to);
    if (verdict !== "OK") return Response.json({ error: verdict }, { status: 409 });
  }

  try {
    if (to === "SHIPPED") {
      const r = await shipOrder(id, actorOf(user));
      return Response.json({ ok: true, trackingNumber: r.trackingNumber }, { headers: { "Cache-Control": "no-store" } });
    }
    await transitionOrder(id, to, actorOf(user), p.data.note);
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof OrderTransitionError) return Response.json({ error: e.code }, { status: 409 });
    if (e instanceof OrderError) {
      const status = e.code === "NOT_FOUND" || e.code === "FORBIDDEN" ? 404 : 409;
      return Response.json({ error: e.code === "FORBIDDEN" ? "NOT_FOUND" : e.code }, { status });
    }
    throw e;
  }
}
