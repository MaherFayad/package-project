import { describe, expect, it } from "vitest";
import { Box3, Vector3 } from "three";
import { boundsAt, computePoses, panelLocalPoint, panelPivot } from "@/lib/dieline/fold";
import { polygonArea, segLength } from "@/lib/dieline/geometry";
import { DielineValidationError } from "@/lib/dieline/limits";
import { BOARD_SPECS } from "@/lib/dieline/materials";
import { AUTO_BOTTOM_SEQUENCE, DEFINITIONS, definitionByCode, generateFamilyDieline, printAreaM2, tryGenerateFamilyDieline, validateFamilyDims } from "..";
import type { FamilyDielineModel } from "..";
import type { DielineModel } from "@/lib/dieline/types";
import { overlappingPanels } from "../../fefco-09/__tests__/overlap";

const GROUP_06 = ["0601", "0602", "0605", "0606", "0607", "0608", "0610", "0615", "0616", "0620", "0621"];
const GROUP_07 = ["0700", "0701", "0703", "0711", "0712", "0713", "0714", "0715", "0716", "0717", "0718", "0747", "0748", "0751", "0752", "0759", "0761", "0770", "0771", "0772", "0773", "0774"];
const THICKNESSES = [1.5, 3];
const ARABIC_DIACRITICS = /[ً-ْٰ]/;

const finite = (m: FamilyDielineModel) => {
  const nums: number[] = [m.sheet.width, m.sheet.height, m.closedOuter.L, m.closedOuter.W, m.closedOuter.H, ...Object.values(m.metrics)];
  for (const p of m.panels) {
    for (const q of p.polygon) nums.push(q.x, q.y);
    for (const h of p.holes ?? []) for (const q of h) nums.push(q.x, q.y);
    if (p.hinge) nums.push(p.hinge.a.x, p.hinge.a.y, p.hinge.b.x, p.hinge.b.y);
    if (p.assembly) nums.push(...p.assembly.matrix);
  }
  for (const s of [...m.cutLines, ...m.creaseLines, ...m.perfLines]) nums.push(s.a.x, s.a.y, s.b.x, s.b.y);
  for (const f of Object.values(m.faces)) for (const part of f!.parts) nums.push(...part.transform, part.rect.x, part.rect.y, part.rect.width, part.rect.height);
  return nums.every(Number.isFinite);
};

describe("FEFCO 06 / 07 catalogue", () => {
  it("covers every FEFCO Code (11th ed.) style of groups 06 and 07", () => {
    expect(DEFINITIONS.map((d) => d.standard.replace("FEFCO ", "")).sort()).toEqual([...GROUP_06, ...GROUP_07].sort());
  });

  it("has unique codes and slugs and consistent metadata", () => {
    expect(new Set(DEFINITIONS.map((d) => d.code)).size).toBe(DEFINITIONS.length);
    expect(new Set(DEFINITIONS.map((d) => d.slug)).size).toBe(DEFINITIONS.length);
    for (const d of DEFINITIONS) {
      expect(d.code).toBe(`FEFCO_${d.standard.slice(6)}`);
      expect(d.family).toBe("CORRUGATED");
      expect(d.subFamily.length).toBeGreaterThan(0);
      for (const text of [d.name.ar, d.description.ar, ...d.presets.map((p) => p.name.ar), ...d.foldSequence.map((s) => s.ar)]) {
        expect(text, `${d.code}: ${text}`).not.toMatch(ARABIC_DIACRITICS);
        expect(text).toMatch(/[؀-ۿ]/);
      }
      expect(d.name.en.length).toBeGreaterThan(3);
      expect(d.description.en.length).toBeGreaterThan(10);
      expect(d.presets.length).toBeGreaterThanOrEqual(2);
      expect(d.presets.length).toBeLessThanOrEqual(4);
      expect(d.materials.length).toBeGreaterThan(0);
      for (const m of d.materials) expect(BOARD_SPECS[m].family).toBe("CORRUGATED");
      expect(d.uses.length).toBeGreaterThan(0);
      expect(validateFamilyDims(d, d.defaultDims).ok, `${d.code} default`).toBe(true);
      for (const p of d.presets) expect(validateFamilyDims(d, p.dims).ok, `${d.code} preset ${p.id}`).toBe(true);
    }
  });

  it("documents the auto-erect bottom sequence on every crash-lock case", () => {
    for (const d of DEFINITIONS.filter((x) => x.subFamily.startsWith("auto-bottom"))) {
      expect(d.foldSequence.slice(0, 3)).toEqual(AUTO_BOTTOM_SEQUENCE);
    }
  });
});

