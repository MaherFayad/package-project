/**
 * Price-request statuses on `Quote.status` (R4-B-03, agreed with the admin session):
 * REQUESTED (buyer asked) -> PRICED (team sent a price) -> ACCEPTED (buyer placed the order).
 * Pure, so client components and the admin can import it.
 */
export const QUOTE_REQUESTED = "REQUESTED";
export const QUOTE_PRICED = "PRICED";
export const QUOTE_ACCEPTED = "ACCEPTED";

/** Checkout link for a priced request: the 2,000-box cap and the quote-only rule do not apply to it. */
export function quoteCheckoutPath(locale: string, quote: { id: string; designId: string | null }): string | null {
  return quote.designId ? `/${locale}/checkout/${encodeURIComponent(quote.designId)}?quote=${encodeURIComponent(quote.id)}` : null;
}
