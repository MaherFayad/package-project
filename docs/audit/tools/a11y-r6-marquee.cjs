// Kit Marquee: Tab through its links and report how much of each focused item is inside the strip's
// visible box (2.4.11). URL W RM
const { chromium } = require('playwright'); const BASE = 'http://localhost:3000';
(async () => { const b = await chromium.launch(); const w = +(process.env.W || 1440); const c = await b.newContext({ viewport: { width: w, height: w < 600 ? 844 : 900 }, reducedMotion: process.env.RM ? 'reduce' : 'no-preference' }); await c.addCookies([{ name: 'elba_cookie_notice', value: '1', url: BASE }]);
  const p = await c.newPage(); await p.goto(BASE + (process.env.URL || '/en/designer')); await p.waitForTimeout(2000);
  const vps = await p.locator('[class*=marqueeViewport]').count(); console.log('marquees', vps);
  for (let m = 0; m < vps; m++) { const vp = p.locator('[class*=marqueeViewport]').nth(m); await vp.scrollIntoViewIfNeeded(); await vp.focus(); const out = [];
    for (let i = 0; i < 14; i++) { await p.keyboard.press('Tab'); await p.waitForTimeout(250); const r = await p.evaluate((idx) => { const vp = document.querySelectorAll('[class*=marqueeViewport]')[idx]; const a = document.activeElement; if (!vp.contains(a)) return null; const v = vp.getBoundingClientRect(); const b = a.getBoundingClientRect(); const ix = Math.max(0, Math.min(b.right, v.right, innerWidth) - Math.max(b.left, v.left, 0)); return Math.round((100 * ix) / b.width); }, m); if (r === null) break; out.push(r + '%'); }
    console.log('marquee', m, 'visible share of each focused item:', out.join(' ')); }
  await b.close(); })();
