// Page-level performance harness (production build). Report-only, touches no app code.
//
//   BASE=http://localhost:3000 OUT=/tmp/perf-pages.json SHOTS=docs/screenshots/audit/performance \
//   DESIGN_ID=... SHARE=... ORDER=ELB-26001 [ISOLATE=1] [PROFILES=phone] [LOCALES=ar] node docs/audit/tools/perf-pages.mjs [filter]
//
// Profiles
//   desktop: 1440x900, DPR 1, no throttling
//   phone:   390x844, DPR 2, touch, CPU 4x slowdown (CDP Emulation.setCPUThrottlingRate),
//            "Slow 4G" as in Chrome DevTools / Lighthouse devtools throttling:
//            562.5 ms RTT, 1.47 Mbps down, 0.68 Mbps up (Network.emulateNetworkConditions)
// Per page: TTFB, FCP, LCP (+ element), CLS (+ top shifting nodes), INP (Event Timing, max
// interaction duration over simulated clicks/keys), long tasks + TBT, transferred bytes by type,
// every image (format, bytes, natural vs rendered size), every font, JS requests.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE || "http://localhost:3000";
const OUT = process.env.OUT || "perf-pages.json";
const SHOTS = process.env.SHOTS || "";
const DESIGN_ID = process.env.DESIGN_ID;
const SHARE = process.env.SHARE;
const ORDER = process.env.ORDER || "ELB-26001";
const filter = process.argv[2] ? new RegExp(process.argv[2]) : null;
const PROFILES = (process.env.PROFILES || "desktop,phone").split(",");
const LOCALES = (process.env.LOCALES || "ar,en").split(",");

const PAGES = [
  { key: "home", path: "" },
  { key: "start", path: "/start" },
  { key: "designer-page", path: "/designer" },
  { key: "boxes", path: "/boxes" },
  { key: "bottles", path: "/bottles" },
  { key: "catalog", path: "/catalog" },
  { key: "vendors", path: "/vendors" },
  { key: "why-elba", path: "/why-elba" },
  { key: "pricing", path: "/pricing" },
  { key: "design-picker", path: "/design" },
  { key: "designer-box", path: "/design/mailer-box", threeD: true },
  { key: "designer-bottle", path: "/design/round-bottle", threeD: true },
  { key: "designer-pouch", path: "/design/stand-up-pouch", threeD: true },
  { key: "designer-fefco09", path: "/design/fefco-0920-compartment-liner-across", threeD: true },
  { key: "share", path: `/s/${SHARE}`, threeD: true },
  { key: "checkout", path: `/checkout/${DESIGN_ID}`, role: "buyer" },
  { key: "order-tracking", path: `/orders/${ORDER}`, role: "buyer" },
  { key: "account", path: "/account", role: "buyer" },
  // 404 renders (R6-RS-11): the first four are answered by the middleware's static 404, the last
  // two still go through notFound() (client-rendered in Next 15.5, see src/lib/routing/static-404.ts).
  { key: "404-missing", path: "/no-such-page" },
  { key: "404-share", path: "/s/no-such-token-123" },
  { key: "404-legal", path: "/legal/no-such-policy" },
  { key: "404-design", path: "/design/no-such-model" },
  { key: "404-catalog", path: "/catalog/no-such-model" },
  { key: "404-share-wellformed", path: "/s/aaaaaaaaaaaaaaaa" },
  { key: "vendor-portal", path: "/vendor", role: "vendor" },
  { key: "vendor-jobs", path: "/vendor/jobs", role: "vendor" },
  { key: "admin", path: "/admin", role: "admin" },
  { key: "admin-orders", path: "/admin/orders", role: "admin" },
];
const PHONES = { buyer: "+201000000002", vendor: "+201000000010", admin: "+201000000001" };

async function login(request, role) {
  const phone = PHONES[role];
  // Per-phone OTP limit is 1 per 30 s: wait and retry instead of failing the whole run.
  let devCode;
  for (let i = 0; i < 4 && !devCode; i++) {
    const r1 = await request.post(`${BASE}/api/auth/request-otp`, { data: { phone } });
    const j = await r1.json();
    devCode = j.devCode;
    if (!devCode) await new Promise((r) => setTimeout(r, ((j.retryAfterSec ?? 30) + 1) * 1000));
  }
  const r2 = await request.post(`${BASE}/api/auth/verify-otp`, { data: { phone, code: devCode, locale: "en", acceptTerms: true } });
  if (!r2.ok()) throw new Error(`login ${role} failed ${r2.status()}`);
}

