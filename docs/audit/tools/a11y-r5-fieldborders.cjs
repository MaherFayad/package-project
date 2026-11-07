// WCAG 1.4.11: contrast of the visible boundary of text fields / selects against the surface behind them.
// Reports fields whose border (or the field's own fill, when it differs from the surface) is < 3:1.
const { chromium } = require('playwright'); const fs = require('fs'); const SESS = process.env.SESS ? JSON.parse(fs.readFileSync(process.env.SESS)) : {};
const PAGES = JSON.parse(process.argv[2]);
(async () => { const b = await chromium.launch();
 for (const [role, path] of PAGES) { const c = await b.newContext({ viewport: { width: 1440, height: 900 } }); if (SESS[role]) await c.addCookies([{ name: 'elba_session', value: SESS[role], url: 'http://localhost:3000' }]); const p = await c.newPage();
  await p.goto('http://localhost:3000/en' + path, { waitUntil: 'load' }); await p.waitForTimeout(1500);
  const res = await p.evaluate(() => {
   const L = (c) => { const m = c.match(/[\d.]+/g).map(Number); return m.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0); };
   const cr = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
   const alpha = (c) => { const m = c.match(/[\d.]+/g); return m && m.length > 3 ? Number(m[3]) : 1; };
   const bgOf = (el) => { for (let q = el; q; q = q.parentElement) { const c = getComputedStyle(q).backgroundColor; if (alpha(c) > 0.5) return c; } return 'rgb(255, 255, 255)'; };
   const out = [];
   for (const el of document.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=range]), select, textarea')) {
    if (!el.getClientRects().length || el.closest('[aria-hidden=true]')) continue;
    // the visible box may be a wrapper (search pill, input wrapper)
    let box = el; for (let q = el, k = 0; q && k < 3; q = q.parentElement, k++) { const cs = getComputedStyle(q); if (parseFloat(cs.borderTopWidth) > 0 || alpha(cs.backgroundColor) > 0.5 && q !== document.body) { box = q; break; } }
    const cs = getComputedStyle(box); const surface = bgOf(box.parentElement); const fill = alpha(cs.backgroundColor) > 0.5 ? cs.backgroundColor : surface;
    const bw = parseFloat(cs.borderTopWidth); const border = bw > 0 ? cr(cs.borderTopColor, surface) : 0; const fillC = cr(fill, surface);
    const shadow = cs.boxShadow !== 'none';
    if (Math.max(border, fillC) < 3) out.push(`${el.id || el.name || el.placeholder || el.type} border ${cs.borderTopColor}(${bw}px) ${border.toFixed(2)}:1 fill ${fillC.toFixed(2)}:1 on ${surface}${shadow ? ' +shadow' : ''} .${String(box.className).slice(0, 30)}`);
   }
   return out; });
  console.log(role, path, res.length ? '\n   ' + [...new Set(res)].join('\n   ') : 'ok'); await c.close(); }
 await b.close(); })();
