import { beforeEach, describe, expect, it, vi } from "vitest";

/* ---------- In-memory stand-in for the OtpCode table (conditional updates are atomic, like SQL) ---------- */
type Row = { id: string; phone: string; codeHash: string; expiresAt: Date; attempts: number; consumedAt: Date | null; createdAt: Date; ip: string | null };
const rows: Row[] = [];
let seq = 0;
const tick = () => new Promise((r) => setTimeout(r, 0));
type Where = Record<string, unknown>;
function matches(r: Row, w: Where): boolean {
  for (const [k, v] of Object.entries(w)) {
    const val = (r as unknown as Record<string, unknown>)[k];
    if (v && typeof v === "object" && !(v instanceof Date)) {
      const o = v as Record<string, number | Date>;
      if ("lt" in o && !(val! < o.lt)) return false;
      if ("gt" in o && !(val! > o.gt)) return false;
      if ("gte" in o && !(val! >= o.gte)) return false;
    } else if (val !== v) return false;
  }
  return true;
}
function apply(r: Row, data: Record<string, unknown>) {
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v === "object" && "increment" in (v as object)) (r as unknown as Record<string, number>)[k] += (v as { increment: number }).increment;
    else (r as unknown as Record<string, unknown>)[k] = v;
  }
}
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  db: {
    otpCode: {
      async create({ data }: { data: Omit<Row, "id" | "attempts" | "consumedAt" | "createdAt"> }) {
        await tick();
        const r: Row = { id: `o${++seq}`, attempts: 0, consumedAt: null, createdAt: new Date(Date.now() + seq), ...data, ip: data.ip ?? null };
        rows.push(r);
        return r;
      },
      async findFirst({ where }: { where: Where }) {
        await tick();
        return [...rows].filter((r) => matches(r, where)).sort((a, b) => +b.createdAt - +a.createdAt)[0] ?? null;
      },
      async findMany({ where }: { where: Where }) {
        await tick();
        return rows.filter((r) => matches(r, where)).sort((a, b) => +a.createdAt - +b.createdAt);
      },
      async findUnique({ where }: { where: { id: string } }) {
        await tick();
        return rows.find((r) => r.id === where.id) ?? null;
      },
      async updateMany({ where, data }: { where: Where; data: Record<string, unknown> }) {
        await tick();
        const hit = rows.filter((r) => matches(r, where)); // check + set in one synchronous step
        hit.forEach((r) => apply(r, data));
        return { count: hit.length };
      },
      async deleteMany({ where }: { where: Where }) {
        await tick();
        const keep = rows.filter((r) => !matches(r, where));
        const n = rows.length - keep.length;
        rows.splice(0, rows.length, ...keep);
        return { count: n };
      },
    },
  },
}));

import { checkOtp, consumeOtp, requestOtp, verifyOtp } from "@/lib/auth/otp";
import { OTP_LOCKOUT_MAX_FAILURES, OTP_MAX_ATTEMPTS } from "@/lib/auth/constants";
import { __resetRateLimits, clientIp } from "@/lib/rate-limit";
import { safeNextPath } from "@/lib/auth/redirect";
import { isCrossSiteRequest } from "@/lib/auth/csrf";
import { consentRowsForSignIn } from "@/lib/auth/consent";

const PHONE = "+201012345678";
async function issue(phone = PHONE): Promise<string> {
  __resetRateLimits();
  const r = await requestOtp(phone, "1.1.1.1");
  if (!r.ok || !r.devCode) throw new Error("no code");
  return r.devCode;
}
const wrong = (code: string) => String((Number(code) + 1) % 1_000_000).padStart(6, "0");

beforeEach(() => {
  rows.splice(0);
  __resetRateLimits();
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});

