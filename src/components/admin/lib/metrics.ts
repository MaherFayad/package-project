import type { OrderStatus } from "@/types";

/**
 * Admin overview metrics (pure, DB-free so they can be unit-tested). The server loads plain rows
 * and these functions turn them into the funnel, money and operations KPIs of report §6.3.
 *
 * Definitions
 * - GMV: buyer totals (incl. VAT and delivery) of orders that were paid and not refunded/cancelled.
 * - Net revenue: GMV ex-VAT ex-delivery (goods only). Margin: net revenue − vendor buy price.
 * - On-time %: delivered orders with a due date whose delivery happened on or before the due day.
 * - Reprint rate: reprint orders ÷ (shipped + delivered original orders) in the period.
 * - Dispute rate: disputes opened ÷ (shipped + delivered original orders) in the period.
 */

export const RANGES = ["7d", "30d", "90d"] as const;
export type RangeKey = (typeof RANGES)[number];
export const RANGE_DAYS: Record<RangeKey, number> = { "7d": 7, "30d": 30, "90d": 90 };
export const DAY_MS = 86_400_000;

export function asRange(v: string | null | undefined): RangeKey {
  return (RANGES as readonly string[]).includes(v ?? "") ? (v as RangeKey) : "30d";
}

/** [from, to) window for a range ending at `now`, plus the previous window of the same length. */
export function rangeWindow(range: RangeKey, now: Date): { from: Date; to: Date; prevFrom: Date } {
  const days = RANGE_DAYS[range];
  const to = now;
  const from = new Date(now.getTime() - days * DAY_MS);
  const prevFrom = new Date(from.getTime() - days * DAY_MS);
  return { from, to, prevFrom };
}

export const REPRINT_NOTE_PREFIX = "REPRINT_OF:";

export interface MetricOrder {
  number: string;
  status: OrderStatus | string;
  placedAt: Date;
  paidAt: Date | null;
  dueDate: Date | null;
  deliveredAt: Date | null;
  subtotalPiasters: number;
  vatPiasters: number;
  shippingPiasters: number;
  totalPiasters: number;
  vendorCostPiasters: number;
  notes: string | null;
  vendorId?: string;
}

export function isReprint(o: { notes: string | null }): boolean {
  return (o.notes ?? "").startsWith(REPRINT_NOTE_PREFIX);
}

/** Paid at some point and the money was kept (not refunded or cancelled). */
export function countsForGmv(o: Pick<MetricOrder, "status" | "paidAt">): boolean {
  if (o.status === "CANCELLED" || o.status === "REFUNDED" || o.status === "PENDING_PAYMENT") return false;
  return true;
}

/**
 * Goods value ex-VAT and ex-delivery. Orders from checkout store the subtotal INCLUDING delivery
 * (total = subtotal + VAT); older rows stored it excluding delivery (same rule as moneyOf()).
 */
export function goodsNet(o: Pick<MetricOrder, "subtotalPiasters" | "vatPiasters" | "shippingPiasters" | "totalPiasters">): number {
  const shippingIncluded = o.totalPiasters === o.subtotalPiasters + o.vatPiasters;
  return shippingIncluded ? o.subtotalPiasters - o.shippingPiasters : o.subtotalPiasters;
}

export function marginOf(o: MetricOrder): number {
  return goodsNet(o) - o.vendorCostPiasters;
}

export function isOnTime(o: Pick<MetricOrder, "dueDate" | "deliveredAt">): boolean | null {
  if (!o.deliveredAt || !o.dueDate) return null;
  // Due "day": anything delivered before the end of the due date counts as on time.
  const endOfDue = new Date(o.dueDate);
  endOfDue.setUTCHours(23, 59, 59, 999);
  return o.deliveredAt.getTime() <= endOfDue.getTime();
}

function within(d: Date | null | undefined, from: Date, to: Date): boolean {
  return !!d && d.getTime() >= from.getTime() && d.getTime() < to.getTime();
}

export interface MoneyKpis {
  orders: number;
  gmvPiasters: number;
  netPiasters: number;
  marginPiasters: number;
  /** 0..100, null when there is no revenue. */
  marginPct: number | null;
  aovPiasters: number | null;
}

export function moneyKpis(orders: MetricOrder[], from: Date, to: Date): MoneyKpis {
  const paid = orders.filter((o) => !isReprint(o) && countsForGmv(o) && within(o.placedAt, from, to));
  const gmv = paid.reduce((s, o) => s + o.totalPiasters, 0);
  const net = paid.reduce((s, o) => s + goodsNet(o), 0);
  const margin = paid.reduce((s, o) => s + marginOf(o), 0);
  return {
    orders: paid.length,
    gmvPiasters: gmv,
    netPiasters: net,
    marginPiasters: margin,
    marginPct: net > 0 ? round1((margin / net) * 100) : null,
    aovPiasters: paid.length ? Math.round(gmv / paid.length) : null,
  };
}

