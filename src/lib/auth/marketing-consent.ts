import "server-only";
import { db } from "@/lib/db";
import { CONSENT_TEXT_VERSION } from "./constants";

/**
 * Withdraw a user's MARKETING consent (PDPL Law 151/2020). Shared by every opt-out route: the
 * account page toggle has its own action, while the signed one-click link and the WhatsApp "STOP"
 * reply both come here. Appends a withdrawal row to the consent log (append-only, so the history
 * stays provable) and switches User.marketingConsent off. Idempotent: returns false and writes
 * nothing when there was no consent to withdraw.
 */
export async function withdrawMarketingConsent(
  userId: string,
  meta: { locale: string; ip?: string | null; userAgent?: string | null },
): Promise<boolean> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, phone: true, marketingConsent: true } });
  if (!user || !user.marketingConsent) return false;
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { marketingConsent: false, consentAt: new Date() } }),
    db.consent.create({
      data: {
        userId: user.id,
        phone: user.phone,
        kind: "MARKETING",
        granted: false,
        textVersion: CONSENT_TEXT_VERSION,
        locale: meta.locale === "en" ? "en" : "ar",
        ip: meta.ip ?? null,
        userAgent: meta.userAgent?.slice(0, 300) ?? null,
      },
    }),
  ]);
  return true;
}
