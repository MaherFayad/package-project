import type { OrderStatus } from "@/types";
import type { WebhookOutcome } from "@/lib/payments";

/**
 * What to do with a verified gateway webhook (pure, no DB) — the decision half of
 * `applyPaymentOutcome()` in ./service. Kept pure so every branch is unit-tested.
 *
 * A valid signature alone is not enough (OWASP ASVS 4.0.3 V11.1.1 business-logic sequence,
 * V13.2 / Top 10 A04:2021 insecure design): Paymob's HMAC does NOT cover `merchant_order_id`, so a
 * buyer who sees one signed callback (it is echoed on the redirect URL) could replay it against
 * another Payment of the same amount. We therefore bind every webhook to the gateway order we
 * created for that Payment, and check provider, currency and amount before touching the order.
 */
export type PaymentDecision =
  | { action: "IGNORE"; result: "DUPLICATE" | "ALREADY_PAID" | "REFUND_WITHOUT_PAYMENT" }
  | { action: "PARTIAL_REFUND" }
  | { action: "REJECT"; result: "PROVIDER_MISMATCH" | "REFERENCE_MISMATCH" | "CURRENCY_MISMATCH" | "AMOUNT_MISMATCH" }
  | { action: "PENDING" | "FAILED" | "REFUNDED" | "PAID" | "PAID_LATE" };

export interface StoredPayment {
  provider: string;
  status: string;
  amountPiasters: number;
  /** Gateway order/intention reference recorded when the payment was started. */
  gatewayRef: string | null;
}

export type VerifiedOutcome = Extract<WebhookOutcome, { ok: true }>;

/** The gateway reference a Payment row was bound to at `createIntention()` time. */
export function storedGatewayRef(p: { provider: string; providerRef: string | null; raw: unknown }): string | null {
  const intention = (p.raw && typeof p.raw === "object" ? (p.raw as { intention?: { gatewayOrderId?: unknown } }).intention : undefined) ?? undefined;
  const g = intention?.gatewayOrderId;
  if (typeof g === "string" && g) return g;
  // Mock payments (and seed rows) bind to the providerRef the mock gateway issued.
  return p.provider === "mock" ? p.providerRef : null;
}

export function decidePaymentOutcome(payment: StoredPayment, orderStatus: OrderStatus, o: VerifiedOutcome): PaymentDecision {
  if (o.provider && o.provider !== payment.provider) return { action: "REJECT", result: "PROVIDER_MISMATCH" };
  // Binding: the callback must be about the gateway order we opened for THIS payment.
  if (!payment.gatewayRef || !o.gatewayRef || o.gatewayRef !== payment.gatewayRef) return { action: "REJECT", result: "REFERENCE_MISMATCH" };
  if (o.currency && o.currency.toUpperCase() !== "EGP") return { action: "REJECT", result: "CURRENCY_MISMATCH" };

  if (payment.status === o.status) return { action: "IGNORE", result: "DUPLICATE" };
  if (payment.status === "PAID" && o.status !== "REFUNDED") return { action: "IGNORE", result: "ALREADY_PAID" };
  if (payment.status === "REFUNDED") return { action: "IGNORE", result: "DUPLICATE" };

  if (o.status === "PENDING") return { action: "PENDING" };
  if (o.status === "FAILED") return { action: "FAILED" };
  if (o.status === "REFUNDED") {
    // A refund can only follow money we actually captured.
    if (payment.status !== "PAID") return { action: "IGNORE", result: "REFUND_WITHOUT_PAYMENT" };
    // Part of the money went back: ops handles the rest; the order and its invoice stay as they are.
    if (o.partialRefund) return { action: "PARTIAL_REFUND" };
    return { action: "REFUNDED" };
  }
  // PAID
  if (!Number.isInteger(o.amountPiasters) || o.amountPiasters !== payment.amountPiasters) return { action: "REJECT", result: "AMOUNT_MISMATCH" };
  return orderStatus === "PENDING_PAYMENT" ? { action: "PAID" } : { action: "PAID_LATE" };
}
