#!/usr/bin/env node
/**
 * R6 marketing assets: regenerates everything under public/marketing/r6/ from OUR engine, model
 * library and UI (no stock photos, no generated people, nothing from third-party sites).
 *
 *   node scripts/marketing/render-assets.mjs [--only=renders,collage,cards,loops,ui] [--base=http://localhost:3520]
 *
 * Without --base it copies scripts/marketing/r6/CapturePage.tsx to src/app/[locale]/dev/r6-capture/page.tsx,
 * starts `next dev -p 3520` (needs ELBA_DATABASE_URL, a pushed + seeded DB for the ui stage), and removes
 * the route again when done. Raw PNG captures are cached in $TMPDIR/elba-r6-raw (--fresh to re-render).
 * Requires ffmpeg (libvpx-vp9 + libx264) for the loops stage. After it runs, check the size report and
 * src/components/marketing/kit/assets.ts (paths/sizes are regenerated into assets.generated.json).
 *
 * Stages
 *   renders  hero studio stills (dark + light, three-quarter + front) and transparent cutouts
 *   collage  cutouts at varied angles + "process" pieces (flat dieline, swatch card, price badge, phone)
 *   cards    8 tall brand sample cards for the card fan
 *   loops    5 seamless turntable loops (1080p + 720p, webm VP9 + mp4 H.264, poster frames)
 *   ui       framed, high-DPI screenshots of the real UI in ar and en (see render-ui.mjs)
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(ROOT, "public/marketing/r6");
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")).map(([k, v]) => [k, v ?? true]));
const ONLY = new Set(String(args.only ?? "renders,collage,cards,loops,ui").split(","));
const RAW = args.raw ? path.resolve(String(args.raw)) : path.join(os.tmpdir(), "elba-r6-raw");
const PORT = 3520;
let BASE = args.base ? String(args.base) : `http://localhost:${PORT}`;
const ROUTE = path.join(ROOT, "src/app/[locale]/dev/r6-capture/page.tsx");
fs.mkdirSync(RAW, { recursive: true });

// ---------------------------------------------------------------------------------------------
// shot list (ids match SHOTS in r6/CapturePage.tsx)
const HERO = ["mailer", "rigid-box", "drawer-box", "tuck-carton", "perfume", "bottle", "jar", "can", "tube", "pouch", "coffee-bag", "cup", "dropper", "tea-tin"];
const VESSEL_SHOTS = new Set(["perfume", "bottle", "jar", "can", "tube", "pouch", "coffee-bag", "cup", "dropper", "tea-tin"]);
const COLLAGE = [
  { id: "mailer-tilt", shot: "mailer", az: -28, polar: 14 },
  { id: "rigid-box-high", shot: "rigid-box", az: 40, polar: 18 },
  { id: "drawer-box-side", shot: "drawer-box", az: -55, polar: 6 },
  { id: "tuck-carton-turn", shot: "tuck-carton", az: 70, polar: 0 },
  { id: "perfume-turn", shot: "perfume", az: -35, polar: -4 },
  { id: "can-turn", shot: "can", az: 50, polar: 6 },
  { id: "pouch-turn", shot: "pouch", az: -30, polar: 4 },
  { id: "jar-high", shot: "jar", az: 25, polar: 22 },
  { id: "cup-turn", shot: "cup", az: -45, polar: 10 },
  { id: "tube-turn", shot: "tube", az: 35, polar: 8 },
];
const LOOPS = ["mailer", "perfume", "can", "pouch", "rigid-box"];
const LOOP_ZOOM = { mailer: 1, "rigid-box": 1, perfume: 0.92, can: 0.92, pouch: 0.92 };
export const CARDS = [
  { id: "nour", shot: "mailer", latin: "NOUR", arabic: "نور", bg: "#c9572f", ink: "#fff3e4", en: "Atelier mailer", ar: "علبة شحن أتيليه" },
  { id: "attar", shot: "rigid-box", latin: "ATTAR", arabic: "عطار", bg: "#14161c", ink: "#e9cf8f", en: "Perfume gift box", ar: "علبة هدايا عطور" },
  { id: "halawa", shot: "drawer-box", latin: "Halawa", arabic: "حلاوة", bg: "#f1c9c2", ink: "#7a1f2b", en: "Sweets drawer box", ar: "علبة درج حلويات" },
  { id: "waraqa", shot: "tuck-carton", latin: "Waraqa", arabic: "ورقة", bg: "#1f4d3a", ink: "#f4ead2", en: "Tea carton", ar: "كرتونة شاي" },
  { id: "sahwa", shot: "pouch", latin: "SAHWA", arabic: "صحوة", bg: "#2b1a12", ink: "#f3e3c7", en: "Coffee pouch", ar: "كيس قهوة" },
  { id: "nada", shot: "jar", latin: "NADA", arabic: "ندى", bg: "#e8efe6", ink: "#25443a", en: "Skin care jar", ar: "برطمان عناية بالبشرة" },
  { id: "sahwa-can", shot: "can", latin: "SAHWA", arabic: "صحوة", bg: "#d08a3c", ink: "#2b1a12", en: "Cold brew can", ar: "علبة قهوة باردة" },
  { id: "attar-perfume", shot: "perfume", latin: "ATTAR", arabic: "عطار", bg: "#3a2f22", ink: "#e9cf8f", en: "Perfume bottle label", ar: "ملصق زجاجة عطر" },
];

// ---------------------------------------------------------------------------------------------
// helpers
const manifest = { generatedAt: new Date().toISOString(), files: {}, bases: {} };
const MANIFEST_FILE = path.join(ROOT, "scripts/marketing/r6/size-report.json");
const SIZES_TS = path.join(ROOT, "src/components/marketing/kit/assets.generated.ts");
if (fs.existsSync(MANIFEST_FILE)) {
  const prev = JSON.parse(fs.readFileSync(MANIFEST_FILE, "utf8"));
  Object.assign(manifest.files, prev.files);
  Object.assign(manifest.bases, prev.bases);
}
const rel = (f) => "/" + path.relative(path.join(ROOT, "public"), f).split(path.sep).join("/");
function record(file, w, h) {
  manifest.files[rel(file)] = { w, h, bytes: fs.statSync(file).size };
}

/** Write <base>.avif / .webp at 1x and <base>@2x.* at 2x. `img` is a sharp-able buffer at (>=) 2x size. */
async function emit(img, base, w1, h1, { alpha = false, q = 82 } = {}) {
  fs.mkdirSync(path.dirname(base), { recursive: true });
  manifest.bases[path.relative(OUT, base).split(path.sep).join("/")] = [w1, h1];
  for (const [suffix, k] of [["", 1], ["@2x", 2]]) {
    const w = w1 * k, h = h1 * k;
    const px = await sharp(img).resize(w, h, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
    // budget: try quality steps until under 120 KB (2x) / 60 KB (1x)
    const budget = k === 2 ? 120_000 : 60_000;
    for (const fmt of ["avif", "webp"]) {
      const file = `${base}${suffix}.${fmt}`;
      for (let qq = q; qq >= 36; qq -= 8) {
        const s = sharp(px);
        const buf = fmt === "avif" ? await s.avif({ quality: qq - 12, effort: 5 }).toBuffer() : await s.webp({ quality: qq, alphaQuality: alpha ? 80 : 100, effort: 5 }).toBuffer();
        fs.writeFileSync(file, buf);
        if (buf.length <= budget) break;
      }
      record(file, w, h);
    }
  }
}

/** Crop to the product and the engine's own soft contact shadow (bbox of pixels with alpha > 8). */
async function trim(png, padFrac = 0.03) {
  const { data, info } = await sharp(png).ensureAlpha().extractChannel(3).raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1;
  for (let y = 0; y < info.height; y++)
    for (let x = 0; x < info.width; x++)
      if (data[y * info.width + x] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < 0) throw new Error("empty capture");
  const t = await sharp(png).extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 }).png().toBuffer();
  const m = await sharp(t).metadata();
  const pad = Math.round(Math.max(m.width, m.height) * padFrac);
  return sharp(t).extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
}

