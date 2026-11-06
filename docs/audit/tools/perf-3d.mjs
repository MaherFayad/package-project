// 3D designer performance harness. Report-only, touches no app code.
//
//   BASE=http://localhost:3000 OUT=/tmp/perf-3d.json node docs/audit/tools/perf-3d.mjs [modelFilter]
//
// Instrumentation (init script, before any app code runs):
//  - window.__THREE_DEVTOOLS__: three.js dispatches "observe" with every WebGLRenderer it creates,
//    so we get renderer.info (calls, triangles, geometries, textures, programs) without app hooks.
//  - WebGL context wrappers: draw calls per animation frame, create/delete of textures, buffers,
//    programs (leak detection independent of renderer.info), estimated texture bytes uploaded,
//    time spent in compileShader/linkProgram/getProgramParameter (shader compile hitches),
//    CPU time inside renderer.render().
// Scenarios per model and profile:
//  1. open → first frame with draw calls (ms since navigation start)
//  2. idle 2 s (should render 0 frames: frameloop="demand")
//  3. orbit drag 4 s → fps (frames with draws / s), rAF frame time p50/p95/max, long tasks
//  4. 12 config changes (selects / number inputs in the side panel) → frame time, update latency
//  5. (box only) 50 model switches through the in-app model picker → geometries/textures/programs/
//     GL objects/JS heap before vs after (after forced GC)
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.BASE || "http://localhost:3000";
const OUT = process.env.OUT || "perf-3d.json";
const PROFILES = (process.env.PROFILES || "desktop,phone").split(",");
const SWITCHES = Number(process.env.SWITCHES || 50);
const filter = process.argv[2] ? new RegExp(process.argv[2]) : null;
const MODELS = [
  { key: "box", slug: "mailer-box", switchTest: true },
  { key: "bottle", slug: "round-bottle" },
  { key: "pouch", slug: "stand-up-pouch" },
  { key: "fefco09", slug: "fefco-0920-compartment-liner-across" },
];
// Picker cycle for the leak test: boxes of different families + vessels.
const CYCLE = ["FEFCO_0201", "ECMA_RTE", "STAND_UP_POUCH", "FEFCO_0427", "ROUND_BOTTLE"];

