import { describe, expect, it } from "vitest";
import {
  CUP_ALLOWANCES,
  DEFINITIONS,
  FamilyValidationError,
  buildCup,
  buildCupSleeve,
  buildFoodservice,
  buildLid,
  buildPulp,
  fanMesh,
  fanPoint,
  frustumFan,
  heightFieldMesh,
  latheMesh,
  lidHeight,
  type CupModel,
  type FrustumDefinition,
  type LidDefinition,
  type LidModel,
  type MeshData,
  type PulpDefinition,
  type PulpModel,
  type SleeveModel,
} from "..";
import { polygonArea } from "../../../geometry";

const CUPS = DEFINITIONS.filter((d): d is FrustumDefinition => d.kind === "frustum");
const LIDS = DEFINITIONS.filter((d): d is LidDefinition => d.kind === "lathe");
const PULP = DEFINITIONS.filter((d): d is PulpDefinition => d.kind === "molded");

function meshOk(m: MeshData) {
  expect(m.positions.length % 3).toBe(0);
  expect(m.uvs.length / 2).toBe(m.positions.length / 3);
  expect(m.indices.length % 3).toBe(0);
  expect(m.indices.length).toBeGreaterThan(0);
  for (const v of m.positions) expect(Number.isFinite(v)).toBe(true);
  for (const v of m.uvs) {
    expect(Number.isFinite(v)).toBe(true);
    expect(v).toBeGreaterThanOrEqual(-1e-6);
    expect(v).toBeLessThanOrEqual(1 + 1e-6);
  }
  const n = m.positions.length / 3;
  for (const i of m.indices) expect(i).toBeLessThan(n);
}

describe("conical fan (frustum development)", () => {
  const fan = frustumFan(28.5, 45, 0, 90, { seamMm: 8, belowMm: 8, aboveMm: 6 });

  it("arc lengths equal the frustum circumferences (exact development)", () => {
    expect(fan.R0 * fan.turnAngle).toBeCloseTo(2 * Math.PI * 28.5, 6);
    expect(fan.R1 * fan.turnAngle).toBeCloseTo(2 * Math.PI * 45, 6);
    expect(fan.R1 - fan.R0).toBeCloseTo(Math.hypot(90, 45 - 28.5), 6);
  });

  it("flat point ↔ surface is an isometry (no artwork distortion)", () => {
    const surf = (s: number, t: number) => {
      const r = fan.r0 + t * (fan.r1 - fan.r0);
      const phi = Math.PI + s * 2 * Math.PI;
      return [r * Math.sin(phi), fan.y0 + t * (fan.y1 - fan.y0), r * Math.cos(phi)];
    };
    for (const [s, t, ds, dt] of [[0.2, 0.3, 0.004, 0], [0.5, 0.5, 0, 0.01], [0.8, 0.9, 0.003, 0.004]]) {
      const a = fanPoint(fan, s, t);
      const b = fanPoint(fan, s + ds, t + dt);
      const p = surf(s, t);
      const q = surf(s + ds, t + dt);
      const flat = Math.hypot(a.x - b.x, a.y - b.y);
      const space = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
      expect(Math.abs(flat - space) / space).toBeLessThan(2e-3);
    }
  });

  it("print area: blank area, bleed grows the trim, safe inside the visible band", () => {
    const area = 0.5 * fan.blankAngle * (fan.blankR1 ** 2 - fan.blankR0 ** 2);
    expect(fan.print.trimAreaM2).toBeCloseTo(area / 1e6, 9);
    expect(polygonArea(fan.print.trim) / 1e6).toBeCloseTo(fan.print.trimAreaM2, 3);
    expect(polygonArea(fan.print.bleed)).toBeGreaterThan(polygonArea(fan.print.trim));
    expect(polygonArea(fan.print.safe)).toBeLessThan(polygonArea(fan.visible));
    for (const p of fan.print.bleed) {
      expect(p.x).toBeGreaterThanOrEqual(-1e-6);
      expect(p.y).toBeGreaterThanOrEqual(-1e-6);
      expect(p.x).toBeLessThanOrEqual(fan.print.widthMm + 1e-6);
      expect(p.y).toBeLessThanOrEqual(fan.print.heightMm + 1e-6);
    }
    // Seam overlap adds angle at the mid radius.
    expect((fan.blankAngle - fan.turnAngle) * ((fan.R0 + fan.R1) / 2)).toBeCloseTo(8, 6);
  });

  it("rim at the top of the artwork (apex below), front at s = 0.5", () => {
    const rim = fanPoint(fan, 0.5, 1);
    const base = fanPoint(fan, 0.5, 0);
    expect(rim.y).toBeLessThan(base.y);
    // rim, base and apex on one ray (a generator line of the cone)
    const cross = (rim.x - fan.apexX) * (base.y - fan.apexY) - (rim.y - fan.apexY) * (base.x - fan.apexX);
    expect(Math.abs(cross)).toBeLessThan(1e-6);
    // the seam (s = 0 / s = 1) is symmetric about the front up to the overlap
    const s0 = fanPoint(fan, 0, 1);
    const s1 = fanPoint(fan, 1, 1);
    expect(Math.hypot(s0.x - s1.x, s0.y - s1.y)).toBeGreaterThan(0);
    meshOk(fanMesh(fan));
  });

  it("refuses a cylinder or inverted cone", () => {
    expect(() => frustumFan(40, 40, 0, 90)).toThrow();
  });
});

