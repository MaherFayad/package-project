import { Vector3 } from "three";
import { describe, expect, it } from "vitest";
import type { Dims } from "@/types";
import { BOARD_SPECS, boundsAt, computePoses, type DielineModel } from "../../..";
import { polygonArea } from "../../../geometry";
import {
  DEFINITIONS,
  DEFINITIONS_BY_CODE,
  basketHandleRise,
  bodyVolumeMl,
  coneSectorDeg,
  cupHoleDiameter,
  cupsPerSide,
  familyFeatures,
  generateFamilyDieline,
  ngonSide,
  PILLOW_STRIPS,
  pivotForGap,
  tryGenerateFamilyDieline,
  validateFamilyDims,
  type EcmaSpecialDef,
} from "..";

const SBS = BOARD_SPECS.SBS_350.thicknessMm;
const gen = (def: EcmaSpecialDef, dims: Dims = def.defaultDims, t = SBS) => generateFamilyDieline(def, dims, { thicknessMm: t, features: def.defaultFeatures });
const def = (code: string) => DEFINITIONS_BY_CODE[code];

function allNumbers(m: DielineModel): number[] {
  const out: number[] = [m.sheet.width, m.sheet.height, ...Object.values(m.metrics), ...Object.values(m.closedOuter), ...m.closedRotation];
  for (const p of m.panels) {
    for (const q of p.polygon) out.push(q.x, q.y);
    if (p.hinge) out.push(p.hinge.a.x, p.hinge.a.y, p.hinge.b.x, p.hinge.b.y);
    out.push(p.foldAngleClosed, p.stackOffset, p.pivotDepth);
    if (p.assembly) out.push(...p.assembly.matrix);
  }
  for (const s of [...m.cutLines, ...m.creaseLines, ...m.perfLines]) out.push(s.a.x, s.a.y, s.b.x, s.b.y);
  for (const f of Object.values(m.faces)) for (const part of f!.parts) out.push(...part.transform, part.rect.x, part.rect.y, part.rect.width, part.rect.height);
  return out;
}

/** Inner-dims samples: default, every preset, and the limit corners that satisfy the rules. */
function samples(d: EcmaSpecialDef): Dims[] {
  const { L, W, H } = d.params;
  const corners: Dims[] = [];
  for (const l of [L.min, L.max]) for (const w of [W.min, W.max]) for (const h of [H.min, H.max]) corners.push({ L: l, W: w, H: h });
  return [d.defaultDims, ...d.presets.map((p) => p.dims), ...corners].filter((x) => validateFamilyDims(d, x).ok);
}

describe("ECMA specials: metadata", () => {
  it("exports unique codes and slugs", () => {
    expect(DEFINITIONS.length).toBeGreaterThanOrEqual(20);
    expect(new Set(DEFINITIONS.map((d) => d.code)).size).toBe(DEFINITIONS.length);
    expect(new Set(DEFINITIONS.map((d) => d.slug)).size).toBe(DEFINITIONS.length);
  });

  it.each(DEFINITIONS.map((d) => [d.code, d] as const))("%s has complete bilingual metadata", (_c, d) => {
    for (const t of [d.name, d.description, d.axes.L, d.axes.W, d.axes.H, ...d.typicalUses]) {
      expect(t.ar.length).toBeGreaterThan(1);
      expect(t.en.length).toBeGreaterThan(1);
      // MSA without diacritics (harakat U+064B–U+0652, tatweel U+0640).
      expect(t.ar).not.toMatch(/[ً-ْـ]/);
      expect(t.ar).toMatch(/[؀-ۿ]/);
    }
    expect(d.standard).toMatch(/^(ECMA [A-FX]\d{2}|none$)/);
    expect(d.presets.length).toBeGreaterThanOrEqual(2);
    expect(d.presets.length).toBeLessThanOrEqual(4);
    expect(d.materials.length).toBeGreaterThan(0);
    expect(d.uses.length).toBeGreaterThan(0);
    for (const pr of [d.defaultDims, ...d.presets.map((x) => x.dims)]) expect(validateFamilyDims(d, pr).ok).toBe(true);
    expect(d.slug).toMatch(/^[a-z0-9-]+$/);
  });

  it("uses no brand names", () => {
    const text = JSON.stringify(DEFINITIONS.map((d) => [d.name, d.description, d.typicalUses, d.presets.map((p) => p.name)]));
    expect(text).not.toMatch(/tetra|pure-?pak|elopak|sig combibloc|coca|pepsi|starbucks/i);
  });
});

