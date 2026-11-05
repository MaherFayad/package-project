import { describe, expect, it } from "vitest";
import type { Dims } from "@/types";
import { DielineValidationError } from "../../../limits";
import { boundsAt, computePoses } from "../../../fold";
import { polygonArea } from "../../../geometry";
import type { DielinePanel } from "../../../types";
import {
  DEFINITIONS,
  DEFINITION_BY_CODE,
  FEFCO02_CODES,
  buildFefco02Dieline,
  tryBuildFefco02Dieline,
  validateFefco02Dims,
  validateFefco02Params,
  type Fefco02Definition,
  type Fefco02Model,
} from "..";

const THICKNESSES = [1.5, 3];
const DIACRITICS = /[ً-ْٰ]/;
const LATIN = /[A-Za-z]/;

/** Default, presets and both corners of the size limits. */
function sizesFor(def: Fefco02Definition): Dims[] {
  const { L, W, H } = def.params;
  const corners: Dims[] = [
    { L: L.min, W: W.min, H: H.min },
    { L: L.max, W: W.max, H: H.max },
  ];
  return [def.defaultDims, ...def.presets.map((p) => p.dims), ...corners].filter((d) => validateFefco02Dims(def, d).ok);
}

function assertFinite(value: unknown, path = "model"): void {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`${path} is ${value}`);
  } else if (Array.isArray(value)) value.forEach((v, i) => assertFinite(v, `${path}[${i}]`));
  else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) assertFinite(v, `${path}.${k}`);
}

const byId = (m: Fefco02Model, id: string): DielinePanel => {
  const p = m.panels.find((x) => x.id === id);
  if (!p) throw new Error(`no panel ${id}`);
  return p;
};
/** Depth of a top/bottom flap (its vertical extent on the sheet). */
const depth = (m: Fefco02Model, id: string) => byId(m, id).bbox.height;
const build = (code: (typeof FEFCO02_CODES)[number], dims: Dims, t = 3, params = {}) => buildFefco02Dieline(DEFINITION_BY_CODE[code], dims, { thicknessMm: t, params });

describe("FEFCO 02 catalogue metadata", () => {
  it("covers every published group 02 style exactly once", () => {
    expect(DEFINITIONS.map((d) => d.code)).toEqual([...FEFCO02_CODES]);
    expect(new Set(DEFINITIONS.map((d) => d.slug)).size).toBe(DEFINITIONS.length);
  });

  it.each(DEFINITIONS.map((d) => [d.code, d] as const))("%s has complete, valid metadata", (_c, def) => {
    expect(def.standard).toBe(`FEFCO ${def.code.slice(6)}`);
    expect(def.family).toBe("CORRUGATED");
    for (const s of [def.name.ar, def.description.ar]) {
      expect(s.length).toBeGreaterThan(5);
      expect(DIACRITICS.test(s)).toBe(false);
      expect(LATIN.test(s)).toBe(false);
    }
    expect(def.name.en.length).toBeGreaterThan(5);
    expect(def.description.en.length).toBeGreaterThan(20);
    expect(def.presets.length).toBeGreaterThanOrEqual(2);
    expect(def.presets.length).toBeLessThanOrEqual(4);
    expect(validateFefco02Dims(def, def.defaultDims).ok).toBe(true);
    for (const p of def.presets) {
      expect(validateFefco02Dims(def, p.dims).ok, `${def.code} preset ${p.id}`).toBe(true);
      expect(DIACRITICS.test(p.name.ar)).toBe(false);
    }
    expect(def.materials.length).toBeGreaterThan(0);
    for (const m of def.materials) expect(["E_FLUTE_KRAFT", "E_FLUTE_WHITE", "B_FLUTE_KRAFT"]).toContain(m);
    expect(def.uses.length).toBeGreaterThan(0);
    expect(validateFefco02Params(def, def.defaultParams(def.defaultDims)).ok).toBe(true);
  });
});