for (const def of DEFINITIONS) {
  describe(`${def.code} ${def.name.en}`, () => {
    const sizes = [def.defaultDims, ...def.presets.map((p) => p.dims)];

    for (const t of THICKNESSES) {
      it(`generates a finite, closable dieline (t=${t})`, () => {
        for (const dims of sizes) {
          const m = generateFamilyDieline(def, dims, { thicknessMm: t });
          expect(finite(m)).toBe(true);
          expect(m.structureCode).toBe(def.code);
          expect(m.panels.length).toBeGreaterThan(4);
          expect(m.cutLines.length).toBeGreaterThan(4);
          expect(m.creaseLines.length).toBeGreaterThan(3);
          // Closed outer size = inner + board layers (model kinematics vs. closed-form).
          const e = def.outerSize(dims, t);
          const tol = 0.05 + t * 0.05;
          expect(Math.abs(m.closedOuter.L - e.L), `L ${JSON.stringify(dims)}`).toBeLessThan(tol);
          expect(Math.abs(m.closedOuter.W - e.W), `W ${JSON.stringify(dims)}`).toBeLessThan(tol);
          expect(Math.abs(m.closedOuter.H - e.H), `H ${JSON.stringify(dims)}`).toBeLessThan(tol);
          // Inner never smaller than requested.
          expect(m.closedOuter.L).toBeGreaterThanOrEqual(dims.L);
          expect(m.closedOuter.W).toBeGreaterThanOrEqual(dims.W);
          expect(m.closedOuter.H).toBeGreaterThanOrEqual(dims.H);
          const size = boundsAt(m, 1).getSize(new Vector3());
          expect(Math.abs(size.x - m.closedOuter.L)).toBeLessThan(1e-6);
          expect(m.pieces.length).toBe(m.metrics.pieceCount);
        }
      });
    }

    it("stays finite and on-size at the corners of its limits", () => {
      const { L, W, H } = def.params;
      for (const l of [L.min, L.max]) for (const w of [W.min, W.max]) for (const h of [H.min, H.max]) {
        const dims = { L: l, W: w, H: h };
        if (!validateFamilyDims(def, dims).ok) continue;
        for (const t of THICKNESSES) {
          const m = generateFamilyDieline(def, dims, { thicknessMm: t });
          expect(finite(m), `${JSON.stringify(dims)} t=${t}`).toBe(true);
          const e = def.outerSize(dims, t);
          expect(Math.abs(m.closedOuter.L - e.L) + Math.abs(m.closedOuter.W - e.W) + Math.abs(m.closedOuter.H - e.H), `${JSON.stringify(dims)} t=${t}`).toBeLessThan(0.1 + t * 0.1);
        }
      }
    });

    it("no two panels share board when closed or half folded (no z-fighting)", () => {
      const { L, W, H } = def.params;
      const corners = [{ L: L.min, W: W.min, H: H.min }, { L: L.max, W: W.max, H: H.max }, { L: L.max, W: W.min, H: H.min }].filter((d) => validateFamilyDims(def, d).ok);
      for (const t of THICKNESSES) {
        for (const dims of [...sizes, ...corners]) {
          const m = generateFamilyDieline(def, dims, { thicknessMm: t }) as unknown as DielineModel;
          expect(overlappingPanels(m, 1), `closed ${JSON.stringify(dims)} t=${t}`).toEqual([]);
        }
      }
      const m = generateFamilyDieline(def, def.defaultDims, { thicknessMm: 1.5 }) as unknown as DielineModel;
      expect(overlappingPanels(m, 0.5), "half folded").toEqual([]);
    });

    it("is flat at progress 0", () => {
      const t = 3;
      const m = generateFamilyDieline(def, def.defaultDims, { thicknessMm: t });
      const poses = computePoses(m, 0);
      const v = new Vector3();
      for (const p of m.panels) {
        const pivot = panelPivot(p, t);
        for (const q of p.polygon) {
          panelLocalPoint(p, q, 0, pivot, t, v).applyMatrix4(poses.get(p.id)!.world);
          expect(Math.abs(v.z)).toBeLessThanOrEqual(3 * t + 1e-6);
        }
      }
    });

    it("has faces, safe zones, bleed and print-area math that add up", () => {
      const m = generateFamilyDieline(def, def.defaultDims, { thicknessMm: 3 });
      expect(m.bleedMm).toBe(3);
      expect(Object.keys(m.faces).length).toBeGreaterThanOrEqual(4);
      expect(m.faces.front ?? m.faces.left).toBeTruthy();
      for (const f of Object.values(m.faces)) {
        expect(f!.width).toBeGreaterThan(0);
        expect(f!.parts.length).toBeGreaterThan(0);
      }
      // Sheet = die bounds + bleed on every side.
      expect(m.sheet.width).toBeCloseTo(m.dieBounds.width + 2 * m.bleedMm, 6);
      expect(m.sheet.height).toBeCloseTo(m.dieBounds.height + 2 * m.bleedMm, 6);
      // Bleed regions grow printable panels; glue / web panels stay ink-free.
      const byId = new Map(m.panels.map((p) => [p.id, p]));
      for (const r of m.bleedRegions) {
        const p = byId.get(r.panelId)!;
        expect(p.printable).toBe(true);
        expect(polygonArea(r.polygon)).toBeGreaterThanOrEqual(polygonArea(p.polygon) - 1e-6);
      }
      for (const p of m.panels.filter((x) => x.role === "glue")) expect(m.bleedRegions.some((r) => r.panelId === p.id)).toBe(false);
      // Safe zone sits inside its panel, inset by the safe margin.
      for (const s of m.safeZones) {
        const p = byId.get(s.panelId)!;
        expect(s.rect.x).toBeGreaterThanOrEqual(p.bbox.x - 1e-6);
        expect(s.rect.y).toBeGreaterThanOrEqual(p.bbox.y - 1e-6);
        expect(s.rect.x + s.rect.width).toBeLessThanOrEqual(p.bbox.x + p.bbox.width + 1e-6);
      }
      const print = printAreaM2(m);
      expect(print).toBeGreaterThan(0);
      expect(print).toBeLessThanOrEqual((m.sheet.width * m.sheet.height) / 1e6 * m.pieces.length + 1e-9);
      expect(m.metrics.netAreaM2).toBeLessThanOrEqual(m.metrics.blankAreaM2 + 1e-9);
      expect(m.metrics.cutLengthMm).toBeCloseTo(m.cutLines.reduce((s, l) => s + segLength(l), 0), 6);
    });

    it("rejects sizes outside its limits", () => {
      const { L, W, H } = def.params;
      expect(() => generateFamilyDieline(def, { ...def.defaultDims, L: L.min - 1 }, { thicknessMm: 3 })).toThrow(DielineValidationError);
      expect(() => generateFamilyDieline(def, { ...def.defaultDims, W: W.max + 1 }, { thicknessMm: 3 })).toThrow(DielineValidationError);
      expect(() => generateFamilyDieline(def, { ...def.defaultDims, H: H.max + 1 }, { thicknessMm: 3 })).toThrow(DielineValidationError);
      expect(tryGenerateFamilyDieline(def, { ...def.defaultDims, H: Number.NaN }, { thicknessMm: 3 })).toBeNull();
      expect(tryGenerateFamilyDieline(def, def.defaultDims, { thicknessMm: 0 })).toBeNull();
      const v = validateFamilyDims(def, { ...def.defaultDims, L: L.min - 1 });
      expect(v.ok).toBe(false);
      if (!v.ok) expect(v.issues[0]).toMatchObject({ path: "L", code: "TOO_SMALL", limit: L.min });
    });

    it("folds every stage named in its sequence", () => {
      const m = generateFamilyDieline(def, def.defaultDims, { thicknessMm: 3 });
      const stages = new Set(m.panels.flatMap((p) => [p.foldStage, ...(p.assembly ? [p.assembly.stage] : [])]));
      for (const s of def.foldSequence) expect(stages.has(s.stage), `${def.code} stage ${s.stage}`).toBe(true);
    });
  });
}

