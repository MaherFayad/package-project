import { describe, expect, it } from "vitest";
import { imagePlacement } from "@/lib/dieline";
import { effectiveDpi } from "../preflight";
import { brandColorSchema, imageLayerSchema } from "../doc";
import { centredCrop, fitCrop } from "../../CropDialog";
import { withCrop } from "../../ArtworkPanel";

/** Crop (integrator decision): non-destructive crop rect, honoured by every renderer. */
describe("image crop placement", () => {
  const img = { pxWidth: 1000, pxHeight: 500 };
  it("without a crop it is the old contain fit", () => {
    const p = imagePlacement(img, 100, 100);
    expect(p).toMatchObject({ dw: 100, dh: 50, dx: -50, dy: -25, clip: null });
  });
  it("a right-half crop fills the box with that half", () => {
    const p = imagePlacement({ ...img, crop: { x: 0.5, y: 0, width: 0.5, height: 1 } }, 100, 100);
    // visible part 500 × 500 px → 100 × 100 mm, whole image 200 × 100 drawn left of centre
    expect(p.dw).toBeCloseTo(200);
    expect(p.dh).toBeCloseTo(100);
    expect(p.dx).toBeCloseTo(-150);
    expect(p.clip).toEqual({ x: -50, y: -50, w: 100, h: 100 });
  });
  it("the crop lowers the effective DPI", () => {
    const base = { width: 50, height: 50, pxWidth: 1000, pxHeight: 1000 };
    expect(effectiveDpi({ ...base, crop: { x: 0, y: 0, width: 0.5, height: 0.5 } })).toBeCloseTo(effectiveDpi(base) / 2, 0);
  });
});

describe("doc schema: crop and brand colours", () => {
  const layer = { id: "l1", kind: "image", face: "front", surface: "outside", x: 50, y: 50, width: 40, height: 20, rotation: 0, src: "data:image/png;base64,iVBORw0KGgo=", pxWidth: 100, pxHeight: 50 };
  it("accepts a crop inside the image and rejects one outside it", () => {
    expect(imageLayerSchema.safeParse({ ...layer, crop: { x: 0.25, y: 0, width: 0.5, height: 1 } }).success).toBe(true);
    expect(imageLayerSchema.safeParse({ ...layer, crop: { x: 0.75, y: 0, width: 0.5, height: 1 } }).success).toBe(false);
  });
  it("validates brand colours: name, hex, CMYK 0..100, spot reference", () => {
    expect(brandColorSchema.safeParse({ name: "أخضر الشركة", hex: "#1f3d2b", cmyk: [80, 20, 70, 60], spot: "PMS 3435 C" }).success).toBe(true);
    expect(brandColorSchema.safeParse({ name: "", hex: "#1f3d2b" }).success).toBe(false);
    expect(brandColorSchema.safeParse({ name: "x", hex: "#1f3d2b", cmyk: [101, 0, 0, 0] }).success).toBe(false);
  });
});


describe("crop frame rules", () => {
  it("keeps the frame inside the image", () => {
    expect(fitCrop({ x: 0.9, y: 0.9, width: 0.5, height: 0.5 }, null, 100, 100)).toEqual({ x: 0.5, y: 0.5, width: 0.5, height: 0.5 });
  });
  it("locks a shape in image pixels (square on a 2:1 image)", () => {
    const c = centredCrop(1, 2000, 1000);
    expect(c.width * 2000).toBeCloseTo(c.height * 1000);
    expect(c.height).toBe(1);
    expect(c.x).toBeCloseTo(0.25);
  });
  it("applying a crop gives the layer the crop's shape and removing it restores the image's", () => {
    const layer = { id: "i", kind: "image" as const, face: "front" as const, surface: "outside" as const, x: 50, y: 50, width: 80, height: 40, rotation: 0, src: "data:image/png;base64,x", pxWidth: 2000, pxHeight: 1000 };
    const face = { face: "front", width: 200, height: 100 } as never;
    const cropped = withCrop(layer, { x: 0.25, y: 0, width: 0.5, height: 1 }, face);
    expect(cropped.width / cropped.height).toBeCloseTo(1);
    expect(cropped.crop).toBeDefined();
    const back = withCrop(cropped, undefined, face);
    expect(back.width / back.height).toBeCloseTo(2);
    expect(back.crop).toBeUndefined();
  });
});
