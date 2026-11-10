import type { FinishCode, PriceTableRow, QuoteLine, QuoteRequest } from "@/types";
import { QTY_TIERS } from "@/types";
import { STRUCTURE_FAMILY, validateDims } from "@/lib/dieline";
import { boardMultiplier, DEFAULT_PRICING_CONFIG, resolvePriceIndex, type PricingConfig, type PriceIndexRow } from "./config";
import { modelByCode } from "@/lib/library";
import { baseOf } from "@/lib/library/doc";
import { orderModeOf, vendorListsModel } from "@/data/catalogue/order-mode";
import { dielineBoardArea, modelBoardArea, type BoardArea, type BoardAreaProvider } from "./area";
import { CITY_ZONE, deliveryEstimate, flatPackBundles } from "./delivery";
import { sumPiasters, toPiasters, vatOf, withMargin } from "./money";
import { nearbyStandardSizes, sameSize, vendorHasDie } from "./standard";
import { interpolateUnit } from "./tiers";
import { bagAreaRatio, bagCostExtras, type BagCostExtras } from "./bags";
import type {
  DeliveryZone,
  IneligibleReason,
  InstantQuote,
  PricingData,
  PricingMaterial,
  PricingRateCard,
  PricingVendor,
  PrintMethod,
  PublicVendorOffer,
  QuoteInput,
  QuoteOutcome,
  StandardSizeSuggestion,
  VendorOffer,
} from "./types";

export interface QuoteOptions {
  config?: PricingConfig;
  now?: Date;
  area?: BoardAreaProvider;
  /** Skip the standard-size suggestion (used internally when pricing the suggestion itself). */
  skipSuggestion?: boolean;
}

export class QuoteInputError extends Error {
  constructor(
    public code: "INVALID_DIMS" | "UNKNOWN_MATERIAL" | "MATERIAL_STRUCTURE_MISMATCH" | "INVALID_QUANTITY" | "INVALID_COLOURS",
    public details?: unknown,
  ) {
    super(code);
    this.name = "QuoteInputError";
  }
}

const LABEL = {
  PRODUCT: "pricing.line.product",
  SETUP: "pricing.line.setup",
  DIE: "pricing.line.die",
  FINISH: "pricing.line.finish",
  SHIPPING: "pricing.line.shipping",
  PRODUCT_BAG: "pricing.line.productBag",
  BAG_HANDLE: "pricing.line.bagHandle",
  BAG_BOARD: "pricing.line.bagBoard",
} as const;

function normaliseFinishes(finishes: FinishCode[]): FinishCode[] {
  return [...new Set(finishes)].filter((f) => f !== "NONE").sort();
}

export function findMaterial(data: PricingData, idOrCode: string): PricingMaterial | undefined {
  return data.materials.find((m) => m.id === idOrCode) ?? data.materials.find((m) => m.code === idOrCode);
}

interface CostBreakdown {
  method: PrintMethod;
  unit: number; // buy, float piasters
  setup: number;
  total: number;
}

/** Vendor BUY cost for offset and (when allowed) digital; the cheaper one wins. */
export function printCost(
  card: PricingRateCard,
  vendor: PricingVendor,
  input: Pick<QuoteInput, "quantity" | "colours" | "printSides">,
  areaRatio: number,
  boardMult: number,
  cfg: PricingConfig,
): { chosen: CostBreakdown; offset: CostBreakdown; digital: CostBreakdown | null } {
  const q = input.quantity;
  const tierUnit = interpolateUnit(card.qtyTiers, q);
  const sized = tierUnit * (cfg.boardShare * areaRatio * boardMult + (1 - cfg.boardShare));
  const sides = input.printSides === "BOTH" ? 1 + card.printSidesSurchargePct / 100 : 1;

  const offsetUnit = sized * (cfg.colourUnitFactor[input.colours] ?? 1) * sides;
  const offsetSetup =
    card.setupPiasters *
    (cfg.colourSetupFactor[input.colours] ?? 1) *
    (input.printSides === "BOTH" ? cfg.bothSidesSetupFactor : 1);
  const offset: CostBreakdown = { method: "OFFSET", unit: offsetUnit, setup: offsetSetup, total: offsetUnit * q + offsetSetup };

  let digital: CostBreakdown | null = null;
  if (vendor.capabilities.digitalShortRun && q <= cfg.digital.maxQty) {
    const unit = sized * cfg.digital.unitPremium * sides; // colour count does not change digital cost
    const setup = card.setupPiasters * cfg.digital.setupShare;
    digital = { method: "DIGITAL", unit, setup, total: unit * q + setup };
  }
  const chosen = digital && digital.total < offset.total ? digital : offset;
  return { chosen, offset, digital };
}

