import { describe, expect, it } from "vitest";
import { Matrix4, Vector3 } from "three";
import { BOARD_SPECS, DielineValidationError, computePoses, dielineToSvg, type DielineModel } from "../../..";
import { polygonArea } from "../../../geometry";
import {
  DEFINITIONS,
  FITTINGS,
  MIN_CELL_MM,
  cellLayout,
  fittingSchema,
  generateFitting,
  placedBounds,
  printArea,
  tryGenerateFitting,
  validateFittingParams,
  type FittingCode,
  type FittingDefinition,
  type FittingModel,
  type ResolvedFittingParams,
} from "..";

const T = BOARD_SPECS.E_FLUTE_KRAFT.thicknessMm; // 1.5 mm
const ARABIC = /^[؀-ۿ0-9\s×\-]+$/;
const DIACRITICS = /[ً-ْٰ]/;
const BRANDS = /(ikea|amazon|apple|nike|coca|pepsi|tetra|smurfit|dhl)/i;

const gen = (d: FittingDefinition, extra: Partial<ResolvedFittingParams> = {}, t = T): FittingModel =>
  generateFitting(d.code, { host: d.defaultHost, ...extra }, { thicknessMm: t });
const resolved = (d: FittingDefinition, host = d.defaultHost): ResolvedFittingParams => {
  const v = validateFittingParams(d, { host });
  if (!v.ok) throw new Error(JSON.stringify(v.issues));
  return v.params;
};
const finite = (m: FittingModel) => {
  const nums: number[] = [];
  for (const p of m.panels) for (const q of p.polygon) nums.push(q.x, q.y);
  for (const s of [...m.cutLines, ...m.creaseLines]) nums.push(s.a.x, s.a.y, s.b.x, s.b.y);
  nums.push(...m.placement.matrix, ...Object.values(m.metrics), m.closedOuter.L, m.closedOuter.W, m.closedOuter.H);
  for (const pose of computePoses(m, 1).values()) nums.push(...pose.world.elements);
  return nums.every(Number.isFinite);
};

describe("FEFCO 09 catalogue metadata", () => {
  it("covers group 09 with unique codes and slugs", () => {
    expect(DEFINITIONS.length).toBe(48);
    expect(new Set(DEFINITIONS.map((d) => d.code)).size).toBe(DEFINITIONS.length);
    expect(new Set(DEFINITIONS.map((d) => d.slug)).size).toBe(DEFINITIONS.length);
    for (const d of DEFINITIONS) {
      expect(d.code).toBe(`FEFCO_${d.fefco.toUpperCase()}`);
      expect(d.standard).toBe(`FEFCO ${d.fefco}`);
      expect(Number(d.fefco.slice(0, 4))).toBeGreaterThanOrEqual(900);
      expect(Number(d.fefco.slice(0, 4))).toBeLessThanOrEqual(976);
      expect(FITTINGS[d.code]).toBe(d);
    }
  });

  it.each(DEFINITIONS.map((d) => [d.code, d] as const))("%s has bilingual noun-form names, materials and presets", (_, d) => {
    expect(d.name.ar).toMatch(ARABIC);
    expect(d.name.ar).not.toMatch(DIACRITICS);
    expect(d.description.ar).not.toMatch(DIACRITICS);
    expect(d.name.en.length).toBeGreaterThan(3);
    expect(d.description.en.length).toBeGreaterThan(10);
    expect(`${d.name.en} ${d.description.en} ${d.description.ar}`).not.toMatch(BRANDS);
    expect(d.materials.length).toBeGreaterThan(0);
    expect(d.materials).toContain(d.defaultMaterial);
    expect(d.uses.length).toBeGreaterThan(0);
    expect(d.presets.length).toBeGreaterThanOrEqual(2);
    expect(d.presets.length).toBeLessThanOrEqual(4);
    expect(d.interpretation.length).toBeGreaterThan(10);
  });
});

