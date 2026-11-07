import type { Dims, Locale, Piasters, QuoteLine, StructureCode } from "@/types";
import { orderTotals } from "@/lib/orders/totals";

/**
 * ONE buyer-facing price (R1-02). Every surface (home, box pages, pricing page, designer badge
 * and price sheet, checkout quantity cards) shows the same numbers for the same offer:
 *
 *   per box = what checkout charges ex-VAT / quantity: printing, setup, cutting die (only for a
 *             non-standard size), delivery to Greater Cairo, minus the online-payment discount
 *             (every order is paid online before print, so the discount always applies);
 *   total   = what checkout charges, incl. 14% VAT.
 *
 * These are the two numbers checkout computes (`orderTotals(lines, prepayDiscountPct)` in
 * `toCheckoutOffer` / `tierPrices`), so the price the buyer saw is the price they pay.
 * Delivery is the offer's `deliveryDays` (production + transit, calendar days), the same value
 * checkout turns into an arrival date with `arrivalDate`.
 */
export interface BuyerPrice {
  quantity: number;
  /** All-in per box, ex-VAT, after the online-payment discount. */
  unitPiasters: Piasters;
  /** All-in, ex-VAT, after the discount. */
  subtotalPiasters: Piasters;
  vatPiasters: Piasters;
  /** What the buyer pays, incl. VAT. */
  totalPiasters: Piasters;
  /** The online-payment discount already taken off (ex-VAT). */
  discountPiasters: Piasters;
  /** Delivery included in the subtotal (ex-VAT). */
  shippingPiasters: Piasters;
  /** Door-to-door calendar days (production + transit). */
  deliveryDays: number;
}

/** The reference order every public "price for 500" line is computed for (R1-02, R1-15). */
export const PRICE_REFERENCE: { code: StructureCode; dims: Dims; quantity: number } = {
  code: "FEFCO_0427",
  // The designer's default mailer size, a standard die (no cutting-die cost).
  dims: { L: 250, W: 180, H: 80 },
  quantity: 500,
};

export function buyerPrice(offer: { quantity: number; lines: QuoteLine[]; deliveryDays: number }, prepayDiscountPct: number): BuyerPrice {
  const t = orderTotals(offer.lines, prepayDiscountPct);
  return {
    quantity: offer.quantity,
    unitPiasters: Math.round(t.subtotalPiasters / offer.quantity),
    subtotalPiasters: t.subtotalPiasters,
    vatPiasters: t.vatPiasters,
    totalPiasters: t.totalPiasters,
    discountPiasters: t.discountPiasters,
    shippingPiasters: t.shippingPiasters,
    deliveryDays: offer.deliveryDays,
  };
}

/** "Tuesday 17 November": the arrival date for `days` from now, Cairo time (as checkout shows it). */
export function arrivalDate(days: number, locale: Locale, now = Date.now()): string {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Cairo" }).format(
    new Date(now + days * 86_400_000),
  );
}
