/**
 * Pricing engine (owner: pricing). Pure, DB-free and server-safe: everything here can run in a
 * route handler, a server component or a unit test. DB loading lives in "@/lib/pricing/server".
 *
 *   const r = quote(input, data);           // { mode: "instant", offers, suggestion } | { mode: "manual_quote" }
 *   const pub = toPublicOutcome(r);         // strips vendor buy price + margin before sending to buyers
 *   priceTable(inputWithoutQty, data);      // best offer per QTY_TIERS row
 *
 * Money is integer piasters everywhere. Prices are ex-VAT on lines; VAT 14% is a separate amount.
 */
export * from "./types";
export { designQuoteFields } from "./design";
export { HEADLINE_DEFAULTS, checkoutVendor, headlineInput, headlineOffer } from "./headline";
export { PRICE_REFERENCE, buyerPrice, arrivalDate, type BuyerPrice } from "./buyer";
export {
  DEFAULT_PRICING_CONFIG,
  PRICE_INDEX_TABLE,
  makeConfig,
  resolvePriceIndex,
  boardMultiplier,
  type PricingConfig,
  type PriceIndexRow,
  type ZoneRate,
  type FlatPackSpec,
} from "./config";
export { toPiasters, vatOf, withMargin, sumPiasters, formatPrice } from "./money";
export { interpolateUnit } from "./tiers";
export { dielineBoardArea, estimateBoardArea, modelBoardArea, type BoardArea, type BoardAreaProvider } from "./area";
export { CITY_ZONE, zoneForGovernorate, isDeliveryZone, flatPackBundles, deliveryEstimate, type FlatPackBundle } from "./delivery";
export { sameSize, standardPresets, vendorHasDie, nearbyStandardSizes } from "./standard";
export {
  quote,
  priceTable,
  rankOffers,
  printCost,
  digitalOffsetBreakpoint,
  findMaterial,
  toPublicOffer,
  toPublicOutcome,
  fromQuoteRequest,
  QuoteInputError,
  modelHasStandardDie,
  type QuoteOptions,
} from "./engine";
