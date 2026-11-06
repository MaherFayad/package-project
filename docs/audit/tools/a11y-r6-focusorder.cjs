// Focus order vs visual order (1.3.2 / 2.4.3) after the spacing rework: Tab through the page and flag
// jumps that go back up the page by more than 60 px into a column already passed, or run against the
// reading direction inside one row. URLS W
const { chromium } = require('playwright'); const BASE = 'http://localhost:3000';
(async () => { const b = await chromium.launch(); const w = +(process.env.W || 1440);
  for (const u of (process.env.URLS || '/en,/ar,/en/start,/ar/start,/en/why-elba,/ar/why-elba,/en/pricing,/ar/pricing,/en/designer,/ar/designer').split(',')) {
    const c = await b.newContext({ viewport: { width: w, height: w < 600 ? 844 : 900 }, reducedMotion: 'reduce' }); await c.addCookies([{ name: 'elba_cookie_notice', value: '1', url: BASE }]); const p = await c.newPage(); await p.goto(BASE + u); await p.waitForTimeout(1200);
    const rtl = u.startsWith('/ar'); const stops = [];
    for (let i = 0; i < 160; i++) { await p.keyboard.press('Tab'); const r = await p.evaluate(() => { const a = document.activeElement; if (!a || a === document.body) return null; const b = a.getBoundingClientRect(); return { y: b.top + scrollY, x: b.left, r: b.right, h: b.height, n: (a.getAttribute('aria-label') || a.textContent || a.tagName).trim().slice(0, 26), hdr: !!a.closest('header,[role=dialog]'), ft: !!a.closest('footer') }; }); if (!r) break; if (stops.length && r.n === stops[0].n && Math.abs(r.y - stops[0].y) < 2) break; stops.push(r); }
    const bad = []; for (let i = 1; i < stops.length; i++) { const a = stops[i - 1], b2 = stops[i]; if (a.hdr || b2.hdr) continue;
      const sameRow = Math.abs(a.y - b2.y) < Math.min(a.h, b2.h) * 0.6; if (sameRow) { if (rtl ? b2.x > a.r + 4 : b2.r < a.x - 4) bad.push(`row-back "${a.n}"→"${b2.n}"`); continue; }
      if (b2.y < a.y - 60) { const col = rtl ? b2.r > a.x : b2.x < a.r; bad.push(`up ${Math.round(a.y - b2.y)}px "${a.n}"→"${b2.n}"`); } }
    console.log(u, w, `stops:${stops.length}`, bad.length ? bad.slice(0, 6).join(' ; ') : 'ok'); await c.close(); }
  await b.close(); })();
