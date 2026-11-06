import { paymentConfig, mockPaymentsEnabled } from "@/lib/payments";
import { processPaymentWebhook } from "@/lib/orders/service";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { readBodyCapped } from "../../_lib/body";

/**
 * POST /api/payments/webhook?provider=paymob|mock — gateway callbacks (owner: checkout).
 * The signature is verified by the provider adapter on the RAW body; unsigned or tampered calls
 * get 401 and change nothing. Processing is idempotent (gateways retry). Only the configured
 * provider is accepted (mock only when mock payments are enabled).
 *
 * 200 { ok: true, result } · 400 INVALID_PAYLOAD/UNKNOWN_PROVIDER · 401 INVALID_SIGNATURE · 429
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const requested = url.searchParams.get("provider") ?? paymentConfig().provider;
  const configured = paymentConfig().provider;
  if (requested !== configured || (requested === "mock" && !mockPaymentsEnabled())) {
    return Response.json({ ok: false, error: "UNKNOWN_PROVIDER" }, { status: 400 });
  }
  const rl = rateLimit("payments:webhook", clientIp(req.headers), 600, 60_000);
  if (!rl.ok) return Response.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 });

  const bytes = await readBodyCapped(req, 200_000);
  if (bytes instanceof Response) return Response.json({ ok: false, error: "INVALID_PAYLOAD" }, { status: 413 });
  const rawBody = new TextDecoder().decode(bytes);
  const outcome = await processPaymentWebhook(requested as "mock" | "paymob", { headers: req.headers, rawBody, query: url.searchParams });
  if (!outcome.ok) {
    const status = outcome.error === "INVALID_SIGNATURE" ? 401 : outcome.error === "UNSUPPORTED_EVENT" ? 200 : 400;
    return Response.json({ ok: false, error: outcome.error }, { status, headers: { "Cache-Control": "no-store" } });
  }
  // Signed but rejected by the business rules (wrong payment, amount or currency): acknowledged
  // with 200 so the gateway stops retrying, nothing changed, logged for ops.
  return Response.json({ ok: true, result: outcome.applied }, { headers: { "Cache-Control": "no-store" } });
}
