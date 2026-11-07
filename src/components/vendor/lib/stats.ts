/**
 * P-02 (simplicity 2026-11): the printer's own performance numbers from the same data the admin
 * scorecard uses (real deliveries and buyer reviews), never the seeded Vendor.rating / onTimePct
 * columns. Under the admin minimum of judged deliveries the dashboard says "New on Elba". Pure.
 */
import { onTimeFromDeliveries, type DeliveryRow } from "@/lib/vendors/on-time";

export interface VendorStats {
  /** Judged deliveries (promised date vs delivered), reprints excluded. */
  judged: number;
  /** Deliveries needed before the on-time figure is shown (admin setting, default 5). */
  min: number;
  /** On-time percentage, null until `judged >= min`. */
  onTimePct: number | null;
  /** Average buyer review (1..5, one decimal), null with no review. */
  rating: number | null;
  ratingCount: number;
}

export function vendorStats(deliveries: DeliveryRow[], ratings: number[], min: number): VendorStats {
  const r = onTimeFromDeliveries(deliveries);
  const valid = ratings.filter((x) => Number.isFinite(x) && x >= 1 && x <= 5);
  return {
    judged: r.judged,
    min,
    onTimePct: r.judged >= min ? r.pct : null,
    rating: valid.length ? Math.round((valid.reduce((s, x) => s + x, 0) / valid.length) * 10) / 10 : null,
    ratingCount: valid.length,
  };
}
