/**
 * R6-R1: long-task breakdown of mounting the 3D viewer on the phone profile (390 × 844, DPR 2,
 * touch, 4× CPU). Opens a page, optionally taps a button (e.g. the start page's Play), records
 * long tasks (PerformanceObserver) and a CPU profile, and prints, for the longest task, the
 * self time by function (top 15) and by bucket (three.js / WebGL, React, dieline + vessels,
 * artwork painting, script evaluation, GC / other).
 *
 *   BASE=http://localhost:3100 node docs/audit/tools/3d-mount-tasks.cjs /en/design "Play"
 *   BASE=http://localhost:3100 node docs/audit/tools/3d-mount-tasks.cjs /en/design/mailer-box
 */
const { chromium } = require("playwright");
const base = process.env.BASE || "http://localhost:3100";
const [path, tap] = process.argv.slice(2);

const _bucketOf = (fn, url) => {
  if (/^\(garbage collector\)|^\(program\)|^\(idle\)/.test(fn)) return fn;
  if (/compile|Program|Shader|getProgram|linkProgram|uniform|WebGL|texImage|bufferData|texture|renderBufferDirect|render$|setProgram|getParameters|onBeforeCompile/i.test(fn)) return "three / WebGL";
  if (/dieline|Dieline|Pose|panel|Panel|fold|generate|build|revolve|sectionPoint|profile|Profile|label|Label|computeFaces|bounds/i.test(fn)) return "geometry (dieline / vessels)";
  if (/paint|Paint|fillText|drawImage|measureText|canvas|Canvas|artwork|Artwork/i.test(fn)) return "artwork / 2D canvas";
  if (/^(performWork|commit|beginWork|completeWork|reconcile|render|flush|recursivelyTraverse|updateFunctionComponent|mountIndeterminate|createFiber|scheduleUpdate)/.test(fn) || /react-dom|scheduler/.test(url)) return "React";
  if (fn === "" || fn === "(anonymous)") return "script eval / anonymous";
  return "other JS";
};

(async () => {
  const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.route("**/api/designs**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: '{"id":"x","owned":false}' }));
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    window.__lt = [];
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push({ start: e.startTime, dur: e.duration }); }).observe({ type: "longtask", buffered: true });
    window.__ev = [];
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.interactionId) window.__ev.push({ t: e.startTime, d: e.duration, name: e.name }); }).observe({ type: "event", durationThreshold: 16, buffered: true });
  });
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await cdp.send("Profiler.enable");
  await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
  await page.goto(base + path, { waitUntil: tap ? "networkidle" : "commit", timeout: 120000 });
  if (tap) await page.waitForTimeout(2500);
  const mark = await page.evaluate(() => performance.now());
  await cdp.send("Profiler.start");
  if (tap) await page.getByRole("button", { name: tap }).first().tap();
  // TYPE=1: the visitor keeps going: a key press into the page's first text field every 150 ms
  // while the 3D view loads (the R6-R1 / R8 INP scenario), then idle
  if (process.env.TYPE) {
    const field = page.locator('main input[type="search"], main input[type="text"]').first();
    for (let i = 0; i < 16; i++) {
      await page.waitForTimeout(150);
      await field.press("a", { timeout: 3000 }).catch(() => {});
    }
  }
  await page.waitForTimeout(12000);
  const { profile } = await cdp.send("Profiler.stop");
  const lts = (await page.evaluate(() => window.__lt)).filter((t) => t.start >= mark - 50);
  lts.sort((a, b) => b.dur - a.dur);
  const ev = (await page.evaluate(() => window.__ev)).filter((e) => e.t >= mark - 50);
  const tbt = lts.reduce((a, x) => a + Math.max(0, x.dur - 50), 0);
  console.log(JSON.stringify({ inp: Math.round(Math.max(0, ...ev.map((e) => e.d))), interactions: ev.length, tbtAfterTap: Math.round(tbt), longest: Math.round(lts[0]?.dur ?? 0), over50: lts.length }));
  console.log("long tasks after", tap ? `tap "${tap}"` : "navigation", ":", lts.map((t) => Math.round(t.dur)).join(", "), "ms; total", Math.round(lts.reduce((s, t) => s + t.dur, 0)), "ms");
  // Split the samples into contiguous busy segments (a gap of > 4 ms of idle = a task boundary) and
  // break the largest ones down by script (chunk) and by function.
  const nodes = new Map(profile.nodes.map((n) => [n.id, n]));
  let t = profile.startTime;
  const samples = profile.samples.map((id, i) => ({ id, t: (t += profile.timeDeltas[i]) / 1000, dt: (profile.timeDeltas[i + 1] ?? profile.timeDeltas[i]) / 1000 }));
  const segs = [];
  let cur = null;
  for (const s of samples) {
    const fn = nodes.get(s.id).callFrame.functionName;
    if (fn === "(idle)") {
      if (cur && s.t - cur.end > 4) cur = null;
      continue;
    }
    if (!cur) segs.push((cur = { start: s.t, end: s.t, list: [] }));
    cur.end = s.t;
    cur.list.push(s);
  }
  segs.sort((x, y) => y.end - y.start - (x.end - x.start));
  const chunkName = (url) => {
    const f = url.split("/").pop() || "(native)";
    if (/^b536a0f1/.test(f)) return "three core";
    if (/^e49654ac/.test(f)) return "r3f + reconciler";
    if (/^6011\./.test(f)) return "elba engine (three/)";
    return f.replace(/\.[0-9a-f]{12,}\.js$/, ".js");
  };
  for (const seg of segs.slice(0, 3)) {
    const byChunk = new Map(), byFn = new Map();
    for (const s of seg.list) {
      const cf = nodes.get(s.id).callFrame;
      const c = cf.functionName.startsWith("(") ? cf.functionName : chunkName(cf.url);
      byChunk.set(c, (byChunk.get(c) ?? 0) + s.dt);
      const k = `${cf.functionName || "(anonymous)"} [${chunkName(cf.url)}${process.env.COLS ? ":" + cf.columnNumber : ""}]`;
      byFn.set(k, (byFn.get(k) ?? 0) + s.dt);
    }
    console.log(`segment ${Math.round(seg.end - seg.start)} ms:`, [...byChunk].sort((x, y) => y[1] - x[1]).slice(0, 8).map(([k, v]) => `${k} ${Math.round(v)}`).join(" | "));
    console.log("   top:", [...byFn].sort((x, y) => y[1] - x[1]).slice(0, 6).map(([k, v]) => `${k} ${Math.round(v)}`).join(" | "));
  }
  await browser.close();
})();
