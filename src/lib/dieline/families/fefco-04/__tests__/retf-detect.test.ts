import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { BOX_MODELS } from "@/lib/library";
import { detectDieline, prepareModels, readImageDpi, type RgbaImage } from "@/components/designer/lib/dielineDetect";

/**
 * The owner's mailer dielines (docs/owner-input/2026-11-10 and the detector fixture, drawn upside
 * down) must come back as the RETF mailer, top-1, at the owner's proportions (L:W:H about 0.98 : 1 : 0.32).
 * Scores are recorded in docs/audit/gift-box-tuck-front.md (scripts/detect-owner-dielines.ts).
 */
const ROOT = path.join(__dirname, "..", "..", "..", "..", "..", "..");
const FILES = [
  "src/components/designer/lib/dielineDetect/__fixtures__/owner-mailer-sample.jpg",
  "docs/owner-input/2026-11-10/dieline-inside-pink.webp",
  "docs/owner-input/2026-11-10/dieline-outside-purple.webp",
];

async function decode(file: string): Promise<RgbaImage> {
  const sharp = (await import("sharp")).default;
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), width: info.width, height: info.height };
}

beforeAll(() => {
  prepareModels(BOX_MODELS);
}, 60_000);

describe("dieline detector on the owner's mailer files", () => {
  it.each(FILES)("%s → MAILER_RETF", async (rel) => {
    const file = path.join(ROOT, rel);
    const res = detectDieline(await decode(file), { models: BOX_MODELS, dpi: readImageDpi(new Uint8Array(readFileSync(file))), maxCandidates: 5 });
    expect(res.found).toBe(true);
    const [top, second] = res.candidates;
    expect(top.code).toBe("MAILER_RETF");
    expect(top.score - second.score).toBeGreaterThan(0.02);
    const { L, W, H } = top.proportions;
    expect(L / W).toBeGreaterThan(0.94);
    expect(L / W).toBeLessThan(1.02);
    expect(H / W).toBeGreaterThan(0.29);
    expect(H / W).toBeLessThan(0.35);
  }, 60_000);
});
