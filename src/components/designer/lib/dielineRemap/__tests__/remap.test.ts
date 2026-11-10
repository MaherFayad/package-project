import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type { FaceId, PrintSurface } from "@/types";
import { BOX_MODELS } from "@/lib/library";
import { applyAffine, generateDieline, type Affine, type DielineModel } from "@/lib/dieline";
import { prepareModels, type RgbaImage } from "../../dielineDetect";
import { renderDieline } from "../../dielineDetect/__tests__/synth";
import { thicknessOf } from "../../dielineDetect/match";
import { faceLinesOf, findFaces, mirrorSymmetric, paintOutLines, remapSheet, type SourceFace } from "..";
import { candidateModelOf, recognise, type RecogniseResult } from "../recognise";

/**
 * Dieline remap (designer: full artwork made on the buyer's own printer template). The owner's
 * three dielines (2026-11-10 inside and outside webp, and the earlier jpg sample) are recognised,
 * then re-composed on Elba's mailer (FEFCO_0427) and on the recognised model itself. Each visible
 * face of the closed box is compared with the same face of the upload, found independently by
 * topology (./faces.ts): mean colour and a downscaled correlation.
 */

const ROOT = process.cwd();
const FILES: { name: string; file: string; surface: PrintSurface }[] = [
  { name: "outside (purple)", file: path.join(ROOT, "docs/owner-input/2026-11-10/dieline-outside-purple.webp"), surface: "outside" },
  { name: "inside (pink)", file: path.join(ROOT, "docs/owner-input/2026-11-10/dieline-inside-pink.webp"), surface: "inside" },
  { name: "sample (jpg)", file: path.join(ROOT, "src/components/designer/lib/dielineDetect/__fixtures__/owner-mailer-sample.jpg"), surface: "outside" },
];

/** The owner's construction: hinged tuck lid with side flaps, double end walls with locks, ears. */
const MAILERS = ["FS_BAKERY_BOX", "FEFCO_0421_1", "FEFCO_0421", "FEFCO_0421a", "FEFCO_0426a", "FEFCO_0427", "FEFCO_0427_1", "FEFCO_0428", "FEFCO_0429", "FEFCO_0429a"];
const FACES: FaceId[] = ["top", "bottom", "front", "back", "left", "right"];

async function decode(file: string): Promise<RgbaImage> {
  const sharp = (await import("sharp")).default;
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), width: info.width, height: info.height };
}

const N = 16;
/** N×N grid of mean RGB over a face, sampled through `at(u, v)` (u, v in 0..1, face-local). */
function grid(img: RgbaImage, at: (u: number, v: number) => { x: number; y: number }, inset = 0.1): Float64Array {
  const out = new Float64Array(N * N * 3);
  const S = 3;
  for (let gy = 0; gy < N; gy++)
    for (let gx = 0; gx < N; gx++)
      for (let sy = 0; sy < S; sy++)
        for (let sx = 0; sx < S; sx++) {
          const u = inset + ((gx + (sx + 0.5) / S) / N) * (1 - 2 * inset);
          const v = inset + ((gy + (sy + 0.5) / S) / N) * (1 - 2 * inset);
          const p = at(u, v);
          const x = Math.min(img.width - 1, Math.max(0, Math.round(p.x)));
          const y = Math.min(img.height - 1, Math.max(0, Math.round(p.y)));
          const i = (y * img.width + x) * 4;
          for (let c = 0; c < 3; c++) out[(gy * N + gx) * 3 + c] += img.data[i + c] / (S * S);
        }
  return out;
}

function compare(a: Float64Array, b: Float64Array) {
  const m = (g: Float64Array, c: number) => {
    let s = 0;
    for (let i = c; i < g.length; i += 3) s += g[i];
    return s / (g.length / 3);
  };
  const meanDiff = Math.max(...[0, 1, 2].map((c) => Math.abs(m(a, c) - m(b, c))));
  // luminance correlation
  const la = Array.from({ length: N * N }, (_, i) => 0.3 * a[i * 3] + 0.59 * a[i * 3 + 1] + 0.11 * a[i * 3 + 2]);
  const lb = Array.from({ length: N * N }, (_, i) => 0.3 * b[i * 3] + 0.59 * b[i * 3 + 1] + 0.11 * b[i * 3 + 2]);
  const ma = la.reduce((s, v) => s + v, 0) / la.length;
  const mb = lb.reduce((s, v) => s + v, 0) / lb.length;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < la.length; i++) {
    num += (la[i] - ma) * (lb[i] - mb);
    da += (la[i] - ma) ** 2;
    db += (lb[i] - mb) ** 2;
  }
  // a flat face (one colour) has no pattern to correlate: the mean colour says it all
  const corr = da < 50 * la.length && db < 50 * lb.length ? 1 : num / Math.sqrt(da * db || 1);
  return { meanDiff, corr };
}

