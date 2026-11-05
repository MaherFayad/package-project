/**
 * Vendor payout schedule (pure). Managed model (research report §7.2, framework agreement):
 * Elba pays the vendor its buy price (Order.vendorCostPiasters) in two parts:
 *   - ADVANCE 40% when the vendor accepts the job,
 *   - BALANCE 60% after ops approves the QC photos and the order is delivered,
 *     against the vendor's ETA e-invoice to Elba.
 * Payout rows (PENDING -> APPROVED -> PAID) are created/approved by ops; this module merges the
 * rows that exist with the parts that are still only scheduled.
 */
import type { OrderStatus, PayoutKind, PayoutStatus } from "@/types";

export const ADVANCE_SHARE = 0.4;

export function splitVendorCost(costPiasters: number, share = ADVANCE_SHARE): { advance: number; balance: number } {
  const cost = Math.max(0, Math.round(costPiasters));
  const advance = Math.round(cost * share);
  return { advance, balance: cost - advance };
}

/** Order states in which the vendor has accepted the job (advance is earned). */
const ACCEPTED_OR_LATER: readonly OrderStatus[] = ["ACCEPTED", "IN_PRODUCTION", "QC_PENDING", "READY_TO_SHIP", "SHIPPED", "DELIVERED"];

export type ScheduleStatus = PayoutStatus | "SCHEDULED" | "ON_HOLD";

export interface PayoutOrderInput {
  id: string;
  number: string;
  status: OrderStatus | string;
  vendorCostPiasters: number;
  deliveredAt?: Date | string | null;
}

export interface PayoutRowInput {
  id: string;
  orderId: string | null;
  kind: PayoutKind | string;
  amountPiasters: number;
  status: PayoutStatus | string;
  createdAt: Date | string;
  approvedAt?: Date | string | null;
  paidAt?: Date | string | null;
}

export interface ScheduleRow {
  key: string;
  payoutId: string | null;
  orderId: string | null;
  orderNumber: string | null;
  kind: PayoutKind;
  amountPiasters: number;
  status: ScheduleStatus;
  /** What releases this part. */
  trigger: "ACCEPTANCE" | "QC_AND_DELIVERY";
  /** Balance waits on the vendor's e-invoice to Elba. */
  needsEInvoice: boolean;
  date: string | null; // ISO: paidAt, else approvedAt, else createdAt; null when only scheduled
}

const iso = (d: Date | string | null | undefined) => (d ? (typeof d === "string" ? new Date(d) : d).toISOString() : null);

export function payoutSchedule(orders: PayoutOrderInput[], payouts: PayoutRowInput[]): ScheduleRow[] {
  const byOrder = new Map(orders.map((o) => [o.id, o]));
  const rows: ScheduleRow[] = [];
  const seen = new Set<string>();

  for (const p of payouts) {
    const o = p.orderId ? byOrder.get(p.orderId) : undefined;
    const kind: PayoutKind = p.kind === "BALANCE" ? "BALANCE" : "ADVANCE";
    if (p.orderId) seen.add(`${p.orderId}:${kind}`);
    rows.push({
      key: p.id,
      payoutId: p.id,
      orderId: p.orderId,
      orderNumber: o?.number ?? null,
      kind,
      amountPiasters: p.amountPiasters,
      status: (["PENDING", "APPROVED", "PAID"].includes(p.status) ? p.status : "PENDING") as PayoutStatus,
      trigger: kind === "ADVANCE" ? "ACCEPTANCE" : "QC_AND_DELIVERY",
      needsEInvoice: kind === "BALANCE" && p.status !== "PAID",
      date: iso(p.paidAt) ?? iso(p.approvedAt) ?? iso(p.createdAt),
    });
  }

  for (const o of orders) {
    const status = o.status as OrderStatus;
    if (!ACCEPTED_OR_LATER.includes(status)) continue; // not earned yet, or cancelled/refunded
    const { advance, balance } = splitVendorCost(o.vendorCostPiasters);
    if (!seen.has(`${o.id}:ADVANCE`) && advance > 0) {
      rows.push({
        key: `${o.id}:ADVANCE`,
        payoutId: null,
        orderId: o.id,
        orderNumber: o.number,
        kind: "ADVANCE",
        amountPiasters: advance,
        status: "SCHEDULED",
        trigger: "ACCEPTANCE",
        needsEInvoice: false,
        date: null,
      });
    }
    if (!seen.has(`${o.id}:BALANCE`) && balance > 0) {
      rows.push({
        key: `${o.id}:BALANCE`,
        payoutId: null,
        orderId: o.id,
        orderNumber: o.number,
        kind: "BALANCE",
        amountPiasters: balance,
        // Delivered but no payout row yet: ops still has to raise it (waits on the e-invoice).
        status: status === "DELIVERED" ? "ON_HOLD" : "SCHEDULED",
        trigger: "QC_AND_DELIVERY",
        needsEInvoice: true,
        date: null,
      });
    }
  }

  const rank: Record<ScheduleStatus, number> = { ON_HOLD: 0, PENDING: 1, APPROVED: 2, SCHEDULED: 3, PAID: 4 };
  return rows.sort((a, b) => {
    if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
    return (b.date ?? "").localeCompare(a.date ?? "") || (a.orderNumber ?? "").localeCompare(b.orderNumber ?? "") || a.kind.localeCompare(b.kind);
  });
}

export interface PayoutSummary {
  paidPiasters: number;
  /** Approved by ops, on its way. */
  approvedPiasters: number;
  /** Raised but not yet approved, plus delivered balances waiting on the e-invoice. */
  pendingPiasters: number;
  /** Not raised yet (jobs still in progress). */
  scheduledPiasters: number;
  /** Balances that need the vendor's e-invoice. */
  eInvoiceCount: number;
}

export function payoutSummary(rows: ScheduleRow[]): PayoutSummary {
  const s: PayoutSummary = { paidPiasters: 0, approvedPiasters: 0, pendingPiasters: 0, scheduledPiasters: 0, eInvoiceCount: 0 };
  for (const r of rows) {
    if (r.status === "PAID") s.paidPiasters += r.amountPiasters;
    else if (r.status === "APPROVED") s.approvedPiasters += r.amountPiasters;
    else if (r.status === "PENDING" || r.status === "ON_HOLD") s.pendingPiasters += r.amountPiasters;
    else s.scheduledPiasters += r.amountPiasters;
    if (r.needsEInvoice && r.status !== "SCHEDULED") s.eInvoiceCount += 1;
  }
  return s;
}

export function payoutBadge(status: ScheduleStatus): { tone: "neutral" | "info" | "success" | "attention" | "warning"; progress: "incomplete" | "partiallyComplete" | "complete" } {
  switch (status) {
    case "PAID":
      return { tone: "success", progress: "complete" };
    case "APPROVED":
      return { tone: "info", progress: "partiallyComplete" };
    case "PENDING":
      return { tone: "attention", progress: "incomplete" };
    case "ON_HOLD":
      return { tone: "warning", progress: "incomplete" };
    default:
      return { tone: "neutral", progress: "incomplete" };
  }
}
