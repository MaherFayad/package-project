/**
 * Admin round 8: the overview visitor funnel against a hand count. Reads every funnel event in
 * the last 30 days (staff left out), prints them grouped by person so the count can be checked by
 * hand, then reads the numbers the overview renders (en, 30 days) and prints both.
 *   node docs/audit/tools/admin-r8-funnel.cjs [baseURL]
 */
const { chromium } = require("playwright");
const { PrismaClient } = require("@prisma/client");
const { createHash, randomBytes } = require("node:crypto");
const base = process.argv[2] || "http://localhost:3100";
const db = new PrismaClient();
const STEPS = ["visit", "design_started", "gate_shown", "account_created", "price_viewed", "order_started", "payment_succeeded"];
(async () => {
  const staff = new Set((await db.user.findMany({ where: { role: { in: ["ADMIN", "VENDOR"] } }, select: { id: true } })).map((u) => u.id));
  const from = new Date(Date.now() - 30 * 86400e3);
  const ev = (await db.event.findMany({ where: { name: { in: STEPS }, at: { gte: from } }, select: { name: true, userId: true, anonId: true } })).filter((e) => !e.userId || !staff.has(e.userId));
  const groups = {};
  for (const e of ev) { const k = e.userId ? `user ${e.userId.slice(-6)}` : e.anonId ? `anon ${e.anonId.slice(-6)}` : "(no id)"; (groups[k] ??= []).push(e.name); }
  console.log("raw events by person:");
  for (const [k, v] of Object.entries(groups)) console.log(`  ${k}: ${v.join(", ")}`);
  const admin = await db.user.findUniqueOrThrow({ where: { phone: "+201000000001" } });
  const tok = randomBytes(32).toString("base64url");
  await db.session.create({ data: { tokenHash: createHash("sha256").update(tok).digest("hex"), userId: admin.id, expiresAt: new Date(Date.now() + 3600e3) } });
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await c.addCookies([{ name: "elba_session", value: tok, url: base }]);
  const p = await c.newPage();
  await p.goto(`${base}/en/admin?range=30d`, { waitUntil: "networkidle" });
  const table = await p.getByRole("table", { name: "Visitor funnel by step" }).locator("tbody tr").allInnerTexts().catch(() => []);
  const conv = await p.getByText(/Visitor to paid:/).first().innerText().catch(() => "(no conversion line)");
  console.log("rendered:", conv);
  for (const r of table) console.log("  ", r.replace(/\s+/g, " "));
  await b.close();
  await db.$disconnect();
})();
