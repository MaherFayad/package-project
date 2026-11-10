import { describe, expect, it } from "vitest";
import { boundsAt } from "../../../fold";
import { definitionByCode, generateFamilyDieline } from "..";
import { modelByCode } from "@/lib/library";
import type { BoxModelDef } from "@/lib/library/types";

const box = (code: string) => modelByCode(code) as BoxModelDef;

/**
 * Roll end tuck front mailers (retf.ts), drawn after the owner's die
 * (docs/owner-input/2026-11-10, measured in docs/audit/gift-box-tuck-front.md).
 */

const RETF = definitionByCode("MAILER_RETF")!;
const PLAIN = definitionByCode("MAILER_RETF_PLAIN")!;
const ids = (m: { panels: { id: string }[] }) => m.panels.map((p) => p.id);
const bbox = (m: ReturnType<typeof generateFamilyDieline>, id: string) => m.panels.find((p) => p.id === id)!.bbox;

describe("RETF mailer: construction", () => {
  const t = 1.5;
  const m = generateFamilyDieline(RETF, RETF.defaultDims, { thicknessMm: t });

  it("has a single front wall, rolled double end walls, ears on front and back, a winged tuck", () => {
    const list = ids(m);
    expect(list).not.toContain("frontInner");
    expect(list).toEqual(expect.arrayContaining(["front", "back", "left", "right", "leftInner", "rightInner", "top", "lidTuck", "lidSideL", "lidSideR", "tuckWing0", "tuckWing1"]));
    expect(list.filter((id) => id.startsWith("ear_"))).toHaveLength(4);
  });

  it("matches the owner's proportions: walls, ears, tuck and side flaps about H deep", () => {
    const { L, W, H } = RETF.defaultDims;
    const base = bbox(m, "base");
    expect(base.width).toBeCloseTo(L + 6 * t, 3);
    expect(base.height).toBeCloseTo(W + 2 * t, 3);
    // Owner's die: front, back, end and inner walls, ears, tuck and lid side flaps are all within ~6% of H.
    expect(bbox(m, "front").height).toBeCloseTo(H + 2 * t, 0);
    for (const id of ["ear_front_0", "ear_back_1"]) expect(Math.min(bbox(m, id).width, bbox(m, id).height)).toBeCloseTo(H, 0);
    expect(bbox(m, "lidTuck").height).toBeGreaterThan(H * 0.94);
    expect(bbox(m, "lidSideL").width).toBeGreaterThan(H * 0.94);
    expect(bbox(m, "lidSideL").width).toBeLessThan(H * 1.02);
    // Wings: about 0.7 of the tuck depth.
    const wing = bbox(m, "tuckWing0");
    expect(wing.width / bbox(m, "lidTuck").height).toBeGreaterThan(0.66);
    expect(wing.width / bbox(m, "lidTuck").height).toBeLessThan(0.74);
  });

  it("locks each inner end wall with two tabs into two slots in the base", () => {
    const base = m.panels.find((p) => p.id === "base")!;
    expect(base.holes).toHaveLength(4);
    for (const id of ["leftInner", "rightInner"]) expect(m.panels.find((p) => p.id === id)!.polygon.length).toBe(4 + 8);
    // Slots sit inside the base, next to the end creases, at about 23% and 77% of its depth.
    const b = base.bbox;
    const ys = base.holes!.map((h) => (Math.min(...h.map((q) => q.y)) + Math.max(...h.map((q) => q.y))) / 2 - b.y);
    for (const y of ys) expect([0.23, 0.77].some((f) => Math.abs(y / b.height - f) < 0.03)).toBe(true);
    for (const h of base.holes!) for (const q of h) expect(q.x > b.x && q.x < b.x + b.width).toBe(true);
  });

  it("puts the thumb notch in the tuck's free edge", () => {
    const tuck = m.panels.find((p) => p.id === "lidTuck")!;
    expect(tuck.polygon.length).toBeGreaterThan(10);
  });

  it("closes to the inner size plus the wall layers", () => {
    const { L, W, H } = RETF.defaultDims;
    const box = boundsAt({ panels: m.panels, rootId: m.rootId, thicknessMm: t, closedRotation: m.closedRotation }, 1);
    expect(box.max.x - box.min.x).toBeCloseTo(L + 6 * t, 0);
    expect(box.max.z - box.min.z).toBeCloseTo(W + 2 * t, 0);
    expect(box.max.y - box.min.y).toBeCloseTo(H + 2 * t, 0);
    expect(Object.keys(m.faces).sort()).toEqual(["back", "bottom", "front", "left", "right", "top"]);
  });
});

