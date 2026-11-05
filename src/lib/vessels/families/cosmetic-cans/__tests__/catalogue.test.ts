import { describe, expect, it } from "vitest";
import { surfaceUv as coreSurfaceUv, type LabelSpec } from "../../../index";
import { radiusAt, sectionPerimeter } from "../../../profile";
import {
  CATALOGUE_FAMILIES,
  CLOSURE_NAMES,
  CORE_KINDS_SKIPPED,
  CORE_KINDS_SUPERSEDED,
  DEFINITIONS,
  DEFINITIONS_BY_CODE,
  DIRECT_BLEED_MM,
  EXTRA_CLOSURE_KINDS,
  EXTRA_MATERIAL_CODES,
  MATERIAL_NAMES,
  buildGeometry,
  catalogueEnvelope,
  clampCatalogueDims,
  describeCatalogueVessel,
  printFlatPoint,
  printUv,
  validateDims,
  type CataloguePrintSurface,
} from "../index";
import { VESSEL_KINDS } from "../../../types";

const ARABIC_DIACRITICS = /[ً-ْٰ]/;
const finite = (n: number) => Number.isFinite(n) && !Number.isNaN(n);

function allNumbers(o: unknown, path = "", out: [string, number][] = []): [string, number][] {
  if (typeof o === "number") out.push([path, o]);
  else if (Array.isArray(o)) o.forEach((v, i) => allNumbers(v, `${path}[${i}]`, out));
  else if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) allNumbers(v, path ? `${path}.${k}` : k, out);
  return out;
}

const every = DEFINITIONS.flatMap((def) => def.presets.map((preset) => ({ def, preset })));

