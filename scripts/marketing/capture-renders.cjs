/**
 * Capture real 3D renders of every box structure and a few vessels into public/marketing/renders.
 * Usage: copy scripts/marketing/CapturePage.tsx to src/app/[locale]/capture/page.tsx in a
 * scratch copy of the app, start it (next dev -p 3520), then:
 *   node scripts/marketing/capture-renders.cjs http://localhost:3520 public/marketing/renders
 */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const IDS = ["FEFCO_0427", "FEFCO_0201", "ECMA_RTE", "ECMA_STE", "PIZZA", "SLEEVE", "FEFCO_0320", "ECMA_CLB", "ECMA_SLB", "FEFCO_0422", "GABLE_BOX", "PAPER_TUBE", "RIGID_BOX", "jar", "bottle", "dropper", "pump", "can"];
(async () => {
  const [base, out] = process.argv.slice(2);
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
  for (const id of (process.argv[4] ? process.argv[4].split(",") : IDS)) {
    await page.goto(`${base}/en/capture?only=${id}`, { waitUntil: "networkidle", timeout: 120000 });
    await page.waitForFunction(() => typeof window.__capture === "function", null, { timeout: 60000 });
    await page.waitForTimeout(4000);
    const vessel = /^[a-z]/.test(id);
    const b64 = await page.evaluate(([i, w, h]) => window.__capture(i, w, h), [id, vessel ? 900 : 1200, vessel ? 1200 : 900]);
    const file = path.join(out, `${id.toLowerCase().replace(/_/g, "-")}.png`);
    fs.writeFileSync(file, Buffer.from(b64, "base64"));
    console.log(file, fs.statSync(file).size);
  }
  await browser.close();
})();
