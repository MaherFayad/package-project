/**
 * AVIF copies of the hero renders that are an LCP image (home hero poster, /boxes/[structure]
 * and size-page heroes): the original and its 400w / 720w steps (R4-MK-06). AVIF is about 45%
 * of the WebP bytes at the same look (720w: ~11 KB vs ~25 KB), which matters on Slow 4G where
 * the image shares the pipe with the render-blocking CSS and the font preloads.
 * Served through <picture><source type="image/avif">, so browsers without AVIF keep the WebP.
 * Idempotent; run after scripts/marketing/responsive-variants.cjs.
 *   node scripts/marketing/avif-heroes.cjs
 */
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const dir = path.join(__dirname, "../../public/marketing/renders");
(async () => {
  for (const f of fs.readdirSync(dir)) {
    if (!/^[a-z0-9-]+(\.\d+w)?\.webp$/.test(f)) continue;
    const src = path.join(dir, f);
    const out = src.replace(/\.webp$/, ".avif");
    // Encode from the full-size WebP (the variants are resized from it) to avoid double loss.
    const base = path.join(dir, f.replace(/\.\d+w\.webp$/, ".webp"));
    const w = (await sharp(src).metadata()).width;
    await sharp(base).resize({ width: w }).avif({ quality: 55, effort: 6 }).toFile(out);
    console.log(`${f} -> ${path.basename(out)}  ${(fs.statSync(out).size / 1024).toFixed(1)} KB (webp ${(fs.statSync(src).size / 1024).toFixed(1)} KB)`);
  }
})();