const INIT = () => {
  const P = (window.__perf = { lcp: null, lcpEl: null, cls: 0, shifts: [], long: [], events: [], fcp: null });
  const sel = (n) => {
    if (!n || !n.tagName) return String(n && n.nodeName);
    let s = n.tagName.toLowerCase();
    if (n.id) s += "#" + n.id;
    if (n.className && typeof n.className === "string") s += "." + n.className.trim().split(/\s+/).slice(0, 2).join(".");
    return s;
  };
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        P.lcp = e.startTime;
        P.lcpEl = sel(e.element) + (e.url ? ` [${e.url.split("/").slice(-2).join("/")}]` : "") + ` size=${e.size}`;
      }
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        if (e.hadRecentInput) continue;
        P.cls += e.value;
        P.shifts.push({ t: Math.round(e.startTime), v: +e.value.toFixed(4), nodes: (e.sources || []).map((s) => sel(s.node)).slice(0, 3), rects: (e.sources || []).slice(0, 3).map((s) => `${Math.round(s.previousRect.x)},${Math.round(s.previousRect.y)} ${Math.round(s.previousRect.width)}x${Math.round(s.previousRect.height)} -> ${Math.round(s.currentRect.x)},${Math.round(s.currentRect.y)} ${Math.round(s.currentRect.width)}x${Math.round(s.currentRect.height)}`) });
      }
    }).observe({ type: "layout-shift", buffered: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) P.long.push({ t: Math.round(e.startTime), d: Math.round(e.duration) });
    }).observe({ type: "longtask", buffered: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) if (e.interactionId) P.events.push({ id: e.interactionId, name: e.name, d: e.duration, input: Math.round(e.processingStart - e.startTime), proc: Math.round(e.processingEnd - e.processingStart), target: sel(e.target) });
    }).observe({ type: "event", buffered: true, durationThreshold: 16 });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) if (e.name === "first-contentful-paint") P.fcp = e.startTime;
    }).observe({ type: "paint", buffered: true });
  } catch (e) {
    P.err = String(e);
  }
};

async function interact(page, isPhone) {
  // Clickable, non-navigating, non-destructive controls in the main content.
  const handles = await page.$$(
    'main button[type="button"]:not([disabled]), main [role="tab"], main summary, main input[type="checkbox"], main [aria-expanded]:not(a), main input[type="text"], main input[type="search"]',
  );
  let n = 0;
  for (const h of handles) {
    if (n >= 5) break;
    const ok = await h.evaluate((el) => {
      const t = (el.textContent || "") + (el.getAttribute("aria-label") || "");
      if (/logout|sign out|delete|remove|خروج|حذف|cancel|إلغاء|order|place|pay|ادفع|اطلب/i.test(t)) return false;
      if (el.closest("form") && el.getAttribute("type") === "submit") return false;
      const r = el.getBoundingClientRect();
      return r.width > 4 && r.height > 4 && r.top >= 0 && r.top < innerHeight * 2;
    }).catch(() => false);
    if (!ok) continue;
    try {
      await h.scrollIntoViewIfNeeded({ timeout: 2000 });
      const url = page.url();
      const tag = await h.evaluate((el) => el.tagName);
      if (tag === "INPUT") {
        await h.click({ timeout: 2000 });
        await page.keyboard.type("ab", { delay: 60 });
      } else if (isPhone) await h.tap({ timeout: 2000 });
      else await h.click({ timeout: 2000 });
      n++;
      await page.waitForTimeout(isPhone ? 900 : 400);
      if (page.url() !== url) break;
      await page.keyboard.press("Escape").catch(() => {});
    } catch {}
  }
  // keyboard interaction too
  await page.keyboard.press("Tab").catch(() => {});
  await page.waitForTimeout(400);
  return n;
}