/**
 * Quantity at which offset becomes cheaper than digital for this card (null if digital never
 * wins or the vendor has no digital press). Useful for "digital below N units" hints.
 */
export function digitalOffsetBreakpoint(
  card: PricingRateCard,
  vendor: PricingVendor,
  input: Pick<QuoteInput, "colours" | "printSides">,
  areaRatio: number,
  boardMult: number,
  cfg: PricingConfig = DEFAULT_PRICING_CONFIG,
): number | null {
  if (!vendor.capabilities.digitalShortRun) return null;
  let lastDigital: number | null = null;
  for (let q = 1; q <= cfg.digital.maxQty; q++) {
    const r = printCost(card, vendor, { ...input, quantity: q }, areaRatio, boardMult, cfg);
    if (r.chosen.method === "DIGITAL") lastDigital = q;
  }
  return lastDigital === null ? null : lastDigital + 1;
}

/** A library box model at one of its own standard preset sizes (a die exists): no die cost. */
export function modelHasStandardDie(code: string, dims: QuoteInput["dims"], toleranceMm: number): boolean {
  const m = modelByCode(code);
  if (!m || m.kind !== "box") return false;
  return m.presets.some((p) => p.standard && sameSize(p.dims, dims, toleranceMm));
}

type Eligibility ={ ok: true; card: PricingRateCard } | { ok: false; reason: IneligibleReason };

function eligibility(
  vendor: PricingVendor,
  data: PricingData,
  input: QuoteInput,
  material: PricingMaterial,
  finishes: FinishCode[],
): Eligibility {
  if (vendor.status !== "ACTIVE") return { ok: false, reason: "VENDOR_INACTIVE" };
  const caps = vendor.capabilities;
  if (!caps.structures.includes(input.structureCode)) return { ok: false, reason: "STRUCTURE_UNSUPPORTED" };
  if (!caps.materials.includes(material.code)) return { ok: false, reason: "MATERIAL_UNSUPPORTED" };
  const card = data.rateCards.find(
    (c) =>
      c.active &&
      c.vendorId === vendor.id &&
      c.structureCode === input.structureCode &&
      (c.materialId === material.id || c.materialId === material.code),
  );
  if (!card || card.qtyTiers.length === 0) return { ok: false, reason: "NO_RATE_CARD" };
  for (const f of finishes) {
    if (!caps.finishes.includes(f) || card.finishSurcharges[f] === undefined) return { ok: false, reason: "FINISH_UNSUPPORTED" };
  }
  if (input.colours > caps.maxColors) return { ok: false, reason: "TOO_MANY_COLOURS" };
  if (input.quantity < vendor.minOrderQty) return { ok: false, reason: "BELOW_MIN_QTY" };
  return { ok: true, card };
}

