import { createHmac, timingSafeEqual } from "node:crypto";
import type { PaymentMethod } from "@/types";
import type { Intention, IntentionInput, PaymentProvider, RefundInput, RefundResult, WebhookOutcome, WebhookRequest } from "./types";

/**
 * Paymob adapter (skeleton; never called in dev, where PAYMENTS_PROVIDER=mock).
 *
 * Env:
 *   PAYMOB_SECRET_KEY     "Token <secret>" for the Intention + refund APIs
 *   PAYMOB_PUBLIC_KEY     for the unified checkout URL
 *   PAYMOB_API_KEY        legacy auth (kept for older endpoints / reconciliation scripts)
 *   PAYMOB_HMAC_SECRET    verifies transaction callbacks (HMAC-SHA512)
 *   PAYMOB_INTEGRATION_ID_CARD / _WALLET / _KIOSK / _INSTAPAY   integration ids per method
 *   PAYMOB_BASE_URL       default https://accept.paymob.com
 *
 * [VERIFY with Paymob before go-live]: field names of the Intention API, which reference-code
 * method (Fawry vs Aman/Masary kiosk) is enabled on our account, InstaPay availability, and the
 * settlement cycle (report §7.1).
 */
export interface PaymobConfig {
  baseUrl: string;
  secretKey: string;
  publicKey: string;
  apiKey: string;
  hmacSecret: string;
  integrationIds: Partial<Record<PaymentMethod, number>>;
}

export function paymobConfigFromEnv(env: Record<string, string | undefined> = process.env): PaymobConfig {
  const id = (v?: string) => (v && /^\d+$/.test(v) ? Number(v) : undefined);
  return {
    baseUrl: (env.PAYMOB_BASE_URL || "https://accept.paymob.com").replace(/\/+$/, ""),
    secretKey: env.PAYMOB_SECRET_KEY || "",
    publicKey: env.PAYMOB_PUBLIC_KEY || "",
    apiKey: env.PAYMOB_API_KEY || "",
    hmacSecret: env.PAYMOB_HMAC_SECRET || "",
    integrationIds: {
      CARD: id(env.PAYMOB_INTEGRATION_ID_CARD),
      WALLET: id(env.PAYMOB_INTEGRATION_ID_WALLET),
      FAWRY: id(env.PAYMOB_INTEGRATION_ID_KIOSK),
      INSTAPAY: id(env.PAYMOB_INTEGRATION_ID_INSTAPAY),
    },
  };
}

/** Fields of a TRANSACTION callback that Paymob's HMAC covers, in the documented order. */
export const PAYMOB_HMAC_FIELDS = [
  "amount_cents",
  "created_at",
  "currency",
  "error_occured",
  "has_parent_transaction",
  "id",
  "integration_id",
  "is_3d_secure",
  "is_auth",
  "is_capture",
  "is_refunded",
  "is_standalone_payment",
  "is_voided",
  "order.id",
  "owner",
  "pending",
  "source_data.pan",
  "source_data.sub_type",
  "source_data.type",
  "success",
] as const;

function get(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), obj);
}

/** The string Paymob signs: the field values concatenated (booleans as "true"/"false"). */
export function paymobHmacString(txn: unknown): string {
  return PAYMOB_HMAC_FIELDS.map((f) => {
    const v = get(txn, f);
    return v === undefined || v === null ? "" : String(v);
  }).join("");
}

export function paymobHmac(txn: unknown, secret: string): string {
  return createHmac("sha512", secret).update(paymobHmacString(txn), "utf8").digest("hex");
}