async function runOne(browser, profile, locale, pg, storage) {
  const isPhone = profile === "phone";
  const ctx = await browser.newContext({
    viewport: isPhone ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    deviceScaleFactor: isPhone ? 2 : 1,
    isMobile: isPhone,
    hasTouch: isPhone,
    locale: locale === "ar" ? "ar-EG" : "en-US",
    storageState: storage,
  });
  await ctx.addInitScript(INIT);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  if (isPhone) {
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 562.5, downloadThroughput: (1.6 * 0.9 * 1024 * 1024) / 8, uploadThroughput: (750 * 0.9 * 1024) / 8 });
  }
  const reqs = new Map();
  cdp.on("Network.responseReceived", (e) => {
    reqs.set(e.requestId, { url: e.response.url, mime: e.response.mimeType, type: e.type, status: e.response.status, bytes: 0, fromCache: e.response.fromDiskCache });
  });
  cdp.on("Network.loadingFinished", (e) => {
    const r = reqs.get(e.requestId);
    if (r) r.bytes = e.encodedDataLength;
  });
  const url = `${BASE}/${locale}${pg.path}`;
  const t0 = Date.now();
  let status = 0;
  try {
    const resp = await page.goto(url, { waitUntil: "load", timeout: 90000 });
    status = resp?.status() ?? 0;
  } catch (e) {
    status = -1;
  }
  const loadMs = Date.now() - t0;
  // settle: wait for network quiet (or cap)
  await page.waitForLoadState("networkidle", { timeout: isPhone ? 30000 : 12000 }).catch(() => {});
  await page.waitForTimeout(isPhone ? 2500 : 1200);
  const pre = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    const P = window.__perf;
    const imgs = [...document.images].map((i) => {
      const r = i.getBoundingClientRect();
      return { src: i.currentSrc || i.src, nw: i.naturalWidth, nh: i.naturalHeight, w: Math.round(r.width), h: Math.round(r.height), loading: i.loading, fp: i.getAttribute("fetchpriority"), inView: r.top < innerHeight && r.bottom > 0, complete: i.complete };
    });
    return {
      ttfb: nav ? nav.responseStart - nav.startTime : null,
      domContentLoaded: nav ? nav.domContentLoadedEventEnd : null,
      loadEvent: nav ? nav.loadEventEnd : null,
      htmlTransfer: nav ? nav.transferSize : null,
      htmlDecoded: nav ? nav.decodedBodySize : null,
      lcp: P.lcp,
      lcpEl: P.lcpEl,
      fcp: P.fcp,
      clsLoad: P.cls,
      long: P.long.slice(),
      imgs,
      domNodes: document.getElementsByTagName("*").length,
      canvases: document.querySelectorAll("canvas").length,
      // Round 5 (R4-08): bytes of CSS inlined as <style> (experimental.inlineCss) and of the RSC
      // payload (self.__next_f chunks), UTF-8, uncompressed. rscCss = the part of the RSC payload
      // that repeats an inlined stylesheet (each <style>'s text found verbatim, JSON-escaped).
      ...(() => {
        const u8 = (s) => new TextEncoder().encode(s).length;
        const styles = [...document.querySelectorAll("style")].map((s) => s.textContent || "");
        const rsc = (self.__next_f || []).filter((x) => x[0] === 1 && typeof x[1] === "string").map((x) => x[1]).join("");
        let rscCss = 0;
        for (const css of styles) {
          if (css.length < 200) continue;
          const probe = JSON.stringify(css.slice(0, 120)).slice(1, -1);
          if (rsc.includes(probe) || rsc.includes(css.slice(0, 120))) rscCss += u8(css);
        }
        return { inlineCss: styles.reduce((a, s) => a + u8(s), 0), inlineStyleTags: styles.length, rsc: u8(rsc), rscCss };
      })(),
      fontsLoaded: [...document.fonts].filter((f) => f.status === "loaded").map((f) => `${f.family} ${f.weight}`),
    };
  });
  if (SHOTS && ((isPhone && locale === "ar") || (!isPhone && locale === "en"))) {
    fs.mkdirSync(SHOTS, { recursive: true });
    await page.screenshot({ path: path.join(SHOTS, `${pg.key}-${profile}-${locale}.png`), scale: "css" }).catch(() => {});
  }
  const clicks = await interact(page, isPhone);
  await page.waitForTimeout(800);
  const post = await page.evaluate(() => {
    const P = window.__perf;
    const by = new Map();
    for (const e of P.events) if (!by.has(e.id) || by.get(e.id).d < e.d) by.set(e.id, e);
    const inter = [...by.values()].sort((a, b) => b.d - a.d);
    return { cls: P.cls, shifts: P.shifts.sort((a, b) => b.v - a.v).slice(0, 5), inp: inter[0]?.d ?? null, inpDetail: inter.slice(0, 3), long: P.long };
  });
  const res = [...reqs.values()];
  const sum = (f) => res.filter(f).reduce((a, r) => a + r.bytes, 0);
  const isJs = (r) => r.type === "Script" || /javascript/.test(r.mime);
  const out = {
    page: pg.key,
    profile,
    locale,
    url,
    status,
    finalUrl: page.url(),
    loadMs,
    ...pre,
    lcp: pre.lcp,
    cls: post.cls,
    shifts: post.shifts,
    inp: post.inp,
    inpDetail: post.inpDetail,
    clicks,
    longTasks: post.long.length,
    longTaskMax: Math.max(0, ...post.long.map((l) => l.d)),
    tbt: post.long.reduce((a, l) => a + Math.max(0, l.d - 50), 0),
    tbtLoad: pre.long.filter((l) => l.t < (pre.loadEvent || 1e9) + 5000).reduce((a, l) => a + Math.max(0, l.d - 50), 0),
    bytes: {
      total: sum(() => true),
      js: sum(isJs),
      css: sum((r) => r.type === "Stylesheet"),
      img: sum((r) => r.type === "Image"),
      font: sum((r) => r.type === "Font"),
      doc: sum((r) => r.type === "Document"),
      fetch: sum((r) => r.type === "Fetch" || r.type === "XHR"),
    },
    requests: res.length,
    js: res.filter(isJs).map((r) => ({ f: r.url.replace(BASE, "").split("?")[0], b: r.bytes })).sort((a, b) => b.b - a.b),
    images: res.filter((r) => r.type === "Image").map((r) => ({ f: r.url.replace(BASE, ""), mime: r.mime, b: r.bytes })).sort((a, b) => b.b - a.b),
    fonts: res.filter((r) => r.type === "Font").map((r) => ({ f: r.url.replace(BASE, "").split("/").pop(), b: r.bytes })),
  };
  await ctx.close();
  return out;
}

