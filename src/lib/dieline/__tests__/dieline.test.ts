import { describe, expect, it } from "vitest";
import { Vec3 as Vector3 } from "@/lib/dieline/math";
import { STRUCTURE_CODES, type Dims, type FaceId, type MaterialCode, type StructureCode } from "@/types";
import {
  BOARD_SPECS,
  DEFAULT_DIMS,
  DielineValidationError,
  STRUCTURE_LIMITS,
  applyAffine,
  boardArea,
  boundsAt,
  clampDims,
  computePoses,
  dielineToSvg,
  faceTransform,
  generateDieline,
  materialFitsStructure,
  surfaceCanvasSize,
  svg,
  tryGenerateDieline,
  validateDims,
  STRUCTURES,
  tubeSegments,
  type DielineModel,
  type Polygon,
  type Pt,
} from "..";
import { bboxOf } from "../geometry";

const EXPECTED_PANELS: Partial<Record<StructureCode, number>> = {
  FEFCO_0427: 16,
  FEFCO_0201: 13,
  ECMA_RTE: 13,
  ECMA_STE: 13,
  PIZZA: 15,
  SLEEVE: 5,
  FEFCO_0320: 18,
  ECMA_CLB: 13,
  ECMA_SLB: 13,
  FEFCO_0422: 11,
  GABLE_BOX: 17,
  PAPER_TUBE: -1, // depends on the strip count (diameter)
  RIGID_BOX: 26,
};

const ALL: FaceId[] = ["front", "back", "left", "right", "top", "bottom"];
const EXPECTED_FACES: Partial<Record<StructureCode, FaceId[]>> = {
  FEFCO_0427: ALL,
  FEFCO_0201: ALL,
  ECMA_RTE: ALL,
  ECMA_STE: ALL,
  PIZZA: ALL,
  SLEEVE: ["front", "back", "top", "bottom"],
  FEFCO_0320: ALL,
  ECMA_CLB: ALL,
  ECMA_SLB: ALL,
  FEFCO_0422: ["front", "back", "left", "right", "bottom"],
  GABLE_BOX: ["front", "back", "left", "right", "bottom"],
  PAPER_TUBE: ["front", "back", "top"],
  RIGID_BOX: ALL,
};

/**
 * Outer size of the closed box = inner + board layers. Exact per structure (mm), so the
 * thickness compensation of every generator is pinned down.
 */
function expectedOuter(code: StructureCode, d: Dims, t: number): Dims {
  switch (code) {
    case "FEFCO_0427":
      return { L: d.L + 6 * t, W: d.W + 3 * t, H: d.H + 2 * t };
    case "PIZZA":
      return { L: d.L + 6 * t, W: d.W + 2 * t, H: d.H + 2 * t };
    case "FEFCO_0422":
      return { L: d.L + 6 * t, W: d.W + 2 * t, H: d.H + t };
    case "FEFCO_0201":
    case "ECMA_RTE":
    case "ECMA_STE":
      return { L: d.L + 2 * t, W: d.W + 2 * t, H: d.H + 4 * t };
    case "ECMA_CLB":
    case "ECMA_SLB":
      return { L: d.L + 2 * t, W: d.W + 2 * t, H: d.H + 5 * t };
    case "SLEEVE":
      return { L: d.L, W: d.W + 2 * t, H: d.H + 2 * t };
    case "FEFCO_0320": {
      const c = Math.max(1, t * 0.5);
      // + t in L (R5-3Q-A): the lid's manufacturer's joint lies inside its left wall, so the
      // lid is one caliper longer to keep `c` clear of the base on both ends.
      return { L: d.L + 5 * t + 2 * c, W: d.W + 4 * t + 2 * c, H: d.H + 4 * t };
    }
    case "RIGID_BOX":
      return { L: d.L + 4 * t + 1, W: d.W + 4 * t + 1, H: d.H + 2 * t };
    case "PAPER_TUBE":
      return { L: d.L + 4 * t + 0.8, W: d.L + 4 * t + 0.8, H: d.H + 2 * t };
    case "GABLE_BOX":
      return { L: d.L + 2 * t, W: d.W + 2 * t, H: NaN };
    default:
      return d;
  }
}

const MATERIALS = Object.keys(BOARD_SPECS) as MaterialCode[];

function pointInPolygon(p: Pt, poly: Polygon): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function allFinite(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(allFinite);
  if (value && typeof value === "object") return Object.values(value).every(allFinite);
  return true;
}

