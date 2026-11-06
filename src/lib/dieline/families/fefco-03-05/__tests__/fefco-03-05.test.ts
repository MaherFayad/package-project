import { describe, expect, it } from "vitest";
import { Box3, Vec3 as Vector3 } from "@/lib/dieline/math";
import type { Dims } from "@/types";
import { BOARD_SPECS, DielineValidationError, boundsAt, computePoses, panelLocalPoint, panelPivot, maxStage } from "../../..";
import { polygonArea, segLength } from "../../../geometry";
import { DEFINITIONS, DEFINITION_BY_CODE, generateFamilyDieline, validateFamilyDims, type FamilyDielineModel, type FamilyStructureDef } from "..";

const THICKNESSES = [1.5, 3];
const DIACRITICS = /[ً-ْٰ]/;

/** FEFCO 11th edition group 03 / 05 codes covered (0306/0508/0513 etc. do not exist; see README). */
const EXPECTED_CODES = [
  "0300", "0301", "0302", "0303", "0304", "0306", "0307", "0308", "0309", "0310", "0312", "0313", "0314",
  "0320", "0321", "0322", "0323", "0325", "0330", "0331", "0350", "0351", "0352",
  "0501", "0502", "0503", "0504", "0505", "0507", "0509", "0510", "0511", "0512",
].map((c) => `FEFCO_${c}`);

function allNumbers(value: unknown, out: number[] = []): number[] {
  if (typeof value === "number") out.push(value);
  else if (Array.isArray(value)) for (const v of value) allNumbers(v, out);
  else if (value && typeof value === "object") for (const v of Object.values(value)) allNumbers(v, out);
  return out;
}

/** Closed-pose vertices (both board surfaces) of every panel. */
function closedVertices(m: FamilyDielineModel): Vector3[] {
  const poses = computePoses(m, 1);
  const out: Vector3[] = [];
  for (const p of m.panels) {
    const pose = poses.get(p.id)!;
    const pivot = panelPivot(p, m.thicknessMm);
    for (const q of p.polygon) for (const depth of [0, 1]) out.push(panelLocalPoint(p, q, depth, pivot, m.thicknessMm).applyMatrix4(pose.world));
  }
  return out;
}

const sampleDims = (d: FamilyStructureDef): Dims[] => [d.defaultDims, ...d.presets.map((p) => p.dims)];

describe("FEFCO 03/05 catalogue metadata", () => {
  it("covers every group 03 and 05 style, once", () => {
    expect(DEFINITIONS.map((d) => d.code).sort()).toEqual([...EXPECTED_CODES].sort());
    expect(new Set(DEFINITIONS.map((d) => d.slug)).size).toBe(DEFINITIONS.length);
    expect(Object.keys(DEFINITION_BY_CODE)).toHaveLength(DEFINITIONS.length);
  });

  it.each(DEFINITIONS.map((d) => [d.code, d] as const))("%s has complete, valid metadata", (_c, d) => {
    expect(d.standard).toBe(`FEFCO ${d.code.slice(6)}`);
    expect(d.group).toBe(d.code.slice(6, 8));
    for (const s of [d.name.ar, d.name.en, d.description.ar, d.description.en]) expect(s.trim().length).toBeGreaterThan(3);
    expect(d.name.ar).not.toMatch(DIACRITICS);
    expect(d.description.ar).not.toMatch(DIACRITICS);
    expect(d.name.ar).toMatch(/[؀-ۿ]/);
    expect(d.presets.length).toBeGreaterThanOrEqual(2);
    expect(d.presets.length).toBeLessThanOrEqual(4);
    expect(new Set(d.presets.map((p) => p.id)).size).toBe(d.presets.length);
    expect(validateFamilyDims(d, d.defaultDims).ok).toBe(true);
    for (const p of d.presets) expect(validateFamilyDims(d, p.dims), `${d.code} preset ${p.id}`).toMatchObject({ ok: true });
    expect(d.materials.length).toBeGreaterThan(0);
    for (const m of d.materials) expect(BOARD_SPECS[m].family).toBe("CORRUGATED");
    expect(d.pieceLabels).toHaveLength(d.pieces);
    expect(d.uses.length).toBeGreaterThan(0);
  });
});

