import { describe, expect, it } from "vitest";
import {
  LABEL_STOCKS,
  VESSELS,
  VESSEL_KINDS,
  WRAP_OVERLAP_MM,
  bandSpec,
  brimfulVolumeMl,
  buildProfile,
  describeVessel,
  flatPoint,
  labelRun,
  labelSvg,
  radiusAt,
  roundCorners,
  sectionArea,
  sectionPerimeter,
  sleeveRatioAt,
  sleeveSpec,
  surfaceUv,
  vesselEnvelope,
  volumeToHeightMl,
} from "../index";

const REVOLVED = VESSEL_KINDS.filter((k) => k !== "STAND_UP_POUCH" && k !== "SQUEEZE_TUBE");

describe("profiles", () => {
  it("start on the axis, stand on y = 0 and reach the finish top", () => {
    for (const kind of VESSEL_KINDS) {
      for (const preset of VESSELS[kind].presets) {
        const p = buildProfile(kind, preset.dims, preset.neck);
        expect(p.outer[0].r).toBe(0);
        const minY = Math.min(...p.outer.map((q) => q.y));
        const maxY = Math.max(...p.outer.map((q) => q.y));
        expect(minY).toBeCloseTo(0, 6);
        expect(maxY).toBeLessThanOrEqual(kind === "SQUEEZE_TUBE" ? preset.dims.H + 40 : preset.dims.H + 1e-6);
        for (const q of p.outer) {
          expect(Number.isFinite(q.r) && Number.isFinite(q.y)).toBe(true);
          expect(q.r).toBeGreaterThanOrEqual(0);
        }
        expect(p.body.y1).toBeGreaterThan(p.body.y0);
      }
    }
  });

  it("the body radius equals half the stated diameter", () => {
    for (const kind of REVOLVED) {
      for (const preset of VESSELS[kind].presets) {
        const p = buildProfile(kind, preset.dims, preset.neck);
        const mid = (p.body.y0 + p.body.y1) / 2;
        const expected = preset.dims.D / 2 - (preset.dims.taper ?? 0) / 4;
        expect(radiusAt(p.outer, mid)).toBeCloseTo(expected, 0);
      }
    }
  });

  it("brimful volume of every preset matches its nominal capacity (overflow 0-35%)", () => {
    for (const kind of REVOLVED) {
      for (const preset of VESSELS[kind].presets) {
        const ml = brimfulVolumeMl(buildProfile(kind, preset.dims, preset.neck));
        const ratio = ml / preset.capacityMl;
        expect(ratio, `${preset.id}: ${ml.toFixed(0)} ml`).toBeGreaterThan(0.98);
        expect(ratio, `${preset.id}: ${ml.toFixed(0)} ml`).toBeLessThan(1.35);
      }
    }
  });

  it("volume grows with fill height", () => {
    const p = buildProfile("WIDE_JAR", VESSELS.WIDE_JAR.presets[2].dims);
    const a = volumeToHeightMl(p, 40);
    const b = volumeToHeightMl(p, 80);
    expect(b).toBeGreaterThan(a);
    expect(volumeToHeightMl(p, 0)).toBe(0);
    // a straight jar: volume between two heights = pi r^2 h
    const rIn = 71.8 / 2 - p.wallMm;
    expect(b - a).toBeCloseTo((Math.PI * rIn * rIn * 40) / 1000, 0);
  });

  it("scales parametrically: a taller bottle holds more", () => {
    const small = brimfulVolumeMl(buildProfile("ROUND_BOTTLE", { D: 65, H: 180 }));
    const big = brimfulVolumeMl(buildProfile("ROUND_BOTTLE", { D: 65, H: 240 }));
    expect(big).toBeGreaterThan(small * 1.25);
  });

  it("rounded corners keep the end points and stay tangent-continuous", () => {
    const pts = roundCorners([{ r: 0, y: 0 }, { r: 10, y: 0, round: 3 }, { r: 10, y: 20 }], 8);
    expect(pts[0]).toMatchObject({ r: 0, y: 0 });
    expect(pts[pts.length - 1]).toMatchObject({ r: 10, y: 20 });
    // fillet starts 3 mm before the corner (90 degrees: d = R)
    expect(pts[1].r).toBeCloseTo(7, 6);
    expect(pts[pts.length - 2].y).toBeCloseTo(3, 6);
  });

  it("the neck-label zone lies on the straight cone of the shoulder", () => {
    const p = buildProfile("ROUND_BOTTLE", { D: 65, H: 197 });
    const sh = p.shoulder!;
    for (const t of [0, 0.5, 1]) {
      const y = sh.y0 + (sh.y1 - sh.y0) * t;
      expect(radiusAt(p.outer, y)).toBeCloseTo(sh.r0 + (sh.r1 - sh.r0) * t, 1);
    }
  });

  it("section area and girth are exact for circles and rectangles", () => {
    expect(sectionPerimeter({ kind: "round" }, 10)).toBeCloseTo(2 * Math.PI * 10, 9);
    expect(sectionArea({ kind: "round" }, 10)).toBeCloseTo(Math.PI * 100, 9);
    const sq = { kind: "roundedRect", cornerRatio: 0, depthRatio: 0.5 } as const;
    expect(sectionPerimeter(sq, 10)).toBeCloseTo(2 * (20 + 10), 9);
    expect(sectionArea(sq, 10)).toBeCloseTo(20 * 10, 9);
  });
});

