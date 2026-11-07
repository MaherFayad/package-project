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

/**
 * The buyer's plain tracker (R1-14): four stages a shop owner understands, «استلمنا طلبك ← نطبع
 * علبك ← في الطريق إليك ← تم التسليم». Printer acceptance, QC and the rest stay in the detailed
 * BUYER_TRACK, shown behind a disclosure. Same index rule: steps before it are complete.
 */
export const BUYER_SIMPLE_TRACK = ["RECEIVED", "PRINTING", "ON_THE_WAY", "DELIVERED"] as const;
export type BuyerSimpleStep = (typeof BUYER_SIMPLE_TRACK)[number];

/** Detailed BUYER_TRACK index to the plain one. */
export function simpleTrackFrom(detailed: number): number {
  if (detailed >= BUYER_TRACK.length) return BUYER_SIMPLE_TRACK.length;
  if (detailed >= BUYER_TRACK.indexOf("SHIPPED")) return 2; // ready to ship or shipped
  // R3-11: "Printing your boxes" only once the printer has accepted; a paid order waiting for the
  // printer's confirmation stays on "Order received".
  if (detailed >= BUYER_TRACK.indexOf("IN_PRODUCTION")) return 1;
  return 0;
}

export function buyerSimpleIndex(status: OrderStatus): number {
  return simpleTrackFrom(buyerTrackIndex(status));
}

export function buyerSimpleStopped(events: readonly ProductionEventType[]): number {
  return simpleTrackFrom(buyerTrackStopped(events));
}

/**
 * R2-10: the ONE status name a buyer reads for an order, on the order page, the orders list and
 * the account page: the plain tracker stage it is in («استلمنا طلبك / نطبع علبك / في الطريق إليك /
 * تم التسليم»). Only an unpaid, cancelled or refunded order keeps its own word.
 */
export function buyerStatusKey(status: OrderStatus): string {
  if (status === "PENDING_PAYMENT" || status === "CANCELLED" || status === "REFUNDED") return `orderStatus.${status}`;
  // R3-11: paid, the printer has not confirmed yet (it does within 24 hours).
  if (status === "PAID" || status === "PROOF_APPROVED") return "orders.detail.simple.AWAITING_PRINTER";
  const i = Math.min(buyerSimpleIndex(status), BUYER_SIMPLE_TRACK.length - 1);
  return `orders.detail.simple.${BUYER_SIMPLE_TRACK[i]}`;
}
