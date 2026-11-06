import { db } from "@/lib/db";
import { onTimeFromDeliveries } from "./on-time";

/**
 * Write `Vendor.onTimePct` (shown on the directory, profile and offer cards) from real deliveries.
 * Runs after each DELIVERED transition and in the daily job. A vendor with no judged delivery keeps
 * its value: the public pages show "No deliveries yet" for new printers (journeys R5-JR-05), so a
 * missing measurement is never published as 0%.
 */
export async function syncVendorOnTime(vendorIds?: string[]): Promise<{ updated: number }> {
  const vendors = await db.vendor.findMany({ where: vendorIds ? { id: { in: vendorIds } } : {}, select: { id: true, onTimePct: true } });
  if (!vendors.length) return { updated: 0 };
  const orders = await db.order.findMany({ where: { vendorId: { in: vendors.map((v) => v.id) }, deliveredAt: { not: null } }, select: { vendorId: true, dueDate: true, deliveredAt: true, notes: true } });
  let updated = 0;
  for (const v of vendors) {
    const { pct } = onTimeFromDeliveries(orders.filter((o) => o.vendorId === v.id));
    if (pct === null || pct === v.onTimePct) continue;
    await db.vendor.update({ where: { id: v.id }, data: { onTimePct: pct } });
    updated++;
  }
  return { updated };
}