describe.each(DEFINITIONS.map((d) => [d.code, d] as const))("%s", (_, d) => {
  it("default host: finite geometry, closed outer matches the declared outer size", () => {
    const m = gen(d);
    expect(finite(m)).toBe(true);
    const want = d.outer(resolved(d), T);
    const b = placedBounds(m);
    const size = b.max.clone().sub(b.min);
    // Board thickness and the 2D strip offsets of glue tabs are within one or two calipers.
    expect(Math.abs(size.x - want.L)).toBeLessThanOrEqual(2 * T + 0.01);
    expect(Math.abs(size.y - want.H)).toBeLessThanOrEqual(2 * T + 0.01);
    expect(Math.abs(size.z - want.W)).toBeLessThanOrEqual(2 * T + 0.01);
  });

  it("fits inside the host box once placed", () => {
    for (const preset of [{ dims: d.defaultHost, options: undefined }, ...d.presets]) {
      const m = generateFitting(d.code, { host: preset.dims, ...("options" in preset ? preset.options : {}) }, { thicknessMm: T });
      const b = placedBounds(m);
      const tol = T + 0.01;
      const floorTol = d.slot === "floor-gap" ? T + tol : tol;
      expect(b.min.x).toBeGreaterThanOrEqual(-tol);
      expect(b.min.y).toBeGreaterThanOrEqual(-floorTol);
      expect(b.min.z).toBeGreaterThanOrEqual(-tol);
      expect(b.max.x).toBeLessThanOrEqual(preset.dims.L + tol);
      expect(b.max.y).toBeLessThanOrEqual(preset.dims.H + tol);
      expect(b.max.z).toBeLessThanOrEqual(preset.dims.W + tol);
    }
  });

  it("dieline: bleed 3 mm, safe zones inside panels, print area math, metrics", () => {
    const m = gen(d);
    expect(m.bleedMm).toBe(3);
    expect(m.dieBounds.x).toBeCloseTo(3);
    expect(m.sheet.width).toBeCloseTo(m.dieBounds.width + 6);
    expect(m.cutLines.length).toBeGreaterThan(0);
    const pa = printArea(m);
    expect(pa.printableMm2).toBeGreaterThan(0);
    expect(pa.bleedMm2).toBeGreaterThanOrEqual(pa.printableMm2 - 1e-6);
    for (const z of m.safeZones) {
      const panel = m.panels.find((p) => p.id === z.panelId)!;
      expect(z.rect.x).toBeGreaterThanOrEqual(panel.bbox.x - 1e-6);
      expect(z.rect.x + z.rect.width).toBeLessThanOrEqual(panel.bbox.x + panel.bbox.width + 1e-6);
    }
    expect(m.panels.filter((p) => p.role === "glue").every((p) => !p.printable)).toBe(true);
    expect(m.metrics.netAreaM2).toBeLessThanOrEqual(m.metrics.blankAreaM2 + 1e-9);
    expect(m.metrics.pieceCount).toBe(m.pieces.length);
    if (d.pieces === 1) expect(m.pieces.length).toBe(1);
    expect(dielineToSvg(m as unknown as DielineModel)).toContain("<svg");
  });

  it("validates host limits and options", () => {
    const tooSmall = { ...d.defaultHost, L: d.hostLimits.L.min - 1 };
    expect(validateFittingParams(d, { host: tooSmall }).ok).toBe(false);
    expect(() => generateFitting(d.code, { host: tooSmall }, { thicknessMm: T })).toThrow(DielineValidationError);
    expect(tryGenerateFitting(d.code, { host: { ...d.defaultHost, H: Number.NaN } }, { thicknessMm: T })).toBeNull();
    expect(tryGenerateFitting(d.code, { host: d.defaultHost }, { thicknessMm: 0 })).toBeNull();
    for (const [k, spec] of Object.entries(d.options)) {
      expect(validateFittingParams(d, { host: d.defaultHost, [k]: spec!.max + 1 }).ok).toBe(false);
      expect(validateFittingParams(d, { host: d.defaultHost, [k]: spec!.min - 1 }).ok).toBe(false);
    }
    expect(fittingSchema(d).safeParse({ host: d.defaultHost }).success).toBe(true);
  });

  it("works with B-flute and boardboard calipers", () => {
    for (const mat of d.materials) {
      const m = gen(d, {}, BOARD_SPECS[mat].thicknessMm);
      expect(finite(m)).toBe(true);
    }
  });
});