/** Size variations: default, every preset-like extreme that satisfies the rules. */
function sizeCases(code: StructureCode): Dims[] {
  const l = STRUCTURE_LIMITS[code];
  const cases: Dims[] = [DEFAULT_DIMS[code]];
  cases.push(clampDims(code, { L: l.L.min, W: l.W.min, H: l.H.min }));
  cases.push(clampDims(code, { L: l.L.max, W: l.W.max, H: l.H.max }));
  cases.push(clampDims(code, { L: l.L.max, W: l.W.min, H: l.H.min }));
  cases.push(clampDims(code, { L: l.L.min, W: l.W.max, H: l.H.max }));
  return cases.filter((d) => validateDims(code, d).ok);
}

// Container print parts (ROLL_LABEL, PRINTED_POUCH, PRINTED_TUBE) are flat: tested below.
const BOX_CODES = STRUCTURE_CODES.filter((c) => STRUCTURES[c].shape !== "flat");

describe("flat container parts", () => {
  // PAPER_BAG is "flat" (it ships flat) but is a real bag die: see families/bags/__tests__.
  for (const code of STRUCTURE_CODES.filter((c) => STRUCTURES[c].shape === "flat" && c !== "PAPER_BAG" && c !== "PLASTIC_BAG")) {
    it(`${code} is one printable L × H panel with its area`, () => {
      const m = generateDieline(code, DEFAULT_DIMS[code], { thicknessMm: 0.1 });
      expect(m.panels).toHaveLength(1);
      expect(m.faces.front).toBeTruthy();
      expect(m.metrics.blankAreaM2).toBeCloseTo((DEFAULT_DIMS[code].L * DEFAULT_DIMS[code].H) / 1e6, 6);
    });
  }
});

