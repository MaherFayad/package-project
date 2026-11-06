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

/**
 * Targets vendor staff may set through the API at all. DELIVERED is not one of them (R4-03): the
 * portal has no such action, delivery is confirmed by the courier sync (SYSTEM) or by ops, and a
 * vendor's own "delivered" would start the buyer's review and dispute clock and make the balance
 * payout earnable without proof of delivery (OWASP ASVS 4.0.3 V11.1.1 business-logic sequence).
 */
const VENDOR_API_TARGETS: OrderStatus[] = ["ACCEPTED", "IN_PRODUCTION", "QC_PENDING", "SHIPPED"];

export function vendorMoveAllowed(job: JobStateInput, to: OrderStatus): "OK" | "NOT_ALLOWED" {
  if (!VENDOR_API_TARGETS.includes(to)) return "NOT_ALLOWED";
  const action = ACTION_FOR[to];
  if (!action) return "OK";
  return can(job, action) ? "OK" : "NOT_ALLOWED";
}
