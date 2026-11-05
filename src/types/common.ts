/** Shared primitive contracts. Every agent imports from "@/types". */

export const LOCALES = ["ar", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "ar";

export const ROLES = ["BUYER", "VENDOR", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

/** Bilingual text pair. DB columns follow the same convention: `xxxAr` / `xxxEn`. */
export interface LocalizedText {
  ar: string;
  en: string;
}

/**
 * Money is ALWAYS an integer number of piasters (1 EGP = 100 piasters).
 * Never store or compute money with floats; format only at the edge via
 * `formatMoney()` in src/lib/format.ts.
 */
export type Piasters = number;

export const CURRENCY = "EGP" as const;
/** Egypt standard VAT. Shown separately on every price. */
export const VAT_RATE = 0.14;
/** Quotes are valid for 72 hours. */
export const QUOTE_VALIDITY_HOURS = 72;
/** Anonymous (not signed-in) designs expire after 30 days. */
export const ANON_DESIGN_TTL_DAYS = 30;

/** Millimetres. All geometry in the app is in mm unless a name says otherwise. */
export type Mm = number;

export type ConsentKind = "TERMS" | "PRIVACY" | "MARKETING" | "RETARGETING";
