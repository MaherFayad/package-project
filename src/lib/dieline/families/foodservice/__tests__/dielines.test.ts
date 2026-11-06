import { describe, expect, it } from "vitest";
import type { Dims } from "@/types";
import { polygonArea } from "../../../geometry";
import { CLAMSHELL_FLARE_DEG, DEFINITIONS, FOOD_MATERIALS, FamilyValidationError, PAIL_FLARE_DEG, buildFoodservice, definitionByCode, generateFamilyDieline, type DielineDefinition, type FamilyDielineModel } from "..";

const DIELINES = DEFINITIONS.filter((d): d is DielineDefinition => d.kind === "dieline");

function finite(v: unknown): boolean {
  if (typeof v === "number") return Number.isFinite(v);
  if (Array.isArray(v)) return v.every(finite);
  if (v && typeof v === "object") return Object.values(v).every(finite);
  return true;
}

/** Expected closed OUTER size from the inner size (mm), per structure. */
function expectedOuter(code: string, d: Dims, t: number): { L: number; W: number; H: number; tol: number } {
  const tol = 6 * t + 1;
  switch (code) {
    case "FS_NOODLE_PAIL": {
      const e = (d.H + t) * Math.tan((PAIL_FLARE_DEG * Math.PI) / 180);
      return { L: d.L + 2 * t + 2 * e, W: d.W + 2 * t + 2 * e, H: d.H + t, tol };
    }
    case "FS_BURGER_CLAMSHELL": {
      // Flared trays: widest at the rim where lid and base meet (base walls = 45 % of H).
      const e = (d.H + 2 * t) * 0.45 * Math.tan((CLAMSHELL_FLARE_DEG * Math.PI) / 180);
      return { L: d.L + 4 * t + 2 * e, W: d.W + 2 * t + 2 * e, H: d.H + 2 * t, tol };
    }
    case "FS_BAG_MERCHANDISE":
    case "FS_HANG_TAG":
      return { L: d.L, W: 0, H: d.H, tol: Math.max(tol, 2) };
    default:
      return { L: d.L, W: d.W, H: d.H, tol: code === "FS_PIZZA_ROUND" ? 8 * t + 1 : tol };
  }
}

describe.each(DIELINES.map((d) => [d.code, d] as const))("%s dieline", (_code, def) => {
  const t = FOOD_MATERIALS[def.defaultMaterial].thicknessMm;
  const cases = [def.defaultDims, ...def.presets.map((p) => p.dims)];

  it.each(cases.map((c) => [JSON.stringify(c), c] as const))("builds %s: finite, closed size matches the inner size", (_k, dims) => {
    const m = generateFamilyDieline(def, dims, { thicknessMm: t });
    expect(m.structureCode).toBe(def.code);
    expect(finite(m.metrics)).toBe(true);
    expect(finite(m.closedOuter)).toBe(true);
    for (const p of m.panels) expect(finite(p.polygon), p.id).toBe(true);
    const e = expectedOuter(def.code, dims, t);
    expect(Math.abs(m.closedOuter.L - e.L), "L").toBeLessThanOrEqual(e.tol);
    expect(Math.abs(m.closedOuter.W - e.W), "W").toBeLessThanOrEqual(e.tol);
    expect(Math.abs(m.closedOuter.H - e.H), "H").toBeLessThanOrEqual(e.tol);
    // Outer never smaller than inner (the product fits).
    expect(m.closedOuter.L).toBeGreaterThanOrEqual(dims.L - 0.01);
    expect(m.closedOuter.H).toBeGreaterThanOrEqual(dims.H - 0.01);
  });

  it("print area math: sheet = die + bleed, bleed covers each printable panel, safe zones inside", () => {
    const m: FamilyDielineModel = generateFamilyDieline(def, def.defaultDims, { thicknessMm: t });
    expect(m.bleedMm).toBe(3);
    expect(m.sheet.width).toBeCloseTo(m.dieBounds.width + 6, 6);
    expect(m.sheet.height).toBeCloseTo(m.dieBounds.height + 6, 6);
    expect(m.metrics.blankAreaM2).toBeCloseTo((m.metrics.blankWidthMm * m.metrics.blankHeightMm) / 1e6, 9);
    expect(m.metrics.netAreaM2).toBeGreaterThan(0);
    expect(m.metrics.netAreaM2).toBeLessThanOrEqual(m.metrics.blankAreaM2 + 1e-9);
    expect(m.cutLines.length).toBeGreaterThan(3);
    for (const r of m.bleedRegions) {
      const panel = m.panels.find((p) => p.id === r.panelId)!;
      expect(panel.printable).toBe(true);
      expect(polygonArea(r.polygon)).toBeGreaterThanOrEqual(polygonArea(panel.polygon) - 1e-6);
    }
    expect(m.panels.filter((p) => p.role === "glue").every((p) => !p.printable)).toBe(true);
    for (const z of m.safeZones) {
      const p = m.panels.find((x) => x.id === z.panelId)!;
      expect(z.rect.x).toBeGreaterThanOrEqual(p.bbox.x - 1e-6);
      expect(z.rect.x + z.rect.width).toBeLessThanOrEqual(p.bbox.x + p.bbox.width + 1e-6);
    }
    expect(Object.keys(m.faces).length).toBeGreaterThan(0);
  });

  it("rejects sizes outside the limits", () => {
    const tooSmall = { ...def.defaultDims, L: def.params.L.min - 1 };
    const tooLarge = { ...def.defaultDims, H: def.params.H.max + 1 };
    expect(() => generateFamilyDieline(def, tooSmall, { thicknessMm: t })).toThrow(FamilyValidationError);
    try {
      generateFamilyDieline(def, tooLarge, { thicknessMm: t });
    } catch (e) {
      expect((e as FamilyValidationError).issues[0]).toMatchObject({ path: "H", code: "TOO_LARGE" });
    }
    expect(() => generateFamilyDieline(def, { ...def.defaultDims, W: Number.NaN }, { thicknessMm: t })).toThrow(FamilyValidationError);
    expect(() => generateFamilyDieline(def, def.defaultDims, { thicknessMm: 0 })).toThrow(FamilyValidationError);
  });
});

