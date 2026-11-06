/**
 * 3D visual audit capture harness (report-only; touches no source).
 * Loads /en/dev/3d once, then picks every library model from the inline model browser and
 * screenshots the library stage: boxes at closed-iso, closed back/bottom, half fold, flat;
 * vessels at iso, back and top-down. Writes PNGs + a JSON log (console errors per model).
 * usage: node capture.cjs <models.json> <outDir> <source[,source…]>
 */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const [modelsFile, outDir, sourcesArg] = process.argv.slice(2);
const sources = new Set(sourcesArg.split(","));
const models = JSON.parse(fs.readFileSync(modelsFile, "utf8")).filter((m) => sources.has(m.source));
const base = process.env.BASE || "http://localhost:3100";
fs.mkdirSync(outDir, { recursive: true });

(async () => {
  const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  let logs = [];
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") logs.push(`${m.type()}: ${m.text().slice(0, 300)}`); });
  page.on("pageerror", (e) => logs.push(`pageerror: ${e.message.slice(0, 300)}`));
  await page.goto(`${base}/en/dev/3d?model=${models[0].code}`, { waitUntil: "networkidle", timeout: 180000 });
  const lib = page.locator('[data-testid="library-dev"]');
  const stage = lib.locator('[data-testid="stage-3d"]');
  const result = [];
  const shot = async (file) => {
    const box = await stage.boundingBox();
    const side = Math.min(box.width, box.height);
    await page.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
    await page.screenshot({ path: path.join(outDir, file), clip: { x: box.x + (box.width - side) / 2, y: box.y, width: side, height: side } });
  };
  const viewer = () => stage.locator('[role="application"]').first();
  const press = async (key, n) => { for (let i = 0; i < n; i++) await viewer().press(key); };
  for (const m of models) {
    logs = [];
    const t0 = Date.now();
    const rec = { code: m.code, source: m.source, kind: m.kind, shots: [], errors: [] };
    try {
      await lib.locator(`button[data-model="${m.code}"]`).first().click();
      await page.waitForFunction((c) => document.querySelector('[data-testid="library-dev"] [data-testid="stage-3d"]')?.getAttribute("data-model") === c, m.code, { timeout: 20000 });
      await stage.scrollIntoViewIfNeeded();
      await stage.locator("canvas").first().waitFor({ timeout: 30000 });
      await page.waitForTimeout(1500);
      const tag = m.code.replace(/[^A-Za-z0-9_-]/g, "_");
      await shot(`${tag}__a_iso.png`); rec.shots.push("a_iso");
      await viewer().focus();
      if (m.kind === "box") {
        await press("ArrowRight", 12); await press("ArrowDown", 7); await page.waitForTimeout(400);
        await shot(`${tag}__b_back.png`); rec.shots.push("b_back");
        await press("0", 1);
        await stage.locator("xpath=ancestor::*[2]").locator('input[type="range"]').first().evaluate((el) => {
          const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
          set.call(el, "50"); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true }));
        });
        await page.waitForTimeout(900);
        await shot(`${tag}__c_half.png`); rec.shots.push("c_half");
        await lib.getByRole("button", { name: "Flat", exact: true }).click();
        await page.waitForTimeout(900);
        await shot(`${tag}__d_flat.png`); rec.shots.push("d_flat");
        await lib.getByRole("button", { name: "Closed", exact: true }).click();
      } else {
        await press("ArrowRight", 12); await page.waitForTimeout(400);
        await shot(`${tag}__b_back.png`); rec.shots.push("b_back");
        await press("ArrowRight", 12); await press("ArrowUp", 9); await page.waitForTimeout(400);
        await shot(`${tag}__c_top.png`); rec.shots.push("c_top");
        await press("0", 1);
      }
    } catch (e) {
      rec.errors.push(`harness: ${String(e.message).split("\n")[0]}`);
    }
    rec.errors.push(...logs.filter((l) => !/Download the React DevTools|HMR|Fast Refresh/.test(l)));
    rec.ms = Date.now() - t0;
    result.push(rec);
    process.stdout.write(`${m.code} ${rec.ms}ms ${rec.errors.length ? "ERR " + rec.errors.length : ""}\n`);
    fs.writeFileSync(path.join(outDir, `_log-${sourcesArg.replace(/,/g, "+")}.json`), JSON.stringify(result, null, 1));
  }
  await browser.close();
})();
