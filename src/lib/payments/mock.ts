import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { PAYMENT_METHODS } from "@/types";
import { paymentConfig } from "./config";
import type { Intention, IntentionInput, PaymentProvider, RefundInput, RefundResult, WebhookOutcome, WebhookRequest } from "./types";

/**
 * Mock gateway for development and tests. It behaves like a real one from the app's point of
 * view: intentions, Fawry codes with expiry, InstaPay manual confirmation and SIGNED webhooks
 * (HMAC-SHA256 of the raw body in `x-mock-signature`), so the webhook path is exercised for real.
 *
 * Test cards (any future expiry, any CVC):
 *   4242 4242 4242 4242 → paid       4000 0000 0000 0002 → declined
 *   any other Luhn-valid number → paid; invalid numbers are rejected before "charging".
 * Wallets: numbers ending in 0000 are declined.
 */
export const MOCK_SIGNATURE_HEADER = "x-mock-signature";
export const MOCK_DECLINE_CARD = "4000000000000002";
export const MOCK_SUCCESS_CARD = "4242424242424242";

export function mockSecret(env: Record<string, string | undefined> = process.env): string {
  return env.MOCK_PAYMENTS_SECRET || "elba-dev-mock-webhook-secret";
}

export function signMock(rawBody: string, secret = mockSecret()): string {
  return createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
}

export function safeEqualHex(a: string, b: string): boolean {
  if (!/^[0-9a-f]+$/i.test(a) || !/^[0-9a-f]+$/i.test(b) || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

export function luhnValid(num: string): boolean {
  const d = num.replace(/\D/g, "");
  if (d.length < 12 || d.length > 19) return false;
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    let n = Number(d[d.length - 1 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}

export type MockCardResult = "PAID" | "DECLINED" | "INVALID";

export function mockCardOutcome(cardNumber: string): MockCardResult {
  const d = cardNumber.replace(/\D/g, "");
  if (!luhnValid(d)) return "INVALID";
  return d === MOCK_DECLINE_CARD ? "DECLINED" : "PAID";
}

export function mockWalletOutcome(walletPhone: string): "PAID" | "DECLINED" {
  return walletPhone.replace(/\D/g, "").endsWith("0000") ? "DECLINED" : "PAID";
}

/** Body of a mock webhook. */
export const mockWebhookSchema = z.object({
  type: z.literal("payment.updated"),
  paymentId: z.string().min(1).max(64),
  providerRef: z.string().min(1).max(64),
  status: z.enum(["PAID", "FAILED", "PENDING", "REFUNDED"]),
  amountPiasters: z.number().int().nonnegative(),
  method: z.enum(PAYMENT_METHODS),
  reason: z.string().max(64).optional(),
});
export type MockWebhookBody = z.infer<typeof mockWebhookSchema>;

/** Build a signed mock webhook (what the "gateway" would POST). */
export function buildMockWebhook(body: MockWebhookBody, secret = mockSecret()): { rawBody: string; headers: Headers } {
  const rawBody = JSON.stringify(body);
  return { rawBody, headers: new Headers({ "content-type": "application/json", [MOCK_SIGNATURE_HEADER]: signMock(rawBody, secret) }) };
}

/** 13-digit Fawry-style reference (digits only, as printed on outlet receipts). */
export function fawryReference(): string {
  return String(randomInt(1, 10)) + Array.from({ length: 12 }, () => randomInt(0, 10)).join("");
}

export class MockProvider implements PaymentProvider {
  readonly name = "mock" as const;
  constructor(private readonly secret = mockSecret()) {}

  async createIntention(input: IntentionInput): Promise<Intention> {
    const cfg = paymentConfig();
    const providerRef = `mock_${randomBytes(8).toString("hex")}`;
    const base: Intention = { providerRef, method: input.method, status: "REQUIRES_ACTION" };
    if (input.method === "FAWRY") {
      return {
        ...base,
        status: "PENDING",
        fawry: { referenceCode: fawryReference(), expiresAt: new Date(Date.now() + cfg.fawryExpiryHours * 3_600_000).toISOString() },
      };
    }
    if (input.method === "INSTAPAY") {
      return { ...base, status: "PENDING", instapay: { address: cfg.instapayAddress, reference: input.orderNumber } };
    }
    return base;
  }

  async handleWebhook(req: WebhookRequest): Promise<WebhookOutcome> {
    const sig = req.headers.get(MOCK_SIGNATURE_HEADER) ?? "";
    if (!safeEqualHex(sig, signMock(req.rawBody, this.secret))) return { ok: false, error: "INVALID_SIGNATURE" };
    let json: unknown;
    try {
      json = JSON.parse(req.rawBody);
    } catch {
      return { ok: false, error: "INVALID_PAYLOAD" };
    }
    const p = mockWebhookSchema.safeParse(json);
    if (!p.success) return { ok: false, error: "INVALID_PAYLOAD" };
    const b = p.data;
    return {
      ok: true,
      paymentId: b.paymentId,
      providerRef: b.providerRef,
      status: b.status,
      amountPiasters: b.amountPiasters,
      raw: { provider: "mock", type: b.type, status: b.status, method: b.method, reason: b.reason ?? null },
    };
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    if (!input.providerRef || input.amountPiasters <= 0) return { ok: false, error: "INVALID_REFUND" };
    return { ok: true, refundRef: `mock_refund_${randomBytes(6).toString("hex")}` };
  }
}
