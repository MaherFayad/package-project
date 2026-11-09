import { describe, expect, it } from "vitest";
import { PDFDict, PDFDocument, PDFName } from "pdf-lib";
import { BOX_MODELS } from "@/lib/library/boxes";
import { modelFromParam } from "@/lib/library";
import type { BoxModelDef } from "@/lib/library/types";
import { dielineToSvg } from "@/lib/dieline";
import { generatePrintPdf } from "@/lib/orders/pdf/print";
import { aspectAt, checkArtworkFit, FIT_TOLERANCE, scanModels, solveModelDims, thicknessFor } from "../artworkFit";
import { createModelDoc } from "../doc";
import { runPreflight } from "../preflight";

const mailer = modelFromParam("mailer-box") as BoxModelDef;
const DIMS = { L: 250, W: 180, H: 80 };
const TH = thicknessFor(mailer, "E_FLUTE_KRAFT");
const model = mailer.build(DIMS, { thicknessMm: TH });
const tpl = model.sheet.width / model.sheet.height;
/** Image px for an aspect, long side 6000 px. */
const px = (aspect: number, long = 6000) => (aspect >= 1 ? { pxWidth: long, pxHeight: Math.round(long / aspect) } : { pxWidth: Math.round(long * aspect), pxHeight: long });
const fast = { now: (() => { let t = 0; return () => (t += 0.01); })(), yieldFn: async () => {}, budgetMs: 1e9 };

describe("full artwork fit check", () => {
  it("passes an image made on this template, with its print resolution", () => {
    const c = checkArtworkFit(model, px(tpl));
    expect(c.verdict).toBe("fits");
    expect(c.cropEdge).toBeNull();
    expect(c.dpi).toBeCloseTo((6000 / Math.max(model.sheet.width, model.sheet.height)) * 25.4, 0);
  });

  it("calls a small difference a near fit and a large one a mismatch, naming the cut edge", () => {
    const near = checkArtworkFit(model, px(tpl * 1.03));
    expect(near.verdict).toBe("near");
    expect(near.cropEdge).toBe("sides");
    expect(near.cropShare).toBeCloseTo(1 - 1 / 1.03, 2);
    const off = checkArtworkFit(model, px(tpl / 1.4));
    expect(off.verdict).toBe("off");
    expect(off.cropEdge).toBe("topBottom");
  });

  it("flags low resolution with the size it prints sharply at", () => {
    const c = checkArtworkFit(model, { pxWidth: 600, pxHeight: Math.round(600 / tpl) });
    expect(c.dpiLevel).toBe("error");
    expect(c.goodSizeMm.width).toBeCloseTo((600 / 300) * 25.4, 3);
    expect(checkArtworkFit(model, px(tpl, 8000)).dpiLevel).toBe("ok");
  });
});

