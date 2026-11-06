// LCP/FCP critical-path trace on the phone profile (390x844, 4x CPU, Slow 4G): FCP, LCP element and
// every resource that started before FCP + 500 ms. Usage: node docs/audit/tools/lcp-trace.mjs <url>
import { chromium } from "playwright";
const url = process.argv[2];
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await ctx.addInitScript(() => {
  window.__lcp = [];
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) window.__lcp.push({ t: Math.round(e.startTime), size: e.size, el: e.element ? e.element.tagName + "." + String(e.element.className).split(" ")[0] : e.url });
  }).observe({ type: "largest-contentful-paint", buffered: true });
  window.__fonts = [];
  document.fonts?.addEventListener?.("loadingdone", (ev) => window.__fonts.push({ t: Math.round(performance.now()), f: ev.fontfaces.map((f) => f.family + " " + f.weight).join(",") }));
});
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await cdp.send("Network.enable");
await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 562.5, downloadThroughput: (1.6 * 0.9 * 1024 * 1024) / 8, uploadThroughput: (750 * 0.9 * 1024) / 8 });
await page.goto(url, { waitUntil: "load", timeout: 90000 });
await page.waitForTimeout(4000);
const r = await page.evaluate((RES) => {
  const fcp = performance.getEntriesByName("first-contentful-paint")[0]?.startTime;
  const nav = performance.getEntriesByType("navigation")[0];
  const res = performance.getEntriesByType("resource").filter((e) => e.startTime < (fcp || 1e9) + 500).map((e) => `${Math.round(e.startTime)}-${Math.round(e.responseEnd)} ${e.initiatorType} ${Math.round(e.transferSize / 1024)}K ${e.name.split("/").slice(-1)[0].slice(0, 50)}`);
  return { fcp, lcp: window.__lcp, fonts: window.__fonts, navEnd: nav.responseEnd, domInteractive: nav.domInteractive, res: RES ? res : undefined };
}, !!process.env.RES);
console.log(JSON.stringify(r));
await b.close();
