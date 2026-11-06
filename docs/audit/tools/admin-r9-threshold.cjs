/**
 * Admin round 9: the "Printer figures shown to buyers" setting at its edges. Saves 0, 51 and «٥»
 * (expect errors / 5), then 1 and 50 through the admin form, and after each save reads the vendor
 * rows, the public directory and profile (on-time text vs «جديد على علبة»), and the admin vendor
 * scorecard caption. Restores 5. Mutates settings: run on an audit database.
 *   node docs/audit/tools/admin-r9-threshold.cjs <outDir> [baseURL]
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
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addCookies([{ name: "elba_session", value: tok, url: base }]);
  const p = await ctx.newPage();
  const field = () => p.getByLabel("عدد عمليات التسليم قبل عرض نسبة الالتزام بالموعد");
  const save = async (v) => {
    await p.goto(`${base}/ar/admin/pricing`, { waitUntil: "networkidle" });
    await field().fill(v);
    await p.getByRole("form", { name: "أرقام المطابع المعروضة للعملاء" }).getByRole("button", { name: "حفظ" }).click();
    await p.waitForTimeout(2500);
    const err = await p.getByRole("form", { name: "أرقام المطابع المعروضة للعملاء" }).locator("[class*=InlineError]").allInnerTexts();
    const row = await db.platformSetting.findUnique({ where: { key: "vendor-metrics" } });
    return { typed: v, error: err[0] ?? null, stored: row?.value ?? null };
  };
  const pub = async (tag) => {
    const vs = await db.vendor.findMany({ select: { slug: true, onTimeJudged: true, onTimePublic: true, onTimePct: true }, orderBy: { slug: "asc" } });
    const c2 = await b.newContext({ viewport: { width: 390, height: 844 } });
    const q = await c2.newPage();
    await q.goto(`${base}/ar/vendors`, { waitUntil: "networkidle" });
    const dir = { newOnElba: await q.getByText("جديد على علبة").count(), pct: await q.getByText(/% في الموعد/).count() };
    await q.screenshot({ path: path.join(out, `r9-threshold-${tag}-directory.png`) });
    await c2.close();
    await p.goto(`${base}/ar/admin/vendors/nile-pack`, { waitUntil: "networkidle" });
    const caption = await p.getByText(/يرى العملاء «جديد على علبة»/).allInnerTexts();
    console.log(tag, JSON.stringify({ vendors: vs.map((v) => `${v.slug}:${v.onTimeJudged}/${v.onTimePublic ? "public" : "new"}/${v.onTimePct}`), dir, adminCaption: caption }));
  };
  for (const v of ["0", "51", "abc"]) console.log("save", JSON.stringify(await save(v)));
  console.log("save", JSON.stringify(await save("١")));
  await pub("min1");
  console.log("save", JSON.stringify(await save("50")));
  await pub("min50");
  console.log("save", JSON.stringify(await save("٥")));
  await pub("min5");
  await b.close();
  await db.$disconnect();
})();
