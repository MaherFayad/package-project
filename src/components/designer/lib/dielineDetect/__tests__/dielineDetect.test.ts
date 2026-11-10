import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type { Dims } from "@/types";
import { BOX_MODELS } from "@/lib/library";
import { detectDieline, prepareModels, readImageDpi, usableDpi, type DetectResult, type RgbaImage } from "..";
import { renderDieline } from "./synth";

/**
 * Dieline detector (designer: full artwork). The owner's sample (a real mailer artwork, red
 * die lines over pink art, 1244×1600 JPEG) and a synthetic set: library dielines drawn over random
 * artwork in different colours, rotated slightly, with JPEG-like noise.
 */

const FIXTURE = path.join(__dirname, "..", "__fixtures__", "owner-mailer-sample.jpg");

async function decode(file: string): Promise<RgbaImage> {
  const sharp = (await import("sharp")).default;
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), width: info.width, height: info.height };
}

beforeAll(() => {
  prepareModels(BOX_MODELS);
}, 60_000);

describe("owner's mailer sample", () => {
  let res: DetectResult;
  beforeAll(async () => {
    const img = await decode(FIXTURE);
    res = detectDieline(img, { models: BOX_MODELS, dpi: readImageDpi(new Uint8Array(readFileSync(FIXTURE))), maxCandidates: 10 });
  }, 60_000);

  it("finds the die lines (red, upright) and the outline", () => {
    expect(res.lines.colors[0]).toMatch(/^#[0-9a-f]{6}$/);
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(res.lines.colors[0].slice(i, i + 2), 16));
    expect(r).toBeGreaterThan(g + 60);
    expect(r).toBeGreaterThan(b + 60);
    expect(Math.abs(res.lines.skewDeg)).toBeLessThan(0.2);
    expect(res.lines.dieBox).not.toBeNull();
    // The blank spans almost the whole image (x 14..1219, y 23..1574).
    const xs = res.lines.dieBox!.map((p) => p.x);
    const ys = res.lines.dieBox!.map((p) => p.y);
    expect(Math.min(...xs)).toBeLessThan(30);
    expect(Math.max(...xs)).toBeGreaterThan(1200);
    expect(Math.min(...ys)).toBeLessThan(40);
    expect(Math.max(...ys)).toBeGreaterThan(1560);
  });

  it("matches a hinged tuck-lid mailer with double end walls, square base, H about a third of W", () => {
    expect(res.found).toBe(true);
    // The sample is a lock-corner mailer: tuck lid with dust flaps, double end walls, ears on a
    // single front wall. The library's FEFCO_0427 generator adds a rolled-in double front wall
    // the sample does not have, so the closest dies are the same construction without it.
    const MAILERS = ["MAILER_RETF", "MAILER_RETF_PLAIN", "FS_BAKERY_BOX", "FEFCO_0421_1", "FEFCO_0421", "FEFCO_0426a", "FEFCO_0427", "FEFCO_0427_1", "FEFCO_0429"];
    const top = res.candidates[0];
    expect(MAILERS).toContain(top.code);
    expect(res.candidates.slice(0, 5).filter((c) => MAILERS.includes(c.code)).length).toBeGreaterThanOrEqual(3);
    // Base 524 × 535 px, walls about 160 px.
    expect(top.proportions.L / top.proportions.W).toBeGreaterThan(0.94);
    expect(top.proportions.L / top.proportions.W).toBeLessThan(1.04);
    expect(top.proportions.H / top.proportions.W).toBeGreaterThan(0.28);
    expect(top.proportions.H / top.proportions.W).toBeLessThan(0.36);
    // 72 dpi JFIF default: no usable scale, so the UI must ask for one measurement.
    expect(top.scaleKnown).toBe(false);
    expect(res.pxPerMm).toBeNull();
  });

  it("returns the top template mapped onto the image", () => {
    const ov = res.overlay!;
    expect(ov.code).toBe(res.candidates[0].code);
    expect(ov.cut.length).toBeGreaterThan(10);
    const xs = ov.panels.flat().map((p) => p.x);
    const ys = ov.panels.flat().map((p) => p.y);
    // Lands on the blank (within a few % of its bounding box).
    expect(Math.min(...xs)).toBeGreaterThan(-40);
    expect(Math.max(...xs)).toBeLessThan(1244 + 40);
    expect(Math.min(...ys)).toBeGreaterThan(-40);
    expect(Math.max(...ys)).toBeLessThan(1600 + 60);
  });
});