export interface OpsKpis {
  delivered: number;
  onTime: number;
  /** 0..100 or null when nothing was delivered with a due date. */
  onTimePct: number | null;
  fulfilled: number;
  reprints: number;
  reprintPct: number | null;
  disputes: number;
  disputePct: number | null;
  openDisputes: number;
}

export interface MetricDispute {
  createdAt: Date;
  status: string;
}

export const OPEN_DISPUTE_STATUSES = ["OPEN", "UNDER_REVIEW"] as const;

export function opsKpis(orders: MetricOrder[], disputes: MetricDispute[], from: Date, to: Date): OpsKpis {
  const originals = orders.filter((o) => !isReprint(o));
  const deliveredInRange = originals.filter((o) => within(o.deliveredAt, from, to));
  const judged = deliveredInRange.map(isOnTime).filter((x): x is boolean => x !== null);
  const onTime = judged.filter(Boolean).length;
  const fulfilled = originals.filter(
    (o) => (o.status === "SHIPPED" || o.status === "DELIVERED" || (o.status === "REFUNDED" && o.deliveredAt)) && within(o.deliveredAt ?? o.placedAt, from, to),
  ).length;
  const reprints = orders.filter((o) => isReprint(o) && within(o.placedAt, from, to)).length;
  const disputesInRange = disputes.filter((d) => within(d.createdAt, from, to)).length;
  return {
    delivered: deliveredInRange.length,
    onTime,
    onTimePct: judged.length ? round1((onTime / judged.length) * 100) : null,
    fulfilled,
    reprints,
    reprintPct: fulfilled ? round1((reprints / fulfilled) * 100) : null,
    disputes: disputesInRange,
    disputePct: fulfilled ? round1((disputesInRange / fulfilled) * 100) : null,
    openDisputes: disputes.filter((d) => (OPEN_DISPUTE_STATUSES as readonly string[]).includes(d.status)).length,
  };
}

/* ───────────────────────── Free-tool funnel (report §1.3, §6.3) ───────────────────────── */

export const FUNNEL_STEPS = ["designs", "accounts", "priceViewed", "orders"] as const;
export type FunnelStep = (typeof FUNNEL_STEPS)[number];

export interface FunnelRow {
  step: FunnelStep;
  count: number;
  /** % of the first step (0..100), null when the first step is 0. */
  ofFirstPct: number | null;
  /** % of the previous step. */
  ofPrevPct: number | null;
}

export function funnel(counts: Record<FunnelStep, number>): FunnelRow[] {
  const first = counts.designs;
  return FUNNEL_STEPS.map((step, i) => {
    const count = counts[step];
    const prev = i === 0 ? null : counts[FUNNEL_STEPS[i - 1]!];
    return {
      step,
      count,
      ofFirstPct: first > 0 ? round1((count / first) * 100) : null,
      ofPrevPct: prev === null ? null : prev > 0 ? round1((count / prev) * 100) : null,
    };
  });
}

/* ───────────────────────── Time series ───────────────────────── */

export interface SeriesPoint {
  /** Bucket start (ISO date). */
  start: string;
  value: number;
}

/** Buckets of `bucketDays` from `from` to `to`, summing `valueOf` for orders placed in each. */
export function bucketSeries<T>(rows: T[], dateOf: (r: T) => Date | null, valueOf: (r: T) => number, from: Date, to: Date, bucketDays: number): SeriesPoint[] {
  const size = bucketDays * DAY_MS;
  const n = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / size));
  const out: SeriesPoint[] = Array.from({ length: n }, (_, i) => ({ start: new Date(from.getTime() + i * size).toISOString(), value: 0 }));
  for (const r of rows) {
    const d = dateOf(r);
    if (!d || d < from || d >= to) continue;
    const idx = Math.min(n - 1, Math.floor((d.getTime() - from.getTime()) / size));
    out[idx]!.value += valueOf(r);
  }
  return out;
}

export function bucketDaysFor(range: RangeKey): number {
  return range === "7d" ? 1 : range === "30d" ? 3 : 7;
}

/** Percentage change from `prev` to `cur` (null when prev is 0). */
export function changePct(cur: number, prev: number): number | null {
  if (prev === 0) return null;
  return round1(((cur - prev) / prev) * 100);
}