describe.each(DEFINITIONS.map((d) => [d.code, d] as const))("%s dieline", (_code, def) => {
  for (const t of THICKNESSES) {
    for (const dims of sampleDims(def)) {
      const label = `t=${t} ${dims.L}×${dims.W}×${dims.H}`;
      it(`is finite, complete and sized to the inner dims (${label})`, () => {
        const m = generateFamilyDieline(def, dims, { thicknessMm: t });
        // No NaN / Infinity anywhere in the model.
        for (const n of allNumbers(m)) expect(Number.isFinite(n)).toBe(true);
        expect(m.structureCode).toBe(def.code);
        expect(m.pieces).toHaveLength(def.pieces);
        expect(m.metrics.pieceCount).toBe(def.pieces);
        expect(m.metrics.cutLengthMm).toBeGreaterThan(0);
        expect(m.metrics.creaseLengthMm).toBeGreaterThan(0);
        expect(m.metrics.blankAreaM2).toBeGreaterThan(m.metrics.netAreaM2 * 0.999);
        expect(maxStage(m)).toBeGreaterThanOrEqual(def.pieces > 1 ? 1 : 0);

        // Closed outer size: never smaller than the inner size, at most a few calipers larger.
        const o = m.closedOuter;
        // Outside gussets (0303 against the long walls, 0304 against the end walls) of a tray
        // deeper than half that wall overlap: the second pair lies two boards further out on
        // base and lid (4 extra layers on that axis) instead of sharing the first pair's plane.
        const against = def.code === "FEFCO_0304" ? "W" : def.code === "FEFCO_0303" ? "L" : null;
        const overlapAxis = against && 2 * (dims.H + t) > dims[against] ? (against === "W" ? "L" : "W") : null;
        for (const k of ["L", "W", "H"] as const) {
          expect(o[k], `${k} outer`).toBeGreaterThanOrEqual(dims[k] - 0.01);
          expect(o[k], `${k} outer`).toBeLessThanOrEqual(dims[k] + 14 * t + 8 + (k === overlapAxis ? 8 * t : 0));
        }

        // The requested inner cavity is free of board (flaps fold the right way, layers compensated).
        // Margin: 1.5 mm + 2 calipers (a manufacturer's joint or an internal cap wall sits there by
        // design). Octabins are octagonal, so their rectangular L × W cavity does not apply.
        const box = boundsAt(m, 1);
        const c = box.getCenter(new Vector3());
        const m2 = def.shape === "octagon" ? Number.POSITIVE_INFINITY : 1.5 + 2 * t;
        const cavity = new Box3(
          new Vector3(c.x - dims.L / 2 + m2, c.y - dims.H / 2 + m2, c.z - dims.W / 2 + m2),
          new Vector3(c.x + dims.L / 2 - m2, c.y + dims.H / 2 - m2, c.z + dims.W / 2 - m2),
        );
        const intruders = cavity.isEmpty() ? [] : closedVertices(m).filter((v) => cavity.containsPoint(v));
        expect(intruders.length, "vertices inside the inner cavity").toBe(0);

        // Faces: at least the four that a sleeve has; tray/telescope styles have all six.
        expect(Object.keys(m.faces).length).toBeGreaterThanOrEqual(4);
        if (def.group === "03") expect(Object.keys(m.faces).sort()).toEqual(["back", "bottom", "front", "left", "right", "top"]);
      });

      it(`has consistent print areas (${label})`, () => {
        const m = generateFamilyDieline(def, dims, { thicknessMm: t });
        expect(m.sheet.width).toBeCloseTo(m.dieBounds.width + 2 * m.bleedMm, 6);
        expect(m.sheet.height).toBeCloseTo(m.dieBounds.height + 2 * m.bleedMm, 6);
        const byId = new Map(m.panels.map((p) => [p.id, p]));
        for (const r of m.bleedRegions) {
          const p = byId.get(r.panelId)!;
          expect(p.printable).toBe(true);
          expect(polygonArea(r.polygon)).toBeGreaterThanOrEqual(polygonArea(p.polygon) - 1e-6);
        }
        expect(m.bleedRegions.length).toBe(m.panels.filter((p) => p.printable).length);
        expect(m.panels.filter((p) => p.role === "glue").every((p) => !p.printable)).toBe(true);
        for (const s of m.safeZones) {
          const p = byId.get(s.panelId)!;
          expect(s.rect.width).toBeGreaterThan(0);
          expect(s.rect.x).toBeGreaterThanOrEqual(p.bbox.x - 1e-6);
          expect(s.rect.x + s.rect.width).toBeLessThanOrEqual(p.bbox.x + p.bbox.width + 1e-6);
        }
        // Every die line lies on the sheet inside the bleed margin.
        for (const s of [...m.cutLines, ...m.creaseLines])
          for (const q of [s.a, s.b]) {
            expect(q.x).toBeGreaterThanOrEqual(m.bleedMm - 1e-6);
            expect(q.y).toBeGreaterThanOrEqual(m.bleedMm - 1e-6);
            expect(q.x).toBeLessThanOrEqual(m.sheet.width - m.bleedMm + 1e-6);
            expect(q.y).toBeLessThanOrEqual(m.sheet.height - m.bleedMm + 1e-6);
          }
      });
    }
  }

  it("folds smoothly from flat (no NaN mid-fold, flat at 0)", () => {
    const m = generateFamilyDieline(def, def.defaultDims, { thicknessMm: 1.5 });
    for (const progress of [0, 0.25, 0.5, 0.75]) {
      const b = boundsAt(m, progress);
      for (const n of [b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z]) expect(Number.isFinite(n)).toBe(true);
    }
    const flat = boundsAt(m, 0);
    expect(flat.max.z - flat.min.z).toBeLessThan(3 * 1.5 + 1e-6);
  });

  it("rejects out-of-range dims and bad calipers", () => {
    const d = def.defaultDims;
    expect(() => generateFamilyDieline(def, { ...d, L: def.params.L.min - 1 }, { thicknessMm: 1.5 })).toThrow(DielineValidationError);
    expect(() => generateFamilyDieline(def, { ...d, H: def.params.H.max + 1 }, { thicknessMm: 1.5 })).toThrow(DielineValidationError);
    expect(() => generateFamilyDieline(def, { ...d, W: Number.NaN }, { thicknessMm: 1.5 })).toThrow(DielineValidationError);
    expect(() => generateFamilyDieline(def, d, { thicknessMm: 0 })).toThrow(DielineValidationError);
  });
});

