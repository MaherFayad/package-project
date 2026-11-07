import { describe, expect, it } from "vitest";
import type { DesignDoc } from "@/types";
import { generateDieline } from "@/lib/dieline";
import {
  MAX_LAYERS,
  addLayer,
  copyToSides,
  createDesignDoc,
  duplicateLayer,
  faceSizesOf,
  findLayer,
  makeImageLayer,
  makeShapeLayer,
  makeTextLayer,
  parseDesignDoc,
  removeLayer,
  reorderLayer,
  rescaleArtwork,
  setBackground,
  updateLayer,
  withoutInlineImages,
} from "../doc";

const PNG = "data:image/png;base64,iVBORw0KGgo=";

function sample(): DesignDoc {
  let d = createDesignDoc({ structureCode: "FEFCO_0427" });
  d = addLayer(d, makeTextLayer("front", "outside", { width: 250, height: 80 }, "Bloom"));
  d = addLayer(d, makeImageLayer("top", "outside", { width: 250, height: 180 }, { src: PNG, pxWidth: 400, pxHeight: 200 }));
  return d;
}

describe("design document", () => {
  it("creates a valid default doc and picks a board that fits the style", () => {
    const d = createDesignDoc({ structureCode: "ECMA_RTE", materialCode: "E_FLUTE_KRAFT" });
    expect(d.materialCode).toBe("SBS_350");
    expect(d.dims).toEqual({ L: 60, W: 60, H: 140 });
    expect(parseDesignDoc(d)).not.toBeNull();
  });

  it("validates untrusted docs strictly", () => {
    const d = sample();
    expect(parseDesignDoc(d)).not.toBeNull();
    expect(parseDesignDoc({ ...d, structureCode: "NOPE" })).toBeNull();
    expect(parseDesignDoc({ ...d, materialCode: "SBS_300" })).toBeNull(); // wrong family for a mailer
    const bad = updateLayer(d, d.artwork.outside.layers[1].id, { src: "javascript:alert(1)" } as never);
    expect(parseDesignDoc(bad)).toBeNull();
    const svg = updateLayer(d, d.artwork.outside.layers[1].id, { src: "data:image/svg+xml;base64,PHN2Zz4=" } as never);
    expect(parseDesignDoc(svg)).toBeNull();
    const colour = updateLayer(d, d.artwork.outside.layers[0].id, { color: "red" } as never);
    expect(parseDesignDoc(colour)).toBeNull();
  });

  it("caps the number of layers", () => {
    let d = createDesignDoc({ structureCode: "FEFCO_0427" });
    for (let i = 0; i < MAX_LAYERS + 5; i++) d = addLayer(d, makeShapeLayer("front", "outside", { width: 100, height: 50 }, "rect"));
    expect(d.artwork.outside.layers.length).toBe(MAX_LAYERS);
  });

  it("updates, reorders, duplicates and removes layers immutably", () => {
    const d = sample();
    const [a, b] = d.artwork.outside.layers;
    const moved = updateLayer(d, a.id, { x: 10 });
    expect(findLayer(moved, a.id)!.x).toBe(10);
    expect(findLayer(d, a.id)!.x).not.toBe(10);
    expect(reorderLayer(d, a.id, 1).artwork.outside.layers.map((l) => l.id)).toEqual([b.id, a.id]);
    expect(reorderLayer(d, a.id, -1)).toBe(d);
    const dup = duplicateLayer(d, a.id);
    expect(dup.id).not.toBeNull();
    expect(findLayer(dup.doc, dup.id)!.x).toBe(a.x + 5);
    expect(removeLayer(d, a.id).artwork.outside.layers).toHaveLength(1);
    expect(setBackground(d, "inside", "#ffffff").artwork.inside.background).toBe("#ffffff");
  });

  it("text factory picks the Arabic font for Arabic text", () => {
    expect(makeTextLayer("front", "outside", { width: 100, height: 50 }, "علبة").fontFamily).toBe("IBM Plex Sans Arabic");
    expect(makeTextLayer("front", "outside", { width: 100, height: 50 }, "Box").fontFamily).toBe("Inter");
  });

  it("image factory keeps the aspect ratio inside half the face", () => {
    const l = makeImageLayer("front", "outside", { width: 200, height: 40 }, { src: PNG, pxWidth: 100, pxHeight: 100 });
    expect(l.height).toBeCloseTo(20);
    expect(l.width).toBeCloseTo(20);
  });

  it("rescales artwork when the box size changes and drops layers on missing faces", () => {
    const d = sample();
    const before = faceSizesOf(generateDieline("FEFCO_0427", d.dims, { thicknessMm: 1.5 }).faces);
    const bigger = { L: 500, W: 360, H: 160 };
    const after = faceSizesOf(generateDieline("FEFCO_0427", bigger, { thicknessMm: 1.5 }).faces);
    const r = rescaleArtwork({ ...d, dims: bigger }, before, after);
    expect(r.removed).toBe(0);
    // Positions scale with the face: the centre stays the centre.
    const text = r.doc.artwork.outside.layers[0];
    const orig = d.artwork.outside.layers[0];
    expect(text.x / after.front!.width).toBeCloseTo(orig.x / before.front!.width, 5);
    expect(text.y / after.front!.height).toBeCloseTo(orig.y / before.front!.height, 5);
    expect(text.width).toBe(orig.width);

    // A sleeve has no left/right panels.
    const withLeft = addLayer(d, makeShapeLayer("left", "outside", { width: 180, height: 80 }, "rect"));
    const sleeve = faceSizesOf(generateDieline("SLEEVE", { L: 220, W: 150, H: 60 }, { thicknessMm: 0.48 }).faces);
    expect(sleeve.left).toBeUndefined();
    expect(rescaleArtwork(withLeft, before, sleeve).removed).toBe(1);
  });

  it("shrinks layers that no longer fit a smaller face", () => {
    let d = createDesignDoc({ structureCode: "FEFCO_0427" });
    d = addLayer(d, { ...makeTextLayer("front", "outside", { width: 250, height: 80 }, "Wide"), width: 240, fontSizePt: 40 });
    const r = rescaleArtwork(d, { front: { width: 250, height: 80 } }, { front: { width: 120, height: 80 } });
    const l = r.doc.artwork.outside.layers[0];
    expect(l.width).toBeLessThanOrEqual(120);
    expect(l.kind === "text" && l.fontSizePt).toBeLessThan(40);
  });

  it("strips inline images for the local fallback copy", () => {
    expect(withoutInlineImages(sample()).artwork.outside.layers.map((l) => l.kind)).toEqual(["text"]);
  });
});

