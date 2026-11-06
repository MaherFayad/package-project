/**
 * One badge tone per order status, used by the buyer, vendor and admin areas (CR-08).
 * Polaris convention: attention + incomplete = someone has to act; info + partial = work in
 * progress; success + complete = done; critical = a problem; neutral + complete = closed.
 * Labels stay per area (a vendor sees "Awaiting answer" where admin sees "Awaiting printer"),
 * but the colour and progress pip for a status are the same everywhere.
 * Created by the vendor session; the checkout session owns it (same name and signature).
 */
import type { OrderStatus } from "@/types";

export type StatusTone = "neutral" | "info" | "success" | "attention" | "warning" | "critical";
export type StatusProgress = "incomplete" | "partiallyComplete" | "complete";

export const STATUS_TONE: Record<OrderStatus, { tone: StatusTone; progress: StatusProgress }> = {
  PENDING_PAYMENT: { tone: "attention", progress: "incomplete" },
  PAID: { tone: "attention", progress: "incomplete" }, // awaiting the printer
  PROOF_APPROVED: { tone: "attention", progress: "incomplete" },
  ACCEPTED: { tone: "info", progress: "partiallyComplete" },
  IN_PRODUCTION: { tone: "info", progress: "partiallyComplete" },
  QC_PENDING: { tone: "info", progress: "partiallyComplete" },
  READY_TO_SHIP: { tone: "info", progress: "partiallyComplete" },
  SHIPPED: { tone: "info", progress: "partiallyComplete" },
  DELIVERED: { tone: "success", progress: "complete" },
  CANCELLED: { tone: "neutral", progress: "complete" },
  REFUNDED: { tone: "neutral", progress: "complete" },
};

/** Tone and progress pip for an order status (unknown values read as closed/neutral). */
export function statusTone(status: OrderStatus | string): { tone: StatusTone; progress: StatusProgress } {
  return STATUS_TONE[status as OrderStatus] ?? { tone: "neutral", progress: "complete" };
}

/** Disputes and other problems override the status colour. */
export const PROBLEM_TONE = { tone: "critical", progress: "incomplete" } as const;

/** Tone + progress pair (same shape as `statusTone()` returns). */
export interface ToneSpec {
  tone: StatusTone;
  progress: StatusProgress;
}

/**
 * Payment badge (checkout, extended in round 3): paid = neutral, complete (done, nothing to act
 * on); pending = attention, incomplete; failed = critical; refunded = critical, complete.
 * Buyer screens show this "Paid" badge next to the fulfilment status, whose PAID value reads
 * "Awaiting printer" (attention) for buyers, so "Paid" itself is never yellow (CR-08).
 */
export function paymentTone(status: string): ToneSpec {
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

/** Alias kept for checkout code: an open dispute on an order. */
export const DISPUTED_TONE: ToneSpec = PROBLEM_TONE;
