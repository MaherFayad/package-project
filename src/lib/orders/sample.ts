import type { QuoteLine } from "@/types";
import type { VendorOffer } from "@/lib/pricing";
import { vatOn, type OrderTotals } from "./totals";

/**
 * Paid physical sample (B-05, plan §1.3 bridge 4 / §6.1 "Samples"). A sample is an ordinary
 * prepaid order with one SAMPLE product line (1 to 5 digitally printed boxes at a fixed price
 * from the checkout settings) plus delivery. Its ex-VAT goods price is credited, once, against
 * the buyer's next order of the same design placed within `creditDays` of paying for the sample.
 *
 * Markers live in the order timeline (no schema change):
 *   NOTE "SAMPLE_ORDER"            on the sample order (also used for the monthly cap)
 *   NOTE "SAMPLE_CREDITED:<number>" on the sample order once its credit is used by order <number>
 *   NOTE "SAMPLE_CREDIT:<number>"   on the order that used the credit of sample <number>
 */
export const SAMPLE_LINE_LABEL = "buyer.sample.line";
export const SAMPLE_CREDIT_LABEL = "buyer.sample.credit";
export const SAMPLE_ORDER_NOTE = "SAMPLE_ORDER";
/** Sample boxes are printed digitally: production days, before transit. */
export const SAMPLE_PRODUCTION_DAYS = 3;
/** Share of the sample price paid to the printer (cost tracking for the admin). */
export const SAMPLE_VENDOR_SHARE = 0.6;

export function isSampleLines(lines: QuoteLine[] | null | undefined): boolean {
  return !!lines?.some((l) => l.labelKey === SAMPLE_LINE_LABEL);
}

/**
 * Turn a printer's regular offer into a sample offer from the same printer: the fixed sample
 * price for `pieces` boxes plus that offer's delivery line. No die, setup or prepay discount.
 */
export function sampleOffer(offer: VendorOffer, pieces: number, pricePiasters: number): VendorOffer {
  const shipping = offer.lines.filter((l) => l.kind === "SHIPPING");
  const product: QuoteLine = {
    kind: "PRODUCT",
    labelKey: SAMPLE_LINE_LABEL,
    quantity: pieces,
    unitPiasters: Math.round(pricePiasters / pieces),
    totalPiasters: pricePiasters,
  };
  const lines = [product, ...shipping];
  const subtotal = lines.reduce((s, l) => s + l.totalPiasters, 0);
  const vat = vatOn(subtotal);
  const transit = Math.max(0, offer.deliveryDays - offer.leadTimeDays);
  return {
    ...offer,
    quantity: pieces,
    lines,
    subtotalPiasters: subtotal,
    vatPiasters: vat,
    totalPiasters: subtotal + vat,
    unitPiasters: Math.round(pricePiasters / pieces),
    leadTimeDays: SAMPLE_PRODUCTION_DAYS,
    deliveryDays: SAMPLE_PRODUCTION_DAYS + transit,
    standardSize: offer.standardSize,
    badges: [],
    internal: { ...offer.internal, vendorCostPiasters: Math.round(pricePiasters * SAMPLE_VENDOR_SHARE), marginPiasters: Math.round(pricePiasters * (1 - SAMPLE_VENDOR_SHARE)) },
  };
}

/**
 * Apply a sample credit to order totals: a DISCOUNT line, capped at the goods (never the
 * delivery), with VAT recomputed on the lower base (credit notes reduce the taxable amount).
 */
export function applySampleCredit(t: OrderTotals, creditPiasters: number): OrderTotals {
  const goods = t.lines.filter((l) => l.kind !== "SHIPPING").reduce((s, l) => s + l.totalPiasters, 0);
  const credit = Math.max(0, Math.min(creditPiasters, goods));
  if (credit === 0) return t;
  const lines: QuoteLine[] = [...t.lines, { kind: "DISCOUNT", labelKey: SAMPLE_CREDIT_LABEL, quantity: 1, unitPiasters: -credit, totalPiasters: -credit }];
  const subtotal = t.subtotalPiasters - credit;
  const vat = vatOn(subtotal);
  return { lines, subtotalPiasters: subtotal, shippingPiasters: t.shippingPiasters, discountPiasters: t.discountPiasters + credit, vatPiasters: vat, totalPiasters: subtotal + vat };
}