const INIT = () => {
  const S = (window.__gl = {
    frames: 0, draws: 0, tris: 0, firstDraw: null,
    tex: 0, texDel: 0, buf: 0, bufDel: 0, prog: 0, progDel: 0, texBytes: 0,
    compileMs: 0, linkMs: 0, paramMs: 0, renderMs: [], renderers: [], scenes: [],
    perFrame: [], rafTimes: [], uploads: 0, uploadMs: 0, uploadMaxMs: 0, ctxs: [],
  });
  // per-context live objects + resident texture bytes (lost/disposed contexts excluded in __snap)
  const C = new WeakMap();
  const ctxOf = (gl) => {
    let c = C.get(gl);
    if (!c) { c = { gl, tex: new Set(), buf: 0, prog: 0, bound: null, size: new Map() }; C.set(gl, c); S.ctxs.push(new WeakRef(c)); S.ctxCount = (S.ctxCount || 0) + 1; }
    return c;
  };
  const dev = new EventTarget();
  dev.addEventListener("observe", (e) => {
    const o = e.detail;
    if (o && o.isWebGLRenderer) {
      // WeakRef so the harness never keeps a disposed renderer alive (heap leak test stays honest)
      S.renderers.push(new WeakRef(o));
      const orig = o.render.bind(o);
      o.render = (scene, cam) => {
        const t = performance.now();
        orig(scene, cam);
        S.renderMs.push(performance.now() - t);
      };
    }
  });
  window.__THREE_DEVTOOLS__ = dev;
  const wrap = (proto) => {
    if (!proto) return;
    const w = (name, fn) => {
      const o = proto[name];
      if (typeof o !== "function") return;
      proto[name] = function (...a) { return fn.call(this, o, a); };
    };
    const draw = (mode, count, inst = 1) => {
      S.draws++;
      if (mode === 4) S.tris += (count / 3) * inst;
      if (S.firstDraw === null) S.firstDraw = performance.now();
    };
    w("drawElements", function (o, a) { draw(a[0], a[1]); return o.apply(this, a); });
    w("drawArrays", function (o, a) { draw(a[0], a[2]); return o.apply(this, a); });
    w("drawElementsInstanced", function (o, a) { draw(a[0], a[1], a[4]); return o.apply(this, a); });
    w("drawArraysInstanced", function (o, a) { draw(a[0], a[2], a[3]); return o.apply(this, a); });
    w("createTexture", function (o, a) { S.tex++; const t = o.apply(this, a); ctxOf(this).tex.add(t); return t; });
    w("deleteTexture", function (o, a) { if (a[0]) { S.texDel++; const c = ctxOf(this); c.tex.delete(a[0]); c.size.delete(a[0]); } return o.apply(this, a); });
    w("bindTexture", function (o, a) { ctxOf(this).bound = a[1]; return o.apply(this, a); });
    w("createBuffer", function (o, a) { S.buf++; ctxOf(this).buf++; return o.apply(this, a); });
    w("deleteBuffer", function (o, a) { if (a[0]) { S.bufDel++; ctxOf(this).buf--; } return o.apply(this, a); });
    w("createProgram", function (o, a) { S.prog++; ctxOf(this).prog++; return o.apply(this, a); });
    w("deleteProgram", function (o, a) { if (a[0]) { S.progDel++; ctxOf(this).prog--; } return o.apply(this, a); });
    w("compileShader", function (o, a) { const t = performance.now(); const r = o.apply(this, a); S.compileMs += performance.now() - t; return r; });
    w("linkProgram", function (o, a) { const t = performance.now(); const r = o.apply(this, a); S.linkMs += performance.now() - t; return r; });
    w("getProgramParameter", function (o, a) { const t = performance.now(); const r = o.apply(this, a); S.paramMs += performance.now() - t; return r; });
    w("getShaderParameter", function (o, a) { const t = performance.now(); const r = o.apply(this, a); S.paramMs += performance.now() - t; return r; });
    const up = (gl, bytes, t0, level) => {
      const ms = performance.now() - t0;
      S.texBytes += bytes; S.uploads++; S.uploadMs += ms; S.uploadMaxMs = Math.max(S.uploadMaxMs, ms);
      const c = ctxOf(gl);
      if (c.bound && !level) c.size.set(c.bound, Math.max(c.size.get(c.bound) || 0, bytes));
    };
    const px = (a) => { const src = a[a.length - 1]; if (a.length >= 8 && typeof a[3] === "number" && typeof a[4] === "number" && a.length !== 6) return a[3] * a[4]; return src && src.width ? src.width * src.height : 0; };
    w("texImage2D", function (o, a) { const t = performance.now(); const r = o.apply(this, a); up(this, px(a) * 4, t, a[1]); return r; });
    w("texSubImage2D", function (o, a) { const t = performance.now(); const r = o.apply(this, a); const src = a[a.length - 1]; const n = a.length >= 9 ? a[4] * a[5] : src && src.width ? src.width * src.height : 0; S.texBytes += n * 4; S.uploads++; const ms = performance.now() - t; S.uploadMs += ms; S.uploadMaxMs = Math.max(S.uploadMaxMs, ms); return r; });
    w("texStorage2D", function (o, a) { const t = performance.now(); const r = o.apply(this, a); up(this, a[3] * a[4] * 4 * (a[1] > 1 ? 1.33 : 1), t, 0); return r; });
  };
  wrap(window.WebGL2RenderingContext && WebGL2RenderingContext.prototype);
  wrap(window.WebGLRenderingContext && WebGLRenderingContext.prototype);
  // per-rAF sampling: rendered frames are rAF ticks with new draw calls
  let lastDraws = 0, lastT = 0;
  const tick = (t) => {
    if (lastT) {
      const d = S.draws - lastDraws;
      if (d > 0) S.frames++;
      if (S.sampling) { S.rafTimes.push(t - lastT); S.perFrame.push(d); }
    }
    lastT = t;
    lastDraws = S.draws;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  window.__long = [];
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__long.push({ t: e.startTime, d: e.duration }); }).observe({ type: "longtask", buffered: true });
  } catch {}
  window.__snap = () => {
    const r = S.renderers.map((w) => w.deref()).filter(Boolean).map((x) => ({ calls: x.info.render.calls, triangles: x.info.render.triangles, geometries: x.info.memory.geometries, textures: x.info.memory.textures, programs: x.info.programs ? x.info.programs.length : null, pixelRatio: x.getPixelRatio(), size: [x.domElement.width, x.domElement.height], disposed: !x.domElement.isConnected }));
    return {
      t: performance.now(), frames: S.frames, draws: S.draws, tris: S.tris, firstDraw: S.firstDraw,
      gl: (() => { const live = S.ctxs.map((w) => w.deref()).filter(Boolean).filter((c) => c.gl.canvas && c.gl.canvas.isConnected && !c.gl.isContextLost()); return { contexts: S.ctxCount || 0, liveContexts: live.length, tex: live.reduce((a, c) => a + c.tex.size, 0), buf: live.reduce((a, c) => a + c.buf, 0), prog: live.reduce((a, c) => a + c.prog, 0), residentTexMB: +(live.reduce((a, c) => a + [...c.size.values()].reduce((x, y) => x + y, 0), 0) / 1048576).toFixed(1), texCreated: S.tex, bufCreated: S.buf, progCreated: S.prog }; })(),
      uploadedMB: +(S.texBytes / 1048576).toFixed(1), uploads: S.uploads, uploadMs: +S.uploadMs.toFixed(0), uploadMaxMs: +S.uploadMaxMs.toFixed(1), compileMs: +S.compileMs.toFixed(1), linkMs: +S.linkMs.toFixed(1), paramMs: +S.paramMs.toFixed(1),
      renderers: r, rendererCount: S.renderers.length, rendererAlive: r.length, liveRenderers: r.filter((x) => !x.disposed).length,
      heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null,
      canvases: document.querySelectorAll("canvas").length,
    };
  };
};

