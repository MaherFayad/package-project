import type { Locale, Piasters } from "@/types";
import { formatMoney } from "@/lib/format";

/**
 * Integer-piaster helpers. Engine maths may use floats for factors, but every amount that is
 * shown, summed or stored goes through `toPiasters()` first.
 */

/** Round half away from zero to a whole piaster (avoids banker's / FP surprises like 2.675). */
export function toPiasters(value: number): Piasters {
  if (!Number.isFinite(value)) throw new RangeError(`Invalid money amount: ${value}`);
  // Remove float noise (e.g. 1.005 * 100 = 100.49999999999999) before rounding.
  const cleaned = Math.round(value * 1e6) / 1e6;
  return Math.sign(cleaned) * Math.floor(Math.abs(cleaned) + 0.5);
}

/** VAT on an integer subtotal, rounded half-up, exact (integer arithmetic). rate = 0.14 → 14%. */
export function vatOf(subtotal: Piasters, rate: number): Piasters {
  if (!Number.isInteger(subtotal)) throw new RangeError("subtotal must be integer piasters");
  const bp = Math.round(rate * 10_000); // basis points
  const num = subtotal * bp;
  const q = Math.floor(Math.abs(num) / 10_000);
  const r = Math.abs(num) % 10_000;
  return Math.sign(num) * (r * 2 >= 10_000 ? q + 1 : q);
}

/** Apply a percentage markup (0.25 = +25%) to a piaster amount and round. */
export function withMargin(amount: number, marginPct: number): Piasters {
  return toPiasters(amount * (1 + marginPct));
}

export function sumPiasters(values: Piasters[]): Piasters {
  return values.reduce((a, b) => a + b, 0);
}

/**
 * Locale price formatting for pricing UIs.
 *   formatPrice(125050, "ar") -> "1,250.50 ج.م"   formatPrice(125050, "en") -> "EGP 1,250.50"
 * Unit prices always show 2 decimals (e.g. "EGP 12.40") so per-box prices line up.
 */
export function formatPrice(p: Piasters, locale: Locale, kind: "total" | "unit" = "total"): string {
  return formatMoney(p, locale, { alwaysDecimals: kind === "unit" });
}
