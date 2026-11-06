import { z } from "zod";
import { db } from "@/lib/db";

/**
 * Admin setting (PlatformSetting "vendor-metrics"): judged deliveries a printer needs before its
 * on-time percentage is shown to buyers (default 5, 1 to 50). Below it, public pages say
 * "New on Elba" and the admin scorecard shows the raw figure with "n of 5 deliveries".
 * Founder list: the threshold itself is a policy decision (round 7).
 */
export const VENDOR_METRICS_SETTING_KEY = "vendor-metrics";
export const DEFAULT_ON_TIME_MIN_DELIVERIES = 5;
export const vendorMetricsSchema = z.object({ onTimeMinDeliveries: z.number({ invalid_type_error: "ON_TIME_MIN_RANGE" }).int("ON_TIME_MIN_RANGE").min(1, "ON_TIME_MIN_RANGE").max(50, "ON_TIME_MIN_RANGE") });

export async function loadOnTimeMinDeliveries(): Promise<number> {
  const row = await db.platformSetting.findUnique({ where: { key: VENDOR_METRICS_SETTING_KEY } }).catch(() => null);
  const p = vendorMetricsSchema.safeParse(row?.value ?? null);
  return p.success ? p.data.onTimeMinDeliveries : DEFAULT_ON_TIME_MIN_DELIVERIES;
}
