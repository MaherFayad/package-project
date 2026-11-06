/**
 * Smaller WebP variants of the marketing images for srcset (PERF-16): renders -> 400w,
 * samples -> 320w, designer screenshots -> 720w. Idempotent; prints the native widths that
 * src/components/marketing/assets.ts uses as srcset descriptors.
 *   node scripts/marketing/responsive-variants.cjs
 */
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const root = path.join(__dirname, "../../public/marketing");
const jobs = [
  { dir: "renders", w: 400 },
  { dir: "samples", w: 320 },
  { dir: ".", w: 720, only: /^designer-(ar|en)\.webp$/ },
  // R2-MK-04: the wide box renders (home hero poster, /boxes/[structure] hero: the phone LCP
  // images) also get a 720w step, so a 390px DPR 2 phone downloads about 25 KB instead of 30-40 KB.
  { dir: "renders", w: 720, only: /^(fefco-0201|fefco-0320|fefco-0422|fefco-0427|pizza|rigid-box|sleeve)\.webp$/, quality: 78 },
];

(async () => {
  const widths = {};
  for (const j of jobs) {
    const dir = path.join(root, j.dir);
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".webp") || /\.\d+w\.webp$/.test(f) || (j.only && !j.only.test(f))) continue;
      const src = path.join(dir, f);
      const meta = await sharp(src).metadata();
      widths[path.posix.join(j.dir, f)] = meta.width;
      if (meta.width <= j.w) continue; // already small: no variant
      const out = src.replace(/\.webp$/, `.${j.w}w.webp`);
      await sharp(src).resize({ width: j.w }).webp({ quality: j.quality ?? 80, effort: 6 }).toFile(out);
      console.log(`${path.relative(root, out)}  ${(fs.statSync(out).size / 1024).toFixed(1)} KB (from ${(fs.statSync(src).size / 1024).toFixed(1)} KB)`);
    }
  }
  console.log(JSON.stringify(widths));
})();
