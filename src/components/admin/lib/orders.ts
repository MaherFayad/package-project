import { z } from "zod";
import { VAT_RATE, type OrderStatus } from "@/types";
import { REPRINT_NOTE_PREFIX } from "./metrics";

/**
 * Admin order rules (pure). The server actions re-check every rule before writing, and all
 * status changes still go through the shared state machine (src/lib/orders/state.ts).
 */

export const ORDER_VIEWS = ["all", "attention", "qc", "production", "shipping", "closed"] as const;
export type OrderView = (typeof ORDER_VIEWS)[number];

const VIEW_STATUSES: Record<Exclude<OrderView, "all">, OrderStatus[]> = {
  attention: ["PENDING_PAYMENT", "PAID", "PROOF_APPROVED"],
  qc: ["QC_PENDING"],
  production: ["ACCEPTED", "IN_PRODUCTION"],
  shipping: ["READY_TO_SHIP", "SHIPPED"],
  closed: ["DELIVERED", "CANCELLED", "REFUNDED"],
};

export function inView(status: string, view: OrderView): boolean {
  if (view === "all") return true;
  return (VIEW_STATUSES[view] as string[]).includes(status);
}

export function asOrderView(v: string | null | undefined): OrderView {
  return (ORDER_VIEWS as readonly string[]).includes(v ?? "") ? (v as OrderView) : "all";
}

export interface AdminOrderRow {
  id: string;
  number: string;
  status: string;
  placedAt: string;
  buyerName: string;
  buyerPhone: string;
  vendorId: string;
  vendorName: string;
  quantity: number;
  structureCode: string;
  totalPiasters: number;
  marginPiasters: number;
  paymentStatus: string | null;
  openDispute: boolean;
  reprint: boolean;
}

export const ORDER_SORTS = ["newest", "oldest", "totalDesc", "totalAsc"] as const;
export type OrderSort = (typeof ORDER_SORTS)[number];

export function filterOrders(rows: AdminOrderRow[], opts: { view: OrderView; query: string; vendorId?: string | null; sort: OrderSort }): AdminOrderRow[] {
  const q = opts.query.trim().toLowerCase();
  const out = rows.filter(
    (r) =>
      inView(r.status, opts.view) &&
      (!opts.vendorId || r.vendorId === opts.vendorId) &&
      (!q || r.number.toLowerCase().includes(q) || r.buyerName.toLowerCase().includes(q) || r.buyerPhone.includes(q) || r.vendorName.toLowerCase().includes(q)),
  );
  const by: Record<OrderSort, (a: AdminOrderRow, b: AdminOrderRow) => number> = {
    newest: (a, b) => b.placedAt.localeCompare(a.placedAt),
    oldest: (a, b) => a.placedAt.localeCompare(b.placedAt),
    totalDesc: (a, b) => b.totalPiasters - a.totalPiasters,
    totalAsc: (a, b) => a.totalPiasters - b.totalPiasters,
  };
  return [...out].sort(by[opts.sort]);
}

export function countByOrderView(rows: { status: string }[]): Record<OrderView, number> {
  const out = Object.fromEntries(ORDER_VIEWS.map((v) => [v, 0])) as Record<OrderView, number>;
  for (const r of rows) for (const v of ORDER_VIEWS) if (inView(r.status, v)) out[v]++;
  return out;
}

/* ───────────────────────── Routing ───────────────────────── */

/** Statuses where the job can still move to another vendor (nothing printed yet). */
export const REASSIGNABLE: OrderStatus[] = ["PENDING_PAYMENT", "PAID", "PROOF_APPROVED", "ACCEPTED"];

export function canReassign(status: string): boolean {
  return (REASSIGNABLE as string[]).includes(status);
}

/**
 * After reassignment the new vendor must accept the job again, so an ACCEPTED order goes back to
 * PAID. Other statuses stay where they are.
 */
export function statusAfterReassign(status: OrderStatus): OrderStatus {
  return status === "ACCEPTED" ? "PAID" : status;
}

export const reassignSchema = z.object({
  orderId: z.string().min(1).max(40),
  vendorId: z.string().min(1).max(40),
  /** Keep or change the vendor buy price (piasters); null = keep. */
  vendorCostPiasters: z.number().int().min(0).max(1_000_000_000).nullable(),
  reason: z.string().trim().min(3).max(500),
});