function studioSvg(W, H, tone) {
  const dark = tone === "dark";
  const [c0, c1, floor] = dark ? ["#34302c", "#0d0d0d", "#1a1816"] : ["#f7f6f3", "#d9d8d3", "#e4e3de"];
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <radialGradient id="bg" cx="0.5" cy="0.34" r="0.85"><stop offset="0" stop-color="${c0}"/><stop offset="1" stop-color="${c1}"/></radialGradient>
      <linearGradient id="fl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${floor}" stop-opacity="0"/><stop offset="1" stop-color="${floor}" stop-opacity="${dark ? 0.9 : 0.7}"/></linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    <rect y="${H * 0.62}" width="${W}" height="${H * 0.38}" fill="url(#fl)"/>
  </svg>`);
}
function shadowSvg(W, H, cx, cy, rx, dark) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs><radialGradient id="s"><stop offset="0" stop-color="#000" stop-opacity="${dark ? 0.75 : 0.32}"/><stop offset="0.55" stop-color="#000" stop-opacity="${dark ? 0.35 : 0.14}"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
    <radialGradient id="g"><stop offset="0" stop-color="#fff" stop-opacity="${dark ? 0.07 : 0}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
    <ellipse cx="${cx}" cy="${cy}" rx="${rx * 1.9}" ry="${rx * 0.42}" fill="url(#g)"/>
    <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${rx * 0.11}" fill="url(#s)"/>
  </svg>`);
}

