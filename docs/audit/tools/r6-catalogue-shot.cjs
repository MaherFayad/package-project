const { chromium } = require("playwright");
const [out, ...codes] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" })).newPage();
  for (const c of codes) {
    await p.goto(`${process.env.BASE || "http://localhost:3100"}/en/dev/catalogue/${c}`, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => /ready|error/.test(document.querySelector('[data-testid="catalogue-render"]')?.getAttribute("data-state") || ""), null, { timeout: 60000 });
    await p.waitForTimeout(2500);
    await p.getByTestId("catalogue-render").screenshot({ path: `${out}/${c}__def__d_hero.png` });
    console.log(c);
  }
  await b.close();
})();
