/**
 * Writes src/data/catalogue/picker-rows.generated.json: the designer-ready catalogue rows the
 * in-app picker needs (no generators), so the picker chunk stays small (PERF-04).
 *   npx tsx scripts/generate-catalogue-rows.ts
 */
import fs from "node:fs";
import path from "node:path";
import { CATALOGUE } from "../src/data/catalogue";

const rows = CATALOGUE.filter((e) => e.designer).map((e) => ({
  code: e.code,
  slug: e.slug,
  name: e.name,
  family: e.family,
  subFamily: e.subFamily,
  standard: e.standard,
  availableInEgypt: e.availableInEgypt,
}));
fs.writeFileSync(path.resolve("src/data/catalogue/picker-rows.generated.json"), JSON.stringify(rows) + "\n");
console.log(`wrote ${rows.length} picker rows`);
