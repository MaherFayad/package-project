import { describe, expect, it } from "vitest";
import { fill, startCopy } from "../copy";

type Tree = string | readonly string[] | { [k: string]: Tree };
const leaves = (t: Tree, path = ""): [string, string][] =>
  typeof t === "string" ? [[path, t]] : Array.isArray(t) ? t.map((v, i) => [`${path}.${i}`, v] as [string, string]) : Object.entries(t).flatMap(([k, v]) => leaves(v as Tree, path ? `${path}.${k}` : k));

describe("/start copy", () => {
  const ar = leaves(startCopy("ar") as unknown as Tree);
  const en = leaves(startCopy("en") as unknown as Tree);

  it("has the same keys and placeholders in both locales", () => {
    expect(ar.map(([k]) => k)).toEqual(en.map(([k]) => k));
    const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
    for (let i = 0; i < ar.length; i++) expect(ph(ar[i][1]), ar[i][0]).toEqual(ph(en[i][1]));
  });

  it("writes Arabic without diacritics", () => {
    for (const [k, v] of ar) expect(/[ً-ْٰ]/.test(v), k).toBe(false);
  });

  it("labels the fan as samples and never claims social proof", () => {
    expect(startCopy("en").fan.badge).toBe("Sample");
    expect(startCopy("ar").fan.badge).toBe("نموذج");
    for (const [, v] of en) expect(v).not.toMatch(/customers|reviews|trusted by|every \d+ seconds/i);
  });

  it("fills placeholders", () => {
    expect(fill("From {price} a box", { price: "EGP 1" })).toBe("From EGP 1 a box");
  });
});
