/**
 * Compose contact sheets from capture.cjs output: one row per model (code, standard, name),
 * one column per view. Pages of N models, JPEG at 1x DPR.
 * usage: node sheet.cjs <models.json> <shotDir> <source[,…]> <outPrefix> [perPage=24] [thumb=220]
 */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const [modelsFile, shotDir, sourcesArg, outPrefix, perPageArg, thumbArg] = process.argv.slice(2);
const sources = new Set(sourcesArg.split(","));
const perPage = Number(perPageArg || 24);
const thumb = Number(thumbArg || 220);
const models = JSON.parse(fs.readFileSync(modelsFile, "utf8")).filter((m) => sources.has(m.source));
const files = fs.readdirSync(shotDir);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 });
  const pages = Math.ceil(models.length / perPage);
  for (let p = 0; p < pages; p++) {
    const slice = models.slice(p * perPage, (p + 1) * perPage);
    const rows = slice.map((m) => {
      const tag = m.code.replace(/[^A-Za-z0-9_-]/g, "_");
      const shots = files.filter((f) => f.startsWith(tag + "__")).sort();
      const imgs = shots.map((f) => `<figure><img src="data:image/png;base64,${fs.readFileSync(path.join(shotDir, f)).toString("base64")}"><figcaption>${esc(f.split("__")[1].replace(/\.png$/, "").slice(2))}</figcaption></figure>`).join("");
      return `<div class="row"><div class="meta"><b>${esc(m.code)}</b><br>${esc(m.standard)}<br><span>${esc(m.name)}</span></div>${imgs || "<em>no capture</em>"}</div>`;
    });
    const html = `<!doctype html><meta charset="utf-8"><style>
      body{margin:0;padding:12px;font:12px/1.3 system-ui,sans-serif;background:#fff;color:#111;width:max-content}
      h1{font-size:16px;margin:0 0 8px}
      .row{display:flex;gap:6px;align-items:flex-start;border-top:1px solid #ddd;padding:6px 0}
      .meta{width:170px;flex:none;word-break:break-word}.meta span{color:#555}
      figure{margin:0;text-align:center}img{width:${thumb}px;height:${thumb}px;display:block;border:1px solid #eee}
      figcaption{color:#666;font-size:11px}</style>
      <h1>${esc(sourcesArg)} — page ${p + 1}/${pages} (${models.length} models)</h1>${rows.join("")}`;
    await page.setContent(html);
    const out = `${outPrefix}-${String(p + 1).padStart(2, "0")}.jpg`;
    await page.screenshot({ path: out, fullPage: true, type: "jpeg", quality: 78 });
    console.log(out, fs.statSync(out).size);
  }
  await browser.close();
})();
