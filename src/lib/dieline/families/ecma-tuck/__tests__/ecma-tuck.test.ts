import { describe, expect, it } from "vitest";
import { Vec3 as Vector3 } from "@/lib/dieline/math";
import type { Dims, FaceId } from "@/types";
import { boundsAt, computePoses } from "../../../fold";
import { polygonArea } from "../../../geometry";
import { DielineValidationError } from "../../../limits";
import type { Polygon, Pt } from "../../../types";
import {
  DEFINITIONS,
  DEFINITION_BY_CODE,
  ECMA_TUCK_CODES,
  EURO_SLOT,
  clampEcmaDims,
  ecmaTuckOptionsSchema,
  generateEcmaDieline,
  tryGenerateEcmaDieline,
  validateEcmaDims,
  type EcmaTuckDefinition,
  type EcmaTuckDielineModel,
} from "..";

const THICKNESSES = [0.4, 0.48];

function allFinite(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(allFinite);
  if (value && typeof value === "object") return Object.values(value).every(allFinite);
  return true;
}

function pointInPolygon(p: Pt, poly: Polygon): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function sizeCases(def: EcmaTuckDefinition): Dims[] {
  const l = def.params;
  return [
    def.defaultDims,
    ...def.presets.map((p) => p.dims),
    clampEcmaDims(def, { L: l.L.min, W: l.W.min, H: l.H.min }),
    clampEcmaDims(def, { L: l.L.max, W: l.W.max, H: l.H.max }),
    clampEcmaDims(def, { L: l.L.max, W: l.W.min, H: l.H.min }),
    clampEcmaDims(def, { L: l.L.min, W: l.W.max, H: l.H.max }),
  ].filter((d) => validateEcmaDims(def, d).ok);
}

/** Extra board layers on each axis of the closed box (outer = inner + 2 × layers × t, ± hanger header). */
const SIDE_LAYERS: Partial<Record<EcmaTuckDefinition["code"], { L: number; W: number }>> = {
  ECMA_DOUBLE_WALL_TUCK: { L: 1, W: 2 },
};

describe("catalogue metadata", () => {
  it("has one definition per code, unique slugs", () => {
    expect(DEFINITIONS.map((d) => d.code).sort()).toEqual([...ECMA_TUCK_CODES].sort());
    expect(new Set(DEFINITIONS.map((d) => d.slug)).size).toBe(DEFINITIONS.length);
    expect(Object.keys(DEFINITION_BY_CODE)).toHaveLength(DEFINITIONS.length);
  });

  it.each(DEFINITIONS.map((d) => [d.code, d] as const))("%s metadata is complete", (_code, def) => {
    expect(def.name.ar.length).toBeGreaterThan(3);
    expect(def.name.en.length).toBeGreaterThan(3);
    expect(def.description.ar.length).toBeGreaterThan(10);
    expect(def.description.en.length).toBeGreaterThan(10);
    // MSA without diacritics (tashkeel U+064B–U+0652) and no tatweel.
    for (const s of [def.name.ar, def.description.ar, ...def.presets.map((p) => p.name.ar)]) expect(s).not.toMatch(/[ً-ْـ]/);
    expect(def.standard === "none" || /^ECMA [A-F]\d{2}\.\d{2}\.\d{2}\.\d{2}/.test(def.standard)).toBe(true);
    expect(def.family).toBe("FOLDING_CARTON");
    expect(def.materials.length).toBeGreaterThan(0);
    expect(def.uses.length).toBeGreaterThan(0);
    expect(def.presets.length).toBeGreaterThanOrEqual(2);
    expect(def.presets.length).toBeLessThanOrEqual(4);
    expect(validateEcmaDims(def, def.defaultDims).ok).toBe(true);
    for (const p of def.presets) expect(validateEcmaDims(def, p.dims).ok, p.id).toBe(true);
  });

  it("uses the verified ECMA codes", () => {
    expect(DEFINITION_BY_CODE.ECMA_TUCK_RTE.standard).toBe("ECMA A20.20.03.01");
    expect(DEFINITION_BY_CODE.ECMA_TUCK_STE.standard).toBe("ECMA A20.20.03.03");
    expect(DEFINITION_BY_CODE.ECMA_TUCK_SNAP_LOCK.standard).toBe("ECMA A55.20.01.03");
    expect(DEFINITION_BY_CODE.ECMA_TUCK_CRASH_LOCK.standard).toBe("ECMA A60.20.00.03");
    expect(DEFINITION_BY_CODE.ECMA_HANGER_EURO.standard).toBe("ECMA A20.21.03.03");
    expect(DEFINITION_BY_CODE.ECMA_SEAL_END.standard).toBe("ECMA A10.10.01.01");
  });
});

