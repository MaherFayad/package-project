import type { Locale } from "@/types";
import { DEFAULT_LOCALE, LOCALES } from "@/types";
import { ar } from "./ar";
import { en } from "./en";
import type { DictKey, Dictionary, TFunction, TVars } from "./types";
import { interpolate, lookup } from "./core";

export { interpolate, lookup } from "./core";

export type { Dictionary, DictKey, TFunction, TVars } from "./types";

const dictionaries: Record<Locale, Dictionary> = { ar, en };

export function isLocale(x: unknown): x is Locale {
  return typeof x === "string" && (LOCALES as readonly string[]).includes(x);
}

/** Narrow an untrusted route param to a Locale (falls back to the default). */
export function toLocale(x: unknown): Locale {
  return isLocale(x) ? x : DEFAULT_LOCALE;
}

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
}

export function dirOf(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}

/** t(dict, "auth.codeHint", { phone }) */
export function t(dict: Dictionary, key: DictKey, vars?: TVars): string {
  return interpolate(lookup(dict, key), vars);
}

/** Bound translator for server components: const t = getT(locale); t("nav.home") */
export function getT(locale: Locale): TFunction {
  const dict = getDictionary(locale);
  return (key, vars) => t(dict, key, vars);
}

/** Pick the right half of a bilingual DB pair: pick(locale, row.nameAr, row.nameEn). */
export function pick<T>(locale: Locale, arValue: T, enValue: T): T {
  return locale === "ar" ? arValue : enValue;
}

/** Same for a LocalizedText object. */
export function localized(locale: Locale, text: { ar: string; en: string }): string {
  return text[locale];
}
