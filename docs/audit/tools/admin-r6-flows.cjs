/**
 * Admin round 6: this round's flows end to end in the browser, phone (390, ar) and desktop
 * (1440, en): Send price (empty submit, valid submit, buyer link dialog), Priced view, Close on a
 * priced lead, bio queue Send back and Remove contact details dialogs. Reports page/dialog
 * overflow, axe inside dialogs, focus after each step, and saves screenshots.
 *   node docs/audit/tools/admin-r6-flows.cjs <outDir> [baseURL]
 * Mutates the DB (prices and closes the newest open lead): run on an audit DB.
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
  const vendor = await db.vendor.findFirst({ where: { status: "ACTIVE" }, orderBy: { nameEn: "asc" } });
  const b = await chromium.launch();
  const log = [];
  // FLOW_SIZES=ar:320,en:320 (round 9) overrides the default ar 390 + en 1440.
  const sizes = process.env.FLOW_SIZES ? process.env.FLOW_SIZES.split(",").map((x) => { const [l, w] = x.split(":"); return [l, Number(w), Number(w) < 768 ? 844 : 900]; }) : [["ar", 390, 844], ["en", 1440, 900]];
  for (const [loc, w, h] of sizes) {
    const ctx = await b.newContext({ viewport: { width: w, height: h } });
    await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: base });
    await ctx.addCookies([{ name: "elba_session", value: tok, url: base }]);
    const p = await ctx.newPage();
    const shot = (n) => p.screenshot({ path: path.join(out, `r6-${n}-${loc}-${w}.png`) });
    const check = async (step) => {
      const m = await p.evaluate(() => {
        const d = document.querySelector("[role=dialog]");
        const over = d ? [...d.querySelectorAll("*")].filter((e) => e.scrollWidth - e.clientWidth > 2 && getComputedStyle(e).overflowX !== "visible" && e.tagName !== "TEXTAREA").map((e) => e.className.slice(0, 30)).slice(0, 3) : [];
        const dr = d?.getBoundingClientRect();
        return { pageOverflow: document.documentElement.scrollWidth - innerWidth, dialogOut: dr ? Math.round(Math.max(0, dr.right - innerWidth, -dr.left)) : 0, scrollInDialog: over, focus: (document.activeElement?.getAttribute("aria-label") || document.activeElement?.textContent || document.activeElement?.tagName || "").trim().slice(0, 50) };
      });
      const axe = await new AxeBuilder({ page: p }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      log.push({ loc, w, step, ...m, axe: axe.violations.map((v) => `${v.id}(${v.nodes.length}) ${v.nodes[0]?.target.join(" ")}`) });
    };
    // Send price
    await p.goto(`${base}/${loc}/admin/quotes`, { waitUntil: "networkidle" });
    await p.getByRole("button", { name: loc === "ar" ? /^إرسال السعر:/ : /^Send price:/ }).first().click();
    const dlg = p.getByRole("dialog");
    await dlg.waitFor();
    await dlg.getByRole("button", { name: loc === "ar" ? "إرسال السعر" : "Send price", exact: true }).click();
    await p.waitForTimeout(300);
    await check("send-empty");
    await shot("send-empty");
    await dlg.getByRole("combobox").first().selectOption(vendor.id);
    const tb = dlg.getByRole("textbox");
    await tb.nth(1).fill("18,50"); // comma decimal: what does it do?
    await p.waitForTimeout(150);
    await check("send-comma");
    await shot("send-comma");
    await tb.nth(1).fill("18.5"); await tb.nth(2).fill("1500"); await tb.nth(5).fill("1200"); await tb.nth(6).fill("18"); await tb.nth(7).fill("76000");
    await dlg.getByRole("button", { name: loc === "ar" ? "إرسال السعر" : "Send price", exact: true }).click();
    await p.getByRole("dialog", { name: loc === "ar" ? "رابط العميل" : "Link for the buyer" }).waitFor({ timeout: 30000 });
    await p.waitForTimeout(300);
    await check("link-dialog");
    await shot("link-dialog");
    await p.getByRole("dialog").getByRole("button", { name: loc === "ar" ? "نسخ رابط العميل" : "Copy buyer link" }).click();
    const clip = await p.evaluate(() => navigator.clipboard.readText().catch(() => ""));
    log.push({ loc, w, step: "clipboard", clip });
    await p.getByRole("dialog").getByRole("button", { name: loc === "ar" ? "تم" : "Done" }).click();
    await p.waitForTimeout(300);
    await check("after-done");
    // Priced view + Close
    await p.getByRole("tab", { name: loc === "ar" ? /^المسعرة/ : /^Priced/ }).click();
    await p.waitForTimeout(400);
    await check("priced-view");
    await p.screenshot({ path: path.join(out, `r6-priced-view-${loc}-${w}.png`), fullPage: true });
    await p.getByRole("button", { name: loc === "ar" ? /^إغلاق:/ : /^Close:/ }).first().click();
    await p.getByRole("dialog").waitFor();
    await check("close-dialog");
    await shot("close-dialog");
    await p.getByRole("dialog").getByRole("textbox").fill(loc === "ar" ? "اختار العميل مطبعة أخرى" : "Buyer chose another supplier");
    await p.getByRole("dialog").getByRole("button", { name: loc === "ar" ? "إغلاق الطلب" : "Close request" }).click();
    await p.waitForTimeout(1200);
    await check("after-close");
    // Bio queue
    await p.goto(`${base}/${loc}/admin/moderation?tab=bios`, { waitUntil: "networkidle" });
    await p.getByRole("button", { name: loc === "ar" ? /^إعادة للمطبعة:/ : /^Send back:/ }).first().click();
    await p.getByRole("dialog").waitFor();
    await check("bio-send-back");
    await shot("bio-send-back");
    await p.keyboard.press("Escape");
    await p.waitForTimeout(300);
    await p.getByRole("button", { name: loc === "ar" ? "حذف بيانات التواصل" : "Remove contact details" }).first().click();
    await p.getByRole("dialog").waitFor();
    await check("bio-clean");
    await shot("bio-clean");
    await ctx.close();
  }
  await b.close();
  for (const l of log) console.log(JSON.stringify(l));
  await db.$disconnect();
})();
