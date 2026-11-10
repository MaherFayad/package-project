/**
 * Mailer audit captures (report-only; touches no source): the RETF mailers and the core mailer in
 * the live 3D library view (/en/dev/3d, same scene as the designer), closed from the front, top,
 * side and three-quarter, then open (walls up, lid back) and flat.
 * usage: BASE=http://localhost:3100 node docs/audit/tools/gift-box-capture.cjs docs/screenshots/audit/gift-box-tuck-front MAILER_RETF,MAILER_RETF_PLAIN,FEFCO_0427
 */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const [outDir, codesArg] = process.argv.slice(2);
const codes = (codesArg || "MAILER_RETF").split(",");
const base = process.env.BASE || "http://localhost:3100";
fs.mkdirSync(outDir, { recursive: true });

(async () => {
  const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, reducedMotion: "reduce" });
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 300)); });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 300)}`));
  const lib = page.locator('[data-testid="library-dev"]');
  const stage = lib.locator('[data-testid="stage-3d"]');
  const viewer = () => stage.locator('[role="application"]').first();
  const press = async (key, n) => { for (let i = 0; i < n; i++) await viewer().press(key); };
  const shot = async (file) => {
    await page.waitForTimeout(700);
    const box = await stage.boundingBox();
    const side = Math.min(box.width, box.height);
    await page.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
    await page.screenshot({ path: path.join(outDir, file), clip: { x: box.x + (box.width - side) / 2, y: box.y, width: side, height: side } });
    await viewer().focus();
  };
  const fold = async (v) => {
    await stage.locator("xpath=ancestor::*[2]").locator('input[type="range"]').first().evaluate((el, val) => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      set.call(el, String(val)); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true }));
    }, v);
  };
  // Key steps (from the viewer's keyboard handler): rotate 15° per press, tilt 10° per press.
  const views = JSON.parse(process.env.VIEWS || '{"iso":[],"front":["ArrowLeft",2,"ArrowDown",3],"top":["ArrowUp",8],"side":["ArrowRight",4,"ArrowDown",3]}');
  for (const code of codes) {
    await page.goto(`${base}/en/dev/3d?model=${code}`, { waitUntil: "networkidle", timeout: 180000 });
    await page.waitForFunction((c) => document.querySelector('[data-testid="library-dev"] [data-testid="stage-3d"]')?.getAttribute("data-model") === c, code, { timeout: 20000 });
    await stage.scrollIntoViewIfNeeded();
    await stage.locator("canvas").first().waitFor({ timeout: 30000 });
    await page.waitForTimeout(1500);
    await viewer().focus();
    for (const [name, seq] of Object.entries(views)) {
      await press("0", 1);
      for (let i = 0; i < seq.length; i += 2) await press(seq[i], seq[i + 1]);
      await shot(`${code}__${name}.png`);
    }
    await press("0", 1);
    await fold(Number(process.env.OPEN || 86));
    await shot(`${code}__open.png`);
    await lib.getByRole("button", { name: "Flat", exact: true }).click();
    await shot(`${code}__flat.png`);
    await lib.getByRole("button", { name: "Closed", exact: true }).click();
    process.stdout.write(`${code} done\n`);
  }
  if (errors.length) console.log("console errors:", errors);
  await browser.close();
})();
