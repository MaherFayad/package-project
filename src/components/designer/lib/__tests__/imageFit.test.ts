import { describe, expect, it } from "vitest";
import type { ImageLayer } from "@/types";
import { generateDieline } from "@/lib/dieline";
import { addLayer, copyToSides, createDesignDoc, designDocSchema, findLayer, makeImageLayer, rescaleArtwork, faceSizesOf } from "../doc";
import { autoPlace, fitBox, fitScaleOf, keepsPlace, placeImage, replaceOnResize, settlePlace } from "../imageFit";
import { effectiveDpi, runPreflight } from "../preflight";

const PNG = "data:image/png;base64,iVBORw0KGgo=";
const M = { safeMm: 3, bleedMm: 3 };
const photo = { transparent: false, plainEdges: false };
const img = (pxWidth: number, pxHeight: number) => makeImageLayer("front", "outside", { width: 200, height: 100 }, { src: PNG, pxWidth, pxHeight });

describe("autoPlace (Fill or Fit on upload)", () => {
  const face = { width: 200, height: 100 };
  it("fits a transparent logo or one on a plain background", () => {
    expect(autoPlace({ pxWidth: 2000, pxHeight: 1000 }, { transparent: true, plainEdges: false }, face, M)).toBe("fit");
    expect(autoPlace({ pxWidth: 2000, pxHeight: 1000 }, { transparent: false, plainEdges: true }, face, M)).toBe("fit");
  });
  it("fills with an opaque photo shaped like the side", () => {
    expect(autoPlace({ pxWidth: 3000, pxHeight: 1600 }, photo, face, M)).toBe("fill");
    expect(autoPlace({ pxWidth: 3000, pxHeight: 2000 }, photo, face, M)).toBe("fill");
  });
  it("fits a photo far from the side's shape or too small to fill sharply", () => {
    expect(autoPlace({ pxWidth: 1000, pxHeight: 3000 }, photo, face, M)).toBe("fit");
    expect(autoPlace({ pxWidth: 400, pxHeight: 200 }, photo, face, M)).toBe("fit");
  });
});

describe("placeImage", () => {
  it("Fill covers a non-square side out to the bleed, centred, cropped", () => {
    const l = placeImage(img(1000, 1000), { width: 200, height: 100 }, M, "fill");
    expect(l).toMatchObject({ place: "fill", fit: "cover", rotation: 0, x: 100, y: 50, width: 206, height: 106 });
    // cover: the square image is scaled to the box's longer side, so dpi uses that scale
    expect(effectiveDpi(l)).toBeCloseTo(25.4 / (206 / 1000), 3);
  });

  it("Fit shows the whole image inside the safe zone, aspect kept", () => {
    const tall = placeImage(img(500, 1000), { width: 200, height: 100 }, M, "fit");
    expect(tall).toMatchObject({ place: "fit", fit: "contain", x: 100, y: 50 });
    expect(tall.height).toBeCloseTo(94);
    expect(tall.width).toBeCloseTo(47);
    const wide = placeImage(img(4000, 1000), { width: 200, height: 100 }, M, "fit");
    expect(wide.width).toBeCloseTo(194);
    expect(wide.height).toBeCloseTo(48.5);
    expect(keepsPlace(wide, { width: 200, height: 100 }, M)).toBe(true);
  });

  it("Fit at a smaller share keeps the drop point, clamped to the safe zone", () => {
    const face = { width: 200, height: 100 };
    const l = placeImage(img(1000, 1000), face, M, "fit", { scale: 0.5, at: { x: 190, y: 10 } });
    expect(l.width).toBeCloseTo(47);
    expect(l.x).toBeCloseTo(200 - 3 - 23.5);
    expect(l.y).toBeCloseTo(3 + 23.5);
    expect(fitScaleOf(l, face, M)).toBeCloseTo(0.5);
    expect(keepsPlace(l, face, M)).toBe(true);
  });

  it("uses the cropped part's shape", () => {
    const l = placeImage({ ...img(1000, 1000), crop: { x: 0, y: 0, width: 1, height: 0.5 } }, { width: 200, height: 100 }, M, "fit");
    expect(l.width / l.height).toBeCloseTo(2);
    expect(fitBox(l, { width: 200, height: 100 }, M).width).toBeCloseTo(188);
  });
});