describe("ECMA specials: limits (zod)", () => {
  it("rejects out-of-range, non-finite and rule-breaking dims", () => {
    const tray = def("ECMA_TRAY_4C");
    const low = validateFamilyDims(tray, { L: 10, W: 100, H: 50 });
    expect(low.ok).toBe(false);
    if (!low.ok) expect(low.issues[0]).toMatchObject({ path: "L", code: "TOO_SMALL", limit: tray.params.L.min });
    const high = validateFamilyDims(tray, { L: 200, W: 100, H: 999 });
    expect(!high.ok && high.issues[0].code).toBe("TOO_LARGE");
    expect(validateFamilyDims(tray, { L: Number.NaN, W: 100, H: 50 }).ok).toBe(false);
    expect(validateFamilyDims(tray, { L: "200", W: 100, H: 50 }).ok).toBe(false);
    const hex = validateFamilyDims(def("ECMA_HEXAGON"), { L: 80, W: 100, H: 80 });
    expect(!hex.ok && hex.issues[0].code).toBe("RULE");
    const pillow = validateFamilyDims(def("ECMA_PILLOW"), { L: 100, W: 60, H: 160 });
    expect(!pillow.ok && pillow.issues[0].rule).toBe("W <= L * 0.5");
  });

  it("throws on invalid input and returns null from tryGenerate", () => {
    const d = def("ECMA_TRAY_BEERS");
    expect(() => generateFamilyDieline(d, { L: 5, W: 5, H: 5 }, { thicknessMm: SBS })).toThrow(/Invalid dieline input/);
    expect(() => generateFamilyDieline(d, d.defaultDims, { thicknessMm: -1 })).toThrow();
    expect(tryGenerateFamilyDieline(d, { L: 5, W: 5, H: 5 }, { thicknessMm: SBS })).toBeNull();
  });

  it("drops unsupported features", () => {
    const f = familyFeatures(def("CONE"), { window: { face: "front" }, handle: true, thumbNotch: true });
    expect(f).toEqual({});
    expect(familyFeatures(def("GABLE_CARRY_CLB"), {}).handle).toBe(true);
  });
});

describe.each(DEFINITIONS.map((d) => [d.code, d] as const))("%s geometry", (_code, d) => {
  const models = samples(d).map((dims) => ({ dims, m: gen(d, dims) }));

  it("has no NaN / Infinity anywhere", () => {
    for (const { m } of models) for (const v of allNumbers(m)) expect(Number.isFinite(v)).toBe(true);
  });

  it("is a valid fold tree with a die, creases and print data", () => {
    for (const { m } of models) {
      const ids = new Set(m.panels.map((p) => p.id));
      expect(ids.size).toBe(m.panels.length);
      for (const p of m.panels) {
        if (p.parentId) {
          expect(ids.has(p.parentId)).toBe(true);
          expect(p.hinge).not.toBeNull();
        }
        expect(polygonArea(p.polygon)).toBeGreaterThan(0.5);
      }
      expect(m.cutLines.length).toBeGreaterThan(3);
      expect(m.creaseLines.length).toBeGreaterThan(0);
      expect(m.metrics.blankAreaM2).toBeGreaterThan(0);
      expect(m.metrics.netAreaM2).toBeLessThanOrEqual(m.metrics.blankAreaM2 + 1e-9);
      expect(m.pieces.length).toBe(d.pieces);
      expect(Object.keys(m.faces).length).toBeGreaterThan(0);
    }
  });

  it("print area math: sheet = die + 2 × bleed, bleed grows printable panels, safe zones inside", () => {
    for (const { m } of models) {
      expect(m.bleedMm).toBe(3);
      expect(m.sheet.width).toBeCloseTo(m.dieBounds.width + 2 * m.bleedMm, 6);
      expect(m.sheet.height).toBeCloseTo(m.dieBounds.height + 2 * m.bleedMm, 6);
      expect(m.dieBounds.x).toBeCloseTo(3, 6);
      const byId = new Map(m.panels.map((p) => [p.id, p]));
      for (const r of m.bleedRegions) {
        const p = byId.get(r.panelId)!;
        expect(p.printable).toBe(true);
        expect(polygonArea(r.polygon) + 1e-6).toBeGreaterThanOrEqual(polygonArea(p.polygon) * 0.999);
      }
      for (const g of m.panels.filter((p) => p.role === "glue")) expect(m.bleedRegions.some((r) => r.panelId === g.id)).toBe(false);
      for (const s of m.safeZones) {
        const p = byId.get(s.panelId)!;
        expect(s.rect.x).toBeGreaterThanOrEqual(p.bbox.x - 1e-6);
        expect(s.rect.y).toBeGreaterThanOrEqual(p.bbox.y - 1e-6);
        expect(s.rect.width).toBeGreaterThanOrEqual(0);
        expect(s.rect.height).toBeGreaterThanOrEqual(0);
      }
      for (const f of Object.values(m.faces)) {
        expect(f!.width).toBeGreaterThan(0);
        expect(f!.height).toBeGreaterThan(0);
      }
    }
  });

  it("folds smoothly: every pose is finite at 0, 0.5 and 1", () => {
    const { m } = models[0];
    for (const progress of [0, 0.5, 1]) {
      const box = boundsAt(m, progress, computePoses(m, progress));
      for (const v of [box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z]) expect(Number.isFinite(v)).toBe(true);
    }
  });
});

