// R6 restyle check: per page and locale, axe-core violations (WCAG 2.2 AA tags) at 1440 and 390,
// then phone LCP and CLS (390x844, DPR 2, 4x CPU, Slow 4G: 562.5 ms RTT, 1.47/0.68 Mbps, cold cache),
// median of RUNS loads. Usage: BASE=http://localhost:3100 RUNS=3 node docs/audit/tools/r6-restyle-check.mjs [filter]
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const BASE = process.env.BASE || "http://localhost:3100";
const RUNS = Number(process.env.RUNS || 3);
const SHARE = process.env.SHARE || "r6restyleShareToken01";
const filter = process.argv[2] ? new RegExp(process.argv[2]) : null;
const PATHS = ["/boxes", "/boxes/mailer-box", "/boxes/mailer-box/250x180x80", "/catalog", "/catalog/bakery-box", "/bottles", "/vendors", "/vendors/nile-pack", "/legal/privacy", "/legal/terms", "/login", `/s/${SHARE}`, "/s/no-such-token-123", "/no-such-page"].filter((p) => !filter || filter.test(p));
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

const browser = await chromium.launch();
const rows = [];
for (const locale of ["ar", "en"]) {
  for (const p of PATHS) {
    const url = `${BASE}/${locale}${p}`;
    const axe = {};
    for (const [w, h] of [[1440, 900], [390, 844]]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h } });
      const page = await ctx.newPage();
      await page.goto(url, { waitUntil: "networkidle", timeout: 60000 }).catch(() => page.waitForLoadState("load"));
      await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); } scrollTo(0, 0); });
      await page.waitForTimeout(700);
      const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      axe[w] = r.violations.map((v) => `${v.id}(${v.nodes.length}): ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`);
      await ctx.close();
    }
    const lcps = [], clss = [];
    for (let i = 0; i < RUNS; i++) {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      const page = await ctx.newPage();
      const cdp = await ctx.newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      await cdp.send("Network.enable");
      await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
      await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 562.5, downloadThroughput: (1.47 * 1024 * 1024) / 8, uploadThroughput: (0.68 * 1024 * 1024) / 8 });
      await page.addInitScript(() => {
        window.__lcp = 0; window.__cls = 0;
        new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
        new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: "layout-shift", buffered: true });
      });
      await page.goto(url, { waitUntil: "load", timeout: 120000 });
      await page.waitForTimeout(2500);
      await page.evaluate(async () => { for (let y = 0; y < 2500; y += 400) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } });
      await page.waitForTimeout(800);
      const m = await page.evaluate(() => ({ lcp: window.__lcp, cls: window.__cls }));
      lcps.push(m.lcp); clss.push(m.cls);
      await ctx.close();
    }
    const row = { url: `/${locale}${p}`, lcp: Math.round(median(lcps)), cls: +median(clss).toFixed(3), axe1440: axe[1440], axe390: axe[390] };
    rows.push(row);
    console.log(JSON.stringify(row));
  }
}
await browser.close();
