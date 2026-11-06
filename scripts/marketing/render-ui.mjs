/**
 * UI mockups for the marketing kit (called by render-assets.mjs, stage "ui"). Real screens of the
 * running app, signed in with the seeded dev accounts, captured at 2x/3x DPR in ar and en, cropped to
 * one component and framed (rounded corners, soft drop shadow, transparent margin) for floating use.
 * Also builds the "process" pieces that come from our UI: price badge, phone showing the designer,
 * colour swatch card.
 */
import path from "node:path";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";

const PHONES = { admin: "+201000000001", buyer: "+201000000002", vendor: "+201000000010" };

async function login(ctx, base, who, locale) {
  const phone = PHONES[who];
  let devCode;
  for (let i = 0; i < 8 && !devCode; i++) {
    const j = await (await ctx.request.post(`${base}/api/auth/request-otp`, { data: { phone } })).json();
    devCode = j.devCode;
    if (!devCode) await new Promise((r) => setTimeout(r, ((j.retryAfterSec ?? 20) + 1) * 1000)); // OTP rate limit
  }
  const v = await ctx.request.post(`${base}/api/auth/verify-otp`, { data: { phone, code: devCode, locale, acceptTerms: true } });
  if (!v.ok()) throw new Error(`login ${who}: ${v.status()}`);
}

/** Rounded corners + soft shadow on a transparent margin. `radius` and `margin` in output px. */
async function frame(png, { radius = 28, margin = 48, shadow = 0.22 } = {}) {
  const m = await sharp(png).metadata();
  const { width: w, height: h } = m;
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${radius}" ry="${radius}" fill="#fff"/></svg>`);
  const rounded = await sharp(png).ensureAlpha().composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
  const W = w + margin * 2, H = h + margin * 2;
  const sh = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect x="${margin}" y="${margin + margin * 0.3}" width="${w}" height="${h}" rx="${radius}" fill="#000" fill-opacity="${shadow}"/></svg>`);
  const blurred = await sharp(sh).blur(margin / 2.6).png().toBuffer();
  return sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: blurred }, { input: rounded, left: margin, top: margin }])
    .png()
    .toBuffer();
}

/** A phone (rounded black bezel) around a 390x844 screenshot. */
async function phoneFrame(png) {
  const m = await sharp(png).metadata();
  const k = m.width / 390;
  const bez = Math.round(14 * k), r = Math.round(54 * k);
  const W = m.width + bez * 2, H = m.height + bez * 2;
  const screenMask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${m.width}" height="${m.height}"><rect width="${m.width}" height="${m.height}" rx="${r - bez}" fill="#fff"/></svg>`);
  const screen = await sharp(png).ensureAlpha().composite([{ input: screenMask, blend: "dest-in" }]).png().toBuffer();
  const body = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect width="${W}" height="${H}" rx="${r}" fill="#111"/><rect x="${k}" y="${k}" width="${W - 2 * k}" height="${H - 2 * k}" rx="${r - k}" fill="none" stroke="#3a3a3a" stroke-width="${1.5 * k}"/>
    </svg>`);
  const island = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect x="${W / 2 - 48 * k}" y="${bez + 10 * k}" width="${96 * k}" height="${28 * k}" rx="${14 * k}" fill="#000"/></svg>`);
  const phone = await sharp(body).composite([{ input: screen, left: bez, top: bez }, { input: island }]).png().toBuffer();
  return frame(phone, { radius: r, margin: Math.round(40 * k), shadow: 0.3 });
}

/** Give the box a brand colour and a text layer the way a buyer does (Artwork tab), then back to the 3D view. */
async function decorate(page, locale) {
  const en = locale === "en";
  const t = { timeout: 4000 };
  await page.getByRole("tab", { name: en ? "Artwork" : "التصميم" }).first().click(t).catch(() => {});
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: /#1f3d2b|Forest green|أخضر غامق/i }).first().click(t).catch(() => {});
  await page.getByRole("button", { name: en ? "Add text" : "إضافة نص" }).first().click(t).catch(() => {});
  await page.waitForTimeout(600);
  await page.getByText(en ? "3D" : "ثلاثي الأبعاد", { exact: true }).first().click(t).catch(() => {});
  await page.keyboard.press("Escape").catch(() => {});
  await page.mouse.move(0, 0);
  await page.waitForTimeout(5000);
}

/** Mark the element (or its closest Card) and screenshot it. */
async function grab(page, finder, pad = 0) {
  const ok = await page.evaluate(finder);
  if (!ok) return null;
  const el = page.locator("[data-r6-grab]").first();
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const box = await el.boundingBox();
  return page.screenshot({ clip: { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad), width: box.width + pad * 2, height: box.height + pad * 2 }, animations: "disabled" });
}

