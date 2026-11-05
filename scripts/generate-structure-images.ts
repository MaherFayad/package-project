/**
 * Catalogue thumbnails for the structure-library styles, drawn from the real fold model
 * (src/lib/dieline), so the picture matches the 3D view and the die.
 * Run: npx tsx scripts/generate-structure-images.ts   (writes public/seed/structures/<slug>.svg)
 * The first six structures keep their hand-drawn thumbnails from generate-seed-images.mjs.
 */
import fs from "node:fs";
import path from "node:path";
import type { StructureCode, StructureFeatures } from "../src/types";
import { BOARD_SPECS, STRUCTURES, defaultMaterialFor, generateDieline, structureIllustrationSvg } from "../src/lib/dieline";

const out = path.resolve("public/seed/structures");
fs.mkdirSync(out, { recursive: true });

const KRAFT = "#c49a6c";
const KRAFT_IN = "#b58a5c";
const WHITE = "#ffffff";

const jobs: { code: StructureCode; features?: StructureFeatures; progress?: number; yaw?: number; colors: [string, string] }[] = [
  { code: "FEFCO_0320", features: { lidHeightMm: 45 }, colors: [KRAFT, KRAFT_IN] },
  { code: "ECMA_CLB", colors: [WHITE, "#ece9e2"] },
  { code: "ECMA_SLB", colors: [WHITE, "#ece9e2"] },
  { code: "FEFCO_0422", features: { displayFront: true }, colors: [KRAFT, KRAFT_IN] },
  { code: "GABLE_BOX", colors: [WHITE, "#ece9e2"] },
  { code: "PAPER_TUBE", colors: ["#f4f1ea", KRAFT_IN] },
  { code: "RIGID_BOX", colors: ["#2b2b2b", "#ece6da"] },
];

for (const j of jobs) {
  const def = STRUCTURES[j.code];
  const model = generateDieline(j.code, def.defaultDims, { thicknessMm: BOARD_SPECS[defaultMaterialFor(j.code)].thicknessMm, features: j.features });
  const svg = structureIllustrationSvg(model, { outside: j.colors[0], inside: j.colors[1], progress: j.progress ?? 1, yawDeg: j.yaw ?? 35, title: def.name.en });
  fs.writeFileSync(path.join(out, `${def.slug}.svg`), svg + "\n");
  console.log("wrote", def.slug);
}