/* ───────────────────────── Vendor scorecard ───────────────────────── */

export interface ScorecardInput {
  vendorId: string;
  orders: MetricOrder[];
  disputes: { orderNumber: string; status: string }[];
  ratings: number[];
  qc: { status: string }[];
}

export interface Scorecard {
  vendorId: string;
  orders: number;
  gmvPiasters: number;
  marginPiasters: number;
  delivered: number;
  onTimePct: number | null;
  reprintPct: number | null;
  disputePct: number | null;
  rating: number | null;
  qcPassPct: number | null;
  /** Simple 0..100 health score for sorting (on-time 40, quality 40, rating 20). */
  health: number | null;
}

export function scorecard(input: ScorecardInput): Scorecard {
  const originals = input.orders.filter((o) => !isReprint(o));
  const paid = originals.filter(countsForGmv);
  const delivered = originals.filter((o) => o.deliveredAt);
  const judged = delivered.map(isOnTime).filter((x): x is boolean => x !== null);
  const reprints = input.orders.filter(isReprint).length;
  const fulfilled = originals.filter((o) => o.status === "SHIPPED" || o.status === "DELIVERED" || !!o.deliveredAt).length;
  const reviewedQc = input.qc.filter((q) => q.status === "APPROVED" || q.status === "REJECTED");
  const qcPass = reviewedQc.filter((q) => q.status === "APPROVED").length;
  const rating = input.ratings.length ? Math.round((input.ratings.reduce((s, r) => s + r, 0) / input.ratings.length) * 10) / 10 : null;
  const onTimePct = judged.length ? round1((judged.filter(Boolean).length / judged.length) * 100) : null;
  const reprintPct = fulfilled ? round1((reprints / fulfilled) * 100) : null;
  const disputePct = fulfilled ? round1((input.disputes.length / fulfilled) * 100) : null;
  const qcPassPct = reviewedQc.length ? round1((qcPass / reviewedQc.length) * 100) : null;

  let health: number | null = null;
  if (onTimePct !== null || reprintPct !== null || rating !== null) {
    const quality = 100 - Math.min(100, (reprintPct ?? 0) * 5 + (disputePct ?? 0) * 5);
    health = Math.round((onTimePct ?? 100) * 0.4 + quality * 0.4 + ((rating ?? 5) / 5) * 100 * 0.2);
  }
  return {
    vendorId: input.vendorId,
    orders: originals.length,
    gmvPiasters: paid.reduce((s, o) => s + o.totalPiasters, 0),
    marginPiasters: paid.reduce((s, o) => s + marginOf(o), 0),
    delivered: delivered.length,
    onTimePct,
    reprintPct,
    disputePct,
    rating,
    qcPassPct,
    health,
  };
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/* ───────────────────────── Retention and supply (B-19, research report §6.3) ───────────────────────── */

/**
 * 90-day repeat rate: of buyers whose first kept order is at least 90 days old, the share who
 * placed another kept order within 90 days of the first. Younger buyers are left out (they have
 * not had 90 days yet), so the number does not sink with growth. null when nobody qualifies.
 * The plan's Phase 3 gate is ≥ 40%.
 */
export function repeatRate90(orders: { buyerId: string; placedAt: Date }[], now: Date): { pct: number | null; cohort: number; repeaters: number } {
  const byBuyer = new Map<string, number[]>();
  for (const o of orders) {
    const list = byBuyer.get(o.buyerId) ?? [];
    list.push(o.placedAt.getTime());
    byBuyer.set(o.buyerId, list);
  }
  let cohort = 0;
  let repeaters = 0;
  const window = 90 * DAY_MS;
  for (const times of byBuyer.values()) {
    times.sort((a, b) => a - b);
    const first = times[0]!;
    if (now.getTime() - first < window) continue;
    cohort++;
    if (times.some((t, i) => i > 0 && t - first <= window)) repeaters++;
  }
  return { pct: cohort ? round1((repeaters / cohort) * 100) : null, cohort, repeaters };
}

/** Vendor acceptance rate from VENDOR_ACCEPTED / VENDOR_DECLINED events in the window. */
export function acceptanceRate(events: { type: string }[]): { pct: number | null; accepted: number; declined: number } {
  const accepted = events.filter((e) => e.type === "VENDOR_ACCEPTED").length;
  const declined = events.filter((e) => e.type === "VENDOR_DECLINED").length;
  const n = accepted + declined;
  return { pct: n ? round1((accepted / n) * 100) : null, accepted, declined };
}