describe.each(BOX_CODES)("dieline %s", (code) => {
  const materials = MATERIALS.filter((m) => materialFitsStructure(m, code));

  it("has at least one compatible material", () => {
    expect(materials.length).toBeGreaterThan(0);
  });

  for (const material of materials) {
    const t = BOARD_SPECS[material].thicknessMm;
    for (const dims of sizeCases(code)) {
      describe(`${material} ${dims.L}x${dims.W}x${dims.H}`, () => {
        const model = generateDieline(code, dims, { thicknessMm: t });

        it("has the expected panels: one tree per cut piece", () => {
          if (code === "PAPER_TUBE") {
            const n = tubeSegments(dims.L + 2 * t);
            expect(model.panels).toHaveLength(2 * (n + 2));
          } else expect(model.panels).toHaveLength(EXPECTED_PANELS[code]!);
          const ids = new Set(model.panels.map((p) => p.id));
          expect(ids.size).toBe(model.panels.length);
          const roots = model.panels.filter((p) => p.parentId === null);
          expect(roots[0].id).toBe(model.rootId);
          expect(roots.length).toBe(STRUCTURES[code].pieces);
          expect(model.pieces.map((p) => p.rootId).sort()).toEqual(roots.map((r) => r.id).sort());
          for (const r of roots) if (r.id !== model.rootId) expect(r.assembly?.matrix).toHaveLength(16);
          for (const p of model.panels) {
            if (p.parentId) {
              expect(ids.has(p.parentId)).toBe(true);
              expect(p.hinge).not.toBeNull();
            }
            expect(p.polygon.length).toBeGreaterThanOrEqual(3);
            expect(p.pieceId && ids.has(p.pieceId)).toBe(true);
          }
        });

        it("contains no NaN or Infinity", () => {
          expect(allFinite(model)).toBe(true);
        });

        it("fits the sheet with bleed on every side", () => {
          expect(model.sheet.width).toBeCloseTo(model.dieBounds.width + 2 * model.bleedMm, 6);
          expect(model.sheet.height).toBeCloseTo(model.dieBounds.height + 2 * model.bleedMm, 6);
          for (const p of model.panels)
            for (const q of p.polygon) {
              expect(q.x).toBeGreaterThanOrEqual(model.bleedMm - 1e-6);
              expect(q.y).toBeGreaterThanOrEqual(model.bleedMm - 1e-6);
              expect(q.x).toBeLessThanOrEqual(model.sheet.width - model.bleedMm + 1e-6);
              expect(q.y).toBeLessThanOrEqual(model.sheet.height - model.bleedMm + 1e-6);
            }
        });

        it("closes to the requested inner size (thickness compensated)", () => {
          const e = expectedOuter(code, dims, t);
          const tol = 0.05 + (code === "PAPER_TUBE" ? 0.03 * dims.L : 0);
          expect(Math.abs(model.closedOuter.L - e.L)).toBeLessThan(tol);
          expect(Math.abs(model.closedOuter.W - e.W)).toBeLessThan(tol);
          if (Number.isFinite(e.H)) expect(Math.abs(model.closedOuter.H - e.H)).toBeLessThan(code === "PAPER_TUBE" ? 0.05 : tol);
          else expect(model.closedOuter.H).toBeGreaterThan(dims.H + 2 * t);
          // independent check straight from the kinematics
          const size = boundsAt(model, 1).getSize(new Vector3());
          expect(Math.abs(size.x - model.closedOuter.L)).toBeLessThan(1e-6);
        });

        it("is flat at progress 0", () => {
          const box = boundsAt(model, 0);
          const maxStack = Math.max(...model.panels.map((p) => -p.stackOffset));
          expect(box.max.z - box.min.z).toBeLessThanOrEqual(t * (maxStack + 1) + 1e-6);
          const poses = computePoses(model, 0);
          expect(poses.size).toBe(model.panels.length);
        });

        it("maps every face to the panels that form it", () => {
          expect(Object.keys(model.faces).sort()).toEqual([...EXPECTED_FACES[code]!].sort());
          for (const face of Object.values(model.faces)) {
            if (!face) continue;
            expect(face.width).toBeGreaterThan(0);
            expect(face.height).toBeGreaterThan(0);
            const covered = face.parts.reduce((s, p) => s + p.rect.width * p.rect.height, 0);
            // RSC slots leave small gaps; lock bottoms show only their outer flap(s).
            expect(covered / (face.width * face.height)).toBeGreaterThan(face.face === "bottom" ? 0.6 : 0.85);
            for (const part of face.parts) {
              const panel = model.panels.find((p) => p.id === part.panelId)!;
              expect(panel.printable).toBe(true);
              const cx = part.rect.x + part.rect.width / 2;
              const cy = part.rect.y + part.rect.height / 2;
              const inPanel = (q: Pt) => pointInPolygon(q, panel.polygon) || (q.x >= panel.bbox.x - 1e-6 && q.x <= panel.bbox.x + panel.bbox.width + 1e-6 && q.y >= panel.bbox.y - 1e-6 && q.y <= panel.bbox.y + panel.bbox.height + 1e-6);
              expect(inPanel(applyAffine(part.transform, cx, cy))).toBe(true);
              // inside view mirrors left/right but stays on the same panel
              const inside = faceTransform(face, part, "inside");
              expect(inPanel(applyAffine(inside, face.width - cx, cy))).toBe(true);
              // face transforms are never mirrored on the outside (rigid, except the
              // tube lid label, which is a hair wider than the body it is mapped to)
              const [a, b, c, d] = part.transform;
              const det = a * d - b * c;
              if (code === "PAPER_TUBE") expect(det).toBeGreaterThan(0.95);
              else expect(det).toBeCloseTo(1, 6);
              const [ia, ib, ic, id] = inside;
              expect(Math.sign(ia * id - ib * ic)).toBe(-1);
            }
          }
        });

        it("has cut and crease lines, bleed and safe zones", () => {
          const realHinges = model.panels.filter((p) => p.hinge && p.hingeKind !== "roll").length;
          expect(model.creaseLines.length).toBeGreaterThanOrEqual(realHinges);
          expect(model.cutLines.length).toBeGreaterThan(model.pieces.length * 3);
          expect(model.bleedRegions.length).toBe(model.panels.filter((p) => p.printable).length);
          for (const r of model.bleedRegions) {
            const panel = model.panels.find((p) => p.id === r.panelId)!;
            const bb = bboxOf(r.polygon);
            expect(bb.x).toBeLessThanOrEqual(panel.bbox.x + 1e-3);
            expect(bb.y).toBeLessThanOrEqual(panel.bbox.y + 1e-3);
            expect(bb.x + bb.width).toBeGreaterThanOrEqual(panel.bbox.x + panel.bbox.width - 1e-3);
            expect(bb.y + bb.height).toBeGreaterThanOrEqual(panel.bbox.y + panel.bbox.height - 1e-3);
          }
          expect(model.safeZones.length).toBeGreaterThan(0);
          expect(model.printRegions.outside.length).toBe(model.bleedRegions.length);
        });

        it("reports board area for pricing", () => {
          const m = boardArea(model);
          expect(m.blankAreaM2).toBeGreaterThan(0);
          expect(m.netAreaM2).toBeGreaterThan(0);
          expect(m.netAreaM2).toBeLessThanOrEqual(m.blankAreaM2 + 1e-9);
          expect(m.blankAreaM2).toBeLessThanOrEqual((m.blankWidthMm * m.blankHeightMm) / 1e6 + 1e-9);
          if (model.pieces.length === 1) expect(m.blankAreaM2).toBeCloseTo((m.blankWidthMm * m.blankHeightMm) / 1e6, 9);
          expect(m.pieceCount).toBe(model.pieces.length);
          expect(m.cutLengthMm).toBeGreaterThan(0);
          expect(m.creaseLengthMm).toBeGreaterThan(0);
        });

        it("renders an SVG", () => {
          const out = dielineToSvg(model, { title: "Test & <dieline>" });
          expect(out.startsWith("<svg")).toBe(true);
          expect(out.endsWith("</svg>")).toBe(true);
          expect(out).toContain('data-layer="cut"');
          expect(out).toContain('data-layer="crease"');
          expect(out).toContain("Test &amp; &lt;dieline&gt;");
          expect(out).not.toMatch(/NaN|undefined|Infinity/);
          expect(out.match(/data-panel=/g)).toHaveLength(model.panels.length);
          expect(svg(model)).toBe(dielineToSvg(model));
        });
      });
    }
  }
});