describe("label specs", () => {
  it("a wrap label is circumference + overlap by the band height, plus bleed", () => {
    const d = describeVessel({ kind: "ROUND_BOTTLE", dims: { D: 65, H: 197 }, surfaces: ["WRAP"] });
    const wrap = d.labels[0];
    expect(wrap.shape).toBe("rect");
    expect(wrap.trimWidthMm).toBeCloseTo(Math.PI * 65 + WRAP_OVERLAP_MM, 0);
    expect(wrap.printWidthMm).toBeCloseTo(wrap.trimWidthMm + 2 * wrap.bleedMm, 6);
    expect(wrap.trimAreaM2).toBeCloseTo((wrap.trimWidthMm * wrap.trimHeightMm) / 1e6, 4);
    expect(wrap.defaultStock).toBe("WHITE_BOPP");
    expect(wrap.stocks).not.toContain("PETG_SHRINK");
  });

  it("cone labels unroll to an annular sector without distortion", () => {
    const r0 = 30;
    const r1 = 20;
    const h = 24;
    const spec = bandSpec("NECK", 100, 100 + h, r0, r1, -Math.PI, 2 * Math.PI);
    expect(spec.shape).toBe("sector");
    const g = spec.sector!;
    expect(g.outerRadiusMm - g.innerRadiusMm).toBeCloseTo(Math.hypot(h, r0 - r1), 9);
    // exact frustum lateral area, plus the glued overlap a full wrap runs past the seam
    // (WRAP_OVERLAP_MM at the big end, R5-3Q-F-19)
    const k = (2 * Math.PI + WRAP_OVERLAP_MM / Math.max(r0, r1)) / (2 * Math.PI);
    expect(spec.trimAreaM2 * 1e6).toBeCloseTo(Math.PI * (r0 + r1) * Math.hypot(h, r0 - r1) * k, 3);
    // the overlap is WRAP_OVERLAP_MM of arc at the big (outer) edge, past s = 1
    expect((g.angle - g.wrapAngle!) * g.outerRadiusMm).toBeCloseTo(WRAP_OVERLAP_MM, 6);
    expect(spec.overlapMm).toBe(WRAP_OVERLAP_MM);
    // isometry: small steps on the cone have the same length on the flat label
    const ds = 1e-4;
    for (const t of [0.1, 0.5, 0.9]) {
      const r = r0 + (r1 - r0) * t;
      const a = flatPoint(spec, 0.4, t);
      const b = flatPoint(spec, 0.4 + ds, t);
      expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(r * 2 * Math.PI * ds, 7);
      const c = flatPoint(spec, 0.4, t + ds);
      expect(Math.hypot(c.x - a.x, c.y - a.y)).toBeCloseTo(Math.hypot(h, r0 - r1) * ds, 7);
    }
    // the bottom (wider) edge is lower on the flat sheet, and everything is inside the print area
    expect(flatPoint(spec, 0.5, 0).y).toBeGreaterThan(flatPoint(spec, 0.5, 1).y);
    for (const s of [0, 0.25, 0.5, 0.75, 1])
      for (const t of [0, 1]) {
        const p = flatPoint(spec, s, t);
        expect(p.x).toBeGreaterThanOrEqual(spec.bleedMm - 1e-6);
        expect(p.x).toBeLessThanOrEqual(spec.printWidthMm - spec.bleedMm + 1e-6);
        expect(p.y).toBeGreaterThanOrEqual(spec.bleedMm - 1e-6);
        expect(p.y).toBeLessThanOrEqual(spec.printHeightMm - spec.bleedMm + 1e-6);
      }
  });

  it("a cone widening upwards puts the apex below", () => {
    const spec = bandSpec("WRAP", 0, 30, 30, 34, -Math.PI / 4, Math.PI / 2);
    expect(spec.sector!.apexAbove).toBe(false);
    expect(flatPoint(spec, 0.5, 0).y).toBeGreaterThan(flatPoint(spec, 0.5, 1).y);
  });

  it("maps rectangle UVs linearly inside the bleed", () => {
    const spec = bandSpec("FRONT", 10, 60, 30, 30, -1, 2);
    const [u0, v0] = surfaceUv(spec, 0, 0);
    const [u1, v1] = surfaceUv(spec, 1, 1);
    expect(u0).toBeCloseTo(spec.bleedMm / spec.printWidthMm, 9);
    expect(v0).toBeCloseTo(spec.bleedMm / spec.printHeightMm, 9);
    expect(u1).toBeCloseTo(1 - spec.bleedMm / spec.printWidthMm, 9);
    expect(v1).toBeCloseTo(1 - spec.bleedMm / spec.printHeightMm, 9);
    expect(spec.trimWidthMm).toBeCloseTo(60, 6);
  });

  it("shrink sleeves are sized from the widest girth and checked against PETG shrink", () => {
    const p = buildProfile("ROUND_BOTTLE", { D: 65, H: 197 });
    const s = sleeveSpec(p, 1, p.fillMaxY);
    const g = s.sleeve!;
    expect(g.circumferenceMm).toBeGreaterThanOrEqual(Math.PI * 65 * 1.03);
    expect(g.layFlatMm).toBeCloseTo(g.circumferenceMm / 2 + g.seamMm / 2, 1);
    expect(g.maxShrink).toBeGreaterThan(0.4);
    expect(g.maxShrink * 100).toBeLessThan(LABEL_STOCKS.PETG_SHRINK.shrink!.designLimitPct);
    expect(s.stocks).toEqual(["PETG_SHRINK"]);
    expect(sleeveRatioAt(s, 0.5)).toBeCloseTo(1 / 1.03, 1);
    expect(sleeveRatioAt(s, 1)).toBeLessThan(0.6);
    // a wide bottle with a 28 mm neck needs more shrink than PETG can give
    const wide = buildProfile("ROUND_BOTTLE", { D: 100, H: 250 });
    expect(sleeveSpec(wide, 1, wide.fillMaxY).warnings.some((w) => w.startsWith("sleeve.shrinkTooHigh"))).toBe(true);
  });

  it("every registered surface produces a spec for every preset", () => {
    for (const kind of VESSEL_KINDS) {
      const def = VESSELS[kind];
      for (const preset of def.presets) {
        const d = describeVessel({ kind, dims: preset.dims, neck: preset.neck, surfaces: def.surfaces });
        expect(d.labels.map((l) => l.kind).sort(), `${preset.id}`).toEqual([...def.surfaces].sort());
        for (const l of d.labels) {
          expect(l.trimWidthMm).toBeGreaterThan(5);
          expect(l.trimHeightMm).toBeGreaterThan(5);
          expect(l.stocks).toContain(l.defaultStock);
          expect(l.finishes).toContain("NONE");
        }
      }
    }
  });

  it("envelopes include the closure", () => {
    const e = vesselEnvelope("PUMP_BOTTLE", { D: 58, H: 129 });
    expect(e.height).toBeGreaterThan(129 + 25);
    expect(e.width).toBeGreaterThanOrEqual(58);
    const pouch = vesselEnvelope("STAND_UP_POUCH", { D: 160, H: 230, G: 80 });
    expect(pouch).toEqual({ width: 160, depth: 80, height: 230 });
  });

  it("draws an SVG template with trim, bleed and safe zone", () => {
    const d = describeVessel({ kind: "WIDE_JAR", dims: { D: 76, H: 40, taper: 6 }, surfaces: ["WRAP", "LID"] });
    for (const l of d.labels) {
      const svg = labelSvg(l, { title: l.name.en });
      expect(svg).toContain(`viewBox="0 0 ${l.printWidthMm}`);
      expect(svg.match(/<path/g)?.length).toBe(3);
    }
  });
});

