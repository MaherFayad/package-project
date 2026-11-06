import { beforeEach, describe, expect, it, vi } from "vitest";

/* ---------- mocks: no database, no Next request scope ---------- */
const trackMock = vi.fn(async () => undefined);
const runDailyJobs = vi.fn(async () => ({ retention: { otpCodes: 0 }, followUp: { sent: [] } }));
const cookieJar = new Map<string, string>();
const env = { isProd: false };

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (k: string) => (cookieJar.has(k) ? { name: k, value: cookieJar.get(k)! } : undefined) }),
}));
vi.mock("@/lib/auth/session", () => ({ getSession: async () => ({ user: { id: "user_1" } }) }));
vi.mock("@/lib/analytics/track", async (orig) => ({ ...(await orig<typeof import("@/lib/analytics/track")>()), track: (...a: unknown[]) => trackMock(...(a as [])) }));
vi.mock("@/lib/jobs", () => ({ runDailyJobs: () => runDailyJobs() }));
vi.mock("@/lib/env", () => ({
  get isProd() {
    return env.isProd;
  },
}));

import { POST as postEvent } from "@/app/api/events/route";
import { POST as postJob } from "@/app/api/jobs/follow-up/route";
import { checkCronAuth } from "@/lib/jobs/cronAuth";
import { __resetRateLimits } from "@/lib/rate-limit";

const ANON = "anon_abcdefghijklmnop";

function eventReq(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost:3000/api/events", {
    method: "POST",
    headers: { "content-type": "application/json", "sec-fetch-site": "same-origin", "x-real-ip": "198.51.100.7", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  trackMock.mockClear();
  runDailyJobs.mockClear();
  cookieJar.clear();
  cookieJar.set("elba_anon", ANON);
  __resetRateLimits();
  env.isProd = false;
  delete process.env.CRON_SECRET;
});

