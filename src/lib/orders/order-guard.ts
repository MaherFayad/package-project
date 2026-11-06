import { orderModeOf } from "@/data/catalogue/order-mode";
import { MAX_INSTANT_QTY, type QuoteLine } from "@/types";

/**
 * Last line of defence for B-16 / R4-B-01, called where every order is created (checkout, sample,
 * reorder). A model priced by quote (order mode "quote" or "preview") or a quantity above the
 * instant cap only becomes an order through a price the team sent for a price request
 * (`quoteId`, R4-B-03), never through an instant offer, whatever route, share-link copy or
 * tampered request produced that offer. Returns why it is blocked, or null when it may proceed.
 */
export function instantOrderBlock(
  doc: { modelCode?: string | null },
  offer: { lines: readonly Pick<QuoteLine, "kind" | "quantity">[] },
  quoteId?: string | null,
): "MODEL_BY_QUOTE" | "QUANTITY_ABOVE_INSTANT_MAX" | null {
  if (quoteId) return null;
  const mode = orderModeOf(doc.modelCode).mode;
  if (mode === "quote" || mode === "preview") return "MODEL_BY_QUOTE";
  const qty = offer.lines.find((l) => l.kind === "PRODUCT")?.quantity ?? 0;
  if (qty > MAX_INSTANT_QTY) return "QUANTITY_ABOVE_INSTANT_MAX";
  return null;
}