describe("label runs (pricing inputs)", () => {
  it("imposes a wrap label one across and computes linear metres", () => {
    const wrap = describeVessel({ kind: "ROUND_BOTTLE", dims: { D: 65, H: 197 }, surfaces: ["WRAP"] }).labels[0];
    const run = labelRun(wrap, 1000);
    expect(run.across).toBe(1);
    expect(run.rotated).toBe(false);
    expect(run.repeatMm).toBeCloseTo(wrap.trimHeightMm + 3, 6);
    expect(run.linearMeters).toBe(Math.ceil(40 + ((1000 * run.repeatMm) / 1000) * 1.04));
    expect(run.die).toBe("STOCK_RECT");
  });

  it("packs small round lid labels several across", () => {
    const lid = describeVessel({ kind: "WIDE_JAR", dims: { D: 68, H: 76 }, surfaces: ["LID"] }).labels[0];
    const run = labelRun(lid, 5000);
    expect(run.across).toBe(Math.floor((320 + 3) / (lid.trimWidthMm + 3)));
    expect(run.labelsPerMeter).toBeCloseTo((run.across * 1000) / (lid.trimWidthMm + 3), 0);
    expect(run.die).toBe("STOCK_ROUND");
    expect(run.labelAreaM2).toBeCloseTo(5000 * lid.trimAreaM2, 3);
  });

  it("reports labels that do not fit the web", () => {
    const wrap = describeVessel({ kind: "ROUND_BOTTLE", dims: { D: 100, H: 300 }, surfaces: ["WRAP"] }).labels[0];
    expect(labelRun(wrap, 100, { webWidthMm: 250 }).fits).toBe(false);
  });
});