describe("catalogue metadata", () => {
  it("has unique codes and slugs and covers every family", () => {
    expect(new Set(DEFINITIONS.map((d) => d.code)).size).toBe(DEFINITIONS.length);
    expect(new Set(DEFINITIONS.map((d) => d.slug)).size).toBe(DEFINITIONS.length);
    for (const f of CATALOGUE_FAMILIES) expect(DEFINITIONS.some((d) => d.family === f)).toBe(true);
    expect(DEFINITIONS.length).toBeGreaterThanOrEqual(35);
    expect(DEFINITIONS_BY_CODE["CAN-BEVERAGE"].slug).toBe("beverage-can-two-piece");
  });

  it("names are bilingual, Arabic is undiacritised, slugs are kebab-case", () => {
    for (const d of DEFINITIONS) {
      expect(d.code).toMatch(/^[A-Z]{2,4}-[A-Z0-9-]+$/);
      expect(d.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      for (const txt of [d.name, d.description, d.subFamily.name, ...d.typicalUses, ...d.presets.map((p) => p.name)]) {
        expect(txt.en.length).toBeGreaterThan(1);
        expect(txt.ar).toMatch(/[؀-ۿ]/);
        expect(ARABIC_DIACRITICS.test(txt.ar)).toBe(false);
      }
    }
  });

  it("presets: 2 to 7 per model, default exists, sources given, inside limits and valid", () => {
    for (const d of DEFINITIONS) {
      expect(d.presets.length).toBeGreaterThanOrEqual(2);
      expect(d.presets.length).toBeLessThanOrEqual(7);
      expect(d.presets.some((p) => p.id === d.defaultPresetId)).toBe(true);
      expect(d.materials).toContain(d.defaultMaterial);
      expect(d.closures).toContain(d.defaultClosure);
      for (const s of d.defaultSurfaces) expect(d.surfaces).toContain(s);
      expect(d.typicalUses.length).toBeGreaterThanOrEqual(2);
      for (const p of d.presets) {
        expect(p.source.length).toBeGreaterThan(5);
        const r = validateDims(d, p.dims, p.neck);
        expect(r.success, `${d.code}/${p.id}: ${r.success ? "" : r.error.message}`).toBe(true);
      }
    }
  });

  it("every local material and closure code has a bilingual name", () => {
    for (const m of EXTRA_MATERIAL_CODES) expect(MATERIAL_NAMES[m]?.ar).toBeTruthy();
    for (const c of EXTRA_CLOSURE_KINDS) expect(CLOSURE_NAMES[c].en).toBeTruthy();
  });

  it("skipped / superseded core kinds are real core kinds", () => {
    for (const k of [...CORE_KINDS_SKIPPED.map((s) => s.kind), ...CORE_KINDS_SUPERSEDED.map((s) => s.kind)]) expect(VESSEL_KINDS).toContain(k);
    for (const s of CORE_KINDS_SUPERSEDED) expect(DEFINITIONS_BY_CODE[s.by]).toBeTruthy();
  });

  it("standards cited where the geometry follows one", () => {
    expect(DEFINITIONS_BY_CODE["PH-VIAL"].standard).toMatch(/ISO 8362-1/);
    expect(DEFINITIONS_BY_CODE["PH-AMPOULE"].standard).toMatch(/ISO 9187-1/);
    expect(DEFINITIONS_BY_CODE["PH-PILL-CR"].standard).toMatch(/ISO 8317/);
    expect(DEFINITIONS_BY_CODE["CAN-FOOD-3PC"].standard).toMatch(/ISO 1361/);
  });
});

describe("limits (zod)", () => {
  it("rejects out-of-range, NaN and impossible sizes", () => {
    const bev = DEFINITIONS_BY_CODE["CAN-BEVERAGE"];
    expect(validateDims(bev, { D: 40, H: 115 }).success).toBe(false);
    expect(validateDims(bev, { D: 66, H: 400 }).success).toBe(false);
    expect(validateDims(bev, { D: Number.NaN, H: 115 }).success).toBe(false);
    const dropper = DEFINITIONS_BY_CODE["COS-DROPPER"];
    expect(validateDims(dropper, { D: 18, H: 25 }).success).toBe(false); // shorter than the neck allows
    const cup = DEFINITIONS_BY_CODE["CUP-YOGURT"];
    expect(validateDims(cup, { D: 75, H: 40, taper: 39 }).success).toBe(false);
    const blister = DEFINITIONS_BY_CODE["PH-BLISTER"];
    expect(validateDims(blister, { D: 46, H: 96, G: 4, rows: 5, cols: 4, cavityD: 11 }).success).toBe(false);
    expect(validateDims(blister, { D: 46, H: 96, G: 4, rows: 5, cols: 2, cavityD: 11 }).success).toBe(true);
  });

  it("clamps to the limits", () => {
    const def = DEFINITIONS_BY_CODE["CAN-PAINT"];
    expect(clampCatalogueDims(def, { D: 10, H: 999 })).toMatchObject({ D: def.limits.D.min, H: def.limits.H.max });
  });
});

describe("geometry", () => {
  it.each(every.map(({ def, preset }) => [`${def.code}/${preset.id}`, def, preset] as const))("%s: finite, closed, matches its inputs", (_, def, preset) => {
    const desc = describeCatalogueVessel(def, preset.dims, def.surfaces, preset.id);
    for (const [path, n] of allNumbers(desc)) expect(finite(n), path).toBe(true);
    const g = desc.geometry;
    if (g.kind === "blister") {
      const bl = g.blister!;
      expect(bl.cavities.length).toBe((preset.dims.rows ?? 2) * (preset.dims.cols ?? 5));
      for (const c of bl.cavities) {
        expect(c.x - c.d / 2).toBeGreaterThanOrEqual(bl.borderMm - 1e-9);
        expect(c.x + c.d / 2).toBeLessThanOrEqual(bl.widthMm - bl.borderMm + 1e-9);
        expect(c.y + c.d / 2).toBeLessThanOrEqual(bl.heightMm - bl.borderMm + 1e-9);
      }
      expect(desc.envelope).toMatchObject({ width: preset.dims.D, height: preset.dims.H });
      return;
    }
    const p = g.profile!;
    expect(p.outer[0].r).toBe(0);
    const ys = p.outer.map((q) => q.y);
    expect(Math.min(...ys)).toBeCloseTo(0, 6);
    for (const q of p.outer) expect(q.r).toBeGreaterThanOrEqual(0);
    expect(p.body.y1).toBeGreaterThan(p.body.y0);
    if (g.kind !== "tube") {
      // closed height = H (profile tops out at H; tubes add their cap below)
      expect(Math.max(...ys)).toBeCloseTo(preset.dims.H, 0);
      // body radius = D/2 (cups: interpolated between base and rim)
      const mid = (p.body.y0 + p.body.y1) / 2;
      const expected = def.shape.type === "cup" ? (p.body.r0 + p.body.r1) / 2 : preset.dims.D / 2;
      expect(radiusAt(p.outer, mid)).toBeCloseTo(expected, 0);
      // envelope holds the container
      expect(desc.envelope.width).toBeGreaterThanOrEqual(preset.dims.D - 1e-6);
      expect(desc.envelope.height).toBeGreaterThanOrEqual(preset.dims.H - 1e-6);
    } else {
      expect(radiusAt(p.outer, (p.body.y0 + p.body.y1) / 2)).toBeCloseTo(preset.dims.D / 2, 1);
    }
    if (p.section.kind === "roundedRect" && preset.dims.G) expect(p.section.depthRatio).toBeCloseTo(preset.dims.G / preset.dims.D, 6);
  });

  it.each(every.filter(({ def }) => def.volumeCheck).map(({ def, preset }) => [`${def.code}/${preset.id}`, def, preset] as const))(
    "%s: brimful capacity matches the stated capacity",
    (_, def, preset) => {
      const { brimfulMl } = describeCatalogueVessel(def, preset.dims, [], preset.id);
      if (preset.brimfulMl) {
        expect(brimfulMl / preset.brimfulMl).toBeGreaterThan(0.8);
        expect(brimfulMl / preset.brimfulMl).toBeLessThan(1.2);
      } else if (preset.capacityMl > 0) {
        expect(brimfulMl / preset.capacityMl).toBeGreaterThanOrEqual(0.95);
        expect(brimfulMl / preset.capacityMl).toBeLessThanOrEqual(1.5);
      }
    },
  );

  it("bigger presets hold more (monotonic capacity within a model)", () => {
    for (const def of DEFINITIONS.filter((d) => d.volumeCheck)) {
      const pairs = def.presets.map((p) => [p.capacityMl, describeCatalogueVessel(def, p.dims, [], p.id).brimfulMl] as const).sort((a, b) => a[0] - b[0]);
      for (let i = 1; i < pairs.length; i++) if (pairs[i][0] > pairs[i - 1][0]) expect(pairs[i][1], def.code).toBeGreaterThan(pairs[i - 1][1]);
    }
  });

  it("lids sit on top and are wider than the body where they slip over", () => {
    const tin = DEFINITIONS_BY_CODE["TIN-GIFT-ROUND"];
    const g = buildGeometry(tin.shape, { D: 200, H: 85 });
    expect(g.lid!.r).toBeCloseTo(100.6, 6);
    expect(g.lid!.y1).toBeCloseTo(85.6, 6);
    expect(g.printY1).toBeLessThan(g.lid!.y0);
    const paint = DEFINITIONS_BY_CODE["CAN-PAINT"];
    expect(buildGeometry(paint.shape, { D: 108, H: 125 }).lid!.type).toBe("lever");
  });

  it("beverage can envelope matches the published diameter and height", () => {
    const def = DEFINITIONS_BY_CODE["CAN-BEVERAGE"];
    const env = catalogueEnvelope(def, { D: 66.2, H: 115.2 });
    expect(env.width).toBeCloseTo(66.2, 1);
    expect(env.height).toBeCloseTo(115.8, 1);
  });
});

describe("print surfaces", () => {
  const all: { code: string; s: CataloguePrintSurface }[] = [];
  for (const { def, preset } of every) for (const s of describeCatalogueVessel(def, preset.dims, def.surfaces, preset.id).surfaces) all.push({ code: `${def.code}/${preset.id}`, s });

  it("every model gets its default surfaces", () => {
    for (const { def, preset } of every) {
      const kinds = describeCatalogueVessel(def, preset.dims, def.defaultSurfaces, preset.id).surfaces.map((s) => s.kind);
      for (const k of def.defaultSurfaces) expect(kinds, `${def.code}/${preset.id}`).toContain(k);
    }
  });

  it("print = trim + 2 x bleed, safe zone inside trim, positive area", () => {
    for (const { code, s } of all) {
      expect(s.printWidthMm, code).toBeCloseTo(s.trimWidthMm + 2 * s.bleedMm, 0);
      expect(s.printHeightMm, code).toBeCloseTo(s.trimHeightMm + 2 * s.bleedMm, 0);
      expect(s.trimAreaM2, code).toBeGreaterThan(0);
      expect(s.trimAreaM2 * 1e6, code).toBeLessThanOrEqual(s.trimWidthMm * s.trimHeightMm * 1.01 + 1);
      expect(s.safeWidthMm).toBeLessThanOrEqual(s.trimWidthMm);
      expect(s.safeHeightMm).toBeLessThanOrEqual(s.trimHeightMm);
      if (["direct", "iml", "foil", "card"].includes(s.process)) expect(s.bleedMm).toBe(DIRECT_BLEED_MM);
    }
  });

  it("direct print on a round body wraps the exact circumference with no overlap", () => {
    const def = DEFINITIONS_BY_CODE["CAN-BEVERAGE"];
    const d = describeCatalogueVessel(def, { D: 66.2, H: 115.2 }, ["DIRECT_PRINT"]);
    const s = d.surfaces[0];
    expect(s.shape).toBe("rect");
    expect(s.overlapMm).toBe(0);
    expect(s.trimWidthMm).toBeCloseTo(Math.PI * 66.2, 0);
    expect(s.trimHeightMm).toBeCloseTo(d.geometry.printY1 - d.geometry.printY0, 0);
  });

  it("direct print on a non-round body uses the section girth", () => {
    const def = DEFINITIONS_BY_CODE["TIN-TEA-CADDY"];
    const d = describeCatalogueVessel(def, { D: 75, G: 75, H: 110 }, ["DIRECT_PRINT"]);
    const s = d.surfaces[0];
    expect(s.placement.type).toBe("girth");
    const p = d.geometry.profile!;
    expect(s.trimWidthMm).toBeCloseTo(sectionPerimeter(p.section, 37.5, 1), 0);
  });

  it("tapered cups get an exact annular-sector IML", () => {
    const def = DEFINITIONS_BY_CODE["CUP-ICE-PINT"];
    const d = describeCatalogueVessel(def, { D: 97.6, H: 98.5, taper: 22.6 }, ["IML"]);
    const s = d.surfaces[0];
    expect(s.shape).toBe("sector");
    const g = s.sector!;
    expect(g.apexAbove).toBe(false); // wider at the top: apex below
    // arc length of the outer edge = full rim girth at the top of the print zone
    const top = d.geometry.profile!.body;
    const rTop = top.r0 + ((top.r1 - top.r0) * (d.geometry.printY1 - top.y0)) / (top.y1 - top.y0);
    expect(g.outerRadiusMm * g.angle).toBeCloseTo(2 * Math.PI * rTop, 0);
  });

  it("rectangular lids, foils (with pull tab) and blister cards", () => {
    const sardine = describeCatalogueVessel(DEFINITIONS_BY_CODE["CAN-SARDINE"], { D: 105, G: 60, H: 29 }, ["LID_TOP"]).surfaces[0];
    expect(sardine.placement.type).toBe("top");
    expect(sardine.trimWidthMm).toBeLessThan(105);
    const foil = describeCatalogueVessel(DEFINITIONS_BY_CODE["CUP-YOGURT"], { D: 95, H: 33, taper: 22 }, ["LID_FOIL"]).surfaces[0];
    expect(foil.trimHeightMm - foil.trimWidthMm).toBeCloseTo(10, 6);
    const card = describeCatalogueVessel(DEFINITIONS_BY_CODE["PH-BLISTER"], { D: 46, H: 96, G: 4, rows: 5, cols: 2, cavityD: 11 }, ["CARD_FRONT", "CARD_BACK"]).surfaces;
    expect(card.map((c) => c.kind)).toEqual(["CARD_FRONT", "CARD_BACK"]);
    expect(card[0].keepOut).toHaveLength(10);
    expect(card[1].keepOut).toBeUndefined();
  });

  it("UV mapping: corners of the trim map inside the print area, v increases upwards", () => {
    for (const { code, s } of all) {
      for (const [u, v] of [printUv(s, 0, 0), printUv(s, 1, 1), printUv(s, 0.5, 0.5)]) {
        expect(u, code).toBeGreaterThanOrEqual(-1e-9);
        expect(u, code).toBeLessThanOrEqual(1 + 1e-9);
        expect(v, code).toBeGreaterThanOrEqual(-1e-9);
        expect(v, code).toBeLessThanOrEqual(1 + 1e-9);
      }
      if (s.shape === "rect") {
        expect(printUv(s, 0.5, 1)[1]).toBeGreaterThan(printUv(s, 0.5, 0)[1]);
        const a = printFlatPoint(s, 0, 1);
        expect(a.x).toBeCloseTo(s.bleedMm, 6);
        expect(a.y).toBeCloseTo(s.bleedMm, 6);
      }
    }
  });

  it("UV contract equals the core surfaceUv for core label kinds", () => {
    const core = all.filter(({ s }) => ["WRAP", "FRONT", "BACK", "SHRINK_SLEEVE", "NECK", "LID"].includes(s.kind));
    expect(core.length).toBeGreaterThan(50);
    for (const { s } of core) {
      for (const [a, b] of [
        [0, 0],
        [0.3, 0.7],
        [1, 1],
      ]) {
        const mine = printUv(s, a, b);
        const theirs = coreSurfaceUv(s as unknown as LabelSpec, a, b);
        expect(mine[0]).toBeCloseTo(theirs[0], 9);
        expect(mine[1]).toBeCloseTo(theirs[1], 9);
      }
    }
  });

  it("square bodies never get a wrap label (front/back faces instead)", () => {
    const d = describeCatalogueVessel(DEFINITIONS_BY_CODE["COS-NAIL-POLISH"], { D: 30, G: 30, H: 40 }, ["WRAP", "FRONT"]);
    expect(d.surfaces.map((s) => s.kind)).toEqual(["FRONT"]);
    expect(d.surfaces[0].placement.type).toBe("face");
  });
});
