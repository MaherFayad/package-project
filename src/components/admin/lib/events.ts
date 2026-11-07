/**
 * Event funnel presentation (B-19, admin half; pure). Counts come from the platform's
 * `loadEventFunnel()` (unique actors per launch-metrics.md step). The plan's headline ratio is
 * visitor → paid, target 2 to 4% for B2B SMB (research report §6.3, an assumption to replace with
 * our own baseline after 4 weeks).
 */
export const EVENT_STEPS = ["visit", "design_started", "gate_shown", "account_created", "price_viewed", "order_started", "payment_succeeded"] as const;
export type EventStep = (typeof EVENT_STEPS)[number];

export interface EventFunnelRow {
  step: EventStep;
  count: number;
  /** % of visitors (null without visits). */
  ofVisitsPct: number | null;
  /** % of the step before (null for the first step or when it was 0). */
  ofPrevPct: number | null;
}

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : null);

export function eventFunnel(counts: Record<EventStep, number>): EventFunnelRow[] {
  return EVENT_STEPS.map((step, i) => ({
    step,
    count: counts[step] ?? 0,
    ofVisitsPct: pct(counts[step] ?? 0, counts.visit ?? 0),
    ofPrevPct: i === 0 ? null : pct(counts[step] ?? 0, counts[EVENT_STEPS[i - 1]!] ?? 0),
  }));
}

export function visitorToPaid(counts: Record<EventStep, number>): number | null {
  return pct(counts.payment_succeeded ?? 0, counts.visit ?? 0);
}

/** Plan band for visitor → paid (2 to 4%). */
export function conversionBand(p: number | null): "none" | "below" | "in" | "above" {
  if (p === null) return "none";
  return p < 2 ? "below" : p > 4 ? "above" : "in";
}

export interface FunnelEventRow {
  id?: string;
  name: string;
  userId: string | null;
  anonId: string | null;
}

/**
 * R5-JR-13 (rule revised in admin round 8 after a hand count on real events). The old count
 * de-duplicated each step on its own key, so one person could be two actors and a step could
 * exceed the one before ("Visitor to paid 100%", "Designer opened 200% of visitors").
 *
 * Facts from the event table: a `visit` usually carries neither id (the anon cookie only exists
 * once an anonymous design is saved, and repeat visits from one browser within 30 minutes are
 * dropped server-side), so a visit can rarely be joined to the same person's later steps.
 *
 * Rule: (1) anon ids and user ids are one person whenever an event row carries both; (2) a person
 * counts at a step when they reached it or any later one ("reached at least"), so everyone who
 * designed or paid also counts as a visitor (nobody designs without visiting); (3) a visit with no
 * id is one visitor of its own. Every step is at most the one before and visitor to paid stays
 * at or under 100%. It can over-count visitors slightly (an id-less visit by someone who later
 * signs in counts twice), never under-count.
 */
export function cohortFunnel(rows: FunnelEventRow[], steps: readonly EventStep[] = EVENT_STEPS): Record<EventStep, number> {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let r = x;
    while (parent.get(r) && parent.get(r) !== r) r = parent.get(r)!;
    parent.set(x, r);
    return r;
  };
  for (const r of rows) {
    if (r.userId) find(`u:${r.userId}`);
    if (r.anonId) find(`a:${r.anonId}`);
    if (r.userId && r.anonId) {
      const ra = find(`a:${r.anonId}`);
      const rb = find(`u:${r.userId}`);
      if (ra !== rb) parent.set(ra, rb);
    }
  }
  const index = new Map(steps.map((s, i) => [s as string, i]));
  const furthest = new Map<string, number>();
  let anonymousVisits = 0;
  rows.forEach((r) => {
    const i = index.get(r.name);
    if (i === undefined) return;
    const k = r.userId ? find(`u:${r.userId}`) : r.anonId ? find(`a:${r.anonId}`) : null;
    if (!k) {
      // An id-less later step cannot be tied to anyone: only visits count on their own.
      if (i === 0) anonymousVisits++;
      return;
    }
    furthest.set(k, Math.max(furthest.get(k) ?? -1, i));
  });
  const out = Object.fromEntries(steps.map((s) => [s, 0])) as Record<EventStep, number>;
  out[steps[0]!] += anonymousVisits;
  for (const f of furthest.values()) for (let i = 0; i <= f; i++) out[steps[i]!]++;
  return out;
}
