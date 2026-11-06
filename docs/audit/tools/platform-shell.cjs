// Round 5c platform shell pass: chrome, skip link, locale switch, landmarks, axe, overflow, console.
//   BASE=http://localhost:3000 OUT=/tmp/shell.json SHOTS=docs/screenshots/audit/platform/r5c node docs/audit/tools/platform-shell.cjs
const { chromium } = require("playwright");
const { AxeBuilder } = require("@axe-core/playwright");
const fs = require("fs");
const BASE = process.env.BASE || "http://localhost:3000";
const SHOTS = process.env.SHOTS || "";
const PAGES = [
  { key: "home", path: "" }, { key: "catalog", path: "/catalog?family=boxes" }, { key: "boxes", path: "/boxes" },
  { key: "vendors", path: "/vendors" }, { key: "legal", path: "/legal/privacy" }, { key: "login", path: "/login" },
  { key: "design", path: "/design" }, { key: "vendor-apply", path: "/vendor/apply" },
  { key: "account", path: "/account", role: "buyer" }, { key: "orders", path: "/orders", role: "buyer" },
  { key: "admin", path: "/admin", role: "admin" }, { key: "vendor", path: "/vendor", role: "vendor" },
];
const PHONES = { buyer: "+201000000002", vendor: "+201000000010", admin: "+201000000001" };
async function login(ctx, phone) {
  for (let k = 0; k < 5; k++) {
    const j = await (await ctx.request.post(BASE + "/api/auth/request-otp", { data: { phone } })).json().catch(() => ({}));
    if (j.devCode) { const v = await ctx.request.post(BASE + "/api/auth/verify-otp", { data: { phone, code: j.devCode, locale: "en", acceptTerms: true } }); if (v.ok()) return; }
    await new Promise((r) => setTimeout(r, ((j.retryAfterSec || 2) + 1) * 1000));
  }
  throw new Error("login " + phone);
}
(async () => {
  const browser = await chromium.launch();
  const states = {};
  for (const role of Object.keys(PHONES)) { const c = await browser.newContext(); await login(c, PHONES[role]); states[role] = await c.storageState(); await c.close(); }
  const rows = [];
  for (const pg of PAGES) for (const locale of ["ar", "en"]) for (const vp of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    const ctx = await browser.newContext({ viewport: vp, storageState: pg.role ? states[pg.role] : undefined, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    const errors = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 160)));
    page.on("pageerror", (e) => errors.push("pageerror " + String(e).slice(0, 160)));
    const r = await page.goto(`${BASE}/${locale}${pg.path}`, { waitUntil: "networkidle" }).catch(() => null);
    const info = await page.evaluate(() => {
      const skip = document.querySelector("a.skip-link");
      const target = skip ? document.querySelector(skip.getAttribute("href")) : null;
      const lang = [...document.querySelectorAll("a[hreflang]")].filter((a) => a.offsetParent !== null || a.getClientRects().length);
      const running = document.getAnimations().filter((a) => a.playState === "running" && a.effect && a.effect.getTiming().duration > 50 && a.effect.getTiming().iterations === Infinity);
      return {
        lang: document.documentElement.lang, dir: document.documentElement.dir, title: document.title,
        mains: document.querySelectorAll("main").length, h1: document.querySelectorAll("h1").length,
        skip: !!skip, skipTarget: !!target, langLinks: lang.map((a) => a.getAttribute("href")),
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        loopsUnderReduce: running.map((a) => (a.animationName || a.constructor.name) + "@" + (a.effect.target?.className?.toString?.().slice(0, 40) || "")),
      };
    });
    // keyboard: first Tab lands on the skip link, Enter moves focus into <main>
    await page.keyboard.press("Tab");
    const firstFocus = await page.evaluate(() => document.activeElement?.className?.toString() || document.activeElement?.tagName);
    await page.keyboard.press("Enter");
    const afterSkip = await page.evaluate(() => !!document.activeElement?.closest("main") || document.activeElement?.id === "main");
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    const v = axe.violations.map((x) => `${x.id}(${x.nodes.length})`);
    if (SHOTS && ((vp.width === 390 && locale === "ar") || (vp.width === 1440 && locale === "en"))) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: `${SHOTS}/shell-${pg.key}-${locale}-${vp.width}.png` }); }
    const row = { key: pg.key, locale, w: vp.width, status: r ? r.status() : -1, ...info, firstFocus, afterSkip, axe: v, errors };
    rows.push(row);
    console.log([pg.key, locale, vp.width, row.status, `lang=${info.lang}/${info.dir}`, `main=${info.mains}`, `h1=${info.h1}`, `skip=${info.skip && info.skipTarget}`, `tab1=${firstFocus}`, `skipEnter=${afterSkip}`, info.overflow ? "OVERFLOW" : "", `langLinks=${info.langLinks.join(",")}`, `axe=${v.join(",") || 0}`, info.loopsUnderReduce.length ? "LOOPS:" + info.loopsUnderReduce.join(",") : "", errors.join(" | ")].join(" "));
    await ctx.close();
  }
  // locale switch keeps path and query (client navigation)
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/ar/catalog?family=boxes`, { waitUntil: "networkidle" });
  await page.locator("header a[hreflang=en]").first().click();
  await page.waitForURL(/\/en\/catalog/);
  await page.waitForLoadState("networkidle");
  const sw = { url: page.url().replace(BASE, ""), lang: await page.evaluate(() => document.documentElement.lang + "/" + document.documentElement.dir), cookie: (await ctx.cookies()).find((c) => c.name.includes("locale"))?.value };
  console.log("locale switch:", JSON.stringify(sw));
  await browser.close();
  if (process.env.OUT) fs.writeFileSync(process.env.OUT, JSON.stringify({ rows, sw }, null, 1));
})();
