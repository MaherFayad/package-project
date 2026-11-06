import { describe, expect, it } from "vitest";
import {
  DEFINITIONS,
  FLEXIBLE_CODES,
  FLEX_BLEED_MM,
  buildFlexibleGroup,
  buildFlexibleModel,
  defaultFlexConfig,
  definitionFor,
  flexConfigSchema,
  headerHeight,
  parseFlexConfig,
  printLayout,
  safeParseFlexConfig,
  solveShape,
  stripLength,
  type FlexConfig,
  type FlexOptions,
} from "..";

const DIACRITICS = /[ً-ْٰ]/;

function allOptionsOn(code: (typeof FLEXIBLE_CODES)[number]): Partial<FlexOptions> {
  const def = definitionFor(code);
  const o: Partial<FlexOptions> = {};
  for (const k of def.allowedOptions) {
    if (k === "spout") o.spout = code === "FLEX_BAG_IN_BOX" ? "front" : "corner";
    else if (k === "hangHole") o.hangHole = "round";
    else (o as Record<string, boolean>)[k] = true;
  }
  // a corner spout and a hang hole share the header; keep one
  if (o.spout === "corner") o.hangHole = "none";
  return o;
}

function finiteAttr(arr: ArrayLike<number>) {
  for (let i = 0; i < arr.length; i++) if (!Number.isFinite(arr[i])) return false;
  return true;
}

function configsFor(code: (typeof FLEXIBLE_CODES)[number]): FlexConfig[] {
  const def = definitionFor(code);
  const out: FlexConfig[] = [];
  const material = def.materials.find((m) => m !== "FILM_METALLISED") ?? def.defaultMaterial;
  for (const p of def.presets)
    for (const fill of [0, 0.5, 1]) {
      out.push(parseFlexConfig({ code, dims: p.dims, fill, material: def.defaultMaterial }));
      out.push(parseFlexConfig({ code, dims: p.dims, fill, material, options: allOptionsOn(code) }));
    }
  return out;
}

describe("flexible catalogue metadata", () => {
  it("has 15 unique styles with bilingual names and no Arabic diacritics", () => {
    expect(DEFINITIONS).toHaveLength(15);
    expect(new Set(DEFINITIONS.map((d) => d.code)).size).toBe(15);
    expect(new Set(DEFINITIONS.map((d) => d.slug)).size).toBe(15);
    for (const d of DEFINITIONS) {
      expect(FLEXIBLE_CODES).toContain(d.code);
      for (const t of [d.name, d.description, ...d.typicalUses, ...d.presets.map((p) => p.name)]) {
        expect(t.ar.length).toBeGreaterThan(1);
        expect(t.en.length).toBeGreaterThan(1);
        expect(DIACRITICS.test(t.ar)).toBe(false);
      }
      expect(d.presets.length).toBeGreaterThanOrEqual(2);
      expect(d.presets.length).toBeLessThanOrEqual(4);
      expect(d.materials).toContain(d.defaultMaterial);
      expect(d.family).toBe("FLEXIBLE");
    }
  });

  it("default dims and every preset pass their own limits", () => {
    for (const d of DEFINITIONS) {
      expect(() => defaultFlexConfig(d.code)).not.toThrow();
      for (const p of d.presets) expect(safeParseFlexConfig({ code: d.code, dims: p.dims }).success, `${d.code} ${p.id}`).toBe(true);
    }
  });
});

describe("limits (zod)", () => {
  it("rejects out-of-range sizes", () => {
    const r = safeParseFlexConfig({ code: "FLEX_STAND_UP_POUCH", dims: { W: 40, H: 230, G: 80 } });
    expect(r.success).toBe(false);
    expect(safeParseFlexConfig({ code: "FLEX_STICK_PACK", dims: { W: 80, H: 120 } }).success).toBe(false);
  });
  it("requires the gusset where the style has one", () => {
    expect(safeParseFlexConfig({ code: "FLEX_FLAT_BOTTOM_POUCH", dims: { W: 125, H: 195 } }).success).toBe(false);
  });
  it("enforces construction rules", () => {
    expect(safeParseFlexConfig({ code: "FLEX_QUAD_SEAL_BAG", dims: { W: 90, H: 300, G: 120 } }).success).toBe(false);
    expect(safeParseFlexConfig({ code: "FLEX_STAND_UP_POUCH", dims: { W: 120, H: 200, G: 100 } }).success).toBe(false);
    expect(safeParseFlexConfig({ code: "FLEX_STAND_UP_POUCH", dims: { W: 160, H: 230, G: 80 }, material: "FILM_METALLISED", options: { window: true } }).success).toBe(false);
    expect(safeParseFlexConfig({ code: "FLEX_PILLOW_BAG", dims: { W: 180, H: 260 }, options: { zipper: true } }).success).toBe(false);
    expect(safeParseFlexConfig({ code: "FLEX_MAILER_BAG", dims: { W: 250, H: 350 }, material: "FILM_CLEAR" }).success).toBe(false);
    expect(safeParseFlexConfig({ code: "FLEX_SACHET", dims: { W: 70, H: 100 }, fill: 1.5 }).success).toBe(false);
  });
  it("exposes a per-style schema", () => {
    const s = flexConfigSchema("FLEX_RETORT_POUCH");
    expect(s.safeParse({ code: "FLEX_RETORT_POUCH", dims: { W: 130, H: 200 } }).success).toBe(true);
  });
  it("grows the header for a hang hole", () => {
    expect(headerHeight("FLEX_FLAT_POUCH", { hangHole: "euro" })).toBeGreaterThan(definitionFor("FLEX_FLAT_POUCH").construction.seals.top);
    expect(headerHeight("FLEX_FLAT_POUCH", { hangHole: "none" })).toBe(10);
  });
});

