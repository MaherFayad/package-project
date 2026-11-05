import { describe, expect, it } from "vitest";
import { Box3, Vector3 } from "three";
import { MATERIAL_CODES, STRUCTURE_CODES, type StructureCode, type StructureFeatures } from "@/types";
import {
  BOARD_SPECS,
  DEFAULT_DIMS,
  FEATURE_SUPPORT,
  STRUCTURES,
  STRUCTURE_LIST,
  computePoses,
  defaultMaterialFor,
  dielineToSvg,
  generateDieline,
  materialFitsStructure,
  panelLocalPoint,
  panelPivot,
  structureBySlug,
  supportedFeatures,
  validateDims,
  type DielineModel,
  type DielinePanel,
} from "..";

const model = (code: StructureCode, features?: StructureFeatures, dims = DEFAULT_DIMS[code]) =>
  generateDieline(code, dims, { thicknessMm: BOARD_SPECS[defaultMaterialFor(code)].thicknessMm, features });

/** Closed bounds of one cut piece (mm, model space). */
function pieceBounds(m: DielineModel, rootId: string): Box3 {
  const poses = computePoses(m, 1);
  const box = new Box3();
  for (const p of m.panels.filter((q) => q.pieceId === rootId)) {
    const pv = panelPivot(p, m.thicknessMm);
    for (const q of p.polygon) for (const d of [0, 1]) box.expandByPoint(panelLocalPoint(p, q, d, pv, m.thicknessMm).applyMatrix4(poses.get(p.id)!.world));
  }
  return box;
}

const ARABIC = /[؀-ۿ]/;
const DIACRITICS = /[ً-ْ]/;

describe("STRUCTURES registry", () => {
  it("covers every structure code with unique slugs", () => {
    expect(STRUCTURE_LIST.map((s) => s.code)).toEqual([...STRUCTURE_CODES]);
    const slugs = STRUCTURE_LIST.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of STRUCTURE_LIST) expect(structureBySlug(s.slug)?.code).toBe(s.code);
    expect(structureBySlug("nope")).toBeNull();
  });

  it.each(STRUCTURE_CODES)("%s has Arabic (no diacritics) and English names, materials and valid presets", (code) => {
    const s = STRUCTURES[code];
    expect(s.name.ar).toMatch(ARABIC);
    expect(s.name.ar).not.toMatch(DIACRITICS);
    expect(s.description.ar).toMatch(ARABIC);
    expect(s.description.ar).not.toMatch(DIACRITICS);
    expect(s.name.en.length).toBeGreaterThan(3);
    expect(s.standard.length).toBeGreaterThan(3);
    expect(s.materials.length).toBeGreaterThan(0);
    for (const m of s.materials) expect(materialFitsStructure(m, code)).toBe(true);
    expect(s.materials).toContain(defaultMaterialFor(code));
    expect(validateDims(code, s.defaultDims).ok).toBe(true);
    expect(s.presets.length).toBeGreaterThanOrEqual(2);
    const ids = s.presets.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of s.presets) {
      expect(validateDims(code, p.dims).ok, `${code} ${p.id}`).toBe(true);
      expect(p.name.ar).toMatch(ARABIC);
      // every preset can be made from every allowed board
      for (const m of s.materials) expect(() => generateDieline(code, p.dims, { thicknessMm: BOARD_SPECS[m].thicknessMm })).not.toThrow();
    }
  });

  it("assigns each board to exactly the structures of its family", () => {
    for (const m of MATERIAL_CODES) expect(STRUCTURE_LIST.some((s) => s.materials.includes(m))).toBe(true);
  });
});

