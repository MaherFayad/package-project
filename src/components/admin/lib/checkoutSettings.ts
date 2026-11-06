import { z } from "zod";

/**
 * Admin form for PlatformSetting "checkout" (read by src/lib/orders/checkout-settings.ts).
 * Same bounds as that reader so a saved row is never silently dropped:
 * - prepayDiscountPct (B-11): 0 to 20 % off product lines for prepaid orders (plan §7.3: 3 % at launch);
 * - sample (B-05): paid physical sample of 1 to 5 pieces, credited on the next order of the design.
 */
const int = (min: number, max: number, code: string) => z.number({ invalid_type_error: code }).int(code).min(min, code).max(max, code);

export const checkoutSettingsFormSchema = z.object({
  prepayDiscountPct: z.number({ invalid_type_error: "PREPAY_RANGE" }).min(0, "PREPAY_RANGE").max(20, "PREPAY_RANGE"),
  sample: z.object({
    enabled: z.boolean(),
    pricePiasters: int(0, 10_000_000, "SAMPLE_PRICE_RANGE"),
    maxPieces: int(1, 5, "SAMPLE_PIECES_RANGE"),
    creditDays: int(0, 365, "SAMPLE_DAYS_RANGE"),
    monthlyCap: int(0, 100_000, "SAMPLE_CAP_RANGE"),
  }),
});
export type CheckoutSettingsForm = z.infer<typeof checkoutSettingsFormSchema>;
