import { describe, expect, it } from "vitest";
import { COUNT_UNITS, formatCount } from "@/lib/format";
import { interpolate } from "@/i18n/core";
import { normalizeEgyptPhone, toWesternDigits } from "@/lib/phone";
import { ar } from "@/i18n/ar";
import { en } from "@/i18n/en";

function flat(o: unknown, p = "", out: Record<string, string> = {}): Record<string, string> {
  if (typeof o === "string") out[p] = o;
  else for (const [k, v] of Object.entries(o as Record<string, unknown>)) flat(v, p ? `${p}.${k}` : k, out);
  return out;
}

describe("formatCount (Arabic plural agreement)", () => {
  it("uses the CLDR Arabic forms", () => {
    expect(formatCount(1, "second", "ar")).toBe("ثانية واحدة");
    expect(formatCount(2, "second", "ar")).toBe("ثانيتين");
    expect(formatCount(5, "second", "ar")).toBe("5 ثوان");
    expect(formatCount(30, "second", "ar")).toBe("30 ثانية");
    expect(formatCount(100, "second", "ar")).toBe("100 ثانية");
    expect(formatCount(11, "day", "ar")).toBe("11 يوما");
    expect(formatCount(3, "day", "ar")).toBe("3 أيام");
    expect(formatCount(60, "minute", "ar")).toBe("60 دقيقة");
  });
  it("English singular / plural", () => {
    expect(formatCount(1, "minute", "en")).toBe("1 minute");
    expect(formatCount(1500, "box", "en")).toBe("1,500 boxes");
  });
});

describe("phone input", () => {
  it("accepts Arabic-Indic digits and bidi marks pasted from RTL text", () => {
    expect(toWesternDigits("١٢٣۴۵۶")).toBe("123456");
    expect(normalizeEgyptPhone("‏٠١٠ ١٢٣٤ ٥٦٧٨‎")).toBe("+201012345678");
    expect(normalizeEgyptPhone("⁦+20 10 1234 5678⁩")).toBe("+201012345678");
  });
});

describe("dictionaries", () => {
  const A = flat(ar);
  const E = flat(en);
  it("ar and en use the same {placeholders} for every key", () => {
    const bad = Object.keys(E).filter((k) => {
      const ph = (s = "") => (s.match(/\{\w+(?::\w+)?\}/g) ?? []).map((x) => x.replace(/:\w+\}$/, "}")).sort().join();
      return ph(A[k]) !== ph(E[k]);
    });
    expect(bad).toEqual([]);
  });
  it("Arabic values are not left in English", () => {
    const allowed = /^(English|\{[\w:]+\}.*|[A-Z0-9 \-:]+|.*\{\w+(?::\w+)?\}.*)$/; // language name, codes, pure placeholders
    // Keys ending in "En" hold deliberately English content (e.g. a default Latin text layer).
    const bad = Object.entries(A).filter(([k, v]) => !/En$/.test(k) && v === E[k] && /[a-z]{3}/.test(v) && !allowed.test(v));
    expect(bad).toEqual([]);
  });
  it("space-separated digit groups in Arabic text are LTR-isolated (else they render reversed)", () => {
    const bad = Object.entries(A).filter(
      ([, v]) => /[\u0600-\u06ff]/.test(v) && /\d+ \d+/.test(v.replace(/\u2066[^\u2069]*\u2069/g, "")),
    );
    expect(bad).toEqual([]);
  });
  it("Arabic uses Arabic punctuation (، ؟ ؛) next to Arabic letters", () => {
    const bad = Object.entries(A).filter(([, v]) => /[؀-ۿ]\s?[,;?]/.test(v));
    expect(bad).toEqual([]);
  });
});

describe("counted placeholders {n:unit}", () => {
  it("render the right Arabic form for 1, 2, 3–10, 11–99 and 100+", () => {
    const tpl = "التسليم خلال {days:day}";
    expect(interpolate(tpl, { days: 1 })).toBe("التسليم خلال يوم واحد");
    expect(interpolate(tpl, { days: 2 })).toBe("التسليم خلال يومين");
    expect(interpolate(tpl, { days: 5 })).toBe("التسليم خلال 5 أيام");
    expect(interpolate(tpl, { days: 14 })).toBe("التسليم خلال 14 يوما");
    expect(interpolate("{n:box}", { n: "1,200" }, "ar")).toBe("1,200 علبة");
  });
  it("render English singular and plural", () => {
    expect(interpolate("Ready in {days:day}", { days: 1 })).toBe("Ready in 1 day");
    expect(interpolate("{count:printer}", { count: 3 })).toBe("3 printers");
  });
  it("fall back to the raw value when it is not numeric, and leave unknown vars alone", () => {
    expect(interpolate("{days:day}", { days: "—" })).toBe("—");
    expect(interpolate("{days:day}", {})).toBe("{days:day}");
  });
  it("every unit used in the dictionaries exists", () => {
    const used = [...Object.values(flat(ar)), ...Object.values(flat(en))].flatMap((v) =>
      [...v.matchAll(/\{\w+:(\w+)\}/g)].map((m) => m[1]),
    );
    expect(used.filter((u) => !(COUNT_UNITS as readonly string[]).includes(u))).toEqual([]);
  });
  it("no Arabic value puts a bare number placeholder before a counted noun", () => {
    const nouns = /^(يوم|أيام|طلبات|مطابع|تقييم|وحدات|ألوان|أخطاء|ثوان|دقائق|ساعات)/;
    const bad = Object.entries(flat(ar)).filter(([, v]) =>
      [...v.matchAll(/\{\w+\} ?([\u0600-\u06ff]+)/g)].some((m) => nouns.test(m[1])),
    );
    expect(bad).toEqual([]);
  });
});

describe("round 4 copy rules", () => {
  const A = flat(ar);
  it("no tatweel in Arabic values (write بالرقم / لكمية, not بـ / لـ)", () => {
    expect(Object.entries(A).filter(([, v]) => /ـ/.test(v))).toEqual([]);
  });
  it("Arabic uses «» quotation marks, not ASCII quotes", () => {
    expect(Object.entries(A).filter(([, v]) => /[؀-ۿ]/.test(v) && /"/.test(v))).toEqual([]);
  });
  it("no bare {placeholder} before a counted noun (use {n:box}, {n:piece}, {n:hour})", () => {
    const nouns = /^(علبة|علب|قطعة|قطع|ساعة|ساعات|يوم|أيام|طلب|طلبات|مطبعة|مطابع|ثانية|دقيقة|دقائق)$/;
    const bad = Object.entries(A).filter(([, v]) => [...v.matchAll(/\{\w+\}\s([؀-ۿ]+)/g)].some((m) => nouns.test(m[1])));
    expect(bad).toEqual([]);
  });
  it("counted box quantities agree in Arabic", () => {
    expect(interpolate(ar.checkout.quantity.customHelp, { max: "2,000" })).toBe("من 1 إلى 2,000 علبة.");
    expect(interpolate(ar.buyer.sample.tier, { pieces: 3 })).toBe("عينة · 3 علب");
    expect(interpolate(ar.admin.quotes.dueIn, { hours: 5 })).toBe("الرد خلال 5 ساعات");
    expect(interpolate(ar.vendorPortal.common.pcs, { count: "1,500" }, "ar")).toBe("1,500 قطعة");
  });
  it("Spot UV is not transliterated (يو في)", () => {
    expect(Object.entries(A).filter(([, v]) => /يو في/.test(v))).toEqual([]);
  });
});
