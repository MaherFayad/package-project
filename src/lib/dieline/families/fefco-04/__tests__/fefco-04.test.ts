import { describe, expect, it } from "vitest";
import { Vec3 as Vector3 } from "@/lib/dieline/math";
import { BOARD_SPECS, DielineValidationError, boundsAt, computePoses, panelLocalPoint, panelPivot } from "../../..";
import { polygonArea } from "../../../geometry";

const insidePoly = (pt: { x: number; y: number }, poly: { x: number; y: number }[]) => {
  let r = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > pt.y !== b.y > pt.y && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) r = !r;
  }
  return r;
};
import { DEFINITIONS, IMPLEMENTED_IN_CORE, definitionByCode, generateFamilyDieline, tryGenerateFamilyDieline, validateFamilyDims, type Fefco04Definition, type Fefco04Model } from "..";

const THICKNESSES = [1.5, 3];
const DIACRITICS = /[ً-ْٰ]/;
const ARABIC = /[؀-ۿ]/;

/** Styles whose closed height is intentionally above the cover (header / raised ends). */
const TALL = new Set(["0435", "0435a", "0449", "0460", "0434"]);

function finiteDeep(v: unknown, path = "model"): string | null {
  if (typeof v === "number") return Number.isFinite(v) ? null : path;
  if (Array.isArray(v)) {
    for (let i = 0; i < v.length; i++) {
      const bad = finiteDeep(v[i], `${path}[${i}]`);
      if (bad) return bad;
    }
    return null;
  }
  if (v && typeof v === "object") {
    for (const [k, x] of Object.entries(v)) {
      if (k === "generate") continue;
      const bad = finiteDeep(x, `${path}.${k}`);
      if (bad) return bad;
    }
  }
  return null;
}

type P = { x: number; y: number };
const centroidOf = (poly: P[]): P => ({ x: poly.reduce((s, v) => s + v.x, 0) / poly.length, y: poly.reduce((s, v) => s + v.y, 0) / poly.length });
/** Strictly inside (points within 0.01 mm of an edge count as outside). */
function inside(p: P, poly: P[]): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l2 = dx * dx + dy * dy;
    const k = l2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
    if (Math.hypot(p.x - (a.x + k * dx), p.y - (a.y + k * dy)) < 0.01) return false;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}

const gen = (def: Fefco04Definition, t: number, dims = def.defaultDims) => generateFamilyDieline(def, dims, { thicknessMm: t });

describe("FEFCO 04 catalogue metadata", () => {
  it("has a large, unique set of group 04 definitions", () => {
    expect(DEFINITIONS.length).toBeGreaterThanOrEqual(60);
    expect(new Set(DEFINITIONS.map((d) => d.code)).size).toBe(DEFINITIONS.length);
    expect(new Set(DEFINITIONS.map((d) => d.slug)).size).toBe(DEFINITIONS.length);
  });

  it("does not duplicate styles already in the core engine", () => {
    for (const fefco of Object.keys(IMPLEMENTED_IN_CORE)) expect(definitionByCode(fefco)).toBeNull();
  });

  it.each(DEFINITIONS.map((d) => [d.fefco, d] as const))("%s metadata is complete and valid", (_f, def) => {
    if (def.code.startsWith("MAILER_")) {
      // Trade-named mailers (retf.ts): not in the FEFCO code book.
      expect(def.code).toBe(`MAILER_${def.fefco}`);
      expect(def.standard).toMatch(/^RETF \(FEFCO 0427 family\)$/);
    } else {
      expect(def.code).toBe(`FEFCO_${def.fefco}`);
      expect(def.fefco).toMatch(/^04\d\d(_\d)?a?$/);
      expect(def.standard.startsWith("FEFCO 04")).toBe(true);
    }
    expect(def.family).toBe("CORRUGATED");
    expect(def.name.en.length).toBeGreaterThan(5);
    expect(def.description.en.length).toBeGreaterThan(20);
    for (const ar of [def.name.ar, def.description.ar]) {
      expect(ar).toMatch(ARABIC);
      expect(ar).not.toMatch(DIACRITICS);
    }
    expect(def.materials.length).toBeGreaterThan(0);
    for (const m of def.materials) expect(BOARD_SPECS[m].family).toBe("CORRUGATED");
    expect(def.presets.length).toBeGreaterThanOrEqual(2);
    expect(def.presets.length).toBeLessThanOrEqual(4);
    expect(validateFamilyDims(def, def.defaultDims).ok).toBe(true);
    for (const preset of def.presets) expect(validateFamilyDims(def, preset.dims).ok, `${def.fefco} preset ${preset.id}`).toBe(true);
    expect(def.uses.length).toBeGreaterThan(0);
  });

  it("Arabic names are unique", () => {
    expect(new Set(DEFINITIONS.map((d) => d.name.ar)).size).toBe(DEFINITIONS.length);
    expect(new Set(DEFINITIONS.map((d) => d.name.en)).size).toBe(DEFINITIONS.length);
  });
});