describe("validation", () => {
  it("rejects sizes outside the limits", () => {
    const r = validateDims("ECMA_RTE", { L: 10, W: 60, H: 999 });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues).toContainEqual({ path: "L", code: "TOO_SMALL", limit: 30 });
      expect(r.issues).toContainEqual({ path: "H", code: "TOO_LARGE", limit: 300 });
    }
    expect(() => generateDieline("ECMA_RTE", { L: 10, W: 60, H: 140 }, { thicknessMm: 0.4 })).toThrow(DielineValidationError);
    expect(tryGenerateDieline("ECMA_RTE", { L: 10, W: 60, H: 140 }, { thicknessMm: 0.4 })).toBeNull();
  });

  it("enforces structure rules", () => {
    const mailer = validateDims("FEFCO_0427", { L: 250, W: 100, H: 150 });
    expect(mailer.ok).toBe(false);
    if (!mailer.ok) expect(mailer.issues[0]).toMatchObject({ code: "RULE", rule: "H <= W" });
    const pizza = validateDims("PIZZA", { L: 300, W: 250, H: 40 });
    expect(pizza.ok).toBe(false);
    if (!pizza.ok) expect(pizza.issues[0]).toMatchObject({ code: "RULE", rule: "L == W" });
    expect(validateDims("PIZZA", { L: 300, W: 300, H: 40 }).ok).toBe(true);
  });

  it("rejects non-numbers and bad thickness", () => {
    expect(validateDims("SLEEVE", { L: "a", W: 100, H: 50 }).ok).toBe(false);
    expect(() => generateDieline("SLEEVE", DEFAULT_DIMS.SLEEVE, { thicknessMm: 0 })).toThrow(DielineValidationError);
    expect(() => generateDieline("SLEEVE", { L: NaN, W: 100, H: 50 }, { thicknessMm: 0.4 })).toThrow(DielineValidationError);
  });

  it("clamps into the limits and rules", () => {
    expect(clampDims("FEFCO_0427", { L: 10, W: 100, H: 200 })).toEqual({ L: 80, W: 100, H: 100 });
    expect(clampDims("PIZZA", { L: 320, W: 250, H: 100 })).toEqual({ L: 320, W: 320, H: 60 });
  });
});

describe("fold kinematics", () => {
  const model: DielineModel = generateDieline("FEFCO_0201", DEFAULT_DIMS.FEFCO_0201, { thicknessMm: 1.5 });

  it("grows from flat to box height monotonically-ish and ends closed", () => {
    const heights = [0, 0.25, 0.5, 0.75, 1].map((p) => {
      const b = boundsAt(model, p);
      return b.max.z - b.min.z;
    });
    expect(heights[0]).toBeLessThan(5);
    expect(heights[4]).toBeCloseTo(model.closedOuter.W, 3);
  });

  it("keeps the root still and folds children", () => {
    const flat = computePoses(model, 0);
    const closed = computePoses(model, 1);
    expect(flat.get(model.rootId)!.world.equals(closed.get(model.rootId)!.world)).toBe(true);
    expect(flat.get("back")!.world.equals(closed.get("back")!.world)).toBe(false);
  });
});

describe("textures", () => {
  it("caps canvas size at 2048 px and keeps the sheet aspect", () => {
    for (const code of STRUCTURE_CODES) {
      const m = generateDieline(code, clampDims(code, { L: 9999, W: 9999, H: 9999 }), { thicknessMm: 3 });
      const s = surfaceCanvasSize(m, 4096);
      expect(Math.max(s.width, s.height)).toBeLessThanOrEqual(2048);
      expect(s.width / s.height).toBeCloseTo(m.sheet.width / m.sheet.height, 1);
    }
  });
});
