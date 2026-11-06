import type { OrderStatus } from "@/types";
import { can, type JobAction, type JobStateInput } from "@/components/vendor/lib/jobs";

/**
 * Vendor moves through the generic status API must obey the same job rules as the vendor portal
 * (src/components/vendor/lib/jobs.ts), otherwise the API is a side door around them: accepting a
 * job the vendor already declined, or submitting QC without the first-sheet and packed-bundle
 * photos ops needs. Pure; the edge itself is still checked by assertTransition().
 */
const ACTION_FOR: Partial<Record<OrderStatus, JobAction>> = {
  ACCEPTED: "accept",
  IN_PRODUCTION: "startProduction",
  QC_PENDING: "submitQc",
};

export function vendorMoveAllowed(job: JobStateInput, to: OrderStatus): "OK" | "NOT_ALLOWED" {
  const action = ACTION_FOR[to];
  if (!action) return "OK";
  return can(job, action) ? "OK" : "NOT_ALLOWED";
}
