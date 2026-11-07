import type { OrderStatus, ProductionEventType } from "@/types";

/**
 * The buyer's order tracker (R4-CR-04). Same as the shared BUYER_STEPS plus "Printer acceptance"
 * between Paid and In production: straight after payment the order is PAID (the list badge says
 * "Awaiting printer"), so the tracker must not already mark "In production" as current.
 */
export const BUYER_TRACK = ["PROOF_APPROVED", "PAID", "PRINTER_ACCEPTED", "IN_PRODUCTION", "QC_PASSED", "SHIPPED", "DELIVERED"] as const;
export type BuyerTrackStep = (typeof BUYER_TRACK)[number];

/** Index of the current step (steps before it are complete); BUYER_TRACK.length when all done. */
export function buyerTrackIndex(status: OrderStatus): number {
  switch (status) {
    case "PENDING_PAYMENT":
      return 1;
    case "PAID":
    case "PROOF_APPROVED":
      return 2;
    case "ACCEPTED":
    case "IN_PRODUCTION":
      return 3;
    case "QC_PENDING":
      return 4;
    case "READY_TO_SHIP":
      return 5;
    case "SHIPPED":
      return 6;
    case "DELIVERED":
      return 7;
    default:
      return 0;
  }
}

/** Where a cancelled or refunded order stopped, from its timeline (shown in red). */
export function buyerTrackStopped(events: readonly ProductionEventType[]): number {
  const has = (t: ProductionEventType) => events.includes(t);
  if (has("DELIVERED") || has("SHIPPED")) return 6;
  if (has("QC_APPROVED")) return 5;
  if (has("QC_UPLOADED")) return 4;
  if (has("PRODUCTION_STARTED") || has("VENDOR_ACCEPTED")) return 3;
  if (has("PAYMENT_CONFIRMED")) return 2;
  return 1;
}