/** Face-local (u, v in 0..1) → remapped sheet px, for a target model's face. */
function targetAt(model: DielineModel, face: FaceId, k: number, surface: PrintSurface) {
  const info = model.faces[face]!;
  return (u: number, v: number) => {
    const fu = u * info.width;
    const fv = v * info.height;
    const part = info.parts.find((p) => fu >= p.rect.x - 0.01 && fu <= p.rect.x + p.rect.width + 0.01 && fv >= p.rect.y - 0.01 && fv <= p.rect.y + p.rect.height + 0.01) ?? info.parts[0];
    const q = applyAffine(part.transform, fu, fv);
    // the inside sheet image is stored mirrored, as the inside template shows it
    return { x: (surface === "inside" ? model.sheet.width - q.x : q.x) * k, y: q.y * k };
  };
}

const sourceAt = (f: SourceFace) => (u: number, v: number) => ({
  x: f.origin.x + f.right.x * u * f.width + f.down.x * v * f.height,
  y: f.origin.y + f.right.y * u * f.width + f.down.y * v * f.height,
});

beforeAll(() => {
  prepareModels(BOX_MODELS);
}, 60_000);

describe.each(FILES)("owner's dieline: $name", ({ file, surface }) => {
  let img: RgbaImage;
  let res: RecogniseResult;
  let truth: Partial<Record<FaceId, SourceFace>>;
  const mailer = generateDieline("FEFCO_0427", { L: 250, W: 180, H: 80 }, { thicknessMm: 1.5 });
  beforeAll(async () => {
    img = await decode(file);
    res = recognise(img, { models: BOX_MODELS, surface, target: mailer });
    truth = findFaces(faceLinesOf(res.lines.segments), surface === "inside") ?? {};
  }, 120_000);

  it("recognises the construction (hinged tuck lid, double end walls) with no fittings offered", () => {
    expect(res.found).toBe(true);
    expect(MAILERS).toContain(res.matches[0].code);
    expect(res.matches.filter((m) => MAILERS.includes(m.code)).length).toBeGreaterThanOrEqual(2);
    expect(res.matches.some((m) => m.code.startsWith("FEFCO_09"))).toBe(false);
    expect(res.matches[0].agreement ?? 0).toBeGreaterThan(0.85);
  });

  it("finds the six faces by topology and the fitted model's proportions agree within 2%", () => {
    for (const f of FACES) expect(truth[f], f).toBeTruthy();
    // the dims to apply, from the art's own panels after snapping: lid L / W and front H / L
    const d = res.matches[0].dims;
    const artLW = truth.top!.width / truth.top!.height;
    const artHL = truth.front!.height / truth.front!.width;
    // panels are the inner size plus a board allowance: compare on the art's panel sizes
    const m = candidateModelOf(res.matches[0].source, BOX_MODELS)!;
    const k = { L: d.L / m.dims.L, W: d.W / m.dims.W, H: d.H / m.dims.H };
    const top = m.faces.top!;
    const front = m.faces.front!;
    expect(Math.abs((top.width * k.L) / (top.height * k.W) / artLW - 1)).toBeLessThan(0.02);
    expect(Math.abs((front.height * k.H) / (front.width * k.L) / artHL - 1)).toBeLessThan(0.02);
  });

  for (const target of ["recognised", "FEFCO_0427"] as const) {
    it(`each closed face of the re-composed sheet (${target}) carries its own panel of the upload`, () => {
      const top = res.matches[0];
      const cand = candidateModelOf(top.source, BOX_MODELS)!;
      const m = BOX_MODELS.find((x) => x.code === top.code)!;
      const model = target === "FEFCO_0427" ? mailer : m.build(top.dims, { thicknessMm: thicknessOf(m) });
      const r = remapSheet(img, model, top.source, cand, { surface });
      const clean = paintOutLines(img, top.source.lines, top.source.lineWidthPx);
      expect(r.report.panels.filter((p) => p.via === "fill")).toEqual([]);
      for (const f of FACES) {
        const got = grid(r.image, targetAt(model, f, r.report.pxPerMm, surface));
        const want = grid(clean, sourceAt(truth[f]!));
        const c = compare(got, want);
        expect(c.meanDiff, `${f} mean colour`).toBeLessThan(14);
        expect(c.corr, `${f} correlation`).toBeGreaterThan(0.85);
      }
    }, 60_000);
  }

  it("keeps the die lines off the faces (the red strokes are painted out before sampling)", () => {
    const top = res.matches[0];
    const r = remapSheet(img, mailer, top.source, candidateModelOf(top.source, BOX_MODELS), { surface });
    const [lr, lg, lb] = [1, 3, 5].map((i) => parseInt(res.lines.colors[0].slice(i, i + 2), 16));
    // along the lid's front edge (the crease to the tuck), 1 mm inside the lid
    const info = mailer.faces.top!;
    let red = 0;
    for (let i = 1; i < 40; i++) {
      const p = targetAt(mailer, "top", r.report.pxPerMm, surface)(i / 40, 1 - 1 / info.height);
      const j = (Math.round(p.y) * r.image.width + Math.round(p.x)) * 4;
      if (Math.abs(r.image.data[j] - lr) + Math.abs(r.image.data[j + 1] - lg) + Math.abs(r.image.data[j + 2] - lb) < 60) red++;
    }
    expect(red).toBeLessThan(3);
  });
});