describe("limits and options (zod)", () => {
  const def = DEFINITION_BY_CODE.ECMA_TUCK_RTE;
  it("rejects out-of-range and non-numeric dims", () => {
    const small = validateEcmaDims(def, { L: def.params.L.min - 1, W: 40, H: 100 });
    expect(small.ok).toBe(false);
    if (!small.ok) expect(small.issues[0]).toMatchObject({ path: "L", code: "TOO_SMALL", limit: def.params.L.min });
    const big = validateEcmaDims(def, { L: 60, W: 40, H: def.params.H.max + 1 });
    expect(big.ok).toBe(false);
    if (!big.ok) expect(big.issues[0]).toMatchObject({ path: "H", code: "TOO_LARGE" });
    expect(validateEcmaDims(def, { L: Number.NaN, W: 40, H: 100 }).ok).toBe(false);
    expect(() => generateEcmaDieline(def, { L: 5, W: 40, H: 100 }, { thicknessMm: 0.4 })).toThrow(DielineValidationError);
    expect(tryGenerateEcmaDieline(def, { L: 5, W: 40, H: 100 }, { thicknessMm: 0.4 })).toBeNull();
    expect(() => generateEcmaDieline(def, def.defaultDims, { thicknessMm: -1 })).toThrow(DielineValidationError);
  });

  it("enforces the flip-top W <= L rule", () => {
    const ft = DEFINITION_BY_CODE.ECMA_FLIP_TOP;
    const r = validateEcmaDims(ft, { L: 45, W: 50, H: 90 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues[0]).toMatchObject({ code: "RULE", rule: "W <= L" });
    expect(clampEcmaDims(ft, { L: 45, W: 50, H: 90 }).W).toBe(45);
  });

  it("validates model options", () => {
    expect(ecmaTuckOptionsSchema.safeParse({ tuckDepthMm: 15, hangHole: "euro" }).success).toBe(true);
    expect(ecmaTuckOptionsSchema.safeParse({ tuckDepthMm: 2 }).success).toBe(false);
    expect(ecmaTuckOptionsSchema.safeParse({ hangHole: "triangle" }).success).toBe(false);
    expect(ecmaTuckOptionsSchema.safeParse({ bogus: 1 }).success).toBe(false);
    expect(() => generateEcmaDieline(def, def.defaultDims, { thicknessMm: 0.4, model: { glueFlapMm: 99 } })).toThrow(DielineValidationError);
  });
});

describe.each(DEFINITIONS.map((d) => [d.code, d] as const))("dieline %s", (code, def) => {
  const cases = sizeCases(def).flatMap((dims) => THICKNESSES.map((t) => ({ dims, t })));

  it.each(cases)("is finite and well formed for $dims.L×$dims.W×$dims.H t=$t", ({ dims, t }) => {
    const m = generateEcmaDieline(def, dims, { thicknessMm: t });
    expect(allFinite({ ...m, catalogCode: 0, structureCode: 0, panels: m.panels.map((p) => ({ ...p, id: 0, role: 0, label: 0, parentId: 0, pieceId: 0, hingeKind: 0 })), pieces: m.pieces.map((p) => ({ ...p, rootId: 0, label: 0 })), films: m.films.map((f) => f.polygon), bleedRegions: m.bleedRegions.map((r) => r.polygon), safeZones: m.safeZones.map((s) => s.rect), reservedZones: m.reservedZones.map((z) => z.rect), options: 0, features: 0, faces: 0 })).toBe(true);
    expect(m.catalogCode).toBe(code);
    expect(m.structureCode).toBe(def.baseCode);
    // Die sits inside the sheet with the bleed on every side.
    expect(m.sheet.width).toBeCloseTo(m.dieBounds.width + 2 * m.bleedMm, 6);
    expect(m.dieBounds.x).toBeCloseTo(3, 6);
    // Hinges: every child has one, of positive length; ids unique.
    expect(new Set(m.panels.map((p) => p.id)).size).toBe(m.panels.length);
    for (const p of m.panels) {
      if (p.parentId === null) continue;
      expect(p.hinge, p.id).not.toBeNull();
      expect(Math.hypot(p.hinge!.b.x - p.hinge!.a.x, p.hinge!.b.y - p.hinge!.a.y), p.id).toBeGreaterThan(1);
      expect(polygonArea(p.polygon), p.id).toBeGreaterThan(1);
    }
    // Glue flaps stay ink-free.
    for (const p of m.panels.filter((x) => x.role === "glue")) expect(m.bleedRegions.some((r) => r.panelId === p.id)).toBe(false);
    // Holes lie inside their panel.
    for (const p of m.panels) for (const h of p.holes ?? []) for (const q of h) expect(pointInPolygon(q, p.polygon), p.id).toBe(true);
    expect(m.metrics.cutLengthMm).toBeGreaterThan(0);
    expect(m.metrics.creaseLengthMm).toBeGreaterThan(0);
    expect(m.metrics.netAreaM2).toBeLessThanOrEqual(m.metrics.blankAreaM2 + 1e-9);
    expect(m.metrics.pieceCount).toBe(def.pieces);
  });

  it.each(cases)("closes to the requested size for $dims.L×$dims.W×$dims.H t=$t", ({ dims, t }) => {
    const m = generateEcmaDieline(def, dims, { thicknessMm: t });
    const layers = SIDE_LAYERS[code] ?? { L: 1, W: 1 };
    const tol = 0.05 + 2 * t;
    expect(m.closedOuter.L).toBeGreaterThan(m.cartonInner.L);
    expect(Math.abs(m.closedOuter.L - (m.cartonInner.L + 2 * layers.L * t))).toBeLessThan(tol);
    expect(Math.abs(m.closedOuter.W - (m.cartonInner.W + 2 * layers.W * t))).toBeLessThan(tol);
    const header = code.startsWith("ECMA_HANGER") ? (m.panels.find((p) => p.id === "header")!.bbox.height) : 0;
    // Height: inner + end layers (2–3 boards each end), plus the hang tab above the top.
    const extra = m.closedOuter.H - m.cartonInner.H - header;
    expect(extra).toBeGreaterThan(2 * t - 1e-6);
    expect(extra).toBeLessThan(8 * t + 0.5);
  });

  it("forms the six faces", () => {
    const m = generateEcmaDieline(def, def.defaultDims, { thicknessMm: 0.48 });
    for (const f of ["front", "back", "left", "right", "top", "bottom"] as FaceId[]) expect(m.faces[f], f).toBeDefined();
    const front = m.faces.front!;
    expect(front.width).toBeCloseTo(m.closedOuter.L, 3);
    for (const z of m.safeZones) {
      const p = m.panels.find((x) => x.id === z.panelId)!;
      expect(z.rect.width).toBeLessThanOrEqual(p.bbox.width);
      expect(z.rect.x).toBeGreaterThanOrEqual(p.bbox.x - 1e-6);
    }
  });

  it("folds smoothly (no NaN at any progress, flat at 0)", () => {
    const m = generateEcmaDieline(def, def.defaultDims, { thicknessMm: 0.4 });
    for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
      const box = boundsAt(m, progress, computePoses(m, progress));
      expect(allFinite([box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z])).toBe(true);
    }
    const flat = boundsAt(m, 0).getSize(new Vector3());
    expect(flat.z).toBeLessThan(2); // flat sheet: only board thickness and stack offsets
  });
});