/* ───────────── closed dimensions ───────────── */

const near = (actual: number, expected: number, tol: number) => expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tol);

describe("closed dimensions match the inputs", () => {
  const boxLike = ["ECMA_TRAY_4C", "ECMA_TRAY_BEERS", "ECMA_TRAY_BRIGHTWOOD", "ECMA_TRAY_HINGED_TUCK", "ECMA_SLEEVE_OPEN", "ECMA_COUNTER_DISPLAY", "LIQUID_ASEPTIC_BRICK", "BOTTLE_BASKET_4", "BOTTLE_BASKET_6"];
  it.each(boxLike)("%s: outer = inner + a few board layers", (code) => {
    const d = def(code);
    for (const dims of samples(d)) {
      const m = gen(d, dims);
      const t = m.thicknessMm;
      const o = m.closedOuter;
      expect(o.L).toBeGreaterThanOrEqual(dims.L - 0.01);
      expect(o.L).toBeLessThanOrEqual(dims.L + 8 * t + 1);
      expect(o.W).toBeGreaterThanOrEqual(dims.W - 0.01);
      expect(o.W).toBeLessThanOrEqual(dims.W + 8 * t + 1);
      expect(o.H).toBeGreaterThanOrEqual(dims.H - 0.01);
      const extraH = code.startsWith("BOTTLE") ? basketHandleRise(dims) + 6 * t + 1 : code === "LIQUID_ASEPTIC_BRICK" ? 6 * t + 1 : 8 * t + 1;
      expect(o.H).toBeLessThanOrEqual(dims.H + extraH);
    }
  });

  it("four-corner tray: walls stand at the inner size (L + 4t, W + 2t, H + t)", () => {
    const d = def("ECMA_TRAY_4C");
    const m = gen(d, { L: 220, W: 150, H: 50 });
    const t = m.thicknessMm;
    near(m.closedOuter.L, 220 + 4 * t, 0.05);
    near(m.closedOuter.W, 150 + 2 * t, 0.05);
    near(m.closedOuter.H, 50 + t, 0.05);
    expect(Object.keys(m.faces).sort()).toEqual(["back", "bottom", "front", "left", "right"]);
    expect(m.panels.filter((p) => p.role === "glue")).toHaveLength(4);
  });

  it("Beers tray: corner webs double on the diagonal and join the end walls by a crease", () => {
    const m = gen(def("ECMA_TRAY_BEERS"));
    const webs = m.panels.filter((p) => p.id.startsWith("web"));
    expect(webs).toHaveLength(8);
    expect(webs.filter((p) => p.foldAngleClosed === 180)).toHaveLength(4);
    // 4 wall hinges + 4 web hinges (A) + 4 diagonals (B) + 4 joins
    expect(m.creaseLines.length).toBe(16);
  });

  it("Brightwood tray: inner end walls rolled 180° inside the end walls", () => {
    const m = gen(def("ECMA_TRAY_BRIGHTWOOD"), { L: 250, W: 180, H: 60 });
    const t = m.thicknessMm;
    const inner = m.panels.filter((p) => p.role === "inner");
    expect(inner).toHaveLength(2);
    for (const p of inner) expect(p.foldAngleClosed).toBe(180);
    near(m.closedOuter.L, 250 + 6 * t, 0.05);
  });

  it("six-corner tray: 6 glue flaps, cover overlaps the tray, front lock slit", () => {
    const m = gen(def("ECMA_TRAY_6C_LID"), { L: 170, W: 170, H: 85 });
    expect(m.panels.filter((p) => p.role === "glue")).toHaveLength(6);
    expect(m.panels.find((p) => p.id === "front")!.holes).toHaveLength(1);
    const t = m.thicknessMm;
    expect(m.closedOuter.L).toBeGreaterThan(170 + 4 * t);
    expect(m.closedOuter.L).toBeLessThan(170 + 10 * t + 2);
    near(m.closedOuter.H, 85 + 2 * t, 0.2);
    expect(m.faces.top).toBeDefined();
  });

  it("hinged tuck tray closes to a box with a top face", () => {
    const m = gen(def("ECMA_TRAY_HINGED_TUCK"), { L: 200, W: 200, H: 50 });
    expect(Object.keys(m.faces).sort()).toEqual(["back", "bottom", "front", "left", "right", "top"]);
    near(m.closedOuter.H, 50 + 2 * m.thicknessMm, 0.05); // base + lid boards outside the inner height
  });

  it("open sleeve has four walls and no top/bottom", () => {
    const m = gen(def("ECMA_SLEEVE_OPEN"), { L: 85, W: 85, H: 100 });
    expect(Object.keys(m.faces).sort()).toEqual(["back", "front", "left", "right"]);
    near(m.closedOuter.H, 100, 0.01);
  });

  it("self-locking wrap: length along the open axis, two lock slits", () => {
    const m = gen(def("ECMA_WRAP_LOCK"), { L: 95, W: 60, H: 30 });
    near(m.closedOuter.L, 95, 0.01);
    near(m.closedOuter.W, 60 + 2 * m.thicknessMm, 0.6);
    near(m.closedOuter.H, 30 + 2 * m.thicknessMm, 0.6);
    expect(m.panels.find((p) => p.id === "top")!.holes).toHaveLength(2);
  });

  it("presentation folder: cover size, pocket inside, spine sets the thickness", () => {
    const d = def("FOLDER_PRESENTATION");
    const flat = gen(d, { L: 220, W: 1, H: 310 });
    near(flat.closedOuter.L, 220, 0.01);
    near(flat.closedOuter.H, 310, 0.01);
    expect(flat.closedOuter.W).toBeLessThan(6 * flat.thicknessMm + 1);
    const spine = gen(d, { L: 220, W: 5, H: 310 });
    near(spine.closedOuter.W, 5 + 2 * spine.thicknessMm, 0.1);
    expect(spine.faces.left).toBeDefined();
    expect(spine.panels.find((p) => p.id === "pocket")!.holes).toHaveLength(2);
  });

  it("pivotForGap leaves exactly the requested gap", () => {
    expect(pivotForGap(0, 0.5)).toBe(1);
    expect(pivotForGap(2, 0.5)).toBe(3);
  });

  it("wallet: front panel size, thickness = content + 2 boards", () => {
    const m = gen(def("ECMA_WALLET_ENDFLAP"), { L: 125, W: 2, H: 125 });
    const t = m.thicknessMm;
    near(m.closedOuter.L, 127, 0.01);
    expect(m.closedOuter.W).toBeGreaterThanOrEqual(2 + 2 * t - 0.01);
    expect(m.closedOuter.W).toBeLessThanOrEqual(2 + 3 * t + 0.01);
    expect(m.closedOuter.H).toBeGreaterThanOrEqual(127);
  });

  it("pillow: width and thickness at the centre match", () => {
    const m = gen(def("ECMA_PILLOW"), { L: 100, W: 35, H: 160 });
    const t = m.thicknessMm;
    near(m.closedOuter.L, 100, 3 * t + 0.5);
    near(m.closedOuter.W, 35, 3 * t + 0.5);
    expect(m.closedOuter.H).toBeGreaterThanOrEqual(160);
    expect(m.faces.front && m.faces.back).toBeTruthy();
  });

  it("pillow: bowed faces on smooth roll hinges and curved end creases", () => {
    const m = gen(def("ECMA_PILLOW"), { L: 100, W: 35, H: 160 });
    const strips = m.panels.filter((p) => /^(front|back)\d$/.test(p.id));
    expect(strips).toHaveLength(2 * PILLOW_STRIPS);
    // Inside each face the strips meet on smooth (roll) hinges; only the side folds crease.
    expect(strips.filter((p) => p.hingeKind === "roll")).toHaveLength(2 * (PILLOW_STRIPS - 1));
    // Top end crease: the lobe hinges trace an arc (centre higher than the folds), drawn as creases.
    const top = m.panels.filter((p) => /^front\dTop$/.test(p.id)).sort((a, b) => a.hinge!.a.x - b.hinge!.a.x);
    const ys = top.map((p) => Math.min(p.hinge!.a.y, p.hinge!.b.y));
    const edge = Math.max(top[0].hinge!.a.y, top[top.length - 1].hinge!.b.y);
    expect(edge - Math.min(...ys)).toBeGreaterThan(4);
    for (const p of top) expect(m.creaseLines.some((c) => c.a.x === p.hinge!.a.x && c.a.y === p.hinge!.a.y)).toBe(true);
    // The lobes close the ends: closed height stays within body + both crease arcs + lobes.
    expect(m.closedOuter.H).toBeLessThan(160 + 2 * (35 * 0.55 + 35 * 1.3));
  });

  it("cone: mouth diameter and height match, developed sector < 360°", () => {
    const m = gen(def("CONE"), { L: 75, W: 75, H: 160 });
    const t = m.thicknessMm;
    near(m.closedOuter.L, 75 + 2 * t, 2);
    near(m.closedOuter.W, 75 + 2 * t, 2);
    near(m.closedOuter.H, 160, 2);
    expect(coneSectorDeg(37.5, 160)).toBeLessThan(360);
    expect(coneSectorDeg(37.5, 160)).toBeCloseTo((360 * 37.5) / Math.hypot(37.5, 160), 9);
  });

  it.each([
    ["ECMA_HEXAGON", 6],
    ["ECMA_OCTAGON", 8],
  ] as const)("%s: n side panels, across-flats = L", (code, n) => {
    const m = gen(def(code), { L: 100, W: 100, H: 100 });
    const t = m.thicknessMm;
    const sides = m.panels.filter((p) => p.parentId !== null && p.foldAngleClosed === 360 / n && p.role !== "glue" && Math.abs(p.bbox.height - (100 + 4 * t)) < 1e-6);
    expect(sides.length + 1).toBe(n);
    near(sides[0].bbox.width, ngonSide(100 + 2 * t, n), 1e-6);
    near(m.closedOuter.W, 100 + 2 * t, 0.2);
    near(m.closedOuter.H, 100 + 4 * t, 0.2);
    expect(m.faces.top && m.faces.bottom && m.faces.front).toBeTruthy();
  });

  it("gable carry: crash-lock bottom kept, top replaced by roof + handle with holes", () => {
    const m = gen(def("GABLE_CARRY_CLB"), { L: 160, W: 100, H: 120 });
    expect(m.panels.some((p) => p.id === "topTuck")).toBe(false);
    expect(m.panels.filter((p) => p.id.startsWith("handle_") && p.holes?.length)).toHaveLength(2);
    expect(m.panels.some((p) => p.id === "bottom_front")).toBe(true);
    expect(m.closedOuter.H).toBeGreaterThan(120 + 35);
  });

  it("cup carrier: 2 or 4 apertures sized to the deck", () => {
    const d = def("CUP_CARRIER");
    const two = gen(d, { L: 100, W: 200, H: 60 });
    const four = gen(d, { L: 200, W: 200, H: 60 });
    const holes = (m: DielineModel) => m.panels.filter((p) => p.id.startsWith("deck")).reduce((s, p) => s + (p.holes?.length ?? 0), 0);
    expect(cupsPerSide({ L: 100, W: 200, H: 60 })).toBe(1);
    expect(holes(two)).toBe(2);
    expect(holes(four)).toBe(4);
    expect(cupHoleDiameter({ L: 200, W: 200, H: 60 })).toBeCloseTo(80, 6);
    near(four.closedOuter.L, 200, 0.01);
    expect(four.closedOuter.H).toBeGreaterThan(60);
  });

  it("baskets: handle partition rises above the walls; 6-pack has 2 cross partitions", () => {
    const m4 = gen(def("BOTTLE_BASKET_4"));
    const m6 = gen(def("BOTTLE_BASKET_6"));
    expect(m4.metrics.pieceCount).toBe(3);
    expect(m6.metrics.pieceCount).toBe(4);
    expect(m4.panels.find((p) => p.id === "handle")!.holes).toHaveLength(1);
    expect(m4.closedOuter.H).toBeGreaterThan(150 + basketHandleRise({ L: 132, W: 132, H: 150 }) - 1);
  });

  it("counter display: perforations across the front and both sides", () => {
    const m = gen(def("ECMA_COUNTER_DISPLAY"));
    expect(m.perfLines).toHaveLength(3);
    expect(m.metrics.perfLengthMm).toBeGreaterThan(200);
  });

  it("liquid cartons: nominal capacities of the presets are met (brimful body ≥ nominal)", () => {
    const nominal: Record<string, number> = { "250ml": 250, "500ml": 500, "1l": 1000, "2l": 2000, "200ml": 200 };
    for (const code of ["LIQUID_GABLE_TOP", "LIQUID_ASEPTIC_BRICK"]) {
      const d = def(code);
      for (const pr of d.presets) {
        const v = d.capacityMl!(pr.dims);
        expect(v).toBeGreaterThanOrEqual(nominal[pr.id]);
        expect(v).toBeLessThanOrEqual(nominal[pr.id] * 1.12);
      }
    }
    expect(bodyVolumeMl({ L: 70, W: 70, H: 210 })).toBeCloseTo(1029, 0);
  });

  it("gable-top carton: 45° roof, fin on top, square sealed bottom", () => {
    const m = gen(def("LIQUID_GABLE_TOP"), { L: 70, W: 70, H: 210 });
    const roof = m.panels.find((p) => p.id === "roof_front")!;
    expect(roof.foldAngleClosed).toBeCloseTo(45, 6);
    expect(m.panels.find((p) => p.id === "fin_front")!.foldAngleClosed).toBeCloseTo(-45, 6);
    near(m.closedOuter.L, 70 + 2 * m.thicknessMm, 0.05);
    const wp = 70 + 2 * m.thicknessMm;
    near(m.closedOuter.H, 210 + 3 * m.thicknessMm + (wp / 2 - m.thicknessMm) + 9, 1.5);
  });

  it("aseptic brick: top ears folded down flat onto the sides", () => {
    const m = gen(def("LIQUID_ASEPTIC_BRICK"), { L: 55, W: 37, H: 123 });
    const t = m.thicknessMm;
    const ears = m.panels.filter((p) => p.role === "ear");
    // Two half-ears per side on the top seal flaps + one ear under the base per side.
    expect(ears).toHaveLength(6);
    const top = ears.filter((p) => p.id.startsWith("ear_top"));
    expect(top).toHaveLength(4);
    // Closed: each top half-ear hangs flat on the outside of its side panel, printed side out
    // (outward normal along ±X), one caliper proud of the panel.
    const poses = computePoses(m, 1);
    for (const e of top) {
      const n = new Vector3(0, 0, 1).transformDirection(poses.get(e.id)!.world);
      expect(Math.abs(n.x)).toBeGreaterThan(0.999);
      expect(m.faces[n.x > 0 ? "right" : "left"]!.parts.some((p) => p.panelId === e.id)).toBe(true);
    }
    near(m.closedOuter.L, 55 + 4 * t, 0.05); // + ears on both sides
    // Top: back seal flap on the crease plane, front flap lapped over it (+t); bottom ears under the base.
    near(m.closedOuter.H, 123 + 6 * t, 0.2);
    // Both top seal flaps show from above and carry the top artwork.
    expect(m.faces.top!.parts.map((p) => p.panelId).sort()).toEqual(["top", "top_back"]);
  });
});