describe("features", () => {
  it("drops features a structure cannot make and clamps the rest", () => {
    expect(supportedFeatures("ECMA_RTE", { handle: true, partitions: { rows: 3, cols: 3 }, window: { face: "top" } })).toEqual({});
    expect(supportedFeatures("FEFCO_0201", { partitions: { rows: 99, cols: 0 } })).toEqual({ partitions: { rows: 6, cols: 1 } });
    expect(supportedFeatures("FEFCO_0201", { partitions: { rows: 1, cols: 1 } })).toEqual({});
    expect(supportedFeatures("GABLE_BOX", {})).toEqual({ handle: true });
    expect(supportedFeatures("GABLE_BOX", { handle: false })).toEqual({});
    const w = supportedFeatures("FEFCO_0427", { window: { face: "top", widthRatio: 5 } }).window!;
    expect(w.widthRatio).toBe(0.8);
    expect(w.film).toBe(true);
    // thumb notch and display front are exclusive on trays
    expect(supportedFeatures("FEFCO_0422", { thumbNotch: true, displayFront: true })).toEqual({ displayFront: true });
  });

  it.each(STRUCTURE_CODES.filter((c) => FEATURE_SUPPORT[c].windowFaces.length))("%s: window is a die-cut hole with clear film", (code) => {
    const face = FEATURE_SUPPORT[code].windowFaces[0];
    const m = model(code, { window: { face } });
    const plainHoles = new Set(model(code).panels.filter((p) => p.holes?.length).map((p) => p.id));
    const holed = m.panels.filter((p) => p.holes?.length && !plainHoles.has(p.id));
    expect(holed).toHaveLength(1);
    expect(m.faces[face]!.parts.map((p) => p.panelId)).toContain(holed[0].id);
    expect(m.films).toHaveLength(1);
    expect(m.metrics.filmAreaM2).toBeGreaterThan(0);
    const plain = model(code);
    expect(m.metrics.netAreaM2).toBeLessThan(plain.metrics.netAreaM2);
    expect(m.metrics.cutLengthMm).toBeGreaterThan(plain.metrics.cutLengthMm);
    expect(dielineToSvg(m)).toContain('data-layer="film"');
    expect(model(code, { window: { face, film: false } }).films).toHaveLength(0);
  });

  it.each(STRUCTURE_CODES.filter((c) => FEATURE_SUPPORT[c].thumbNotch))("%s: thumb notch adds a curved cut", (code) => {
    const plain = model(code);
    const m = model(code, { thumbNotch: true });
    expect(m.features.thumbNotch).toBe(true);
    expect(m.panels.reduce((s, p) => s + p.polygon.length, 0)).toBeGreaterThan(plain.panels.reduce((s, p) => s + p.polygon.length, 0));
    expect(m.metrics.netAreaM2).toBeLessThan(plain.metrics.netAreaM2);
  });

  it.each(STRUCTURE_CODES.filter((c) => FEATURE_SUPPORT[c].handle))("%s: handle cut-outs", (code) => {
    const features: StructureFeatures = code === "FEFCO_0320" ? { handle: true, lidHeightMm: 40 } : { handle: true };
    const m = model(code, features);
    expect(m.panels.filter((p) => p.holes?.length).length).toBeGreaterThanOrEqual(code === "FEFCO_0422" ? 1 : 2);
  });

  it.each(STRUCTURE_CODES.filter((c) => FEATURE_SUPPORT[c].tearStrip))("%s: tear strip = two perforations", (code) => {
    const m = model(code, { tearStrip: true });
    expect(m.perfLines.length).toBeGreaterThanOrEqual(2);
    expect(m.perfLines.length % 2).toBe(0);
    expect(m.metrics.perfLengthMm).toBeGreaterThan(0);
    expect(dielineToSvg(m)).toContain('data-layer="perf"');
  });

  it.each(STRUCTURE_CODES.filter((c) => FEATURE_SUPPORT[c].partitions))("%s: divider grid sits inside the closed box", (code) => {
    const m = model(code, { partitions: { rows: 2, cols: 3 } });
    const dividers = m.pieces.filter((p) => p.label === "Divider");
    expect(dividers).toHaveLength(1 + 2);
    const outer = pieceBounds(m, m.rootId);
    for (const d of dividers) {
      const b = pieceBounds(m, d.rootId);
      expect(b.min.x).toBeGreaterThan(outer.min.x);
      expect(b.max.x).toBeLessThan(outer.max.x);
      expect(b.min.z).toBeGreaterThan(outer.min.z);
      expect(b.max.z).toBeLessThan(outer.max.z);
      expect(b.min.y).toBeGreaterThan(outer.min.y);
      expect(b.max.y).toBeLessThan(outer.max.y + 1e-6);
    }
    // more board: dividers are priced as part of the job
    expect(m.metrics.blankAreaM2).toBeGreaterThan(model(code).metrics.blankAreaM2);
    expect(m.metrics.pieceCount).toBe(model(code).metrics.pieceCount + 3);
    // closed outer size unchanged
    expect(m.closedOuter.L).toBeCloseTo(model(code).closedOuter.L, 6);
    expect(m.closedOuter.H).toBeCloseTo(model(code).closedOuter.H, 6);
  });

  it("display front lowers the tray's front wall", () => {
    const m = model("FEFCO_0422", { displayFront: true });
    const front = m.panels.find((p) => p.id === "front")!;
    expect(front.polygon.length).toBe(8);
    expect(m.metrics.netAreaM2).toBeLessThan(model("FEFCO_0422").metrics.netAreaM2);
  });
});

