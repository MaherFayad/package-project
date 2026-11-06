/**
 * Parsing typed amounts and decimals in admin and vendor forms (R6-AD-01; shared since round 7).
 * The old readers dropped every comma, so a decimal
 * comma ("18,50", common on Arabic and European keyboards) became EGP 1,850.00: a sent price 100
 * times too high. Now:
 * - Arabic-Indic and Persian digits, the Arabic decimal separator «٫» and thousands separator «٬»
 *   are read as Western digits, "." and ",";
 * - a comma is accepted only as a thousands separator in groups of three ("1,500" or "12,500.75");
 * - anything else ("18,50", "1.2.3", "-5", "12abc") is invalid (NaN), so the form shows an error;
 * - at most two decimals (piasters).
 */
const AR_DIGITS = /[٠-٩۰-۹]/g;

export function normaliseNumberInput(v: string): string {
  return v
    .replace(AR_DIGITS, (c) => String(c.charCodeAt(0) - (c.charCodeAt(0) >= 0x06f0 ? 0x06f0 : 0x0660)))
    .replace(/٫/g, ".")
    .replace(/[٬،]/g, ",")
    .replace(/[\s  ]/g, "")
    .trim();
}

/** EGP text → piasters; null when empty, NaN when not a clear amount. */
export function parseEgpInput(v: string): number | null {
  const s = normaliseNumberInput(v);
  if (!s) return null;
  if (!/^(\d{1,3}(,\d{3})+|\d+)(\.\d{1,2})?$/.test(s)) return NaN;
  return Math.round(Number(s.replace(/,/g, "")) * 100);
}

/** Whole number text ("5000", "5,000", "٥٠٠٠") → number; null when empty, NaN when invalid. */
export function parseWholeInput(v: string): number | null {
  const s = normaliseNumberInput(v);
  if (!s) return null;
  if (!/^(\d{1,3}(,\d{3})+|\d+)$/.test(s)) return NaN;
  return Number(s.replace(/,/g, ""));
}

/** Any decimal number (rates, percentages, FX); NaN when empty or not a clear number. */
export function parseNumberInput(v: string): number {
  const s = normaliseNumberInput(v);
  if (!s || !/^(\d{1,3}(,\d{3})+|\d+)(\.\d+)?$/.test(s)) return NaN;
  return Number(s.replace(/,/g, ""));
}

/**
 * Any decimal number with an optional sign (vendor rate cards, profile numbers): null when empty,
 * NaN when not a clear number. Same comma rule: thousands groups only.
 */
export function parseDecimalInput(raw: string | number | null | undefined, opts: { allowNegative?: boolean } = {}): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  let s = normaliseNumberInput(raw);
  if (!s) return null;
  const neg = s.startsWith("-");
  if (neg) {
    if (!opts.allowNegative) return NaN;
    s = s.slice(1);
  }
  if (!/^(\d{1,3}(,\d{3})+|\d+)(\.\d+)?$/.test(s)) return NaN;
  const n = Number(s.replace(/,/g, ""));
  return neg ? -n : n;
}
