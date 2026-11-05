import type { RateTier } from "@/types";

/**
 * Unit price for any quantity from a vendor's tier table.
 *
 * Between two tiers the unit price is interpolated linearly in log(quantity), which matches how
 * print unit costs fall (make-ready spread over more units). Below the first tier the first
 * tier's unit applies; at or above the last tier, the last tier's unit applies.
 * The result is a float (piasters); the caller rounds after applying all factors.
 */
export function interpolateUnit(tiers: RateTier[], quantity: number): number {
  if (tiers.length === 0) throw new Error("Rate card has no tiers");
  if (!(quantity > 0)) throw new RangeError("quantity must be > 0");
  const t = [...tiers].sort((a, b) => a.minQty - b.minQty);
  const first = t[0]!;
  const last = t[t.length - 1]!;
  if (quantity <= first.minQty) return first.unitPiasters;
  if (quantity >= last.minQty) return last.unitPiasters;
  for (let i = 0; i < t.length - 1; i++) {
    const a = t[i]!;
    const b = t[i + 1]!;
    if (quantity >= a.minQty && quantity <= b.minQty) {
      if (b.minQty === a.minQty) return b.unitPiasters;
      const f = (Math.log(quantity) - Math.log(a.minQty)) / (Math.log(b.minQty) - Math.log(a.minQty));
      return a.unitPiasters + (b.unitPiasters - a.unitPiasters) * f;
    }
  }
  return last.unitPiasters;
}