describe("style-specific geometry", () => {
  const gen = (code: string, dims?: Dims, t = 1.5, lidHeightMm?: number) => {
    const d = DEFINITION_BY_CODE[code];
    return generateFamilyDieline(d, dims ?? d.defaultDims, { thicknessMm: t, ...(lidHeightMm ? { features: { lidHeightMm } } : {}) });
  };

  it("octabin rules: 0351 needs L == W, 0352 needs W <= L", () => {
    expect(validateFamilyDims(DEFINITION_BY_CODE.FEFCO_0351, { L: 1000, W: 900, H: 900 })).toMatchObject({ ok: false, issues: [{ code: "RULE" }] });
    expect(validateFamilyDims(DEFINITION_BY_CODE.FEFCO_0352, { L: 800, W: 900, H: 900 })).toMatchObject({ ok: false, issues: [{ code: "RULE" }] });
  });

  it("gusset web edges are creases, never cuts (0303)", () => {
    const m = gen("FEFCO_0303");
    const gussets = m.panels.filter((p) => p.label === "Corner gusset");
    expect(gussets).toHaveLength(16);
    const cutLen = m.metrics.cutLengthMm;
    const g0302 = gen("FEFCO_0302", DEFINITION_BY_CODE.FEFCO_0303.defaultDims);
    // Web corners replace the cut corners of a flapless cross with creases: more crease, same outline size.
    expect(m.metrics.creaseLengthMm).toBeGreaterThan(g0302.metrics.creaseLengthMm);
    expect(cutLen).toBeGreaterThan(0);
  });

  it("full vs partial telescope: lid depth follows lidHeightMm", () => {
    const fullLid = gen("FEFCO_0300");
    const partialLid = gen("FEFCO_0300", undefined, 1.5, 40);
    const lidWall = (m: FamilyDielineModel) => m.panels.find((p) => p.id === "lid_longT")!.bbox.height;
    expect(lidWall(fullLid)).toBeCloseTo(100 + 1.5, 6);
    expect(lidWall(partialLid)).toBeCloseTo(40 + 1.5, 6);
    // Same closed outer height either way: the lid rests on the base rim.
    expect(partialLid.closedOuter.H).toBeCloseTo(fullLid.closedOuter.H, 3);
  });

  it("tray floor crease-to-crease = inner + 2 × layers × t (0300: flaps inside the long walls)", () => {
    const m = gen("FEFCO_0300", { L: 330, W: 250, H: 100 }, 3);
    const floor = m.panels.find((p) => p.id === "bottom")!;
    expect(floor.bbox.width).toBeCloseTo(330 + 2 * 3, 6);
    expect(floor.bbox.height).toBeCloseTo(250 + 4 * 3, 6);
  });

  it("open sleeves keep the open axis at the inner size (0503) and wrap with 2t", () => {
    const m = gen("FEFCO_0503", { L: 220, W: 150, H: 60 }, 1.5);
    expect(m.closedOuter.L).toBeCloseTo(220, 3);
    expect(m.closedOuter.W).toBeCloseTo(153, 3);
    expect(m.closedOuter.H).toBeCloseTo(63, 3);
    expect(m.faces.left).toBeUndefined();
  });

  it("print area of a crease-bounded panel grows only on its cut edges (0501 side panel)", () => {
    const m = gen("FEFCO_0501", { L: 300, W: 200, H: 200 }, 1.5);
    const p = m.panels.find((q) => q.id === "p1")!;
    const r = m.bleedRegions.find((q) => q.panelId === "p1")!;
    expect(polygonArea(r.polygon)).toBeCloseTo(p.bbox.width * (p.bbox.height + 2 * m.bleedMm), 3);
    // Lid top of a flapless tray is creased on all four sides: no bleed added.
    const g = gen("FEFCO_0302");
    const top = g.panels.find((q) => q.id === "lid_top")!;
    expect(polygonArea(g.bleedRegions.find((q) => q.panelId === "lid_top")!.polygon)).toBeCloseTo(polygonArea(top.polygon), 6);
  });

  it("caps sets return three blanks, the body first", () => {
    for (const code of ["FEFCO_0310", "FEFCO_0313", "FEFCO_0314", "FEFCO_0325", "FEFCO_0351", "FEFCO_0352"]) {
      const m = gen(code);
      expect(m.pieces.map((p) => p.rootId)[0]).toBe(m.rootId);
      expect(m.pieces).toHaveLength(3);
    }
  });

  it("octagonal body panels close the ring (8 × 45°) and caps are octagonal", () => {
    const m = gen("FEFCO_0351");
    const ring = m.panels.filter((p) => p.pieceId === m.rootId && p.role !== "glue" && p.role !== "flap" ? true : p.label === "Corner panel");
    expect(ring.filter((p) => p.label === "Corner panel")).toHaveLength(4);
    const cap = m.panels.find((p) => p.id === "topCap_top")!;
    expect(cap.polygon).toHaveLength(8);
    const sides = cap.polygon.map((q, i) => segLength({ a: q, b: cap.polygon[(i + 1) % 8] }));
    // Regular octagon: all sides equal.
    for (const s of sides) expect(s).toBeCloseTo(sides[0], 3);
  });
});
