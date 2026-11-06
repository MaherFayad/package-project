// Which element sticks out horizontally? URL=/en/vendors W=1024 ROLE=vendor SESS=...
const { chromium } = require('playwright'); const fs = require('fs'); const BASE = 'http://localhost:3000';
(async () => { const S = process.env.SESS ? JSON.parse(fs.readFileSync(process.env.SESS, 'utf8')) : {}; const b = await chromium.launch(); const c = await b.newContext({ viewport: { width: +process.env.W, height: 800 } });
  if (S[process.env.ROLE]) await c.addCookies([{ name: 'elba_session', value: S[process.env.ROLE], url: BASE }]);
  const p = await c.newPage(); await p.goto(BASE + process.env.URL); await p.waitForTimeout(1500);
  console.log(await p.evaluate(() => { const W = document.documentElement.clientWidth; const out = []; for (const e of document.querySelectorAll('body *')) { const r = e.getBoundingClientRect(); if (r.right > W + 1 || r.left < -1) out.push(`${e.tagName}.${String(e.className).slice(0, 50)} L${Math.round(r.left)} R${Math.round(r.right)} "${(e.textContent || '').trim().slice(0, 30)}"`); } return [document.documentElement.scrollWidth - W, ...out.slice(0, 8)].join('\n'); }));
  await b.close(); })();
