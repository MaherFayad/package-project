import type { Dims, MaterialCode, Piasters, StructureCode } from "@/types";
import { QTY_TIERS, VAT_RATE } from "@/types";
import { defaultMaterialFor } from "@/lib/dieline";
import { headlineInput, headlineOffer, quote, toPublicOffer, type PricingConfig, type PricingData, type VendorOffer } from "@/lib/pricing";
import { orderTotals } from "@/lib/orders/totals";
import { applySampleCredit, sampleOffer, SAMPLE_PRODUCTION_DAYS } from "@/lib/orders/sample";


/**
 * Real numbers for /why-elba and /pricing (owner: r6-why). Pure and DB-free: the pages pass in
 * the same pricing data, pricing config and checkout settings that checkout reads, and every
 * price here goes through the same functions checkout uses:
 *
 *   quote(headlineInput(box) + quantity)  → headlineOffer (best match, pre-selected at checkout)
 *   orderTotals(lines, prepayDiscountPct) → what checkout charges (every order is paid online
 *                                           before print, so the admin prepay discount applies)
 *   orderTotals(lines, 0)                 → the list price that discount comes off
 *   sampleOffer(offer, pieces, price)     → sample pack, same printer, fixed price
 *
 * So a published price can never drift from what the buyer is charged for the same box
 * (src/components/marketing/why/__tests__/pricing-facts.test.ts pins this against
 * toCheckoutOffer in the order service).
 */

/** The reference box every public price on these pages is computed for. */
export const REFERENCE_BOX: { code: StructureCode; dims: Dims; material: MaterialCode } = {
  code: "FEFCO_0427",
  // Standard T-shirt mailer: a catalogue standard size, so no new cutting die is charged.
  dims: { L: 300, W: 220, H: 60 },
  material: defaultMaterialFor("FEFCO_0427"),
};

export interface CheckoutSettingsLike {
  prepayDiscountPct: number;
  sample: { enabled: boolean; pricePiasters: number; maxPieces: number; creditDays: number; vendorCostPiasters: number | null };
}

export interface PriceTier {
  quantity: number;
  /**
   * Per box exactly as checkout shows it on the offer card: round(pay.subtotal / quantity), i.e.
   * ex-VAT, after the prepay discount, with setup and delivery spread over the boxes.
   */
  unitPiasters: Piasters;
  /** Same, incl. 14% VAT: round(pay.total / quantity). */
  unitInclVatPiasters: Piasters;
  /** What checkout charges, ex-VAT (pay.subtotal: goods − prepay discount + delivery). */
  subtotalPiasters: Piasters;
  /** What checkout charges, incl. 14% VAT (pay.total). Every order is paid online, so this is the price. */
  totalPiasters: Piasters;
  /** Total incl. VAT before the prepay discount (the list price the discount comes off). */
  listTotalPiasters: Piasters;
  /** listTotal − total. */
  savingPiasters: Piasters;
  /** Ex-VAT goods before the discount (product + setup + die + finishes). */
  goodsPiasters: Piasters;
  discountPiasters: Piasters;
  vatPiasters: Piasters;
  setupPiasters: Piasters;
  diePiasters: Piasters;
  shippingPiasters: Piasters;
  deliveryDays: number;
  method: "OFFSET" | "DIGITAL";
}

export interface PricingFacts {
  box: typeof REFERENCE_BOX;
  tiers: PriceTier[];
  maxInstantQty: number;
  minOrderQty: number;
  prepayDiscountPct: number;
  vatRate: number;
  quoteValidityHours: number;
  /** Fastest door-to-door days among the tiers (Greater Cairo). */
  fastestDeliveryDays: number | null;
  /** Lowest setup line of a digital offer at the smallest tier (file prep, no plates); null if none. */
  digitalSetupPiasters: Piasters | null;
  /** Digital presses are offered up to this quantity (pricing config). */
  digitalUpToQty: number;
  printerCount: number;
  /** Top three ranked offers for 500 reference boxes (public fields only, per box as checkout shows it). */
  matches: { name: { ar: string; en: string }; city: string; deliveryDays: number; unitPiasters: Piasters; badges: string[] }[];
  sample: null | {
    pieces: number;
    goodsPiasters: Piasters;
    totalPiasters: Piasters;
    deliveryDays: number;
    productionDays: number;
    creditDays: number;
  };
  /** Price drop per box from the smallest to the largest instant tier, percent (0 to 100). */
  unitDropPct: number | null;
}

function lineSum(o: VendorOffer, kind: string): Piasters {
  return o.lines.filter((l) => l.kind === kind).reduce((s, l) => s + l.totalPiasters, 0);
}

