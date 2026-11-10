import { describe, expect, it } from "vitest";
import type { BagGusset, BagHandleKind } from "@/types";
import { BOARD_SPECS, FILM_MICRONS, MIN_FILM_MICRONS } from "../../../materials";
import { boundsAt, computePoses, panelLocalPoint, panelPivot } from "../../../fold";
import { QUOTE_ONLY_BAGS } from "@/data/catalogue/order-mode";
import { PLASTIC_DEFINITIONS, buildBag, resolveFilm } from "..";
import type { BagDefinition } from "../types";

const build = (d: BagDefinition, gusset?: BagGusset, kind?: BagHandleKind) =>
  buildBag(d.code, d.defaultDims, { thicknessMm: BOARD_SPECS[d.materials[0]].thicknessMm, features: { ...(kind ? { bagHandle: { kind, color: "BLACK" } } : {}), ...(gusset ? { bagFilm: { tone: "WHITE", gusset } } : {}) } });

const cases = PLASTIC_DEFINITIONS.flatMap((d) => (d.gussets ?? ["SIDE"]).flatMap((g) => d.handles.map((h) => [d.code, g, h, d] as const)));

describe("plastic bag definitions", () => {
  it("eight models: film and non-woven, both names, no diacritics", () => {
    expect(PLASTIC_DEFINITIONS).toHaveLength(8);
    for (const d of PLASTIC_DEFINITIONS) {
      expect(["film", "nonwoven"]).toContain(d.stock);
      expect(d.name.ar).not.toMatch(/[ً-ْـ]/);
      expect(d.description.ar).not.toMatch(/[ً-ْـ]/);
      for (const m of d.materials) expect(BOARD_SPECS[m].family).toBe("PLASTIC_BAG");
    }
  });

  it("ES 3040 (reported 50 micron minimum): no film thinner than MIN_FILM_MICRONS is offered", () => {
    expect(MIN_FILM_MICRONS).toBe(50);
    for (const d of PLASTIC_DEFINITIONS.filter((x) => x.stock === "film")) for (const m of d.materials) expect(FILM_MICRONS[m], `${d.code} ${m}`).toBeGreaterThanOrEqual(MIN_FILM_MICRONS);
    for (const [m, mic] of Object.entries(FILM_MICRONS)) expect(BOARD_SPECS[m as keyof typeof BOARD_SPECS].thicknessMm).toBeCloseTo(mic! / 1000, 6);
  });

  it("order modes: loop, clip and drawstring by quote (no Egyptian supplier found), the rest instant", () => {
    for (const d of PLASTIC_DEFINITIONS) expect(QUOTE_ONLY_BAGS.has(d.code), d.code).toBe(d.orderMode === "quote");
  });

  it("film tone and gusset fall back to the model's offer", () => {
    const tshirt = PLASTIC_DEFINITIONS.find((d) => d.code === "PBAG_TSHIRT")!;
    expect(resolveFilm(tshirt, { tone: "CLEAR", gusset: "BOTTOM" })).toEqual({ tone: "CLEAR", gusset: "SIDE" });
    expect(resolveFilm(tshirt, { tone: "COLOUR", color: "NAVY" })).toEqual({ tone: "COLOUR", gusset: "SIDE", color: "NAVY" });
  });

  it.each(PLASTIC_DEFINITIONS.flatMap((d) => d.presets.map((p) => [d.code, p.id, d, p.dims] as const)))("%s preset %s inside the limits", (_c, _p, d, dims) => {
    for (const k of ["L", "W", "H"] as const) {
      expect(dims[k]).toBeGreaterThanOrEqual(d.params[k].min);
      expect(dims[k]).toBeLessThanOrEqual(d.params[k].max);
    }
  });
});

describe.each(cases)("%s %s %s", (_c, gusset, kind, d) => {
  const m = build(d, gusset, kind);
  const { L, W, H } = d.defaultDims;

  it("builds, stands, and is flat at progress 0", () => {
    expect(m.structureCode).toBe("PLASTIC_BAG");
    const b = boundsAt(m, 1);
    expect(b.max.x - b.min.x).toBeCloseTo(L, 0);
    const depth = b.max.z - b.min.z;
    if (gusset === "NONE") expect(depth).toBeLessThan(4);
    else expect(depth).toBeLessThanOrEqual(W + 0.5);
    expect(b.max.y - b.min.y).toBeGreaterThan(H * 0.98);
    const poses = computePoses(m, 0);
    for (const p of m.panels.filter((x) => !x.assembly))
      for (const q of p.polygon) expect(Math.abs(panelLocalPoint(p, q, 0, panelPivot(p, m.thicknessMm), m.thicknessMm).applyMatrix4(poses.get(p.id)!.world).z)).toBeLessThan(1e-6);
  });

  it("front and back faces are mapped", () => {
    expect(m.faces.front!.width).toBeCloseTo(L, 0);
    expect(m.faces.back!.width).toBeCloseTo(L, 0);
  });

  it("handle is real geometry: holes, straps or accessories above the mouth", () => {
    const front = m.panels.find((p) => p.id === "front")!;
    if (kind === "DIE_CUT" || kind === "DIE_CUT_PATCH" || kind === "KIDNEY") {
      expect(front.holes).toHaveLength(1);
      expect(m.panels.find((p) => p.id === "back")!.holes).toHaveLength(1);
      if (kind === "DIE_CUT_PATCH") expect(m.pieces.map((p) => p.rootId)).toEqual(expect.arrayContaining(["patchFront", "patchBack"]));
    } else if (kind === "TSHIRT") {
      expect(m.panels.filter((p) => p.label === "T-shirt strap").length).toBeGreaterThanOrEqual(4);
      expect(boundsAt(m, 1).max.y - boundsAt(m, 1).min.y).toBeGreaterThan(H + 50);
    } else if (kind !== "NONE") {
      const acc = m.accessories ?? [];
      expect(acc.length).toBeGreaterThan(0);
      if (kind !== "DRAWSTRING") expect(Math.max(...acc.flatMap((a) => a.path.map((p) => p[1])))).toBeGreaterThan(H);
      for (const a of acc) for (const [x] of a.path) expect(Math.abs(x)).toBeLessThan(L / 2 + 1);
    }
  });
});