describe("FEFCO 04 limits (zod)", () => {
  const def = definitionByCode("0421")!;
  it("rejects dims outside the limits and broken rules", () => {
    const tooSmall = validateFamilyDims(def, { L: 10, W: 180, H: 80 });
    expect(tooSmall.ok).toBe(false);
    if (!tooSmall.ok) expect(tooSmall.issues[0]).toMatchObject({ path: "L", code: "TOO_SMALL", limit: def.params.L.min });
    const tooLarge = validateFamilyDims(def, { L: 250, W: 180, H: 9999 });
    expect(tooLarge.ok).toBe(false);
    const rule = validateFamilyDims(def, { L: 250, W: 80, H: 120 });
    expect(rule.ok).toBe(false);
    if (!rule.ok) expect(rule.issues.some((i) => i.code === "RULE" && i.rule === "H <= W")).toBe(true);
    expect(validateFamilyDims(def, { L: NaN, W: 180, H: 80 }).ok).toBe(false);
  });
  it("generate throws DielineValidationError, try returns null", () => {
    expect(() => gen(def, 1.5, { L: 10, W: 10, H: 10 })).toThrow(DielineValidationError);
    expect(() => generateFamilyDieline(def, def.defaultDims, { thicknessMm: -1 })).toThrow(DielineValidationError);
    expect(tryGenerateFamilyDieline(def, { L: 10, W: 10, H: 10 }, { thicknessMm: 1.5 })).toBeNull();
  });
});

