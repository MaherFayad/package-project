import { describe, expect, it } from "vitest";
import { applyAffine, faceTransform, generateDieline, sheetImagePlacement } from "@/lib/dieline";
import { generatePrintPdf } from "@/lib/orders/pdf/print";
import { createDesignDoc, designDocSchema } from "../doc";
import { faceAtHit } from "../geometry";
import { runPreflight } from "../preflight";

// 1 × 1 PNG
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function setup() {
  const doc = createDesignDoc({ structureCode: "FEFCO_0427" });
  const model = generateDieline("FEFCO_0427", doc.dims, { thicknessMm: 1.5 });
  return { doc, model };
}

describe("full artwork (sheet image)", () => {
  it("covers the sheet, centred, keeping its aspect", () => {
    const { model } = setup();
    const { width: sw, height: sh } = model.sheet;
    const p = sheetImagePlacement(model, { pxWidth: Math.round(sw * 10), pxHeight: Math.round(sh * 10) });
    expect(p.x).toBeCloseTo(0, 0);
    expect(p.y).toBeCloseTo(0, 0);
    expect(p.width).toBeCloseTo(sw, 0);
    expect(p.pxPerMm).toBeCloseTo(10, 1);
    const wide = sheetImagePlacement(model, { pxWidth: 4000, pxHeight: 1000 });
    expect(wide.height).toBeCloseTo(sh);
    expect(wide.width).toBeGreaterThan(sw);
    expect(wide.x).toBeLessThan(0);
  });

  it("is kept by the save schema and checked for resolution", () => {
    const { doc, model } = setup();
    const withSheet = { ...doc, artwork: { ...doc.artwork, outside: { ...doc.artwork.outside, sheetImage: { src: PNG, pxWidth: 400, pxHeight: 400 } } } };
    const parsed = designDocSchema.parse(withSheet);
    expect(parsed.artwork.outside.sheetImage?.pxWidth).toBe(400);
    const issues = runPreflight(withSheet, model);
    expect(issues.some((i) => i.code === "LOW_DPI" && i.severity === "error")).toBe(true);
    expect(issues.some((i) => i.code === "EMPTY_DESIGN")).toBe(false);
  });

  it("is placed in the print PDF", async () => {
    const { doc } = setup();
    const withSheet = { ...doc, artwork: { ...doc.artwork, outside: { ...doc.artwork.outside, sheetImage: { src: PNG, pxWidth: 1, pxHeight: 1 } } } };
    const pdf = await generatePrintPdf(withSheet);
    expect(pdf.warnings.filter((w) => w.startsWith("IMAGE_NOT_EMBEDDED"))).toEqual([]);
    expect(Buffer.from(pdf.bytes).toString("latin1")).toContain("/Subtype /Image");
  });
});

describe("3D pick → face", () => {
  it("maps a sheet point on a panel to its face and face-local point", () => {
    const { model } = setup();
    const front = model.faces.front!;
    const part = front.parts[0];
    const local = { x: front.width * 0.25, y: front.height * 0.5 };
    const sheet = applyAffine(faceTransform(front, part, "outside"), local.x, local.y);
    const hit = faceAtHit(model, { panelId: part.panelId, surface: "outside", sheet });
    expect(hit?.face).toBe("front");
    expect(hit?.at.x).toBeCloseTo(local.x, 3);
    expect(hit?.at.y).toBeCloseTo(local.y, 3);
  });

  it("gives null for a panel that is not part of a face", () => {
    const { model } = setup();
    const onFace = new Set(Object.values(model.faces).flatMap((f) => f!.parts.map((p) => p.panelId)));
    const loose = model.panels.find((p) => !onFace.has(p.id));
    if (!loose) return;
    expect(faceAtHit(model, { panelId: loose.id, surface: "outside", sheet: { x: 0, y: 0 } })).toBeNull();
  });
});
