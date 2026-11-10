import { describe, expect, it } from "vitest";
import { BAG_HANDLE_KINDS, type BagHandleKind, type Dims } from "@/types";
import { BOARD_SPECS } from "../../../materials";
import { boundsAt, computePoses, panelLocalPoint, panelPivot } from "../../../fold";
import { polygonArea } from "../../../geometry";
import { QUOTE_ONLY_BAGS } from "@/data/catalogue/order-mode";
import { BAG_CODE_ALIASES, DEFINITIONS, GUSSET_CREASE_DEG, buildBag, handleColors, resolveHandle, turnoverFor } from "..";
import type { BagDefinition } from "../types";

const build = (d: BagDefinition, dims: Dims = d.defaultDims, kind?: BagHandleKind) =>
  buildBag(d.code, dims, { thicknessMm: BOARD_SPECS[d.materials[0]].thicknessMm, features: kind ? { bagHandle: { kind, color: d.defaultColor } } : undefined });

/** World points of every panel at a fold progress. */
function worldPoints(m: ReturnType<typeof build>, progress: number, ids?: string[]) {
  const poses = computePoses(m, progress);
  return m.panels
    .filter((p) => !ids || ids.includes(p.id))
    .flatMap((p) => p.polygon.map((q) => panelLocalPoint(p, q, 0, panelPivot(p, m.thicknessMm), m.thicknessMm).applyMatrix4(poses.get(p.id)!.world)));
}

describe("bag definitions", () => {
  it("seven store bags, unique codes and slugs, both names, no diacritics", () => {
    expect(DEFINITIONS).toHaveLength(7);
    expect(new Set(DEFINITIONS.map((d) => d.code)).size).toBe(7);
    expect(new Set(DEFINITIONS.map((d) => d.slug)).size).toBe(7);
    for (const d of DEFINITIONS) {
      expect(d.name.ar).not.toMatch(/[ً-ْـ]/);
      expect(d.description.ar).not.toMatch(/[ً-ْـ]/);
      expect(d.name.en.length).toBeGreaterThan(5);
      expect(d.handles).toContain(d.defaultHandle);
      expect(d.materials.length).toBeGreaterThan(0);
      for (const m of d.materials) expect(BOARD_SPECS[m].family).toBe("PAPER_BAG");
    }
  });

  it.each(DEFINITIONS.flatMap((d) => d.presets.map((p) => [d.code, p.id, d, p.dims] as const)))("%s preset %s is inside the limits and builds", (_c, _p, d, dims) => {
    for (const k of ["L", "W", "H"] as const) {
      expect(dims[k]).toBeGreaterThanOrEqual(d.params[k].min);
      expect(dims[k]).toBeLessThanOrEqual(d.params[k].max);
    }
    expect(dims.W).toBeLessThanOrEqual(dims.L);
    expect(() => build(d, dims)).not.toThrow();
  });

  it("order modes: die-cut and bottle bags by quote, the rest instant (order-mode table agrees)", () => {
    for (const d of DEFINITIONS) expect(QUOTE_ONLY_BAGS.has(d.code), d.code).toBe(d.orderMode === "quote");
  });

  it("promoted foodservice codes point at bag models", () => {
    for (const to of Object.values(BAG_CODE_ALIASES)) expect(DEFINITIONS.some((d) => d.code === to)).toBe(true);
  });

  it("rejects sizes outside the limits", () => {
    const d = DEFINITIONS[0];
    expect(() => buildBag(d.code, { ...d.defaultDims, L: d.params.L.max + 1 })).toThrow();
    expect(() => buildBag(d.code, { L: 200, W: 210, H: 300 })).toThrow(); // gusset wider than the face
  });
});

