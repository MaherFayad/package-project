/**
 * Artwork-mapping pass for the 13 core structures: the /dev/3d top viewer paints the face
 * TEST PATTERN (face names + up arrows) on the outside, so seams, stretching and mirrored or
 * upside-down text show. Captures iso + the six orthographic views per structure, closed.
 * usage: node pattern.cjs <outDir> [CODE,…]
 */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const CODES = ["FEFCO_0427", "FEFCO_0201", "ECMA_RTE", "ECMA_STE", "PIZZA", "SLEEVE", "FEFCO_0320", "ECMA_CLB", "ECMA_SLB", "FEFCO_0422", "GABLE_BOX", "PAPER_TUBE", "RIGID_BOX"];
const [outDir, list] = process.argv.slice(2);
const codes = list ? list.split(",") : CODES;
fs.mkdirSync(outDir, { recursive: true });
(async () => {
  const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  for (const code of codes) {
    await page.goto(`http://localhost:3100/en/dev/3d?code=${code}&fold=1`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2500);
    const v = page.locator("main section").first().locator("[role=application]").first();
    await v.screenshot({ path: path.join(outDir, `${code}__0iso.png`) });
    for (const view of ["front", "back", "left", "right", "top", "bottom"]) {
      await page.locator("form").getByRole("button", { name: view, exact: true }).click();
      await page.waitForTimeout(700);
      await v.screenshot({ path: path.join(outDir, `${code}__${view}.png`) });
    }
    // inside print as well, open half way
    await page.getByLabel("Print inside too").check();
    await page.locator("form").getByRole("button", { name: "Half", exact: true }).click();
    await page.locator("form").getByRole("button", { name: "iso", exact: true }).click();
    await page.waitForTimeout(1500);
    await v.screenshot({ path: path.join(outDir, `${code}__zhalf_inside.png`) });
    console.log(code);
  }
  await browser.close();
})();