describe("inside print: mirrored reading", () => {
  it("a die that is the same both ways round is read as seen from the inside on the inside slot", async () => {
    const img = await decode(FILES[1].file);
    const res = recognise(img, { models: BOX_MODELS, surface: "inside", target: null });
    const T = res.matches[0].source.transform!;
    expect(mirrorSymmetric(candidateModelOf(res.matches[0].source, BOX_MODELS)!)).toBe(true);
    expect(T[0] * T[3] - T[1] * T[2]).toBeLessThan(0);
    const out = recognise(img, { models: BOX_MODELS, surface: "outside", target: null });
    const T2 = out.matches[0].source.transform!;
    expect(T2[0] * T2[3] - T2[1] * T2[2]).toBeGreaterThan(0);
  }, 120_000);
});

describe("synthetic dielines: remap across models", () => {
  const cases: [string, string][] = [
    ["FEFCO_0427", "FEFCO_0427"],
    ["FEFCO_0427", "FS_BAKERY_BOX"],
    ["FS_BAKERY_BOX", "FEFCO_0427"],
    ["FEFCO_0421", "FEFCO_0427"],
  ];
  it.each(cases)("art drawn on %s, re-composed on %s: every face from the same face", (from, to) => {
    const src = BOX_MODELS.find((m) => m.code === from)!;
    const dims = src.defaultDims;
    const { img, T } = renderDieline(src, dims, { pxPerMm: 2.2, orientation: 0, rotDeg: 0, line: [220, 30, 40], lineWidth: 2, seed: 11, margin: 30 });
    const res = recognise(img, { models: BOX_MODELS, surface: "outside", target: null });
    const top = res.matches.find((m) => m.code === from) ?? res.matches[0];
    const cand = candidateModelOf(top.source, BOX_MODELS)!;
    const dst = BOX_MODELS.find((m) => m.code === to)!;
    const target = dst.build(dst.defaultDims, { thicknessMm: thicknessOf(dst) });
    const r = remapSheet(img, target, top.source, cand, { surface: "outside" });
    // ground truth: the source model's own faces through the synthetic placement
    const srcModel = src.build(dims, { thicknessMm: thicknessOf(src) });
    const die: Affine = [1, 0, 0, 1, -srcModel.dieBounds.x, -srcModel.dieBounds.y];
    for (const f of ["top", "front", "left"] as FaceId[]) {
      const info = srcModel.faces[f]!;
      const want = grid(img, (u, v) => {
        const fu = u * info.width;
        const fv = v * info.height;
        const part = info.parts.find((p) => fu >= p.rect.x - 0.01 && fu <= p.rect.x + p.rect.width + 0.01 && fv >= p.rect.y - 0.01 && fv <= p.rect.y + p.rect.height + 0.01) ?? info.parts[0];
        const q = applyAffine(part.transform, fu, fv);
        const d = applyAffine(die, q.x, q.y);
        return applyAffine(T, d.x, d.y);
      }, 0.14);
      const got = grid(r.image, targetAt(target, f, r.report.pxPerMm, "outside"), 0.14);
      const c = compare(got, want);
      expect(c.corr, `${f} correlation`).toBeGreaterThan(0.8);
      expect(c.meanDiff, `${f} mean colour`).toBeLessThan(20);
    }
  }, 60_000);
});
