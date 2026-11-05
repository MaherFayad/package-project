import { describe, expect, it } from "vitest";
import {
  MOCK_SIGNATURE_HEADER,
  MockProvider,
  PaymobProvider,
  buildMockWebhook,
  luhnValid,
  mockCardOutcome,
  mockWalletOutcome,
  paymentConfig,
  paymobHmac,
  paymobHmacString,
  signMock,
  verifyPaymobHmac,
} from "..";

const SECRET = "test-secret";

describe("mock webhook verification", () => {
  const body = { type: "payment.updated" as const, paymentId: "pay_1", providerRef: "mock_1", status: "PAID" as const, amountPiasters: 644_100, method: "CARD" as const };

  it("accepts a correctly signed webhook", async () => {
    const { rawBody, headers } = buildMockWebhook(body, SECRET);
    const r = await new MockProvider(SECRET).handleWebhook({ rawBody, headers, query: new URLSearchParams() });
    expect(r).toMatchObject({ ok: true, paymentId: "pay_1", status: "PAID", amountPiasters: 644_100 });
  });

  it("rejects a tampered body", async () => {
    const { rawBody, headers } = buildMockWebhook(body, SECRET);
    const tampered = rawBody.replace("644100", "100");
    const r = await new MockProvider(SECRET).handleWebhook({ rawBody: tampered, headers, query: new URLSearchParams() });
    expect(r).toEqual({ ok: false, error: "INVALID_SIGNATURE" });
  });

  it("rejects a wrong secret and a missing signature", async () => {
    const { rawBody, headers } = buildMockWebhook(body, "other");
    const p = new MockProvider(SECRET);
    expect(await p.handleWebhook({ rawBody, headers, query: new URLSearchParams() })).toEqual({ ok: false, error: "INVALID_SIGNATURE" });
    expect(await p.handleWebhook({ rawBody, headers: new Headers(), query: new URLSearchParams() })).toEqual({ ok: false, error: "INVALID_SIGNATURE" });
  });

  it("rejects a signed but malformed payload", async () => {
    const rawBody = JSON.stringify({ type: "payment.updated", paymentId: "x" });
    const headers = new Headers({ [MOCK_SIGNATURE_HEADER]: signMock(rawBody, SECRET) });
    expect(await new MockProvider(SECRET).handleWebhook({ rawBody, headers, query: new URLSearchParams() })).toEqual({ ok: false, error: "INVALID_PAYLOAD" });
  });

  it("issues Fawry codes with an expiry and InstaPay references", async () => {
    const p = new MockProvider(SECRET);
    const base = { paymentId: "p", orderNumber: "ELB-26002", amountPiasters: 100, customer: { name: "A", phone: "+201000000002" }, returnUrl: "", webhookUrl: "", locale: "ar" as const };
    const f = await p.createIntention({ ...base, method: "FAWRY" });
    expect(f.fawry?.referenceCode).toMatch(/^\d{13}$/);
    expect(new Date(f.fawry!.expiresAt).getTime()).toBeGreaterThan(Date.now());
    const i = await p.createIntention({ ...base, method: "INSTAPAY" });
    expect(i.instapay).toMatchObject({ reference: "ELB-26002" });
  });

  it("simulates card and wallet outcomes", () => {
    expect(luhnValid("4242 4242 4242 4242")).toBe(true);
    expect(luhnValid("4242 4242 4242 4241")).toBe(false);
    expect(mockCardOutcome("4242424242424242")).toBe("PAID");
    expect(mockCardOutcome("4000000000000002")).toBe("DECLINED");
    expect(mockCardOutcome("1234")).toBe("INVALID");
    expect(mockWalletOutcome("01012340000")).toBe("DECLINED");
    expect(mockWalletOutcome("01012345678")).toBe("PAID");
  });
});

describe("Paymob HMAC verification", () => {
  const txn = {
    amount_cents: 644100,
    created_at: "2026-11-05T12:00:00.000000",
    currency: "EGP",
    error_occured: false,
    has_parent_transaction: false,
    id: 192036465,
    integration_id: 4100,
    is_3d_secure: true,
    is_auth: false,
    is_capture: false,
    is_refunded: false,
    is_standalone_payment: true,
    is_voided: false,
    order: { id: 217503754, merchant_order_id: "pay_123" },
    owner: 302852,
    pending: false,
    source_data: { pan: "2346", sub_type: "MasterCard", type: "card" },
    success: true,
  };

  it("concatenates the documented fields in order", () => {
    expect(paymobHmacString(txn)).toBe(
      "6441002026-11-05T12:00:00.000000EGPfalsefalse1920364654100truefalsefalsefalsetruefalse217503754302852false2346MasterCardcardtrue",
    );
  });

  it("verifies a valid signature and rejects tampering", () => {
    const sig = paymobHmac(txn, SECRET);
    expect(sig).toMatch(/^[0-9a-f]{128}$/);
    expect(verifyPaymobHmac(txn, sig, SECRET)).toBe(true);
    expect(verifyPaymobHmac({ ...txn, amount_cents: 100 }, sig, SECRET)).toBe(false);
    expect(verifyPaymobHmac(txn, sig, "wrong")).toBe(false);
    expect(verifyPaymobHmac(txn, "", SECRET)).toBe(false);
    expect(verifyPaymobHmac(txn, sig, "")).toBe(false);
  });

  it("maps a verified callback to a payment outcome", async () => {
    const p = new PaymobProvider({ baseUrl: "https://example.invalid", secretKey: "", publicKey: "", apiKey: "", hmacSecret: SECRET, integrationIds: {} });
    const rawBody = JSON.stringify({ type: "TRANSACTION", obj: txn });
    const ok = await p.handleWebhook({ rawBody, headers: new Headers(), query: new URLSearchParams({ hmac: paymobHmac(txn, SECRET) }) });
    expect(ok).toMatchObject({ ok: true, paymentId: "pay_123", status: "PAID", amountPiasters: 644100 });
    if (ok.ok) expect(JSON.stringify(ok.raw)).not.toMatch(/card_number|cvv/i);
    const bad = await p.handleWebhook({ rawBody, headers: new Headers(), query: new URLSearchParams({ hmac: "00" }) });
    expect(bad).toEqual({ ok: false, error: "INVALID_SIGNATURE" });
    const declined = { ...txn, success: false };
    const r = await p.handleWebhook({
      rawBody: JSON.stringify({ type: "TRANSACTION", obj: declined }),
      headers: new Headers(),
      query: new URLSearchParams({ hmac: paymobHmac(declined, SECRET) }),
    });
    expect(r).toMatchObject({ ok: true, status: "FAILED" });
  });

  it("is never selected unless configured", () => {
    expect(paymentConfig({}).provider).toBe("mock");
    expect(paymentConfig({ PAYMENTS_PROVIDER: "paymob" }).provider).toBe("paymob");
    expect(paymentConfig({ PREPAY_DISCOUNT_PCT: "3" }).prepayDiscountPct).toBe(3);
    expect(paymentConfig({ PREPAY_DISCOUNT_PCT: "99" }).prepayDiscountPct).toBe(20);
  });
});