describe("settlePlace and size changes", () => {
  const face = { width: 200, height: 100 };
  it("a drag or rotation frees a Fill image; a crop keeps it filling", () => {
    const fill = placeImage(img(1000, 1000), face, M, "fill");
    expect(settlePlace(fill, { ...fill, x: 120 }, face, M).place).toBeUndefined();
    expect(settlePlace(fill, { ...fill, rotation: 15 }, face, M).place).toBeUndefined();
    const cropped = settlePlace(fill, { ...fill, width: 50, crop: { x: 0, y: 0, width: 0.5, height: 1 } }, face, M);
    expect(cropped).toMatchObject({ place: "fill", width: 206, height: 106 });
  });

  it("a Fit image stays Fit when moved inside the safe zone, and is freed when pushed out", () => {
    const fit = placeImage(img(1000, 1000), face, M, "fit", { scale: 0.5 });
    expect(settlePlace(fit, { ...fit, x: fit.x + 20 }, face, M).place).toBe("fit");
    expect(settlePlace(fit, { ...fit, x: 1 }, face, M).place).toBeUndefined();
  });

  it("re-places Fill and Fit when the side changes size (non-square to a different shape)", () => {
    const fill = placeImage(img(1600, 1000), face, M, "fill");
    const bigger = { width: 300, height: 150 };
    expect(replaceOnResize(fill, face, bigger, M)).toMatchObject({ x: 150, y: 75, width: 306, height: 156 });
    const fit = placeImage(img(1000, 1000), face, M, "fit", { scale: 0.6 });
    const narrow = { width: 80, height: 120 };
    const r = replaceOnResize(fit, face, narrow, M);
    expect(fitScaleOf(r, narrow, M)).toBeCloseTo(0.6);
    expect(r.width).toBeCloseTo(74 * 0.6);
    expect(keepsPlace(r, narrow, M)).toBe(true);
  });

  it("rescaleArtwork re-places Fill / Fit on a dims change and leaves free images as before", () => {
    const doc = createDesignDoc({ structureCode: "FEFCO_0427" });
    const before = generateDieline("FEFCO_0427", doc.dims, { thicknessMm: 1.5 });
    const top = before.faces.top!;
    const fill = placeImage(makeImageLayer("top", "outside", top, { src: PNG, pxWidth: 3000, pxHeight: 2000 }), top, before, "fill");
    const free = { ...makeImageLayer("front", "outside", before.faces.front!, { src: PNG, pxWidth: 1000, pxHeight: 1000 }) };
    delete (free as Partial<ImageLayer>).place;
    let d = addLayer(addLayer(doc, fill), free);
    const dims = { ...doc.dims, L: doc.dims.L + 80, W: doc.dims.W + 20 };
    const after = generateDieline("FEFCO_0427", dims, { thicknessMm: 1.5 });
    d = rescaleArtwork({ ...d, dims }, faceSizesOf(before.faces), faceSizesOf(after.faces), after).doc;
    const nt = after.faces.top!;
    expect(findLayer(d, fill.id)).toMatchObject({ place: "fill", x: nt.width / 2, y: nt.height / 2, width: nt.width + 2 * after.bleedMm, height: nt.height + 2 * after.bleedMm });
    expect(findLayer(d, free.id)!.width).toBeCloseTo(free.width);
    // the saved doc keeps the mode
    expect((designDocSchema.parse(d).artwork.outside.layers.find((l) => l.id === fill.id) as ImageLayer).place).toBe("fill");
  });

  it("a Fill image passes preflight (no safe zone or fold warning) and copies as Fill on other sides", () => {
    const doc = createDesignDoc({ structureCode: "FEFCO_0427" });
    const model = generateDieline("FEFCO_0427", doc.dims, { thicknessMm: 1.5 });
    const front = model.faces.front!;
    const fill = placeImage(makeImageLayer("front", "outside", front, { src: PNG, pxWidth: 3000, pxHeight: 3000 }), front, model, "fill");
    const d = addLayer(doc, fill);
    expect(runPreflight(d, model).filter((i) => i.layerId === fill.id && i.code !== "LOW_DPI")).toEqual([]);
    const copied = copyToSides(d, fill.id, faceSizesOf(model.faces), 25, model).doc;
    const back = copied.artwork.outside.layers.find((l) => l.face === "back") as ImageLayer | undefined;
    if (back) expect(keepsPlace(back, model.faces.back!, model)).toBe(true);
  });
});
