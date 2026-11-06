/**
 * Admin round 8: reprint form maths at 390 ar with Arabic digits. Types quantities and partial
 * charge-back amounts (Arabic-Indic digits, «٫», grouped thousands, a decimal comma, over the
 * reprint cost), prints the live summary or the field error for each, then applies one partial
 * decision and compares the stored plan with the preview. Mutates the open seeded dispute: run on
 * an audit database.
 *   node docs/audit/tools/admin-r8-chargeback.cjs <outDir> [baseURL]
 */
const { chromium } = require("playwright");
const { PrismaClient } = require("@prisma/client");
const { createHash, randomBytes } = require("node:crypto");
const path = require("node:path");
const out = process.argv[2] || ".";
const base = process.argv[3] || "http://localhost:3100";
const db = new PrismaClient();
(async () => {
  const admin = await db.user.findUniqueOrThrow({ where: { phone: "+201000000001" } });
  const tok = randomBytes(32).toString("base64url");
  await db.session.create({ data: { tokenHash: createHash("sha256").update(tok).digest("hex"), userId: admin.id, expiresAt: new Date(Date.now() + 3600e3) } });
  const d = await db.dispute.findFirstOrThrow({ where: { status: { in: ["OPEN", "UNDER_REVIEW"] } }, include: { order: { include: { items: true } } } });
  const qty = d.order.items.reduce((s, i) => s + i.quantity, 0);
  console.log(`order ${d.order.number}: ${qty} boxes, buy price ${(d.order.vendorCostPiasters / 100).toFixed(2)}`);
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 390, height: 844 } });
  await c.addCookies([{ name: "elba_session", value: tok, url: base }]);
  const p = await c.newPage();
  await p.goto(`${base}/ar/admin/disputes/${d.id}`, { waitUntil: "networkidle" });
  await p.locator("input[type=radio][value=REPRINT]").check();
  const qtyBox = p.getByLabel("عدد العلب المعاد طباعتها");
  const read = async () => {
    await p.waitForTimeout(120);
    const live = await p.locator("[aria-live=polite]").last().innerText().catch(() => "");
    const errs = await p.locator("[id$='Error'], [class*='InlineError']").allInnerTexts().catch(() => []);
    return { live: live.trim(), errors: errs.map((e) => e.trim()).filter(Boolean) };
  };
  for (const q of ["٤٠", "40", "٠", String(qty + 1), "4,0"]) { await qtyBox.fill(q); console.log(`qty ${q}:`, JSON.stringify(await read())); }
  await qtyBox.fill("٤٠");
  await p.locator("input[type=radio][value=PARTIAL]").check();
  const amount = p.getByLabel("المبلغ المحمل بدون الضريبة (ج.م)");
  for (const a of ["١٢٣٫٤٥", "123.45", "1,000.50", "١٢٣,٤٥", "99999", "-5"]) { await amount.fill(a); console.log(`partial ${a}:`, JSON.stringify(await read())); }
  await amount.fill("١٢٣٫٤٥");
  const preview = (await read()).live;
  await p.screenshot({ path: path.join(out, "r8-chargeback-ar-390.png"), fullPage: true });
  await p.getByLabel("ملاحظة الحل").fill("إعادة طباعة 40 علبة مع تحميل جزئي");
  await p.getByRole("button", { name: "تطبيق القرار" }).click();
  await p.waitForTimeout(2500);
  const audit = await db.auditLog.findFirst({ where: { action: "ORDER_REPRINT", summary: { contains: d.order.number } }, orderBy: { createdAt: "desc" } });
  console.log("preview:", preview);
  console.log("stored plan:", JSON.stringify(audit?.after));
  await b.close();
  await db.$disconnect();
})();
