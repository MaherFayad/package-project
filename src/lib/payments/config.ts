import type { PaymentMethod } from "@/types";
import { devFlag } from "@/lib/env";

/**
 * Payment rules (report §7.3): first orders are 100% prepaid. An optional prepayment discount
 * (e.g. 3%) rewards paying up front; it is OFF unless PREPAY_DISCOUNT_PCT is set.
 */
export interface PaymentConfig {
  provider: "mock" | "paymob";
  /** Share of the order paid up front. Fixed at 1 (100%) for now. */
  prepayShare: 1;
  /** Percent off product + setup + die + finish lines (not shipping) for prepaid orders. 0 = off. */
  prepayDiscountPct: number;
  /** Fawry reference codes expire after this many hours. */
  fawryExpiryHours: number;
  /** InstaPay transfers are matched by hand; this is the receiving address shown to buyers. */
  instapayAddress: string;
  methods: PaymentMethod[];
}

function num(v: string | undefined, fallback: number, min: number, max: number): number {
  const n = v === undefined || v === "" ? NaN : Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

export function paymentConfig(env: Record<string, string | undefined> = process.env): PaymentConfig {
  return {
    provider: env.PAYMENTS_PROVIDER === "paymob" ? "paymob" : "mock",
    prepayShare: 1,
    prepayDiscountPct: num(env.PREPAY_DISCOUNT_PCT, 0, 0, 20),
    fawryExpiryHours: num(env.FAWRY_EXPIRY_HOURS, 48, 1, 168),
    instapayAddress: env.INSTAPAY_ADDRESS || "elba@instapay",
    methods: ["CARD", "WALLET", "FAWRY", "INSTAPAY"],
  };
}

/**
 * The mock gateway (and its "simulate payment" endpoint) may run in dev, and under `next start`
 * only when ALLOW_MOCK_PAYMENTS="1" (local prod builds and e2e). NEVER set it in a deployment:
 * it would let anyone mark orders paid. On an https:// site URL the flag is ignored (src/lib/env.ts).
 */
export function mockPaymentsEnabled(env: Record<string, string | undefined> = process.env): boolean {
  if (paymentConfig(env).provider !== "mock") return false;
  // Ignored (with one warning) when NEXT_PUBLIC_SITE_URL is https://, i.e. a real deployment.
  if (env.NODE_ENV === "production") return devFlag("ALLOW_MOCK_PAYMENTS", env) === "1";
  return true;
}
