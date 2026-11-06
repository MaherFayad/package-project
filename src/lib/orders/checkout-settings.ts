import "server-only";
import { cache } from "react";
import { z } from "zod";
import { db } from "@/lib/db";
import { paymentConfig } from "@/lib/payments/config";

/**
 * Checkout settings (PlatformSetting "checkout"), read by checkout and order placement.
 * The admin owner edits the row (form not built here); until then the defaults below apply.
 *
 * - prepayDiscountPct (B-11): percent off product lines for prepaid orders. Plan §7.3 suggests 3%
 *   as the launch lever; PREPAY_DISCOUNT_PCT in the environment overrides the default, the
 *   admin row overrides both. Range 0 to 20.
 * - sample (B-05): a paid physical sample (1 to 5 pieces, digital print) credited against the
 *   buyer's next order of the same design within `creditDays`. `monthlyCap` limits how many
 *   samples can be ordered per calendar month platform-wide (0 = no cap).
 */
export const CHECKOUT_SETTING_KEY = "checkout";

export interface CheckoutSettings {
  prepayDiscountPct: number;
  sample: {
    enabled: boolean;
    /** Ex-VAT price of the sample pack (all pieces), piasters. */
    pricePiasters: number;
    maxPieces: number;
    creditDays: number;
    monthlyCap: number;
    /**
     * R4-B-11 (admin): ex-VAT price paid to the printer for one sample pack. null = not agreed yet:
     * the sample's buy price is assumed at SAMPLE_VENDOR_SHARE of the sample price.
     */
    vendorCostPiasters: number | null;
  };
}

export const DEFAULT_PREPAY_DISCOUNT_PCT = 3;

export function defaultCheckoutSettings(env: Record<string, string | undefined> = process.env): CheckoutSettings {
  const fromEnv = env.PREPAY_DISCOUNT_PCT !== undefined && env.PREPAY_DISCOUNT_PCT !== "";
  return {
    prepayDiscountPct: fromEnv ? paymentConfig(env).prepayDiscountPct : DEFAULT_PREPAY_DISCOUNT_PCT,
    sample: { enabled: true, pricePiasters: 75_000, maxPieces: 5, creditDays: 60, monthlyCap: 100, vendorCostPiasters: null },
  };
}

const storedSchema = z
  .object({
    prepayDiscountPct: z.number().min(0).max(20),
    sample: z
      .object({
        enabled: z.boolean(),
        pricePiasters: z.number().int().min(0).max(10_000_000),
        maxPieces: z.number().int().min(1).max(5),
        creditDays: z.number().int().min(0).max(365),
        monthlyCap: z.number().int().min(0).max(100_000),
        vendorCostPiasters: z.number().int().min(0).max(10_000_000).nullable(),
      })
      .partial(),
  })
  .partial();

/** Merge a stored row onto the defaults; invalid rows fall back to the defaults. */
export function mergeCheckoutSettings(stored: unknown, base: CheckoutSettings = defaultCheckoutSettings()): CheckoutSettings {
  const p = storedSchema.safeParse(stored);
  if (!p.success) return base;
  return {
    prepayDiscountPct: p.data.prepayDiscountPct ?? base.prepayDiscountPct,
    sample: { ...base.sample, ...p.data.sample },
  };
}

export const loadCheckoutSettings = cache(async (): Promise<CheckoutSettings> => {
  const row = await db.platformSetting.findUnique({ where: { key: CHECKOUT_SETTING_KEY } }).catch(() => null);
  return mergeCheckoutSettings(row?.value ?? null);
});