describe("two-piece structures", () => {
  it.each(["FEFCO_0320", "RIGID_BOX", "PAPER_TUBE"] as const)("%s: the lid fits over the base without touching it", (code) => {
    const m = model(code);
    expect(m.pieces).toHaveLength(2);
    const base = pieceBounds(m, m.rootId);
    const lid = pieceBounds(m, m.pieces[1].rootId);
    // lid wider than the base on both axes and on top of it
    expect(lid.min.x).toBeLessThan(base.min.x);
    expect(lid.max.x).toBeGreaterThan(base.max.x);
    expect(lid.min.z).toBeLessThan(base.min.z);
    expect(lid.max.z).toBeGreaterThan(base.max.z);
    expect(lid.max.y).toBeGreaterThan(base.max.y);
    expect(lid.max.y - base.max.y).toBeLessThan(2 * m.thicknessMm + 0.01);
  });

  it("telescope lid depth follows lidHeightMm (clamped to the base height)", () => {
    const full = model("FEFCO_0320");
    const shallow = model("FEFCO_0320", { lidHeightMm: 40 });
    const h = (m: DielineModel) => pieceBounds(m, m.pieces[1].rootId).getSize(new Vector3()).y;
    expect(h(full)).toBeGreaterThan(h(shallow) + 50);
    expect(h(model("FEFCO_0320", { lidHeightMm: 5000 }))).toBeCloseTo(h(full), 6);
  });

  it("paper tube: roll hinges are not creases and the label wraps a full turn", () => {
    const m = model("PAPER_TUBE");
    const rolls = m.panels.filter((p) => p.hingeKind === "roll");
    expect(rolls.length).toBeGreaterThan(40);
    const hingeCreases = m.panels.filter((p) => p.hinge && p.hingeKind !== "roll").length;
    expect(m.creaseLines.length).toBe(hingeCreases);
    const body = rolls.filter((p) => p.pieceId === m.rootId && p.role !== "glue");
    expect(body.reduce((s, p) => s + p.foldAngleClosed, 0)).toBeCloseTo(360 - body[0].foldAngleClosed, 6);
    // front + back cover the full circumference
    expect(m.faces.front!.width + m.faces.back!.width).toBeCloseTo(Math.PI * (DEFAULT_DIMS.PAPER_TUBE.L + 2 * m.thicknessMm), -1);
  });
});

describe("fold animation", () => {
  const everything: StructureFeatures = { thumbNotch: true, handle: true, tearStrip: true, partitions: { rows: 2, cols: 2 }, displayFront: false };
  it.each(STRUCTURE_CODES)("%s: every pose is finite through the whole fold, with and without features", (code) => {
    const win = FEATURE_SUPPORT[code].windowFaces[0];
    for (const m of [model(code), model(code, { ...everything, ...(win ? { window: { face: win } } : {}) })]) {
      for (let i = 0; i <= 20; i++) {
        const poses = computePoses(m, i / 20);
        for (const pose of poses.values()) expect(pose.world.elements.every(Number.isFinite)).toBe(true);
      }
    }
  });

  it("dividers go in before the lid closes", () => {
    for (const code of ["FEFCO_0427", "FEFCO_0201", "FEFCO_0320", "RIGID_BOX"] as const) {
      const m = model(code, { partitions: { rows: 2, cols: 2 } });
      const div = Math.min(...m.panels.filter((p) => p.assembly && p.role === "inner").map((p) => p.assembly!.stage));
      const closing = (p: DielinePanel) =>
        (p.assembly && p.role !== "inner") || (code === "FEFCO_0427" && ["top", "lidTuck"].includes(p.id)) || (code === "FEFCO_0201" && p.id.startsWith("topFlap_"));
      const lidStages = m.panels.filter(closing).map((p) => p.assembly?.stage ?? p.foldStage);
      expect(lidStages.length).toBeGreaterThan(0);
      for (const s of lidStages) expect(s).toBeGreaterThan(div);
    }
  });
});

describe("illustration", () => {
  it.each(STRUCTURE_CODES)("%s renders a clean SVG thumbnail from the fold model", async (code) => {
    const { structureIllustrationSvg } = await import("..");
    const out = structureIllustrationSvg(model(code), { outside: "#c49a6c", inside: "#b58a5c", title: STRUCTURES[code].name.en });
    expect(out.startsWith("<svg")).toBe(true);
    expect(out).not.toMatch(/NaN|undefined|Infinity/);
    expect((out.match(/<path /g) ?? []).length).toBeGreaterThan(3);
  });
});
