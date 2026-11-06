import { db } from "@/lib/db";
import { OTP_RETENTION_HOURS } from "@/lib/auth/constants";

/**
 * Scheduled retention purge (docs/audit/platform.md "Scheduled retention job", P-16; PDPL Law
 * 151/2020 storage limitation; compliance-checklist.md 2.9). Runs once a day from the same job as
 * the B-23 follow-up (POST /api/jobs/follow-up, `npm run jobs:daily`):
 *
 * - OTP rows older than OTP_RETENTION_HOURS (24 h), used or not;
 * - sessions past their expiry;
 * - anonymous designs past their 30-day expiry that back no proof (proofs back orders);
 * - analytics events older than EVENT_RETENTION_MONTHS (13 months: a full year-on-year
 *   comparison plus one month of margin).
 *
 * Each purge runs on its own: one failure is reported and does not stop the others.
 */
export const EVENT_RETENTION_MONTHS = 13;

type Purgeable = { deleteMany(args: { where: object }): Promise<{ count: number }> };
export interface RetentionClient {
  otpCode: Purgeable;
  session: Purgeable;
  design: Purgeable;
  event: Purgeable;
}

export interface RetentionReport {
  otpCodes: number | null;
  sessions: number | null;
  anonymousDesigns: number | null;
  events: number | null;
  errors: string[];
}

/** `now` minus whole calendar months (UTC), clamped to month end: 2026-11-06 → 2025-10-06 for 13, 03-31 → 02-28 for 1. */
export function monthsBefore(now: Date, months: number): Date {
  const total = now.getUTCFullYear() * 12 + now.getUTCMonth() - months;
  const y = Math.floor(total / 12);
  const m = total - y * 12;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const d = new Date(now.getTime());
  d.setUTCFullYear(y, m, Math.min(now.getUTCDate(), lastDay));
  return d;
}

export function retentionCutoffs(now: Date) {
  return {
    otp: new Date(now.getTime() - OTP_RETENTION_HOURS * 3_600_000),
    session: now,
    anonymousDesign: now,
    event: monthsBefore(now, EVENT_RETENTION_MONTHS),
  };
}

export async function runRetention(now: Date, client: RetentionClient = db as unknown as RetentionClient): Promise<RetentionReport> {
  const c = retentionCutoffs(now);
  const errors: string[] = [];
  const run = async (label: string, f: () => Promise<{ count: number }>) => {
    try {
      return (await f()).count;
    } catch (e) {
      errors.push(`${label}: ${e instanceof Error ? e.message : String(e)}`.slice(0, 200));
      return null;
    }
  };
  const otpCodes = await run("otp", () => client.otpCode.deleteMany({ where: { createdAt: { lt: c.otp } } }));
  const sessions = await run("session", () => client.session.deleteMany({ where: { expiresAt: { lt: c.session } } }));
  const anonymousDesigns = await run("design", () =>
    client.design.deleteMany({ where: { ownerId: null, expiresAt: { lt: c.anonymousDesign }, proofs: { none: {} } } }),
  );
  const events = await run("event", () => client.event.deleteMany({ where: { at: { lt: c.event } } }));
  return { otpCodes, sessions, anonymousDesigns, events, errors };
}
