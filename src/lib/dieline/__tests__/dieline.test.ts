import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
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
  type DielineModel,
  type Polygon,
  type Pt,
} from "..";

const EXPECTED_PANELS: Record<StructureCode, number> = {
  FEFCO_0427: 16,
  FEFCO_0201: 13,
  ECMA_RTE: 13,
  ECMA_STE: 13,
  PIZZA: 15,
  SLEEVE: 5,
};

const EXPECTED_FACES: Record<StructureCode, FaceId[]> = {
  FEFCO_0427: ["front", "back", "left", "right", "top", "bottom"],
  FEFCO_0201: ["front", "back", "left", "right", "top", "bottom"],
  ECMA_RTE: ["front", "back", "left", "right", "top", "bottom"],
  ECMA_STE: ["front", "back", "left", "right", "top", "bottom"],
  PIZZA: ["front", "back", "left", "right", "top", "bottom"],
  SLEEVE: ["front", "back", "top", "bottom"],
};

const MATERIALS = Object.keys(BOARD_SPECS) as MaterialCode[];

function pointInConvex(p: Pt, poly: Polygon, tol = 1e-6): boolean {
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const c = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    if (Math.abs(c) < tol) continue;
    const s = Math.sign(c);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
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

describe.each(STRUCTURE_CODES)("dieline %s", (code) => {
  const materials = MATERIALS.filter((m) => materialFitsStructure(m, code));

  it("has at least one compatible material", () => {
    expect(materials.length).toBeGreaterThan(0);
  });

  for (const material of materials) {
    const t = BOARD_SPECS[material].thicknessMm;
    for (const dims of sizeCases(code)) {
      describe(`${material} ${dims.L}x${dims.W}x${dims.H}`, () => {
        const model = generateDieline(code, dims, { thicknessMm: t });

        it("has the expected panels and a single rooted tree", () => {
          expect(model.panels).toHaveLength(EXPECTED_PANELS[code]);
          const ids = new Set(model.panels.map((p) => p.id));
          expect(ids.size).toBe(model.panels.length);
          expect(model.panels.filter((p) => p.parentId === null).map((p) => p.id)).toEqual([model.rootId]);
          for (const p of model.panels) {
            if (p.parentId) {
              expect(ids.has(p.parentId)).toBe(true);
              expect(p.hinge).not.toBeNull();
            }
            expect(p.polygon.length).toBeGreaterThanOrEqual(3);
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

        it("closes to the requested size (outer = inner + 2t)", () => {
          const tol = 2 * t + 0.5;
          const lExpected = code === "SLEEVE" ? dims.L : dims.L + 2 * t;
          expect(Math.abs(model.closedOuter.L - lExpected)).toBeLessThan(tol);
          expect(Math.abs(model.closedOuter.W - (dims.W + 2 * t))).toBeLessThan(tol);
          expect(Math.abs(model.closedOuter.H - (dims.H + 2 * t))).toBeLessThan(tol);
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
          expect(Object.keys(model.faces).sort()).toEqual([...EXPECTED_FACES[code]].sort());
          for (const face of Object.values(model.faces)) {
            if (!face) continue;
            expect(face.width).toBeGreaterThan(0);
            expect(face.height).toBeGreaterThan(0);
            const covered = face.parts.reduce((s, p) => s + p.rect.width * p.rect.height, 0);
            expect(covered / (face.width * face.height)).toBeGreaterThan(0.85); // RSC slots leave small gaps
            for (const part of face.parts) {
              const panel = model.panels.find((p) => p.id === part.panelId)!;
              const cx = part.rect.x + part.rect.width / 2;
              const cy = part.rect.y + part.rect.height / 2;
              expect(pointInConvex(applyAffine(part.transform, cx, cy), panel.polygon)).toBe(true);
              // inside view mirrors left/right but stays on the same panel
              const inside = faceTransform(face, part, "inside");
              expect(pointInConvex(applyAffine(inside, face.width - cx, cy), panel.polygon)).toBe(true);
              // face transforms are rigid and never mirrored on the outside
              const [a, b, c, d] = part.transform;
              expect(a * d - b * c).toBeCloseTo(1, 6);
              const [ia, ib, ic, id] = inside;
              expect(ia * id - ib * ic).toBeCloseTo(-1, 6);
            }
          }
        });

        it("has cut and crease lines, bleed and safe zones", () => {
          expect(model.creaseLines).toHaveLength(model.panels.length - 1);
          expect(model.cutLines.length).toBeGreaterThan(model.panels.length);
          expect(model.bleedRegions.length).toBe(model.panels.filter((p) => p.printable).length);
          for (const r of model.bleedRegions) {
            const panel = model.panels.find((p) => p.id === r.panelId)!;
            for (const q of panel.polygon) expect(pointInConvex(q, r.polygon, 1e-3)).toBe(true);
          }
          expect(model.safeZones.length).toBeGreaterThan(0);
          expect(model.printRegions.outside.length).toBe(model.bleedRegions.length);
        });

        it("reports board area for pricing", () => {
          const m = boardArea(model);
          expect(m.blankAreaM2).toBeGreaterThan(0);
          expect(m.netAreaM2).toBeGreaterThan(0);
          expect(m.netAreaM2).toBeLessThanOrEqual(m.blankAreaM2 + 1e-9);
          expect(m.blankAreaM2).toBeCloseTo((m.blankWidthMm * m.blankHeightMm) / 1e6, 9);
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
