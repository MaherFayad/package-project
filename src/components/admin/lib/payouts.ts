import { z } from "zod";
import type { OrderStatus, PayoutKind } from "@/types";
import { splitVendorCost, type ScheduleRow, type ScheduleStatus } from "@/components/vendor/lib/payouts";

/**
 * Admin payout approvals (pure). Managed model, research report §4.1 "payout approvals" and the
 * vendor framework agreement: Elba pays the vendor its buy price in two parts, ADVANCE 40% once the
 * vendor accepts and BALANCE 60% after QC and delivery, against the vendor's ETA e-invoice to Elba.
 * Ops moves each part SCHEDULED/ON_HOLD -> PENDING (raise) -> APPROVED -> PAID.
 */

export const PAYOUT_STEPS = ["RAISE", "APPROVE", "PAY"] as const;
export type PayoutStep = (typeof PAYOUT_STEPS)[number];

export const payoutStepSchema = z.object({
  orderId: z.string().min(1).max(40),
  kind: z.enum(["ADVANCE", "BALANCE"]),
  step: z.enum(PAYOUT_STEPS),
  /** BALANCE only: ops confirms the vendor's ETA e-invoice for this amount is on file. */
  eInvoice: z.boolean().optional(),
});
export type PayoutStepInput = z.infer<typeof payoutStepSchema>;

/**
 * Payout rows that can no longer be paid once the order is refunded or cancelled: everything not
 * PAID yet (PENDING and APPROVED). There is no VOID status, so they are voided the way a
 * reassignment voids the old advance: deleted, with the rows kept in the audit entry (R7 fix; a
 * leftover APPROVED row was refused at PAY with PAYOUT_ORDER_CLOSED). Pure.
 */
export const UNPAID_PAYOUT_STATUSES = ["PENDING", "APPROVED"] as const;

export function unpaidPayouts<T extends { status: string }>(rows: readonly T[]): T[] {
  return rows.filter((r) => (UNPAID_PAYOUT_STATUSES as readonly string[]).includes(r.status));
}

/** Order states in which the vendor has accepted the job (the advance is earned). */
const ACCEPTED_OR_LATER: readonly string[] = ["ACCEPTED", "IN_PRODUCTION", "QC_PENDING", "READY_TO_SHIP", "SHIPPED", "DELIVERED"];

/** Can ops raise this part for an order in this status? Balance only after QC and delivery. */
export function canRaisePayout(kind: PayoutKind, orderStatus: OrderStatus | string): boolean {
  return kind === "ADVANCE" ? ACCEPTED_OR_LATER.includes(orderStatus) : orderStatus === "DELIVERED";
}

/** Amount of a part from the vendor buy price (same split the vendor portal shows). */
export function payoutAmount(kind: PayoutKind, vendorCostPiasters: number): number {
  const s = splitVendorCost(vendorCostPiasters);
  return kind === "ADVANCE" ? s.advance : s.balance;
}

/**
 * The one next step ops can take on a schedule row, or null (paid, or not earned yet). An open
 * dispute holds the balance: it may end in a reprint or refund that the vendor's balance covers.
 */
export function nextPayoutStep(row: Pick<ScheduleRow, "status" | "kind">, orderStatus: OrderStatus | string, openDispute = false): PayoutStep | null {
  if (openDispute && row.kind === "BALANCE" && row.status !== "PAID") return null;
  switch (row.status) {
    case "SCHEDULED":
    case "ON_HOLD":
      return canRaisePayout(row.kind, orderStatus) ? "RAISE" : null;
    case "PENDING":
      return "APPROVE";
    case "APPROVED":
      return "PAY";
    default:
      return null;
  }
}

/** Admin wording: an earned part with no payout row yet reads "To raise", not "Scheduled". */
export function adminPayoutStatus(row: Pick<ScheduleRow, "status" | "kind">, orderStatus: OrderStatus | string): ScheduleStatus {
  return row.status === "SCHEDULED" && canRaisePayout(row.kind, orderStatus) ? "ON_HOLD" : row.status;
}

/** Status a payout row must be in before a step, and the status after it. */
export const STEP_FROM: Record<Exclude<PayoutStep, "RAISE">, "PENDING" | "APPROVED"> = { APPROVE: "PENDING", PAY: "APPROVED" };
export const STEP_TO: Record<PayoutStep, "PENDING" | "APPROVED" | "PAID"> = { RAISE: "PENDING", APPROVE: "APPROVED", PAY: "PAID" };

/** Rows ops has to act on (raise, approve or pay): drives the nav badge and the overview to-do. */
export function needsAction(status: ScheduleStatus, kind: PayoutKind, orderStatus: OrderStatus | string, openDispute = false): boolean {
  return nextPayoutStep({ status, kind }, orderStatus, openDispute) !== null;
}

export const PAYOUT_VIEWS = ["todo", "scheduled", "paid", "all"] as const;
export type PayoutView = (typeof PAYOUT_VIEWS)[number];

export function inPayoutView(r: { status: ScheduleStatus; kind: PayoutKind; orderStatus: string; openDispute?: boolean }, view: PayoutView): boolean {
  if (view === "all") return true;
  if (view === "paid") return r.status === "PAID";
  const act = needsAction(r.status, r.kind, r.orderStatus, r.openDispute);
  return view === "todo" ? act : !act && r.status !== "PAID";
}

export function asPayoutView(v: string | null | undefined): PayoutView {
  return (PAYOUT_VIEWS as readonly string[]).includes(v ?? "") ? (v as PayoutView) : "todo";
}
