/* eslint-disable */
/**
 * Visual snapshots of the 3D engine (owner: 3D engine).
 *   node scripts/perf/shots-3d.cjs http://localhost:3000 docs/screenshots/audit/3d-engine before
 */
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const base = process.argv[2] ?? "http://localhost:3000";
const dir = process.argv[3] ?? "shots";
const prefix = process.argv[4] ?? "shot";
fs.mkdirSync(dir, { recursive: true });

const SHOTS = [
  { name: "rse-kraft-pattern", url: "/en/dev/3d?code=FEFCO_0427" },
  { name: "carton-rte", url: "/en/dev/3d?code=ECMA_RTE" },
  { name: "rigid-box", url: "/en/dev/3d?code=RIGID_BOX" },
  { name: "rsc-half-fold", url: "/en/dev/3d?code=FEFCO_0201&fold=0.5" },
  { name: "finish-foil-spotuv-softtouch", url: "/en/dev/finishes?code=ECMA_RTE&board=SBS_350&finishes=SOFT_TOUCH_LAMINATION,FOIL_GOLD,SPOT_UV&print=1&context=none&dims=0" },
  { name: "finish-gloss-emboss-table", url: "/en/dev/finishes?code=FEFCO_0427&board=E_FLUTE_WHITE&finishes=GLOSS_LAMINATION,EMBOSS,FOIL_SILVER&print=1&context=table&dims=0" },
];

(async () => {
  const browser = await chromium.launch({ args: ["--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  const only = process.argv[5] ? process.argv[5].split(",") : null;
  for (const s of SHOTS.filter((x) => !only || only.includes(x.name))) {
    await page.goto(base + s.url, { waitUntil: "load" });
    const viewer = page.locator("[role=application]").first();
    await viewer.waitFor();
    await page.waitForTimeout(4000);
    await viewer.screenshot({ path: path.join(dir, `${prefix}-${s.name}.png`) });
    console.log("shot", s.name);
  }
  if (only && !only.includes("vessel")) return void (await browser.close());
  // Vessel viewer (vessels section mounts its viewer when scrolled into view)
  await page.goto(base + "/en/dev/3d", { waitUntil: "load" });
  await page.waitForTimeout(2000);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(3000);
  const vessels = page.locator("[role=application]");
  const n = await vessels.count();
  if (n > 2) {
    const v = vessels.nth(n - 1);
    await v.scrollIntoViewIfNeeded();
    await page.waitForTimeout(5000);
    await v.screenshot({ path: path.join(dir, `${prefix}-vessel.png`) });
    console.log("shot vessel");
  } else console.log("no vessel viewer", n);
  // Keyboard focus ring on the viewer
  await page.goto(base + "/en/dev/3d?code=ECMA_RTE", { waitUntil: "load" });
  await page.waitForTimeout(2500);
  const v0 = page.locator("[role=application]").first();
  await v0.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("+");
  await page.waitForTimeout(1500);
  await page.locator("section").first().screenshot({ path: path.join(dir, `${prefix}-keyboard-focus.png`) });
  console.log("shot focus");
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