/** Product cutout on a studio backdrop with a soft contact shadow. */
async function studio(cutout, W, H, tone, { fillW = 0.8, fillH = 0.7, floorY = 0.82 } = {}) {
  const prod = await sharp(cutout).resize({ width: Math.round(W * fillW), height: Math.round(H * fillH), fit: "inside" }).toBuffer();
  const pm = await sharp(prod).metadata();
  const left = Math.round((W - pm.width) / 2);
  const top = Math.round(H * floorY - pm.height);
  // the cutout carries the engine's contact shadow; add only a faint floor glow (dark) / soft ambient pool (light)
  const sh = shadowSvg(W, H, W / 2, H * floorY - pm.height * 0.06, pm.width * 0.42, tone === "dark");
  return sharp(studioSvg(W, H, tone)).composite([{ input: sh }, { input: prod, left, top }]).png().toBuffer();
}

// ---------------------------------------------------------------------------------------------
// server + capture
let server = null;
async function startServer() {
  if (args.base) return;
  fs.mkdirSync(path.dirname(ROUTE), { recursive: true });
  fs.copyFileSync(path.join(ROOT, "scripts/marketing/r6/CapturePage.tsx"), ROUTE);
  try {
    await fetch(`${BASE}/en`);
    console.log("using running server on", BASE);
    return;
  } catch {}
  server = spawn("npx", ["next", "dev", "-p", String(PORT)], { cwd: ROOT, stdio: "ignore", env: { ...process.env, OTP_DEV_ECHO: "1", ALLOW_MOCK_PAYMENTS: "1" }, detached: true });
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(`${BASE}/en`)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("dev server did not start");
}
function stopServer() {
  if (!args.base && !args.keep) fs.rmSync(path.dirname(ROUTE), { recursive: true, force: true });
  if (server) process.kill(-server.pid);
}

