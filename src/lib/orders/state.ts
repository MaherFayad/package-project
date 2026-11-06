import type { OrderStatus, ProductionEventType, Role } from "@/types";
import { statusTone, type ToneSpec } from "./status-tone";

/**
 * Order state machine (pure, no DB). Every status change in the app goes through
 * `assertTransition()` (via `transitionOrder()` in ./service), so the vendor portal, admin,
 * webhooks and the buyer all obey the same rules.
 *
 *   PENDING_PAYMENT ─pay─▶ PAID ─vendor accepts─▶ ACCEPTED ─▶ IN_PRODUCTION ─QC photos─▶ QC_PENDING
 *        │                  │                                     ▲                 │ ops approve
 *        ▼                  ▼                                     └── QC rejected ──┤
 *    CANCELLED          REFUNDED (any paid state before SHIPPED)                    ▼
 *                                                                           READY_TO_SHIP ─▶ SHIPPED ─▶ DELIVERED
 *
 * The proof is approved BEFORE the order exists (checkout), so PROOF_APPROVED is only used for
 * a re-proof after a QC rejection that needs buyer sign-off (admin only).
 */

/** Who is acting. SYSTEM = payment/courier webhooks and scheduled jobs. */
export type Actor = Role | "SYSTEM";

export interface TransitionRule {
  to: OrderStatus;
  /** Roles allowed to make this move (ADMIN may always move along any edge). */
  by: Actor[];
  /** Timeline event written when the move happens. */
  event: ProductionEventType;
}

export const TRANSITIONS: Record<OrderStatus, TransitionRule[]> = {
  PENDING_PAYMENT: [
    { to: "PAID", by: ["SYSTEM"], event: "PAYMENT_CONFIRMED" },
    { to: "CANCELLED", by: ["BUYER", "SYSTEM"], event: "CANCELLED" },
  ],
  PAID: [
    { to: "ACCEPTED", by: ["VENDOR"], event: "VENDOR_ACCEPTED" },
    { to: "PROOF_APPROVED", by: [], event: "PROOF_APPROVED" },
    { to: "REFUNDED", by: ["SYSTEM"], event: "CANCELLED" },
  ],
  PROOF_APPROVED: [
    { to: "ACCEPTED", by: ["VENDOR"], event: "VENDOR_ACCEPTED" },
    { to: "IN_PRODUCTION", by: ["VENDOR"], event: "PRODUCTION_STARTED" },
    { to: "REFUNDED", by: ["SYSTEM"], event: "CANCELLED" },
  ],
  ACCEPTED: [
    { to: "IN_PRODUCTION", by: ["VENDOR"], event: "PRODUCTION_STARTED" },
    { to: "REFUNDED", by: ["SYSTEM"], event: "CANCELLED" },
  ],
  IN_PRODUCTION: [
    { to: "QC_PENDING", by: ["VENDOR"], event: "QC_UPLOADED" },
    { to: "REFUNDED", by: ["SYSTEM"], event: "CANCELLED" },
  ],
  QC_PENDING: [
    { to: "READY_TO_SHIP", by: [], event: "QC_APPROVED" },
    { to: "IN_PRODUCTION", by: [], event: "QC_REJECTED" },
    { to: "PROOF_APPROVED", by: [], event: "PROOF_APPROVED" },
    { to: "REFUNDED", by: ["SYSTEM"], event: "CANCELLED" },
  ],
  READY_TO_SHIP: [
    { to: "SHIPPED", by: ["VENDOR", "SYSTEM"], event: "SHIPPED" },
    { to: "REFUNDED", by: ["SYSTEM"], event: "CANCELLED" },
  ],
  SHIPPED: [{ to: "DELIVERED", by: ["SYSTEM", "VENDOR"], event: "DELIVERED" }],
  DELIVERED: [{ to: "REFUNDED", by: ["SYSTEM"], event: "CANCELLED" }],
  CANCELLED: [],
  REFUNDED: [],
};

export const TERMINAL_STATUSES: OrderStatus[] = ["CANCELLED", "REFUNDED"];

export class OrderTransitionError extends Error {
  constructor(
    public readonly code: "INVALID_TRANSITION" | "FORBIDDEN_TRANSITION",
    public readonly from: OrderStatus,
    public readonly to: OrderStatus,
  ) {
    super(`${code}: ${from} -> ${to}`);
    this.name = "OrderTransitionError";
  }
}

export function findRule(from: OrderStatus, to: OrderStatus): TransitionRule | undefined {
  return TRANSITIONS[from]?.find((r) => r.to === to);
}

/** Is `from -> to` an edge of the graph at all (ignoring who asks)? */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return Boolean(findRule(from, to));
}

/** May `actor` move the order from `from` to `to`? ADMIN may take any edge. */
export function canActorTransition(from: OrderStatus, to: OrderStatus, actor: Actor): boolean {
  const rule = findRule(from, to);
  if (!rule) return false;
  return actor === "ADMIN" || rule.by.includes(actor);
}

