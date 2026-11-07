import { VAT_RATE, type Piasters, type QuoteLine } from "@/types";
import { vatOf } from "@/lib/pricing/money";

/**
 * VAT in whole piasters, half up. Delegates to the pricing engine's exact integer rule so a quote
 * and the order/invoice built from it can never differ by a piaster (the old float version relied
 * on a 1e-9 nudge and lost precision on large subtotals).
 */
export function vatOn(subtotal: Piasters, rate = VAT_RATE): Piasters {
  return vatOf(subtotal, rate);
}

export interface OrderTotals {
  lines: QuoteLine[];
  /** Ex-VAT, includes shipping and any discount. */
  subtotalPiasters: Piasters;
  shippingPiasters: Piasters;
  discountPiasters: Piasters;
  vatPiasters: Piasters;
  totalPiasters: Piasters;
}

export const PREPAY_DISCOUNT_LABEL = "checkout.summary.prepayDiscount";

/**
 * Turn an offer's lines into order totals, applying the optional prepayment discount to the
 * goods (everything except shipping). VAT is charged on the discounted subtotal.
 */
export function orderTotals(lines: QuoteLine[], prepayDiscountPct = 0): OrderTotals {
  const base = lines.filter((l) => l.kind !== "DISCOUNT");
  const shipping = base.filter((l) => l.kind === "SHIPPING").reduce((s, l) => s + l.totalPiasters, 0);
  const goods = base.filter((l) => l.kind !== "SHIPPING").reduce((s, l) => s + l.totalPiasters, 0);
  const pct = Math.max(0, Math.min(20, prepayDiscountPct));
  // Half-up on integer basis points (pct may be fractional, e.g. 2.5%).
  let discount = pct > 0 ? Math.floor((goods * Math.round(pct * 100) + 5_000) / 10_000) : 0;
  // R3-12: the buyer reads "500 boxes × 37.97" and checks it with a calculator. With the discount
  // on, the ex-VAT amount is rounded DOWN to a whole piaster per box: the few piasters left over
  // (fewer than the quantity) go into the prepay discount, in the buyer's favour. So per box ×
  // quantity = the boxes line, exactly, on every surface (they all read these totals).
  const qty = base.find((l) => l.kind === "PRODUCT")?.quantity ?? 1;
  if (discount > 0 && Number.isInteger(qty) && qty > 1) discount += (goods + shipping - discount) % qty;
  const out = [...base];
  if (discount > 0) {
    out.push({ kind: "DISCOUNT", labelKey: PREPAY_DISCOUNT_LABEL, quantity: 1, unitPiasters: -discount, totalPiasters: -discount });
  }
  const subtotal = goods + shipping - discount;
  const vat = vatOn(subtotal);
  return { lines: out, subtotalPiasters: subtotal, shippingPiasters: shipping, discountPiasters: discount, vatPiasters: vat, totalPiasters: subtotal + vat };
}

/** Invoice breakdown: goods vs shipping, VAT 14% on the whole ex-VAT amount. */
export function invoiceBreakdown(t: { subtotalPiasters: Piasters; vatPiasters: Piasters; shippingPiasters: Piasters }) {
  return {
    goodsPiasters: t.subtotalPiasters - t.shippingPiasters,
    shippingPiasters: t.shippingPiasters,
    netPiasters: t.subtotalPiasters,
    vatRate: VAT_RATE,
    vatPiasters: t.vatPiasters,
    totalPiasters: t.subtotalPiasters + t.vatPiasters,
  };
}

/** Quotes are valid for 72 hours (QUOTE_VALIDITY_HOURS). */
export function isQuoteValid(validUntil: Date | string, now = new Date()): boolean {
  return new Date(validUntil).getTime() > now.getTime();
}

/** Next sequential number with a prefix: "ELB-26" + 001 → "ELB-26001". */
export function nextSequence(prefix: string, existing: string[], width = 3): string {
  let max = 0;
  for (const n of existing) {
    if (!n.startsWith(prefix)) continue;
    const v = Number(n.slice(prefix.length));
    if (Number.isInteger(v) && v > max) max = v;
  }
  return `${prefix}${String(max + 1).padStart(width, "0")}`;
}
