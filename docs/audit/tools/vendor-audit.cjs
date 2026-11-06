/**
 * Vendor area audit sweep (key: vendor). Signs in by session row, screenshots every vendor route
 * in ar + en at 390x844 and 1440x900, runs axe (wcag2a/aa, 21aa, 22aa) and reports horizontal overflow.
 *   node docs/audit/tools/vendor-audit.cjs <outDir> [prefix] [baseURL]
 */
const { chromium } = require("playwright");
const { AxeBuilder } = require("@axe-core/playwright");
const { PrismaClient } = require("@prisma/client");
const { createHash, randomBytes } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const out = process.argv[2] || "shots";
const prefix = process.argv[3] || "r2";
const base = process.argv[4] || "http://localhost:3000";
const db = new PrismaClient({ datasources: { db: { url: process.env.ELBA_DATABASE_URL || `file:${path.resolve(__dirname, "../../../prisma/dev.db")}` } } });

async function token(phone) {
  const user = await db.user.findUniqueOrThrow({ where: { phone } });
  const t = randomBytes(32).toString("base64url");
  await db.session.create({ data: { tokenHash: createHash("sha256").update(t).digest("hex"), userId: user.id, expiresAt: new Date(Date.now() + 3600_000) } });
  return t;
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const vendorTok = await token("+201000000010");
  const applicantTok = await token("+201000000020");
  const vendor = await db.user.findUniqueOrThrow({ where: { phone: "+201000000010" }, include: { vendor: { include: { rateCards: { take: 1 }, orders: { select: { number: true, status: true } } } } } });
  const jobs = vendor.vendor.orders.map((o) => o.number);
  const routes = [
    ["vendor", "dash", "/vendor"],
    ["vendor", "jobs", "/vendor/jobs"],
    ...jobs.map((n) => ["vendor", `job-${n}`, `/vendor/jobs/${n}`]),
    ["vendor", "ratecards", "/vendor/rate-cards"],
    ["vendor", "ratecard", `/vendor/rate-cards/${vendor.vendor.rateCards[0].id}`],
    ["vendor", "payouts", "/vendor/payouts"],
    ["vendor", "profile", "/vendor/profile"],
    ["applicant", "apply", "/vendor/apply"],
  ];
  const only = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
  const browser = await chromium.launch();
  const report = [];
  for (const [who, name, route] of routes) {
    if (only && !only.test(name)) continue;
    for (const locale of ["ar", "en"]) {
      for (const [vw, w, h] of [["phone", 390, 844], ["desk", 1440, 900]]) {
        const ctx = await browser.newContext({ viewport: { width: w, height: h } });
        await ctx.addCookies([{ name: "elba_session", value: who === "vendor" ? vendorTok : applicantTok, url: base }]);
        const page = await ctx.newPage();
        const errors = [];
        page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 200)));
        page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
        const res = await page.goto(base + `/${locale}` + route, { waitUntil: "networkidle", timeout: 90000 });
        await page.waitForTimeout(400);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
        const file = `${prefix}-${name}-${locale}-${vw}.png`;
        await page.screenshot({ path: path.join(out, file), fullPage: true });
        report.push({ route, locale, vw, status: res && res.status(), overflow, axe: axe.violations.map((v) => `${v.impact} ${v.id} (${v.nodes.length}): ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`), errors });
        await ctx.close();
      }
    }
  }
  await browser.close();
  await db.$disconnect();
  for (const r of report) console.log(JSON.stringify(r));
})();