describe("pads", () => {
  it("0900 fills the (L − W) gap between RSC inner flaps, top flush with the floor", () => {
    const m = generateFitting("FEFCO_0900", { host: { L: 400, W: 300, H: 250 }, clearanceMm: 0 }, { thicknessMm: T });
    const b = placedBounds(m);
    expect(b.max.x - b.min.x).toBeCloseTo(100, 3);
    expect(b.min.x).toBeCloseTo(150, 3);
    expect(b.max.y).toBeCloseTo(0, 3);
    expect(validateFittingParams(FITTINGS.FEFCO_0900, { host: { L: 300, W: 300, H: 100 } }).ok).toBe(false);
  });

  it("0901 print area equals the pad area; safe zone is inset by 5 mm", () => {
    const m = generateFitting("FEFCO_0901", { host: { L: 300, W: 200, H: 150 }, clearanceMm: 0 }, { thicknessMm: T });
    const pa = printArea(m);
    expect(pa.printableMm2).toBeCloseTo(300 * 200, 3);
    expect(pa.safeMm2).toBeCloseTo(290 * 190, 3);
    expect(pa.bleedMm2).toBeCloseTo(306 * 206, 3);
    expect(m.metrics.blankAreaM2).toBeCloseTo(0.06, 6);
  });
});

describe("partitions", () => {
  it("N × M grid: strip count, cell sizes and placement", () => {
    for (const [rows, cols] of [[2, 3], [3, 4], [4, 6], [1, 3], [3, 1]] as const) {
      const host = { L: 360, W: 240, H: 160 };
      const m = generateFitting("FEFCO_0933", { host, rows, cols }, { thicknessMm: T });
      expect(m.pieces.length).toBe(rows - 1 + cols - 1);
      const lay = cellLayout(host.L, host.W, rows, cols, T);
      expect(lay.cellL * cols + (cols - 1) * T).toBeCloseTo(host.L, 6);
      expect(lay.cellW * rows + (rows - 1) * T).toBeCloseTo(host.W, 6);
      // Each strip's mid-plane sits on the computed divider positions.
      const poses = computePoses(m, 1);
      const P = new Matrix4().fromArray(m.placement.matrix);
      const centre = (id: string) => poses.get(id)!;
      const b = placedBounds(m);
      expect(finite(m)).toBe(true);
      if (rows > 1) {
        expect(b.min.x).toBeCloseTo(1.5, 3);
        expect(b.max.x).toBeCloseTo(host.L - 1.5, 3);
      }
      if (cols > 1) {
        expect(b.min.z).toBeCloseTo(1.5, 3);
        expect(b.max.z).toBeCloseTo(host.W - 1.5, 3);
      }
      if (rows > 1 && cols > 1) {
        // Row-divider 0 mid-plane z, column-divider 0 mid-plane x, in host space.
        const r0 = m.panels.find((p) => p.id === "rowDivider0")!;
        const c0 = m.panels.find((p) => p.id === "colDivider0")!;
        const world = (id: string) => P.clone().multiply(centre(id).world);
        const rb = new Vector3(0, 0, -T / 2).applyMatrix4(world(r0.id));
        const cb = new Vector3(0, 0, -T / 2).applyMatrix4(world(c0.id));
        expect(rb.z).toBeCloseTo(lay.zs[0], 3);
        expect(cb.x).toBeCloseTo(lay.xs[0], 3);
      }
    }
  });

  it("slots interlock: each strip is slotted to half the low strip height", () => {
    const m = generateFitting("FEFCO_0933", { host: { L: 360, W: 270, H: 130 } }, { thicknessMm: T });
    const strip = m.panels.find((p) => p.id === "rowDivider0")!;
    // 3 column dividers → 3 slots of 4 extra vertices each.
    expect(strip.polygon.length).toBe(4 + 3 * 4);
    const full = strip.bbox.width * strip.bbox.height;
    const slotW = T + 0.6;
    expect(polygonArea(strip.polygon)).toBeCloseTo(full - 3 * slotW * (strip.bbox.height / 2), 3);
  });

  it("0935 high divider is taller than the cell strips", () => {
    const m = generateFitting("FEFCO_0935", { host: { L: 360, W: 270, H: 200 } }, { thicknessMm: T });
    const rows = m.panels.filter((p) => p.id.startsWith("rowDivider"));
    const heights = rows.map((p) => p.bbox.height).sort((a, b) => a - b);
    expect(heights[heights.length - 1]).toBeCloseTo(197, 3);
    expect(heights[0]).toBeCloseTo(120, 3);
    expect(validateFittingParams(FITTINGS.FEFCO_0935, { host: { L: 360, W: 270, H: 200 }, heightMm: 150, highMm: 100 }).ok).toBe(false);
  });

  it("rejects 1 × 1 grids and cells under the minimum opening", () => {
    const d = FITTINGS.FEFCO_0933;
    expect(validateFittingParams(d, { host: { L: 360, W: 270, H: 130 }, rows: 1, cols: 1 }).ok).toBe(false);
    expect(validateFittingParams(d, { host: { L: 100, W: 270, H: 130 }, rows: 2, cols: Math.floor(100 / MIN_CELL_MM) + 1 }).ok).toBe(false);
  });
});