function priceVendor(
  vendor: PricingVendor,
  card: PricingRateCard,
  data: PricingData,
  input: QuoteInput,
  material: PricingMaterial,
  finishes: FinishCode[],
  area: BoardArea,
  index: PriceIndexRow,
  cfg: PricingConfig,
  validUntil: string,
  bag: BagCostExtras | null = null,
): VendorOffer {
  const q = input.quantity;
  const m = cfg.marginPct;
  // Bags are quoted by size band (printers' price lists), boxes by their exact blank area.
  const rawRatio = bag ? bagAreaRatio(area.blankAreaM2, card.referenceAreaM2) : area.blankAreaM2 / card.referenceAreaM2;
  const areaRatio = Math.min(cfg.areaRatioMax, Math.max(cfg.areaRatioMin, rawRatio));
  const boardMult = boardMultiplier(index, material.code);

  const { chosen } = printCost(card, vendor, input, areaRatio, boardMult, cfg);

  // Finishes: unit surcharge scales with board area (lamination/UV are per m²); setup once.
  const finishLines = finishes.map((f) => {
    const buyUnit = (card.finishSurcharges[f] ?? 0) * areaRatio;
    const setup = data.finishes.find((x) => x.code === f)?.setupPiasters ?? 0;
    return { f, buyUnit, setup };
  });

  // R1-03: a library style has its own die, so the base structure's dies do not apply, but the
  // model's own standard presets do. (Was: every library model paid the die, whatever its size.)
  const standardSize = input.model
    ? modelHasStandardDie(input.model.code, input.dims, cfg.standardToleranceMm)
    : vendorHasDie(data, vendor, input.structureCode, input.dims, cfg.standardToleranceMm);
  const needsDie = card.dieCostPiasters > 0;
  const dieBuy = needsDie && !standardSize ? card.dieCostPiasters : 0;

  const lines: QuoteLine[] = [];
  const unitSell = withMargin(chosen.unit, m);
  lines.push({ kind: "PRODUCT", labelKey: bag ? LABEL.PRODUCT_BAG : LABEL.PRODUCT, quantity: q, unitPiasters: unitSell, totalPiasters: unitSell * q });

  const setupBuy = chosen.setup + sumPiasters(finishLines.map((x) => x.setup));
  const setupSell = withMargin(setupBuy, m);
  if (setupSell > 0) lines.push({ kind: "SETUP", labelKey: LABEL.SETUP, quantity: 1, unitPiasters: setupSell, totalPiasters: setupSell });

  if (dieBuy > 0) {
    const dieSell = withMargin(dieBuy, m);
    lines.push({ kind: "DIE", labelKey: LABEL.DIE, quantity: 1, unitPiasters: dieSell, totalPiasters: dieSell });
  }
  for (const fl of finishLines) {
    const u = withMargin(fl.buyUnit, m);
    if (u > 0) lines.push({ kind: "FINISH", labelKey: `finishes.${fl.f}`, quantity: q, unitPiasters: u, totalPiasters: u * q });
  }
  // Bags: the handle (cord, tape, rope, ribbon, die-cut patch) and the board parts, per bag.
  const bagUnits = bag ? [{ key: LABEL.BAG_HANDLE, buy: bag.handleUnit }, { key: LABEL.BAG_BOARD, buy: bag.partsUnit }].filter((x) => x.buy > 0) : [];
  for (const b of bagUnits) {
    const u = withMargin(b.buy, m);
    lines.push({ kind: "FINISH", labelKey: b.key, quantity: q, unitPiasters: u, totalPiasters: u * q });
  }

  const bundle = flatPackBundles(input.structureCode, area, material, q, cfg);
  const shipping = deliveryEstimate(bundle, CITY_ZONE[vendor.city] ?? "GREATER_CAIRO", input.zone, cfg);
  const shippingSell = cfg.marginOnShipping ? withMargin(shipping.pricePiasters, m) : shipping.pricePiasters;
  lines.push({ kind: "SHIPPING", labelKey: LABEL.SHIPPING, quantity: 1, unitPiasters: shippingSell, totalPiasters: shippingSell });

  const subtotal = sumPiasters(lines.map((l) => l.totalPiasters));
  const vat = vatOf(subtotal, cfg.vatRate);

  let lead = card.leadTimeDays;
  if (dieBuy > 0) lead += cfg.customDieExtraDays;
  if (chosen.method === "DIGITAL") lead -= cfg.digital.leadTimeSavingDays;
  lead = Math.max(cfg.minLeadTimeDays, lead);

  const vendorCost = toPiasters(
    chosen.unit * q + setupBuy + dieBuy + sumPiasters(finishLines.map((x) => toPiasters(x.buyUnit * q))) + sumPiasters(bagUnits.map((x) => toPiasters(x.buy * q))),
  );
  const shippingCost = shipping.pricePiasters;

  return {
    vendorId: vendor.id,
    quantity: q,
    lines,
    subtotalPiasters: subtotal,
    vatPiasters: vat,
    totalPiasters: subtotal + vat,
    unitPiasters: toPiasters(subtotal / q),
    leadTimeDays: lead,
    standardSize,
    validUntil,
    vendor: {
      id: vendor.id,
      slug: vendor.slug,
      name: vendor.name,
      city: vendor.city,
      rating: vendor.rating,
      ratingCount: vendor.ratingCount,
      onTimePct: vendor.onTimePct,
      onTimeShown: vendor.onTimeShown,
      verified: vendor.verified,
    },
    printMethod: chosen.method,
    shippingPiasters: shippingSell,
    shipping,
    deliveryDays: lead + shipping.transitDays,
    score: 0,
    badges: [],
    internal: {
      vendorCostPiasters: vendorCost,
      shippingCostPiasters: shippingCost,
      marginPiasters: subtotal - vendorCost - shippingCost,
      marginPct: m,
      areaRatio,
      boardMultiplier: boardMult,
      indexId: index.id,
    },
  };
}

