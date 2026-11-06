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
