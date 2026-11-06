"use server";

import { headers } from "next/headers";
import { db } from "@/lib/db";
import { withdrawMarketingConsent } from "@/lib/auth/marketing-consent";
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
    const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) return { status: "invalid" };
    await withdrawMarketingConsent(user.id, { locale: toLocale(form.get("locale")), ip, userAgent: h.get("user-agent") });
    return { status: "done" };
  } catch (e) {
    console.error("[unsubscribe] failed", e instanceof Error ? e.message : e);
    return { status: "error" };
  }
}
