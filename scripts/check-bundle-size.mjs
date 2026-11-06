#!/usr/bin/env node
/**
 * Bundle size budget (docs/audit/performance.md: non-3D JS < 200 KB gzip).
 *
 * Reads the production build (`next build` first) and computes the first-load JavaScript of every
 * App Router page: the root main files, plus the chunks of every layout / template / loading /
 * error / not-found entry on the page's path, plus the page itself, counted once each and gzipped
 * at level 9. Pages that render the 3D viewer are listed in THREE_D and are reported but not
 * gated. Exits 1 when a non-3D page is over budget, or when a page outside THREE_D ships three.js.
 *
 * Usage: node scripts/check-bundle-size.mjs [--dir .next] [--budget-kb 200] [--json]
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const dir = opt("--dir", process.env.NEXT_DIST_DIR || ".next");
const budgetKb = Number(opt("--budget-kb", "200"));
const asJson = args.includes("--json");

/** Routes allowed to ship the 3D engine (designer, share viewer, dev tools). Regexes on the entry key. */
export const THREE_D = [
  /^\/\[locale\]\/design(\/|$)/,
  /^\/\[locale\]\/s\//,
  /^\/\[locale\]\/dev\//,
];

const THREE_SIGNATURE = /WebGLRenderer|__r3f|useFrame must be called/;

const appManifest = path.join(dir, "app-build-manifest.json");
if (!fs.existsSync(appManifest)) {
  console.error(`[size] ${appManifest} not found: run \`npm run build\` first.`);
  process.exit(2);
}
const pages = JSON.parse(fs.readFileSync(appManifest, "utf8")).pages;
const rootMain = JSON.parse(fs.readFileSync(path.join(dir, "build-manifest.json"), "utf8")).rootMainFiles ?? [];

const cache = new Map();
function chunk(file) {
  if (cache.has(file)) return cache.get(file);
  const p = path.join(dir, file);
  let r = null;
  if (fs.existsSync(p)) {
    const buf = fs.readFileSync(p);
    r = { gz: zlib.gzipSync(buf, { level: 9 }).length, three: THREE_SIGNATURE.test(buf.toString("utf8")) };
  }
  cache.set(file, r);
  return r;
}

const SEGMENT_FILES = ["layout", "template", "loading", "error", "not-found"];
const results = [];
for (const key of Object.keys(pages)) {
  if (!key.endsWith("/page")) continue;
  const segs = key.split("/").slice(1, -1); // drop "" and "page"
  const entries = [key];
  for (let i = 0; i <= segs.length; i++) {
    const base = "/" + segs.slice(0, i).join("/");
    for (const f of SEGMENT_FILES) entries.push(`${base === "/" ? "" : base}/${f}`);
  }
  const files = new Set(rootMain);
  for (const e of entries) for (const f of pages[e] ?? []) if (f.endsWith(".js")) files.add(f);
  let gz = 0;
  let three = false;
  for (const f of files) {
    const c = chunk(f);
    if (!c) continue;
    gz += c.gz;
    three ||= c.three;
  }
  const is3d = THREE_D.some((r) => r.test(key));
  const kb = Math.round((gz / 1024) * 10) / 10;
  const problems = [];
  if (!is3d && kb > budgetKb) problems.push(`over budget (${kb} KB > ${budgetKb} KB)`);
  if (!is3d && three) problems.push("ships three.js / r3f on a non-3D route");
  results.push({ route: key.replace(/\/page$/, "") || "/", kb, is3d, three, problems });
}
results.sort((a, b) => b.kb - a.kb);
const failed = results.filter((r) => r.problems.length);

if (asJson) {
  console.log(JSON.stringify({ budgetKb, results }, null, 1));
} else {
  const w = Math.max(...results.map((r) => r.route.length));
  console.log(`First-load JS per page (gzip -9), budget ${budgetKb} KB for non-3D pages\n`);
  for (const r of results) {
    const flag = r.problems.length ? "FAIL" : r.is3d ? " 3D " : " ok ";
    console.log(`${flag}  ${r.route.padEnd(w)}  ${String(r.kb).padStart(6)} KB${r.problems.length ? "  " + r.problems.join("; ") : ""}`);
  }
}
if (failed.length) {
  console.error(`\n[size] ${failed.length} page(s) over the non-3D budget.`);
  process.exit(1);
}
if (!asJson) console.log(`\n[size] all ${results.filter((r) => !r.is3d).length} non-3D pages within ${budgetKb} KB.`);
