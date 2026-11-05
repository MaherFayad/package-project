import "server-only";
import { db } from "@/lib/db";
import { otpDevEcho } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { OTP_LENGTH, OTP_MAX_ATTEMPTS, OTP_TTL_MINUTES } from "./constants";
import { generateOtp, hashOtp, safeEqualHex } from "./crypto";

export type RequestOtpResult =
  | { ok: true; expiresAt: Date; devCode?: string }
  | { ok: false; error: "RATE_LIMITED"; retryAfterSec: number };

/**
 * Issue a new OTP for a normalized E.164 phone.
 * Limits: 1 per 30 s and 5 per hour per phone; 20 per hour per IP.
 */
export async function requestOtp(phone: string, ip: string): Promise<RequestOtpResult> {
  for (const [ns, key, limit, windowMs] of [
    ["otp:phone:30s", phone, 1, 30_000],
    ["otp:phone:1h", phone, 5, 3_600_000],
    ["otp:ip:1h", ip, 20, 3_600_000],
  ] as const) {
    const r = rateLimit(ns, key, limit, windowMs);
    if (!r.ok) return { ok: false, error: "RATE_LIMITED", retryAfterSec: r.retryAfterSec };
  }

  const code = generateOtp(OTP_LENGTH);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);
  // Invalidate previous unconsumed codes for this phone.
  await db.otpCode.updateMany({
    where: { phone, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  await db.otpCode.create({ data: { phone, codeHash: hashOtp(phone, code), expiresAt, ip } });

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

export type VerifyOtpResult = { ok: true } | { ok: false; error: "INVALID_CODE" | "EXPIRED" | "TOO_MANY_ATTEMPTS" };

export async function verifyOtp(phone: string, code: string): Promise<VerifyOtpResult> {
  const otp = await db.otpCode.findFirst({
    where: { phone, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!otp) return { ok: false, error: "EXPIRED" };
  if (otp.expiresAt < new Date()) return { ok: false, error: "EXPIRED" };
  if (otp.attempts >= OTP_MAX_ATTEMPTS) return { ok: false, error: "TOO_MANY_ATTEMPTS" };

  if (!safeEqualHex(otp.codeHash, hashOtp(phone, code))) {
    await db.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    return { ok: false, error: "INVALID_CODE" };
  }
  await db.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
  return { ok: true };
}
