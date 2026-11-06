const { chromium } = require("playwright");
// Usage: node scripts/perf/leak-shared-canvas.cjs <base> [VESSEL_KIND]. Needs a page at /en/dev/engine-leak that toggles box / vessel content (with label canvases sized after mount) in one EngineCanvas on #next (see docs/audit/3d-engine.md E-51, E-55).
const HOOK = () => {
  const st = { tex: 0, fbo: 0, prog: 0 };
  for (const C of [WebGL2RenderingContext]) {
    const P = C.prototype;
    const w = (n, f) => { const o = P[n]; P[n] = function (...a) { f(a); return o.apply(this, a); }; };
    w("createTexture", () => st.tex++); w("deleteTexture", (a) => a[0] && st.tex--);
    w("createFramebuffer", () => st.fbo++); w("deleteFramebuffer", (a) => a[0] && st.fbo--);
    w("createProgram", () => st.prog++);
  }
  window.__st = st;
};
(async () => {
  const b = await chromium.launch({ args: ["--enable-unsafe-swiftshader"] });
  const ctx = await b.newContext({ viewport: { width: 900, height: 700 } });
  await ctx.addInitScript(HOOK);
  const p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(process.argv[2] + "/en/dev/engine-leak" + (process.argv[3] ? "?kind=" + process.argv[3] : ""), { waitUntil: "load" });
  await p.waitForTimeout(8000);
  const out = [];
  for (let i = 0; i <= 12; i++) {
    if (i % 2 === 0) out.push(i + ":" + JSON.stringify(await p.evaluate(() => ({ ...window.__st }))));
    await p.click("#next");
    await p.waitForTimeout(2500);
  }
  console.log(out.join("\n"), errs.join("\n"));
  await b.close();
})();