const LAUNCH_ARGS = ["--enable-precise-memory-info", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"];
const browser = await chromium.launch({ args: LAUNCH_ARGS });
const storages = {};
// Log in only the roles the selected pages need (the OTP limit is 5 per phone per hour).
const needed = new Set(PAGES.filter((pg) => !filter || filter.test(pg.key)).map((pg) => pg.role).filter(Boolean));
for (const role of Object.keys(PHONES).filter((r) => needed.has(r))) {
  const ctx = await browser.newContext();
  await login(ctx.request, role);
  storages[role] = await ctx.storageState();
  await ctx.close();
}
const results = fs.existsSync(OUT) && process.env.APPEND ? JSON.parse(fs.readFileSync(OUT, "utf8")) : [];
for (const profile of PROFILES)
  for (const locale of LOCALES)
    for (const pg of PAGES.filter((p) => !process.env.ONLY || process.env.ONLY.split(",").includes(p.key))) {
      if (filter && !filter.test(pg.key)) continue;
      // ISOLATE=1: a fresh browser per page. Without it, a page measured right after a heavy
      // WebGL page (bottle, pouch) shares the GPU process with that page's teardown and its
      // FCP on the 4x-throttled phone profile can come out 2-3 s late (round 4).
      const br = process.env.ISOLATE ? await chromium.launch({ args: LAUNCH_ARGS }) : browser;
      const r = await runOne(br, profile, locale, pg, pg.role ? storages[pg.role] : undefined).catch((e) => ({ page: pg.key, profile, locale, error: String(e) }));
      if (br !== browser) await br.close();
      results.push(r);
      console.log(
        [profile, locale, pg.key, r.status, `ttfb=${Math.round(r.ttfb)}`, `fcp=${Math.round(r.fcp)}`, `lcp=${Math.round(r.lcp)}`, `cls=${r.cls?.toFixed(3)}`, `inp=${Math.round(r.inp ?? -1)}`, `tbt=${r.tbt}`, `js=${Math.round((r.bytes?.js ?? 0) / 1024)}KB`, `img=${Math.round((r.bytes?.img ?? 0) / 1024)}KB`, `font=${Math.round((r.bytes?.font ?? 0) / 1024)}KB`, `css=${Math.round((r.inlineCss ?? 0) / 1024)}KB`, `rsc=${Math.round((r.rsc ?? 0) / 1024)}KB`, r.error || ""].join(" "),
      );
      fs.writeFileSync(OUT, JSON.stringify(results, null, 1));
    }
await browser.close();
