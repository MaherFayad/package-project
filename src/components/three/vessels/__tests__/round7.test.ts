import { describe, expect, it } from "vitest";
import type { BufferGeometry, MeshStandardMaterial } from "three";
import { MODELS, type VesselModelDef } from "@/lib/library";
import type { ClosureKind, VesselDims, VesselKind } from "@/lib/vessels";
import { buildClosure, type ClosureModel, type ClosureStyle } from "../closures";
import { createLiquidMaterial } from "../materials";

const model = (code: string) => MODELS.find((m) => m.code === code) as VesselModelDef;
function built(code: string, closure: string, size: "def" | "min" = "def"): { c: ClosureModel; profile: { finishR: number; finishTopY: number; outer: { r: number; y: number }[] }; dims: VesselDims } {
  const m = model(code);
  const preset = m.presets.find((p) => p.id === m.defaultPresetId)!;
  // "min": the smallest preset (a valid D × H pair), narrowed to the D limit when it allows
  const small = [...m.presets].sort((a, b) => a.dims.H - b.dims.H)[0];
  const dims: VesselDims = size === "min" ? { ...small.dims, D: Math.max(m.limits.D.min, Math.min(small.dims.D, m.limits.D.min)), ...(m.limits.G ? { G: m.limits.G.min } : {}) } : preset.dims;
  const opt = m.closures.find((c) => c.code === closure)!;
  const profile = (m.describe as (...a: unknown[]) => ReturnType<typeof m.describe>)(dims, [], size === "min" ? undefined : preset.id, undefined, undefined, closure).profile!;
  return { c: buildClosure(m.coreKind as VesselKind, opt.core as ClosureKind, dims, profile, (opt.closureStyle ?? null) as ClosureStyle | null), profile: profile as never, dims };
}
const maxR = (g: BufferGeometry) => {
  const p = g.getAttribute("position");
  let r = 0;
  for (let i = 0; i < p.count; i++) r = Math.max(r, Math.hypot(p.getX(i), p.getZ(i)));
  return r;
};
const minY = (g: BufferGeometry) => {
  const p = g.getAttribute("position");
  let y = Infinity;
  for (let i = 0; i < p.count; i++) y = Math.min(y, p.getY(i));
  return y;
};

describe("round 7 engine (R6-3Q rows)", () => {
  it("F-06: a twist-off lid is ~ its nominal size (finish + ≤ 1 mm a side), not 4 mm wider", () => {
    const { c, profile } = built("JAR_GLASS_JAM", model("JAR_GLASS_JAM").defaultClosure);
    expect(maxR(c.parts[0].geometry) - profile.finishR).toBeLessThanOrEqual(1.0);
  });

  it("F-08: the sparkling foil hood is 28 % of the bottle, 45–85 mm", () => {
    for (const size of ["def", "min"] as const) {
      const { c, profile, dims } = built("BTL_GLASS_SPARKLING", "SPARKLING_CORK", size);
      const depth = profile.finishTopY - minY(c.parts[0].geometry);
      expect(depth).toBeGreaterThanOrEqual(45 - 0.5);
      expect(depth).toBeLessThanOrEqual(Math.min(85, Math.max(45, 0.28 * dims.H)) + 0.5);
    }
  });

  it("G-04: the treatment pump is a small actuator under a clear overcap, never wider than the bottle at min", () => {
    for (const size of ["def", "min"] as const) {
      const { c, profile } = built("COS-SERUM", "TREATMENT_PUMP", size);
      const roles = c.parts.map((p) => p.role);
      expect(roles).toContain("clear");
      const body = Math.max(...profile.outer.map((q) => q.r));
      const statics = c.parts.filter((p) => p.group === "static" && p.role !== "dark");
      // collar + head (spout excluded: it sticks out by design, ≤ 8 mm)
      expect(maxR(statics[0].geometry)).toBeLessThanOrEqual(body + 0.01);
      expect(maxR(statics[1].geometry)).toBeLessThanOrEqual(8.01);
    }
  });

  it("G-05 / G-06: vial flip-off and dropper collar stay within the body at min", () => {
    const v = built("PH-VIAL", "CRIMP_FLIP_OFF", "min");
    const body = Math.max(...v.profile.outer.map((q) => q.r));
    for (const p of v.c.parts) expect(maxR(p.geometry)).toBeLessThanOrEqual(Math.max(body, v.profile.finishR + 0.45) + 0.01);
    // the DIN 18 finish (R ≈ 9.35) is itself as wide as a 5 ml body: the collar hugs the finish
    // (+ 0.6, Ø ≈ 20 like the real collar) instead of + 1.7, and never past the body otherwise
    const d = built("COS-DROPPER", "DROPPER", "min");
    const dBody = Math.max(...d.profile.outer.map((q) => q.r));
    expect(maxR(d.c.parts[0].geometry)).toBeLessThanOrEqual(Math.max(dBody, d.profile.finishR + 0.6 + 0.45) + 0.01);
    expect(maxR(d.c.parts[0].geometry)).toBeLessThan(d.profile.finishR + 1.7 + 0.45);
  });

  it("F-07: clear products are see-through without transmission (phones) and on the semi-clear path", () => {
    const water = createLiquidMaterial("WATER", "low", []) as MeshStandardMaterial;
    const perfume = createLiquidMaterial("PERFUME", "low", []) as MeshStandardMaterial;
    const honey = createLiquidMaterial("HONEY", "high", []) as MeshStandardMaterial;
    const cream = createLiquidMaterial("CREAM", "low", []) as MeshStandardMaterial;
    expect(water.transparent && water.opacity < 0.15).toBe(true);
    expect(perfume.transparent && perfume.opacity < 0.15).toBe(true);
    expect(honey.transparent && honey.opacity > 0.2 && honey.opacity < 0.5).toBe(true);
    expect(cream.transparent).toBe(false);
    for (const m of [water, perfume, honey, cream]) m.dispose();
  });
});

