import type { Locale, PaymentMethod, PaymentStatus, Piasters } from "@/types";

/**
 * Payment gateway adapter (report §7.1). The platform is the merchant of record: the buyer pays
 * Elba through a licensed gateway (Paymob in production, a mock in dev), never the vendor.
 *
 * Flow: checkout creates a Payment row (PENDING) → `createIntention()` → the buyer completes it
 * (card page, wallet, Fawry outlet, InstaPay transfer) → the gateway calls
 * POST /api/payments/webhook → `handleWebhook()` verifies the signature and reports the outcome
 * → `applyPaymentOutcome()` (src/lib/orders/service) marks the order PAID. Webhooks are the only way an
 * order becomes paid; redirects back from the gateway are informational.
 */
export interface IntentionInput {
  /** Our Payment.id — sent to the gateway as its merchant reference and echoed in webhooks. */
  paymentId: string;
  orderNumber: string;
  amountPiasters: Piasters;
  method: PaymentMethod;
  customer: { name: string; phone: string; email?: string };
  /** Where the gateway sends the buyer back (order page). */
  returnUrl: string;
  /** Where the gateway posts results. */
  webhookUrl: string;
  locale: Locale;
}

export interface Intention {
  /** Gateway-side id (Paymob intention/order id, mock id). Stored on Payment.providerRef. */
  providerRef: string;
  method: PaymentMethod;
  status: "PENDING" | "REQUIRES_ACTION";
  /** Hosted checkout page (Paymob unified checkout). Mock: none (handled in-page). */
  redirectUrl?: string;
  /** Paymob client secret for the unified checkout. */
  clientSecret?: string;
  /** Fawry: code to pay at any Fawry outlet before `expiresAt`. */
  fawry?: { referenceCode: string; expiresAt: string };
  /** InstaPay: transfer to this address with this reference; ops confirm by hand. */
  instapay?: { address: string; reference: string };
  /**
   * Gateway order the webhook will report (Paymob `intention_order_id`, mock: providerRef).
   * Stored on Payment.raw.intention and compared with every webhook (see orders/payment-rules).
   */
  gatewayOrderId?: string;
}

export interface WebhookRequest {
  headers: Headers;
  /** Raw body text, exactly as received (signatures cover the raw bytes or exact fields). */
  rawBody: string;
  query: URLSearchParams;
}

export type WebhookOutcome =
  | {
      ok: true;
      /** Our Payment.id (merchant reference). */
      paymentId: string;
      providerRef: string;
      status: Extract<PaymentStatus, "PAID" | "FAILED" | "PENDING" | "REFUNDED">;
      amountPiasters: Piasters;
      /** Sanitised payload to store on Payment.raw (no card data). */
      raw: Record<string, unknown>;
      /** Which adapter verified it. */
      provider?: "mock" | "paymob";
      /** Signed gateway order reference (Paymob `order.id`), bound to the stored Payment. */
      gatewayRef?: string;
      /** ISO currency from the signed payload (must be EGP). */
      currency?: string;
      /**
       * REFUNDED callbacks only: the gateway reported a refund of LESS than the captured amount.
       * A partial refund must not move the whole order to REFUNDED (it is recorded for ops).
       */
      partialRefund?: boolean;
    }
  | { ok: false; error: "INVALID_SIGNATURE" | "INVALID_PAYLOAD" | "UNSUPPORTED_EVENT" };

export interface RefundInput {
  providerRef: string;
  amountPiasters: Piasters;
  reason?: string;
}

export interface RefundResult {
  ok: boolean;
  refundRef?: string;
  error?: string;
}

export interface PaymentProvider {
  readonly name: "mock" | "paymob";
  createIntention(input: IntentionInput): Promise<Intention>;
  handleWebhook(req: WebhookRequest): Promise<WebhookOutcome>;
  refund(input: RefundInput): Promise<RefundResult>;
}