describe.each(DEFINITIONS.map((d) => [d.code, d] as const))("%s", (_code, d) => {
  const m = build(d);
  const { L, W, H } = d.defaultDims;
  const th = (GUSSET_CREASE_DEG * Math.PI) / 180;

  it("die: printed paper blank = tube + turnover + block bottom; seams and creases present", () => {
    const s = m.bag;
    const expectW = s.glueSeamMm + 2 * L + 2 * W;
    const expectH = H + s.turnoverMm + s.bottomFlapMm;
    expect(m.metrics.blankAreaM2).toBeCloseTo((expectW * expectH) / 1e6, 4);
    expect(m.panels.some((p) => p.role === "glue" && !p.printable)).toBe(true);
    expect(m.panels.filter((p) => ["left", "right"].includes(p.role))).toHaveLength(4); // two halves per gusset
    expect(m.creaseLines.length).toBeGreaterThan(10);
    expect(m.cutLines.length).toBeGreaterThan(10);
    // every printable panel's bleed region grows its outline
    for (const r of m.bleedRegions) expect(polygonArea(r.polygon)).toBeGreaterThanOrEqual(polygonArea(m.panels.find((p) => p.id === r.panelId)!.polygon) - 1e-6);
  });

  it("closes: the open standing bag is L wide, G cos(crease) deep, H tall", () => {
    const b = boundsAt(m, 1);
    expect(b.max.x - b.min.x).toBeCloseTo(L, 0);
    expect(b.max.y - b.min.y).toBeCloseTo(H, 0);
    expect(b.max.z - b.min.z).toBeCloseTo(W * Math.cos(th), 0);
    // the gusset halves meet at the centre crease, creased inward
    const pts = worldPoints(m, 1, ["leftA", "leftB"]);
    const minX = Math.min(...pts.map((p) => p.x));
    const maxX = Math.max(...pts.map((p) => p.x));
    expect(maxX - minX).toBeCloseTo((W / 2) * Math.sin(th), 0);
    // the back closes the tube where the glue seam lies
    const glue = worldPoints(m, 1, ["glue"]);
    for (const p of glue) expect(p.z).toBeCloseTo(b.min.z, 0);
  });

  it("flat sheet at progress 0, every panel in the sheet plane", () => {
    for (const p of worldPoints(m, 0)) expect(Math.abs(p.z)).toBeLessThan(1e-6);
  });

  it("faces: front, back, both gussets (two halves each) and the bottom", () => {
    expect(m.faces.front!.width).toBeCloseTo(L, 0);
    expect(m.faces.front!.height).toBeCloseTo(H, 0);
    expect(m.faces.back!.width).toBeCloseTo(L, 0);
    for (const f of ["left", "right"] as const) {
      expect(m.faces[f]!.parts).toHaveLength(2);
      expect(m.faces[f]!.width).toBeCloseTo(W, 0);
      expect(m.faces[f]!.height).toBeCloseTo(H, 0);
    }
    expect(m.faces.bottom).toBeTruthy();
    expect(m.faces.top).toBeUndefined();
  });

  it.each(d.handles)("handle %s: geometry inside the bag footprint, above the mouth, on the right faces", (kind) => {
    const mm = build(d, d.defaultDims, kind);
    expect(mm.bag.handle.kind).toBe(kind);
    const acc = mm.accessories ?? [];
    if (kind === "NONE" || kind === "DIE_CUT") {
      expect(acc).toHaveLength(0);
      if (kind === "DIE_CUT") {
        expect(mm.panels.find((p) => p.id === "front")!.holes).toHaveLength(1);
        expect(mm.panels.find((p) => p.id === "frontTurn")!.holes).toHaveLength(1);
      }
      return;
    }
    expect(acc.length).toBeGreaterThanOrEqual(2);
    const zFace = (W * Math.cos(th)) / 2;
    const pts = acc.flatMap((a) => a.path);
    for (const [x, y, z] of pts) {
      expect(Math.abs(x)).toBeLessThan(L / 2);
      expect(y).toBeGreaterThan(H - mm.bag.turnoverMm - 25);
      expect(y).toBeLessThanOrEqual(H + mm.bag.handle.loopHeightMm + 8);
      expect(Math.abs(z)).toBeLessThan(zFace + 20); // handles lean out a little
    }
    expect(Math.max(...pts.map((p) => p[1]))).toBeGreaterThan(H + mm.bag.handle.loopHeightMm * 0.9);
    // one handle on each face
    expect(acc.some((a) => a.path.some((p) => p[2] > 0))).toBe(true);
    expect(acc.some((a) => a.path.some((p) => p[2] < 0))).toBe(true);
    // threaded handles: two eyelets per face, through the turnover too
    if (["COTTON_ROPE", "PP_ROPE", "SATIN_RIBBON"].includes(kind)) {
      expect(mm.panels.find((p) => p.id === "front")!.holes).toHaveLength(2);
      expect(mm.panels.find((p) => p.id === "backTurn")!.holes).toHaveLength(2);
      for (const a of acc.filter((a) => !a.label?.includes("knot") && !a.label?.includes("tail"))) {
        expect(Math.max(...a.path.map((p) => Math.abs(p[2])))).toBeGreaterThan(zFace); // passes outside
      }
    }
    for (const a of acc) expect(a.color).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("separate pieces: base insert for laminated bags, patches or board strips per handle", () => {
    const ids = m.pieces.map((p) => p.rootId);
    expect(ids.includes("baseInsert")).toBe(d.baseInsert);
    if (d.defaultHandle === "TWISTED_PAPER") expect(ids).toContain("patchFront");
    if (["COTTON_ROPE", "SATIN_RIBBON"].includes(d.defaultHandle)) expect(ids).toContain("topBoardBack");
    // pieces are not printed and land inside the bag when closed
    const b = boundsAt({ ...m, panels: m.panels.filter((p) => p.pieceId === m.rootId) }, 1);
    for (const piece of m.pieces.filter((p) => p.rootId !== m.rootId)) {
      expect(m.panels.find((p) => p.id === piece.rootId)!.printable).toBe(false);
      for (const p of worldPoints(m, 1, [piece.rootId])) {
        expect(p.x).toBeGreaterThan(b.min.x - 0.01);
        expect(p.x).toBeLessThan(b.max.x + 0.01);
        expect(p.y).toBeGreaterThan(b.min.y - 0.01);
        expect(p.y).toBeLessThan(b.max.y + 0.01);
        expect(p.z).toBeGreaterThan(b.min.z - 0.01);
        expect(p.z).toBeLessThan(b.max.z + 0.01);
      }
    }
  });
});

describe("handle rules", () => {
  it("unknown or unoffered handles fall back to the model's default", () => {
    const sos = DEFINITIONS.find((d) => d.code === "BAG_SOS")!;
    expect(resolveHandle(sos, { kind: "COTTON_ROPE", color: "RED" })).toEqual({ kind: "NONE", color: "KRAFT" });
    const art = DEFINITIONS.find((d) => d.code === "BAG_ROPE_ART")!;
    expect(resolveHandle(art, { kind: "SATIN_RIBBON", color: "GOLD" })).toEqual({ kind: "SATIN_RIBBON", color: "GOLD" });
    // paper handles come in fewer colours
    const kraft = DEFINITIONS.find((d) => d.code === "BAG_TWISTED_KRAFT")!;
    expect(resolveHandle(kraft, { kind: "TWISTED_PAPER", color: "GOLD" }).color).toBe("KRAFT");
  });

  it("every kind has a turnover rule and colour list", () => {
    for (const k of BAG_HANDLE_KINDS) {
      const T = turnoverFor(k, { L: 260, W: 120, H: 350 });
      if (k === "NONE") expect(T).toBe(0);
      else expect(T).toBeGreaterThanOrEqual(35);
      expect(Array.isArray(handleColors(k))).toBe(true);
    }
  });

  it("the SOS bag takes a thumb notch at the mouth", () => {
    const sos = DEFINITIONS.find((d) => d.code === "BAG_SOS")!;
    const plain = buildBag("BAG_SOS", sos.defaultDims);
    const notched = buildBag("BAG_SOS", sos.defaultDims, { features: { thumbNotch: true } });
    expect(notched.metrics.netAreaM2).toBeLessThan(plain.metrics.netAreaM2);
  });
});
