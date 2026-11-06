import { describe, expect, it, vi } from "vitest";
import { MockProvider, PaymobProvider, buildMockWebhook, mockSecret, paymobHmac } from "@/lib/payments";
import { sessionSecretProblem } from "@/lib/env";
import { maskAddress, notify, notifyOutbox } from "@/lib/notify";
import { bostaStatus } from "@/lib/shipping/bosta";
import { DEFAULT_PRICING_CONFIG, makeConfig } from "@/lib/pricing";
import { readBodyCapped, readFormCapped, readJsonCapped } from "@/app/api/_lib/body";
import { contentSecurityPolicy, securityHeaders } from "../../../next.config";

describe("mock gateway secret (ASVS V6.4.1 no hard-coded production secrets)", () => {
  it("uses the fixed dev secret only outside production", () => {
    expect(mockSecret({ NODE_ENV: "development" })).toBe("elba-dev-mock-webhook-secret");
    expect(mockSecret({ NODE_ENV: "production", MOCK_PAYMENTS_SECRET: "abc" })).toBe("abc");
  });
  it("is random (and stable per process) under next start", () => {
    const a = mockSecret({ NODE_ENV: "production" });
    expect(a).not.toBe("elba-dev-mock-webhook-secret");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(mockSecret({ NODE_ENV: "production" })).toBe(a);
  });
  it("reports the signed providerRef as the binding reference", async () => {
    const { rawBody, headers } = buildMockWebhook({ type: "payment.updated", paymentId: "p", providerRef: "mock_1", status: "PAID", amountPiasters: 1, method: "CARD" }, "s");
    const r = await new MockProvider("s").handleWebhook({ rawBody, headers, query: new URLSearchParams() });
    expect(r).toMatchObject({ ok: true, provider: "mock", gatewayRef: "mock_1", currency: "EGP" });
  });
});

describe("Paymob binding", () => {
  const cfg = { baseUrl: "https://pm.test", secretKey: "sk", publicKey: "pk", apiKey: "", hmacSecret: "h", integrationIds: { CARD: 1 } };
  const input = { paymentId: "pay_1", orderNumber: "ELB-1", amountPiasters: 100, method: "CARD" as const, customer: { name: "A B", phone: "+20100" }, returnUrl: "r", webhookUrl: "w", locale: "en" as const };
  it("stores the intention's gateway order id", async () => {
    const p = new PaymobProvider(cfg, async () => ({ ok: true, status: 200, json: async () => ({ id: "pi_1", client_secret: "cs", intention_order_id: 777 }) }));
    expect(await p.createIntention(input)).toMatchObject({ providerRef: "pi_1", gatewayOrderId: "777" });
  });
  it("refuses an intention it could not bind", async () => {
    const p = new PaymobProvider(cfg, async () => ({ ok: true, status: 200, json: async () => ({ id: "pi_1", client_secret: "cs" }) }));
    await expect(p.createIntention(input)).rejects.toThrow("PAYMOB_INTENTION_INVALID");
  });
  it("returns the signed order.id and currency with the outcome", async () => {
    const obj = { id: 9, amount_cents: 100, currency: "EGP", success: true, pending: false, is_refunded: false, order: { id: 777, merchant_order_id: "pay_1" } };
    const r = await new PaymobProvider(cfg).handleWebhook({ rawBody: JSON.stringify({ type: "TRANSACTION", obj }), headers: new Headers(), query: new URLSearchParams({ hmac: paymobHmac(obj, "h") }) });
    expect(r).toMatchObject({ ok: true, paymentId: "pay_1", gatewayRef: "777", currency: "EGP", provider: "paymob", status: "PAID" });
  });
});

describe("SESSION_SECRET (ASVS V2.9.1 / V14.1.3)", () => {
  it("production needs 32+ chars that are not the published example", () => {
    expect(sessionSecretProblem(undefined, true)).toMatch(/not set/);
    expect(sessionSecretProblem("x".repeat(20), true)).toMatch(/32/);
    expect(sessionSecretProblem("dev-only-change-me-please-32-chars-min", true)).toMatch(/example/);
    expect(sessionSecretProblem("k".repeat(48), true)).toBeNull();
    expect(sessionSecretProblem("x".repeat(20), false)).toBeNull();
    // Local prod builds / e2e (OTP_DEV_ECHO=1) may keep the example value.
    expect(sessionSecretProblem("dev-only-change-me-please-32-chars-min", true, true)).toBeNull();
  });
});

