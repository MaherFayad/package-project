import { describe, expect, it } from "vitest";
import { buildFlexibleModel, defaultFlexConfig, panelUv, parseFlexConfig, printLayout, solveShape, wrinkleAt } from "@/lib/vessels/families/flexible";

describe("flexible realism", () => {
  it("flow wrap print panels are landscape and read along the bar", () => {
    const cfg = defaultFlexConfig("FLEX_FLOW_WRAP");
    const front = printLayout(cfg).panels.find((p) => p.id === "front")!;
    expect(front.landscape).toBe("topRight");
    expect(front.trimWidthMm).toBe(cfg.dims.H);
    expect(front.trimHeightMm).toBe(cfg.dims.W);
    // face top (top seal) lands on the right edge, s = 0 on the top edge of the print area
    const [u0, v0] = panelUv(front, 0, 0);
    expect(u0).toBeCloseTo((front.printWidthMm - front.bleedMm) / front.printWidthMm, 6);
    expect(v0).toBeCloseTo(1 - front.bleedMm / front.printHeightMm, 6);
    const back = printLayout(cfg).panels.find((p) => p.id === "back")!;
    expect(back.landscape).toBe("topLeft");
    expect(panelUv(back, 0, 0)[0]).toBeCloseTo(back.bleedMm / back.printWidthMm, 6);
    for (const p of [front, back]) for (const r of [p.safeRect, ...p.seals, ...p.keepOut.map((k) => k.rect)]) {
      expect(r.x).toBeGreaterThanOrEqual(-1e-6);
      expect(r.y).toBeGreaterThanOrEqual(-1e-6);
      expect(r.x + r.w).toBeLessThanOrEqual(p.printWidthMm + 1e-6);
      expect(r.y + r.h).toBeLessThanOrEqual(p.printHeightMm + 1e-6);
    }
  });

  it("vertical packs keep portrait panels", () => {
    expect(printLayout(defaultFlexConfig("FLEX_PILLOW_BAG")).panels.every((p) => !p.landscape)).toBe(true);
  });

  it("clear film packs get a product inside, opaque films do not", () => {
    const clear = buildFlexibleModel(parseFlexConfig({ code: "FLEX_VACUUM_PACK", dims: { W: 200, H: 250 }, fill: 0.6, material: "FILM_CLEAR" }));
    expect(clear.parts.some((p) => p.role === "product")).toBe(true);
    const gloss = buildFlexibleModel(parseFlexConfig({ code: "FLEX_PILLOW_BAG", dims: { W: 180, H: 260 }, fill: 0.8, material: "FILM_GLOSS" }));
    expect(gloss.parts.some((p) => p.role === "product")).toBe(false);
  });

  it("wrinkles are soft, fade into the body and vanish on empty packs", () => {
    const shape = solveShape(defaultFlexConfig("FLEX_PILLOW_BAG"));
    const rows = shape.rows;
    const pts = rows[0].strips[0].pts;
    const s0 = pts[0].s;
    const s1 = pts[pts.length - 1].s;
    const tTop = rows[rows.length - 1].tFlat;
    let maxNear = 0;
    let maxMid = 0;
    for (let s = s0; s <= s1; s += 0.7) {
      maxNear = Math.max(maxNear, Math.abs(wrinkleAt(shape, "front", s, tTop + 1, s0, s1)));
      maxMid = Math.max(maxMid, Math.abs(wrinkleAt(shape, "front", s, (tTop + rows[0].tFlat) / 2, s0, s1)));
    }
    expect(maxNear).toBeGreaterThan(0.2);
    expect(maxNear).toBeLessThan(2);
    expect(maxMid).toBeLessThan(0.05);
    const empty = solveShape({ ...defaultFlexConfig("FLEX_PILLOW_BAG"), fill: 0 });
    expect(wrinkleAt(empty, "front", (s0 + s1) / 2, tTop + 1, s0, s1)).toBe(0);
  });

  it("stand-up pouch base is an eye shape: faces stay near full width at the shelf", () => {
    const cfg = defaultFlexConfig("FLEX_STAND_UP_POUCH");
    const shape = solveShape(cfg);
    const bottomHalf = shape.rows[0].strips[0].pts.at(-1)!.x;
    const Wi = cfg.dims.W - 2 * shape.seals.side;
    // an elliptical section (the old model) pinches the base into a narrow cup
    expect(bottomHalf / (Wi / 2)).toBeGreaterThan(0.85);
  });
});
