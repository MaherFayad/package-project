/**
 * Runs the dieline detector on the owner's mailer files and prints the top candidates.
 *   npx tsx scripts/detect-owner-mailers.ts            (every box model)
 *   npx tsx scripts/detect-owner-mailers.ts CODE ...   (only these models)
 * Numbers are quoted in docs/audit/mailers.md.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { BOX_MODELS } from "@/lib/library";
import { detectDieline, prepareModels, readImageDpi, type RgbaImage } from "@/components/designer/lib/dielineDetect";

const FILES = [
  "src/components/designer/lib/dielineDetect/__fixtures__/owner-mailer-sample.jpg",
  "docs/owner-input/2026-11-10/dieline-inside-pink.webp",
  "docs/owner-input/2026-11-10/dieline-outside-purple.webp",
];

async function decode(file: string): Promise<RgbaImage> {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), width: info.width, height: info.height };
}

async function main() {
  const only = process.argv.slice(2);
  const models = only.length ? BOX_MODELS.filter((m) => only.includes(m.code)) : BOX_MODELS;
  prepareModels(models);
  for (const f of FILES) {
    const abs = path.resolve(f);
    const img = await decode(abs);
    const t0 = Date.now();
    const res = detectDieline(img, { models, dpi: readImageDpi(new Uint8Array(readFileSync(abs))), maxCandidates: 6 });
    console.log(`\n${path.basename(f)} ${img.width}x${img.height} found=${res.found} ${Date.now() - t0} ms`);
    for (const c of res.candidates) {
      const p = c.proportions;
      console.log(`  ${c.code.padEnd(18)} ${c.score.toFixed(3)}  L:W:H = ${(p.L / p.W).toFixed(3)} : 1 : ${(p.H / p.W).toFixed(3)}  dims ${c.dims.L}x${c.dims.W}x${c.dims.H}`);
    }
  }
}

void main();
