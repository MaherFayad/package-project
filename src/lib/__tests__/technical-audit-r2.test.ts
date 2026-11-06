import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";
import { applySecurityHeaders, contentSecurityPolicy, securityHeaders } from "@/lib/security-headers";
import { databaseUrl } from "@/lib/db";
import { canViewOrder } from "@/lib/orders/state";
import { decidePaymentOutcome, type StoredPayment, type VerifiedOutcome } from "@/lib/orders/payment-rules";
import { PaymobProvider, paymobFlags, paymobHmac, paymobStatus } from "@/lib/payments/paymob";
import nextConfig, { apiHeaders, contentSecurityPolicy as configCsp, securityHeaders as configHeaders } from "../../../next.config";

/** Technical audit round 2 (docs/audit/technical.md, R2-xx). */

describe("R2-01 pages get the full CSP, not the middleware's short one (ASVS V14.4.3)", () => {
  it("middleware sends exactly the next.config header set on locale pages and redirects", () => {
    for (const url of ["http://localhost/ar", "http://localhost/en/boxes", "http://localhost/"]) {
      const res = middleware(new NextRequest(url));
      const csp = res.headers.get("content-security-policy") ?? "";
      expect(csp).toBe(contentSecurityPolicy(process.env.NODE_ENV !== "production"));
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src 'self' 'unsafe-inline'");
      expect(csp).toContain("worker-src 'self' blob:");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(res.headers.get("permissions-policy")).toContain("payment=()");
      expect(res.headers.get("cross-origin-opener-policy")).toBe("same-origin");
      expect(res.headers.get("strict-transport-security")).toBeNull(); // http
    }
  });
  it("R2-08 API routes keep their own CSP (sandbox on served files): the config sends none there", async () => {
    const rules = (await nextConfig.headers!()) as { source: string; headers: { key: string }[] }[];
    const api = rules.find((r) => r.source === "/api/:path*")!;
    expect(api.headers.map((h) => h.key)).not.toContain("Content-Security-Policy");
    expect(api.headers.map((h) => h.key)).toEqual(expect.arrayContaining(["X-Content-Type-Options", "X-Frame-Options", "Referrer-Policy"]));
    expect(apiHeaders(false, false).some((h) => h.key === "Content-Security-Policy")).toBe(false);
    const pages = rules.find((r) => r.headers.some((h) => h.key === "Content-Security-Policy"))!;
    const re = new RegExp(`^${pages.source.replace("/((?!api/).*)", "/((?!api/).*)")}$`);
    expect(re.test("/ar/design/mailer-box")).toBe(true);
    expect(re.test("/_next/static/chunks/a.js")).toBe(true);
    expect(re.test("/api/vendor/files/apply/x/y.png")).toBe(false);
  });
  it("next.config and the shared module agree", () => {
    expect(configCsp(false)).toBe(contentSecurityPolicy(false));
    expect(configHeaders(false, true)).toEqual(securityHeaders(false, true));
  });
  it("keeps what the 3D canvas, blob workers, captures and inline scripts need, and no eval in production", () => {
    const csp = contentSecurityPolicy(false);
    expect(csp).toMatch(/img-src 'self' data: blob:/);
    expect(csp).toMatch(/connect-src 'self' blob: data:/);
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("frame-src 'none'");
    expect(contentSecurityPolicy(true)).toContain("'unsafe-eval'");
  });
  it("HSTS only for production HTTPS", () => {
    const h = new Headers();
    applySecurityHeaders(h, { dev: false, https: true });
    expect(h.get("strict-transport-security")).toContain("max-age=31536000");
    const d = new Headers();
    applySecurityHeaders(d, { dev: true, https: true });
    expect(d.get("strict-transport-security")).toBeNull();
  });
});

describe("R2-02 vendors never see unpaid orders (PDPL 151/2020 minimisation, ASVS V4.2.1)", () => {
  const staff = { id: "s", role: "VENDOR" as const, vendorId: "v1" };
  const order = (paidAt: Date | null) => ({ buyerId: "b", vendorId: "v1", paidAt });
  it("hides awaiting-payment and cancelled-before-payment orders from the vendor", () => {
    expect(canViewOrder(order(null), staff)).toBe(false);
    expect(canViewOrder(order(new Date()), staff)).toBe(true);
    expect(canViewOrder(order(new Date()), { ...staff, vendorId: "v2" })).toBe(false);
  });
  it("buyer and admin always", () => {
    expect(canViewOrder(order(null), { id: "b", role: "BUYER", vendorId: null })).toBe(true);
    expect(canViewOrder(order(null), { id: "a", role: "ADMIN", vendorId: null })).toBe(true);
    expect(canViewOrder(order(null), { id: "x", role: "BUYER", vendorId: null })).toBe(false);
  });
});

