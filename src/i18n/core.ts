import type { Locale } from "@/types";
import { COUNT_UNITS, formatCount, type CountUnit } from "@/lib/format";
import type { Dictionary, TVars } from "./types";

/** Dictionary-free helpers, safe for client bundles. */
/** Look up a dot path. Missing keys return the key itself (and warn in dev). */
export function lookup(dict: Dictionary, key: string): string {
  let cur: unknown = dict;
  for (const part of key.split(".")) {
    if (cur && typeof cur === "object" && part in (cur as object)) {
      cur = (cur as Record<string, unknown>)[part];
    } else {
      cur = undefined;
      break;
    }
  }
  if (typeof cur !== "string") {
    if (process.env.NODE_ENV !== "production") console.warn(`[i18n] missing key: ${key}`);
    return key;
  }
  return cur;
}

const ARABIC = /[\u0600-\u06ff]/;
const NUMERIC = /^-?[\d,]+(\.\d+)?$/;

/**
 * Fill {placeholders}. A counted placeholder `{days:day}` takes a number (or a numeric string
 * such as "1,200") and renders it with the noun in the right grammatical form for the language
 * of the template: "خلال {days:day}" -> "خلال يومين" / "خلال 5 أيام" / "خلال 14 يوما",
 * "in {days:day}" -> "in 1 day" / "in 5 days". Units: see COUNT_UNITS in src/lib/format.ts.
 */
export function interpolate(s: string, vars?: TVars, locale?: Locale): string {
  if (!vars) return s;
  return s.replace(/\{(\w+)(?::(\w+))?\}/g, (m, k: string, unit?: string) => {
    if (!(k in vars)) return m;
    const v = vars[k];
    if (!unit) return String(v);
    const n = typeof v === "number" ? v : NUMERIC.test(String(v)) ? Number(String(v).replace(/,/g, "")) : NaN;
    if (!Number.isFinite(n) || !(COUNT_UNITS as readonly string[]).includes(unit)) return String(v);
    return formatCount(n, unit as CountUnit, locale ?? (ARABIC.test(s) ? "ar" : "en"));
  });
}