describe("RETF mailer: options", () => {
  it("cuts a lid window, a tear strip and adds a divider insert", () => {
    const m = generateFamilyDieline(RETF, RETF.defaultDims, { thicknessMm: 1.5, features: { window: { face: "top" }, tearStrip: true, partitions: { rows: 1, cols: 2 } } });
    expect(m.panels.find((p) => p.id === "top")!.holes?.length).toBe(1);
    expect(m.perfLines.length).toBe(2);
    expect(ids(m).some((id) => id.startsWith("div"))).toBe(true);
  });

  it("plain tuck variant: no wings, round-cornered tuck, trapezoid side flaps", () => {
    const m = generateFamilyDieline(PLAIN, PLAIN.defaultDims, { thicknessMm: 1.5 });
    expect(ids(m).some((id) => id.startsWith("tuckWing"))).toBe(false);
    expect(m.panels.find((p) => p.id === "lidSideL")!.polygon).toHaveLength(4);
    expect(bbox(m, "lidTuck").height).toBeLessThan(bbox(generateFamilyDieline(RETF, RETF.defaultDims, { thicknessMm: 1.5 }), "lidTuck").height);
  });

  it("builds at every preset and the corner limits on E and B flute", () => {
    for (const def of [RETF, PLAIN]) {
      const { L, W, H } = def.params;
      const sizes = [...def.presets.map((p) => p.dims), { L: L.min, W: W.min, H: H.min }, { L: L.max, W: W.max, H: Math.min(H.max, W.max) }, { L: L.min, W: W.max, H: H.min }];
      for (const dims of sizes) for (const t of [1.5, 3]) expect(() => generateFamilyDieline(def, dims, { thicknessMm: t }), `${def.code} ${JSON.stringify(dims)} t=${t}`).not.toThrow();
    }
  });
});

describe("RETF mailer: library model", () => {
  it("is a box model priced on the mailer rate card, separate from the core mailer-box", () => {
    const m = box("MAILER_RETF");
    expect(m.slug).toBe("gift-box-tuck-front");
    expect(m.group).toBe("BOXES");
    expect(m.openTop).toBeFalsy();
    for (const mat of m.materials) expect(m.baseFor(mat)).toBe("FEFCO_0427");
    expect(box("MAILER_RETF_PLAIN").baseFor("E_FLUTE_KRAFT")).toBe("FEFCO_0427");
    // The core mailer keeps its slug, so saved designs open unchanged.
    expect(box("FEFCO_0427").slug).toBe("mailer-box");
  });
});

describe("RETF gift box: names and search", () => {
  it("is named a gift box, and buyers find it by gift box, mailer and trade names", async () => {
    const { CATALOGUE } = await import("@/data/catalogue");
    const { matchesQuery } = await import("@/lib/library/search");
    const m = box("MAILER_RETF");
    expect(m.name).toEqual({ ar: "علبة هدايا بلسان أمامي", en: "Gift box (tuck front)" });
    expect(box("MAILER_RETF_PLAIN").slug).toBe("gift-box-tuck-front-plain");
    const find = (q: string) => CATALOGUE.filter((e) => matchesQuery(e, q)).map((e) => e.code);
    for (const q of ["gift box", "هدايا", "علبة هدايا", "tuck front", "RETF", "roll end", "mailer"]) expect(find(q), q).toContain("MAILER_RETF");
    for (const q of ["gift box", "RETF"]) expect(m.search, q).toContain(q.toLowerCase());
    // Listed next to the core mailer in the catalogue and picker.
    const order = CATALOGUE.map((e) => e.code);
    const i = order.indexOf("FEFCO_0427");
    expect(Math.abs(order.indexOf("MAILER_RETF") - i)).toBeLessThanOrEqual(2);
    expect(Math.abs(order.indexOf("MAILER_RETF_PLAIN") - i)).toBeLessThanOrEqual(2);
  });
});
