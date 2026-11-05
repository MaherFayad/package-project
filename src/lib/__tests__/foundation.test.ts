import { describe, expect, it } from "vitest";
import { normalizeEgyptPhone, formatEgyptPhone } from "@/lib/phone";
import { formatMoney, formatDims } from "@/lib/format";
import { rateLimit, __resetRateLimits } from "@/lib/rate-limit";
import { canonicalJson } from "@/lib/json";
import { ar } from "@/i18n/ar";
import { en } from "@/i18n/en";
import { getT, t, getDictionary } from "@/i18n";

describe("phone", () => {
  it("normalizes Egyptian mobiles", () => {
    expect(normalizeEgyptPhone("01012345678")).toBe("+201012345678");
    expect(normalizeEgyptPhone("+20 101 234 5678")).toBe("+201012345678");
    expect(normalizeEgyptPhone("00201512345678")).toBe("+201512345678");
    expect(normalizeEgyptPhone("٠١٠١٢٣٤٥٦٧٨")).toBe("+201012345678");
    expect(normalizeEgyptPhone("01312345678")).toBeNull();
    expect(normalizeEgyptPhone("12345")).toBeNull();
    expect(formatEgyptPhone("+201012345678")).toBe("010 1234 5678");
  });
});

describe("format", () => {
  it("formats money in piasters with Western digits", () => {
    expect(formatMoney(125050, "ar")).toBe("1,250.50 ج.م");
    expect(formatMoney(200000, "en")).toBe("EGP 2,000");
    expect(formatDims({ L: 300, W: 200, H: 100 }, "en")).toContain("300 × 200 × 100");
  });
});

describe("rate limit", () => {
  it("blocks after the limit", () => {
    __resetRateLimits();
    expect(rateLimit("t", "k", 2, 1000).ok).toBe(true);
    expect(rateLimit("t", "k", 2, 1000).ok).toBe(true);
    expect(rateLimit("t", "k", 2, 1000).ok).toBe(false);
  });
});

describe("json", () => {
  it("canonicalizes key order", () => {
    expect(canonicalJson({ b: 1, a: { d: 1, c: 2 } })).toBe(canonicalJson({ a: { c: 2, d: 1 }, b: 1 }));
  });
});

function keys(o: unknown, p = ""): string[] {
  if (typeof o === "string") return [p];
  return Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => keys(v, p ? `${p}.${k}` : k));
}

describe("i18n", () => {
  it("ar and en have identical key sets", () => {
    expect(keys(ar).sort()).toEqual(keys(en).sort());
  });
  it("interpolates", () => {
    expect(t(getDictionary("en"), "auth.devBanner", { code: "123456" })).toContain("123456");
    expect(getT("ar")("nav.home")).toBe("الرئيسية");
  });
  it("Arabic strings have no diacritics", () => {
    const tashkeel = /[ً-ْ]/;
    for (const k of keys(ar)) {
      const v = k.split(".").reduce<unknown>((o, part) => (o as Record<string, unknown>)[part], ar) as string;
      expect(tashkeel.test(v), `${k}: ${v}`).toBe(false);
    }
  });
});
