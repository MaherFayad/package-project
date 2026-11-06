import type {
  Dims,
  DimsPreset,
  EgyptCity,
  FinishCode,
  MaterialCode,
  Piasters,
  PrintSides,
  QuoteResult,
  RateTier,
  StructureCode,
  StructureFamily,
  StructureFeatures,
  DesignVessel,
  VendorCapabilities,
} from "@/types";

/** Delivery zones (Bosta-style courier zones). */
export const DELIVERY_ZONES = ["GREATER_CAIRO", "ALEXANDRIA", "DELTA", "CANAL", "UPPER_EGYPT"] as const;
export type DeliveryZone = (typeof DELIVERY_ZONES)[number];

export type PrintMethod = "DIGITAL" | "OFFSET";

/** Input to `quote()`. All sizes are inner dims in mm. */
export interface QuoteInput {
  structureCode: StructureCode;
  dims: Dims;
  /** Material row id OR material code (both are accepted). */
  materialId: string;
  /** Finishes to apply. "NONE" entries are ignored; duplicates are collapsed. */
  finishes: FinishCode[];
  printSides: PrintSides;
  /** Number of print colours (1 to 6: CMYK + up to 2 spot colours). */
  colours: number;
  quantity: number;
  /** Restrict to one vendor (the buyer picked a vendor). */
  vendorId?: string;
  /** Buyer's delivery zone. */
  zone: DeliveryZone;
  /**
   * Added by 3D integration: the library model actually made (family box style or container).
   * `structureCode` is then its BASE structure (rate card, vendors); the board area comes from
   * the model's own dieline / print areas and `dims` are the model's dims.
   */
  model?: QuoteModel;
}

/** A library model (src/lib/library) to price through its base structure's rate cards. */
export interface QuoteModel {
  code: string;
  features?: StructureFeatures;
  /** Containers: size, surfaces etc. (DesignDoc.vessel). */
  vessel?: DesignVessel;
}

// ───────────────────────── Data the engine prices from (DB-free) ─────────────────────────

export interface PricingMaterial {
  id: string;
  code: MaterialCode;
  family: StructureFamily;
  gsm: number;
  thicknessMm: number;
}

export interface PricingFinish {
  code: FinishCode;
  /** Platform default per-order setup for this finish (Finish.setupPiasters). */
  setupPiasters: Piasters;
  /** Platform default per-unit surcharge (Finish.unitSurchargePiasters), used if the card has none. */
  unitSurchargePiasters?: Piasters;
}

/** A size for which a vendor already owns a cutting die. */
export interface OwnedDie {
  structureCode: StructureCode;
  dims: Dims;
}

export interface PricingVendor {
  id: string;
  slug: string;
  name: { ar: string; en: string };
  city: EgyptCity;
  rating: number; // 0..5
  ratingCount: number;
  onTimePct: number; // 0..100
  /** R5-JR-05 (admin round 8): false = fewer judged deliveries than the minimum; show "New on Elba". */
  onTimeShown?: boolean;
  leadTimeDays: number;
  minOrderQty: number;
  capabilities: VendorCapabilities;
  verified: boolean;
  status: "PENDING" | "ACTIVE" | "SUSPENDED";
  /**
   * Extra dies this vendor owns beyond the catalog standard presets.
   * Catalog presets with `standard: true` are assumed owned by every vendor of that structure.
   */
  ownedDies?: OwnedDie[];
}

export interface PricingRateCard {
  vendorId: string;
  structureCode: StructureCode;
  materialId: string;
  /** Vendor BUY price per unit, ex-VAT, at `referenceAreaM2`. */
  qtyTiers: RateTier[];
  referenceAreaM2: number;
  setupPiasters: Piasters;
  dieCostPiasters: Piasters;
  printSidesSurchargePct: number;
  /** Unit surcharge (piasters, buy price) per finish at `referenceAreaM2`. */
  finishSurcharges: Partial<Record<FinishCode, Piasters>>;
  leadTimeDays: number;
  active: boolean;
}