export function computePricingFacts(
  data: PricingData,
  config: PricingConfig,
  settings: CheckoutSettingsLike,
  now: Date = new Date(),
  box: typeof REFERENCE_BOX = REFERENCE_BOX,
): PricingFacts {
  const base = headlineInput(box.code, box.dims, box.material);
  const tiers: PriceTier[] = [];
  const offers = new Map<number, VendorOffer>();
  let digitalSetup: Piasters | null = null;
  let matches: PricingFacts["matches"] = [];
  for (const quantity of QTY_TIERS) {
    if (quantity > config.maxInstantQty) continue;
    let outcome;
    try {
      outcome = quote({ ...base, quantity }, data, { config, now });
    } catch {
      continue;
    }
    if (outcome.mode !== "instant") continue;
    const offer = headlineOffer(outcome.offers);
    if (!offer) continue;
    offers.set(quantity, offer);
    if (quantity === 500) {
      matches = outcome.offers.slice(0, 3).map((o) => {
        const p = toPublicOffer(o);
        const unit = Math.round(orderTotals(p.lines, settings.prepayDiscountPct).subtotalPiasters / quantity);
        return { name: p.vendor.name, city: p.vendor.city, deliveryDays: p.deliveryDays, unitPiasters: unit, badges: [...p.badges] };
      });
    }
    // Digital setup (file prep, no plates) from any printer that runs the smallest tier digitally.
    if (quantity === QTY_TIERS[0]) {
      for (const o of outcome.offers) {
        if (o.printMethod !== "DIGITAL") continue;
        const setup = lineSum(o, "SETUP");
        if (digitalSetup === null || setup < digitalSetup) digitalSetup = setup;
      }
    }
    const pub = toPublicOffer(offer);
    // The two calls checkout makes (toCheckoutOffer → buyerTotals): list (no discount) and pay.
    const list = orderTotals(pub.lines, 0);
    const pay = applySampleCredit(orderTotals(pub.lines, settings.prepayDiscountPct), 0);
    tiers.push({
      quantity,
      unitPiasters: Math.round(pay.subtotalPiasters / quantity),
      unitInclVatPiasters: Math.round(pay.totalPiasters / quantity),
      subtotalPiasters: pay.subtotalPiasters,
      totalPiasters: pay.totalPiasters,
      listTotalPiasters: list.totalPiasters,
      savingPiasters: list.totalPiasters - pay.totalPiasters,
      goodsPiasters: list.subtotalPiasters - list.shippingPiasters,
      discountPiasters: pay.discountPiasters,
      vatPiasters: pay.vatPiasters,
      setupPiasters: lineSum(offer, "SETUP"),
      diePiasters: lineSum(offer, "DIE"),
      shippingPiasters: pay.shippingPiasters,
      deliveryDays: pub.deliveryDays,
      method: offer.printMethod,
    });
  }

  const mins = data.vendors.filter((v) => v.status === "ACTIVE").map((v) => v.minOrderQty).filter((n) => Number.isFinite(n) && n > 0);

  let sample: PricingFacts["sample"] = null;
  const first = offers.get(QTY_TIERS[0]);
  if (settings.sample.enabled && first) {
    const s = sampleOffer(first, settings.sample.maxPieces, settings.sample.pricePiasters, settings.sample.vendorCostPiasters);
    const pay = orderTotals(toPublicOffer(s).lines, 0);
    sample = {
      pieces: settings.sample.maxPieces,
      goodsPiasters: settings.sample.pricePiasters,
      totalPiasters: pay.totalPiasters,
      deliveryDays: s.deliveryDays,
      productionDays: SAMPLE_PRODUCTION_DAYS,
      creditDays: settings.sample.creditDays,
    };
  }

  const firstUnit = tiers[0]?.unitPiasters;
  const lastUnit = tiers[tiers.length - 1]?.unitPiasters;
  return {
    box,
    tiers,
    maxInstantQty: config.maxInstantQty,
    minOrderQty: mins.length ? Math.min(...mins) : 1,
    prepayDiscountPct: settings.prepayDiscountPct,
    vatRate: VAT_RATE,
    quoteValidityHours: config.quoteValidityHours,
    fastestDeliveryDays: tiers.length ? Math.min(...tiers.map((t) => t.deliveryDays)) : null,
    digitalSetupPiasters: digitalSetup,
    digitalUpToQty: config.digital.maxQty,
    printerCount: data.vendors.filter((v) => v.status === "ACTIVE").length,
    matches,
    sample,
    unitDropPct: firstUnit && lastUnit && tiers.length > 1 ? Math.round((1 - lastUnit / firstUnit) * 100) : null,
  };
}