const pct = (arr, p) => {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  return +s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))].toFixed(1);
};

async function startSampling(page) {
  await page.evaluate(() => { window.__gl.sampling = true; window.__gl.rafTimes = []; window.__gl.perFrame = []; window.__gl.renderMs = []; window.__long0 = window.__long.length; window.__f0 = window.__gl.frames; window.__t0 = performance.now(); });
}
async function stopSampling(page) {
  return page.evaluate(() => {
    const S = window.__gl;
    S.sampling = false;
    const dur = (performance.now() - window.__t0) / 1000;
    const long = window.__long.slice(window.__long0);
    return { secs: +dur.toFixed(2), frames: S.frames - window.__f0, rafTimes: S.rafTimes.slice(), renderMs: S.renderMs.slice(), drawsPerFrame: S.perFrame.filter((d) => d > 0), long: long.map((l) => Math.round(l.d)) };
  });
}
const summarise = (s) => ({
  fps: +(s.frames / s.secs).toFixed(1),
  frameP50: pct(s.rafTimes, 50), frameP95: pct(s.rafTimes, 95), frameMax: s.rafTimes.length ? +Math.max(...s.rafTimes).toFixed(1) : null,
  renderCpuP50: pct(s.renderMs, 50), renderCpuP95: pct(s.renderMs, 95),
  drawsPerFrame: pct(s.drawsPerFrame, 50),
  longTasks: s.long.length, longMax: Math.max(0, ...s.long), tbt: s.long.reduce((a, d) => a + Math.max(0, d - 50), 0),
});

async function canvasBox(page) {
  const c = await page.$('[data-testid="stage-3d"] canvas, [role="application"] canvas, canvas');
  if (!c) return null;
  return c.boundingBox();
}

async function orbit(page, ms, isPhone) {
  const bb = await canvasBox(page);
  if (!bb) return null;
  const cx = bb.x + bb.width / 2, cy = bb.y + bb.height / 2;
  await startSampling(page);
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  const steps = Math.round(ms / 16);
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 4;
    await page.mouse.move(cx + Math.sin(a) * bb.width * 0.3, cy + Math.cos(a) * bb.height * 0.15, { steps: 1 });
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  await page.waitForTimeout(isPhone ? 600 : 300);
  return stopSampling(page);
}

