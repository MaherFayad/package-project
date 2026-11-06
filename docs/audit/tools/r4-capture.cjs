/**
 * Round 4 3D re-audit capture: every model of the catalogue (410) in the REAL renderer.
 *  - 370 library models: the designer itself, /en/design/<slug> (Stage3D → Scene3D / VesselView).
 *  - 40 catalogue-only models: /en/dev/catalogue/<code> (CatalogueViewer, same engine + family meshes).
 * Desktop 1440×900: hero (camera fit as the user first sees it), back-underside, half fold, flat
 * (boxes) / back, top, open closure (containers). Phone 390×844: hero only (fit under the toolbar).
 * Reduced motion so fold / camera tweens land at once. Writes PNGs + _log.json (errors, timings).
 *
 * usage: BASE=http://localhost:3100 node r4-capture.cjs <catalogue-models.json> <outDir> <shard> <nShards>
 */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const [modelsFile, outDir, shardArg = "0", nArg = "1"] = process.argv.slice(2);
const shard = Number(shardArg), n = Number(nArg);
const only = process.env.ONLY ? new Set(process.env.ONLY.split(",")) : null;
const models = JSON.parse(fs.readFileSync(modelsFile, "utf8")).filter((m, i) => (only ? only.has(m.code) : i % n === shard));
const base = process.env.BASE || "http://localhost:3100";
const IGNORED = [/Download the React DevTools/, /Fast Refresh/, /HMR/];
fs.mkdirSync(outDir, { recursive: true });

async function stable(page, loc, ms = 600) {
  // wait until two screenshots of the stage are identical (fold / camera / swap-in settled)
  let prev = null;
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(ms);
    const buf = await loc.screenshot();
    if (prev && buf.equals(prev)) return;
    prev = buf;
  }
}

(async () => {
  const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const mk = async (w, h) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: "reduce" });
    await ctx.route("**/api/designs**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "audit", owned: false, updatedAt: new Date().toISOString() }) }));
    await ctx.route("**/api/events**", (r) => r.fulfill({ status: 204, body: "" }));
    return ctx.newPage();
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
  for (const m of models) {
    logs = [];
    const t0 = Date.now();
    const tag = m.code.replace(/[^A-Za-z0-9_-]/g, "_");
    const rec = { code: m.code, slug: m.slug, render: m.render, shots: [], errors: [] };
    const inDesigner = m.render === "box" || m.render === "vessel";
    try {
      if (inDesigner) {
        for (const [page, vp] of [[desk, "d"], [phone, "m"]]) {
          await page.goto(`${base}/en/design/${m.slug}`, { waitUntil: "domcontentloaded", timeout: 90000 });
          const stage = page.getByTestId("stage-3d");
          await page.waitForFunction((c) => document.querySelector('[data-testid="stage-3d"]')?.getAttribute("data-model") === c, m.code, { timeout: 60000 });
          await stage.locator("canvas").first().waitFor({ state: "visible", timeout: 60000 });
          await stage.scrollIntoViewIfNeeded();
          await page.evaluate(() => document.activeElement?.blur?.());
          await stable(page, stage);
          await stage.screenshot({ path: path.join(outDir, `${tag}__${vp}_hero.png`) });
          rec.shots.push(`${vp}_hero`);
          if (vp === "m") break;
          const viewer = stage.locator('[role="application"]').first();
          await viewer.focus();
          const press = async (k, c) => { for (let i = 0; i < c; i++) await viewer.press(k); };
          if (m.render === "box") {
            await press("ArrowRight", 12); await press("ArrowDown", 7);
            await stable(page, stage, 400);
            await stage.screenshot({ path: path.join(outDir, `${tag}__d_back.png`) }); rec.shots.push("d_back");
            await press("0", 1);
            await page.getByRole("group", { name: "Fold" }).getByRole("button", { name: "Half", exact: true }).click();
            await stable(page, stage);
            await stage.screenshot({ path: path.join(outDir, `${tag}__d_half.png`) }); rec.shots.push("d_half");
            await page.getByRole("group", { name: "Fold" }).getByRole("button", { name: "Flat", exact: true }).click();
            await stable(page, stage);
            await stage.screenshot({ path: path.join(outDir, `${tag}__d_flat.png`) }); rec.shots.push("d_flat");
          } else {
            await press("ArrowRight", 12);
            await stable(page, stage, 400);
            await stage.screenshot({ path: path.join(outDir, `${tag}__d_back.png`) }); rec.shots.push("d_back");
            await press("ArrowRight", 12); await press("ArrowUp", 9);
            await stable(page, stage, 400);
            await stage.screenshot({ path: path.join(outDir, `${tag}__d_top.png`) }); rec.shots.push("d_top");
            await press("0", 1);
            const open = page.getByRole("button", { name: "Open", exact: true });
            if (await open.count()) {
              await open.first().click();
              await stable(page, stage);
              await stage.screenshot({ path: path.join(outDir, `${tag}__d_open.png`) }); rec.shots.push("d_open");
            }
          }
        }
      } else {
        await desk.goto(`${base}/en/dev/catalogue/${encodeURIComponent(m.code)}`, { waitUntil: "domcontentloaded", timeout: 90000 });
        const stage = desk.getByTestId("catalogue-render");
        await desk.waitForFunction(() => /ready|error/.test(document.querySelector('[data-testid="catalogue-render"]')?.getAttribute("data-state") || ""), null, { timeout: 60000 });
        if ((await stage.getAttribute("data-state")) !== "ready") rec.errors.push("render error: " + (await stage.innerText()));
        await stable(desk, stage);
        await stage.screenshot({ path: path.join(outDir, `${tag}__d_hero.png`) });
        rec.shots.push("d_hero");
      }
    } catch (e) {
      rec.errors.push(`harness: ${String(e.message).split("\n")[0]}`);
    }
    rec.errors.push(...logs);
    rec.ms = Date.now() - t0;
    result.push(rec);
    process.stdout.write(`${m.code} ${rec.ms}ms ${rec.errors.length ? "ERR " + rec.errors.join(" | ").slice(0, 200) : ""}\n`);
    fs.writeFileSync(logFile, JSON.stringify(result, null, 1));
  }
  await browser.close();
})();
