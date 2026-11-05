/** Order lifecycle. Order.status column. Transitions are enforced in src/lib/orders. */
export const ORDER_STATUSES = [
  "PENDING_PAYMENT",
  "PAID", //            payment confirmed (webhook)
  "PROOF_APPROVED", //  buyer approved the proof (usually before payment; kept for re-proof)
  "ACCEPTED", //        vendor accepted the job
  "IN_PRODUCTION",
  "QC_PENDING", //      vendor uploaded QC photos, ops reviewing
  "READY_TO_SHIP",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type ProductionEventType =
  | "ORDER_PLACED"
  | "PAYMENT_CONFIRMED"
  | "PROOF_APPROVED"
  | "VENDOR_ACCEPTED"
  | "VENDOR_DECLINED"
  | "PRODUCTION_STARTED"
  | "QC_UPLOADED"
  | "QC_APPROVED"
  | "QC_REJECTED"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "NOTE";

export const PAYMENT_METHODS = ["CARD", "WALLET", "FAWRY", "INSTAPAY"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED";

export type ShipmentStatus =
  | "CREATED"
  | "PICKED_UP"
  | "IN_TRANSIT"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "RETURNED";

export type PayoutKind = "ADVANCE" | "BALANCE";
export type PayoutStatus = "PENDING" | "APPROVED" | "PAID";

export type DisputeReason = "PRINT_DEFECT" | "WRONG_ITEM" | "LATE" | "DAMAGED" | "OTHER";
export type DisputeStatus =
  | "OPEN"
  | "UNDER_REVIEW"
  | "RESOLVED_REPRINT"
  | "RESOLVED_REFUND"
  | "REJECTED";

/** Stored in Order.shippingAddress (Json). */
export interface ShippingAddress {
  name: string;
  phone: string; // E.164
  governorate: string; // e.g. "Cairo", "Giza", "Alexandria"
  city: string;
  street: string;
  building?: string;
  floor?: string;
  apartment?: string;
  landmark?: string;
  notes?: string;
}
