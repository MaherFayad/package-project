import { createHmac, timingSafeEqual } from "node:crypto";
import { sessionSecret } from "@/lib/env";
import type { Locale } from "@/types";

/**
 * One-click marketing opt-out link (Egypt PDPL Law 151/2020: withdrawing consent must be as easy as
 * giving it; a sign-in with a one-time code is not "easy" from a WhatsApp message).
 *
 * The link carries the pseudonymous User.id and an HMAC of it, keyed with the server secret, so
 * nobody can opt out someone else by guessing ids. The link only opens a confirmation page: the
 * withdrawal happens on a POST (button), so link scanners and chat previews that GET the URL never
 * withdraw consent by themselves. It never carries the phone number.
 */
const PURPOSE = "elba:unsubscribe:marketing:v1";
const ID_RE = /^[\w-]{1,64}$/;

export function unsubscribeToken(userId: string): string {
  return createHmac("sha256", sessionSecret()).update(`${PURPOSE}:${userId}`).digest("base64url").slice(0, 32);
}

export function verifyUnsubscribeToken(userId: unknown, token: unknown): userId is string {
  if (typeof userId !== "string" || typeof token !== "string" || !ID_RE.test(userId) || token.length !== 32) return false;
  const a = Buffer.from(unsubscribeToken(userId));
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Absolute link for a message: `${base}/${locale}/unsubscribe?u=…&t=…`. */
export function unsubscribeUrl(base: string, locale: Locale, userId: string): string {
  const q = new URLSearchParams({ u: userId, t: unsubscribeToken(userId) });
  return `${base.replace(/\/+$/, "")}/${locale}/unsubscribe?${q.toString()}`;
}