describe("round 7 engine: treatment pump overcap (R6-3Q-G-04, spec r = finishR + 1.5)", () => {
  it("the clear overcap is finishR + 1.5 and covers the spout tip, at default and min", () => {
    for (const size of ["def", "min"] as const) {
      const { c, profile } = built("COS-SERUM", "TREATMENT_PUMP", size);
      const over = c.parts.find((p) => p.role === "clear")!;
      expect(maxR(over.geometry)).toBeCloseTo(profile.finishR + 1.5, 1);
      const tip = c.parts.find((p) => p.role === "dark")!;
      expect(maxR(tip.geometry)).toBeLessThanOrEqual(profile.finishR + 1.5);
    }
  });
});

describe("R7-3Q-L-01: brush cap on the neck, bullet overcap flush", () => {
  const minYOf = (g: BufferGeometry) => minY(g);
  for (const size of ["def", "min"] as const) {
    it(`COS-NAIL-POLISH brush cap (${size}): ≤ 0.62 × the bottle wide, skirt only over the finish`, () => {
      const { c, profile } = built("COS-NAIL-POLISH", "BRUSH_CAP", size);
      const p = profile as typeof profile & { finishH: number };
      const cap = c.parts[0].geometry;
      const body = Math.max(...p.outer.map((q) => q.r));
      const R = maxR(cap);
      // diameter: wider than the finish, at most ~0.62 of the bottle (it was the full body width)
      expect(R).toBeGreaterThan(p.finishR);
      expect(R).toBeLessThanOrEqual(Math.max(p.finishR + 1, 0.62 * body) + 0.01);
      // skirt depth: from the finish top down over the finish only (it reached 55 % of the cap
      // height below the top, over the shoulder)
      expect(p.finishTopY - minYOf(cap)).toBeLessThanOrEqual(p.finishH + 0.6 + 0.01);
    });
  }
  it("lip gloss / mascara bullet overcaps stay flush with their body (R5-3Q-G-02 unchanged)", () => {
    const { c, profile } = built("COS-LIP-GLOSS", "WAND_CAP");
    const body = Math.max(...profile.outer.map((q) => q.r));
    expect(maxR(c.parts[0].geometry)).toBeGreaterThanOrEqual(body);
  });
});
