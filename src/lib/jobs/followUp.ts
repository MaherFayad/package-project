import { db } from "@/lib/db";
import { notify } from "@/lib/notify";
import { currentConsentGranted } from "@/lib/auth/consent";
import { track } from "@/lib/analytics/track";
import { unsubscribeUrl } from "@/lib/auth/unsubscribe";
import { getT, type DictKey } from "@/i18n";
import { modelByCode } from "@/lib/library";
import type { Locale } from "@/types";

/**
 * B-23: the 24 h WhatsApp follow-up on a saved design (research report §1.3, bridge 5).
 *
 * Once a day: a design OWNED by a buyer account, last saved more than 24 h ago (and less than
 * FOLLOW_UP_MAX_AGE_DAYS ago, so the first run does not message every old design), with no
 * order, whose owner's CURRENT MARKETING consent is a grant (latest MARKETING Consent row has
 * granted=true: a withdrawal on the account page stops it) gets ONE WhatsApp message. The send is
 * recorded on Design.followedUpAt with a conditional claim, so a design is never nudged twice,
 * even if two job runs overlap. At most one message per user per FOLLOW_UP_USER_COOLDOWN_DAYS.
 *
 * The message (notify template DESIGN_FOLLOW_UP, ar + en) ends with a one-click opt-out link
 * (src/lib/auth/unsubscribe.ts; PDPL Law 151/2020: direct marketing needs consent and an easy way
 * to withdraw it, so no sign-in is needed). A user with an open erasure request is never messaged. The sender goes through the notify seam with WhatsApp only
 * (no SMS fallback); in this codebase the WhatsApp transport is the console mock (logs a masked
 * number, no network) until production wires WhatsApp Business.
 *
 * Pure orchestration: `now`, the data store, the sender and the tracker are injectable (tests).
 */
export const FOLLOW_UP_MIN_AGE_HOURS = 24;
export const FOLLOW_UP_MAX_AGE_DAYS = 7;
export const FOLLOW_UP_USER_COOLDOWN_DAYS = 7;
const BATCH = 500;

export interface FollowUpCandidate {
  designId: string;
  designName: string;
  structureCode: string;
  /** Library model code, for the name fallback of untitled designs. */
  modelCode?: string | null;
  updatedAt: Date;
  followedUpAt: Date | null;
  hasOrder: boolean;
  /** The owner has an open or in-progress DELETE data request (PDPL erasure): never market to them. */
  erasurePending?: boolean;
  /** The design has a price request (above the instant cap) in the last 30 days: the team is pricing it, so no "order here" nudge. */
  priceRequested?: boolean;
  owner: { id: string; phone: string; locale: string };
}

export interface ConsentRow {
  userId: string;
  kind: string;
  granted: boolean;
  createdAt: Date;
}

export interface FollowUpStore {
  /** Owned designs saved in [from, to] that were never followed up (the store may pre-filter). */
  candidates(window: { from: Date; to: Date }): Promise<FollowUpCandidate[]>;
  /** All MARKETING consent rows of these users. */
  marketingConsents(userIds: string[]): Promise<ConsentRow[]>;
  /** Users who already received a follow-up at or after `since`. */
  recentlyFollowedUp(userIds: string[], since: Date): Promise<Set<string>>;
  /** Atomically mark the design as followed up; false when another run got there first. */
  claim(designId: string, now: Date): Promise<boolean>;
  /** Undo a claim when the message could not be sent (so tomorrow's run can try again). */
  release(designId: string): Promise<void>;
}

export interface FollowUpMessage {
  phone: string;
  locale: Locale;
  params: { design: string; url: string; stop: string };
}
export type FollowUpSender = (m: FollowUpMessage) => Promise<boolean>;

export type SkipReason = "already_followed_up" | "has_order" | "too_recent" | "too_old" | "no_consent" | "user_cooldown" | "no_phone" | "erasure_pending" | "price_requested" | "send_failed";

