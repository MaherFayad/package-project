import { describe, expect, it } from "vitest";
import { formatCount } from "@/lib/format";
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
      const ph = (s = "") => (s.match(/\{\w+\}/g) ?? []).sort().join();
      return ph(A[k]) !== ph(E[k]);
    });
    expect(bad).toEqual([]);
  });
  it("Arabic values are not left in English", () => {
    const allowed = /^(English|\{[\w]+\}.*|[A-Z0-9 \-:]+|.*\{\w+\}.*)$/; // language name, codes, pure placeholders
    // Keys ending in "En" hold deliberately English content (e.g. a default Latin text layer).
    const bad = Object.entries(A).filter(([k, v]) => !/En$/.test(k) && v === E[k] && /[a-z]{3}/.test(v) && !allowed.test(v));
    expect(bad).toEqual([]);
  });
  it("Arabic uses Arabic punctuation (، ؟ ؛) next to Arabic letters", () => {
    const bad = Object.entries(A).filter(([, v]) => /[؀-ۿ]\s?[,;?]/.test(v));
    expect(bad).toEqual([]);
  });
});
