import type { Locale } from "@/types";

/**
 * "Tuesday 17 November": the day the boxes should arrive when paid now. Matches the order's
 * dueDate (placedAt + deliveryDays calendar days, src/lib/orders/service.ts). Cairo time, Western digits.
 */
export function arrivalDate(days: number, locale: Locale, now = Date.now()): string {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Cairo" }).format(new Date(now + days * 86_400_000));
}
