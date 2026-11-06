import { otpIpLimits } from "@/lib/env";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { normalizeEgyptPhone } from "@/lib/phone";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { checkOtp, consumeOtp } from "@/lib/auth/otp";
import { createSession } from "@/lib/auth/session";
import { crossSiteResponse, isCrossSiteRequest } from "@/lib/auth/csrf";
import { ANON_COOKIE, CONSENT_TEXT_VERSION } from "@/lib/auth/constants";
import { consentRowsForSignIn } from "@/lib/auth/consent";
import { cleanDisplayName } from "@/lib/auth/display-name";
import { GATE_COOKIE, GATE_REASONS } from "@/lib/analytics/events";
import { deviceOf, track } from "@/lib/analytics/track";

const Body = z.object({
  phone: z.string().min(6).max(32),
  code: z.string().regex(/^\d{4,8}$/),
  // R5-SEC-11: no control or bidi-override characters in a stored name.
  name: z.string().max(120).transform(cleanDisplayName).optional(),
  locale: z.enum(["ar", "en"]).default("ar"),
  /** Must be true for new accounts (terms + privacy notice). */
  acceptTerms: z.boolean().optional(),
  /**
   * Separate, unchecked-by-default marketing consent (PDPL 151/2020). On sign-in only an
   * explicit `true` is acted on; withdrawing is done from the account page, never implied by
   * leaving the box unticked at login.
   */
  marketingConsent: z.boolean().optional(),
  /** Analytics only (B-19): which soft gate opened the form. Falls back to the elba_gate cookie. */
  gateReason: z.enum(GATE_REASONS).optional(),
});

/**
 * POST /api/auth/verify-otp
 *   { phone, code, name?, locale, acceptTerms?, marketingConsent? }
 * 200 { ok: true, user: { id, role, name, isNew } } and sets the httpOnly session cookie.
 * 400 INVALID_INPUT | INVALID_PHONE | TERMS_REQUIRED | INVALID_CODE | EXPIRED | TOO_MANY_ATTEMPTS
 * 429 RATE_LIMITED | LOCKED { retryAfterSec } · 403 FORBIDDEN (cross-site)
 *
 * The code is checked BEFORE anything reveals whether the phone has an account, so the
 * TERMS_REQUIRED answer is only ever seen by someone holding a valid code for that phone.
 * Side effects: upserts User, records Consent rows, claims unexpired anonymous designs.
 */
export async function POST(req: Request) {
  if (isCrossSiteRequest(req.headers)) return crossSiteResponse();
  const ip = clientIp(req.headers);
  const rl = rateLimit("otp:verify:ip", ip, otpIpLimits().verifyPer10Min, 600_000);
  if (!rl.ok) {
    return Response.json(
      { error: "RATE_LIMITED", retryAfterSec: rl.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "INVALID_INPUT" }, { status: 400 });
  const b = parsed.data;
  const phone = normalizeEgyptPhone(b.phone);
  if (!phone) return Response.json({ error: "INVALID_PHONE" }, { status: 400 });

  const v = await checkOtp(phone, b.code);
  if (!v.ok) {
    if (v.error === "LOCKED") {
      const s = v.retryAfterSec ?? 3600;
      return Response.json({ error: "LOCKED", retryAfterSec: s }, { status: 429, headers: { "Retry-After": String(s) } });
    }
    return Response.json({ error: v.error }, { status: 400 });
  }

  const existing = await db.user.findUnique({ where: { phone } });
  // Valid code, new account, no terms tick: keep the code usable so the person can tick and resend.
  if (!existing && !b.acceptTerms) return Response.json({ error: "TERMS_REQUIRED" }, { status: 400 });
  if (!(await consumeOtp(v.otpId))) return Response.json({ error: "EXPIRED" }, { status: 400 });

  const now = new Date();
  const ua = req.headers.get("user-agent")?.slice(0, 300) ?? null;
  const latestTerms = existing
    ? await db.consent.findFirst({
        where: { userId: existing.id, kind: "TERMS", granted: true },
        orderBy: { createdAt: "desc" },
        select: { textVersion: true },
      })
    : null;
  const plan = consentRowsForSignIn({
    isNew: !existing,
    acceptTerms: !!b.acceptTerms,
    marketingConsent: b.marketingConsent,
    currentMarketing: existing?.marketingConsent ?? false,
    acceptedTermsVersion: latestTerms?.textVersion ?? null,
    textVersion: CONSENT_TEXT_VERSION,
  });

  const user = await db.$transaction(async (tx) => {
    const u = existing
      ? await tx.user.update({
          where: { id: existing.id },
          data: {
            lastLoginAt: now,
            ...(b.name && !existing.name ? { name: b.name } : {}),
            ...(plan.marketing !== null ? { marketingConsent: plan.marketing, consentAt: now } : {}),
          },
        })
      : await tx.user.create({
          data: {
            phone,
            name: b.name || null,
            locale: b.locale,
            role: "BUYER",
            marketingConsent: plan.marketing ?? false,
            consentAt: now,
            lastLoginAt: now,
          },
        });
    if (plan.rows.length) {
      await tx.consent.createMany({
        data: plan.rows.map((c) => ({
          ...c,
          userId: u.id,
          phone,
          textVersion: CONSENT_TEXT_VERSION,
          locale: b.locale,
          ip,
          userAgent: ua,
        })),
      });
    }
    return u;
  });

  // Claim anonymous designs made before sign-up. Expired drafts are past their retention
  // period (ANON_DESIGN_TTL_DAYS): delete them rather than bring them back to life.
  const jar = await cookies();
  const anonId = jar.get(ANON_COOKIE)?.value;
  if (anonId) {
    await db.design.deleteMany({ where: { anonId, ownerId: null, expiresAt: { lt: now }, proofs: { none: {} } } });
    await db.design.updateMany({
      where: { anonId, ownerId: null, OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] },
      data: { ownerId: user.id, expiresAt: null },
    });
  }

  await createSession(user.id);
  if (!existing) {
    // launch-metrics.md §1 `account_created`: OTP verified for a new phone, with the gate that
    // converted and the marketing choice. Pseudonymous ids only (never the phone).
    const cookieReason = jar.get(GATE_COOKIE)?.value;
    const gateReason = b.gateReason ?? (GATE_REASONS as readonly string[]).find((r) => r === cookieReason) ?? null;
    void track(
      "account_created",
      { gate_reason: gateReason, marketing_consent: plan.marketing === true, locale: b.locale, device: deviceOf(req.headers) },
      { userId: user.id, anonId: anonId && /^[\w-]{16,64}$/.test(anonId) ? anonId : null },
    );
  }
  if (jar.get(GATE_COOKIE)) jar.set(GATE_COOKIE, "", { path: "/api/auth", maxAge: 0 });
  return Response.json({
    ok: true,
    user: { id: user.id, role: user.role, name: user.name, isNew: !existing },
  });
}
