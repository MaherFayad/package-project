import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { normalizeEgyptPhone } from "@/lib/phone";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { verifyOtp } from "@/lib/auth/otp";
import { createSession } from "@/lib/auth/session";
import { ANON_COOKIE, CONSENT_TEXT_VERSION } from "@/lib/auth/constants";

const Body = z.object({
  phone: z.string().min(6).max(32),
  code: z.string().regex(/^\d{4,8}$/),
  name: z.string().trim().max(120).optional(),
  locale: z.enum(["ar", "en"]).default("ar"),
  /** Must be true for new accounts (terms + privacy notice). */
  acceptTerms: z.boolean().optional(),
  /** Separate, unchecked-by-default marketing consent (PDPL 151/2020). */
  marketingConsent: z.boolean().optional(),
});

/**
 * POST /api/auth/verify-otp
 *   { phone, code, name?, locale, acceptTerms?, marketingConsent? }
 * 200 { ok: true, user: { id, role, name, isNew } } and sets the httpOnly session cookie.
 * 400 INVALID_INPUT | INVALID_PHONE | TERMS_REQUIRED | INVALID_CODE | EXPIRED | TOO_MANY_ATTEMPTS
 * Side effects: upserts User, records Consent rows, claims anonymous designs (cookie elba_anon).
 */
export async function POST(req: Request) {
  const ip = clientIp(req.headers);
  const rl = rateLimit("otp:verify:ip", ip, 30, 600_000);
  if (!rl.ok) return Response.json({ error: "RATE_LIMITED", retryAfterSec: rl.retryAfterSec }, { status: 429 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "INVALID_INPUT" }, { status: 400 });
  const b = parsed.data;
  const phone = normalizeEgyptPhone(b.phone);
  if (!phone) return Response.json({ error: "INVALID_PHONE" }, { status: 400 });

  const existing = await db.user.findUnique({ where: { phone } });
  if (!existing && !b.acceptTerms) return Response.json({ error: "TERMS_REQUIRED" }, { status: 400 });

  const v = await verifyOtp(phone, b.code);
  if (!v.ok) return Response.json({ error: v.error }, { status: 400 });

  const now = new Date();
  const ua = req.headers.get("user-agent")?.slice(0, 300) ?? null;
  const user = existing
    ? await db.user.update({
        where: { id: existing.id },
        data: {
          lastLoginAt: now,
          ...(b.name && !existing.name ? { name: b.name } : {}),
          ...(b.marketingConsent !== undefined && b.marketingConsent !== existing.marketingConsent
            ? { marketingConsent: b.marketingConsent, consentAt: now }
            : {}),
        },
      })
    : await db.user.create({
        data: {
          phone,
          name: b.name || null,
          locale: b.locale,
          role: "BUYER",
          marketingConsent: b.marketingConsent ?? false,
          consentAt: now,
          lastLoginAt: now,
        },
      });

  const consentRows: { kind: string; granted: boolean }[] = [];
  if (!existing) consentRows.push({ kind: "TERMS", granted: true }, { kind: "PRIVACY", granted: true });
  if (b.marketingConsent !== undefined && (!existing || b.marketingConsent !== existing.marketingConsent)) {
    consentRows.push({ kind: "MARKETING", granted: b.marketingConsent });
  }
  if (consentRows.length) {
    await db.consent.createMany({
      data: consentRows.map((c) => ({
        ...c,
        userId: user.id,
        phone,
        textVersion: CONSENT_TEXT_VERSION,
        locale: b.locale,
        ip,
        userAgent: ua,
      })),
    });
  }

  // Claim anonymous designs made before sign-up.
  const jar = await cookies();
  const anonId = jar.get(ANON_COOKIE)?.value;
  if (anonId) {
    await db.design.updateMany({
      where: { anonId, ownerId: null },
      data: { ownerId: user.id, expiresAt: null },
    });
  }

  await createSession(user.id);
  return Response.json({
    ok: true,
    user: { id: user.id, role: user.role, name: user.name, isNew: !existing },
  });
}
