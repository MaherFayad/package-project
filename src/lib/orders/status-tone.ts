import type { OrderStatus } from "@/types";

/**
 * One badge tone map for order status, used by buyer, vendor and admin screens (CR-08).
 * Polaris convention: colour, progress dot and text agree. The tone follows the label, so the
 * same status never reads yellow in one place and grey in another.
 *
 * Fulfilment: awaiting payment / awaiting printer = attention, incomplete dot;
 * accepted, in production, QC, ready, shipped = info, partial dot; delivered = success, complete;
 * cancelled = neutral, complete; refunded = critical, complete.
 * Payment: paid = neutral, complete; pending = attention, incomplete; failed = critical; refunded = critical.
 */
export type StatusTone = "neutral" | "info" | "success" | "attention" | "warning" | "critical";
export type StatusProgress = "incomplete" | "partiallyComplete" | "complete";
export interface ToneSpec {
  tone: StatusTone;
  progress: StatusProgress;
}

const ORDER: Record<OrderStatus, ToneSpec> = {
  PENDING_PAYMENT: { tone: "attention", progress: "incomplete" },
  // Labelled "Paid": the money part is done, so it reads like a paid payment badge.
  PAID: { tone: "neutral", progress: "complete" },
  // Waiting for a printer to accept the job.
  PROOF_APPROVED: { tone: "attention", progress: "incomplete" },
  ACCEPTED: { tone: "info", progress: "partiallyComplete" },
  IN_PRODUCTION: { tone: "info", progress: "partiallyComplete" },
  QC_PENDING: { tone: "info", progress: "partiallyComplete" },
  READY_TO_SHIP: { tone: "info", progress: "partiallyComplete" },
  SHIPPED: { tone: "info", progress: "partiallyComplete" },
  DELIVERED: { tone: "success", progress: "complete" },
  CANCELLED: { tone: "neutral", progress: "complete" },
  REFUNDED: { tone: "critical", progress: "complete" },
};

export function statusTone(status: OrderStatus): ToneSpec {
  return ORDER[status] ?? { tone: "neutral", progress: "incomplete" };
}

export type PaymentToneStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED" | "EXPIRED" | "CANCELLED";

export function paymentTone(status: PaymentToneStatus | string): ToneSpec {
  switch (status) {
    case "PAID":
      return { tone: "neutral", progress: "complete" };
    case "FAILED":
      return { tone: "critical", progress: "incomplete" };
    case "REFUNDED":
      return { tone: "critical", progress: "complete" };
    case "EXPIRED":
    case "CANCELLED":
      return { tone: "neutral", progress: "incomplete" };
    default:
      return { tone: "attention", progress: "incomplete" };
  }
}

/** An open dispute on an order. */
export const DISPUTED_TONE: ToneSpec = { tone: "critical", progress: "incomplete" };