export interface PricingData {
  vendors: PricingVendor[];
  rateCards: PricingRateCard[];
  materials: PricingMaterial[];
  finishes: PricingFinish[];
  /** Catalog presets per structure (Structure.presets). Presets with `standard: true` have dies. */
  presets: Partial<Record<StructureCode, DimsPreset[]>>;
}

// ───────────────────────── Output ─────────────────────────

export interface ShippingEstimate {
  zone: DeliveryZone;
  originZone: DeliveryZone;
  mode: "COURIER" | "FREIGHT";
  bundles: number;
  unitsPerBundle: number;
  /** Flat-packed bundle outer size in cm (largest bundle). */
  bundleCm: { L: number; W: number; H: number };
  actualWeightKg: number;
  volumetricWeightKg: number;
  chargeableWeightKg: number;
  /** Delivery price (ex-VAT). */
  pricePiasters: Piasters;
  transitDays: number;
}

/** Internal economics. Never send to buyers: `toPublicOffer()` strips it. */
export interface OfferInternal {
  vendorCostPiasters: Piasters;
  shippingCostPiasters: Piasters;
  marginPiasters: Piasters;
  marginPct: number;
  areaRatio: number;
  boardMultiplier: number;
  indexId: string;
}

/** One vendor's priced offer. Extends the shared QuoteResult contract. */
export interface VendorOffer extends QuoteResult {
  vendor: {
    id: string;
    slug: string;
    name: { ar: string; en: string };
    city: EgyptCity;
    rating: number;
    ratingCount: number;
    onTimePct: number;
    onTimeShown?: boolean;
    verified: boolean;
  };
  printMethod: PrintMethod;
  shippingPiasters: Piasters;
  shipping: ShippingEstimate;
  /** Production days (leadTimeDays) + transit days. */
  deliveryDays: number;
  /** "Best match" score, 0..1 (higher is better). */
  score: number;
  badges: Array<"BEST_MATCH" | "CHEAPEST" | "FASTEST" | "TOP_RATED">;
  internal: OfferInternal;
}

export type PublicVendorOffer = Omit<VendorOffer, "internal">;

export type IneligibleReason =
  | "VENDOR_INACTIVE"
  | "NO_RATE_CARD"
  | "STRUCTURE_UNSUPPORTED"
  | "MATERIAL_UNSUPPORTED"
  | "FINISH_UNSUPPORTED"
  | "TOO_MANY_COLOURS"
  | "BELOW_MIN_QTY"
  /** Added by catalogue (B-16): special-gluing model the printer has not listed. */
  | "MODEL_NOT_LISTED";

export interface StandardSizeSuggestion {
  presetId: string;
  name: { ar: string; en: string };
  dims: Dims;
  vendorId: string;
  totalPiasters: Piasters;
  unitPiasters: Piasters;
  savingsPiasters: Piasters;
  /** Whole percent saved vs the best current offer. */
  savingsPct: number;
  /** Production days saved vs the best current offer (0 or more). */
  leadTimeDaysSaved: number;
}

export interface InstantQuote<O extends PublicVendorOffer = VendorOffer> {
  mode: "instant";
  quantity: number;
  areaM2: number;
  areaSource: "dieline" | "estimate";
  /** Sorted best match first. Empty when no vendor can make it. */
  offers: O[];
  ineligible: Array<{ vendorId: string; reason: IneligibleReason }>;
  suggestion: StandardSizeSuggestion | null;
  validUntil: string;
  indexId: string;
}

export interface ManualQuote {
  mode: "manual_quote";
  /** QUANTITY_ABOVE_INSTANT_MAX: above 2,000 units. MODEL_BY_QUOTE: the model itself is quote-only (B-16). */
  reason: "QUANTITY_ABOVE_INSTANT_MAX" | "MODEL_BY_QUOTE";
  /** MODEL_BY_QUOTE only: why (src/data/catalogue/order-mode.ts). */
  orderReason?: "SPECIAL_GLUING" | "QUOTE_ONLY_STOCK" | "RARE_IN_EGYPT" | "FILLING_LINE";
  quantity: number;
  maxInstantQty: number;
}

export type QuoteOutcome<O extends PublicVendorOffer = VendorOffer> = InstantQuote<O> | ManualQuote;