describe("copyToSides (logo on every side)", () => {
  const faces = { top: { width: 250, height: 180 }, front: { width: 250, height: 80 }, back: { width: 250, height: 80 }, left: { width: 180, height: 80 }, right: { width: 180, height: 80 }, bottom: { width: 250, height: 180 } };
  it("adds one centred copy per side except the bottom, scaled to fit, and is idempotent", () => {
    const d = sample();
    const logo = d.artwork.outside.layers.find((l) => l.kind === "image")!;
    const r = copyToSides(d, logo.id, faces);
    expect(r.added).toBe(4);
    const copies = r.doc.artwork.outside.layers.filter((l) => l.kind === "image" && l.id !== logo.id);
    expect(copies.map((l) => l.face).sort()).toEqual(["back", "front", "left", "right"]);
    for (const c of copies) {
      const f = faces[c.face];
      expect(c.x).toBe(f.width / 2);
      expect(c.height).toBeLessThanOrEqual(f.height * 0.8 + 1e-9);
      expect(c.width / c.height).toBeCloseTo(logo.width / logo.height, 6);
    }
    expect(copyToSides(r.doc, logo.id, faces).added).toBe(0);
  });
  it("skips sides that are too small and does nothing for an unknown id", () => {
    const d = sample();
    const logo = d.artwork.outside.layers.find((l) => l.kind === "image")!;
    expect(copyToSides(d, logo.id, { ...faces, left: { width: 20, height: 80 }, right: { width: 20, height: 80 } }).added).toBe(2);
    expect(copyToSides(d, "nope", faces).added).toBe(0);
  });
});
