import { describe, expect, it } from "vitest";
import { VESSELS, VESSEL_KINDS, describeVessel, surfaceUv } from "@/lib/vessels";
import { buildClosure } from "../closures";
import {
  bandLabelGeometry,
  bodyGeometry,
  discLabelGeometry,
  liquidGeometry,
  outwardWindingRatio,
  pouchPanelGeometry,
  sectionPoint,
  sleeveGeometry,
  tubeBodyGeometry,
} from "../geometry";

describe("vessel geometry", () => {
  it("bodies of every revolved preset face outwards with unit normals", () => {
    for (const kind of VESSEL_KINDS) {
      if (kind === "STAND_UP_POUCH" || kind === "SQUEEZE_TUBE") continue;
      for (const preset of VESSELS[kind].presets) {
        const d = describeVessel({ kind, dims: preset.dims, neck: preset.neck, surfaces: [] });
        const g = bodyGeometry(d.profile, 48);
        expect(outwardWindingRatio(g), preset.id).toBeGreaterThan(0.97);
        const n = g.getAttribute("normal");
        for (let i = 0; i < n.count; i += 37) expect(Math.hypot(n.getX(i), n.getY(i), n.getZ(i))).toBeCloseTo(1, 4);
        const box = g.boundingBox!;
        expect(box.min.y).toBeCloseTo(0, 3);
        expect(box.max.x).toBeLessThanOrEqual(preset.dims.D / 2 + 3.5);
        g.dispose();
        liquidGeometry(d.profile, 24).dispose();
      }
    }
  });

  it("rounded-square sections start front-centre and walk to the right", () => {
    const sec = { kind: "roundedRect", cornerRatio: 0.2, depthRatio: 1 } as const;
    const o = { x: 0, z: 0, nx: 0, nz: 0 };
    sectionPoint(sec, 20, 1, 0, o);
    expect(o).toMatchObject({ x: 0, z: 20, nx: 0, nz: 1 });
    sectionPoint(sec, 20, 1, 0.25, o);
    expect(o.x).toBeCloseTo(20, 6);
    expect(o.nx).toBeCloseTo(1, 6);
    sectionPoint(sec, 20, 1, 0.5, o);
    expect(o.z).toBeCloseTo(-20, 6);
    // squareness 0 = circle
    sectionPoint(sec, 20, 0, 0.125, o);
    expect(Math.hypot(o.x, o.z)).toBeCloseTo(20, 6);
  });

  it("label bands sit on the body with UVs that match the flat print contract", () => {
    const d = describeVessel({ kind: "ROUND_BOTTLE", dims: { D: 65, H: 197 }, surfaces: ["WRAP", "NECK", "FRONT"] });
    for (const spec of d.labels) {
      const g = bandLabelGeometry(spec, 0.18, 64);
      expect(outwardWindingRatio(g)).toBeGreaterThan(0.99);
      const pos = g.getAttribute("position");
      const uv = g.getAttribute("uv");
      // first vertex = (s 0, t 0)
      const [u0, v0] = surfaceUv(spec, 0, 0);
      expect(uv.getX(0)).toBeCloseTo(u0, 5);
      expect(uv.getY(0)).toBeCloseTo(v0, 5);
      if (spec.placement.type === "band") {
        expect(pos.getY(0)).toBeCloseTo(spec.placement.y0, 5);
        expect(Math.hypot(pos.getX(0), pos.getZ(0))).toBeCloseTo(spec.placement.r0 + 0.18, 4);
      }
      g.dispose();
    }
  });

  it("front labels are centred on +Z (facing the default camera)", () => {
    const d = describeVessel({ kind: "BOSTON_ROUND", dims: { D: 45, H: 105 }, surfaces: ["FRONT"] });
    const g = bandLabelGeometry(d.labels[0], 0.18, 64);
    g.computeBoundingBox();
    expect(g.boundingBox!.max.z).toBeCloseTo(22.5 + 0.18, 1);
    expect(g.boundingBox!.min.z).toBeGreaterThan(-5);
    expect(g.boundingBox!.max.x).toBeCloseTo(-g.boundingBox!.min.x, 1);
    g.dispose();
  });

  it("shrink sleeves morph from a loose tube to the bottle profile", () => {
    const d = describeVessel({ kind: "ROUND_BOTTLE", dims: { D: 65, H: 197 }, surfaces: ["SHRINK_SLEEVE"] });
    const s = sleeveGeometry(d.profile, d.labels[0], 48);
    const looseR = d.labels[0].sleeve!.circumferenceMm / (2 * Math.PI);
    expect(Math.hypot(s.start.position[0], s.start.position[2])).toBeCloseTo(looseR, 3);
    // last ring (neck) is much narrower once shrunk
    const last = s.target.position.length - 3;
    expect(Math.hypot(s.target.position[last], s.target.position[last + 2])).toBeLessThan(looseR * 0.6);
    expect(s.start.position.length).toBe(s.target.position.length);
    s.geometry.dispose();
  });

  it("lid labels face up and read from the front", () => {
    const d = describeVessel({ kind: "WIDE_JAR", dims: { D: 68, H: 76 }, surfaces: ["LID"] });
    const g = discLabelGeometry(d.labels[0], 32);
    expect(g.getAttribute("normal").getY(0)).toBe(1);
    // the point at the back (-z) maps to the top of the artwork (v near 1)
    const pos = g.getAttribute("position");
    const uv = g.getAttribute("uv");
    let backV = 0;
    for (let i = 0; i < pos.count; i++) if (pos.getZ(i) < -d.labels[0].trimWidthMm / 2 + 1) backV = Math.max(backV, uv.getY(i));
    expect(backV).toBeGreaterThan(0.9);
    g.dispose();
  });

  it("pouch panels and tubes build with outward winding", () => {
    const dims = { D: 160, H: 230, G: 80 };
    for (const face of ["front", "back"] as const) {
      const g = pouchPanelGeometry(dims, face);
      expect(outwardWindingRatio(g)).toBeGreaterThan(0.97);
      g.dispose();
    }
    const t = tubeBodyGeometry({ D: 30, H: 120 });
    expect(outwardWindingRatio(t)).toBeGreaterThan(0.95);
    t.computeBoundingBox();
    // flattened seal is about pi/2 x the radius wide (girth preserved)
    expect(t.boundingBox!.max.x).toBeCloseTo((Math.PI / 2) * 15, 0);
    t.dispose();
  });

  it("every closure builds for its containers", () => {
    for (const kind of VESSEL_KINDS) {
      const def = VESSELS[kind];
      const preset = def.presets[0];
      const d = describeVessel({ kind, dims: preset.dims, neck: preset.neck, surfaces: [] });
      for (const c of def.closures) {
        const m = buildClosure(kind, c, preset.dims, d.profile);
        expect(m.topY).toBeGreaterThanOrEqual(d.profile.finishTopY - 1);
        for (const p of m.parts) {
          expect(p.geometry.getAttribute("position").count).toBeGreaterThan(3);
          p.geometry.dispose();
        }
      }
    }
  });
});