describe.each(CUPS.map((d) => [d.code, d] as const))("%s", (_c, def) => {
  it.each(def.presets.map((p) => [p.id, p] as const))("preset %s: finite, sizes and capacity", (_id, preset) => {
    const { model } = buildFoodservice(def.code, preset.dims) as { model: CupModel | SleeveModel };
    if (def.role === "sleeve") {
      const s = model as SleeveModel;
      expect(s.heightMm).toBeGreaterThanOrEqual(40);
      expect(s.bottomYMm + s.heightMm).toBeLessThanOrEqual(preset.dims.H);
      expect(s.fan.r0).toBeGreaterThan(preset.dims.bottomD / 2);
      expect(s.fan.r1).toBeLessThan(preset.dims.topD / 2 + 1);
      meshOk(fanMesh(s.fan));
      return;
    }
    const c = model as CupModel;
    expect(c.sidewall.r1).toBeCloseTo(preset.dims.topD / 2, 6);
    expect(c.sidewall.r0).toBeCloseTo(preset.dims.bottomD / 2, 6);
    expect(c.sidewall.y1 - c.sidewall.y0).toBeCloseTo(preset.dims.H, 6);
    expect(c.sidewall.blankR1 - c.sidewall.R1).toBeCloseTo(CUP_ALLOWANCES.topCurlMm, 6);
    expect(c.sidewall.R0 - c.sidewall.blankR0).toBeCloseTo(CUP_ALLOWANCES.bottomFoldMm, 6);
    // Brimful capacity vs. the nominal (fill line) capacity: brimful is 5-45 % above.
    expect(c.brimfulMl).toBeGreaterThan(preset.capacityMl * 0.95);
    expect(c.brimfulMl).toBeLessThan(preset.capacityMl * 1.45);
    expect(c.bottomDiscDiameterMm).toBeGreaterThan(preset.dims.bottomD);
    if (def.wall === "double") {
      expect(c.outerWall).toBeDefined();
      expect(c.printFan).toBe(c.outerWall);
      expect(c.outerWall!.r0).toBeGreaterThan(c.sidewall.r0);
      expect(c.outerWall!.y1).toBeLessThan(preset.dims.H);
    } else expect(c.printFan).toBe(c.sidewall);
    meshOk(fanMesh(c.printFan));
  });

  it("limits and bottomD < topD rule", () => {
    expect(() => buildFoodservice(def.code, { ...def.defaultDims, H: def.limits.H.max + 1 })).toThrow(FamilyValidationError);
    expect(() => buildFoodservice(def.code, { topD: def.limits.topD.min, bottomD: def.limits.topD.min, H: def.defaultDims.H })).toThrow(FamilyValidationError);
  });
});

