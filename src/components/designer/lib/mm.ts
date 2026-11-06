import { normaliseNumberInput, parseDecimalInput } from "@/lib/money/input";

/**
 * R5-JR-20: a size typed in millimetres. Native type="number" fields refused Arabic-Indic digits
 * («٢٥٠») in Chromium, so the size silently stayed the same. Reads them through the shared
 * reader (src/lib/money/input.ts), plus one rule for sizes: a single comma before 1 or 2 digits
 * ("250,5", "250٫5") is a decimal comma — nobody types thousands groups for a box size.
 * Returns NaN when not a number (empty included), so callers keep their "invalid" state.
 */
export function parseMmInput(raw: string): number {
  const s = normaliseNumberInput(raw);
  if (!s) return NaN;
  const dec = /^(\d+),(\d{1,2})$/.exec(s);
  if (dec) return Number(`${dec[1]}.${dec[2]}`);
  const n = parseDecimalInput(s);
  return n === null ? NaN : n;
}