describe("liners, cushions, corners", () => {
  it("0906 four-wall liner lines all walls to the full fitted size", () => {
    const m = generateFitting("FEFCO_0906", { host: { L: 300, W: 200, H: 150 }, clearanceMm: 4 }, { thicknessMm: T });
    const b = placedBounds(m);
    expect(b.max.x - b.min.x).toBeCloseTo(296, 2);
    expect(b.max.z - b.min.z).toBeCloseTo(196, 2);
    expect(b.max.y - b.min.y).toBeCloseTo(146, 2);
  });

  it("0920 compartment liner has a double-wall riser per divider", () => {
    const m = generateFitting("FEFCO_0920", { host: { L: 400, W: 300, H: 150 }, compartments: 3 }, { thicknessMm: T });
    expect(m.panels.filter((p) => /return/.test(p.label)).length).toBe(2);
    expect(m.panels.filter((p) => p.foldAngleClosed === -180).length).toBe(2);
  });

  it("accordion cushion stacks n layers", () => {
    for (const layers of [2, 3, 5, 8]) {
      const m = generateFitting("FEFCO_0942", { host: { L: 300, W: 200, H: 150 }, layers }, { thicknessMm: 3 });
      const b = placedBounds(m);
      expect(b.max.y - b.min.y).toBeCloseTo(layers * 3, 2);
    }
  });

  it("0951 / 0967 crease counts follow the score option", () => {
    const a = generateFitting("FEFCO_0951", { host: { L: 300, W: 200, H: 150 }, scores: 4, clearanceMm: 0 }, { thicknessMm: T });
    expect(a.creaseLines.length).toBe(4);
    expect(a.metrics.creaseLengthMm).toBeCloseTo(4 * 200, 3);
    const b = generateFitting("FEFCO_0967", { host: { L: 300, W: 200, H: 150 }, scores: 2, clearanceMm: 0 }, { thicknessMm: T });
    expect(b.metrics.creaseLengthMm).toBeCloseTo(2 * 200 + 2 * 300, 3);
  });

  it("corner protectors sit in the back-left corner", () => {
    for (const code of ["FEFCO_0970", "FEFCO_0976", "FEFCO_0976A", "FEFCO_0971"] as FittingCode[]) {
      const m = generateFitting(code, { host: { L: 300, W: 200, H: 150 }, sizeMm: 40 }, { thicknessMm: T });
      const b = placedBounds(m);
      expect(b.min.x).toBeCloseTo(0, 3);
      expect(b.min.z).toBeCloseTo(0, 3);
      expect(b.max.x).toBeLessThanOrEqual(40 + 2 * T);
      expect(b.max.z).toBeLessThanOrEqual(40 + 2 * T);
    }
  });
});
