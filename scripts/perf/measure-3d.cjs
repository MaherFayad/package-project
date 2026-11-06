/* eslint-disable */
/**
 * 3D engine performance probe (owner: 3D engine). Engine-agnostic: it hooks WebGL calls, so the
 * same script measures any revision.
 *
 *   node scripts/perf/measure-3d.cjs http://localhost:3000 out.json [label]
 *
 * Measures on /en/dev/3d (first viewer on the page):
 *  - first 3D frame time (navigation → first draw call on the viewer canvas)
 *  - frames drawn while idle (on-demand rendering should give 0)
 *  - orbit-drag fps on a mid-phone profile (390×844, DPR 3, CPU 4× throttle)
 *  - draw calls / triangles per frame
 *  - live GPU objects (textures, buffers, programs) after 0 / 10 / 50 model switches (leaks)
 */
const { chromium } = require("playwright");
const fs = require("node:fs");

const base = process.argv[2] ?? "http://localhost:3000";
const out = process.argv[3] ?? "perf.json";
const label = process.argv[4] ?? "run";

const HOOK = () => {
  const stats = new WeakMap();
  const all = [];
  const get = (gl) => {
    let s = stats.get(gl.canvas);
    if (!s) {
      s = { tex: 0, buf: 0, prog: 0, fbo: 0, draws: 0, tris: 0, frames: 0, firstDraw: 0, frameDraws: 0, frameTris: 0, maxFrameDraws: 0, lastFrameDraws: 0, lastFrameTris: 0 };
      stats.set(gl.canvas, s);
      all.push([gl.canvas, s]);
    }
    return s;
  };
  for (const Ctx of [window.WebGL2RenderingContext, window.WebGLRenderingContext]) {
    if (!Ctx) continue;
    const P = Ctx.prototype;
    const wrap = (name, fn) => {
      const orig = P[name];
      if (!orig) return;
      P[name] = function (...a) {
        fn(get(this), a);
        return orig.apply(this, a);
      };
    };
    wrap("createTexture", (s) => s.tex++);
    wrap("deleteTexture", (s, a) => a[0] && s.tex--);
    wrap("createBuffer", (s) => s.buf++);
    wrap("deleteBuffer", (s, a) => a[0] && s.buf--);
    wrap("createProgram", (s) => s.prog++);
    wrap("deleteProgram", (s, a) => a[0] && s.prog--);
    wrap("createFramebuffer", (s) => s.fbo++);
    wrap("deleteFramebuffer", (s, a) => a[0] && s.fbo--);
    const draw = (mode, count, inst = 1) => (s) => {
      if (!s.firstDraw) s.firstDraw = performance.now();
      s.draws++;
      s.frameDraws++;
      if (mode === 4) s.frameTris += (count / 3) * inst;
    };
    wrap("drawElements", (s, a) => draw(a[0], a[1])(s));
    wrap("drawArrays", (s, a) => draw(a[0], a[2])(s));
    wrap("drawElementsInstanced", (s, a) => draw(a[0], a[1], a[4])(s));
    wrap("drawArraysInstanced", (s, a) => draw(a[0], a[2], a[3])(s));
  }
  const tick = () => {
    for (const [, s] of all) {
      if (s.frameDraws) {
        s.frames++;
        s.lastFrameDraws = s.frameDraws;
        s.lastFrameTris = s.frameTris;
        s.maxFrameDraws = Math.max(s.maxFrameDraws, s.frameDraws);
      }
      s.frameDraws = 0;
      s.frameTris = 0;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  window.__gl3d = (canvas) => ({ ...(stats.get(canvas) ?? {}) });
};

const viewerStats = (page) =>
  page.evaluate(() => {
    const c = document.querySelector("[role=application] canvas");
    return c ? window.__gl3d(c) : null;
  });

async function main() {
  const browser = await chromium.launch({ args: ["--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const result = { label, base, at: new Date().toISOString() };

  // ---- Mid-phone profile -------------------------------------------------------------
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await ctx.addInitScript(HOOK);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Performance.enable");
  const t0 = Date.now();
  await page.goto(`${base}/en/dev/3d?debug3d`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => {
    const c = document.querySelector("[role=application] canvas");
    return c && window.__gl3d(c).firstDraw > 0;
  }, null, { timeout: 90_000 });
  const nav = await page.evaluate(() => performance.getEntriesByType("navigation")[0]?.startTime ?? 0);
  const s0 = await viewerStats(page);
  result.firstFrameMs = Math.round(s0.firstDraw - nav);
  result.wallToFirstFrameMs = Date.now() - t0;
  await page.waitForTimeout(2500); // fold + fit animation settles
  const sA = await viewerStats(page);
  await page.waitForTimeout(3000);
  const sB = await viewerStats(page);
  result.idleFramesPer3s = sB.frames - sA.frames;
  result.drawCallsPerFrame = sB.lastFrameDraws;
  result.trianglesPerFrame = Math.round(sB.lastFrameTris);
  result.dpr = await page.evaluate(() => {
    const c = document.querySelector("[role=application] canvas");
    return +(c.width / c.getBoundingClientRect().width).toFixed(2);
  });

  // Orbit drag with CPU 4× throttle
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const box = await page.locator("[role=application]").first().boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const before = await viewerStats(page);
  const tStart = Date.now();
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let i = 0; i < 60; i++) {
    await page.mouse.move(cx + Math.sin(i / 6) * 120, cy + Math.cos(i / 9) * 30);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  const dragMs = Date.now() - tStart;
  const after = await viewerStats(page);
  result.dragFpsCpu4x = +(((after.frames - before.frames) * 1000) / dragMs).toFixed(1);
  // rAF cadence during a keyboard-driven rotation (measures main-thread headroom)
  await page.locator("[role=application]").first().focus();
  const fpsKeys = await page.evaluate(async () => {
    const el = document.querySelector("[role=application]");
    let frames = 0;
    let longest = 0;
    let last = performance.now();
    const start = last;
    await new Promise((res) => {
      const f = (t) => {
        frames++;
        longest = Math.max(longest, t - last);
        last = t;
        el.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", shiftKey: true, bubbles: true }));
        if (t - start < 2000) requestAnimationFrame(f);
        else res();
      };
      requestAnimationFrame(f);
    });
    return { fps: (frames * 1000) / (performance.now() - start), longest };
  });
  result.keyRotateFpsCpu4x = +fpsKeys.fps.toFixed(1);
  result.keyRotateLongestFrameMs = Math.round(fpsKeys.longest);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });

  // ---- Model switching (leaks) ---------------------------------------------------------
  const select = page.locator("form select").first();
  const codes = await select.locator("option").evaluateAll((os) => os.map((o) => o.value));
  const live = async () => {
    const s = await viewerStats(page);
    // renderer.info where the engine exposes it (?debug3d); null on revisions without the hook
    const info = await page.evaluate(() => {
      const r = window.__elba3d && window.__elba3d[0];
      return r ? { geometries: r.info.memory.geometries, textures: r.info.memory.textures, programs: r.info.programs ? r.info.programs.length : null } : null;
    });
    return { textures: s.tex, buffers: s.buf, programs: s.prog, framebuffers: s.fbo, rendererInfo: info };
  };
  await page.waitForTimeout(500);
  result.liveAt0 = await live();
  const switchTimes = [];
  for (let i = 1; i <= 50; i++) {
    const code = codes[i % codes.length];
    const ts = Date.now();
    await select.selectOption(code);
    await page.waitForTimeout(120);
    switchTimes.push(Date.now() - ts);
    if (i === 10) result.liveAt10 = await live();
  }
  // back to the first structure so the scene matches the 0-switch state
  await select.selectOption(codes[0]);
  await page.waitForTimeout(1500);
  result.liveAt50 = await live();
  const heap = await cdp.send("Performance.getMetrics");
  result.jsHeapMB = +((heap.metrics.find((m) => m.name === "JSHeapUsedSize")?.value ?? 0) / 1048576).toFixed(1);
  result.switchMsMedian = switchTimes.sort((a, b) => a - b)[Math.floor(switchTimes.length / 2)];

  // ---- JS shipped before any 3D view (home page) ---------------------------------------
  const p2 = await ctx.newPage();
  const sizes = [];
  p2.on("response", async (r) => {
    if (r.url().includes("/_next/static/chunks/") && r.url().endsWith(".js")) {
      try {
        sizes.push({ url: r.url(), bytes: (await r.body()).length });
      } catch {}
    }
  });
  await p2.goto(`${base}/en`, { waitUntil: "networkidle" });
  result.homeJsKB = Math.round(sizes.reduce((a, b) => a + b.bytes, 0) / 1024);
  result.homeLoadsThree = await p2.evaluate(() => performance.getEntriesByType("resource").some((e) => /three|fiber/i.test(e.name)));

  await browser.close();
  fs.writeFileSync(out, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
