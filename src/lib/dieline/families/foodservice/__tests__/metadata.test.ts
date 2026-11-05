import { describe, expect, it } from "vitest";
import { DEFINITIONS, FOODSERVICE_CODES, FOOD_MATERIALS } from "..";

const DIACRITICS = /[ً-ْٰ]/;
const LATIN = /[A-Za-z]/;

const within = (v: number, r: { min: number; max: number }) => v >= r.min - 1e-9 && v <= r.max + 1e-9;

describe("foodservice definitions: metadata", () => {
  it("covers every code exactly once, unique slugs", () => {
    expect(DEFINITIONS.map((d) => d.code).sort()).toEqual([...FOODSERVICE_CODES].sort());
    const slugs = DEFINITIONS.map((d) => d.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9-]+$/);
  });

  it.each(DEFINITIONS.map((d) => [d.code, d] as const))("%s: names, standard, materials, uses", (_c, d) => {
    for (const t of [d.name.ar, d.description.ar]) {
      expect(t).not.toMatch(DIACRITICS);
      expect(t).not.toMatch(LATIN);
      expect(t.length).toBeGreaterThan(3);
    }
    expect(d.name.en.length).toBeGreaterThan(3);
    expect(d.description.en.length).toBeGreaterThan(10);
    expect(d.standard.length).toBeGreaterThan(0);
    expect(d.materials.length).toBeGreaterThan(0);
    expect(d.materials).toContain(d.defaultMaterial);
    for (const m of d.materials) expect(FOOD_MATERIALS[m]).toBeDefined();
    expect(d.uses.length).toBeGreaterThan(0);
    expect(d.subFamily.length).toBeGreaterThan(0);
  });

  it.each(DEFINITIONS.map((d) => [d.code, d] as const))("%s: presets (2-5) and default inside the limits", (_c, d) => {
    // 2-4 presets everywhere; the inch pizza box carries the five standard sizes 8-16 in.
    expect(d.presets.length).toBeGreaterThanOrEqual(2);
    expect(d.presets.length).toBeLessThanOrEqual(d.code === "FS_PIZZA_ROUND" ? 5 : 4);
    const limits: Record<string, { min: number; max: number }> = d.kind === "dieline" ? { L: d.params.L, W: d.params.W, H: d.params.H } : (d.limits as Record<string, { min: number; max: number }>);
    const all = [d.defaultDims, ...d.presets.map((p) => p.dims)] as unknown as Record<string, number>[];
    for (const dims of all) for (const k of Object.keys(limits)) expect(within(dims[k], limits[k]), `${k}=${dims[k]}`).toBe(true);
    const ids = d.presets.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of d.presets) {
      expect(p.name.ar).not.toMatch(DIACRITICS);
      expect(p.name.ar).not.toMatch(LATIN);
    }
  });
});
