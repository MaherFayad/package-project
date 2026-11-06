import { db } from "@/lib/db";
import { onTimeFromDeliveries, onTimeWrite } from "./on-time";
import { loadOnTimeMinDeliveries } from "./on-time-settings";
import { purgeCatalogCache } from "@/lib/catalog-cache";

/**
 * Write a printer's public on-time state from real deliveries. Runs after each DELIVERED
 * transition, in the daily job and when the admin changes the minimum.
 * - `onTimeJudged` always follows the deliveries.
 * - `onTimePublic` is true once judged >= the admin minimum (default 5).
 * - `onTimePct` is overwritten only for public printers, so a printer under the minimum keeps its
 *   current (for seeded printers, seeded) figure and buyers see "New on Elba" instead.
 */
export async function syncVendorOnTime(vendorIds?: string[]): Promise<{ updated: number }> {
  const min = await loadOnTimeMinDeliveries();
  const vendors = await db.vendor.findMany({ where: vendorIds ? { id: { in: vendorIds } } : {}, select: { id: true, onTimePct: true, onTimeJudged: true, onTimePublic: true } });
  if (!vendors.length) return { updated: 0 };
  const orders = await db.order.findMany({ where: { vendorId: { in: vendors.map((v) => v.id) }, deliveredAt: { not: null } }, select: { vendorId: true, dueDate: true, deliveredAt: true, notes: true } });
  let updated = 0;
  for (const v of vendors) {
    const r = onTimeFromDeliveries(orders.filter((o) => o.vendorId === v.id));
    const data = onTimeWrite(r, min);
    if (data.onTimeJudged === v.onTimeJudged && data.onTimePublic === v.onTimePublic && (data.onTimePct === undefined || data.onTimePct === v.onTimePct)) continue;
    await db.vendor.update({ where: { id: v.id }, data });
    updated++;
  }
  // Directory, profile and offer cards are cached under the catalogue tag.
  if (updated) purgeCatalogCache();
  return { updated };
}
