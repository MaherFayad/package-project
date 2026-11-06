/**
 * Round 5 3D QA capture: every variant from r5-variants.ts in the REAL designer.
 * The DesignDoc is put in this browser's autosave (localStorage "elba.designer.last.v1") and the
 * editor opened with ?resume=1, the same path a returning user takes, so size, features, board,
 * container, closure and flexible options all go through the production code.
 *  every variant: desktop 1440×900 hero.
 *  def:           + back/underside, half fold, flat, Dieline view (boxes) / back, top, open (vessels).
 *  def/min/max:   + phone 390×844 hero.
 * The 40 catalogue-only models (no designer): /en/dev/catalogue/<code>, hero.
 * Reduced motion, 1x DPR. Writes <outDir>/<CODE>__<variant>__<view>.png and _log-<shard>.json.
 *
 * usage: BASE=http://localhost:3100 node r5-capture.cjs variants.json outDir shard nShards [catalogue-models.json]
 *        ONLY=CODE,CODE  VARIANTS=def,min  to filter.
 */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const [variantsFile, outDir, shardArg = "0", nArg = "1", catFile] = process.argv.slice(2);
const shard = Number(shardArg), n = Number(nArg);
const only = process.env.ONLY ? new Set(process.env.ONLY.split(",")) : null;
const vOnly = process.env.VARIANTS ? new Set(process.env.VARIANTS.split(",")) : null;
const base = process.env.BASE || "http://localhost:3100";
const IGNORED = [/Download the React DevTools/, /Fast Refresh/, /HMR/, /webpack-hmr/];
fs.mkdirSync(outDir, { recursive: true });

const all = JSON.parse(fs.readFileSync(variantsFile, "utf8")).filter((v) => (!only || only.has(v.code)) && (!vOnly || vOnly.has(v.variant)));
// shard by model so one model's variants stay in one process (cache-warm family chunk)
const codes = [...new Set(all.map((v) => v.code))];
const mine = new Set(codes.filter((c, i) => i % n === shard));
const variants = all.filter((v) => mine.has(v.code));
let catalogue = [];
if (catFile) {
  const lib = new Set(codes);
  catalogue = JSON.parse(fs.readFileSync(catFile, "utf8")).filter((m) => m.render !== "box" && m.render !== "vessel" && !lib.has(m.code) && (!only || only.has(m.code))).filter((m, i) => i % n === shard);
}

async function stable(page, loc, ms = 450, tries = 14) {
  let prev = null;
  for (let i = 0; i < tries; i++) {
    await page.waitForTimeout(ms);
    const buf = await loc.screenshot();
    if (prev && buf.equals(prev)) return buf;
    prev = buf;
  }
  return prev;
}

