/**
 * Admin round 6: condensed tables between 320 and 490 px. For each admin route with a table, in
 * ar and en at 320, 360, 414 and 489 px: page overflow, elements cut by the viewport, table
 * regions scrolling sideways, interactive targets under 24x24 px (WCAG 2.5.8), stacked labels
 * that overlap their values, and axe.
 *   node docs/audit/tools/admin-r6-narrow.cjs <outDir> [baseURL]   (SHOTS=1 saves screenshots)
 */
const { chromium } = require("playwright");
const { AxeBuilder } = require("@axe-core/playwright");
const { PrismaClient } = require("@prisma/client");
const { createHash, randomBytes } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const out = process.argv[2] || "shots";
const base = process.argv[3] || "http://localhost:3100";
const db = new PrismaClient();
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const admin = await db.user.findUniqueOrThrow({ where: { phone: "+201000000001" } });
  const tok = randomBytes(32).toString("base64url");
  await db.session.create({ data: { tokenHash: createHash("sha256").update(tok).digest("hex"), userId: admin.id, expiresAt: new Date(Date.now() + 3600_000) } });
  const vendor = await db.vendor.findFirst({ where: { status: "ACTIVE" }, select: { slug: true } });
  const user = await db.user.findFirst({ where: { role: "BUYER" }, select: { id: true } });
  const routes = [
    ["overview", "/admin"], ["orders", "/admin/orders"], ["quotes", "/admin/quotes"], ["quotes-priced", "/admin/quotes?view=priced"], ["quotes-all", "/admin/quotes?view=all"],
    ["payouts", "/admin/payouts?view=all"], ["vendors", "/admin/vendors"], ["vendor", `/admin/vendors/${vendor.slug}`], ["users", "/admin/users"], ["user", `/admin/users/${user.id}`],
    ["catalog", "/admin/catalog"], ["pricing", "/admin/pricing"], ["disputes", "/admin/disputes"], ["audit", "/admin/audit"], ["moderation-bios", "/admin/moderation?tab=bios"],
  ];
  const browser = await chromium.launch();
  const report = [];
  for (const [name, route] of routes) for (const locale of ["ar", "en"]) for (const w of [320, 360, 414, 489]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 800 } });
    await ctx.addCookies([{ name: "elba_session", value: tok, url: base }]);
    const page = await ctx.newPage();
    await page.goto(`${base}/${locale}${route}`, { waitUntil: "networkidle", timeout: 90000 });
    await page.waitForTimeout(200);
    const m = await page.evaluate(() => {
      const vw = window.innerWidth;
      const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && !e.closest("[aria-hidden=true],.visually-hidden"); };
      const main = document.querySelector("main") || document.body;
      const cut = [...main.querySelectorAll("a,button,input,select,textarea,[class*='Badge_Badge'],td,th")].filter(vis).filter((e) => !e.closest("thead,[role=tablist]")).filter((e) => { const r = e.getBoundingClientRect(); return r.right > vw + 1 || r.left < -1; }).slice(0, 4).map((e) => `${e.tagName}:${(e.textContent || "").trim().slice(0, 30)}`);
      const scrolls = [...main.querySelectorAll("[role='region'][tabindex='0']")].filter((r) => r.scrollWidth - r.clientWidth > 2).map((r) => `${r.getAttribute("aria-label")}:${r.scrollWidth - r.clientWidth}`);
      const small = [...main.querySelectorAll("a,button,input,select,[role=tab],summary")].filter(vis).filter((e) => { const r = e.getBoundingClientRect(); if (r.width >= 24 && r.height >= 24) return false; if (e.tagName === "A" && e.closest("p,li,td span,[class*=Text]") && getComputedStyle(e).display === "inline") return false; return true; }).slice(0, 4).map((e) => `${e.tagName}:${(e.getAttribute("aria-label") || e.textContent || "").trim().slice(0, 30)}:${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`);
      const overlap = [...main.querySelectorAll("[class*='StackLabel']")].filter(vis).filter((l) => { const v = l.nextElementSibling; if (!v) return false; const a = l.getBoundingClientRect(), b = v.getBoundingClientRect(); const xo = Math.min(a.right, b.right) - Math.max(a.left, b.left); const yo = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top); return xo > 2 && yo > 2; }).slice(0, 3).map((l) => l.textContent.trim());
      return { overflow: document.documentElement.scrollWidth - vw, cut, scrolls, small, overlap };
    });
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    if (process.env.SHOTS && (w === 320 || w === 489)) await page.screenshot({ path: path.join(out, `r6-${name}-${locale}-${w}.png`), fullPage: true });
    report.push({ name, locale, w, ...m, axe: axe.violations.map((v) => `${v.id}(${v.nodes.length}) ${v.nodes[0]?.target.join(" ")}`) });
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(out, "r6-narrow.json"), JSON.stringify(report, null, 2));
  const bad = report.filter((r) => r.overflow > 0 || r.cut.length || r.scrolls.length || r.small.length || r.overlap.length || r.axe.length);
  console.log(`${report.length} page views; ${bad.length} with issues`);
  for (const r of bad) console.log(JSON.stringify(r));
  await db.$disconnect();
})();