// the Card root (CSS-module class "...Card..." but not its Title/Header/Section/... parts)
const closestCard = (sel) => `(() => {
  const n = document.querySelector(${JSON.stringify(sel)});
  const isCard = (el) => [...el.classList].some((c) => /Card/.test(c) && !/Title|Header|Section|Inset|Footer|Actions|Body/.test(c));
  let c = n;
  while (c && !isCard(c)) c = c.parentElement;
  c = c || n;
  if (c) c.setAttribute("data-r6-grab", "");
  return !!c;
})()`;

export async function renderUi({ base, browser, out, emit, only = null }) {
  const want = (k) => !only || only.includes(k);
  process.env.ELBA_DATABASE_URL ??= "file:./as.db";
  const db = new PrismaClient();
  const buyer = await db.user.findFirst({ where: { phone: PHONES.buyer } });
  const design = await db.design.findFirst({ where: { ownerId: buyer.id }, orderBy: { updatedAt: "desc" } }).catch(() => db.design.findFirst());
  const order = await db.order.findFirst({ where: { buyerId: buyer.id, status: { in: ["IN_PRODUCTION", "SHIPPED", "QC_PENDING"] } } }).catch(() => db.order.findFirst({ where: { status: "IN_PRODUCTION" } }));
  await db.$disconnect();
  const results = [];
  const save = async (name, png, w1, h1, opts) => {
    await emit(png, path.join(out, name), w1, h1, { alpha: true, ...opts });
    results.push(name);
    console.log("ui", name);
  };
  const size = async (png, dpr) => {
    const m = await sharp(png).metadata();
    return [Math.round(m.width / dpr), Math.round(m.height / dpr)];
  };

  for (const locale of ["en", "ar"]) {
    // ---- buyer: designer, price badge, checkout summary, order timeline
    const DPR = 2;
    if (want("buyer")) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: DPR, locale: locale === "ar" ? "ar-EG" : "en-US", reducedMotion: "reduce" });
    await ctx.addCookies([{ name: "elba_cookie_ack", value: "1", url: base }]);
    await login(ctx, base, "buyer", locale);
    const page = await ctx.newPage();
    await page.goto(`${base}/${locale}/design/mailer-box`, { waitUntil: "networkidle", timeout: 180000 });
    await page.waitForSelector("[data-testid=stage-3d] canvas", { timeout: 120000 }).catch(() => {});
    await page.waitForSelector("[data-testid=price-badge][data-state=ready]", { timeout: 60000 }).catch(() => {});
    await decorate(page, locale);
    const designer = await page.screenshot({ animations: "disabled" });
    await save(`designer-${locale}`, await frame(designer, { radius: 40, margin: 80 }), 760, 490);
    const badge = await grab(page, `(() => { const b = document.querySelector("[data-testid=price-badge]"); if (b) b.setAttribute("data-r6-grab", ""); return !!b; })()`, 10);
    if (badge) {
      const [w, h] = await size(badge, DPR);
      await save(`price-badge-${locale}`, await frame(badge, { radius: 999 > h ? h * DPR / 2 : 24, margin: 36, shadow: 0.18 }), w + 36, h + 36);
    }
    if (design) {
      await page.goto(`${base}/${locale}/checkout/${design.id}`, { waitUntil: "networkidle", timeout: 180000 });
      await page.waitForTimeout(2500);
      const sum = await grab(page, closestCard("aside [id=summary-title]"));
      if (sum) {
        const [w, h] = await size(sum, DPR);
        await save(`checkout-summary-${locale}`, await frame(sum, { radius: 24, margin: 48 }), w + 48, h + 48);
      }
    }
    if (order) {
      await page.goto(`${base}/${locale}/orders/${order.id}`, { waitUntil: "networkidle", timeout: 180000 });
      await page.waitForTimeout(2000);
      const tl = await grab(page, closestCard('[class*="Timeline"]'));
      if (tl) {
        const [w, h] = await size(tl, DPR);
        const capped = h > 640 ? await sharp(tl).extract({ left: 0, top: 0, width: w * DPR, height: 640 * DPR }).png().toBuffer() : tl;
        await save(`order-timeline-${locale}`, await frame(capped, { radius: 24, margin: 48 }), w + 48, Math.min(h, 640) + 48);
      }
    }
    // ---- phone showing the designer (3x)
    const pctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
    await pctx.addCookies([{ name: "elba_cookie_ack", value: "1", url: base }]);
    await login(pctx, base, "buyer", locale);
    const pp = await pctx.newPage();
    await pp.goto(`${base}/${locale}/design/mailer-box`, { waitUntil: "networkidle", timeout: 180000 });
    await pp.waitForSelector("[data-testid=stage-3d] canvas", { timeout: 120000 }).catch(() => {});
    await decorate(pp, locale);
    const phone = await phoneFrame(await pp.screenshot({ animations: "disabled" }));
    const [pw, ph] = await size(phone, 3);
    await save(`phone-designer-${locale}`, phone, pw, ph);
    await pctx.close();
    await ctx.close();
    }

    // ---- vendor job card
    if (want("vendor")) {
    const vctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: DPR, reducedMotion: "reduce" });
    await vctx.addCookies([{ name: "elba_cookie_ack", value: "1", url: base }]);
    await login(vctx, base, "vendor", locale);
    const vp = await vctx.newPage();
    await vp.goto(`${base}/${locale}/vendor/jobs`, { waitUntil: "networkidle", timeout: 180000 });
    const href = await vp.locator(`a[href*="/vendor/jobs/"]`).first().getAttribute("href").catch(() => null);
    if (href) {
      await vp.goto(new URL(href, base).toString(), { waitUntil: "networkidle", timeout: 180000 });
      await vp.waitForTimeout(2000);
      const job = await grab(vp, closestCard('main [class*="Card"] h2, main [class*="Card"] h3'));
      if (job) {
        const [w, h] = await size(job, DPR);
        const capped = h > 560 ? await sharp(job).extract({ left: 0, top: 0, width: w * DPR, height: 560 * DPR }).png().toBuffer() : job;
        await save(`vendor-job-${locale}`, await frame(capped, { radius: 24, margin: 48 }), w + 48, Math.min(h, 560) + 48);
      }
    }
    await vctx.close();
    }

    // ---- admin KPI tile
    if (want("admin")) {
    const actx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: DPR, reducedMotion: "reduce" });
    await actx.addCookies([{ name: "elba_cookie_ack", value: "1", url: base }]);
    await login(actx, base, "admin", locale);
    const ap = await actx.newPage();
    await ap.goto(`${base}/${locale}/admin`, { waitUntil: "networkidle", timeout: 180000 });
    await ap.waitForTimeout(2000);
    const kpi = await grab(ap, `(() => { const m = [...document.querySelectorAll('section[class*="Metrics"] *')].find((el) => [...el.classList].some((c) => /(^|_)Metric(_|$)/.test(c))); if (m) { m.setAttribute("data-r6-grab", ""); Object.assign(m.style, { border: "0", boxShadow: "none", borderRadius: "0", background: "#fff" }); } return !!m; })()`, 0);
    if (kpi) {
      const [w, h] = await size(kpi, DPR);
      const trimX = 8 * DPR; // drop the strip dividers at the tile edges
      const kpiIn = await sharp(kpi).extract({ left: trimX, top: 0, width: w * DPR - trimX * 2, height: h * DPR }).png().toBuffer();
      const bg = await sharp(kpiIn).flatten({ background: "#ffffff" }).extend({ top: 24 * DPR, bottom: 24 * DPR, left: 28 * DPR, right: 28 * DPR, background: "#ffffff" }).png().toBuffer();
      await save(`admin-kpi-${locale}`, await frame(bg, { radius: 24, margin: 40 }), w + 56 + 40, h + 48 + 40);
    }
    await actx.close();
    }
  }
  if (!want("swatch")) return results;

  // ---- colour swatch card (process piece): the brand palette a buyer saves in the designer
  const sctx = await browser.newContext({ viewport: { width: 520, height: 360 }, deviceScaleFactor: 2 });
  const sp = await sctx.newPage();
  const sw = [["#2b1a12", "Roast"], ["#d08a3c", "Caramel"], ["#f3e3c7", "Crema"], ["#1f4d3a", "Nile"]];
  await sp.setContent(`<html><body style="margin:0;background:transparent;font-family:Inter,system-ui,sans-serif">
    <div id="c" style="width:440px;margin:24px;padding:20px;border-radius:20px;background:#fff;box-sizing:border-box">
      <div style="font-weight:600;font-size:15px;color:#303030;margin-bottom:14px">SAHWA · brand colours</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">${sw.map(([hex, n]) => `<div><div style="height:96px;border-radius:12px;background:${hex};box-shadow:inset 0 0 0 1px rgba(0,0,0,.08)"></div><div style="font-size:13px;font-weight:600;color:#303030;margin-top:8px">${n}</div><div style="font-size:12px;color:#616161;font-variant-numeric:tabular-nums">${hex.toUpperCase()}</div></div>`).join("")}</div>
    </div></body></html>`);
  const swatch = await sp.locator("#c").screenshot({ omitBackground: true });
  const [sw1, sh1] = await size(swatch, 2);
  await save("swatch-card", await frame(swatch, { radius: 40, margin: 48 }), sw1 + 48, sh1 + 48);
  await sctx.close();
  return results;
}