describe("filled shapes", () => {
  for (const code of FLEXIBLE_CODES) {
    it(`${code}: no NaN, closed dimensions match the flat film`, () => {
      for (const cfg of configsFor(code)) {
        const shape = solveShape(cfg);
        const def = definitionFor(code);
        const c = def.construction;
        const { W, H } = cfg.dims;
        for (const r of shape.rows) {
          expect(Number.isFinite(r.y)).toBe(true);
          for (const s of r.strips) for (const p of s.pts) expect(Number.isFinite(p.x) && Number.isFinite(p.z) && Number.isFinite(p.s)).toBe(true);
        }
        expect(Number.isFinite(shape.volumeMl)).toBe(true);
        const mid = shape.rows[Math.floor(shape.rows.length / 2)];
        const front = mid.strips.find((s) => s.panel === "front" || s.panel === "sleeve")!;
        if (c.model === "pillow" || c.model === "standup") {
          const Wi = W - 2 * c.seals.side;
          expect(Math.abs(stripLength(front) - Wi) / Wi).toBeLessThan(0.01);
          // centre line keeps the flat inner height
          let L = 0;
          for (let i = 1; i < shape.rows.length; i++) {
            const a = shape.rows[i - 1];
            const b = shape.rows[i];
            const za = a.strips[0].pts[Math.floor(a.strips[0].pts.length / 2)].z;
            const zb = b.strips[0].pts[Math.floor(b.strips[0].pts.length / 2)].z;
            L += Math.hypot(b.y - a.y, zb - za);
          }
          const Hi = H - shape.seals.top - shape.seals.bottom;
          expect(Math.abs(L - Hi) / Hi).toBeLessThan(0.02);
          expect(shape.envelope.height <= Math.max(W, H) + 1e-6).toBe(true);
        }
        if (c.model === "box") {
          expect(Math.abs(stripLength(front) - W) / W).toBeLessThan(0.01);
          const g = mid.strips.find((s) => s.panel === "gussetRight")!;
          expect(stripLength(g)).toBeCloseTo(cfg.dims.G!, 3);
          expect(shape.envelope.height).toBeLessThanOrEqual(H + 1e-6);
        }
        if (c.model === "sleeve") {
          const bottomRow = shape.rows[0].strips[0];
          expect(Math.abs(stripLength(bottomRow) - 2 * W * (1 - cfg.fill * 0.02)) / (2 * W)).toBeLessThan(0.01);
          expect(shape.envelope.height).toBeLessThanOrEqual(H + 1e-6);
        }
        if (cfg.fill > 0 && c.model !== "sleeve") expect(shape.envelope.depth).toBeGreaterThan(0.5);
      }
    });
  }

  it("fill changes the bulge and the volume", () => {
    for (const code of FLEXIBLE_CODES) {
      if (code === "FLEX_SHRINK_SLEEVE") continue;
      const def = definitionFor(code);
      const v = [0.1, 0.5, 1].map((fill) => solveShape(parseFlexConfig({ code, dims: def.defaultDims, fill })));
      expect(v[1].volumeMl, code).toBeGreaterThan(v[0].volumeMl);
      expect(v[2].volumeMl, code).toBeGreaterThan(v[1].volumeMl);
      expect(v[2].envelope.depth, code).toBeGreaterThan(v[0].envelope.depth);
    }
  });

  it("pillow volume is in a plausible range for a 250 g doypack and a 3 l bladder", () => {
    const doy = solveShape(defaultFlexConfig("FLEX_STAND_UP_POUCH", "sup-250g"));
    expect(doy.volumeMl).toBeGreaterThan(400);
    expect(doy.volumeMl).toBeLessThan(1600);
    const bib = solveShape(parseFlexConfig({ code: "FLEX_BAG_IN_BOX", dims: { W: 270, H: 330 }, fill: 1 }));
    expect(bib.volumeMl).toBeGreaterThan(1800);
    expect(bib.volumeMl).toBeLessThan(5000);
  });

  it("an empty flat pouch has no volume and pinches in when filled", () => {
    const empty = solveShape(parseFlexConfig({ code: "FLEX_FLAT_POUCH", dims: { W: 150, H: 200 }, fill: 0 }));
    expect(empty.volumeMl).toBeLessThan(1);
    const full = solveShape(parseFlexConfig({ code: "FLEX_FLAT_POUCH", dims: { W: 150, H: 200 }, fill: 1 }));
    const mid = full.rows[24].strips[0].pts;
    expect(mid[mid.length - 1].x - mid[0].x).toBeLessThan(150 - 16 - 5);
    expect(full.bodyTopY).toBeLessThan(empty.bodyTopY);
  });

  it("flow wrap lies with its long axis along X", () => {
    const s = solveShape(defaultFlexConfig("FLEX_FLOW_WRAP"));
    expect(s.envelope.width).toBeGreaterThan(s.envelope.height);
  });
});

