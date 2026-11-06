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

export type CountUnit =
  | "second"
  | "minute"
  | "hour"
  | "day"
  | "week"
  | "month"
  | "box"
  | "order"
  | "item"
  | "vendor"
  | "printer"
  | "review"
  | "unit"
  | "colour"
  | "piece"
  | "model"
  | "photo"
  | "error"
  | "priceList"
  | "design"
  | "file";

export const COUNT_UNITS: readonly CountUnit[] = [
  "second", "minute", "hour", "day", "week", "month", "box", "order", "item", "vendor", "printer",
  "review", "unit", "colour", "piece", "model", "photo", "error", "priceList", "design", "file",
];

/**
 * Arabic forms per CLDR plural category (one, two, few = 3–10, many = 11–99, other = 0 / 100+).
 * Dual and "one" carry the number in the word, so no digit is shown for them.
 * No diacritics; accusative alif (يوما) only where MSA writes it (masculine tamyiz, 11–99).
 * Duals are in the oblique case (يومين), which is what follows a preposition or a verb in UI copy.
 */
const AR_UNITS: Record<CountUnit, Record<"one" | "two" | "few" | "many" | "other", string>> = {
  second: { one: "ثانية واحدة", two: "ثانيتين", few: "ثوان", many: "ثانية", other: "ثانية" },
  minute: { one: "دقيقة واحدة", two: "دقيقتين", few: "دقائق", many: "دقيقة", other: "دقيقة" },
  hour: { one: "ساعة واحدة", two: "ساعتين", few: "ساعات", many: "ساعة", other: "ساعة" },
  day: { one: "يوم واحد", two: "يومين", few: "أيام", many: "يوما", other: "يوم" },
  week: { one: "أسبوع واحد", two: "أسبوعين", few: "أسابيع", many: "أسبوعا", other: "أسبوع" },
  month: { one: "شهر واحد", two: "شهرين", few: "أشهر", many: "شهرا", other: "شهر" },
  box: { one: "علبة واحدة", two: "علبتين", few: "علب", many: "علبة", other: "علبة" },
  order: { one: "طلب واحد", two: "طلبين", few: "طلبات", many: "طلبا", other: "طلب" },
  item: { one: "عنصر واحد", two: "عنصرين", few: "عناصر", many: "عنصرا", other: "عنصر" },
  vendor: { one: "مطبعة واحدة", two: "مطبعتين", few: "مطابع", many: "مطبعة", other: "مطبعة" },
  printer: { one: "مطبعة واحدة", two: "مطبعتين", few: "مطابع", many: "مطبعة", other: "مطبعة" },
  review: { one: "تقييم واحد", two: "تقييمين", few: "تقييمات", many: "تقييما", other: "تقييم" },
  unit: { one: "وحدة واحدة", two: "وحدتين", few: "وحدات", many: "وحدة", other: "وحدة" },
  colour: { one: "لون واحد", two: "لونين", few: "ألوان", many: "لونا", other: "لون" },
  piece: { one: "قطعة واحدة", two: "قطعتين", few: "قطع", many: "قطعة", other: "قطعة" },
  model: { one: "نموذج واحد", two: "نموذجين", few: "نماذج", many: "نموذجا", other: "نموذج" },
  photo: { one: "صورة واحدة", two: "صورتين", few: "صور", many: "صورة", other: "صورة" },
  error: { one: "خطأ واحد", two: "خطأين", few: "أخطاء", many: "خطأ", other: "خطأ" },
  priceList: { one: "قائمة أسعار واحدة", two: "قائمتي أسعار", few: "قوائم أسعار", many: "قائمة أسعار", other: "قائمة أسعار" },
  design: { one: "تصميم واحد", two: "تصميمين", few: "تصميمات", many: "تصميما", other: "تصميم" },
  file: { one: "ملف واحد", two: "ملفين", few: "ملفات", many: "ملفا", other: "ملف" },
};
const EN_UNITS: Record<CountUnit, [string, string]> = {
  second: ["second", "seconds"],
  minute: ["minute", "minutes"],
  hour: ["hour", "hours"],
  day: ["day", "days"],
  week: ["week", "weeks"],
  month: ["month", "months"],
  box: ["box", "boxes"],
  order: ["order", "orders"],
  item: ["item", "items"],
  vendor: ["vendor", "vendors"],
  printer: ["printer", "printers"],
  review: ["review", "reviews"],
  unit: ["unit", "units"],
  colour: ["colour", "colours"],
  piece: ["piece", "pieces"],
  model: ["model", "models"],
  photo: ["photo", "photos"],
  error: ["error", "errors"],
  priceList: ["price list", "price lists"],
  design: ["design", "designs"],
  file: ["file", "files"],
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