function checkModel(def: Fefco04Definition, m: Fefco04Model) {
  const t = m.thicknessMm;
  const { L, W, H } = m.dims;
  // No NaN / Infinity anywhere.
  expect(finiteDeep(m)).toBeNull();

  // Sheet = die + bleed; bleed 3 mm, safe 5 mm (corrugated).
  expect(m.bleedMm).toBe(3);
  expect(m.safeMm).toBe(5);
  expect(m.sheet.width).toBeCloseTo(m.dieBounds.width + 6, 6);
  expect(m.sheet.height).toBeCloseTo(m.dieBounds.height + 6, 6);
  for (const p of m.panels) for (const q of p.polygon) {
    expect(q.x).toBeGreaterThanOrEqual(m.dieBounds.x - 1e-6);
    expect(q.y).toBeGreaterThanOrEqual(m.dieBounds.y - 1e-6);
    expect(q.x).toBeLessThanOrEqual(m.dieBounds.x + m.dieBounds.width + 1e-6);
    expect(q.y).toBeLessThanOrEqual(m.dieBounds.y + m.dieBounds.height + 1e-6);
  }

  // Tree: one root per piece, every hinge has a parent, fold data present.
  expect(m.pieces.length).toBe(def.pieces);
  expect(m.metrics.pieceCount).toBe(def.pieces);
  const ids = new Set(m.panels.map((p) => p.id));
  expect(ids.size).toBe(m.panels.length);
  for (const p of m.panels) {
    if (p.parentId) {
      expect(ids.has(p.parentId)).toBe(true);
      expect(p.hinge).not.toBeNull();
      expect(Math.abs(p.foldAngleClosed)).toBeGreaterThan(0);
      expect(Math.abs(p.foldAngleClosed)).toBeLessThanOrEqual(180);
    }
  }
  expect(m.creaseLines.length).toBeGreaterThan(0);

  // Flat blank is cuttable: no panel lies on top of another (sampled interior points).
  for (const p of m.panels) {
    const c = centroidOf(p.polygon);
    const samples = [c, ...p.polygon.map((v) => ({ x: c.x + (v.x - c.x) * 0.85, y: c.y + (v.y - c.y) * 0.85 }))].filter((s) => inside(s, p.polygon));
    for (const q of m.panels) {
      if (q === p) continue;
      for (const s of samples) expect(inside(s, q.polygon), `${def.fefco}: ${p.id} overlaps ${q.id}`).toBe(false);
    }
  }
  expect(m.cutLines.length).toBeGreaterThan(0);

  // Print area: every printable panel's bleed region covers at least the panel; glue flaps stay ink-free.
  const byId = new Map(m.panels.map((p) => [p.id, p]));
  for (const r of m.bleedRegions) {
    const p = byId.get(r.panelId)!;
    expect(p.printable).toBe(true);
    expect(polygonArea(r.polygon)).toBeGreaterThanOrEqual(polygonArea(p.polygon) - 1e-6);
  }
  for (const p of m.panels.filter((x) => x.role === "glue")) expect(m.bleedRegions.some((r) => r.panelId === p.id)).toBe(false);
  for (const z of m.safeZones) {
    const p = byId.get(z.panelId)!;
    expect(z.rect.x).toBeGreaterThanOrEqual(p.bbox.x - 1e-6);
    expect(z.rect.y).toBeGreaterThanOrEqual(p.bbox.y - 1e-6);
    expect(z.rect.x + z.rect.width).toBeLessThanOrEqual(p.bbox.x + p.bbox.width + 1e-6);
    expect(z.rect.y + z.rect.height).toBeLessThanOrEqual(p.bbox.y + p.bbox.height + 1e-6);
    // R5-3Q-C-07: the safe zone is on board (a display front's cut-away is not printable)
    if (z.rect.width > 0 && z.rect.height > 0)
      for (const [fx, fy] of [[0.01, 0.01], [0.99, 0.01], [0.01, 0.99], [0.99, 0.99], [0.5, 0.5], [0.5, 0.01], [0.5, 0.99]])
        expect(insidePoly({ x: z.rect.x + z.rect.width * fx, y: z.rect.y + z.rect.height * fy }, p.polygon), `${z.panelId} safe zone on board`).toBe(true);
  }

  // Board use.
  expect(m.metrics.blankAreaM2).toBeGreaterThan(0);
  expect(m.metrics.netAreaM2).toBeLessThanOrEqual(m.metrics.blankAreaM2 + 1e-9);

  // Closed box: outer = inner + board layers (within a few board thicknesses), never smaller.
  const o = m.closedOuter;
  expect(o.L).toBeGreaterThanOrEqual(L - 0.01);
  expect(o.W).toBeGreaterThanOrEqual(W - 0.01);
  expect(o.H).toBeGreaterThanOrEqual(H - 0.01);
  expect(o.L).toBeLessThanOrEqual(L + 8 * t + 0.01);
  expect(o.W).toBeLessThanOrEqual(W + 8 * t + 0.01);
  if (!TALL.has(def.fefco)) expect(o.H).toBeLessThanOrEqual(H + 4 * t + 0.01);

  // Faces of the closed box.
  const faces = Object.keys(m.faces);
  expect(faces).toContain("front");
  expect(faces).toContain("bottom");
  expect(faces).toContain("back");
  if (def.fefco !== "0404") {
    expect(faces).toContain("left");
    expect(faces).toContain("right");
  }
  if (m.panels.some((p) => p.role === "top")) expect(faces).toContain("top");
  for (const f of Object.values(m.faces)) {
    expect(f!.width).toBeGreaterThan(0);
    expect(f!.height).toBeGreaterThan(0);
  }
}

describe.each(DEFINITIONS.map((d) => [d.fefco, d] as const))("FEFCO %s dieline", (_f, def) => {
  it.each(THICKNESSES)("default size at t=%s mm", (t) => checkModel(def, gen(def, t)));
  it("every preset (B flute) and the size limits", () => {
    for (const preset of def.presets) checkModel(def, gen(def, 3, preset.dims));
    const { L, W, H } = def.params;
    const lo = { L: L.min, W: Math.max(W.min, H.min), H: H.min };
    const hi = { L: L.max, W: W.max, H: Math.min(H.max, W.max) };
    for (const d of [lo, hi]) if (validateFamilyDims(def, d).ok) checkModel(def, gen(def, 1.5, d));
  });
});