let browser;
async function stage(shot, { fold = 1, w = 1000, h = 1000 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w + 40, height: h + 40 } });
  await ctx.addCookies([{ name: "elba_cookie_ack", value: "1", url: BASE }]);
  const page = await ctx.newPage();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${BASE}/en/dev/r6-capture?shot=${shot}&fold=${fold}&w=${w}&h=${h}`, { timeout: 300000 });
  await page.waitForFunction(() => window.__r6 && window.__r6.ready, null, { timeout: 300000 });
  await page.waitForTimeout(2500);
  const api = {
    page,
    view: async (v) => (await page.evaluate((x) => window.__r6.view(x), v), page.waitForTimeout(1100)),
    rotate: (az, polar = 0) => page.evaluate(([a, p]) => window.__r6.rotate(a, p), [az, polar]),
    zoom: (f) => page.evaluate((x) => window.__r6.zoom(x), f),
    shot: async (W, H, bg = null) => Buffer.from(await page.evaluate(([a, b, c]) => window.__r6.shot(a, b, c), [W, H, bg]), "base64"),
    close: () => ctx.close(),
  };
  return api;
}
async function cached(name, fn) {
  const f = path.join(RAW, `${name}.png`);
  if (!args.fresh && fs.existsSync(f)) return fs.readFileSync(f);
  const buf = await fn();
  fs.writeFileSync(f, buf);
  return buf;
}
async function pool(items, n, fn) {
  const q = [...items];
  await Promise.all(Array.from({ length: n }, async () => {
    while (q.length) await fn(q.shift());
  }));
}

// ---------------------------------------------------------------------------------------------
// stages
async function renders() {
  await pool(HERO, 2, async (id) => {
    let s = null;
    const raw = {};
    for (const v of ["iso", "front"]) {
      raw[v] = await cached(`${id}-${v}`, async () => {
        s ??= await stage(id);
        if (v === "front") {
          await s.view("front");
          await s.rotate(0, VESSEL_SHOTS.has(id) ? 6 : 20); // lift the camera a little so the lid reads
          await s.page.waitForTimeout(300);
        } else await s.view("iso");
        return s.shot(1400, 1400);
      });
    }
    if (s) await s.close();
    for (const v of ["iso", "front"]) {
      const cut = await trim(raw[v]);
      await emit(cut, path.join(OUT, "cutouts", `${id}-${v}`), 480, 480, { alpha: true });
      for (const tone of v === "iso" ? ["dark", "light"] : ["dark"]) {
        await emit(await studio(cut, 1280, 1600, tone), path.join(OUT, "hero", `${id}-${v}-${tone}`), 640, 800);
      }
    }
    console.log("render", id);
  });
}

async function collage() {
  await pool(COLLAGE, 2, async (c) => {
    const buf = await cached(`collage-${c.id}`, async () => {
      const s = await stage(c.shot);
      await s.rotate(c.az, c.polar);
      await s.page.waitForTimeout(400);
      const b = await s.shot(1200, 1200);
      await s.close();
      return b;
    });
    await emit(await trim(buf), path.join(OUT, "collage", c.id), 400, 400, { alpha: true });
    console.log("collage", c.id);
  });
  // process piece 1: the flat dieline with artwork, straight from the engine (fold = 0, top view)
  const flat = await cached("process-dieline", async () => {
    const s = await stage("mailer", { fold: 0 });
    await s.view(String(args.flatView ?? "front")); // the flat sheet lies in the front plane
    await s.page.waitForTimeout(800);
    const b = await s.shot(1600, 1200);
    await s.close();
    return b;
  });
  await emit(await trim(flat, 0.02), path.join(OUT, "collage", "process-dieline"), 560, 420, { alpha: true });
  console.log("collage process-dieline");
}

async function cards() {
  for (const c of CARDS) {
    const W = 1200, H = 1800; // 2x of 600x900
    const cut = await trim(fs.readFileSync(path.join(RAW, `${c.shot}-iso.png`)));
    const prod = await sharp(cut).resize({ width: Math.round(W * 0.8), height: Math.round(H * 0.5), fit: "inside" }).toBuffer();
    const pm = await sharp(prod).metadata();
    const dark = parseInt(c.bg.slice(1, 3), 16) < 0x80;
    const top = Math.round(H * 0.7 - pm.height);
    const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
      <defs><radialGradient id="l" cx="0.5" cy="0.3" r="0.8"><stop offset="0" stop-color="#fff" stop-opacity="${dark ? 0.12 : 0.45}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
      <radialGradient id="s"><stop offset="0" stop-color="#000" stop-opacity="${dark ? 0.6 : 0.28}"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs>
      <rect width="${W}" height="${H}" fill="${c.bg}"/><rect width="${W}" height="${H}" fill="url(#l)"/>
      <ellipse cx="${W / 2}" cy="${H * 0.7 - pm.height * 0.03}" rx="${pm.width * 0.48}" ry="${pm.width * 0.055}" fill="url(#s)"/>
      <text x="${W / 2}" y="${H * 0.83}" text-anchor="middle" font-family="Inter, sans-serif" font-weight="700" font-size="118" fill="${c.ink}" letter-spacing="2">${c.latin}</text>
      <text x="${W / 2}" y="${H * 0.91}" text-anchor="middle" font-family="IBM Plex Sans Arabic, Noto Sans Arabic, sans-serif" font-weight="600" font-size="72" fill="${c.ink}" fill-opacity="0.8">${c.arabic}</text>
    </svg>`);
    const png = await sharp(svg).composite([{ input: prod, left: Math.round((W - pm.width) / 2), top }]).png().toBuffer();
    await emit(png, path.join(OUT, "cards", c.id), 600, 900);
    console.log("card", c.id);
  }
}

