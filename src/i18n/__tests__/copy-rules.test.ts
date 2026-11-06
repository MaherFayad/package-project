import { describe, expect, it } from "vitest";
import { ar } from "@/i18n/ar";
import { en } from "@/i18n/en";
import { STRUCTURE_CODES } from "@/types/structure";
import { homeCopy } from "@/components/marketing/home/copy";
import { startCopy } from "@/components/marketing/start/copy";
import { whyCopy } from "@/components/marketing/why/copy";
import { designerPageCopy } from "@/components/marketing/designer-page/copy";

/** Copy rules for every user-facing string (docs/audit/platform-glossary.md, docs/audit/copy.md). */
function flat(o: unknown, p = "", out: Record<string, string> = {}): Record<string, string> {
  for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
    const key = p ? `${p}.${k}` : k;
    if (typeof v === "string") out[key] = v;
    else flat(v, key, out);
  }
  return out;
}
const AR = flat(ar);
const EN = flat(en);
const offenders = (re: RegExp, dict = AR) => Object.entries(dict).filter(([, v]) => re.test(v)).map(([k, v]) => `${k}: ${v}`);

describe("ar/en dictionaries", () => {
  it("have the same keys", () => {
    const a = Object.keys(AR).sort();
    const e = Object.keys(EN).sort();
    expect(a.filter((k) => !(k in EN)), "keys only in ar").toEqual([]);
    expect(e.filter((k) => !(k in AR)), "keys only in en").toEqual([]);
  });

  it("have no empty values", () => {
    expect(offenders(/^\s*$/)).toEqual([]);
    expect(offenders(/^\s*$/, EN)).toEqual([]);
  });

  it("Arabic has no diacritics, superscript alef, Quranic marks or tatweel", () => {
    // U+064B–U+065F harakat and extended marks, U+0670 superscript alef, U+06D6–U+06ED Quranic marks, U+0640 tatweel.
    expect(offenders(/[ً-ٰٟۖ-ۭـ]/)).toEqual([]);
  });

  it("Arabic uses Western digits (the platform convention)", () => {
    expect(offenders(/[٠-٩۰-۹]/)).toEqual([]);
  });

  it("Arabic keeps one term per concept (glossary)", () => {
    const banned = [
      "أوردر", "ملغي", "تسعيرة", "طلب تسعير", "طلبات تسعير", "أونلاين", "موبايل", "الجوال", "لوحة التحكم",
      "الشروط والأحكام", "إشعار الخصوصية", "الديجيتال", "طلبية", "بطاقة أسعار", "المقوى", "موديل",
      "الديلاين", "النموذج المبدئي", "يرجى", "الرجاء", "سوف", "OTP",
    ];
    const hits = banned.flatMap((b) => offenders(new RegExp(b)).map((h) => `[${b}] ${h}`));
    // «المشتري / مشتر» as a whole word (not «مشترك»).
    hits.push(...offenders(/(^|[\s(«])(ال)?مشتر(ي|ين|ون)?($|[\s،.؛:)»])/).map((h) => `[مشتري] ${h}`));
    expect(hits).toEqual([]);
  });

  it("the order document is a receipt, not a tax invoice, until Elba's tax registration exists", () => {
    expect(EN["orders.invoice.title"]).toMatch(/Order receipt .*\(not a tax invoice\)/);
    expect(AR["orders.invoice.title"]).toMatch(/إيصال الطلب .*\(ليس فاتورة ضريبية\)/);
    expect(offenders(/Tax invoice/i, EN).filter((h) => !h.includes("not a tax invoice"))).toEqual([]);
  });

  it("“from {price}” reads «ابتداء من» in Arabic (a bare «من {price}» reads as “of”)", () => {
    expect(offenders(/(^|[^ء-ي])من \{(price|qty)(:\w+)?\}/).filter((h) => !/ابتداء من \{/.test(h))).toEqual([]);
  });

  it("English uses curly quotes, not ASCII double quotes", () => {
    expect(offenders(/"/, EN)).toEqual([]);
  });

  it("every box style has an SEO keyword and use line (page titles read them; a gap shows the raw key)", () => {
    const boxes = STRUCTURE_CODES.filter((c) => !["ROLL_LABEL", "PRINTED_POUCH", "PRINTED_TUBE"].includes(c));
    for (const dict of [AR, EN]) {
      expect(boxes.filter((c) => !dict[`store.seo.keyword.${c}`] || !dict[`store.seo.use.${c}`])).toEqual([]);
    }
  });

});

/** Page-local marketing copy (each page's copy.ts) follows the same rules as the dictionaries. */
describe("marketing page copy (copy.ts)", () => {
  const pages: [string, unknown][] = [
    ["home", homeCopy("ar")],
    ["start", startCopy("ar")],
    ["why", whyCopy("ar")],
    ["designer-page", designerPageCopy("ar")],
  ];
  const strings = (o: unknown, p: string, out: [string, string][] = []): [string, string][] => {
    if (typeof o === "string") out.push([p, o]);
    else if (Array.isArray(o)) o.forEach((v, i) => strings(v, `${p}.${i}`, out));
    else if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) strings(v, `${p}.${k}`, out);
    return out;
  };
  const all = pages.flatMap(([name, tree]) => strings(tree, name));
  const bad = (re: RegExp) => all.filter(([, v]) => re.test(v)).map(([k, v]) => `${k}: ${v}`);

  it("has no diacritics or tatweel, and uses Western digits", () => {
    expect(bad(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640\u0660-\u0669]/)).toEqual([]);
  });

  it("keeps the glossary terms", () => {
    const banned = /أونلاين|موبايل|كود|فاتورة|مقوى|موثق|موثوق|علبة شحن|علب شحن|صندوق شحن|صناديق|قالب قص|قالب القص|أنماط العلب|موديل|يرجى|الرجاء/;
    expect(bad(banned)).toEqual([]);
  });

  it("writes a starting price as «ابتداء من»", () => {
    expect(bad(/(^|[^ء-ي])من \{price\}/).filter((h) => !/ابتداء من \{price\}/.test(h))).toEqual([]);
  });
});
