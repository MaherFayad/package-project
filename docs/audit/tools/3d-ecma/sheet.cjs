/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Contact sheet: one row per model, one column per shot. usage: node sheet.cjs <docs.json> <shotDir> <out.jpg> [CODE,…] [thumb]
 */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const [docsFile, dir, out, list, thumbArg] = process.argv.slice(2);
const all = JSON.parse(fs.readFileSync(docsFile, "utf8"));
const codes = list && list !== "-" ? list.split(",") : Object.keys(all);
const thumb = Number(thumbArg || 180);
const files = fs.readdirSync(dir);
const esc = (s) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 });
  const rows = codes.map((c) => {
    const shots = files.filter((f) => f.startsWith(c + "__")).sort();
    const imgs = shots.map((f) => `<figure><img src="data:image/png;base64,${fs.readFileSync(path.join(dir, f)).toString("base64")}"><figcaption>${esc(f.split("__")[1].replace(/\.png$/, "").slice(1))}</figcaption></figure>`).join("");
    return `<div class="row"><div class="meta"><b>${esc(c)}</b><br>${esc(all[c]?.standard)}<br><span>${esc(all[c]?.name)}</span></div>${imgs || "<em>no capture</em>"}</div>`;
  });
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:10px;font:12px system-ui;width:max-content}.row{display:flex;gap:4px;border-top:1px solid #ddd;padding:4px 0}.meta{width:150px;flex:none;word-break:break-word}.meta span{color:#555}figure{margin:0;text-align:center}img{height:${thumb}px;display:block;border:1px solid #eee}figcaption{color:#666;font-size:11px}</style>${rows.join("")}`);
  await page.screenshot({ path: out, fullPage: true, type: "jpeg", quality: 72 });
  console.log(out, fs.statSync(out).size);
  await browser.close();
})();
