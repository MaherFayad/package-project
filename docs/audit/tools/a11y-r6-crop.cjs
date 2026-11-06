// Screenshot the element holding TEXT (with some margin) and print its colours. URL TEXT W
const { chromium } = require('playwright'); const BASE = 'http://localhost:3000';
(async () => { const b = await chromium.launch(); const w = +(process.env.W || 1440); const c = await b.newContext({ viewport: { width: w, height: w < 600 ? 844 : 900 }, reducedMotion: process.env.RM ? 'reduce' : 'no-preference' }); await c.addCookies([{ name: 'elba_cookie_notice', value: '1', url: BASE }]);
  const p = await c.newPage(); await p.goto(BASE + process.env.URL); await p.waitForTimeout(1500);
  await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += innerHeight * 0.7) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 100)); } });
  const el = p.getByText(process.env.TEXT, { exact: false }).first(); await el.scrollIntoViewIfNeeded(); await p.waitForTimeout(800);
  console.log(await el.evaluate((e) => { const out = []; let x = e; for (let i = 0; i < 6 && x; i++, x = x.parentElement) { const cs = getComputedStyle(x); out.push(`${x.tagName}.${String(x.className).slice(0, 30)} color=${cs.color} bg=${cs.backgroundColor} bgi=${cs.backgroundImage.slice(0, 60)} op=${cs.opacity} fs=${cs.fontSize}/${cs.fontWeight}`); } return out.join('\n'); }));
  const bx = await el.boundingBox(); await p.screenshot({ path: process.env.OUTF, clip: { x: Math.max(0, bx.x - 40), y: Math.max(0, bx.y - 30), width: Math.min(bx.width + 80, w - Math.max(0, bx.x - 40)), height: bx.height + 60 } });
  await b.close(); })();