/** Throws `OrderTransitionError` unless allowed; returns the rule (event type to log). */
export function assertTransition(from: OrderStatus, to: OrderStatus, actor: Actor): TransitionRule {
  const rule = findRule(from, to);
  if (!rule) throw new OrderTransitionError("INVALID_TRANSITION", from, to);
  if (actor !== "ADMIN" && !rule.by.includes(actor)) throw new OrderTransitionError("FORBIDDEN_TRANSITION", from, to);
  return rule;
}

/** Statuses an actor can move to from here (for action buttons). */
export function nextStatuses(from: OrderStatus, actor: Actor): OrderStatus[] {
  return (TRANSITIONS[from] ?? []).filter((r) => actor === "ADMIN" || r.by.includes(actor)).map((r) => r.to);
}

/** Paid and not yet finished/refunded: money is held for this order. */
export function isPaidStatus(s: OrderStatus): boolean {
  return !["PENDING_PAYMENT", "CANCELLED", "REFUNDED"].includes(s);
}

// ───────────────────────── buyer-facing progress ─────────────────────────

/** The six steps buyers see (report §4.1, step 8). */
export const BUYER_STEPS = ["PROOF_APPROVED", "PAID", "IN_PRODUCTION", "QC_PASSED", "SHIPPED", "DELIVERED"] as const;
export type BuyerStep = (typeof BUYER_STEPS)[number];

/**
 * Index for the UI Stepper: steps before it are complete, the step at it is current.
 * Returns BUYER_STEPS.length when everything is done.
 */
export function buyerStepIndex(status: OrderStatus): number {
  switch (status) {
    case "PENDING_PAYMENT":
      return 1;
    case "PAID":
    case "PROOF_APPROVED":
    case "ACCEPTED":
    case "IN_PRODUCTION":
      return 2;
    case "QC_PENDING":
      return 3;
    case "READY_TO_SHIP":
      return 4;
    case "SHIPPED":
      return 5;
    case "DELIVERED":
      return 6;
    default:
      return 0;
  }
}

/**
 * For cancelled/refunded orders: where the order stopped, from its timeline events
 * (the stepper shows that step in red).
 */
export function stoppedStepIndex(events: ProductionEventType[]): number {
  const has = (t: ProductionEventType) => events.includes(t);
  if (has("DELIVERED")) return 5;
  if (has("SHIPPED")) return 5;
  if (has("QC_APPROVED")) return 4;
  if (has("QC_UPLOADED")) return 3;
  if (has("PAYMENT_CONFIRMED")) return 2;
  return 1;
}

/** Badge tone + progress pip for a status pill. Delegates to the shared map in `status-tone.ts` (CR-08). */
export function statusBadge(status: OrderStatus): ToneSpec {
  return statusTone(status);
}

// ───────────────────────── after-sale rules ─────────────────────────

export const DISPUTE_WINDOW_DAYS = 30;

/** Defect claims: delivered orders, within 30 days of delivery (Consumer Protection Law 181/2018). */
export function canOpenDispute(status: OrderStatus, deliveredAt: Date | null, now = new Date(), hasOpenDispute = false): boolean {
  if (hasOpenDispute) return false;
  if (status !== "DELIVERED" || !deliveredAt) return false;
  return now.getTime() - deliveredAt.getTime() <= DISPUTE_WINDOW_DAYS * 86_400_000;
}

export function canReview(status: OrderStatus, alreadyReviewed: boolean): boolean {
  return status === "DELIVERED" && !alreadyReviewed;
}

/** Buyer may cancel only before paying. */
export function canBuyerCancel(status: OrderStatus): boolean {
  return status === "PENDING_PAYMENT";
}

// ───────────────────────── production files & API guards ─────────────────────────

/**
 * Statuses in which the vendor may download the print-ready PDF (buyer artwork). Before the vendor
 * accepts, it only sees the dieline (spec) so it can decide without taking the artwork.
 */
export const PRINT_FILES_UNLOCKED: readonly OrderStatus[] = ["ACCEPTED", "IN_PRODUCTION", "QC_PENDING", "READY_TO_SHIP", "SHIPPED", "DELIVERED"];

/**
 * May this user download the print-ready PDF of an order? Buyer (their own artwork) and ADMIN once
 * the order is paid; vendor staff of the order's vendor only after accepting the job.
 * (OWASP ASVS 4.0.3 V4.1.3 / V4.2.1, OWASP Top 10 A01:2021.)
 */
export function canDownloadPrintFile(
  order: { buyerId: string; vendorId: string; status: string },
  user: { id: string; role: Role; vendorId: string | null },
): boolean {
  const s = order.status as OrderStatus;
  if (!isPaidStatus(s)) return false;
  if (user.role === "ADMIN" || order.buyerId === user.id) return true;
  return user.role === "VENDOR" && !!user.vendorId && user.vendorId === order.vendorId && PRINT_FILES_UNLOCKED.includes(s);
}

/**
 * Targets the generic status endpoint never accepts, even from ADMIN: money states change only
 * through verified payment webhooks (PAID) and the refund flow (REFUNDED), so an order can never be
 * "paid" without a Payment row and an invoice.
 */
export const MONEY_STATUSES: readonly OrderStatus[] = ["PAID", "REFUNDED"];
