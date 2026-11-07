// Lean repeat probe for CLS / LCP under the perf-pages phone profile (390x844 DPR 2, 4x CPU,
// Slow 4G, cache disabled, a fresh browser per run). No interactions, so it is several times faster
// than perf-pages.mjs; layout shifts with recent input are excluded the same way.
//   U=/ar/why-elba N=8 [PH=+201000000002] node docs/audit/tools/cls-repeat.mjs
import { chromium } from "playwright";
const BASE = process.env.BASE || "http://localhost:3000";
const U = process.env.U || "/ar";
const N = +(process.env.N || 8);
let storageState;
if (process.env.PH) {
  const b = await chromium.launch(); const c = await b.newContext();
  for (let i = 0; i < 4; i++) { const j = await (await c.request.post(BASE + "/api/auth/request-otp", { data: { phone: process.env.PH } })).json(); if (j.devCode) { await c.request.post(BASE + "/api/auth/verify-otp", { data: { phone: process.env.PH, code: j.devCode, locale: "en", acceptTerms: true } }); break; } await new Promise((r) => setTimeout(r, ((j.retryAfterSec ?? 30) + 1) * 1000)); }
  storageState = await c.storageState(); await b.close();
}
const rows = [];
for (let i = 0; i < N; i++) {
  const b = await chromium.launch({ args: ["--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: U.startsWith("/ar") ? "ar-EG" : "en-US", storageState });
  await ctx.addInitScript(() => {
    window.__c = { cls: 0, lcp: 0, shifts: [] };
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) { window.__c.cls += e.value; window.__c.shifts.push(Math.round(e.startTime) + ":" + e.value.toFixed(3)); } }).observe({ type: "layout-shift", buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__c.lcp = e.startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
  });
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  await cdp.send("Network.enable"); await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 562.5, downloadThroughput: (1.6 * 0.9 * 1024 * 1024) / 8, uploadThroughput: (750 * 0.9 * 1024) / 8 });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e).slice(0, 60)));
  const r = await p.goto(BASE + U, { waitUntil: "load", timeout: 90000 });
  await p.waitForTimeout(6000);
  const c = await p.evaluate(() => window.__c);
  rows.push(c.cls);
  console.log(`${U} run ${i + 1} status=${r.status()} lcp=${Math.round(c.lcp)} cls=${c.cls.toFixed(3)} ${c.shifts.join(" ")} ${errs.join("|")}`);
  await b.close();
}
console.log(`${U}: max CLS ${Math.max(...rows).toFixed(3)} over ${N} runs`);