describe("POST /api/events", () => {
  it("accepts an allowlisted client event and tracks it with pseudonymous ids only", async () => {
    const res = await postEvent(eventReq({ name: "gate_shown", props: { gate_reason: "price", locale: "ar" } }, { "user-agent": "Mozilla/5.0 (iPhone)" }));
    expect(res.status).toBe(204);
    expect(trackMock).toHaveBeenCalledWith("gate_shown", { gate_reason: "price", locale: "ar", device: "mobile" }, { userId: "user_1", anonId: ANON });
    expect(JSON.stringify(trackMock.mock.calls)).not.toContain("198.51.100.7");
  });

  it("rejects cross-site requests (CSRF, like /api/auth/*)", async () => {
    const res = await postEvent(eventReq({ name: "visit" }, { "sec-fetch-site": "cross-site" }));
    expect(res.status).toBe(403);
    const res2 = await postEvent(
      new Request("http://localhost:3000/api/events", { method: "POST", headers: { origin: "https://evil.example", host: "localhost:3000" }, body: JSON.stringify({ name: "visit" }) }),
    );
    expect(res2.status).toBe(403);
    expect(trackMock).not.toHaveBeenCalled();
  });

  it("rejects server-truth and unknown names, bad props and extra fields", async () => {
    for (const body of [
      { name: "payment_succeeded" },
      { name: "account_created" },
      { name: "price_viewed" },
      { name: "pageview" },
      { name: "visit", props: { nested: { a: 1 } } },
      { name: "visit", props: { "Bad-Key": 1 } },
      { name: "visit", props: Object.fromEntries(Array.from({ length: 17 }, (_, i) => [`k${i}`, i])) },
      { name: "visit", userId: "someone_else" },
      "not json",
    ]) {
      const res = await postEvent(eventReq(body));
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
    expect(trackMock).not.toHaveBeenCalled();
  });

  it("caps the body size", async () => {
    const res = await postEvent(eventReq({ name: "visit", props: { a: "x".repeat(100), pad: "y".repeat(3000) } }));
    expect(res.status).toBe(413);
  });

  it("rotating the anonymous cookie does not add visits (R4-B-04)", async () => {
    for (let i = 0; i < 90; i++) {
      cookieJar.set("elba_anon", `anon_rotated_${String(i).padStart(8, "0")}`);
      expect((await postEvent(eventReq({ name: "visit" }, { "user-agent": "bot/1.0" }))).status).toBe(204);
    }
    expect((trackMock.mock.calls as unknown[][]).filter((c) => c[0] === "visit")).toHaveLength(1);
    // Different browsers behind one IP still count, up to the per-IP cap (30 per 30 minutes).
    for (let i = 0; i < 40; i++) await postEvent(eventReq({ name: "visit" }, { "user-agent": `browser/${i}` }));
    expect((trackMock.mock.calls as unknown[][]).filter((c) => c[0] === "visit")).toHaveLength(30);
  });

  it("caps other client events per IP even with rotating cookies", async () => {
    for (let i = 0; i < 50; i++) {
      cookieJar.set("elba_anon", `anon_rotated_${String(i).padStart(8, "0")}`);
      await postEvent(eventReq({ name: "artwork_uploaded" }));
    }
    expect((trackMock.mock.calls as unknown[][]).filter((c) => c[0] === "artwork_uploaded")).toHaveLength(30);
  });

  it("is rate-limited per IP across rotating cookies", async () => {
    let limited = 0;
    for (let i = 0; i < 130; i++) {
      cookieJar.set("elba_anon", `anon_rotated_${String(i).padStart(8, "0")}`);
      if ((await postEvent(eventReq({ name: "gate_shown" }))).status === 429) limited++;
    }
    expect(limited).toBe(10);
  });

  it("is rate-limited per browser", async () => {
    for (let i = 0; i < 60; i++) expect((await postEvent(eventReq({ name: "visit" }))).status).toBe(204);
    const res = await postEvent(eventReq({ name: "visit" }));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
  });
});

describe("POST /api/jobs/follow-up", () => {
  const jobReq = (auth?: string) => new Request("http://localhost:3000/api/jobs/follow-up", { method: "POST", headers: auth ? { authorization: auth } : {} });

  it("401 without or with a wrong bearer when CRON_SECRET is set", async () => {
    process.env.CRON_SECRET = "s3cret-cron-value-0123456789";
    for (const h of [undefined, "Bearer nope", "s3cret-cron-value-0123456789", "Basic s3cret-cron-value-0123456789", "Bearer s3cret-cron-value-012345678"]) {
      const res = await postJob(jobReq(h));
      expect(res.status, String(h)).toBe(401);
    }
    expect(runDailyJobs).not.toHaveBeenCalled();
  });

  it("200 and runs the job with the right bearer", async () => {
    process.env.CRON_SECRET = "s3cret-cron-value-0123456789";
    const res = await postJob(jobReq("Bearer s3cret-cron-value-0123456789"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, followUp: { sent: [] } });
    expect(runDailyJobs).toHaveBeenCalledTimes(1);
  });

  it("disabled in production when CRON_SECRET is unset; open in development", async () => {
    env.isProd = true;
    const res = await postJob(jobReq("Bearer anything"));
    expect(res.status).toBe(503);
    expect(runDailyJobs).not.toHaveBeenCalled();
    env.isProd = false;
    expect((await postJob(jobReq())).status).toBe(200);
  });

  it("checkCronAuth compares in constant time on equal-length digests", () => {
    expect(checkCronAuth("Bearer abc", "abc", true)).toBe("ok");
    expect(checkCronAuth("bearer   abc  ", "abc", true)).toBe("ok");
    expect(checkCronAuth("Bearer abcd", "abc", true)).toBe("unauthorized");
    expect(checkCronAuth(null, "abc", false)).toBe("unauthorized");
    expect(checkCronAuth(null, undefined, true)).toBe("disabled");
    expect(checkCronAuth(null, "", true)).toBe("disabled");
  });
});