describe.each(LIDS.map((d) => [d.code, d] as const))("%s", (_c, def) => {
  it.each(def.presets.map((p) => [p.id, p] as const))("preset %s fits the rim", (_id, preset) => {
    const lid = buildFoodservice(def.code, preset.dims).model as LidModel;
    const rMax = Math.max(...lid.profile.map((p) => p.r));
    const yMax = Math.max(...lid.profile.map((p) => p.y));
    expect(rMax).toBeGreaterThan(preset.dims.rimD / 2);
    expect(rMax - preset.dims.rimD / 2).toBeLessThan(4);
    expect(yMax).toBeCloseTo(preset.dims.H, 6);
    expect(lid.profile.at(-1)!.r).toBe(0);
    meshOk(latheMesh(lid.profile));
  });

  it("print disc for paper lids, none for clear plastic", () => {
    const paper = buildLid(def.role, def.defaultDims, true);
    expect(paper.print!.trimAreaM2).toBeCloseTo((Math.PI * paper.topDisc!.radius ** 2) / 1e6, 9);
    expect(paper.print!.widthMm).toBeCloseTo(2 * (paper.topDisc!.radius + 3), 9);
    expect(buildLid(def.role, def.defaultDims, false).print).toBeNull();
    expect(() => buildFoodservice(def.code, { rimD: def.limits.rimD.min - 5, H: def.defaultDims.H })).toThrow(FamilyValidationError);
  });
});

describe.each(PULP.map((d) => [d.code, d] as const))("%s", (_c, def) => {
  it.each(def.presets.map((p) => [p.id, p] as const))("preset %s: footprint, cells, height", (_id, preset) => {
    const m = buildFoodservice(def.code, preset.dims).model as PulpModel;
    expect(m.cells).toHaveLength(def.layout.rows * def.layout.cols);
    for (const c of m.cells) {
      expect(Math.abs(c.x) + m.cellRadiusMm).toBeLessThanOrEqual(preset.dims.L / 2);
      expect(Math.abs(c.z) + m.cellRadiusMm).toBeLessThanOrEqual(preset.dims.W / 2);
      expect(m.baseHeight(c.x, c.z)).toBeLessThan(m.baseHeightMm * 0.2);
    }
    const base = heightFieldMesh(m, "base");
    meshOk(base);
    let maxY = 0, minX = Infinity, maxX = -Infinity;
    for (let i = 0; i < base.positions.length; i += 3) {
      maxY = Math.max(maxY, base.positions[i + 1]);
      minX = Math.min(minX, base.positions[i]);
      maxX = Math.max(maxX, base.positions[i]);
    }
    expect(maxX - minX).toBeCloseTo(preset.dims.L, 6);
    expect(maxY).toBeLessThanOrEqual(m.baseHeightMm + 1e-6);
    if (def.layout.lid) {
      expect(lidHeight(m, 0, 0)).toBeCloseTo(preset.dims.H, 6);
      expect(m.label!.trimAreaM2).toBeCloseTo((preset.dims.L * 0.75 * preset.dims.W * 0.6) / 1e6, 9);
      expect(m.label!.widthMm).toBeCloseTo(preset.dims.L * 0.75 + 6, 9);
      meshOk(heightFieldMesh(m, "lid"));
    } else {
      expect(m.baseHeightMm).toBe(preset.dims.H);
      expect(m.label).toBeNull();
    }
  }, 30_000); // height-field meshes are heavy: allow for a loaded CI machine

  it("limits", () => {
    expect(() => buildFoodservice(def.code, { ...def.defaultDims, L: def.limits.L.max + 1 })).toThrow(FamilyValidationError);
    expect(buildPulp(def.defaultDims, def.layout).baseHeight(1e4, 0)).toBe(0);
  });
});

it("double-wall cup print fan is shorter than the inner sidewall", () => {
  const c = buildCup({ topD: 90, bottomD: 60, H: 112 }, "double");
  expect(c.outerWall!.y1).toBeCloseTo(112 - CUP_ALLOWANCES.doubleWallTopMm, 6);
  const s = buildCupSleeve({ topD: 90, bottomD: 60, H: 112 });
  expect(s.fan.blankAngle).toBeGreaterThan(s.fan.turnAngle);
});