export interface FollowUpReport {
  now: string;
  considered: number;
  sent: string[];
  skipped: Record<SkipReason, number>;
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const toLocale = (l: string): Locale => (l === "en" ? "en" : "ar");

/**
 * Pure: which candidates get a message now. Re-checks everything the store pre-filters, so the
 * rules are tested here and not only in SQL.
 */
export function selectFollowUps(
  candidates: readonly FollowUpCandidate[],
  consents: readonly ConsentRow[],
  recentUsers: ReadonlySet<string>,
  now: Date,
): { send: FollowUpCandidate[]; skipped: { designId: string; reason: SkipReason }[] } {
  const send: FollowUpCandidate[] = [];
  const skipped: { designId: string; reason: SkipReason }[] = [];
  const byUser = new Map<string, ConsentRow[]>();
  for (const c of consents) byUser.set(c.userId, [...(byUser.get(c.userId) ?? []), c]);
  const picked = new Set<string>();
  // Most recently saved first: if a user has several eligible designs, the freshest one wins.
  const sorted = [...candidates].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  for (const c of sorted) {
    const age = now.getTime() - c.updatedAt.getTime();
    let reason: SkipReason | null = null;
    if (c.followedUpAt) reason = "already_followed_up";
    else if (c.hasOrder) reason = "has_order";
    else if (c.priceRequested) reason = "price_requested";
    else if (age < FOLLOW_UP_MIN_AGE_HOURS * HOUR) reason = "too_recent";
    else if (age > FOLLOW_UP_MAX_AGE_DAYS * DAY) reason = "too_old";
    else if (!c.owner.phone) reason = "no_phone";
    else if (c.erasurePending) reason = "erasure_pending";
    else if (!currentConsentGranted(byUser.get(c.owner.id) ?? [], "MARKETING")) reason = "no_consent";
    else if (recentUsers.has(c.owner.id) || picked.has(c.owner.id)) reason = "user_cooldown";
    if (reason) {
      skipped.push({ designId: c.designId, reason });
      continue;
    }
    picked.add(c.owner.id);
    send.push(c);
  }
  return { send, skipped };
}

/** The design's own name, else its model or box style ("Mailer box"), never an empty «». */
export function designLabel(c: Pick<FollowUpCandidate, "designName" | "modelCode" | "structureCode">, locale: Locale): string {
  const own = c.designName.trim().slice(0, 60);
  if (own) return own;
  const model = modelByCode(c.modelCode)?.name[locale];
  if (model) return model;
  const style = getT(locale)(`structures.${c.structureCode}` as DictKey);
  return style.startsWith("structures.") ? (locale === "ar" ? "علبتك" : "your box") : style;
}

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

/** Default sender: the notify seam, WhatsApp only (console mock transport in dev/test). */
export const notifySender: FollowUpSender = async (m) => {
  const sent = await notify({
    to: { phone: m.phone },
    locale: m.locale,
    template: "DESIGN_FOLLOW_UP",
    params: m.params,
    channels: ["whatsapp"],
    smsFallback: false,
  });
  return sent.some((s) => s.channel === "whatsapp");
};

export const prismaFollowUpStore: FollowUpStore = {
  async candidates({ from, to }) {
    const rows = await db.design.findMany({
      where: {
        ownerId: { not: null },
        followedUpAt: null,
        updatedAt: { gte: from, lte: to },
        owner: { role: "BUYER" },
        // "No order": none of its proofs backs an order item.
        proofs: { none: { orderItems: { some: {} } } },
      },
      orderBy: { updatedAt: "desc" },
      take: BATCH,
      select: { id: true, name: true, structureCode: true, modelCode: true, updatedAt: true, followedUpAt: true, owner: { select: { id: true, phone: true, locale: true } } },
    });
    const ownerIds = [...new Set(rows.map((r) => r.owner?.id).filter((x): x is string => !!x))];
    const erasing = ownerIds.length
      ? new Set(
          (
            await db.dataRequest.findMany({
              where: { userId: { in: ownerIds }, kind: "DELETE", status: { in: ["OPEN", "IN_PROGRESS"] } },
              select: { userId: true },
            })
          ).map((r) => r.userId),
        )
      : new Set<string>();
    // Price requests are Quote rows that are neither an instant quote (OPEN) nor expired.
    const requested = rows.length
      ? new Set(
          (
            await db.quote.findMany({
              where: { designId: { in: rows.map((r) => r.id) }, status: { notIn: ["OPEN", "EXPIRED"] }, createdAt: { gte: new Date(from.getTime() - 23 * DAY) } },
              select: { designId: true },
            })
          ).map((q) => q.designId),
        )
      : new Set<string | null>();
    return rows
      .filter((r) => r.owner)
      .map((r) => ({
        designId: r.id,
        designName: r.name,
        structureCode: r.structureCode,
        modelCode: r.modelCode,
        updatedAt: r.updatedAt,
        followedUpAt: r.followedUpAt,
        hasOrder: false,
        erasurePending: erasing.has(r.owner!.id),
        priceRequested: requested.has(r.id),
        owner: r.owner!,
      }));
  },
  async marketingConsents(userIds) {
    if (!userIds.length) return [];
    const rows = await db.consent.findMany({
      where: { userId: { in: userIds }, kind: "MARKETING" },
      orderBy: { createdAt: "asc" },
      select: { userId: true, kind: true, granted: true, createdAt: true },
    });
    return rows.filter((r): r is ConsentRow => !!r.userId);
  },
  async recentlyFollowedUp(userIds, since) {
    if (!userIds.length) return new Set();
    const rows = await db.design.findMany({
      where: { ownerId: { in: userIds }, followedUpAt: { gte: since } },
      select: { ownerId: true },
      distinct: ["ownerId"],
    });
    return new Set(rows.map((r) => r.ownerId!).filter(Boolean));
  },
  async claim(designId, now) {
    const r = await db.design.updateMany({ where: { id: designId, followedUpAt: null }, data: { followedUpAt: now } });
    return r.count === 1;
  },
  async release(designId) {
    await db.design.updateMany({ where: { id: designId }, data: { followedUpAt: null } });
  },
};

export async function runFollowUps(opts: {
  now: Date;
  store?: FollowUpStore;
  send?: FollowUpSender;
  trackFn?: typeof track;
  baseUrl?: string;
}): Promise<FollowUpReport> {
  const { now } = opts;
  const store = opts.store ?? prismaFollowUpStore;
  const send = opts.send ?? notifySender;
  const trackFn = opts.trackFn ?? track;
  const base = (opts.baseUrl ?? siteUrl()).replace(/\/+$/, "");
  const skipped = Object.fromEntries(
    (["already_followed_up", "has_order", "too_recent", "too_old", "no_consent", "user_cooldown", "no_phone", "erasure_pending", "price_requested", "send_failed"] as SkipReason[]).map((r) => [r, 0]),
  ) as Record<SkipReason, number>;

  const candidates = await store.candidates({
    from: new Date(now.getTime() - FOLLOW_UP_MAX_AGE_DAYS * DAY),
    to: new Date(now.getTime() - FOLLOW_UP_MIN_AGE_HOURS * HOUR),
  });
  const userIds = [...new Set(candidates.map((c) => c.owner.id))];
  const [consents, recent] = await Promise.all([
    store.marketingConsents(userIds),
    store.recentlyFollowedUp(userIds, new Date(now.getTime() - FOLLOW_UP_USER_COOLDOWN_DAYS * DAY)),
  ]);
  const plan = selectFollowUps(candidates, consents, recent, now);
  for (const s of plan.skipped) skipped[s.reason]++;

  const sent: string[] = [];
  for (const c of plan.send) {
    // Claim first: two overlapping runs can never both send for the same design.
    if (!(await store.claim(c.designId, now))) {
      skipped.already_followed_up++;
      continue;
    }
    const locale = toLocale(c.owner.locale);
    let ok = false;
    try {
      ok = await send({
        phone: c.owner.phone,
        locale,
        params: {
          design: designLabel(c, locale),
          url: `${base}/${locale}/checkout/${encodeURIComponent(c.designId)}`,
          stop: unsubscribeUrl(base, locale, c.owner.id),
        },
      });
    } catch (e) {
      console.error("[jobs:follow-up] send failed", e instanceof Error ? e.message : e);
    }
    if (!ok) {
      await store.release(c.designId).catch(() => undefined);
      skipped.send_failed++;
      continue;
    }
    sent.push(c.designId);
    await trackFn("whatsapp_followup_sent", { locale, structure_code: c.structureCode }, { userId: c.owner.id, designId: c.designId, at: now });
  }
  return { now: now.toISOString(), considered: candidates.length, sent, skipped };
}