describe("print layout", () => {
  for (const code of FLEXIBLE_CODES) {
    it(`${code}: bleed, safe zone and area math`, () => {
      const def = definitionFor(code);
      const cfg = parseFlexConfig({ code, dims: def.defaultDims, material: def.materials.find((m) => m !== "FILM_METALLISED"), options: allOptionsOn(code) });
      const L = printLayout(cfg);
      expect(L.panels.map((p) => p.id).sort()).toEqual([...def.panels].sort());
      let sum = 0;
      for (const p of L.panels) {
        expect(p.bleedMm).toBe(FLEX_BLEED_MM);
        expect(p.printWidthMm).toBeCloseTo(p.trimWidthMm + 2 * FLEX_BLEED_MM, 5);
        expect(p.printHeightMm).toBeCloseTo(p.trimHeightMm + 2 * FLEX_BLEED_MM, 5);
        expect(p.trimAreaM2).toBeCloseTo((p.trimWidthMm * p.trimHeightMm) / 1e6, 6);
        sum += p.trimAreaM2;
        // safe rect inside the trim by at least the safe margin
        const s = p.safeRect;
        expect(s.x).toBeGreaterThanOrEqual(p.bleedMm + p.safeMm - 1e-6);
        expect(s.y).toBeGreaterThanOrEqual(p.bleedMm + p.safeMm - 1e-6);
        expect(s.x + s.w).toBeLessThanOrEqual(p.bleedMm + p.trimWidthMm - p.safeMm + 1e-6);
        expect(s.y + s.h).toBeLessThanOrEqual(p.bleedMm + p.trimHeightMm - p.safeMm + 1e-6);
        // safe rect clear of every seal band
        for (const seal of p.seals) {
          const overlap = Math.max(0, Math.min(s.x + s.w, seal.x + seal.w) - Math.max(s.x, seal.x)) * Math.max(0, Math.min(s.y + s.h, seal.y + seal.h) - Math.max(s.y, seal.y));
          expect(overlap, `${code} ${p.id}`).toBe(0);
        }
        if (p.window) {
          expect(p.window.x).toBeGreaterThanOrEqual(p.bleedMm);
          expect(p.window.x + p.window.w).toBeLessThanOrEqual(p.bleedMm + p.trimWidthMm);
        }
      }
      expect(L.totalTrimAreaM2).toBeCloseTo(sum, 9);
      expect(L.blank.areaM2).toBeGreaterThanOrEqual(L.totalTrimAreaM2 - 1e-9);
    });
  }

  it("front panel of a 250 g doypack is W x H, bottom gusset W x G", () => {
    const L = printLayout(defaultFlexConfig("FLEX_STAND_UP_POUCH", "sup-250g"));
    const f = L.panels.find((p) => p.id === "front")!;
    expect([f.trimWidthMm, f.trimHeightMm, f.printWidthMm, f.printHeightMm]).toEqual([160, 230, 166, 236]);
    const b = L.panels.find((p) => p.id === "bottom")!;
    expect([b.trimWidthMm, b.trimHeightMm]).toEqual([160, 80]);
    expect(L.blank.lengthMm).toBe(2 * 230 + 80);
  });

  it("centre-seal film width = 2W + 2 fin", () => {
    const L = printLayout(defaultFlexConfig("FLEX_PILLOW_BAG"));
    expect(L.blank.widthMm).toBe(2 * 180 + 2 * 10);
    expect(L.panels.find((p) => p.id === "back")!.keepOut.some((k) => k.kind === "fin")).toBe(true);
  });

  it("shrink sleeve flat width = circumference + seam", () => {
    const L = printLayout(defaultFlexConfig("FLEX_SHRINK_SLEEVE"));
    expect(L.panels[0].trimWidthMm).toBe(2 * 105 + 6);
  });
});

