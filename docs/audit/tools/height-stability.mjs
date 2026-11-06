// Height stability (R6): document height before vs after a full scroll plus N Tabs, per page,
// locale and width. content-visibility:auto with a fixed intrinsic size makes pages grow as
// sections render. Also lists elements under <main> whose computed content-visibility is "auto".
//   BASE=http://localhost:3100 TABS=60 node docs/audit/tools/height-stability.mjs [/path ...]
import { chromium } from "playwright";
const BASE = process.env.BASE || "http://localhost:3100";
const TABS = Number(process.env.TABS || 60);
const PATHS = process.argv.slice(2).length ? process.argv.slice(2) : ["/catalog", "/boxes", "/boxes/mailer-box", "/boxes/mailer-box/250x180x80", "/catalog/bakery-box", "/bottles", "/vendors", "/vendors/nile-pack", "/legal/privacy", "/login", "/s/r6restyleShareToken01"];
const WIDTHS = [320, 390, 768, 1024, 1440];
const b = await chromium.launch();
for (const locale of ["ar", "en"]) for (const p of PATHS) {
  const row = { url: `/${locale}${p}`, cvAuto: 0, grow: {} };
  for (const w of WIDTHS) {
    const ctx = await b.newContext({ viewport: { width: w, height: w < 800 ? 844 : 900 } });
    await ctx.addCookies([{ name: "elba_cookie_ack", value: "1", url: BASE }]);
    const page = await ctx.newPage();
    await page.goto(BASE + row.url, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {});
    row.cvAuto = await page.evaluate(() => [...document.querySelectorAll("main *")].filter((e) => getComputedStyle(e).contentVisibility === "auto").length);
    const before = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.evaluate(async () => { const s = Math.round(innerHeight * 0.7); for (let y = 0; y < document.documentElement.scrollHeight; y += s) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } scrollTo(0, 0); });
    for (let i = 0; i < TABS; i++) await page.keyboard.press("Tab");
    const after = await page.evaluate(() => document.documentElement.scrollHeight);
    row.grow[w] = after - before;
    await ctx.close();
  }
  console.log(JSON.stringify(row));
}
await b.close();
