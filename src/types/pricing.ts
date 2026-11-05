import type { Piasters } from "./common";
import type { Dims, StructureCode } from "./structure";
import type { FinishCode, MaterialCode, PrintSides } from "./material";

/** Quantity tiers offered for instant pricing. Above the last tier: "Request a quote". */
export const QTY_TIERS = [100, 250, 500, 1000, 2000] as const;
export type QtyTier = (typeof QTY_TIERS)[number];
export const MAX_INSTANT_QTY = 2000;

/** Stored in RateCard.qtyTiers (Json). Vendor BUY price per unit, ex-VAT, for RateCard.referenceAreaM2. */
export interface RateTier {
  minQty: number;
  unitPiasters: Piasters;
}

/** Input to the pricing engine (src/lib/pricing). */
export interface QuoteRequest {
  structureCode: StructureCode;
  dims: Dims;
  materialCode: MaterialCode;
  finishCode: FinishCode;
  printSides: PrintSides;
  quantity: number;
  /** Omit for "best match" (cheapest that meets lead time). */
  vendorId?: string;
}

/** One priced line. Stored in Quote.lines (Json array). */
export interface QuoteLine {
  kind: "PRODUCT" | "SETUP" | "DIE" | "FINISH" | "SHIPPING" | "DISCOUNT";
  /** Dictionary key for the label, e.g. "pricing.line.product". */
  labelKey: string;
  quantity: number;
  unitPiasters: Piasters;
  totalPiasters: Piasters; // ex-VAT
}

/** Pricing engine output for one vendor + quantity. */
export interface QuoteResult {
  vendorId: string;
  quantity: number;
  lines: QuoteLine[];
  subtotalPiasters: Piasters; // ex-VAT, sell price (includes platform margin)
  vatPiasters: Piasters; // 14% of subtotal, rounded half-up to the piaster
  totalPiasters: Piasters;
  unitPiasters: Piasters; // total ex-VAT / quantity, for the "from X per box" badge
  leadTimeDays: number;
  standardSize: boolean;
  validUntil: string; // ISO date, now + 72h
}

/** Price table across all QTY_TIERS for the live price badge. */
export interface PriceTableRow {
  quantity: QtyTier;
  best: QuoteResult | null; // null if no vendor can make it
}