export function verifyPaymobHmac(txn: unknown, received: string, secret: string): boolean {
  if (!secret || !received || !/^[0-9a-f]+$/i.test(received)) return false;
  const expected = paymobHmac(txn, secret);
  if (expected.length !== received.length) return false;
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(received.toLowerCase(), "hex"));
}

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export class PaymobProvider implements PaymentProvider {
  readonly name = "paymob" as const;

  constructor(
    private readonly cfg: PaymobConfig = paymobConfigFromEnv(),
    private readonly fetcher: FetchLike = (url, init) => fetch(url, init),
  ) {}

  private requireKeys() {
    if (!this.cfg.secretKey || !this.cfg.publicKey) throw new Error("PAYMOB_NOT_CONFIGURED");
  }

  async createIntention(input: IntentionInput): Promise<Intention> {
    this.requireKeys();
    const integration = this.cfg.integrationIds[input.method];
    if (!integration) throw new Error(`PAYMOB_METHOD_NOT_ENABLED:${input.method}`);
    const [first, ...rest] = (input.customer.name || "Elba customer").split(/\s+/);
    const res = await this.fetcher(`${this.cfg.baseUrl}/v1/intention/`, {
      method: "POST",
      headers: { Authorization: `Token ${this.cfg.secretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: input.amountPiasters, // Paymob amounts are in cents = piasters
        currency: "EGP",
        payment_methods: [integration],
        items: [{ name: `Order ${input.orderNumber}`, amount: input.amountPiasters, quantity: 1 }],
        billing_data: {
          first_name: first || "NA",
          last_name: rest.join(" ") || "NA",
          phone_number: input.customer.phone,
          email: input.customer.email || "na@elba.invalid",
          country: "EG",
        },
        special_reference: input.paymentId,
        notification_url: input.webhookUrl,
        redirection_url: input.returnUrl,
        extras: { paymentId: input.paymentId, orderNumber: input.orderNumber },
      }),
    });
    if (!res.ok) throw new Error(`PAYMOB_INTENTION_FAILED:${res.status}`);
    const body = (await res.json()) as { id?: string | number; client_secret?: string };
    if (!body.client_secret) throw new Error("PAYMOB_INTENTION_INVALID");
    return {
      providerRef: String(body.id ?? ""),
      method: input.method,
      status: "REQUIRES_ACTION",
      clientSecret: body.client_secret,
      redirectUrl: `${this.cfg.baseUrl}/unifiedcheckout/?publicKey=${encodeURIComponent(this.cfg.publicKey)}&clientSecret=${encodeURIComponent(body.client_secret)}`,
    };
  }

  /** Transaction processed callback: JSON {type: "TRANSACTION", obj}, signature in ?hmac=. */
  async handleWebhook(req: WebhookRequest): Promise<WebhookOutcome> {
    let json: unknown;
    try {
      json = JSON.parse(req.rawBody);
    } catch {
      return { ok: false, error: "INVALID_PAYLOAD" };
    }
    const type = get(json, "type");
    const obj = get(json, "obj");
    if (!obj || typeof obj !== "object") return { ok: false, error: "INVALID_PAYLOAD" };
    const received = req.query.get("hmac") ?? req.headers.get("hmac") ?? "";
    if (!verifyPaymobHmac(obj, received, this.cfg.hmacSecret)) return { ok: false, error: "INVALID_SIGNATURE" };
    if (type !== "TRANSACTION") return { ok: false, error: "UNSUPPORTED_EVENT" };

    const paymentId = String(get(obj, "order.merchant_order_id") ?? get(obj, "payment_key_claims.extra.paymentId") ?? "");
    if (!paymentId) return { ok: false, error: "INVALID_PAYLOAD" };
    const success = get(obj, "success") === true;
    const pending = get(obj, "pending") === true;
    const refunded = get(obj, "is_refunded") === true;
    const status = refunded ? "REFUNDED" : success && !pending ? "PAID" : pending ? "PENDING" : "FAILED";
    return {
      ok: true,
      paymentId,
      providerRef: String(get(obj, "id") ?? ""),
      status,
      amountPiasters: Number(get(obj, "amount_cents") ?? 0),
      // Store only non-sensitive fields (masked PAN at most).
      raw: {
        provider: "paymob",
        id: get(obj, "id") ?? null,
        orderId: get(obj, "order.id") ?? null,
        success,
        pending,
        refunded,
        sourceType: get(obj, "source_data.type") ?? null,
        sourceSubType: get(obj, "source_data.sub_type") ?? null,
        maskedPan: get(obj, "source_data.pan") ?? null,
        message: get(obj, "data.message") ?? null,
      },
    };
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    this.requireKeys();
    const res = await this.fetcher(`${this.cfg.baseUrl}/api/acceptance/void_refund/refund`, {
      method: "POST",
      headers: { Authorization: `Token ${this.cfg.secretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ transaction_id: input.providerRef, amount_cents: input.amountPiasters }),
    });
    if (!res.ok) return { ok: false, error: `PAYMOB_REFUND_FAILED:${res.status}` };
    const body = (await res.json()) as { id?: string | number; success?: boolean };
    return body.success === false ? { ok: false, error: "PAYMOB_REFUND_DECLINED" } : { ok: true, refundRef: String(body.id ?? "") };
  }
}