describe("R2-05 Paymob flags: success alone is not paid", () => {
  const SECRET = "test-hmac-secret";
  const base = {
    amount_cents: 50_000,
    created_at: "2026-11-05T12:00:00.000000",
    currency: "EGP",
    error_occured: false,
    has_parent_transaction: false,
    id: 1,
    integration_id: 2,
    is_3d_secure: true,
    is_auth: false,
    is_capture: false,
    is_refunded: false,
    is_standalone_payment: true,
    is_voided: false,
    order: { id: 777, merchant_order_id: "pay_1" },
    owner: 3,
    pending: false,
    source_data: { pan: "1234", sub_type: "Visa", type: "card" },
    success: true,
  };
  const st = (o: object) => paymobStatus(paymobFlags({ ...base, ...o }));
  it("maps the documented flag combinations", () => {
    expect(st({})).toBe("PAID");
    expect(st({ is_voided: true })).toBe("REFUNDED");
    expect(st({ is_refunded: true })).toBe("REFUNDED");
    expect(st({ is_auth: true, is_capture: false })).toBe("PENDING");
    expect(st({ is_auth: true, is_capture: true })).toBe("PAID");
    expect(st({ pending: true })).toBe("PENDING");
    expect(st({ success: false })).toBe("FAILED");
    expect(st({ error_occured: true })).toBe("FAILED");
  });
  const provider = new PaymobProvider({ baseUrl: "https://example.invalid", secretKey: "", publicKey: "", apiKey: "", hmacSecret: SECRET, integrationIds: {} });
  const call = (obj: object) =>
    provider.handleWebhook({ rawBody: JSON.stringify({ type: "TRANSACTION", obj }), headers: new Headers(), query: new URLSearchParams({ hmac: paymobHmac(obj, SECRET) }) });
  it("flags a partial refund (refunded_amount_cents below the capture)", async () => {
    expect(await call({ ...base, is_refunded: true, refunded_amount_cents: 10_000 })).toMatchObject({ ok: true, status: "REFUNDED", partialRefund: true });
    const full = await call({ ...base, is_refunded: true, refunded_amount_cents: 50_000 });
    expect(full).toMatchObject({ ok: true, status: "REFUNDED" });
    expect(full.ok && full.partialRefund).toBeFalsy();
    const voided = await call({ ...base, is_voided: true });
    expect(voided.ok && voided.partialRefund).toBeFalsy();
  });
  it("a partial refund never moves the order to REFUNDED", () => {
    const pay: StoredPayment = { provider: "paymob", status: "PAID", amountPiasters: 50_000, gatewayRef: "777" };
    const hook = (o: Partial<VerifiedOutcome>): VerifiedOutcome => ({
      ok: true,
      paymentId: "pay_1",
      providerRef: "1",
      status: "REFUNDED",
      amountPiasters: 50_000,
      raw: {},
      provider: "paymob",
      gatewayRef: "777",
      currency: "EGP",
      ...o,
    });
    expect(decidePaymentOutcome(pay, "IN_PRODUCTION", hook({ partialRefund: true }))).toEqual({ action: "PARTIAL_REFUND" });
    expect(decidePaymentOutcome(pay, "IN_PRODUCTION", hook({}))).toEqual({ action: "REFUNDED" });
  });
});

describe("R2-06 SQLite uses one connection so concurrent transactions queue instead of deadlocking", () => {
  it("adds connection_limit=1 to file: URLs only", () => {
    expect(databaseUrl("file:./dev.db")).toBe("file:./dev.db?connection_limit=1");
    expect(databaseUrl("file:./dev.db?socket_timeout=10")).toBe("file:./dev.db?socket_timeout=10&connection_limit=1");
    expect(databaseUrl("file:./dev.db?connection_limit=4")).toBe("file:./dev.db?connection_limit=4");
    expect(databaseUrl("postgresql://u:p@h/db")).toBe("postgresql://u:p@h/db");
    expect(databaseUrl(undefined)).toBeUndefined();
  });
});
