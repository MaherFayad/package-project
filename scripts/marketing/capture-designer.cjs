/** Screenshot the real 3D designer for the "Design in 3D" band: node scripts/marketing/capture-designer.cjs http://localhost:3520 */
const { chromium } = require("playwright");
const sharp = require("sharp");
(async () => {
  const base = process.argv[2];
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  for (const locale of ["en", "ar"]) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    await ctx.addCookies([{ name: "elba_cookie_ack", value: "1", url: base }]);
    const page = await ctx.newPage();
    await page.goto(`${base}/${locale}/design/mailer-box`, { waitUntil: "networkidle", timeout: 120000 });
    await page.waitForTimeout(4000);
    const en = locale === "en";
    await page.getByRole("tab", { name: en ? "Artwork" : "التصميم" }).click().catch(() => {});
    await page.getByRole("button", { name: /#1f3d2b/ }).first().click().catch(() => {});
    await page.getByRole("button", { name: en ? "Add text" : "إضافة نص" }).click().catch(() => {});
    await page.getByText(en ? "3D" : "ثلاثي الأبعاد", { exact: true }).first().click().catch(() => {});
    await page.mouse.move(0, 0);
    await page.waitForTimeout(4000);
    const png = await page.screenshot();
    await sharp(png).resize({ width: 1440 }).webp({ quality: 80 }).toFile(`public/marketing/designer-${locale}.webp`);
    console.log(locale);
    await ctx.close();
  }
  await browser.close();
})();