describe("synthetic dielines", () => {
  const LINE: [number, number, number][] = [
    [230, 30, 40],
    [220, 0, 200],
    [0, 170, 230],
    [0, 160, 60],
    [0, 0, 0],
    [30, 60, 220],
  ];
  const CASES: { code: string; dims: Dims; o: number }[] = [
    { code: "FEFCO_0427", dims: { L: 300, W: 220, H: 90 }, o: 0 },
    { code: "FEFCO_0201", dims: { L: 400, W: 300, H: 250 }, o: 1 },
    { code: "ECMA_RTE", dims: { L: 70, W: 45, H: 160 }, o: 2 },
    { code: "ECMA_STE", dims: { L: 90, W: 50, H: 150 }, o: 5 },
    { code: "PIZZA", dims: { L: 330, W: 330, H: 45 }, o: 3 },
    { code: "FEFCO_0422", dims: { L: 380, W: 280, H: 100 }, o: 0 },
    { code: "ECMA_CLB", dims: { L: 80, W: 60, H: 200 }, o: 4 },
    { code: "FEFCO_0203", dims: { L: 300, W: 200, H: 200 }, o: 7 },
  ];
  CASES.forEach(({ code, dims, o }, i) => {
    const scaleKnown = i % 2 === 0;
    it(`${code} (orientation ${o}, ${scaleKnown ? "known scale" : "no scale"})`, () => {
      const model = BOX_MODELS.find((m) => m.code === code)!;
      const longest = Math.max(dims.L, dims.W, dims.H);
      const pxPerMm = 1300 / (longest * 3);
      const { img } = renderDieline(model, dims, {
        pxPerMm,
        orientation: o,
        rotDeg: (((i * 7) % 5) - 2) * 0.6,
        line: LINE[i % LINE.length],
        lineWidth: 1 + (i % 3) * 0.5,
        seed: 1000 + i,
      });
      const res = detectDieline(img, { models: BOX_MODELS, pxPerMm: scaleKnown ? pxPerMm : null });
      expect(res.found).toBe(true);
      const top = res.candidates[0];
      expect(top.code).toBe(code);
      expect(top.scaleKnown).toBe(scaleKnown);
      for (const k of ["L", "W", "H"] as const) {
        if (scaleKnown) expect(Math.abs(top.dims[k] - dims[k]) / dims[k]).toBeLessThan(0.03);
        else expect(Math.abs(top.proportions[k] - dims[k] / longest) / (dims[k] / longest)).toBeLessThan(0.03);
      }
      // The overlay is drawn where the die was drawn.
      expect(res.overlay?.code).toBe(code);
    }, 30_000);
  });

  it("says nothing was found on artwork without a dieline", () => {
    const w = 600;
    const h = 500;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let p = 0; p < w * h; p++) {
      const x = p % w;
      data[p * 4] = 200 + (x % 40);
      data[p * 4 + 1] = 120;
      data[p * 4 + 2] = 90 + ((p / w) % 60);
      data[p * 4 + 3] = 255;
    }
    const res = detectDieline({ data, width: w, height: h }, { models: BOX_MODELS });
    expect(res.found).toBe(false);
  });
});

describe("readImageDpi", () => {
  it("reads JFIF density and treats 72 dpi as unknown", () => {
    const dpi = readImageDpi(new Uint8Array(readFileSync(FIXTURE)));
    expect(dpi).toBe(72);
    expect(usableDpi(dpi)).toBeNull();
    expect(usableDpi(300)).toBe(300);
  });

  it("reads a JFIF header in dots per inch and per cm", () => {
    const jfif = (units: number, density: number) =>
      new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x02, units, density >> 8, density & 255, density >> 8, density & 255, 0, 0, 0xff, 0xda]);
    expect(readImageDpi(jfif(1, 300))).toBe(300);
    expect(readImageDpi(jfif(2, 118))).toBeCloseTo(299.7, 1);
  });

  it("reads PNG pHYs", () => {
    const ppm = Math.round(300 / 0.0254);
    const b = new Uint8Array(8 + 25 + 21);
    b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const ihdr = 8;
    b.set([0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52], ihdr);
    const phys = ihdr + 25;
    b.set([0, 0, 0, 9, 0x70, 0x48, 0x59, 0x73, ppm >>> 24, (ppm >> 16) & 255, (ppm >> 8) & 255, ppm & 255, ppm >>> 24, (ppm >> 16) & 255, (ppm >> 8) & 255, ppm & 255, 1], phys);
    expect(readImageDpi(b)).toBeCloseTo(300, 0);
  });
});