describe.each(DEFINITIONS.map((d) => [d.code, d] as const))("%s geometry", (_code, def) => {
  const cases = THICKNESSES.flatMap((t) => sizesFor(def).map((d) => [t, d] as const));

  it.each(cases)("t=%s %o: finite, closed dims match inner + board layers", (t, dims) => {
    const m = buildFefco02Dieline(def, dims, { thicknessMm: t });
    assertFinite(m.panels.map((p) => [p.polygon, p.hinge, p.holes ?? []]));
    assertFinite([m.cutLines, m.creaseLines, m.perfLines, m.bleedRegions, m.safeZones, m.metrics, m.closedOuter, m.sheet]);
    assertFinite(Object.values(m.faces).map((f) => f!.parts.map((x) => [x.rect, x.transform])));

    const o = m.closedOuter;
    const tol = 0.01;
    // Plan size: inner + one board per wall, plus at most one extra layer per side
    // (liners, the overlapped half of a split joint wall).
    expect(o.L).toBeGreaterThanOrEqual(dims.L + 2 * t - tol);
    expect(o.L).toBeLessThanOrEqual(dims.L + 4 * t + tol);
    expect(o.W).toBeGreaterThanOrEqual(dims.W + 2 * t - tol);
    expect(o.W).toBeLessThanOrEqual(dims.W + 4 * t + tol);
    const layers = def.endLayers.top + def.endLayers.bottom;
    if (def.code === "FEFCO_0217" || def.code === "FEFCO_0226") expect(o.H).toBeGreaterThan(dims.H + layers * t);
    else expect(o.H).toBeCloseTo(dims.H + layers * t, 2);

    for (const face of ["front", "back", "left", "right"] as const) expect(m.faces[face], face).toBeDefined();
    expect(m.faces.front!.width).toBeCloseTo(o.L, 1);
    expect(m.metrics.blankAreaM2).toBeGreaterThan(m.metrics.netAreaM2);
    expect(m.metrics.cutLengthMm).toBeGreaterThan(0);
    expect(m.metrics.creaseLengthMm).toBeGreaterThan(0);
  });

  it("every non-root panel hinges on its parent's outline", () => {
    const m = buildFefco02Dieline(def, def.defaultDims, { thicknessMm: 3 });
    const roots = m.panels.filter((p) => !p.parentId);
    expect(roots).toHaveLength(1);
    for (const p of m.panels) {
      if (!p.parentId) continue;
      const parent = byId(m, p.parentId);
      for (const q of [p.hinge!.a, p.hinge!.b]) {
        expect(q.x).toBeGreaterThanOrEqual(parent.bbox.x - 1e-6);
        expect(q.x).toBeLessThanOrEqual(parent.bbox.x + parent.bbox.width + 1e-6);
        expect(q.y).toBeGreaterThanOrEqual(parent.bbox.y - 1e-6);
        expect(q.y).toBeLessThanOrEqual(parent.bbox.y + parent.bbox.height + 1e-6);
      }
      expect(Number.isFinite(p.foldAngleClosed)).toBe(true);
    }
  });

  it("folds: flat at 0, finite poses throughout", () => {
    const m = buildFefco02Dieline(def, def.defaultDims, { thicknessMm: 3 });
    const flat = boundsAt(m, 0);
    expect(flat.max.z - flat.min.z).toBeLessThan(3 * 4 + 1e-6);
    for (const progress of [0.25, 0.5, 0.75, 1]) {
      const poses = computePoses(m, progress);
      expect(poses.size).toBe(m.panels.length);
      for (const pose of poses.values()) assertFinite(Array.from(pose.world.elements));
    }
  });

  it("print area: bleed grows cut edges only, safe zones inset by the safe margin, glue stays ink-free", () => {
    const m = buildFefco02Dieline(def, def.defaultDims, { thicknessMm: 3 });
    expect(m.bleedMm).toBe(3);
    expect(m.sheet.width).toBeCloseTo(m.dieBounds.width + 2 * m.bleedMm, 6);
    expect(m.sheet.height).toBeCloseTo(m.dieBounds.height + 2 * m.bleedMm, 6);
    for (const r of m.bleedRegions) {
      const p = byId(m, r.panelId);
      expect(p.printable).toBe(true);
      expect(p.role).not.toBe("glue");
      const per = p.polygon.reduce((s, q, i) => s + Math.hypot(p.polygon[(i + 1) % p.polygon.length].x - q.x, p.polygon[(i + 1) % p.polygon.length].y - q.y), 0);
      const area = polygonArea(r.polygon);
      expect(area).toBeGreaterThanOrEqual(polygonArea(p.polygon) - 1e-6);
      expect(area).toBeLessThanOrEqual(polygonArea(p.polygon) + per * m.bleedMm + 4 * m.bleedMm ** 2 * p.polygon.length + 1e-6);
    }
    expect(m.panels.filter((p) => p.role === "glue").every((p) => !p.printable)).toBe(true);
    for (const s of m.safeZones) {
      const p = byId(m, s.panelId);
      expect(s.rect.width).toBeCloseTo(p.bbox.width - 2 * m.safeMm, 6);
      expect(s.rect.height).toBeCloseTo(p.bbox.height - 2 * m.safeMm, 6);
    }
    expect(m.printRegions.outside).toHaveLength(m.bleedRegions.length);
  });
});

