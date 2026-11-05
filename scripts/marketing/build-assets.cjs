/**
 * Trim the raw 3D captures (capture-renders.cjs) and build the marketing images:
 *   public/marketing/renders/<id>.webp  transparent, trimmed product renders (cards, hero poster)
 *   public/marketing/samples/<n>.webp   "studio photo" tiles: render on a tinted backdrop + floor shadow
 * Usage: node scripts/marketing/build-assets.cjs <raw-capture-dir>
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const raw = process.argv[2];
const OUT = path.join(__dirname, "../../public/marketing");
fs.mkdirSync(path.join(OUT, "renders"), { recursive: true });
fs.mkdirSync(path.join(OUT, "samples"), { recursive: true });

const SAMPLES = [
  ["fefco-0427", "#dfe9e1", "#c9d9cd"],
  ["jar", "#f6e7cf", "#ead3ad"],
  ["pizza", "#f3ddd6", "#e6c4b8"],
  ["ecma-rte", "#ece6f3", "#d8cfe6"],
  ["rigid-box", "#e4e4e0", "#cfcfc8"],
  ["dropper", "#e8eef4", "#cfdbe6"],
  ["gable-box", "#dce6f0", "#c2d3e4"],
  ["fefco-0201", "#efe6d8", "#e0d1b8"],
  ["can", "#e6efe0", "#cddfc2"],
  ["ecma-ste", "#f4efe2", "#e6dcc3"],
  ["paper-tube", "#efe1e6", "#e2c9d2"],
  ["pump", "#e9ecef", "#d3d9de"],
];

(async () => {
  for (const f of fs.readdirSync(raw).filter((x) => x.endsWith(".png"))) {
    const id = f.replace(/\.png$/, "");
    const img = sharp(path.join(raw, f)).trim({ threshold: 1 });
    const buf = await img.png().toBuffer();
    const meta = await sharp(buf).metadata();
    // pad 4% so the soft contact shadow is not clipped
    const pad = Math.round(Math.max(meta.width, meta.height) * 0.04);
    await sharp(buf)
      .extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .resize({ width: 960, height: 960, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 86, alphaQuality: 90 })
      .toFile(path.join(OUT, "renders", `${id}.webp`));
    console.log("render", id, meta.width, meta.height);
  }
  let n = 1;
  for (const [id, top, bottom] of SAMPLES) {
    const W = 640, H = 800;
    const bg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="0.68" stop-color="${top}"/><stop offset="0.68" stop-color="${bottom}"/><stop offset="1" stop-color="${bottom}"/></linearGradient>
        <radialGradient id="l" cx="0.3" cy="0.15" r="0.9"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
        <radialGradient id="s" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#000" stop-opacity=".22"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="url(#g)"/>
      <rect width="${W}" height="${H}" fill="url(#l)"/>
      <ellipse cx="${W / 2}" cy="${H * 0.74}" rx="${W * 0.36}" ry="${H * 0.045}" fill="url(#s)"/>
    </svg>`);
    const prod = await sharp(path.join(OUT, "renders", `${id}.webp`)).resize({ width: Math.round(W * 0.84), height: Math.round(H * 0.66), fit: "inside" }).toBuffer();
    const pm = await sharp(prod).metadata();
    await sharp(bg)
      .composite([{ input: prod, left: Math.round((W - pm.width) / 2), top: Math.round(H * 0.77 - pm.height) }])
      .webp({ quality: 82 })
      .toFile(path.join(OUT, "samples", `sample-${String(n).padStart(2, "0")}.webp`));
    n++;
  }
  console.log("samples", n - 1);
})();