describe("notifications keep personal data out of logs (PDPL 151/2020)", () => {
  it("masks phones and emails", () => {
    expect(maskAddress("+201001234567")).toBe("+2010****67");
    expect(maskAddress("mona@example.com")).toBe("m***@example.com");
    expect(maskAddress("123")).toBe("***");
  });
  it("never throws into the order flow, even for a broken template", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(notify({ to: { phone: "+201001234567" }, locale: "en", template: "NOPE" as never })).resolves.toBeDefined();
    spy.mockRestore();
  });
  it("does not keep an in-memory outbox in production", async () => {
    const before = notifyOutbox.length;
    vi.stubEnv("NODE_ENV", "production");
    await notify({ to: { phone: "+201001234567" }, locale: "en", template: "ORDER_PLACED", params: { number: "ELB-1" } });
    vi.unstubAllEnvs();
    expect(notifyOutbox.length).toBe(before);
  });
});

describe("Bosta state mapping", () => {
  it("unknown codes keep the last known status instead of resetting to CREATED", () => {
    expect(bostaStatus(45)).toBe("DELIVERED");
    expect(bostaStatus(999, "IN_TRANSIT")).toBe("IN_TRANSIT");
    expect(bostaStatus(undefined, "PICKED_UP")).toBe("PICKED_UP");
  });
});

describe("pricing config pins legal limits", () => {
  it("VAT 14%, 72 h validity and the 2,000-unit instant cap cannot be overridden upward", () => {
    const c = makeConfig({ vatRate: 0.2, quoteValidityHours: 500, maxInstantQty: 10_000, marginPct: -1 });
    expect(c.vatRate).toBe(0.14);
    expect(c.quoteValidityHours).toBe(72);
    expect(c.maxInstantQty).toBe(2000);
    expect(c.marginPct).toBe(0);
    expect(makeConfig({ quoteValidityHours: 24, maxInstantQty: 1500 })).toMatchObject({ quoteValidityHours: 24, maxInstantQty: 1500 });
    expect(makeConfig()).toMatchObject({ vatRate: DEFAULT_PRICING_CONFIG.vatRate, marginPct: DEFAULT_PRICING_CONFIG.marginPct });
  });
});

describe("capped request bodies (ASVS V12.1.1 / V13.1.3)", () => {
  const chunked = (bytes: number) =>
    new Request("http://x/", {
      method: "POST",
      body: new ReadableStream({
        start(c) {
          for (let i = 0; i < bytes; i += 1024) c.enqueue(new Uint8Array(Math.min(1024, bytes - i)));
          c.close();
        },
      }),
      duplex: "half",
    } as RequestInit);
  it("rejects an oversize declared length before reading", async () => {
    const r = await readBodyCapped(new Request("http://x/", { method: "POST", body: "x", headers: { "content-length": "999999" } }), 10);
    expect((r as Response).status).toBe(413);
  });
  it("aborts a chunked body without Content-Length at the cap", async () => {
    expect(((await readBodyCapped(chunked(50_000), 10_000)) as Response).status).toBe(413);
    expect(((await readBodyCapped(chunked(5_000), 10_000)) as Uint8Array).byteLength).toBe(5_000);
  });
  it("parses JSON and multipart within the cap", async () => {
    expect(await readJsonCapped(new Request("http://x/", { method: "POST", body: '{"a":1}' }), 100)).toEqual({ a: 1 });
    expect(((await readJsonCapped(new Request("http://x/", { method: "POST", body: "nope" }), 100)) as Response).status).toBe(400);
    const fd = new FormData();
    fd.set("scope", "qc");
    const form = await readFormCapped(new Request("http://x/", { method: "POST", body: fd }), 10_000);
    expect((form as FormData).get("scope")).toBe("qc");
  });
});

describe("security headers (ASVS V14.4, Top 10 A05)", () => {
  it("blocks framing, plugins and foreign origins; no eval in production", () => {
    const csp = contentSecurityPolicy(false);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("default-src 'self'");
    expect(csp).not.toContain("unsafe-eval");
    expect(contentSecurityPolicy(true)).toContain("unsafe-eval");
  });
  it("sends the companion headers, HSTS only on an https site", () => {
    const keys = (h: { key: string }[]) => h.map((x) => x.key);
    expect(keys(securityHeaders(false, false))).toEqual(
      expect.arrayContaining(["X-Frame-Options", "X-Content-Type-Options", "Referrer-Policy", "Permissions-Policy"]),
    );
    expect(keys(securityHeaders(false, false))).not.toContain("Strict-Transport-Security");
    expect(keys(securityHeaders(false, true))).toContain("Strict-Transport-Security");
    expect(securityHeaders(false, false).find((h) => h.key === "Referrer-Policy")?.value).toBe("strict-origin-when-cross-origin");
  });
});