describe("foodservice dieline specifics", () => {
  it("round pizza: square rule and inch presets", () => {
    const d = definitionByCode("FS_PIZZA_ROUND") as DielineDefinition;
    expect(() => generateFamilyDieline(d, { L: 300, W: 280, H: 40 }, { thicknessMm: 1.5 })).toThrow(/RULE/);
    for (const [id, inch] of [["in-8", 8], ["in-12", 12], ["in-16", 16]] as const) {
      const p = d.presets.find((x) => x.id === id)!;
      expect(p.dims.L).toBeGreaterThan(inch * 25.4);
      expect(p.dims.L - inch * 25.4).toBeLessThan(10);
    }
  });

  it("cake box and sandwich wedge carry a filmed window by default; film fits the panel", () => {
    for (const code of ["FS_CAKE_BOX_WINDOW", "FS_SANDWICH_WEDGE", "FS_BAG_BREAD_WINDOW"] as const) {
      const m = buildFoodservice(code, (definitionByCode(code) as DielineDefinition).defaultDims).model as FamilyDielineModel;
      expect(m.features.window).toBeTruthy();
      expect(m.metrics.filmAreaM2).toBeGreaterThan(0);
      const film = m.films[0];
      const panel = m.panels.find((p) => p.id === film.panelId)!;
      expect(panel.holes?.length).toBeGreaterThan(0);
      expect(polygonArea(film.polygon)).toBeLessThan(polygonArea(panel.polygon));
      expect(polygonArea(film.polygon)).toBeGreaterThan(polygonArea(panel.holes![0]));
    }
  });

  it("drops unsupported features", () => {
    const m = buildFoodservice("FS_NOODLE_PAIL", { L: 70, W: 60, H: 95 }, { features: { window: { face: "top" }, handle: true } }).model as FamilyDielineModel;
    expect(m.features).toEqual({});
    expect(m.films).toHaveLength(0);
  });

  it("noodle pail: four oblique wall faces and a lock slit", () => {
    const m = buildFoodservice("FS_NOODLE_PAIL", { L: 70, W: 60, H: 95 }).model as FamilyDielineModel;
    for (const f of ["front", "back", "left", "right"] as const) expect(m.faces[f]?.parts.length).toBe(1);
    const th = (PAIL_FLARE_DEG * Math.PI) / 180;
    const slant = (95 + m.thicknessMm) / Math.cos(th);
    expect(m.faces.front!.height).toBeCloseTo(slant, 0);
    expect(m.panels.find((p) => p.id === "backFlap")!.holes).toHaveLength(1);
  });

  it("sandwich wedge: sloped face size = length × hypotenuse", () => {
    const d = { L: 70, W: 125, H: 125 };
    const m = buildFoodservice("FS_SANDWICH_WEDGE", d).model as FamilyDielineModel;
    const t = m.thicknessMm;
    expect(m.faces.top!.width).toBeCloseTo(d.L + 2 * t, 1);
    expect(m.faces.top!.height).toBeCloseTo(Math.hypot(d.W + 2 * t, d.H + 2 * t), 0);
  });

  it("carrier bags: turnover panels and handle spec", () => {
    for (const [code, kind] of [["FS_BAG_FLAT_HANDLE", "flat"], ["FS_BAG_TWISTED_HANDLE", "twisted"]] as const) {
      const m = buildFoodservice(code, { L: 260, W: 120, H: 350 }).model as FamilyDielineModel;
      expect(m.handle?.kind).toBe(kind);
      expect(m.handle!.spanMm).toBeLessThan(260);
      expect(m.panels.filter((p) => p.role === "inner")).toHaveLength(4);
      // Turnover folds inside: closed height stays the bag height.
      expect(m.closedOuter.H).toBeCloseTo(350, 0);
    }
    const sos = buildFoodservice("FS_BAG_SOS", { L: 159, W: 97, H: 318 }).model as FamilyDielineModel;
    expect(sos.handle).toBeUndefined();
    // Gusset centre folds + bottom diagonals are drawn as creases.
    expect(sos.metrics.creaseLengthMm).toBeGreaterThan(2 * 318);
  });

  it("hang tag: string hole cut", () => {
    const m = buildFoodservice("FS_HANG_TAG", { L: 50, W: 1, H: 90 }).model as FamilyDielineModel;
    expect(m.panels[0].holes).toHaveLength(1);
    expect(m.faces.front!.width).toBeCloseTo(50, 1);
  });
});

describe("R6-3Q-D: one face per printed panel", () => {
  it("no box panel is mapped by two faces (sandwich wedge lid was top AND front)", () => {
    for (const def of DEFINITIONS.filter((d) => d.kind === "dieline")) {
      const m = buildFoodservice(def.code as never, def.defaultDims as Dims).model as FamilyDielineModel;
      const seen = new Map<string, string>();
      for (const [face, f] of Object.entries(m.faces)) {
        for (const p of f!.parts) {
          expect(seen.get(p.panelId), `${def.code}: ${p.panelId} in ${seen.get(p.panelId)} and ${face}`).toBeUndefined();
          seen.set(p.panelId, face);
        }
      }
    }
  });
});
