/**
 * R5-JR-05: a printer's on-time percentage from real deliveries (promised `dueDate` vs
 * `deliveredAt`), one rule for the admin scorecard and the public `Vendor.onTimePct`.
 * Pure; the database sync is in ./on-time-sync.ts.
 *
 * - A delivery is on time when it arrives by the end of its promised day (UTC day of dueDate).
 * - Reprints are not judged (they redo another job and would count the same box twice).
 * - Orders without a promised date or not delivered are not judged.
 */
export interface DeliveryRow {
  dueDate: Date | null;
  deliveredAt: Date | null;
  notes: string | null;
}

export function deliveredOnTime(o: Pick<DeliveryRow, "dueDate" | "deliveredAt">): boolean | null {
  if (!o.deliveredAt || !o.dueDate) return null;
  const endOfDue = new Date(o.dueDate);
  endOfDue.setUTCHours(23, 59, 59, 999);
  return o.deliveredAt.getTime() <= endOfDue.getTime();
}

const isReprintNote = (notes: string | null) => !!notes?.startsWith("REPRINT_OF:");

/** { judged, onTime, pct } over a vendor's orders; pct is null with no judged delivery. */
export function onTimeFromDeliveries(orders: DeliveryRow[]): { judged: number; onTime: number; pct: number | null } {
  const judged = orders.filter((o) => !isReprintNote(o.notes)).map(deliveredOnTime).filter((x): x is boolean => x !== null);
  const onTime = judged.filter(Boolean).length;
  return { judged: judged.length, onTime, pct: judged.length ? Math.round((onTime / judged.length) * 1000) / 10 : null };
}
