import "server-only";
import { db } from "@/lib/db";
import { otpDevEcho } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import {
  OTP_LENGTH,
  OTP_LOCKOUT_MAX_FAILURES,
  OTP_LOCKOUT_WINDOW_MINUTES,
  OTP_MAX_ATTEMPTS,
  OTP_RETENTION_HOURS,
  OTP_TTL_MINUTES,
} from "./constants";
import { generateOtp, hashOtp, safeEqualHex } from "./crypto";

export type RequestOtpResult =
  | { ok: true; expiresAt: Date; devCode?: string }
  | { ok: false; error: "RATE_LIMITED"; retryAfterSec: number };

/**
 * Wrong guesses for this phone across ALL its recent codes. Stored in the DB, so the lockout
 * holds across server processes and restarts and cannot be dodged by rotating IPs.
 */
async function recentFailures(phone: string, now: Date): Promise<{ failures: number; retryAfterSec: number }> {
  const since = new Date(now.getTime() - OTP_LOCKOUT_WINDOW_MINUTES * 60_000);
  const rows = await db.otpCode.findMany({
    where: { phone, createdAt: { gte: since }, attempts: { gt: 0 } },
    select: { attempts: true, consumedAt: true, codeHash: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  // A code that was consumed by a correct guess counted that guess as an attempt; don't
  // count the successful one as a failure.
  let failures = 0;
  for (const r of rows) failures += r.attempts - (r.consumedAt && r.codeHash === SUCCESS_MARK ? 1 : 0);
  const oldest = rows[0]?.createdAt ?? now;
  const retryAfterSec = Math.max(1, Math.ceil((oldest.getTime() + OTP_LOCKOUT_WINDOW_MINUTES * 60_000 - now.getTime()) / 1000));
  return { failures, retryAfterSec };
}

/** codeHash is overwritten with this marker once a code is used successfully (it is never needed again). */
const SUCCESS_MARK = "used";

/**
 * Issue a new OTP for a normalized E.164 phone.
 * Limits: 1 per 30 s and 5 per hour per phone; 20 per hour per IP; none while the phone is
 * locked out after too many wrong codes.
 */
export async function requestOtp(phone: string, ip: string): Promise<RequestOtpResult> {
  const now = new Date();
  const lock = await recentFailures(phone, now);
  if (lock.failures >= OTP_LOCKOUT_MAX_FAILURES) {
    return { ok: false, error: "RATE_LIMITED", retryAfterSec: lock.retryAfterSec };
  }
  for (const [ns, key, limit, windowMs] of [
    ["otp:phone:30s", phone, 1, 30_000],
    ["otp:phone:1h", phone, 5, 3_600_000],
    ["otp:ip:1h", ip, 20, 3_600_000],
  ] as const) {
    const r = rateLimit(ns, key, limit, windowMs);
    if (!r.ok) return { ok: false, error: "RATE_LIMITED", retryAfterSec: r.retryAfterSec };
  }

  const code = generateOtp(OTP_LENGTH);
  const expiresAt = new Date(now.getTime() + OTP_TTL_MINUTES * 60_000);
  // Invalidate previous unconsumed codes for this phone.
  await db.otpCode.updateMany({
    where: { phone, consumedAt: null },
    data: { consumedAt: now },
  });
  await db.otpCode.create({ data: { phone, codeHash: hashOtp(phone, code), expiresAt, ip } });
  // Storage limitation (PDPL 151/2020): OTP rows hold a phone and an IP; drop old ones.
  await db.otpCode
    .deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - OTP_RETENTION_HOURS * 3_600_000) } } })
    .catch(() => undefined);

  await sendOtpSms(phone, code);
  if (otpDevEcho()) {
    console.log(`[elba:otp] ${phone} -> ${code} (expires ${expiresAt.toISOString()})`);
    return { ok: true, expiresAt, devCode: code };
  }
  return { ok: true, expiresAt };
}

/** SMS / WhatsApp adapter seam. Wire a real provider here (e.g. WhatsApp Business BSP). */
async function sendOtpSms(phone: string, code: string): Promise<void> {
  void phone;
  void code;
}

export type OtpError = "INVALID_CODE" | "EXPIRED" | "TOO_MANY_ATTEMPTS" | "LOCKED";
export type CheckOtpResult = { ok: true; otpId: string } | { ok: false; error: OtpError; retryAfterSec?: number };

/**
 * Check a code WITHOUT consuming it (the caller consumes it with `consumeOtp` once every other
 * precondition has passed, so a missing terms tick does not burn a valid code).
 *
 * Every check claims one attempt with a conditional, atomic UPDATE (`attempts < max`) BEFORE the
 * hash is compared, so N parallel guesses can never get more than OTP_MAX_ATTEMPTS comparisons.
 */
export async function checkOtp(phone: string, code: string): Promise<CheckOtpResult> {
  const now = new Date();
  const lock = await recentFailures(phone, now);
  if (lock.failures >= OTP_LOCKOUT_MAX_FAILURES) return { ok: false, error: "LOCKED", retryAfterSec: lock.retryAfterSec };

  const otp = await db.otpCode.findFirst({
    where: { phone, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!otp || otp.expiresAt < now) return { ok: false, error: "EXPIRED" };

  const claim = await db.otpCode.updateMany({
    where: { id: otp.id, consumedAt: null, attempts: { lt: OTP_MAX_ATTEMPTS } },
    data: { attempts: { increment: 1 } },
  });
  if (claim.count === 0) {
    const fresh = await db.otpCode.findUnique({ where: { id: otp.id }, select: { consumedAt: true } });
    return { ok: false, error: fresh?.consumedAt ? "EXPIRED" : "TOO_MANY_ATTEMPTS" };
  }
  if (!safeEqualHex(otp.codeHash, hashOtp(phone, code))) return { ok: false, error: "INVALID_CODE" };
  return { ok: true, otpId: otp.id };
}

/** Mark a checked code as used. Returns false if another request consumed it first (replay). */
export async function consumeOtp(otpId: string): Promise<boolean> {
  const r = await db.otpCode.updateMany({
    where: { id: otpId, consumedAt: null },
    data: { consumedAt: new Date(), codeHash: SUCCESS_MARK },
  });
  return r.count === 1;
}

export type VerifyOtpResult = { ok: true } | { ok: false; error: OtpError; retryAfterSec?: number };

/** Check and consume in one go (callers with no extra preconditions). */
export async function verifyOtp(phone: string, code: string): Promise<VerifyOtpResult> {
  const r = await checkOtp(phone, code);
  if (!r.ok) return r;
  return (await consumeOtp(r.otpId)) ? { ok: true } : { ok: false, error: "EXPIRED" };
}
