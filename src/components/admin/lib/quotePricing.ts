import { z } from "zod";
import type { QuoteLine } from "@/types";
import { orderTotals } from "@/lib/orders/totals";
import { marginPreview } from "./orders";

/**
 * "Send price" on a quote lead (R4-B-03, admin half). Ops prices the lead's own Quote row with
 * ex-VAT lines in the pricing engine's line kinds, so checkout, the receipt and the order read it
 * like any engine quote: PRODUCT (unit × quantity), SETUP, optional DIE and FINISH, SHIPPING.
 * VAT is 14% on the whole ex-VAT subtotal (Egyptian VAT Law 67/2016, same rule as checkout).
 * There is no prepay discount on a sent price (agreed with checkout).
 *
 * `vendorCostPiasters` is the printer's agreed ex-VAT buy price for the whole job, excluding
 * delivery (the same base as order margins and payouts). It is required: checkout refuses a priced
 * quote without it, and the 40/60 payouts are sized on it.
 */
const piasters = (max: number) => z.number().int().min(0).max(max);

export const sendPriceSchema = z.object({
  quoteId: z.string().min(1).max(40),
  vendorId: z.string().min(1).max(40),
  quantity: z.number().int().min(1).max(1_000_000),
  /** Per box, ex-VAT, in piasters (EGP 18.00 = 1800). */
  unitPiasters: z.number().int().min(1).max(10_000_000),
  setupPiasters: piasters(100_000_000),
  diePiasters: piasters(100_000_000),
  finishPiasters: piasters(100_000_000),
  shippingPiasters: piasters(100_000_000),
  deliveryDays: z.number().int().min(1).max(120),
  vendorCostPiasters: z.number().int().min(1).max(10_000_000_000),
  note: z.string().trim().max(500).optional(),
});
export type SendPriceInput = z.infer<typeof sendPriceSchema>;

export interface PricedLines {
  lines: QuoteLine[];
  /** Product + setup + die + finish, ex-VAT (the margin base). */
  goodsPiasters: number;
  shippingPiasters: number;
  /** Ex-VAT, includes shipping. */
  subtotalPiasters: number;
  vatPiasters: number;
  totalPiasters: number;
}

/** Build the quote lines and totals from the form values (zero optional lines are left out). */
export function priceLines(p: Pick<SendPriceInput, "quantity" | "unitPiasters" | "setupPiasters" | "diePiasters" | "finishPiasters" | "shippingPiasters">): PricedLines {
  const lines: QuoteLine[] = [{ kind: "PRODUCT", labelKey: "pricing.line.product", quantity: p.quantity, unitPiasters: p.unitPiasters, totalPiasters: p.unitPiasters * p.quantity }];
  const extra = [
    ["SETUP", "pricing.line.setup", p.setupPiasters],
    ["DIE", "pricing.line.die", p.diePiasters],
    ["FINISH", "pricing.line.finish", p.finishPiasters],
    ["SHIPPING", "pricing.line.shipping", p.shippingPiasters],
  ] as const;
  for (const [kind, labelKey, amount] of extra) if (amount > 0) lines.push({ kind, labelKey, quantity: 1, unitPiasters: amount, totalPiasters: amount });
  const t = orderTotals(lines, 0);
  return { lines: t.lines, goodsPiasters: t.subtotalPiasters - t.shippingPiasters, shippingPiasters: t.shippingPiasters, subtotalPiasters: t.subtotalPiasters, vatPiasters: t.vatPiasters, totalPiasters: t.totalPiasters };
}

/** Margin of a sent price on goods ex-VAT ex-delivery (research report §6.2 target 20 to 30%). */
export function pricedMargin(p: PricedLines, vendorCostPiasters: number) {
  return marginPreview(p.goodsPiasters, vendorCostPiasters);
}

/** Hours until a sent price expires (negative = expired). */
export function hoursToExpiry(validUntil: Date, now: Date): number {
  return Math.round(((validUntil.getTime() - now.getTime()) / 3_600_000) * 10) / 10;
}

/** A sent price within this many hours of expiry is flagged for a follow-up call. */
export const PRICED_FOLLOW_UP_HOURS = 24;
