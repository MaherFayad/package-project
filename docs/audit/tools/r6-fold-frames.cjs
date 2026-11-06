/**
 * Round 6: frames of the fold animation (Half → Closed) in the real editor, full motion, to see
 * how extra pieces (lids) travel. usage: BASE=… node r6-fold-frames.cjs variants.json CODE outDir tag
 */
const fs = require("fs");
const { chromium } = require("playwright");
const [variantsFile, code, out, tag] = process.argv.slice(2);
const base = process.env.BASE || "http://localhost:3100";
(async () => {
  const v = JSON.parse(fs.readFileSync(variantsFile, "utf8")).find((x) => x.code === code && x.variant === "def");
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route("**/api/designs**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: '{"id":"audit","owned":false}' }));
  const p = await ctx.newPage();
  await p.goto(`${base}/robots.txt`);
  await p.evaluate((d) => localStorage.setItem("elba.designer.last.v1", JSON.stringify({ doc: d, designId: null, savedAt: Date.now() })), v.doc);
  await p.goto(`${base}/en/design/${v.slug}?resume=1`, { timeout: 120000 });
  const stage = p.getByTestId("stage-3d");
  await stage.locator("canvas").first().waitFor({ state: "visible", timeout: 120000 });
  await p.waitForTimeout(4000);
  const fold = p.getByRole("group", { name: "Fold" });
  await fold.getByRole("button", { name: "Half", exact: true }).click();
  await p.waitForTimeout(3500);
  // real time: the fold runs ~0.6 s, SwiftShader screenshots take ~0.1 s each (a fake clock
  // stalls the render loop)
  await fold.getByRole("button", { name: /Closed|Assembled/ }).first().click();
  for (let i = 0; i < 12; i++) {
    await p.waitForTimeout(Number(process.env.STEP_MS || 40));
    await stage.screenshot({ path: `${out}/${code}__${tag}__f${String(i).padStart(2, "0")}.png` });
  }
  await b.close();
})();
