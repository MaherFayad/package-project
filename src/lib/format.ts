import type { Locale, Piasters } from "@/types";

/**
 * Locale-aware formatting. Arabic UI uses WESTERN digits for sizes and prices
 * (norm on Egyptian e-commerce) and puts "ج.م" AFTER the amount.
 */

const latn = (locale: Locale) => (locale === "ar" ? "ar-EG-u-nu-latn" : "en-EG");

export function piastersToEgp(p: Piasters): number {
  return Math.round(p) / 100;
}

export function egpToPiasters(egp: number): Piasters {
  return Math.round(egp * 100);
}

/**
 * formatMoney(125050, "ar") -> "1,250.50 ج.م"
 * formatMoney(125050, "en") -> "EGP 1,250.50"
 * Whole amounts drop decimals unless `alwaysDecimals`.
 */
export function formatMoney(
  p: Piasters,
  locale: Locale,
  opts: { alwaysDecimals?: boolean } = {},
): string {
  const egp = piastersToEgp(p);
  const hasFraction = Math.round(p) % 100 !== 0;
  const digits = opts.alwaysDecimals || hasFraction ? 2 : 0;
  const n = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(egp);
  return locale === "ar" ? `${n} ج.م` : `EGP ${n}`;
}

/** Plain number with Western digits and grouping: 2000 -> "2,000". */
export function formatNumber(n: number, maxFractionDigits = 0): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: maxFractionDigits }).format(n);
}

/** "300 × 200 × 100 mm" / "300 × 200 × 100 مم". Dims are never mirrored. */
export function formatDims(d: { L: number; W: number; H: number }, locale: Locale): string {
  const unit = locale === "ar" ? "مم" : "mm";
  return `⁦${formatNumber(d.L)} × ${formatNumber(d.W)} × ${formatNumber(d.H)}⁩ ${unit}`;
}

export function formatDate(
  date: Date | string,
  locale: Locale,
  style: "short" | "medium" | "long" = "medium",
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(latn(locale), { dateStyle: style, timeZone: "Africa/Cairo" }).format(d);
}

export function formatDateTime(date: Date | string, locale: Locale): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(latn(locale), {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Cairo",
  }).format(d);
}

export function formatPercent(n: number, locale: Locale): string {
  void locale;
  return `${formatNumber(n, 1)}%`;
}

export type CountUnit = "second" | "minute" | "hour" | "day" | "box" | "order" | "item";

/**
 * Arabic forms per CLDR plural category (one, two, few = 3–10, many = 11–99, other = 0 / 100+).
 * Dual and "one" carry the number in the word, so no digit is shown for them.
 * No diacritics; accusative alif (يوما) only where MSA writes it.
 */
const AR_UNITS: Record<CountUnit, Record<"one" | "two" | "few" | "many" | "other", string>> = {
  second: { one: "ثانية واحدة", two: "ثانيتين", few: "ثوان", many: "ثانية", other: "ثانية" },
  minute: { one: "دقيقة واحدة", two: "دقيقتين", few: "دقائق", many: "دقيقة", other: "دقيقة" },
  hour: { one: "ساعة واحدة", two: "ساعتين", few: "ساعات", many: "ساعة", other: "ساعة" },
  day: { one: "يوم واحد", two: "يومين", few: "أيام", many: "يوما", other: "يوم" },
  box: { one: "علبة واحدة", two: "علبتين", few: "علب", many: "علبة", other: "علبة" },
  order: { one: "طلب واحد", two: "طلبين", few: "طلبات", many: "طلبا", other: "طلب" },
  item: { one: "عنصر واحد", two: "عنصرين", few: "عناصر", many: "عنصرا", other: "عنصر" },
};
const EN_UNITS: Record<CountUnit, [string, string]> = {
  second: ["second", "seconds"],
  minute: ["minute", "minutes"],
  hour: ["hour", "hours"],
  day: ["day", "days"],
  box: ["box", "boxes"],
  order: ["order", "orders"],
  item: ["item", "items"],
};
const arPlural = new Intl.PluralRules("ar");

/**
 * A counted noun with correct grammar: formatCount(5, "second", "ar") -> "5 ثوان",
 * formatCount(2, "day", "ar") -> "يومين", formatCount(30, "second", "en") -> "30 seconds".
 * Use it for the value of a {placeholder} instead of writing "{n} ثانية" in the dictionary.
 */
export function formatCount(n: number, unit: CountUnit, locale: Locale): string {
  if (locale === "en") return `${formatNumber(n)} ${EN_UNITS[unit][n === 1 ? 0 : 1]}`;
  const cat = arPlural.select(n) as "zero" | "one" | "two" | "few" | "many" | "other";
  const forms = AR_UNITS[unit];
  if (cat === "one") return forms.one;
  if (cat === "two") return forms.two;
  const word = cat === "few" ? forms.few : cat === "many" ? forms.many : forms.other;
  return `${formatNumber(n)} ${word}`;
}
