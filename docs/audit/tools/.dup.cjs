const { chromium, devices } = require("playwright"); const { PrismaClient } = require("@prisma/client"); const { createHash, randomBytes } = require("node:crypto");
(async () => { const db = new PrismaClient(); const a = await db.user.findUniqueOrThrow({ where: { phone: "+201000000001" } }); const tok = randomBytes(32).toString("base64url");
  await db.session.create({ data: { tokenHash: createHash("sha256").update(tok).digest("hex"), userId: a.id, expiresAt: new Date(Date.now() + 3600e3) } });
  const o = await db.order.findFirst({ where: { status: "PAID" }, select: { number: true } });
  const b = await chromium.launch();
  for (let i = 0; i < 4; i++) {
    const c = await b.newContext({ ...devices["Pixel 5"], viewport: { width: 360, height: 780 } }); await c.addCookies([{ name: "elba_session", value: tok, url: "http://localhost:3100" }]);
    const p = await c.newPage(); const errs = []; p.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 300))); p.on("pageerror", (e) => errs.push(String(e).slice(0, 300)));
    const cdp = await c.newCDPSession(p); await cdp.send("Emulation.setCPUThrottlingRate", { rate: i % 2 ? 6 : 1 });
    await p.goto(`http://localhost:3100/ar/admin/orders/${o.number}`, { waitUntil: "networkidle" }); await p.waitForTimeout(1500);
    const info = await p.evaluate(() => [...document.querySelectorAll("[class*=Banner_Title]")].map((n) => ({ id: n.id, text: n.textContent.slice(0, 40), hidden: !!n.closest("[hidden]"), inMain: !!n.closest("main"), visible: !!n.offsetParent })));
    console.log(i, JSON.stringify(info), errs.slice(0, 3));
    await c.close(); }
  await b.close(); await db.$disconnect(); })();
