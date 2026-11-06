import { db } from "@/lib/db";
import type { AnalyticsEvent, EventName } from "./events";

/**
 * Funnel queries over the first-party Event table (B-19), for the admin dashboard. Server-only
 * (reads the database); no UI here — the admin owner renders these numbers.
 *
 * "Unique" counts use the pseudonymous actor: the userId when known, else the anonId. A browser
 * that signs in mid-session can be counted once as anonymous and once as a user for steps before
 * the gate; that is the usual first-party limitation and is acceptable for ratios.
 */
export interface Window {
  from: Date;
  to: Date;
}

/** Distinct users (userId) who saw an instant price in the window: the fixed "Price viewed" tile. */
export async function priceViewedUsers(w: Window): Promise<number> {
  return distinctUsers("price_viewed", w);
}

export async function distinctUsers(name: EventName, w: Window): Promise<number> {
  const rows = await db.event.findMany({
    where: { name, at: { gte: w.from, lt: w.to }, userId: { not: null } },
    select: { userId: true },
    distinct: ["userId"],
  });
  return rows.length;
}

/** Distinct actors (userId, else anonId) for an event; events with neither are counted per row. */
export async function distinctActors(name: EventName, w: Window): Promise<number> {
  const rows = await db.event.findMany({ where: { name, at: { gte: w.from, lt: w.to } }, select: { userId: true, anonId: true, id: true } });
  return new Set(rows.map((r) => r.userId ?? (r.anonId ? `a:${r.anonId}` : `e:${r.id}`))).size;
}

export async function eventCount(name: EventName, w: Window): Promise<number> {
  return db.event.count({ where: { name, at: { gte: w.from, lt: w.to } } });
}

export const FUNNEL_STEPS = [
  "visit",
  "design_started",
  "gate_shown",
  "account_created",
  "price_viewed",
  "order_started",
  "payment_succeeded",
] as const satisfies readonly AnalyticsEvent[];

/** The launch-metrics.md §2–3 funnel, one unique-actor count per step. */
export async function loadEventFunnel(w: Window): Promise<Record<(typeof FUNNEL_STEPS)[number], number>> {
  const counts = await Promise.all(FUNNEL_STEPS.map((s) => distinctActors(s, w)));
  return Object.fromEntries(FUNNEL_STEPS.map((s, i) => [s, counts[i]])) as Record<(typeof FUNNEL_STEPS)[number], number>;
}

/** Share loop (viral coefficient inputs): links created, visits, and accounts created by share visitors. */
export async function loadShareLoop(w: Window): Promise<{ linksCreated: number; visits: number; accountsFromShares: number }> {
  const [linksCreated, visits, visitors] = await Promise.all([
    eventCount("share_link_created", w),
    eventCount("share_link_visit", w),
    db.event.findMany({ where: { name: "share_link_visit", at: { gte: w.from, lt: w.to }, anonId: { not: null } }, select: { anonId: true }, distinct: ["anonId"] }),
  ]);
  const anonIds = visitors.map((v) => v.anonId!).filter(Boolean);
  const accountsFromShares = anonIds.length
    ? await db.event.count({ where: { name: "account_created", at: { gte: w.from, lt: w.to }, anonId: { in: anonIds } } })
    : 0;
  return { linksCreated, visits, accountsFromShares };
}
