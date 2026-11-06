/**
 * Option sensitivity: for a model, toggle every radio / checkbox in the library config panel
 * (material, finishes, print sides, features, container, closure, surfaces…) and pixel-diff the
 * 3D stage against the baseline. An option whose diff is ~0 does not visibly change the model.
 * usage: node options.cjs <outJson> CODE[,CODE…]
 */
const fs = require("fs");
const { chromium } = require("playwright");
const [out, list] = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  const res = {};
  for (const code of list.split(",")) {
    await page.goto(`http://localhost:3100/en/dev/3d?model=${code}`, { waitUntil: "networkidle" });
    const lib = page.locator('[data-testid="library-dev"]');
    const stage = lib.locator('[data-testid="stage-3d"]');
    await stage.scrollIntoViewIfNeeded(); await page.waitForTimeout(3000);
    const grab = async () => { await page.evaluate(() => document.activeElement?.blur?.()); return stage.screenshot(); };
    const diff = async (a, b) => page.evaluate(async ([a, b]) => {
      const load = (s) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = "data:image/png;base64," + s; });
      const [ia, ib] = await Promise.all([load(a), load(b)]);
      const c = document.createElement("canvas"); c.width = ia.width; c.height = ia.height; const x = c.getContext("2d");
      x.drawImage(ia, 0, 0); const da = x.getImageData(0, 0, c.width, c.height).data; x.drawImage(ib, 0, 0); const db = x.getImageData(0, 0, c.width, c.height).data;
      let n = 0; for (let i = 0; i < da.length; i += 4) if (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]) > 24) n++;
      return +(100 * n / (da.length / 4)).toFixed(2);
    }, [a.toString("base64"), b.toString("base64")]);
    const inputs = lib.locator('fieldset input[type="radio"]:not([disabled]), fieldset input[type="checkbox"]:not([disabled])');
    const ids = await inputs.evaluateAll((els) => els.map((e) => e.id).filter(Boolean));
    const rows = [];
    for (const id of ids) {
      const el = lib.locator(`[id="${id}"]`);
      if (!(await el.count()) || (await el.isDisabled())) continue;
      const type = await el.getAttribute("type");
      if (type === "radio" && (await el.isChecked())) continue;
      const base = await grab();
      try { await el.click({ force: true, timeout: 5000 }); } catch { continue; }
      await page.waitForTimeout(1500);
      const after = await grab();
      rows.push({ id, changedPct: await diff(base, after) });
      if (type === "checkbox") { try { if (await el.isChecked()) await el.click({ force: true, timeout: 5000 }); await page.waitForTimeout(800); } catch {} }
    }
    res[code] = rows;
    console.log(code, JSON.stringify(rows));
    fs.writeFileSync(out, JSON.stringify(res, null, 1));
  }
  await browser.close();
})();
