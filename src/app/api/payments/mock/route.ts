import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { buildMockWebhook, mockCardOutcome, mockPaymentsEnabled, mockWalletOutcome, type MockWebhookBody } from "@/lib/payments";
import { processPaymentWebhook } from "@/lib/orders/service";
import { normalizeEgyptPhone } from "@/lib/phone";
import { readJsonCapped } from "../../_lib/body";

/**
 * POST /api/payments/mock — the mock gateway's "hosted page" (dev and e2e only).
 * Body: { paymentId, action: "card" | "wallet" | "fawry" | "instapay", cardNumber?, walletPhone? }
 * It decides the outcome like a real gateway would, then sends itself a SIGNED webhook through
 * the same verification path as production. Disabled unless mock payments are enabled.
 * Card/wallet/fawry: the buyer of the order. InstaPay confirmation: the buyer (simulating ops) or ADMIN.
 *
 * 200 { status: "PAID" | "FAILED" } · 400 INVALID_CARD | INVALID_BODY · 401 · 404 · 409 NOT_PENDING
 */
const Body = z.object({
  paymentId: z.string().regex(/^[\w-]{1,64}$/),
  action: z.enum(["card", "wallet", "fawry", "instapay"]),
  cardNumber: z.string().max(32).optional(),
  walletPhone: z.string().max(32).optional(),
});

const ACTION_METHOD = { card: "CARD", wallet: "WALLET", fawry: "FAWRY", instapay: "INSTAPAY" } as const;

export async function POST(req: Request) {
  if (!mockPaymentsEnabled()) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  const s = await getSession();
  if (!s) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const rl = rateLimit("payments:mock", s.user.id, 30, 60_000);
  if (!rl.ok) return Response.json({ error: "RATE_LIMITED" }, { status: 429 });
  const json = await readJsonCapped(req, 4_096);
  if (json instanceof Response) return json;
  const p = Body.safeParse(json);
  if (!p.success) return Response.json({ error: "INVALID_BODY" }, { status: 400 });
  const { paymentId, action } = p.data;

  const payment = await db.payment.findUnique({ where: { id: paymentId }, include: { order: true } });
  // Card / wallet / Fawry are paid by the order's buyer; only the InstaPay confirmation may also
  // come from ADMIN (simulating ops matching the transfer).
  const isBuyer = !!payment && payment.order.buyerId === s.user.id;
  if (!payment || (!isBuyer && !(s.user.role === "ADMIN" && action === "instapay"))) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  if (payment.provider !== "mock" || payment.method !== ACTION_METHOD[action]) return Response.json({ error: "INVALID_BODY" }, { status: 400 });
  if (payment.status !== "PENDING") return Response.json({ error: "NOT_PENDING", status: payment.status }, { status: 409 });

  let status: MockWebhookBody["status"] = "PAID";
  let reason: string | undefined;
  if (action === "card") {
    const r = mockCardOutcome(p.data.cardNumber ?? "");
    if (r === "INVALID") return Response.json({ error: "INVALID_CARD" }, { status: 400 });
    if (r === "DECLINED") {
      status = "FAILED";
      reason = "DECLINED";
    }
  }
  if (action === "wallet") {
    const phone = normalizeEgyptPhone(p.data.walletPhone ?? "");
    if (!phone) return Response.json({ error: "INVALID_WALLET" }, { status: 400 });
    if (mockWalletOutcome(phone) === "DECLINED") {
      status = "FAILED";
      reason = "DECLINED";
    }
  }

  const { rawBody, headers } = buildMockWebhook({
    type: "payment.updated",
    paymentId: payment.id,
    providerRef: payment.providerRef ?? `mock_${payment.id}`,
    status,
    amountPiasters: payment.amountPiasters,
    method: ACTION_METHOD[action],
    reason,
  });
  const outcome = await processPaymentWebhook("mock", { headers, rawBody, query: new URLSearchParams() });
  if (!outcome.ok) return Response.json({ error: outcome.error }, { status: 500 });
  if (outcome.applied !== "PAID" && outcome.applied !== "FAILED" && outcome.applied !== "PENDING") {
    // e.g. the order was cancelled meanwhile: report what really happened instead of "PAID".
    return Response.json({ error: "NOT_PENDING", result: outcome.applied }, { status: 409, headers: { "Cache-Control": "no-store" } });
  }
  return Response.json({ status, result: outcome.applied }, { headers: { "Cache-Control": "no-store" } });
}
