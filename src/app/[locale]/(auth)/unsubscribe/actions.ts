"use server";

import { headers } from "next/headers";
import { db } from "@/lib/db";
import { CONSENT_TEXT_VERSION } from "@/lib/auth/constants";
import { verifyUnsubscribeToken } from "@/lib/auth/unsubscribe";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { toLocale } from "@/i18n";

export type UnsubscribeState = { status: "idle" | "done" | "invalid" | "error" };

/**
 * One-click withdrawal of MARKETING consent from the link in a follow-up message (PDPL Law
 * 151/2020). Needs no session: the signed link proves the account. Appends a withdrawal row to the
 * consent log (append-only, so the history stays provable) and switches User.marketingConsent off.
 * Idempotent: a second press records nothing new.
 */
export async function unsubscribeAction(_prev: UnsubscribeState, form: FormData): Promise<UnsubscribeState> {
  const userId = form.get("u");
  const token = form.get("t");
  if (!verifyUnsubscribeToken(userId, token)) return { status: "invalid" };
  const h = await headers();
  const ip = clientIp(h);
  if (!rateLimit("unsubscribe", `${ip}:${userId}`, 10, 60_000).ok) return { status: "error" };
  try {
    const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, phone: true, marketingConsent: true } });
    if (!user) return { status: "invalid" };
    if (user.marketingConsent) {
      await db.$transaction([
        db.user.update({ where: { id: user.id }, data: { marketingConsent: false, consentAt: new Date() } }),
        db.consent.create({
          data: {
            userId: user.id,
            phone: user.phone,
            kind: "MARKETING",
            granted: false,
            textVersion: CONSENT_TEXT_VERSION,
            locale: toLocale(form.get("locale")),
            ip,
            userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
          },
        }),
      ]);
    }
    return { status: "done" };
  } catch (e) {
    console.error("[unsubscribe] failed", e instanceof Error ? e.message : e);
    return { status: "error" };
  }
}
