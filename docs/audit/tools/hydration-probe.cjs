// Hydration probe (report-only): loads a page N times on Slow 4G + 4x CPU (390x844) and logs
// DOMContentLoaded, the last CSS and first JS arrival, and any React #418 hydration error with
// its time and document.readyState. R4-MK-09 repro:
//   N=12 node docs/audit/tools/hydration-probe.cjs /ar/legal/privacy
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(); const out = [];
  for (let i = 0; i < +(process.env.N || 12); i++) {
    const p = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
    await p.addInitScript(() => {
      window.__st = { dcl: null, err: null, css: [] };
      document.addEventListener("DOMContentLoaded", () => (window.__st.dcl = Math.round(performance.now())));
      window.addEventListener("error", (e) => { if (/418/.test(String(e.message))) window.__st.err = { t: Math.round(performance.now()), rs: document.readyState }; }, true);
    });
    const cdp = await p.context().newCDPSession(p); await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await cdp.send("Network.enable"); await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 562, downloadThroughput: 170000, uploadThroughput: 80000 });
    await p.goto("http://localhost:3000" + (process.argv[2] || "/ar/legal/privacy"), { waitUntil: "load" }); await p.waitForTimeout(2500);
    const st = await p.evaluate(() => ({ ...window.__st, scripts: performance.getEntriesByType("resource").filter((r) => r.initiatorType === "script" || /\.js$/.test(r.name)).map((r) => Math.round(r.responseEnd)).sort((a, b) => a - b), css: performance.getEntriesByType("resource").filter((r) => /\.css$/.test(r.name)).map((r) => Math.round(r.responseEnd)).sort((a, b) => b - a)[0] }));
    console.log(i, "dcl", st.dcl, "lastCss", st.css, "firstJs", st.scripts[0], "err", JSON.stringify(st.err));
    await p.close();
  }
  await b.close();
})();