async function loops() {
  const FPS = 24, SECONDS = 4, N = FPS * SECONDS, F = 1080; // F: frame px (product + engine contact shadow)
  const bg = await sharp(studioSvg(1920, 1080, "dark")).png().toBuffer();
  const bgFile = path.join(RAW, "loop-bg.png");
  fs.writeFileSync(bgFile, bg);
  for (const id of LOOPS) {
    const dir = path.join(RAW, `loop-${id}`);
    fs.mkdirSync(dir, { recursive: true });
    const missing = [...Array(N).keys()].filter((i) => args.fresh || !fs.existsSync(path.join(dir, `f${String(i).padStart(3, "0")}.png`)));
    if (missing.length) {
      // two pages render interleaved halves of the turn; each frame is an absolute angle so the loop is seamless
      const halves = [missing.filter((i) => i % 2 === 0), missing.filter((i) => i % 2 === 1)];
      await Promise.all(halves.map(async (frames) => {
        const s = await stage(id, { w: F, h: F });
        await s.zoom(LOOP_ZOOM[id] ?? 0.8); // the studio is 1920x1080; the product frame is the middle 1080x1080
        await s.page.waitForTimeout(300);
        let at = 0;
        for (const i of frames) {
          const deg = (360 * i) / N;
          await s.rotate(deg - at, 0);
          at = deg;
          fs.writeFileSync(path.join(dir, `f${String(i).padStart(3, "0")}.png`), await s.shot(F, F));
        }
        await s.close();
      }));
    }
    const vdir = path.join(OUT, "loops");
    fs.mkdirSync(vdir, { recursive: true });
    // the frame (product + the engine's own soft contact shadow, transparent) centred on the 1920x1080 studio, over a floor glow
    const sh = path.join(RAW, `loop-shadow-${id}.png`);
    fs.writeFileSync(sh, await sharp(shadowSvg(1920, 1080, 960, F * 0.8, 380, true)).png().toBuffer());
    const X = (1920 - F) / 2, Y = 0;
    const filter = `[0][1]overlay[b];[b][2]overlay=x=${X}:y=${Y}:shortest=1,format=yuv420p`;
    const inputs = ["-loop", "1", "-i", bgFile, "-loop", "1", "-i", sh, "-framerate", String(FPS), "-i", path.join(dir, "f%03d.png")];
    const ff = (extra) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...inputs, "-filter_complex", extra.filter, "-frames:v", String(N), "-an", ...extra.codec, extra.out]);
    for (const [h, sc] of [[1080, ""], [720, ",scale=1280:720:flags=lanczos"]]) {
      const base = path.join(vdir, `${id}-${h}p`);
      ff({ filter: filter + sc, codec: ["-c:v", "libvpx-vp9", "-b:v", "0", "-crf", h === 1080 ? "40" : "42", "-row-mt", "1", "-deadline", "good", "-cpu-used", "2"], out: `${base}.webm` });
      ff({ filter: filter + sc, codec: ["-c:v", "libx264", "-preset", "slow", "-crf", h === 1080 ? "28" : "28", "-movflags", "+faststart", "-pix_fmt", "yuv420p"], out: `${base}.mp4` });
      record(`${base}.webm`, h === 1080 ? 1920 : 1280, h);
      record(`${base}.mp4`, h === 1080 ? 1920 : 1280, h);
    }
    // poster = frame 0 composited like the video
    const f0 = await sharp(path.join(dir, "f000.png")).toBuffer();
    const poster = await sharp(bg).composite([{ input: fs.readFileSync(sh) }, { input: f0, left: X, top: Y }]).png().toBuffer();
    await emit(poster, path.join(vdir, `${id}-poster`), 960, 540);
    console.log("loop", id);
  }
}