describe("OTP brute force", () => {
  it("parallel guesses cannot exceed the per-code attempt limit (race)", async () => {
    const code = await issue();
    const results = await Promise.all(Array.from({ length: 25 }, () => checkOtp(PHONE, wrong(code))));
    const compared = results.filter((r) => !r.ok && r.error === "INVALID_CODE").length;
    expect(compared).toBe(OTP_MAX_ATTEMPTS);
    expect(results.filter((r) => !r.ok && r.error === "TOO_MANY_ATTEMPTS").length).toBe(25 - OTP_MAX_ATTEMPTS);
    // The right code no longer works once the attempts are used up.
    expect(await verifyOtp(PHONE, code)).toEqual({ ok: false, error: "TOO_MANY_ATTEMPTS" });
  });

  it("a correct code works once (no replay, even in parallel)", async () => {
    const code = await issue();
    const [a, b] = await Promise.all([verifyOtp(PHONE, code), verifyOtp(PHONE, code)]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    expect(await verifyOtp(PHONE, code)).toEqual({ ok: false, error: "EXPIRED" });
  });

  it("checkOtp does not consume: the caller decides (terms tick) and consumes once", async () => {
    const code = await issue();
    const c = await checkOtp(PHONE, code);
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    expect(await consumeOtp(c.otpId)).toBe(true);
    expect(await consumeOtp(c.otpId)).toBe(false);
  });

  it("locks the phone after repeated wrong codes across fresh codes, and blocks new codes", async () => {
    const rounds = Math.ceil(OTP_LOCKOUT_MAX_FAILURES / OTP_MAX_ATTEMPTS);
    for (let round = 0; round < rounds; round++) {
      const code = await issue();
      for (let i = 0; i < OTP_MAX_ATTEMPTS; i++) await checkOtp(PHONE, wrong(code));
    }
    expect(rows.reduce((n, r) => n + r.attempts, 0)).toBe(OTP_LOCKOUT_MAX_FAILURES);
    // No new code can be requested (even with fresh per-phone / per-IP buckets).
    __resetRateLimits();
    const again = await requestOtp(PHONE, "2.2.2.2");
    expect(again).toMatchObject({ ok: false, error: "RATE_LIMITED" });
    // Even the right code of a fresh-looking request is refused while locked.
    const r = await checkOtp(PHONE, "123456");
    expect(r).toMatchObject({ ok: false, error: "LOCKED" });
    if (!r.ok) expect(r.retryAfterSec).toBeGreaterThan(0);
  });

  it("a successful sign-in is not counted as a failure", async () => {
    for (let i = 0; i < OTP_LOCKOUT_MAX_FAILURES + 2; i++) {
      const code = await issue();
      expect((await verifyOtp(PHONE, code)).ok).toBe(true);
    }
  });

  it("drops OTP rows past the retention window", async () => {
    rows.push({ id: "old", phone: "+201111111111", codeHash: "x", expiresAt: new Date(0), attempts: 0, consumedAt: null, createdAt: new Date(Date.now() - 48 * 3_600_000), ip: "9.9.9.9" });
    await issue();
    expect(rows.find((r) => r.id === "old")).toBeUndefined();
  });
});

describe("safeNextPath (open redirect)", () => {
  it.each([
    ["//evil.com", "/en"],
    ["/\t/evil.com", "/en"],
    ["/\n/evil.com", "/en"],
    ["/\\evil.com", "/en"],
    ["\\\\evil.com", "/en"],
    ["https://evil.com/en", "/en"],
    ["javascript:alert(1)", "/en"],
    ["en/orders", "/en"],
    ["", "/en"],
    [undefined, "/en"],
    ["/en/login?next=/en/orders", "/en"],
    ["/en/orders", "/en/orders"],
    ["/en/orders/ELB-1?tab=proof#x", "/en/orders/ELB-1?tab=proof#x"],
    ["/en/./orders/../account", "/en/account"],
    ["/en/%2F%2Fevil.com", "/en/%2F%2Fevil.com"],
  ])("%j -> %s", (input, out) => {
    expect(safeNextPath(input as string | undefined, "en")).toBe(out);
  });
  it("browsers would read every accepted value as same-origin", () => {
    for (const n of ["/en/orders", "/ar/account?x=1", "/en/%2F%2Fevil.com"]) {
      const s = safeNextPath(n, "en");
      expect(new URL(s, "https://elba.example").origin).toBe("https://elba.example");
    }
  });
});

describe("isCrossSiteRequest (login CSRF)", () => {
  const h = (o: Record<string, string>) => new Headers(o);
  it("blocks cross-site browser requests", () => {
    expect(isCrossSiteRequest(h({ "sec-fetch-site": "cross-site" }))).toBe(true);
    expect(isCrossSiteRequest(h({ "sec-fetch-site": "same-site" }))).toBe(true);
    expect(isCrossSiteRequest(h({ origin: "https://evil.example", host: "elba.eg" }))).toBe(true);
    expect(isCrossSiteRequest(h({ origin: "null", host: "elba.eg" }))).toBe(true);
  });
  it("allows same-origin and non-browser requests", () => {
    expect(isCrossSiteRequest(h({ "sec-fetch-site": "same-origin" }))).toBe(false);
    expect(isCrossSiteRequest(h({ origin: "https://elba.eg", host: "elba.eg" }))).toBe(false);
    expect(isCrossSiteRequest(h({}))).toBe(false);
  });
});

describe("clientIp (X-Forwarded-For spoofing)", () => {
  it("ignores client-supplied entries in front of the proxy's", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.9" }))).toBe("203.0.113.9");
    expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.9" }))).toBe("203.0.113.9");
    expect(clientIp(new Headers({ "x-real-ip": "198.51.100.1", "x-forwarded-for": "6.6.6.6" }))).toBe("198.51.100.1");
    expect(clientIp(new Headers())).toBe("unknown");
  });
  it("honours TRUSTED_PROXY_HOPS for multi-proxy chains", () => {
    vi.stubEnv("TRUSTED_PROXY_HOPS", "2");
    expect(clientIp(new Headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.9, 10.0.0.2" }))).toBe("203.0.113.9");
    vi.unstubAllEnvs();
  });
});

describe("consentRowsForSignIn (PDPL 151/2020)", () => {
  const base = { acceptTerms: true, currentMarketing: false, acceptedTermsVersion: null, textVersion: "v2" };
  it("new account records terms, privacy and the marketing choice", () => {
    expect(consentRowsForSignIn({ ...base, isNew: true, marketingConsent: undefined })).toEqual({
      rows: [
        { kind: "TERMS", granted: true },
        { kind: "PRIVACY", granted: true },
        { kind: "MARKETING", granted: false },
      ],
      marketing: false,
    });
  });
  it("an unticked box at sign-in never withdraws an existing marketing consent", () => {
    for (const marketingConsent of [undefined, false]) {
      const p = consentRowsForSignIn({ ...base, isNew: false, acceptTerms: false, currentMarketing: true, acceptedTermsVersion: "v2", marketingConsent });
      expect(p).toEqual({ rows: [], marketing: null });
    }
  });
  it("a tick at sign-in records a grant once", () => {
    expect(consentRowsForSignIn({ ...base, isNew: false, acceptTerms: false, acceptedTermsVersion: "v2", marketingConsent: true })).toEqual({
      rows: [{ kind: "MARKETING", granted: true }],
      marketing: true,
    });
    expect(consentRowsForSignIn({ ...base, isNew: false, acceptTerms: false, acceptedTermsVersion: "v2", currentMarketing: true, marketingConsent: true }).rows).toEqual([]);
  });
  it("re-records terms when the user accepts a newer wording", () => {
    expect(consentRowsForSignIn({ ...base, isNew: false, acceptedTermsVersion: "v1", marketingConsent: undefined }).rows).toEqual([
      { kind: "TERMS", granted: true },
      { kind: "PRIVACY", granted: true },
    ]);
    expect(consentRowsForSignIn({ ...base, isNew: false, acceptedTermsVersion: "v2", marketingConsent: undefined }).rows).toEqual([]);
  });
});
