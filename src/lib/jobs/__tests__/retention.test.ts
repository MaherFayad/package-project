import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import { monthsBefore, retentionCutoffs, runRetention, type RetentionClient } from "@/lib/jobs/retention";

const NOW = new Date("2026-11-06T12:00:00Z");

describe("retention purge", () => {
  it("cutoffs: OTP 24 h, sessions and anonymous designs at expiry, events 13 months", () => {
    const c = retentionCutoffs(NOW);
    expect(c.otp.toISOString()).toBe("2026-11-05T12:00:00.000Z");
    expect(c.event.toISOString()).toBe("2025-10-06T12:00:00.000Z");
    expect(monthsBefore(new Date("2026-03-31T00:00:00Z"), 1).toISOString()).toBe("2026-02-28T00:00:00.000Z");
    expect(monthsBefore(new Date("2026-01-15T08:00:00Z"), 13).toISOString()).toBe("2024-12-15T08:00:00.000Z");
  });

  it("deletes with the documented filters and isolates failures", async () => {
    const calls: Record<string, unknown> = {};
    const ok = (k: string, n: number) => ({ deleteMany: vi.fn(async (a: { where: object }) => ((calls[k] = a.where), { count: n })) });
    const client: RetentionClient = {
      otpCode: ok("otp", 3),
      session: { deleteMany: vi.fn(async () => { throw new Error("locked"); }) },
      design: ok("design", 2),
      event: ok("event", 7),
    };
    const r = await runRetention(NOW, client);
    expect(r).toMatchObject({ otpCodes: 3, sessions: null, anonymousDesigns: 2, events: 7 });
    expect(r.errors).toEqual(["session: locked"]);
    expect(calls.otp).toEqual({ createdAt: { lt: new Date("2026-11-05T12:00:00Z") } });
    expect(calls.design).toEqual({ ownerId: null, expiresAt: { lt: NOW }, proofs: { none: {} } });
    expect(calls.event).toEqual({ at: { lt: new Date("2025-10-06T12:00:00Z") } });
  });
});
