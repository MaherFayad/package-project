/**
 * Admin console audit sweep (key: admin, round 5). Signs in as the seeded admin by session row,
 * visits every admin route in ar + en at 390x844 and 1440x900, runs axe (wcag2a/aa, 21aa, 22aa),
 * and reports horizontal page overflow, console errors, badges that wrap onto 2+ lines and table
 * scroll regions wider than their box (sideways scroll inside a card).
 *   node docs/audit/tools/admin-audit.cjs <outDir> [prefix] [baseURL]   (SHOTS=1 saves screenshots)
 */
const { chromium } = require("playwright");
const { AxeBuilder } = require("@axe-core/playwright");
const { PrismaClient } = require("@prisma/client");
const { createHash, randomBytes } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const out = process.argv[2] || "shots";
const prefix = process.argv[3] || "r5";
const base = process.argv[4] || "http://localhost:3100";
const db = new PrismaClient();

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const admin = await db.user.findUniqueOrThrow({ where: { phone: "+201000000001" } });
  const tok = randomBytes(32).toString("base64url");
  await db.session.create({ data: { tokenHash: createHash("sha256").update(tok).digest("hex"), userId: admin.id, expiresAt: new Date(Date.now() + 3600_000) } });
  const order = await db.order.findFirst({ orderBy: { placedAt: "desc" }, select: { number: true } });
  const vendor = await db.vendor.findFirst({ where: { status: "ACTIVE" }, select: { slug: true } });
  const user = await db.user.findFirst({ where: { role: "BUYER" }, select: { id: true } });
  const dispute = await db.dispute.findFirst({ select: { id: true } });
  const app = await db.vendorApplication.findFirst({ select: { id: true } }).catch(() => null);
  const routes = [
    ["overview", "/admin"], ["orders", "/admin/orders"], ["order", `/admin/orders/${order.number}`], ["quotes", "/admin/quotes"], ["quotes-priced", "/admin/quotes?view=priced"],
    ["moderation", "/admin/moderation"], ["moderation-bios", "/admin/moderation?tab=bios"], ["moderation-text", "/admin/moderation?tab=text"],
    ["vendors", "/admin/vendors"], ["vendor", `/admin/vendors/${vendor.slug}`], ...(app ? [["application", `/admin/vendors/applications/${app.id}`]] : []),
    ["users", "/admin/users"], ["user", `/admin/users/${user.id}`], ["catalog", "/admin/catalog"], ["pricing", "/admin/pricing"], ["payouts", "/admin/payouts"],
    ["disputes", "/admin/disputes"], ...(dispute ? [["dispute", `/admin/disputes/${dispute.id}`]] : []), ["audit", "/admin/audit"], ["privacy", "/admin/privacy"],
  ];
  const only = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
  const browser = await chromium.launch();
  const report = [];
  for (const [name, route] of routes) {
    if (only && !only.test(name)) continue;
    for (const locale of ["ar", "en"]) {
      for (const [vw, w, h] of [["phone", 390, 844], ["desk", 1440, 900]]) {
        const ctx = await browser.newContext({ viewport: { width: w, height: h } });
        await ctx.addCookies([{ name: "elba_session", value: tok, url: base }]);
        const page = await ctx.newPage();
        const errors = [];
        page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 160)));
        page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
        const res = await page.goto(`${base}/${locale}${route}`, { waitUntil: "networkidle", timeout: 90000 });
        await page.waitForTimeout(300);
        const m = await page.evaluate(() => {
          const overflow = document.documentElement.scrollWidth - window.innerWidth;
          const wrapped = [...document.querySelectorAll("main [class*='Badge_Badge']")].filter((b) => b.offsetParent && b.getClientRects().length && b.getBoundingClientRect().height > 30).map((b) => b.textContent.trim().slice(0, 40));
          const scrolls = [...document.querySelectorAll("main [role='region'][tabindex='0']")].filter((r) => r.scrollWidth - r.clientWidth > 2).map((r) => `${r.getAttribute("aria-label")}:${r.scrollWidth - r.clientWidth}`);
          return { overflow, wrapped, scrolls };
        });
        const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
        if (process.env.SHOTS) await page.screenshot({ path: path.join(out, `${prefix}-${name}-${locale}-${vw}.png`), fullPage: true });
        report.push({ name, locale, vw, status: res && res.status(), ...m, axe: axe.violations.map((v) => `${v.impact} ${v.id} (${v.nodes.length}): ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`), errors });
        await ctx.close();
      }
    }
  }
  await browser.close();
  fs.writeFileSync(path.join(out, `${prefix}-report.json`), JSON.stringify(report, null, 2));
  const bad = report.filter((r) => r.overflow > 0 || r.axe.length || r.errors.length || r.wrapped.length || r.scrolls.length || r.status !== 200);
  console.log(`${report.length} page views; ${bad.length} with issues`);
  for (const r of bad) console.log(JSON.stringify(r));
  await db.$disconnect();
})();