describe("construction details", () => {
  it("auto-erect bottom: glue-assist flaps fold before the lock flaps, with 45° creases", () => {
    const def = definitionByCode("FEFCO_0711")!;
    const m = generateFamilyDieline(def, def.defaultDims, { thicknessMm: 3 });
    const st = (id: string) => m.panels.find((p) => p.id === id)!.foldStage;
    expect(st("bottom_left")).toBeLessThan(st("bottom_front"));
    expect(st("bottom_right")).toBeLessThan(st("bottom_back"));
    // Four diagonal creases, one per bottom flap.
    const diag = m.creaseLines.filter((s) => Math.abs(Math.abs(s.b.x - s.a.x) - Math.abs(s.b.y - s.a.y)) < 1e-6 && segLength(s) > 1);
    expect(diag.length).toBe(4);
    // Closed: the bottom flaps are horizontal and the front flap is the outer bottom.
    expect(m.faces.bottom!.parts.map((p) => p.panelId)).toContain("bottom_front");
  });

  it("web corners: diagonal and wall-side edges are creases, never cuts", () => {
    const def = definitionByCode("FEFCO_0748")!;
    const m = generateFamilyDieline(def, def.defaultDims, { thicknessMm: 3 });
    const webs = m.panels.filter((p) => p.id.startsWith("web_"));
    expect(webs.length).toBe(8);
    const extra = m.creaseLines.filter((s) => !m.panels.some((p) => p.hinge && p.hinge.a === s.a));
    for (const c of extra) {
      for (const cut of m.cutLines) {
        const same = Math.hypot(cut.a.x - c.a.x, cut.a.y - c.a.y) + Math.hypot(cut.b.x - c.b.x, cut.b.y - c.b.y) < 1e-3;
        expect(same).toBe(false);
      }
    }
  });

  it("group 06 bliss boxes are three blanks: a body and two end panels", () => {
    for (const code of ["FEFCO_0601", "FEFCO_0607", "FEFCO_0620"]) {
      const def = definitionByCode(code)!;
      const m = generateFamilyDieline(def, def.defaultDims, { thicknessMm: 3 });
      expect(m.pieces.map((p) => p.label)).toEqual(["Body", "Left end", "Right end"]);
      const end = m.panels.find((p) => p.id === "endL")!;
      expect(end.bbox.width).toBeCloseTo(def.defaultDims.W, 6);
      expect(end.bbox.height).toBeCloseTo(def.defaultDims.H, 6);
    }
  });

  it("0714 lid clears the base by the telescope clearance", () => {
    const def = definitionByCode("FEFCO_0714")!;
    const t = 3;
    const m = generateFamilyDieline(def, def.defaultDims, { thicknessMm: t });
    const poses = computePoses(m, 1);
    const boxOf = (piece: string) => {
      const box = new Box3();
      const v = new Vector3();
      for (const p of m.panels.filter((x) => x.pieceId === piece)) {
        const pivot = panelPivot(p, t);
        for (const q of p.polygon) for (const depth of [0, 1]) box.expandByPoint(panelLocalPoint(p, q, depth, pivot, t, v).applyMatrix4(poses.get(p.id)!.world));
      }
      return box;
    };
    const base = boxOf(m.rootId);
    const lid = boxOf("lid_front");
    expect(lid.max.y).toBeCloseTo(base.max.y + 3 * t, 3);
    expect(lid.min.x).toBeLessThan(base.min.x);
    expect(lid.max.z).toBeGreaterThan(base.max.z);
  });

  it("0716 carries the tear-off perforation and 0770 adds stacking lugs", () => {
    const tear = generateFamilyDieline(definitionByCode("FEFCO_0716")!, { L: 350, W: 250, H: 200 }, { thicknessMm: 3 });
    expect(tear.perfLines.length).toBe(4);
    expect(tear.metrics.perfLengthMm).toBeGreaterThan(2 * 350);
    const d = definitionByCode("FEFCO_0770")!;
    const m = generateFamilyDieline(d, d.defaultDims, { thicknessMm: 3 });
    expect(m.closedOuter.H).toBeGreaterThan(d.defaultDims.H + 3);
  });
});
