import { describe, expect, it } from "vitest";
import { designerPageCopy, fill } from "../copy";

/** Every string leaf with its path, e.g. ["faq.items.0.q", "…"]. */
function leaves(o: unknown, path = ""): [string, string][] {
  if (typeof o === "string") return [[path, o]];
  if (Array.isArray(o)) return o.flatMap((v, i) => leaves(v, `${path}.${i}`));
  if (o && typeof o === "object") return Object.entries(o).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
  return [];
}

const ar = designerPageCopy("ar");
const en = designerPageCopy("en");
const arLeaves = leaves(ar);
const enLeaves = leaves(en);

describe("designer page copy", () => {
  it("has the same keys, list lengths and placeholders in both languages", () => {
    expect(arLeaves.map(([p]) => p)).toEqual(enLeaves.map(([p]) => p));
    const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");
    const enMap = new Map(enLeaves);
    for (const [p, v] of arLeaves) expect(ph(v), p).toBe(ph(enMap.get(p)!));
  });

  it("writes Arabic without diacritics (tashkeel) or tatweel", () => {
    for (const [p, v] of arLeaves) expect(/[ً-ْٰـ]/.test(v), `${p}: ${v}`).toBe(false);
  });

  it("makes no AI claim (the prompt bar is a search)", () => {
    for (const [p, v] of [...arLeaves, ...enLeaves]) expect(/\bAI\b|ذكاء اصطناعي|الذكاء الاصطناعي/.test(v), p).toBe(false);
  });

  it("has ten FAQ items with an answer each", () => {
    expect(ar.faq.items).toHaveLength(10);
    for (const it of [...ar.faq.items, ...en.faq.items]) {
      expect(it.q.length).toBeGreaterThan(5);
      expect(it.a.length).toBeGreaterThan(20);
    }
  });

  it("fills placeholders and leaves unknown ones visible", () => {
    expect(fill("{price} / box", { price: "EGP 4.20" })).toBe("EGP 4.20 / box");
    expect(fill("{x}", {})).toBe("{x}");
  });
});