/**
 * Best match = weighted mix of price (lower is better), speed (production + transit days) and
 * quality (rating and on-time %). Mutates `score` and `badges`; returns a new sorted array.
 */
export function rankOffers<O extends PublicVendorOffer>(offers: O[], cfg: PricingConfig = DEFAULT_PRICING_CONFIG): O[] {
  if (offers.length === 0) return [];
  const minPrice = Math.min(...offers.map((o) => o.totalPiasters));
  const minDays = Math.min(...offers.map((o) => o.deliveryDays));
  const w = cfg.ranking;
  for (const o of offers) {
    const price = minPrice / o.totalPiasters;
    const speed = minDays / o.deliveryDays;
    const quality = (o.vendor.rating / 5) * 0.6 + (o.vendor.onTimePct / 100) * 0.4;
    o.score = Math.round((w.price * price + w.speed * speed + w.quality * quality) * 10_000) / 10_000;
    o.badges = [];
  }
  const sorted = [...offers].sort(
    (a, b) => b.score - a.score || a.totalPiasters - b.totalPiasters || a.deliveryDays - b.deliveryDays || a.vendorId.localeCompare(b.vendorId),
  );
  const maxRating = Math.max(...offers.map((o) => o.vendor.rating));
  sorted[0]!.badges.push("BEST_MATCH");
  const cheapest = [...sorted].sort((a, b) => a.totalPiasters - b.totalPiasters)[0]!;
  cheapest.badges.push("CHEAPEST");
  const fastest = [...sorted].sort((a, b) => a.deliveryDays - b.deliveryDays || a.totalPiasters - b.totalPiasters)[0]!;
  fastest.badges.push("FASTEST");
  sorted.find((o) => o.vendor.rating === maxRating)!.badges.push("TOP_RATED");
  return sorted;
}

function validateInput(input: QuoteInput, data: PricingData, cfg: PricingConfig): PricingMaterial {
  if (!Number.isInteger(input.quantity) || input.quantity < 1) throw new QuoteInputError("INVALID_QUANTITY");
  if (!Number.isInteger(input.colours) || input.colours < 1 || input.colours > cfg.maxColours) {
    throw new QuoteInputError("INVALID_COLOURS");
  }
  // Library models are validated by their own generator (modelBoardArea), not the base limits.
  const v = input.model ? ({ ok: true } as const) : validateDims(input.structureCode, input.dims);
  if (!v.ok) throw new QuoteInputError("INVALID_DIMS", v.issues);
  const material = findMaterial(data, input.materialId);
  if (!material) throw new QuoteInputError("UNKNOWN_MATERIAL");
  if (material.family !== STRUCTURE_FAMILY[input.structureCode]) throw new QuoteInputError("MATERIAL_STRUCTURE_MISMATCH");
  if (input.model) {
    // The model must exist and be made as this base structure from this board (no cheaper base).
    const m = modelByCode(input.model.code);
    if (!m) throw new QuoteInputError("INVALID_DIMS", [{ path: "model", code: "UNKNOWN_MODEL" }]);
    if (m.kind === "box" && !m.materials.includes(material.code)) throw new QuoteInputError("MATERIAL_STRUCTURE_MISMATCH");
    if (baseOf(m, material.code) !== input.structureCode) throw new QuoteInputError("MATERIAL_STRUCTURE_MISMATCH");
  }
  return material;
}

