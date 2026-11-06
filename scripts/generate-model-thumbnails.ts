/**
 * Writes one SVG thumbnail per library model to public/models/<slug>.svg, drawn from the real
 * fold model (boxes) or lathe profile (containers). Run: npx tsx scripts/generate-model-thumbnails.ts
 */
import fs from "node:fs";
import path from "node:path";
import { MODELS } from "../src/lib/library";
import { modelThumbnailSvg } from "../src/lib/library/thumbnail";

const out = path.resolve("public/models");
fs.mkdirSync(out, { recursive: true });
let n = 0;
for (const m of MODELS) {
  try {
    fs.writeFileSync(path.join(out, `${m.slug}.svg`), modelThumbnailSvg(m));
    n++;
  } catch (e) {
    console.error(`thumbnail failed for ${m.code}: ${(e as Error).message}`);
    process.exitCode = 1;
  }
}
console.log(`wrote ${n} thumbnails to ${out}`);

// Manifest for the per-model e2e test (e2e/models.spec.ts); a unit test keeps it in sync.
const manifest = MODELS.map((m) => ({ code: m.code, slug: m.slug, kind: m.kind }));
fs.writeFileSync(path.resolve("e2e/fixtures/models.json"), JSON.stringify(manifest, null, 1) + "\n");
console.log(`wrote e2e/fixtures/models.json (${manifest.length} models)`);
