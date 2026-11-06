import type { Dims, FinishCode, StructureCode } from "@/types";
import type { DeliveryZone, QuoteInput } from "./types";

/**
 * ONE price source for the buyer journey (B-26).
 *
 * The public structure page, the designer price badge and the checkout default must show the
 * SAME price and lead time for the same box, quantity and board. They used to disagree three
 * ways (EGP 34.20 / 37.95 / 40.06 for a 500-box mailer) because each picked its own inputs
 * (1 vs 4 colours) and its own offer (cheapest vs best match).
 *
 * The rule, used by every surface:
 *   1. Inputs: HEADLINE_DEFAULTS for anything the buyer has not chosen yet (full colour CMYK,
 *      outside print, no finish, Greater Cairo delivery). These are the same defaults as
 *      POST /api/quote and the order service.
 *   2. Offer: the BEST_MATCH offer (`quote()` returns offers ranked, best match first). This is
 *      the vendor checkout pre-selects, so the number the buyer saw is the number they pay.
 *
 * Pure and DB-free, so it is safe on the server and in client components.
 */
export const HEADLINE_DEFAULTS = {
  printSides: "OUTSIDE",
  colours: 4,
  finishes: [] as FinishCode[],
  zone: "GREATER_CAIRO",
} as const satisfies { printSides: QuoteInput["printSides"]; colours: number; finishes: FinishCode[]; zone: DeliveryZone };

/** Quote input for a box nobody has configured yet (public pages), minus the quantity. */
export function headlineInput(structureCode: StructureCode, dims: Dims, materialId: string): Omit<QuoteInput, "quantity"> {
  return {
    structureCode,
    dims,
    materialId,
    finishes: [...HEADLINE_DEFAULTS.finishes],
    printSides: HEADLINE_DEFAULTS.printSides,
    colours: HEADLINE_DEFAULTS.colours,
    zone: HEADLINE_DEFAULTS.zone,
  };
}

/**
 * The offer every surface shows as "the price": the best match (first of the ranked offers),
 * NOT the cheapest. Accepts any offer shape (internal, public or a client DTO) as long as the
 * array is in `quote()` / `/api/quote` order. Returns null when there is no instant offer.
 */
export function headlineOffer<O>(offers: readonly O[] | null | undefined): O | null {
  return offers && offers.length ? offers[0]! : null;
}