describe("FEFCO 02 flap geometry per the Code drawings", () => {
  const d: Dims = { L: 400, W: 300, H: 250 };
  const t = 3;
  const Lp = d.L + 2 * t;
  const Wp = d.W + 2 * t;

  it("0201: all flaps ½B, outer flaps meet", () => {
    const m = build("FEFCO_0201", d);
    for (const id of ["topFlap_front", "topFlap_back", "topFlap_left", "bottomFlap_right"]) expect(depth(m, id)).toBeCloseTo(Wp / 2, 6);
    expect(byId(m, "front").bbox.height).toBeCloseTo(d.H + 4 * t, 6);
  });

  it("0200: bottom flaps only", () => {
    const m = build("FEFCO_0200", d);
    expect(m.panels.some((p) => p.id.startsWith("topFlap"))).toBe(false);
    expect(m.panels.filter((p) => p.id.startsWith("bottomFlap"))).toHaveLength(4);
  });

  it("0202: outer flaps ½(B + o) overlap by o", () => {
    const m = build("FEFCO_0202", d, t, { overlapMm: 60 });
    expect(depth(m, "topFlap_front") + depth(m, "topFlap_back") - Wp).toBeCloseTo(60, 6);
  });

  it("0203: outer flaps full width; 0204: inner flaps ½L; 0205: all ½L; 0206: outer B + inner ½L", () => {
    expect(depth(build("FEFCO_0203", d), "topFlap_front")).toBeCloseTo(Wp - 2 * t, 6);
    const m4 = build("FEFCO_0204", d);
    expect(depth(m4, "topFlap_left")).toBeCloseTo(Lp / 2 - t, 6);
    expect(depth(m4, "topFlap_front")).toBeCloseTo(Wp / 2, 6);
    const m5 = build("FEFCO_0205", d);
    expect(depth(m5, "topFlap_front")).toBeCloseTo(Lp / 2, 6);
    const m6 = build("FEFCO_0206", d);
    expect(depth(m6, "topFlap_front")).toBeCloseTo(Wp - 2 * t, 6);
    expect(depth(m6, "topFlap_right")).toBeCloseTo(Lp / 2 - t, 6);
  });

  it("0207 / 0208 / 0229: integral division panels", () => {
    expect(build("FEFCO_0207", { L: 255, W: 170, H: 300 }).panels.filter((p) => p.role === "inner")).toHaveLength(4);
    expect(build("FEFCO_0208", { L: 300, W: 200, H: 200 }).panels.filter((p) => p.role === "inner")).toHaveLength(12);
    expect(build("FEFCO_0229", d).panels.filter((p) => p.role === "inner")).toHaveLength(8);
  });

  it("0209: top frame flaps of depth h", () => {
    const m = build("FEFCO_0209", d, t, { rimMm: 40 });
    expect(depth(m, "topFlap_front")).toBeCloseTo(40, 6);
    expect(depth(m, "bottomFlap_front")).toBeCloseTo(Wp / 2, 6);
  });

  it("0210 / 0211 / 0212 / 0215: tuck lids on the right panels", () => {
    const parent = (m: Fefco02Model, id: string) => byId(m, id).parentId;
    const m10 = build("FEFCO_0210", d);
    expect([parent(m10, "topLid"), parent(m10, "bottomLid")]).toEqual(["back", "back"]);
    const m11 = build("FEFCO_0211", d);
    expect([parent(m11, "topLid"), parent(m11, "bottomLid")]).toEqual(["back", "front"]);
    expect(depth(m11, "topLid")).toBeCloseTo(Wp, 6);
    expect(m11.panels.filter((p) => p.role === "tuck")).toHaveLength(2);
    expect(build("FEFCO_0212", d).panels.some((p) => p.id === "bottomFlap_front")).toBe(true);
    expect(build("FEFCO_0215", d).panels.some((p) => p.id === "bottom_back")).toBe(true);
  });

  it("0214: perforated tear line at the tray height", () => {
    const m = build("FEFCO_0214", d, t, { trayHeightMm: 120 });
    expect(m.perfLines).toHaveLength(4);
    const front = byId(m, "front");
    const yBottomCrease = front.bbox.y + front.bbox.height;
    for (const l of m.perfLines) expect(yBottomCrease - 2 * t - l.a.y).toBeCloseTo(120, 6);
    expect(m.metrics.perfLengthMm).toBeGreaterThan(2 * (Lp + Wp) - 10);
  });

  it("0217: handle panels with hand holes, no top face", () => {
    const m = build("FEFCO_0217", { L: 250, W: 150, H: 150 });
    expect(m.panels.filter((p) => p.id.startsWith("handle_") && p.holes?.length)).toHaveLength(2);
    expect(m.faces.top).toBeUndefined();
  });

  it("0218: lock slits in the inner top flap; 0227: notched lids", () => {
    expect(byId(build("FEFCO_0218", d), "topFlap_back").holes).toHaveLength(2);
    const m = build("FEFCO_0227", { L: 100, W: 100, H: 320 });
    expect(byId(m, "topLid").polygon.length).toBeGreaterThan(8);
  });

  it("0225: base B deep, liner h ≤ H", () => {
    const m = build("FEFCO_0225", { L: 300, W: 200, H: 150 }, t, { linerHeightMm: 80 });
    expect(depth(m, "base")).toBeCloseTo(200 + 3 * t - 2 * t, 6);
    expect(depth(m, "liner")).toBeCloseTo(80, 6);
    expect(byId(m, "liner").foldAngleClosed).toBe(180);
  });

  it("0228 / 0230: l1 + l2 = L + o; 0231: b1 + b2 = B + o", () => {
    for (const code of ["FEFCO_0228", "FEFCO_0230"] as const) {
      const m = build(code, d, t, { overlapMm: 40 });
      expect(byId(m, "backA").bbox.width + byId(m, "backB").bbox.width).toBeCloseTo(Lp + 40, 6);
    }
    const m = build("FEFCO_0231", d, t, { overlapMm: 40 });
    expect(byId(m, "leftA").bbox.width + byId(m, "leftB").bbox.width).toBeCloseTo(Wp + 40, 6);
    expect(build("FEFCO_0228", d).panels.some((p) => p.id === "partition")).toBe(true);
    expect(build("FEFCO_0230", d).panels.some((p) => p.role === "glue")).toBe(false);
  });

  it("0226: diagonal gusset triangles on the end flaps, bevelled top", () => {
    const m = build("FEFCO_0226", d, t, { bevelFoldDeg: 60 });
    expect(m.panels.filter((p) => p.label === "Gusset")).toHaveLength(8);
    expect(byId(m, "topFlap_front").foldAngleClosed).toBe(60);
    expect(byId(m, "bottomFlap_front").foldAngleClosed).toBe(90);
  });

  it("features: hand holes and tear strip where supported, ignored elsewhere", () => {
    const m = buildFefco02Dieline(DEFINITION_BY_CODE.FEFCO_0201, d, { thicknessMm: t, features: { handle: true, tearStrip: true } });
    expect(byId(m, "left").holes).toHaveLength(1);
    expect(m.perfLines.length).toBe(8);
    const g = buildFefco02Dieline(DEFINITION_BY_CODE.FEFCO_0217, { L: 250, W: 150, H: 150 }, { thicknessMm: t, features: { tearStrip: true, window: { face: "front" } } });
    expect(g.features).toEqual({});
  });
});