/* ───────────────────────── Quote override ───────────────────────── */

/**
 * Price override. Before payment ops can change the buyer price (goods ex-VAT); VAT and the total
 * are recomputed. Any time before delivery ops can change the vendor buy price.
 */
export const overrideSchema = z.object({
  orderId: z.string().min(1).max(40),
  goodsPiasters: z.number().int().min(0).max(1_000_000_000).nullable(),
  vendorCostPiasters: z.number().int().min(0).max(1_000_000_000).nullable(),
  reason: z.string().trim().min(3).max(500),
});

export function canOverridePrice(status: string): boolean {
  return status === "PENDING_PAYMENT";
}

export function canOverrideCost(status: string): boolean {
  return !["DELIVERED", "CANCELLED", "REFUNDED"].includes(status);
}

export interface OrderMoney {
  subtotalPiasters: number;
  vatPiasters: number;
  shippingPiasters: number;
  totalPiasters: number;
}

/** VAT 14% of a net amount, rounded half up to the piaster (same rule as the pricing engine). */
export function vatOn(netPiasters: number): number {
  return Math.round(netPiasters * VAT_RATE);
}

/**
 * New money fields when the goods price changes. Keeps the row's convention: if the subtotal
 * included delivery before, it still does.
 */
export function applyGoodsOverride(order: OrderMoney, goodsPiasters: number): OrderMoney {
  const shippingIncluded = order.totalPiasters === order.subtotalPiasters + order.vatPiasters;
  const net = goodsPiasters + order.shippingPiasters;
  const vat = vatOn(net);
  return {
    subtotalPiasters: shippingIncluded ? net : goodsPiasters,
    vatPiasters: vat,
    shippingPiasters: order.shippingPiasters,
    totalPiasters: net + vat,
  };
}

/* ───────────────────────── Refunds ───────────────────────── */

/** Order statuses an admin can refund from (money was taken, the edge exists in the graph). */
export const REFUNDABLE: OrderStatus[] = ["PAID", "PROOF_APPROVED", "ACCEPTED", "IN_PRODUCTION", "QC_PENDING", "READY_TO_SHIP", "DELIVERED"];

export function canRefund(status: string, payments: { status: string }[]): boolean {
  return (REFUNDABLE as string[]).includes(status) && payments.some((p) => p.status === "PAID");
}

export const refundSchema = z.object({
  orderId: z.string().min(1).max(40),
  reason: z.string().trim().min(3).max(500),
  disputeId: z.string().min(1).max(40).optional(),
});

/* ───────────────────────── QC ───────────────────────── */

export const qcSchema = z.object({
  orderId: z.string().min(1).max(40),
  decision: z.enum(["APPROVE", "REJECT"]),
  note: z.string().trim().max(500).optional(),
});

export function canReviewQc(status: string, photos: { status: string }[]): boolean {
  return status === "QC_PENDING" && photos.length > 0;
}

/* ───────────────────────── Notes ───────────────────────── */

export const noteSchema = z.object({
  orderId: z.string().min(1).max(40),
  note: z.string().trim().min(1).max(1000),
});

/** Internal admin notes are stored as NOTE production events with this prefix (hidden from buyers). */
export const ADMIN_NOTE_PREFIX = "ADMIN:";

/* ───────────────────────── Reprints ───────────────────────── */

/** ELB-26001 → ELB-26001-R1, then -R2 … */
export function reprintNumber(original: string, existing: string[]): string {
  const base = original.replace(/-R\d+$/, "");
  let max = 0;
  for (const n of existing) {
    const m = new RegExp(`^${base.replace(/[-]/g, "\\-")}-R(\\d+)$`).exec(n);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${base}-R${max + 1}`;
}

export function reprintNote(originalNumber: string, disputeId: string): string {
  return `${REPRINT_NOTE_PREFIX}${originalNumber}:${disputeId}`;
}

export function reprintSource(notes: string | null): string | null {
  if (!notes?.startsWith(REPRINT_NOTE_PREFIX)) return null;
  return notes.slice(REPRINT_NOTE_PREFIX.length).split(":")[0] ?? null;
}