/**
 * Price a box for every eligible vendor (or just `input.vendorId`).
 * Above `maxInstantQty` (2,000) returns `{ mode: "manual_quote" }`.
 * Throws `QuoteInputError` for invalid input.
 */
export function quote(input: QuoteInput, data: PricingData, opts: QuoteOptions = {}): QuoteOutcome {
  const cfg = opts.config ?? DEFAULT_PRICING_CONFIG;
  const now = opts.now ?? new Date();
  const material = validateInput(input, data, cfg);

  if (input.quantity > cfg.maxInstantQty) {
    return { mode: "manual_quote", reason: "QUANTITY_ABOVE_INSTANT_MAX", quantity: input.quantity, maxInstantQty: cfg.maxInstantQty };
  }
  // B-16: models no Egyptian SME printer makes (or only some do) never get an instant price
  // through their base structure's rate card.
  const order = input.model ? orderModeOf(input.model.code) : null;
  if (order && (order.mode === "quote" || order.mode === "preview")) {
    return { mode: "manual_quote", reason: "MODEL_BY_QUOTE", orderReason: order.reason as "QUOTE_ONLY_STOCK" | "RARE_IN_EGYPT" | "FILLING_LINE", quantity: input.quantity, maxInstantQty: cfg.maxInstantQty };
  }

  let area: BoardArea;
  if (input.model && !opts.area) {
    const a = modelBoardArea(input, material.code);
    if (!a) throw new QuoteInputError("INVALID_DIMS", [{ path: "model", code: "INVALID" }]);
    area = a;
  } else area = (opts.area ?? dielineBoardArea)(input.structureCode, input.dims, material.code, material.thicknessMm);
  const index = resolvePriceIndex(cfg.priceIndex, now);
  const validUntil = new Date(now.getTime() + cfg.quoteValidityHours * 3_600_000).toISOString();
  const finishes = normaliseFinishes(input.finishes);
  const bag = input.structureCode === "PAPER_BAG" ? bagCostExtras({ modelCode: input.model?.code, features: input.model?.features, material: material.code, paperAreaM2: area.blankAreaM2 }) : null;

  const offers: VendorOffer[] = [];
  const ineligible: InstantQuote["ineligible"] = [];
  const vendors = input.vendorId ? data.vendors.filter((v) => v.id === input.vendorId) : data.vendors;
  for (const vendor of vendors) {
    const e = eligibility(vendor, data, input, material, finishes);
    if (!e.ok) {
      ineligible.push({ vendorId: vendor.id, reason: e.reason });
      continue;
    }
    if (bag && input.quantity < Math.max(bag.moq, vendor.minOrderQty)) {
      ineligible.push({ vendorId: vendor.id, reason: "BELOW_MIN_QTY" });
      continue;
    }
    if (order && input.model && !vendorListsModel(order.mode, input.model.code, vendor.capabilities.models)) {
      ineligible.push({ vendorId: vendor.id, reason: "MODEL_NOT_LISTED" });
      continue;
    }
    offers.push(priceVendor(vendor, e.card, data, input, material, finishes, area, index, cfg, validUntil, bag));
  }
  const ranked = rankOffers(offers, cfg);
  if (order?.mode === "listed" && ranked.length === 0) {
    return { mode: "manual_quote", reason: "MODEL_BY_QUOTE", orderReason: "SPECIAL_GLUING", quantity: input.quantity, maxInstantQty: cfg.maxInstantQty };
  }

  let suggestion: StandardSizeSuggestion | null = null;
  if (!opts.skipSuggestion && !input.model && ranked.length > 0) {
    suggestion = standardSizeSuggestion(input, data, ranked, { ...opts, config: cfg, now });
  }

  return {
    mode: "instant",
    quantity: input.quantity,
    areaM2: Math.round(area.blankAreaM2 * 10_000) / 10_000,
    areaSource: area.source,
    offers: ranked,
    ineligible,
    suggestion,
    validUntil,
    indexId: index.id,
  };
}

