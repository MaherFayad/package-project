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
  name: string;
  userId: string | null;
  anonId: string | null;
}

/**
 * R5-JR-13: visitor-cohort funnel. The old count de-duplicated each step on its own key (a visit
 * by anon id, later steps often by user id once signed in), so one person could be two actors and
 * a step could exceed the one before ("Visitor to paid 100%", "Designer opened 200% of visitors").
 *
 * Now: (1) anon ids and user ids are joined into one person whenever any event row carries both
 * (sign-in on the same browser); (2) only people with a `visit` in the window are counted; (3) a
 * person counts at a step when they reached that step or any later one ("reached at least"), so a
 * signed-in buyer who never saw the sign-in gate still passes it. Every step is at most the one
 * before, and visitor → paid can never exceed 100%.
 */
export function cohortFunnel(rows: FunnelEventRow[], steps: readonly EventStep[] = EVENT_STEPS): Record<EventStep, number> {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let r = x;
    while (parent.get(r) && parent.get(r) !== r) r = parent.get(r)!;
    parent.set(x, r);
    return r;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  for (const r of rows) {
    if (r.userId) find(`u:${r.userId}`);
    if (r.anonId) find(`a:${r.anonId}`);
    if (r.userId && r.anonId) union(`a:${r.anonId}`, `u:${r.userId}`);
  }
  const key = (r: FunnelEventRow) => (r.userId ? find(`u:${r.userId}`) : r.anonId ? find(`a:${r.anonId}`) : null);
  // Furthest step each person reached.
  const index = new Map(steps.map((s, i) => [s as string, i]));
  const furthest = new Map<string, number>();
  const visitors = new Set<string>();
  for (const r of rows) {
    const k = key(r);
    const i = index.get(r.name);
    if (!k || i === undefined) continue;
    if (i === 0) visitors.add(k);
    furthest.set(k, Math.max(furthest.get(k) ?? -1, i));
  }
  const out = Object.fromEntries(steps.map((s) => [s, 0])) as Record<EventStep, number>;
  for (const k of visitors) {
    const f = furthest.get(k) ?? 0;
    for (let i = 0; i <= f; i++) out[steps[i]!]++;
  }
  return out;
}
