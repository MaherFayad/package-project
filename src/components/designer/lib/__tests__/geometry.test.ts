import { describe, expect, it } from "vitest";
import type { ShapeLayer, TextLayer } from "@/types";
import { contrastRatio, contrastingInk } from "../color";
import { bboxOf, convexOverlap, layerQuad, normAngle, placeLayer, scaleLayer } from "../geometry";

const shape = (o: Partial<ShapeLayer> = {}): ShapeLayer => ({
  id: "s",
  kind: "shape",
  face: "front",
  surface: "outside",
  x: 50,
  y: 25,
  width: 20,
  height: 10,
  rotation: 0,
  shape: "rect",
  fill: "#303030",
  stroke: null,
  strokeWidthMm: 0,
  ...o,
});

describe("geometry", () => {
  it("computes rotated quads", () => {
    const b = bboxOf(layerQuad(shape({ rotation: 90 })));
    expect(b.maxX - b.minX).toBeCloseTo(10);
    expect(b.maxY - b.minY).toBeCloseTo(20);
  });

  it("SAT overlap ignores touching edges", () => {
    const a = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    const touching = a.map((p) => ({ x: p.x + 10, y: p.y }));
    const overlapping = a.map((p) => ({ x: p.x + 5, y: p.y }));
    expect(convexOverlap(a, touching)).toBe(false);
    expect(convexOverlap(a, overlapping)).toBe(true);
    expect(convexOverlap(a, [{ x: 5, y: -5 }, { x: 5, y: 15 }], 0.25)).toBe(true);
    expect(convexOverlap(a, [{ x: 20, y: -5 }, { x: 20, y: 15 }], 0.25)).toBe(false);
  });

  it("places a logo inside the safe zone", () => {
    const face = { width: 100, height: 50 };
    expect(placeLayer(shape(), face, "topStart", 5)).toMatchObject({ x: 15, y: 10 });
    expect(placeLayer(shape(), face, "topEnd", 5)).toMatchObject({ x: 85, y: 10 });
    expect(placeLayer(shape(), face, "bottom", 5)).toMatchObject({ x: 50, y: 40 });
    const filled = placeLayer(shape(), face, "fill", 5);
    expect(filled.width).toBeCloseTo(80);
    expect(filled.height).toBeCloseTo(40);
  });

  it("scales text with its font size and normalises angles", () => {
    const t = { ...shape(), kind: "text", text: "A", fontFamily: "Inter", fontSizePt: 10, fontWeight: 700, color: "#303030", align: "center", direction: "auto" } as unknown as TextLayer;
    const s = scaleLayer(t, 2);
    expect(s.width).toBe(40);
    expect(s.fontSizePt).toBe(20);
    expect(normAngle(190)).toBe(-170);
    expect(normAngle(-180)).toBe(180);
  });
});


describe("colour helpers", () => {
  it("picks readable ink for new text", () => {
    expect(contrastingInk("#1f3d2b")).toBe("#ffffff");
    expect(contrastingInk("#b98d5e")).toBe("#303030"); // kraft board
    expect(contrastingInk("#ffffff")).toBe("#303030");
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
  });
});