describe("FEFCO 02 limits", () => {
  const def = DEFINITION_BY_CODE.FEFCO_0201;

  it("rejects sizes outside the limits, non-numbers and broken rules", () => {
    const tooSmall = validateFefco02Dims(def, { L: 50, W: 200, H: 150 });
    expect(tooSmall.ok).toBe(false);
    if (!tooSmall.ok) expect(tooSmall.issues[0]).toMatchObject({ path: "L", code: "TOO_SMALL", limit: 100 });
    const tooLarge = validateFefco02Dims(def, { L: 300, W: 200, H: 5000 });
    if (!tooLarge.ok) expect(tooLarge.issues[0]).toMatchObject({ path: "H", code: "TOO_LARGE" });
    else throw new Error("expected failure");
    expect(validateFefco02Dims(def, { L: Number.NaN, W: 200, H: 150 }).ok).toBe(false);
    expect(validateFefco02Dims(def, { L: "300", W: 200, H: 150 }).ok).toBe(false);
    const rule = validateFefco02Dims(DEFINITION_BY_CODE.FEFCO_0204, { L: 200, W: 300, H: 150 });
    if (!rule.ok) expect(rule.issues[0]).toMatchObject({ code: "RULE", rule: "W <= L" });
    else throw new Error("expected rule failure");
    expect(validateFefco02Dims(DEFINITION_BY_CODE.FEFCO_0227, { L: 200, W: 200, H: 150 }).ok).toBe(false);
  });

  it("validates style params strictly", () => {
    const osc = DEFINITION_BY_CODE.FEFCO_0202;
    expect(validateFefco02Params(osc, { overlapMm: 40 }).ok).toBe(true);
    expect(validateFefco02Params(osc, { overlapMm: 2 }).ok).toBe(false);
    expect(validateFefco02Params(osc, { rimMm: 40 }).ok).toBe(false);
    expect(validateFefco02Params(def, { overlapMm: 40 }).ok).toBe(false);
  });

  it("build throws DielineValidationError; try-variant returns null", () => {
    expect(() => buildFefco02Dieline(def, { L: 10, W: 10, H: 10 }, { thicknessMm: 3 })).toThrow(DielineValidationError);
    expect(() => buildFefco02Dieline(def, def.defaultDims, { thicknessMm: -1 })).toThrow(DielineValidationError);
    expect(() => buildFefco02Dieline(DEFINITION_BY_CODE.FEFCO_0202, def.defaultDims, { thicknessMm: 3, params: { overlapMm: 1 } })).toThrow(DielineValidationError);
    expect(tryBuildFefco02Dieline(def, { L: 10, W: 10, H: 10 }, { thicknessMm: 3 })).toBeNull();
  });

  it("generate() matches the shared Generator signature", () => {
    for (const d of DEFINITIONS) {
      const draft = d.generate(d.defaultDims, 1.5, {});
      expect(draft.builder.panels.length).toBeGreaterThan(4);
      expect(draft.closedRotation).toHaveLength(4);
    }
  });
});
