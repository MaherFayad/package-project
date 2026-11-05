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
