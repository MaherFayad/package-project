/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Render every ECMA tuck / specials model in the LIVE designer (/en/design/<code>?resume=1)
 * with the test-pattern doc from docs.ts injected as this browser's autosave.
 * Shots per model: iso closed, each face view, back-bottom iso, 50 % fold, flat, inside (50 %).
 * Logs console errors and a rough frame rate (rAF over 2 s, turntable on) per model.
 * usage: node capture.cjs <docs.json> <outDir> [CODE,…]   (BASE=http://localhost:3100)
 */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const [docsFile, outDir, list] = process.argv.slice(2);
const all = JSON.parse(fs.readFileSync(docsFile, "utf8"));
const codes = list ? list.split(",") : Object.keys(all);
const base = process.env.BASE || "http://localhost:3100";
const mobile = process.env.MOBILE === "1";
fs.mkdirSync(outDir, { recursive: true });

(async () => {
  const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const ctx = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  const log = [];
  for (const code of codes) {
    const rec = { code, errors: [], shots: [] };
    const page = await ctx.newPage();
    page.on("console", (m) => { if (m.type() === "error") rec.errors.push(m.text().slice(0, 240)); });
    page.on("pageerror", (e) => rec.errors.push("pageerror: " + e.message.slice(0, 240)));
    const draft = { doc: all[code].doc, designId: null, savedAt: Date.now() };
    await page.addInitScript((d) => { try { localStorage.setItem("elba.designer.last.v1", d); } catch {} }, JSON.stringify(draft));
    try {
      await page.goto(`${base}/en/design/${code}?resume=1`, { waitUntil: "networkidle", timeout: 120000 });
      const stage = page.locator('[data-testid="stage-3d"]');
      await stage.locator("canvas").first().waitFor({ timeout: 60000 });
      await page.waitForTimeout(2500);
      const shot = async (name) => {
        await page.evaluate(() => document.activeElement?.blur?.());
        await page.mouse.move(0, 0);
        const bb = await stage.boundingBox();
        const side = Math.min(bb.width, bb.height - 40);
        await page.screenshot({ path: path.join(outDir, `${code}__${name}.png`), clip: { x: bb.x + (bb.width - side) / 2, y: bb.y, width: side, height: side } });
        rec.shots.push(name);
      };
      await shot("0iso");
      if (mobile) {
        const fps = await page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res(n / 2); }; requestAnimationFrame(f); }));
        rec.fps = fps;
      } else {
        const face = page.locator("[class*=faceSelect] select").first();
        for (const f of all[code].faces) {
          await face.selectOption(f);
          await page.waitForTimeout(900);
          await shot(`1${f}`);
        }
        const viewer = stage.locator('[role="application"]').first();
        await viewer.focus();
        await viewer.press("0");
        for (let i = 0; i < 12; i++) await viewer.press("ArrowRight");
        for (let i = 0; i < 6; i++) await viewer.press("ArrowDown");
        await page.waitForTimeout(600);
        await shot("2backbottom");
        await viewer.press("0");
        await page.getByRole("button", { name: "Half", exact: true }).click().catch(() => {});
        await page.waitForTimeout(1200);
        await shot("3half");
        await page.getByRole("button", { name: "Flat", exact: true }).click().catch(() => {});
        await page.waitForTimeout(1200);
        await shot("4flat");
      }
    } catch (e) {
      rec.errors.push("harness: " + String(e.message).split("\n")[0]);
    }
    log.push(rec);
    console.log(code, rec.shots.length, rec.fps ?? "", rec.errors.length ? "ERR " + rec.errors.join(" | ").slice(0, 300) : "");
    await page.close();
  }
  fs.writeFileSync(path.join(outDir, "_log.json"), JSON.stringify(log, null, 1));
  await browser.close();
})();