(async () => {
  const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const mk = async (w, h) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: "reduce" });
    await ctx.route("**/api/designs**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "audit", owned: false, updatedAt: new Date().toISOString() }) }));
    await ctx.route("**/api/events**", (r) => r.fulfill({ status: 204, body: "" }));
    const p = await ctx.newPage();
    await p.goto(`${base}/robots.txt`);
    return p;
  };
  const desk = await mk(1440, 900);
  const phone = await mk(390, 844);
  let logs = [];
  for (const p of [desk, phone]) {
    p.on("console", (m) => { if (m.type() === "error" && !IGNORED.some((r) => r.test(m.text()))) logs.push(m.text().slice(0, 300)); });
    p.on("pageerror", (e) => logs.push(`pageerror: ${e.message.slice(0, 300)}`));
  }
  const result = [];
  const logFile = path.join(outDir, `_log-${shard}.json`);
  const save = () => fs.writeFileSync(logFile, JSON.stringify(result, null, 1));

  async function open(page, v) {
    await page.evaluate((d) => localStorage.setItem("elba.designer.last.v1", JSON.stringify({ doc: d, designId: null, savedAt: Date.now() })), v.doc);
    await page.goto(`${base}/en/design/${v.slug}?resume=1`, { waitUntil: "domcontentloaded", timeout: 90000 });
    const stage = page.getByTestId("stage-3d");
    await page.waitForFunction((c) => document.querySelector('[data-testid="stage-3d"]')?.getAttribute("data-model") === c, v.code, { timeout: 60000 });
    await stage.locator("canvas").first().waitFor({ state: "visible", timeout: 60000 });
    await stage.scrollIntoViewIfNeeded();
    await page.evaluate(() => document.activeElement?.blur?.());
    return stage;
  }

  for (const v of variants) {
    logs = [];
    const t0 = Date.now();
    const tag = `${v.code.replace(/[^A-Za-z0-9_-]/g, "_")}__${v.variant}`;
    const rec = { code: v.code, variant: v.variant, note: v.note, shots: [], errors: [] };
    try {
      const stage = await open(desk, v);
      await stable(desk, stage);
      await stage.screenshot({ path: path.join(outDir, `${tag}__d_hero.png`) });
      rec.shots.push("d_hero");
      if (v.variant === "def") {
        const viewer = stage.locator('[role="application"]').first();
        await viewer.focus();
        const press = async (k, c) => { for (let i = 0; i < c; i++) await viewer.press(k); };
        if (v.kind === "box") {
          await press("ArrowRight", 12); await press("ArrowDown", 7);
          await stable(desk, stage, 350);
          await stage.screenshot({ path: path.join(outDir, `${tag}__d_back.png`) }); rec.shots.push("d_back");
          await press("0", 1);
          const fold = desk.getByRole("group", { name: "Fold" });
          await fold.getByRole("button", { name: "Half", exact: true }).click();
          await stable(desk, stage);
          await stage.screenshot({ path: path.join(outDir, `${tag}__d_half.png`) }); rec.shots.push("d_half");
          await fold.getByRole("button", { name: "Flat", exact: true }).click();
          await stable(desk, stage);
          await stage.screenshot({ path: path.join(outDir, `${tag}__d_flat.png`) }); rec.shots.push("d_flat");
          await fold.getByRole("button", { name: /Closed|Assembled/ }).first().click().catch(() => {});
        } else {
          await press("ArrowRight", 12);
          await stable(desk, stage, 350);
          await stage.screenshot({ path: path.join(outDir, `${tag}__d_back.png`) }); rec.shots.push("d_back");
          await press("ArrowRight", 12); await press("ArrowUp", 9);
          await stable(desk, stage, 350);
          await stage.screenshot({ path: path.join(outDir, `${tag}__d_top.png`) }); rec.shots.push("d_top");
          await press("0", 1);
          const openBtn = desk.getByRole("button", { name: "Open", exact: true });
          if (await openBtn.count()) {
            await openBtn.first().click();
            await stable(desk, stage);
            await stage.screenshot({ path: path.join(outDir, `${tag}__d_open.png`) }); rec.shots.push("d_open");
          }
        }
        // Dieline view (the 2D die the printer cuts), must match the 3D.
        const view = desk.getByRole("group", { name: "View" }).first();
        const dl = view.getByRole("button", { name: "Dieline", exact: true });
        if (await dl.count()) {
          await dl.click();
          await desk.waitForTimeout(900);
          const st = desk.locator("section[aria-label='View']").first();
          await st.screenshot({ path: path.join(outDir, `${tag}__d_dieline.png`) }); rec.shots.push("d_dieline");
        }
      }
      if (v.variant === "def" || v.variant === "min" || v.variant === "max") {
        const ps = await open(phone, v);
        await stable(phone, ps);
        await ps.screenshot({ path: path.join(outDir, `${tag}__m_hero.png`) });
        rec.shots.push("m_hero");
      }
    } catch (e) {
      rec.errors.push(`harness: ${String(e.message).split("\n")[0]}`);
    }
    rec.errors.push(...logs);
    rec.ms = Date.now() - t0;
    result.push(rec);
    process.stdout.write(`${tag} ${rec.ms}ms ${rec.errors.length ? "ERR " + rec.errors.join(" | ").slice(0, 200) : ""}\n`);
    save();
  }
  for (const m of catalogue) {
    logs = [];
    const t0 = Date.now();
    const tag = `${m.code.replace(/[^A-Za-z0-9_-]/g, "_")}__def`;
    const rec = { code: m.code, variant: "def", catalogue: true, shots: [], errors: [] };
    try {
      await desk.goto(`${base}/en/dev/catalogue/${encodeURIComponent(m.code)}`, { waitUntil: "domcontentloaded", timeout: 90000 });
      const stage = desk.getByTestId("catalogue-render");
      await desk.waitForFunction(() => /ready|error/.test(document.querySelector('[data-testid="catalogue-render"]')?.getAttribute("data-state") || ""), null, { timeout: 60000 });
      if ((await stage.getAttribute("data-state")) !== "ready") rec.errors.push("render error: " + (await stage.innerText()));
      await stable(desk, stage);
      await stage.screenshot({ path: path.join(outDir, `${tag}__d_hero.png`) });
      rec.shots.push("d_hero");
    } catch (e) {
      rec.errors.push(`harness: ${String(e.message).split("\n")[0]}`);
    }
    rec.errors.push(...logs);
    rec.ms = Date.now() - t0;
    result.push(rec);
    process.stdout.write(`${tag} ${rec.ms}ms ${rec.errors.length ? "ERR " + rec.errors.join(" | ").slice(0, 200) : ""}\n`);
    save();
  }
  await browser.close();
})();