describe("FEFCO 04 construction details", () => {
  const worldPoints = (m: Fefco04Model, id: string) => {
    const poses = computePoses(m, 1);
    const p = m.panels.find((x) => x.id === id)!;
    const pivot = panelPivot(p, m.thicknessMm);
    return p.polygon.map((q) => panelLocalPoint(p, q, 0, pivot, m.thicknessMm, new Vector3()).applyMatrix4(poses.get(id)!.world));
  };

  it("interior bottom flaps fold onto the base, inside the walls", () => {
    for (const def of DEFINITIONS.filter((d) => d.subFamily === "interior-flap-tray")) {
      const m = gen(def, 3);
      const box = boundsAt(m, 1);
      const flaps = m.panels.filter((p) => p.id.endsWith("BottomFlap"));
      expect(flaps.length, def.fefco).toBeGreaterThan(0);
      for (const f of flaps) {
        for (const v of worldPoints(m, f.id)) {
          expect(v.y, `${def.fefco} ${f.id}`).toBeLessThan(box.min.y + 3 * m.thicknessMm + 1);
          expect(v.y).toBeGreaterThanOrEqual(box.min.y + m.thicknessMm - 0.01);
          expect(v.x).toBeGreaterThan(box.min.x);
          expect(v.x).toBeLessThan(box.max.x);
        }
      }
    }
  });

  it("rolled inner walls hang inside their outer wall", () => {
    const m = gen(definitionByCode("0425")!, 3);
    const box = boundsAt(m, 1);
    for (const p of m.panels.filter((x) => x.role === "inner")) {
      expect(p.foldAngleClosed).toBe(180);
      for (const v of worldPoints(m, p.id)) {
        expect(v.x).toBeGreaterThan(box.min.x + m.thicknessMm - 0.01);
        expect(v.x).toBeLessThan(box.max.x - m.thicknessMm + 0.01);
      }
    }
  });

  it("0421 thickness compensation: L + 2·3t, W + 2t, H + 2t", () => {
    const t = 3;
    const m = gen(definitionByCode("0421")!, t, { L: 250, W: 180, H: 80 });
    expect(m.closedOuter.L).toBeCloseTo(250 + 6 * t, 3);
    expect(m.closedOuter.W).toBeCloseTo(180 + 2 * t, 3);
    expect(m.closedOuter.H).toBeCloseTo(80 + 2 * t, 3);
  });

  it("0409 five panel folder closes to the product size", () => {
    const t = 3;
    const m = gen(definitionByCode("0409")!, t, { L: 1000, W: 100, H: 80 });
    expect(m.closedOuter.L).toBeCloseTo(1000 + 2 * 3 * t, 3);
    expect(m.closedOuter.W).toBeCloseTo(100 + 2 * t, 3);
    expect(m.panels.some((p) => p.id === "fifth")).toBe(true);
  });

  it("0405 Bliss: three blanks, end panels fill the body opening", () => {
    const t = 3;
    const m = gen(definitionByCode("0405")!, t, { L: 400, W: 300, H: 250 });
    expect(m.pieces.map((p) => p.label)).toEqual(["Body", "Right end", "Left end"]);
    expect(m.closedOuter.L).toBeCloseTo(400 + 2 * t, 3);
    expect(m.closedOuter.W).toBeCloseTo(300 + 2 * t, 3);
    expect(m.closedOuter.H).toBeCloseTo(250 + 2 * t, 3);
    expect(m.faces.left?.parts.some((x) => x.panelId === "endL")).toBe(true);
    expect(m.faces.right?.parts.some((x) => x.panelId === "endR")).toBe(true);
  });

  it("0459 octagonal tray has chamfered corner walls", () => {
    const m = gen(definitionByCode("0459")!, 1.5);
    expect(m.panels.find((p) => p.id === "base")!.polygon).toHaveLength(8);
    expect(m.panels.filter((p) => p.id.startsWith("corner"))).toHaveLength(4);
  });

  it("display trays have a lowered front, headers raise the back", () => {
    const m = gen(definitionByCode("0449")!, 1.5, { L: 300, W: 200, H: 100 });
    expect(m.panels.find((p) => p.id === "front")!.polygon.length).toBe(8);
    expect(m.closedOuter.H).toBeGreaterThan(100 + 0.7 * 100);
  });

  it("hand holes are cut through both layers of rolled end walls", () => {
    const m = gen(definitionByCode("0422_1")!, 3);
    for (const id of ["left", "right", "leftInner", "rightInner"]) expect(m.panels.find((p) => p.id === id)!.holes?.length, id).toBe(1);
  });

  it("windows are only cut where supported", () => {
    const lid = definitionByCode("0470")!;
    const m = generateFamilyDieline(lid, lid.defaultDims, { thicknessMm: 1.5, features: { window: { face: "top" } } });
    expect(m.features.window?.face).toBe("top");
    expect(m.panels.find((p) => p.id === "top")!.holes?.length).toBe(1);
    expect(m.metrics.filmAreaM2).toBeGreaterThan(0);
    const open = definitionByCode("0452")!;
    const n = generateFamilyDieline(open, open.defaultDims, { thicknessMm: 1.5, features: { window: { face: "top" } } });
    expect(n.features.window).toBeUndefined();
  });
});