/**
 * "A standard size nearby is cheaper": among standard sizes the product still fits in (and not
 * much bigger), the one whose best price beats the cheapest current offer by the most.
 * Savings are measured against the cheapest current offer (any vendor); days saved against the
 * same vendor's current offer.
 */
function standardSizeSuggestion(
  input: QuoteInput,
  data: PricingData,
  current: VendorOffer[],
  opts: QuoteOptions & { config: PricingConfig },
): StandardSizeSuggestion | null {
  const cfg = opts.config;
  if (current.some((o) => o.standardSize)) return null;
  const cheapest = current.reduce((a, b) => (b.totalPiasters < a.totalPiasters ? b : a));
  let best: StandardSizeSuggestion | null = null;
  for (const preset of nearbyStandardSizes(data, input.structureCode, input.dims, cfg.suggestionMaxVolumeIncrease, cfg.standardToleranceMm)) {
    if (!validateDims(input.structureCode, preset.dims).ok) continue;
    const r = quote({ ...input, dims: preset.dims }, data, { ...opts, skipSuggestion: true });
    if (r.mode !== "instant" || r.offers.length === 0) continue;
    const alt = r.offers.reduce((a, b) => (b.totalPiasters < a.totalPiasters ? b : a));
    const savings = cheapest.totalPiasters - alt.totalPiasters;
    if (savings <= 0 || (best && savings <= best.savingsPiasters)) continue;
    best = {
      presetId: preset.id,
      name: preset.name,
      dims: preset.dims,
      vendorId: alt.vendorId,
      totalPiasters: alt.totalPiasters,
      unitPiasters: alt.unitPiasters,
      savingsPiasters: savings,
      savingsPct: Math.round((savings / cheapest.totalPiasters) * 100),
      // Days saved at the same vendor (its custom-size offer vs its standard-size offer).
      leadTimeDaysSaved: Math.max(0, (current.find((o) => o.vendorId === alt.vendorId) ?? cheapest).leadTimeDays - alt.leadTimeDays),
    };
  }
  return best;
}

/** Strip internal economics (vendor buy price, margin) before sending offers to a buyer. */
export function toPublicOffer(offer: VendorOffer): PublicVendorOffer {
  const { internal: _internal, ...pub } = offer;
  void _internal;
  return pub;
}

export function toPublicOutcome(outcome: QuoteOutcome): QuoteOutcome<PublicVendorOffer> {
  if (outcome.mode !== "instant") return outcome;
  return { ...outcome, offers: outcome.offers.map(toPublicOffer) };
}

/** Best-match offer for each instant quantity tier (for the live price badge / table). */
export function priceTable(
  input: Omit<QuoteInput, "quantity">,
  data: PricingData,
  opts: QuoteOptions = {},
): PriceTableRow[] {
  return QTY_TIERS.map((quantity) => {
    const r = quote({ ...input, quantity }, data, { ...opts, skipSuggestion: true });
    return { quantity, best: r.mode === "instant" ? (r.offers[0] ?? null) : null };
  });
}

/** Adapter from the shared `QuoteRequest` contract (src/types/pricing.ts). */
export function fromQuoteRequest(req: QuoteRequest, zone: DeliveryZone = "GREATER_CAIRO", colours = 4): QuoteInput {
  return {
    structureCode: req.structureCode,
    dims: req.dims,
    materialId: req.materialCode,
    finishes: [req.finishCode],
    printSides: req.printSides,
    colours,
    quantity: req.quantity,
    vendorId: req.vendorId,
    zone,
  };
}
