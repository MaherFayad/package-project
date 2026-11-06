// R5-PL-08 audit: no raw dictionary key on any screen, per role, including dialogs, menus, tabs,
// toasts and error states. Every non-GET request (API routes and server actions) is answered with a
// 500 so forms show their error state and NOTHING is written.
//   BASE=http://localhost:3000 DESIGN_ID=… SHARE=… OUT=/tmp/rawkeys.json node docs/audit/tools/rawkey-sweep.cjs
const { chromium } = require("playwright");
const fs = require("fs");
const BASE = process.env.BASE || "http://localhost:3000";
const NS = "auth|common|marketing|store|designer|library|checkout|buyer|orders|account|payment|pricing|viewer|preflight|nav|meta|admin|vendorPortal|catalog|materials|finishes|structures|cities|governorates|orderStatus|shipment|unsubscribe|home|vendors|paymentMethods|legal|notify";
const RAW = new RegExp(`\\b(?:${NS})\\.[a-zA-Z][\\w.]*[a-zA-Z0-9]\\b`, "g");
const PH = { buyer: "+201000000002", vendor: "+201000000010", admin: "+201000000001" };
const D = process.env.DESIGN_ID, S = process.env.SHARE;
const ROUTES = {
  anon: ["", "/catalog", "/boxes", "/bottles", "/vendors", "/login", "/design", "/design/mailer-box", "/design/round-bottle", `/s/${S}`, "/vendor/apply", "/legal/privacy", "/legal/cookies"],
  buyer: ["/account", "/orders", "/orders/ELB-26001", "/orders/ELB-26001/invoice", `/checkout/${D}`, "/design/mailer-box", "/design"],
  vendor: ["/vendor", "/vendor/jobs", "/vendor/profile", "/vendor/rate-cards", "/vendor/payouts"],
  admin: ["/admin", "/admin/orders", "/admin/quotes", "/admin/vendors", "/admin/vendors/applications", "/admin/disputes", "/admin/moderation", "/admin/payouts", "/admin/pricing", "/admin/catalog", "/admin/users", "/admin/privacy", "/admin/audit", "/admin/orders/ELB-26001"],
};
const SKIP_CLICK = /delete|remove|sign out|log out|cancel order|حذف|إزالة|تسجيل الخروج|إلغاء الطلب/i;
async function login(ctx, phone) {
  for (let k = 0; k < 5; k++) {
    const j = await (await ctx.request.post(BASE + "/api/auth/request-otp", { data: { phone } })).json().catch(() => ({}));
    if (j.devCode) { const v = await ctx.request.post(BASE + "/api/auth/verify-otp", { data: { phone, code: j.devCode, locale: "en", acceptTerms: true } }); if (v.ok()) return; }
    await new Promise((r) => setTimeout(r, ((j.retryAfterSec || 2) + 1) * 1000));
  }
  throw new Error("login " + phone);
}
const scan = (page) => page.evaluate((src) => {
  const re = new RegExp(src, "g");
  const txt = document.body.innerText + "\n" + [...document.querySelectorAll("[aria-label],[title],[placeholder],[alt]")].map((e) => [e.getAttribute("aria-label"), e.getAttribute("title"), e.getAttribute("placeholder"), e.getAttribute("alt")].join(" ")).join("\n") + "\n" + document.title;
  return [...new Set(txt.match(re) || [])];
}, RAW.source);
(async () => {
  const browser = await chromium.launch();
  const out = [];
  for (const role of Object.keys(ROUTES)) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    if (role !== "anon") await login(ctx, PH[role]);
    // block every write: API non-GET and server actions (POST with Next-Action)
    await ctx.route("**/*", (route) => {
      const r = route.request();
      if (r.method() !== "GET" && r.method() !== "HEAD" && !/\/api\/(auth|events)\b/.test(r.url())) return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "SERVER_ERROR" }) });
      return route.continue();
    });
    for (const locale of ["ar", "en"]) for (const path of ROUTES[role]) {
      const page = await ctx.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(String(e).slice(0, 140)));
      const url = `${BASE}/${locale}${path}`;
      const resp = await page.goto(url, { waitUntil: "load", timeout: 60000 }).catch(() => null);
      await page.waitForTimeout(1500);
      const found = new Set(await scan(page));
      let opened = 0, submitted = 0;
      // disclosures, menus, popovers, dialogs and tabs (not destructive)
      const triggers = page.locator('button[aria-haspopup], button[aria-expanded="false"], [role="tab"][aria-selected="false"], summary');
      const n = Math.min(await triggers.count(), 12);
      for (let i = 0; i < n; i++) {
        const t = triggers.nth(i);
        const label = ((await t.textContent().catch(() => "")) || "") + ((await t.getAttribute("aria-label").catch(() => "")) || "");
        if (SKIP_CLICK.test(label) || !(await t.isVisible().catch(() => false))) continue;
        await t.click({ timeout: 2000 }).catch(() => {});
        await page.waitForTimeout(300);
        for (const k of await scan(page)) found.add(k);
        opened++;
        await page.keyboard.press("Escape").catch(() => {});
      }
      // error states: submit the first form (all writes answer 500)
      const submit = page.locator('form button[type="submit"]:visible').first();
      if ((await submit.count()) && !SKIP_CLICK.test((await submit.textContent().catch(() => "")) || "")) {
        await submit.click({ timeout: 2000 }).catch(() => {});
        await page.waitForTimeout(1200);
        for (const k of await scan(page)) found.add(k);
        submitted++;
      }
      const row = { role, locale, path, status: resp ? resp.status() : -1, opened, submitted, raw: [...found], errors };
      out.push(row);
      console.log([role, locale, path || "/", row.status, `opened=${opened}`, `submitted=${submitted}`, row.raw.length ? "RAW:" + row.raw.join(",") : "", errors.join(" | ")].join(" "));
      await page.close();
    }
    await ctx.close();
  }
  await browser.close();
  if (process.env.OUT) fs.writeFileSync(process.env.OUT, JSON.stringify(out, null, 1));
  const bad = out.filter((r) => r.raw.length);
  console.log(bad.length ? `${bad.length} screens with raw keys` : "no raw keys");
})();
