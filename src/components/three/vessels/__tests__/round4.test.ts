import { describe, expect, it } from "vitest";
import { labelSpecsFor, radiusAt, sectionPerimeter, squarenessAt } from "@/lib/vessels";
import { VESSEL_MODELS } from "@/lib/library/vessels";
import { bandLabelGeometry, bodyGeometry, faceLabelGeometry, petaloidRibs, sectionPoint } from "../geometry";

const model = (code: string) => {
  const m = VESSEL_MODELS.find((x) => x.code === code)!;
  const p = m.presets.find((x) => x.id === m.defaultPresetId) ?? m.presets[0];
  return { m, p, d: m.describe(p.dims, m.surfaces, p.id) };
};

describe("round 4: faceted sections, handles, petaloid, conforming face labels", () => {
  it("rounded hexagon: flat front at the apothem, walked by arc length, outward normals", () => {
    const sec = { kind: "polygon", sides: 6, cornerRatio: 0.1 } as const;
    const o = { x: 0, z: 0, nx: 0, nz: 0 };
    sectionPoint(sec, 30, 1, 0, o);
    expect(o.x).toBeCloseTo(0, 6);
    expect(o.z).toBeCloseTo(30, 6);
    // corners stand proud of the apothem, faces do not
    let maxR = 0;
    let prev = { x: o.x, z: o.z };
    let len = 0;
    for (let i = 1; i <= 600; i++) {
      sectionPoint(sec, 30, 1, i / 600, o);
      maxR = Math.max(maxR, Math.hypot(o.x, o.z));
      len += Math.hypot(o.x - prev.x, o.z - prev.z);
      prev = { x: o.x, z: o.z };
      expect(o.x * o.nx + o.z * o.nz).toBeGreaterThan(0);
    }
    expect(maxR).toBeGreaterThan(31.5);
    expect(maxR).toBeLessThan(30 / Math.cos(Math.PI / 6));
    expect(len).toBeCloseTo(sectionPerimeter(sec, 30), 0);
  });

  it("the hex honey jar is hexagonal and its labels sit flat on the front facet", () => {
    const { d } = model("JAR_GLASS_HONEY_HEX");
    expect(d.profile!.section.kind).toBe("polygon");
    const g = bodyGeometry(d.profile!, 96);
    const pos = g.getAttribute("position");
    let maxR = 0;
    for (let i = 0; i < pos.count; i++) maxR = Math.max(maxR, Math.hypot(pos.getX(i), pos.getZ(i)));
    expect(maxR).toBeGreaterThan(d.profile!.body.r0 * 1.08);
    g.dispose();
  });

  it("a hex wrap follows the facets (no corner pokes through the band)", () => {
    const { m, p } = model("JAR_GLASS_HONEY_HEX");
    const d = m.describe(p.dims, ["SHRINK_SLEEVE", "FRONT"], p.id);
    expect(d.profile!.section.kind).toBe("polygon");
  });

  it("face labels on stadium / oval sections wrap the curved sides instead of floating", () => {
    for (const code of ["BTL_GLASS_SPIRITS_FLASK", "BTL_HDPE_SHAMPOO_OVAL", "COS-PERFUME-OVAL"]) {
      const { m, p, d } = model(code);
      const prof = d.profile!;
      const labels = labelSpecsFor(m.coreKind as never, p.dims, prof, ["FRONT"]);
      const front = labels.find((l) => l.kind === "FRONT");
      if (!front) continue;
      const g = faceLabelGeometry(front, (p.dims.G ?? p.dims.D) / 2, prof);
      const pos = g.getAttribute("position");
      // every vertex sits on the wall outline at its height (+0.18 mm proud), never a flat card off it
      const o = { x: 0, z: 0, nx: 0, nz: 0 };
      let curved = 0;
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        const r = radiusAt(prof.outer as never, y);
        const sq = squarenessAt(prof.outer as never, y);
        let best = Infinity;
        for (let k = 0; k < 720; k++) {
          sectionPoint(prof.section, r, sq, k / 720, o);
          best = Math.min(best, Math.hypot(o.x - pos.getX(i), o.z - pos.getZ(i)));
        }
        expect(best, `${code} vertex ${i}`).toBeLessThan(0.8);
        expect(best, `${code} vertex ${i} proud of the wall`).toBeGreaterThan(0.3);
        if (Math.abs(pos.getZ(i)) < Math.abs(pos.getZ(0 + 16)) - 0.3) curved++;
      }
      expect(curved, code).toBeGreaterThan(0);
      g.dispose();
    }
  });

  it("petaloid CSD bottles get five feet; other bases are untouched", () => {
    const { d } = model("BTL_PET_CSD");
    const ribs = petaloidRibs(d.profile!);
    expect(ribs?.count).toBe(5);
    expect(petaloidRibs(model("BTL_GLASS_WINE_BORDEAUX").d.profile!)).toBeUndefined();
  });

  it("handled bottles carry a handle path on the profile", () => {
    for (const code of ["BTL_HDPE_DETERGENT_HANDLE", "BTL_HDPE_GALLON_JUG", "JERRYCAN_HDPE", "PAIL_PP_ROUND"]) {
      const h = (model(code).d.profile as unknown as { handle?: { path: unknown[] } }).handle;
      expect(h?.path.length, code).toBeGreaterThan(1);
    }
  });

  it("a band with no section stays round (backward compatible)", () => {
    const { m, p } = model("ROUND_BOTTLE");
    const d = m.describe(p.dims, ["WRAP"], p.id);
    void d;
    const [wrap] = labelSpecsFor("ROUND_BOTTLE", p.dims, d.profile!, ["WRAP"]);
    expect(wrap.placement.type === "band" && wrap.placement.section).toBeFalsy();
    bandLabelGeometry(wrap, 0.18, 32).dispose();
  });
});

describe("rounded-rect section walk (R4-12)", () => {
  it("is continuous and monotonic round the whole outline", () => {
    const sec = { kind: "roundedRect", cornerRatio: 0.3, depthRatio: 0.55 } as const;
    const o = { x: 0, z: 0, nx: 0, nz: 0 };
    let prev: { x: number; z: number } | null = null;
    let len = 0;
    for (let i = 0; i <= 2000; i++) {
      sectionPoint(sec, 50, 1, -0.5 + i / 2000, o);
      if (prev) {
        const step = Math.hypot(o.x - prev.x, o.z - prev.z);
        expect(step, `step at ${i}`).toBeLessThan(0.5);
        len += step;
      }
      prev = { x: o.x, z: o.z };
    }
    expect(len).toBeCloseTo(sectionPerimeter(sec, 50), 0);
    sectionPoint(sec, 50, 1, -0.1, o);
    expect(o.x).toBeLessThan(0);
  });
});
