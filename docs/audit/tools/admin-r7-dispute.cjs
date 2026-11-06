/**
 * Admin round 7: the dispute reprint form (R5-JR-09) at 390 ar and 1440 en: Reprint picked,
 * quantity and charge-back choices, partial amount, another printer. Reports overflow and axe,
 * saves screenshots. Read-only (never applies the decision).
 *   node docs/audit/tools/admin-r7-dispute.cjs <outDir> [baseURL]
 */
const { chromium } = require("playwright");
const { AxeBuilder } = require("@axe-core/playwright");
const { PrismaClient } = require("@prisma/client");
const { createHash, randomBytes } = require("node:crypto");
const path = require("node:path");
const fs = require("node:fs");
const out = process.argv[2] || "shots";
const base = process.argv[3] || "http://localhost:3100";
const db = new PrismaClient();
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const admin = await db.user.findUniqueOrThrow({ where: { phone: "+201000000001" } });
  const tok = randomBytes(32).toString("base64url");
  await db.session.create({ data: { tokenHash: createHash("sha256").update(tok).digest("hex"), userId: admin.id, expiresAt: new Date(Date.now() + 3600_000) } });
  const dispute = await db.dispute.findFirstOrThrow({ where: { status: { in: ["OPEN", "UNDER_REVIEW"] } } });
  const b = await chromium.launch();
  for (const [loc, w, h] of [["ar", 390, 844], ["en", 1440, 900]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h } });
    await ctx.addCookies([{ name: "elba_session", value: tok, url: base }]);
    const p = await ctx.newPage();
    await p.goto(`${base}/${loc}/admin/disputes/${dispute.id}`, { waitUntil: "networkidle" });
    await p.getByRole("radio", { name: loc === "ar" ? "إعادة الطباعة" : "Reprint" }).check().catch(async () => p.locator("input[type=radio][value=REPRINT]").check());
    await p.waitForTimeout(200);
    const report = async (step) => {
      const axe = await new AxeBuilder({ page: p }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      const m = await p.evaluate(() => ({ overflow: document.documentElement.scrollWidth - innerWidth, summary: [...document.querySelectorAll("[aria-live=polite]")].map((e) => e.textContent.trim()).filter(Boolean).slice(-1)[0] ?? "" }));
      console.log(JSON.stringify({ loc, w, step, ...m, axe: axe.violations.map((v) => `${v.id}(${v.nodes.length})`) }));
    };
    await report("reprint");
    await p.screenshot({ path: path.join(out, `r7-dispute-reprint-${loc}-${w}.png`), fullPage: true });
    await p.locator("input[type=radio][value=PARTIAL]").check();
    await p.getByRole("textbox").nth(1).fill("250");
    await p.waitForTimeout(150);
    await report("partial");
    await p.screenshot({ path: path.join(out, `r7-dispute-partial-${loc}-${w}.png`), fullPage: true });
    await ctx.close();
  }
  await b.close();
  await db.$disconnect();
})();
