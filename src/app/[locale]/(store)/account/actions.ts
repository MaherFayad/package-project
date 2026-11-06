"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { CONSENT_TEXT_VERSION } from "@/lib/auth/constants";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { toLocale } from "@/i18n";
import {
  consentSchema,
  designIdSchema,
  parseProfile,
  type ActionResult,
  type DataRequestStatus,
} from "@/components/store/account-logic";

/**
 * Account mutations (owner: storefront). Every action re-reads the session (never trusts the
 * client for the user id), validates input with zod, and is rate limited per user.
 * Next.js server actions also reject cross-origin POSTs.
 */

async function currentUser() {
  const s = await getSession();
  return s?.user ?? null;
}

function limited(ns: string, userId: string, limit = 20) {
  return !rateLimit(`account:${ns}`, userId, limit, 60_000).ok;
}

export async function updateProfileAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const user = await currentUser();
  if (!user) return { ok: false, error: "unauthorized" };
  if (limited("profile", user.id)) return { ok: false, error: "rateLimited" };
  const parsed = parseProfile({ name: form.get("name"), email: form.get("email") });
  if (!parsed.ok || !parsed.data) return parsed.ok ? { ok: false, error: "invalid" } : parsed;
  await db.user.update({ where: { id: user.id }, data: { name: parsed.data.name, email: parsed.data.email } });
  revalidatePath("/[locale]/(store)/account", "page");
  return { ok: true };
}

export async function setMarketingConsentAction(input: { granted: boolean; locale: string }): Promise<ActionResult> {
  const user = await currentUser();
  if (!user) return { ok: false, error: "unauthorized" };
  if (limited("consent", user.id, 10)) return { ok: false, error: "rateLimited" };
  const r = consentSchema.safeParse({ granted: input?.granted });
  if (!r.success) return { ok: false, error: "invalid" };
  const h = await headers();
  const now = new Date();
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { marketingConsent: r.data.granted, consentAt: now } }),
    db.consent.create({
      data: {
        userId: user.id,
        phone: user.phone,
        kind: "MARKETING",
        granted: r.data.granted,
        textVersion: CONSENT_TEXT_VERSION,
        locale: toLocale(input.locale),
        ip: clientIp(h),
        userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
      },
    }),
  ]);
  revalidatePath("/[locale]/(store)/account", "page");
  return { ok: true };
}

/**
 * Remove a saved design from the account. Designs whose proofs back an order are detached
 * (the immutable proof snapshot stays with the order) instead of hard-deleted.
 */
export async function deleteDesignAction(designId: string): Promise<ActionResult> {
  const user = await currentUser();
  if (!user) return { ok: false, error: "unauthorized" };
  if (limited("design", user.id)) return { ok: false, error: "rateLimited" };
  const id = designIdSchema.safeParse(designId);
  if (!id.success) return { ok: false, error: "invalid" };
  const design = await db.design.findFirst({ where: { id: id.data, ownerId: user.id }, select: { id: true, _count: { select: { proofs: true } } } });
  if (!design) return { ok: false, error: "notFound" };
  if (design._count.proofs > 0) {
    await db.design.update({ where: { id: design.id }, data: { ownerId: null, anonId: null, shareToken: null } });
  } else {
    await db.design.delete({ where: { id: design.id } });
  }
  revalidatePath("/[locale]/(store)/account", "page");
  return { ok: true };
}

/** PDPL erasure request. Queued for ops review (open orders and tax records must be handled first). */
export async function requestDeletionAction(): Promise<ActionResult<{ status: DataRequestStatus; createdAt: string }>> {
  const user = await currentUser();
  if (!user) return { ok: false, error: "unauthorized" };
  if (limited("erasure", user.id, 5)) return { ok: false, error: "rateLimited" };
  const existing = await db.dataRequest.findFirst({
    where: { userId: user.id, kind: "DELETE", status: { in: ["OPEN", "IN_PROGRESS"] } },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return { ok: true, data: { status: existing.status as DataRequestStatus, createdAt: existing.createdAt.toISOString() } };
  const h = await headers();
  const row = await db.dataRequest.create({ data: { userId: user.id, kind: "DELETE", ip: clientIp(h) } });
  revalidatePath("/[locale]/(store)/account", "page");
  return { ok: true, data: { status: "OPEN", createdAt: row.createdAt.toISOString() } };
}
