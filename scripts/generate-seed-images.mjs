// Generates local placeholder SVG images for seed data under public/seed/.
// Run: node scripts/generate-seed-images.mjs   (output is committed; no hotlinking)
import fs from "node:fs";
import path from "node:path";

const out = path.resolve("public/seed");
fs.mkdirSync(path.join(out, "portfolio"), { recursive: true });
fs.mkdirSync(path.join(out, "vendors"), { recursive: true });
fs.mkdirSync(path.join(out, "structures"), { recursive: true });

const vendors = [
  { slug: "nile-pack", mono: "NP", color: "#0b6e4f", accent: "#f2c14e" },
  { slug: "delta-cartons", mono: "DC", color: "#1d3557", accent: "#e63946" },
  { slug: "obour-box-works", mono: "OB", color: "#6b4226", accent: "#f4a261" },
  { slug: "alex-print-house", mono: "AP", color: "#005f73", accent: "#94d2bd" },
  { slug: "damietta-packaging", mono: "DP", color: "#7b2cbf", accent: "#ffd166" },
  { slug: "cairo-label-flex", mono: "CL", color: "#9d0208", accent: "#ffba08" },
];

const KRAFT = "#c49a6c";
const KRAFT_DARK = "#a77b4f";
const KRAFT_SIDE = "#b58a5c";

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, Math.round(((n >> 16) & 255) * f)));
  const g = Math.min(255, Math.max(0, Math.round(((n >> 8) & 255) * f)));
  const b = Math.min(255, Math.max(0, Math.round((n & 255) * f)));
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/** Isometric closed box. */
function isoBox({ w, d, h, top, left, right, cx = 400, cy = 330, decor = "" }) {
  const c = Math.cos(Math.PI / 6), s = Math.sin(Math.PI / 6);
  const p = (x, y, z) => [cx + (x - y) * c, cy + (x + y) * s - z];
  const P = (...pts) => pts.map((q) => q.join(",")).join(" ");
  const A = p(0, 0, h), B = p(w, 0, h), C = p(w, d, h), D = p(0, d, h);
  const E = p(w, 0, 0), F = p(w, d, 0), G = p(0, d, 0);
  return `
  <polygon points="${P(A, B, C, D)}" fill="${top}"/>
  <polygon points="${P(D, C, F, G)}" fill="${left}"/>
  <polygon points="${P(C, B, E, F)}" fill="${right}"/>
  <g stroke="rgba(0,0,0,.18)" stroke-width="1.5" fill="none">
    <polyline points="${P(A, B, C, D, A)}"/><polyline points="${P(D, G, F, C)}"/><polyline points="${P(B, E, F)}"/>
  </g>${decor}`;
}

function portfolioSvg(v, i) {
  const styles = [
    // mailer box, printed brand colour outside
    () => isoBox({ w: 260, d: 200, h: 90, top: v.color, left: shade(v.color, 0.8), right: shade(v.color, 0.65),
      decor: `<circle cx="400" cy="210" r="34" fill="${v.accent}" opacity=".95"/>` }),
    // kraft shipping box with one-colour print
    () => isoBox({ w: 220, d: 220, h: 200, top: KRAFT, left: KRAFT_SIDE, right: KRAFT_DARK, cy: 380,
      decor: `<rect x="372" y="122" width="56" height="12" rx="3" fill="${v.color}" transform="skewX(0)"/>` }),
    // white folding carton
    () => isoBox({ w: 120, d: 80, h: 240, top: "#ffffff", left: "#f1f1f1", right: "#e3e3e3", cy: 420,
      decor: `<rect x="300" y="300" width="70" height="70" rx="35" fill="${v.color}" opacity=".9"/>` }),
  ];
  const body = styles[i % styles.length]();
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600" role="img">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7f7f7"/><stop offset="1" stop-color="#e3e3e3"/></linearGradient></defs>
  <rect width="800" height="600" fill="url(#bg)"/>
  <ellipse cx="400" cy="520" rx="260" ry="34" fill="rgba(0,0,0,.08)"/>
  ${body}
</svg>\n`;
}

function logoSvg(v) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160" role="img">
  <rect width="160" height="160" rx="32" fill="${v.color}"/>
  <path d="M40 60 L80 40 L120 60 L120 108 L80 128 L40 108 Z" fill="none" stroke="${v.accent}" stroke-width="6" stroke-linejoin="round"/>
  <path d="M40 60 L80 80 L120 60 M80 80 L80 128" fill="none" stroke="${v.accent}" stroke-width="6" stroke-linejoin="round"/>
</svg>\n`;
}

for (const v of vendors) {
  fs.writeFileSync(path.join(out, "vendors", `${v.slug}.svg`), logoSvg(v));
  for (let i = 0; i < 3; i++) {
    fs.writeFileSync(path.join(out, "portfolio", `${v.slug}-${i + 1}.svg`), portfolioSvg(v, i + vendors.indexOf(v)));
  }
}

// Structure thumbnails (neutral kraft / white)
const structures = {
  "mailer-box": { w: 260, d: 200, h: 80, top: KRAFT, left: KRAFT_SIDE, right: KRAFT_DARK },
  "shipping-box": { w: 220, d: 220, h: 200, top: KRAFT, left: KRAFT_SIDE, right: KRAFT_DARK, cy: 380 },
  "reverse-tuck-end": { w: 120, d: 80, h: 240, top: "#ffffff", left: "#f1f1f1", right: "#e3e3e3", cy: 420 },
  "straight-tuck-end": { w: 140, d: 90, h: 220, top: "#ffffff", left: "#f1f1f1", right: "#e3e3e3", cy: 410 },
  "pizza-box": { w: 300, d: 300, h: 40, top: "#ffffff", left: "#ebebeb", right: "#dcdcdc", cy: 300 },
  sleeve: { w: 240, d: 160, h: 70, top: "#ffffff", left: "#f1f1f1", right: "#e3e3e3", cy: 320 },
};
for (const [slug, b] of Object.entries(structures)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600" role="img">
  <rect width="800" height="600" fill="#f7f7f7"/>
  <ellipse cx="400" cy="520" rx="260" ry="34" fill="rgba(0,0,0,.07)"/>
  ${isoBox(b)}
</svg>\n`;
  fs.writeFileSync(path.join(out, "structures", `${slug}.svg`), svg);
}
console.log("seed images written to", out);