async function configChanges(page, n, isPhone) {
  await startSampling(page);
  const lat = [];
  const controls = await page.$$('aside select, [class*="panel"] select, [class*="Panel"] select, aside input[type="number"], [class*="panel"] input[type="number"]');
  let done = 0;
  for (let i = 0; i < n * 3 && done < n && controls.length; i++) {
    const h = controls[i % controls.length];
    const vis = await h.isVisible().catch(() => false);
    if (!vis) continue;
    const before = await page.evaluate(() => window.__gl.draws);
    const t0 = await page.evaluate(() => performance.now());
    try {
      const tag = await h.evaluate((el) => el.tagName);
      if (tag === "SELECT") {
        const opts = await h.evaluate((el) => [...el.options].filter((o) => !o.disabled).map((o) => o.value));
        const cur = await h.inputValue();
        const next = opts[(opts.indexOf(cur) + 1) % opts.length];
        if (next === undefined || next === cur) continue;
        await h.selectOption(next, { timeout: 2000 });
      } else {
        const cur = Number(await h.inputValue());
        const min = Number((await h.getAttribute("min")) || 0), max = Number((await h.getAttribute("max")) || cur * 2 || 100);
        let v = Math.round(cur * (done % 2 ? 0.9 : 1.1));
        v = Math.max(min || 1, Math.min(max, v));
        await h.fill(String(v), { timeout: 2000 });
        await h.press("Tab");
      }
    } catch {
      continue;
    }
    // latency until a new frame with draws
    const got = await page
      .waitForFunction((b) => window.__gl.draws > b, before, { timeout: isPhone ? 8000 : 4000, polling: "raf" })
      .then(() => page.evaluate(() => performance.now()))
      .catch(() => null);
    if (got) lat.push(got - t0);
    done++;
    await page.waitForTimeout(isPhone ? 500 : 250);
  }
  const s = await stopSampling(page);
  return { changes: done, latencyP50: pct(lat, 50), latencyMax: lat.length ? Math.round(Math.max(...lat)) : null, ...summarise(s) };
}

async function gc(cdp) {
  await cdp.send("HeapProfiler.enable").catch(() => {});
  await cdp.send("HeapProfiler.collectGarbage").catch(() => {});
}

async function switchTest(page, cdp, isPhone, n) {
  const openBtn = async () => {
    const b = (await page.$('button[aria-label="Change model"]')) ?? (await page.$('button[aria-label*="model" i]'));
    return b;
  };
  await gc(cdp);
  await page.waitForTimeout(500);
  const before = await page.evaluate(() => window.__snap());
  const times = [];
  let ok = 0;
  for (let i = 0; i < n; i++) {
    const code = CYCLE[i % CYCLE.length];
    const t0 = Date.now();
    try {
      let picker = await page.$('[data-testid="model-picker"]');
      if (!picker || !(await picker.isVisible())) {
        const b = await openBtn();
        if (!b) throw new Error("no picker button");
        await b.click({ timeout: 3000 });
        await page.waitForSelector('[data-testid="model-picker"]', { timeout: 5000 });
      }
      const draws = await page.evaluate(() => window.__gl.draws);
      await page.click(`[data-testid="model-picker"] [data-model="${code}"]`, { timeout: 5000 });
      await page.waitForFunction((d) => window.__gl.draws > d, draws, { timeout: isPhone ? 15000 : 8000, polling: 100 });
      await page.waitForTimeout(isPhone ? 400 : 150);
      ok++;
      times.push(Date.now() - t0);
    } catch (e) {
      if (i === 0) return { error: String(e).slice(0, 200) };
    }
  }
  await page.waitForTimeout(1000);
  await gc(cdp);
  await page.waitForTimeout(800);
  const after = await page.evaluate(() => window.__snap());
  return { switches: ok, switchMsP50: pct(times, 50), switchMsMax: times.length ? Math.max(...times) : null, before, after };
}