describe("finding what the design fits", () => {
  it("solves this model's size: a standard size first, else one that keeps the height", () => {
    const std = mailer.presets.find((p) => p.standard && (p.dims.L !== DIMS.L || p.dims.W !== DIMS.W))!;
    const target = aspectAt(mailer, std.dims, TH);
    const best = solveModelDims(mailer, DIMS, target, { material: "E_FLUTE_KRAFT" })[0];
    expect(best.standard).toBe(true);
    expect(best.dims).toEqual(std.dims);

    const odd = aspectAt(mailer, { L: 300, W: 180, H: 80 }, TH) * 1.002;
    const solved = solveModelDims(mailer, DIMS, odd, { material: "E_FLUTE_KRAFT" }).filter((s) => !s.standard);
    expect(solved.length).toBeGreaterThan(0);
    expect(solved[0].changed).not.toContain("H");
    for (const k of ["L", "W", "H"] as const) {
      expect(solved[0].dims[k]).toBeGreaterThanOrEqual(mailer.limits[k].min);
      expect(solved[0].dims[k]).toBeLessThanOrEqual(mailer.limits[k].max);
    }
    expect(Math.abs(Math.log(aspectAt(mailer, solved[0].dims, TH) / odd))).toBeLessThanOrEqual(FIT_TOLERANCE);
  });

  it("finds another model whose template has the image's shape", async () => {
    const other = BOX_MODELS.find((m) => m.code === "FEFCO_0201")!;
    const std = other.presets.find((p) => p.standard) ?? { dims: other.defaultDims };
    const target = aspectAt(other, std.dims, thicknessFor(other, "E_FLUTE_KRAFT"));
    const res = await scanModels(BOX_MODELS, target, { material: "E_FLUTE_KRAFT", family: mailer.family, group: mailer.group, skip: mailer.code, ...fast });
    expect(res.complete).toBe(true);
    expect(res.matches.length).toBeGreaterThan(0);
    expect(res.matches.length).toBeLessThanOrEqual(3);
    for (const m of res.matches) expect(m.diff).toBeLessThanOrEqual(FIT_TOLERANCE);
    expect(res.matches.every((m) => m.code !== mailer.code)).toBe(true);
  }, 30_000);

  it("says nothing fits a shape no box makes", async () => {
    const target = 60;
    expect(solveModelDims(mailer, DIMS, target, { material: "E_FLUTE_KRAFT" })).toEqual([]);
    const res = await scanModels(BOX_MODELS, target, { material: "E_FLUTE_KRAFT", family: mailer.family, skip: mailer.code, ...fast });
    expect(res.matches).toEqual([]);
  }, 30_000);

  it("stops at the time budget and reports it", async () => {
    let t = 0;
    const res = await scanModels(BOX_MODELS, 3, { material: "E_FLUTE_KRAFT", family: mailer.family, budgetMs: 5, now: () => (t += 1), yieldFn: async () => {} });
    expect(res.complete).toBe(false);
    expect(res.scanned).toBeLessThan(BOX_MODELS.length);
  });
});

describe("inside full artwork", () => {
  const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const PNG2 = PNG.replace("AAAAAA", "AAAAAB");
  const base = createModelDoc(mailer, { dims: DIMS });
  const both = {
    ...base,
    printSides: "BOTH" as const,
    artwork: {
      outside: { ...base.artwork.outside, sheetImage: { src: PNG, pxWidth: 9000, pxHeight: Math.round(9000 / tpl) } },
      inside: { ...base.artwork.inside, sheetImage: { src: PNG2, pxWidth: 400, pxHeight: 300 } },
    },
  };

  it("is checked by preflight on the inside surface", () => {
    const issues = runPreflight(both, model);
    expect(issues.filter((i) => i.code === "LOW_DPI")).toHaveLength(1);
    const outsideOnly = runPreflight({ ...both, printSides: "OUTSIDE" }, model);
    expect(outsideOnly.some((i) => i.code === "LOW_DPI")).toBe(false);
  });

  it("goes on the inside page of the print PDF", async () => {
    const pdf = await generatePrintPdf(both);
    expect(pdf.warnings.filter((w) => w.startsWith("IMAGE_NOT_EMBEDDED"))).toEqual([]);
    const text = Buffer.from(pdf.bytes).toString("latin1");
    expect((text.match(/\/Subtype \/Image/g) ?? []).length).toBe(2);
    const doc = await PDFDocument.load(pdf.bytes);
    expect(doc.getPageCount()).toBe(2);
    // the inside page draws an image of its own (the inside sheet)
    const xobjects = doc.getPages()[1].node.Resources()?.lookup(PDFName.of("XObject"), PDFDict);
    expect(xobjects?.keys().length ?? 0).toBeGreaterThan(0);
  });

  it("has an inside template: the sheet flipped, labels still readable", () => {
    const out = dielineToSvg(model, { locale: "en" });
    const inside = dielineToSvg(model, { locale: "en", inside: true });
    expect(out).not.toContain('data-layer="inside"');
    expect(inside).toContain(`transform="matrix(-1 0 0 1 ${Number(model.sheet.width.toFixed(2))} 0)"`);
    // labels sit outside the flipped group (not mirrored text)
    expect(inside.indexOf('data-layer="labels"')).toBeGreaterThan(inside.indexOf("</g>", inside.indexOf('data-layer="inside"')));
  });
});