describe("three.js geometry", () => {
  for (const code of FLEXIBLE_CODES) {
    it(`${code}: finite attributes, UVs in range, outward front face`, () => {
      for (const cfg of configsFor(code).filter((_, i) => i % 3 !== 1)) {
        const m = buildFlexibleModel(cfg);
        expect(m.parts.length).toBeGreaterThan(0);
        for (const part of m.parts) {
          const pos = part.geometry.getAttribute("position");
          expect(pos.count, part.id).toBeGreaterThan(2);
          expect(finiteAttr(pos.array as Float32Array), `${code} ${part.id} pos`).toBe(true);
          const n = part.geometry.getAttribute("normal");
          if (n) expect(finiteAttr(n.array as Float32Array), `${code} ${part.id} normal`).toBe(true);
          const uv = part.geometry.getAttribute("uv");
          if (uv && (part.role === "face" || part.role === "seal" || part.role === "base")) {
            const a = uv.array as Float32Array;
            expect(finiteAttr(a)).toBe(true);
            // same bound on every component, checked in one assertion (thousands of expect() calls timed out)
            let lo = Infinity;
            let hi = -Infinity;
            for (let i = 0; i < a.length; i++) {
              lo = Math.min(lo, a[i]);
              hi = Math.max(hi, a[i]);
            }
            expect(lo, `${code} ${part.id}`).toBeGreaterThanOrEqual(-1e-3);
            expect(hi, `${code} ${part.id}`).toBeLessThanOrEqual(1 + 1e-3);
          }
        }
        const face = m.parts.find((p) => p.id === "face-front" || p.id === "face-sleeve")!;
        const nrm = face.geometry.getAttribute("normal");
        const pos = face.geometry.getAttribute("position");
        let dot = 0;
        for (let i = 0; i < nrm.count; i++) dot += nrm.getX(i) * pos.getX(i) + nrm.getZ(i) * pos.getZ(i);
        if (cfg.fill > 0 || code === "FLEX_SHRINK_SLEEVE") expect(dot, code).toBeGreaterThan(0);
      }
    });
  }

  it("adds parts for options", () => {
    const m = buildFlexibleModel(parseFlexConfig({ code: "FLEX_STAND_UP_POUCH", dims: { W: 160, H: 230, G: 80 }, material: "FILM_KRAFT_LAMINATE", options: { zipper: true, spout: "corner", window: true, valve: true } }));
    const ids = m.parts.map((p) => p.id);
    expect(ids).toContain("zipper-front");
    expect(ids).toContain("spout-cap");
    expect(ids).toContain("valve");
    expect(ids).toContain("base");
    expect(m.windowUv).toBeDefined();
    const coffee = buildFlexibleModel(defaultFlexConfig("FLEX_SIDE_GUSSET_BAG"));
    expect(coffee.parts.map((p) => p.id)).toEqual(expect.arrayContaining(["fin-back", "tin-tie", "valve", "face-gussetLeft", "base-front"]));
    const quad = buildFlexibleModel(defaultFlexConfig("FLEX_QUAD_SEAL_BAG"));
    expect(quad.parts.filter((p) => p.id.startsWith("fin-corner"))).toHaveLength(4);
    const euro = buildFlexibleModel(parseFlexConfig({ code: "FLEX_FLAT_POUCH", dims: { W: 150, H: 200 }, options: { hangHole: "euro", roundCorners: true } }));
    const top = euro.parts.find((p) => p.id === "seal-top-front")!.geometry.getAttribute("position");
    expect(top.count).toBeGreaterThan(20);
    const mailer = buildFlexibleModel(defaultFlexConfig("FLEX_MAILER_BAG"));
    expect(mailer.parts.map((p) => p.id)).toContain("flap");
  });

  it("builds a scaled three.js group", () => {
    const { group, model } = buildFlexibleGroup(defaultFlexConfig("FLEX_PILLOW_BAG"));
    expect(group.children.length).toBe(model.parts.length);
    expect(group.scale.x).toBeCloseTo(0.001);
  });
});