async function runModel(browser, profile, m, locale) {
  const isPhone = profile === "phone";
  const ctx = await browser.newContext({
    viewport: isPhone ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    deviceScaleFactor: isPhone ? 2 : 1,
    isMobile: isPhone,
    hasTouch: isPhone,
  });
  await ctx.addInitScript(INIT);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  if (isPhone) {
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 562.5, downloadThroughput: (1.6 * 0.9 * 1024 * 1024) / 8, uploadThroughput: (750 * 0.9 * 1024) / 8 });
  }
  const url = `${BASE}/${locale}/design/${m.slug}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
  // first frame with draws
  await page.waitForFunction(() => window.__gl.firstDraw !== null, null, { timeout: isPhone ? 60000 : 30000, polling: 100 }).catch(() => {});
  const nav = await page.evaluate(() => ({ firstDraw: window.__gl.firstDraw, dcl: performance.getEntriesByType("navigation")[0]?.domContentLoadedEventEnd }));
  await page.waitForLoadState("networkidle", { timeout: isPhone ? 30000 : 10000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const loaded = await page.evaluate(() => window.__snap());
  // phone layout: make sure the 3D stage is visible (some layouts show tabs)
  if (isPhone) {
    const tab = await page.$('button:has-text("3D"), [role="tab"]:has-text("3D")');
    if (tab && (await tab.isVisible())) await tab.click().catch(() => {});
    await page.waitForTimeout(800);
  }
  // idle
  await startSampling(page);
  await page.waitForTimeout(2000);
  const idle = summarise(await stopSampling(page));
  const rot = await orbit(page, 4000, isPhone);
  const rotate = rot ? summarise(rot) : null;
  const afterRotate = await page.evaluate(() => window.__snap());
  const config = await configChanges(page, 12, isPhone);
  const afterConfig = await page.evaluate(() => window.__snap());
  let switching = null;
  if (m.switchTest) switching = await switchTest(page, cdp, isPhone, SWITCHES);
  await page.screenshot({ path: `docs/screenshots/audit/performance/3d-${m.key}-${profile}.png`, scale: "css" }).catch(() => {});
  await ctx.close();
  return { model: m.key, profile, locale, url, firstFrameMs: nav.firstDraw ? Math.round(nav.firstDraw) : null, dcl: nav.dcl ? Math.round(nav.dcl) : null, loaded, idle, rotate, afterRotate, config, afterConfig, switching };
}

const browser = await chromium.launch({ args: ["--enable-precise-memory-info", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader", "--js-flags=--expose-gc"] });
const results = [];
for (const profile of PROFILES)
  for (const m of MODELS) {
    if (filter && !filter.test(m.key)) continue;
    const r = await runModel(browser, profile, m, "en").catch((e) => ({ model: m.key, profile, error: String(e).slice(0, 300) }));
    results.push(r);
    const R = r.loaded?.renderers?.[0];
    console.log(
      `${profile} ${m.key} first=${r.firstFrameMs} rot.fps=${r.rotate?.fps} p95=${r.rotate?.frameP95} cpu=${r.rotate?.renderCpuP50} cfg.fps=${r.config?.fps} cfg.lat=${r.config?.latencyP50} long=${r.config?.longMax} calls=${R?.calls} tris=${R?.triangles} geo=${R?.geometries} tex=${R?.textures} prog=${R?.programs} resTex=${r.loaded?.gl?.residentTexMB}MB up=${r.loaded?.uploadedMB}MB/${r.loaded?.uploads}x/${r.loaded?.uploadMs}ms compile=${r.loaded?.compileMs}+${r.loaded?.linkMs}+${r.loaded?.paramMs} renderers=${r.loaded?.rendererCount}`,
      r.switching ? `switch=${JSON.stringify({ n: r.switching.switches, p50: r.switching.switchMsP50, err: r.switching.error, b: r.switching.before && { gl: r.switching.before.gl, r: r.switching.before.renderers, heap: r.switching.before.heapMB }, a: r.switching.after && { gl: r.switching.after.gl, r: r.switching.after.renderers, heap: r.switching.after.heapMB, live: r.switching.after.liveRenderers, all: r.switching.after.rendererCount } })}` : "",
      r.error || "",
    );
    fs.writeFileSync(OUT, JSON.stringify(results, null, 1));
  }
await browser.close();