async function ui() {
  const { renderUi } = await import("./render-ui.mjs");
  await renderUi({ base: BASE, browser, out: path.join(OUT, "ui"), emit, only: args.ui ? String(args.ui).split(",") : null });
}

// ---------------------------------------------------------------------------------------------
(async () => {
  await startServer();
  browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  try {
    if (ONLY.has("renders")) await renders();
    if (ONLY.has("collage")) await collage();
    if (ONLY.has("cards")) await cards();
    if (ONLY.has("ui")) await ui();
    if (ONLY.has("loops")) await loops();
  } finally {
    await browser.close();
    fs.mkdirSync(path.dirname(MANIFEST_FILE), { recursive: true });
    // merge with what other runs wrote meanwhile (stages can run in parallel processes)
    if (fs.existsSync(MANIFEST_FILE)) {
      const now = JSON.parse(fs.readFileSync(MANIFEST_FILE, "utf8"));
      manifest.files = { ...now.files, ...manifest.files };
      manifest.bases = { ...now.bases, ...manifest.bases };
    }
    for (const k of Object.keys(manifest.files)) if (!fs.existsSync(path.join(ROOT, "public", k))) delete manifest.files[k];
    for (const k of Object.keys(manifest.files)) manifest.files[k].bytes = fs.statSync(path.join(ROOT, "public", k)).size;
    const sorted = Object.fromEntries(Object.entries(manifest.files).sort(([a], [b]) => a.localeCompare(b)));
    const bases = Object.fromEntries(Object.entries(manifest.bases).sort(([a], [b]) => a.localeCompare(b)));
    fs.writeFileSync(MANIFEST_FILE, JSON.stringify({ generatedAt: manifest.generatedAt, files: sorted, bases }, null, 1) + "\n");
    fs.writeFileSync(SIZES_TS, `// Generated by scripts/marketing/render-assets.mjs. Do not edit.\n/** 1x CSS size [width, height] of every asset under /marketing/r6/ (files: <base>.avif|webp, <base>@2x.avif|webp). */\nexport const R6_SIZES: Record<string, readonly [number, number]> = {\n${Object.entries(bases).map(([k, [w, h]]) => `  "${k}": [${w}, ${h}],`).join("\n")}\n};\n`);
    const total = Object.values(sorted).reduce((s, f) => s + f.bytes, 0);
    console.log(`manifest: ${Object.keys(sorted).length} files, ${(total / 1e6).toFixed(2)} MB`);
    stopServer();
  }
})();