describe("print area math", () => {
  const t = 0.4;
  it("bleed grows cut edges by 3 mm and keeps crease edges", () => {
    const m = generateEcmaDieline(DEFINITION_BY_CODE.ECMA_TUCK_STE, { L: 90, W: 50, H: 150 }, { thicknessMm: t });
    const front = m.panels.find((p) => p.id === "front")!;
    const bleed = m.bleedRegions.find((r) => r.panelId === "front")!;
    // STE: front has creases left/right (sides) and is cut top/bottom.
    const frontArea = (90 + 2 * t) * (150 + 4 * t);
    expect(polygonArea(front.polygon)).toBeCloseTo(frontArea, 6);
    expect(polygonArea(bleed.polygon)).toBeCloseTo((90 + 2 * t) * (150 + 4 * t + 6), 6);
    const safe = m.safeZones.find((s) => s.panelId === "front")!;
    expect(safe.rect.width).toBeCloseTo(90 + 2 * t - 6, 6);
    expect(safe.rect.height).toBeCloseTo(150 + 4 * t - 6, 6);
  });

  it("window carton cuts a filmed aperture in the front", () => {
    const m = generateEcmaDieline(DEFINITION_BY_CODE.ECMA_WINDOW_RTE, { L: 120, W: 50, H: 200 }, { thicknessMm: t });
    const front = m.panels.find((p) => p.id === "front")!;
    expect(front.holes).toHaveLength(1);
    const hole = polygonArea(front.holes![0]);
    expect(hole).toBeGreaterThan(0.6 * 0.45 * 120 * 200 * 0.9);
    expect(m.films).toHaveLength(1);
    expect(m.metrics.filmAreaM2 * 1e6).toBeGreaterThan(hole);
  });

  it("pharma adds the leaflet to the inner depth and reserves a coding zone", () => {
    const def = DEFINITION_BY_CODE.ECMA_PHARMA_RTE;
    const m = generateEcmaDieline(def, { L: 60, W: 22, H: 105 }, { thicknessMm: t, model: { leafletThicknessMm: 4 } });
    expect(m.cartonInner).toEqual({ L: 60, W: 26, H: 105 });
    expect(m.closedOuter.W).toBeCloseTo(26 + 2 * t, 1);
    expect(m.reservedZones).toHaveLength(1);
    const z = m.reservedZones[0];
    const right = m.panels.find((p) => p.id === "right")!;
    expect(z.rect.x).toBeGreaterThanOrEqual(right.bbox.x);
    expect(z.rect.x + z.rect.width).toBeLessThanOrEqual(right.bbox.x + right.bbox.width);
    expect(m.options.tuckLock).toBe("slit");
    expect(m.panels.find((p) => p.id === "top")!.holes).toHaveLength(2);
  });

  it("seal end with tear strip has perforations round the walls", () => {
    const m = generateEcmaDieline(DEFINITION_BY_CODE.ECMA_SEAL_END_TEAR, { L: 160, W: 80, H: 110 }, { thicknessMm: t });
    expect(m.perfLines.length).toBe(10);
    expect(m.metrics.perfLengthMm).toBeGreaterThan(2 * 2 * (160 + 80));
    const plain = generateEcmaDieline(DEFINITION_BY_CODE.ECMA_SEAL_END, { L: 160, W: 80, H: 110 }, { thicknessMm: t });
    expect(plain.perfLines).toHaveLength(0);
  });

  it("hanger header carries the hole through both layers in register", () => {
    for (const code of ["ECMA_HANGER_EURO", "ECMA_HANGER_ROUND"] as const) {
      const m = generateEcmaDieline(DEFINITION_BY_CODE[code], DEFINITION_BY_CODE[code].defaultDims, { thicknessMm: t });
      const header = m.panels.find((p) => p.id === "header")!;
      const tag = m.panels.find((p) => p.id === "headerTag")!;
      expect(header.hingeKind).toBe("roll");
      expect(tag.foldAngleClosed).toBe(180);
      const [h] = header.holes!;
      const [g] = tag.holes!;
      // Mirror of the tag hole about the fold line equals the header hole.
      const foldY = header.bbox.y;
      const mirrored = g.map((q) => ({ x: q.x, y: 2 * foldY - q.y }));
      const area = (poly: Polygon) => polygonArea(poly);
      expect(area(mirrored)).toBeCloseTo(area(h), 6);
      const cy = (poly: Polygon) => poly.reduce((s, q) => s + q.y, 0) / poly.length;
      expect(cy(mirrored)).toBeCloseTo(cy(h), 6);
      // No crease at the header joint (the back runs on).
      expect(m.creaseLines.some((c) => Math.abs(c.a.y - header.bbox.y - header.bbox.height) < 1e-6 && Math.abs(c.b.y - c.a.y) < 1e-6 && c.a.x >= header.bbox.x - 1e-6 && c.b.x <= header.bbox.x + header.bbox.width + 1e-6)).toBe(false);
      if (code === "ECMA_HANGER_EURO") {
        const w = Math.max(...h.map((q) => q.x)) - Math.min(...h.map((q) => q.x));
        expect(w).toBeCloseTo(EURO_SLOT.slotWidth, 6);
      }
    }
  });

  it("flip-top has a back hinge crease, a free lid front and an inner frame piece", () => {
    const def = DEFINITION_BY_CODE.ECMA_FLIP_TOP;
    const m: EcmaTuckDielineModel = generateEcmaDieline(def, { L: 55, W: 22, H: 85 }, { thicknessMm: t });
    expect(m.pieces.map((p) => p.label)).toEqual(["Box", "Inner frame"]);
    const lidBack = m.panels.find((p) => p.id === "lidBack")!;
    expect(lidBack.foldAngleClosed).toBe(0);
    expect(m.creaseLines.some((c) => Math.abs(c.a.y - lidBack.hinge!.a.y) < 1e-6 && Math.abs(c.b.y - c.a.y) < 1e-6)).toBe(true);
    const lidFront = m.panels.find((p) => p.id === "lidFront")!;
    expect(lidFront.parentId).toBe("lidRight");
    // Inner frame ends up inside the shell, rising above the body edge.
    const poses = computePoses(m, 1);
    const box = boundsAt(m, 1, poses);
    const collarOnly = boundsAt({ ...m, panels: m.panels.filter((p) => p.pieceId === "collar") }, 1, poses);
    expect(collarOnly.min.x).toBeGreaterThan(box.min.x);
    expect(collarOnly.max.x).toBeLessThan(box.max.x);
    expect(collarOnly.max.z).toBeLessThan(box.max.z);
    expect(collarOnly.max.y).toBeLessThan(box.max.y);
  });

  it("double wall rolls inner walls inside the front and back", () => {
    const m = generateEcmaDieline(DEFINITION_BY_CODE.ECMA_DOUBLE_WALL_TUCK, { L: 65, W: 55, H: 160 }, { thicknessMm: t });
    const inners = m.panels.filter((p) => p.role === "inner");
    expect(inners.map((p) => p.parentId).sort()).toEqual(["back", "front"]);
    for (const p of inners) expect(p.foldAngleClosed).toBe(180);
  });

  it("reverse vs straight tuck put the bottom closure on different walls", () => {
    const owner = (code: EcmaTuckDefinition["code"], id: string) => generateEcmaDieline(DEFINITION_BY_CODE[code], { L: 60, W: 40, H: 120 }, { thicknessMm: t }).panels.find((p) => p.id === id)!.parentId;
    expect([owner("ECMA_TUCK_STE", "top"), owner("ECMA_TUCK_STE", "bottom")]).toEqual(["back", "back"]);
    expect([owner("ECMA_TUCK_RTE", "top"), owner("ECMA_TUCK_RTE", "bottom")]).toEqual(["back", "front"]);
    expect([owner("ECMA_TUCK_AIRPLANE", "top"), owner("ECMA_TUCK_AIRPLANE", "bottom")]).toEqual(["front", "front"]);
    expect([owner("ECMA_TUCK_FRENCH_RTE", "top"), owner("ECMA_TUCK_FRENCH_RTE", "bottom")]).toEqual(["front", "back"]);
  });
});
