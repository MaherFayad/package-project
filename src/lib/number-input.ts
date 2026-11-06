import { toWesternDigits } from "@/lib/phone";

/**
 * Typed numbers from buyers, printers and ops (R5-JR-18 to R5-JR-21; same rules as the admin
 * fields' R6-AD-01). Arabic-Indic (٠-٩) and Persian (۰-۹) digits are read; «٫» and "." are the
 * decimal point; "," «٬» «،» and spaces only GROUP thousands. So "18,50" is NOT 1,850: a comma that
 * is not followed by exactly three digits makes the input invalid instead of silently 100× too big.
 *
 * Returns null for an empty field, NaN for anything that is not a plain number.
 */
export function parseTypedNumber(raw: string | number | null | undefined, opts: { allowNegative?: boolean } = {}): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : NaN;
  const s = toWesternDigits(raw)
    .replace(/[٫]/g, ".")
    .replace(/[٬،]/g, ",")
    .replace(/[\s  ]/g, "")
    .replace(/^−/, "-");
  if (!s) return null;
  const sign = opts.allowNegative ? "-?" : "";
  const grouped = new RegExp(`^${sign}\\d{1,3}(,\\d{3})+(\\.\\d+)?$`);
  const plain = new RegExp(`^${sign}\\d+(\\.\\d+)?$`);
  if (!grouped.test(s) && !plain.test(s)) return NaN;
  return Number(s.replace(/,/g, ""));
}

/** A whole number (quantities): "5,000" and "٥٠٠٠" are 5000; "5.000", "5000.5" are invalid, not 5. */
export function parseTypedWhole(raw: string | null | undefined): number | null {
  const v = parseTypedNumber(raw ?? null);
  if (v === null || Number.isNaN(v)) return v;
  if (/[.٫]/.test(raw ?? "")) return NaN;
  return v;
}

/** Millimetres in the designer: a lone decimal comma is fine there ("250,5" mm), as is «٫». */
export function parseTypedMm(raw: string): number {
  const s = toWesternDigits(raw).replace(/[٫,]/, ".").trim();
  return /^\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
}
