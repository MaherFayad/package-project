// Round 5 (R4-09): every not-found boundary renders styled, answers 404 and logs no console errors.
//   BASE=http://localhost:3000 SHOTS=docs/screenshots/audit/platform/r5c node docs/audit/tools/notfound-check.mjs
import { chromium, request } from "playwright";
import fs from "node:fs";
const BASE = process.env.BASE || "http://localhost:3000";
const SHOTS = process.env.SHOTS || "";
const CASES = [
  { key: "root", path: "/zz/not-a-locale/page", locale: null },
  { key: "missing", path: "/{l}/no-such-page" },
  { key: "store", path: "/{l}/bottles/no-such-bottle" },
  { key: "boxes-structure", path: "/{l}/boxes/no-such-style" },
  { key: "catalog", path: "/{l}/catalog/no-such-model" },
  { key: "vendors", path: "/{l}/vendors/no-such-printer" },
  { key: "legal", path: "/{l}/legal/no-such-policy" },
  { key: "locale-editor", path: "/{l}/design/no-such-model" },
  { key: "locale-share", path: "/{l}/s/no-such-token" },
  { key: "locale-order", path: "/{l}/orders/ELB-00000", role: "admin" },
  { key: "admin-order", path: "/{l}/admin/orders/ELB-00000", role: "admin" },
  { key: "admin-user", path: "/{l}/admin/users/no-such-user", role: "admin" },
  { key: "admin-vendor", path: "/{l}/admin/vendors/no-such-vendor", role: "admin" },
  { key: "admin-application", path: "/{l}/admin/vendors/applications/no-such-app", role: "admin" },
  { key: "admin-dispute", path: "/{l}/admin/disputes/no-such-dispute", role: "admin" },
];
async function login(phone) {
  const r = await request.newContext({ baseURL: BASE });
  let j = {};
  for (let i = 0; i < 4 && !j.devCode; i++) {
    j = await (await r.post("/api/auth/request-otp", { data: { phone } })).json().catch(() => ({}));
    if (!j.devCode) await new Promise((z) => setTimeout(z, ((j.retryAfterSec ?? 30) + 1) * 1000));
  }
  await r.post("/api/auth/verify-otp", { data: { phone, code: j.devCode, locale: "en", acceptTerms: true } });
  const s = await r.storageState();
  await r.dispose();
  return s;
}
const admin = await login("+201000000001");
const browser = await chromium.launch();
const rows = [];
for (const c of CASES)
  for (const l of c.locale === null ? ["-"] : ["ar", "en"])
    for (const vp of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
      const ctx = await browser.newContext({ viewport: vp, storageState: c.role ? admin : undefined });
      const page = await ctx.newPage();
      const errors = [];
      page.on("console", (m) => m.type() === "error" && !/status of 404/.test(m.text()) && errors.push(m.text().slice(0, 200)));
      page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 200)));
      const url = BASE + c.path.replace("{l}", l);
      const resp = await page.goto(url, { waitUntil: "networkidle" }).catch((e) => ({ status: () => -1, e }));
      const info = await page.evaluate(() => {
        const h = document.querySelector("h1");
        const cs = h ? getComputedStyle(h) : null;
        const sheets = [...document.styleSheets].length;
        return {
          title: document.title,
          lang: document.documentElement.lang,
          dir: document.documentElement.dir,
          h1: h?.textContent?.trim().slice(0, 60) ?? null,
          h1Font: cs?.fontFamily.split(",")[0] ?? null,
          h1Size: cs ? parseFloat(cs.fontSize) : 0,
          sheets,
          tokens: getComputedStyle(document.documentElement).getPropertyValue("--p-color-text").trim() !== "",
          overflow: document.documentElement.scrollWidth > innerWidth,
          mains: document.querySelectorAll("main").length,
        };
      });
      const styled = info.tokens && info.sheets > 0 && info.h1Size >= 18 && !/Times|serif$/i.test(info.h1Font || "Times");
      rows.push({ key: c.key, locale: l, w: vp.width, status: resp.status(), styled, ...info, errors });
      if (SHOTS && ((vp.width === 390 && l !== "en") || (vp.width === 1440 && l !== "ar"))) {
        fs.mkdirSync(SHOTS, { recursive: true });
        await page.screenshot({ path: `${SHOTS}/404-${c.key}-${l}-${vp.width}.png` });
      }
      console.log([c.key, l, vp.width, resp.status(), styled ? "styled" : "UNSTYLED", info.h1Font, info.h1Size, `main=${info.mains}`, info.overflow ? "OVERFLOW" : "", info.title, errors.join(" | ")].join(" "));
      await ctx.close();
    }
await browser.close();
if (process.env.OUT) fs.writeFileSync(process.env.OUT, JSON.stringify(rows, null, 1));
// SOFT: routes under a loading.tsx stream, so the status is already 200 when notFound() runs (R5-PL-03).
const SOFT = new Set(["locale-share", "locale-order", "admin-order", "admin-user", "admin-vendor", "admin-application", "admin-dispute"]);
const bad = rows.filter((r) => (r.status !== 404 && !SOFT.has(r.key)) || !r.styled || r.errors.length || r.overflow || r.mains !== 1);
console.log(bad.length ? `${bad.length} problem rows` : "all not-found pages OK");
process.exit(bad.length ? 1 : 0);
