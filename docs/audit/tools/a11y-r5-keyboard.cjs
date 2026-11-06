// Round 5 keyboard walk (session cookies, no OTP): flags no-ring (2.4.7), obscured (2.4.11), small (<24, 2.5.8), focus lost to body (2.4.3)
const { chromium } = require('playwright');
const BASE = 'http://localhost:3000';
const fs = require('fs'); const SESS = process.env.SESS ? JSON.parse(fs.readFileSync(process.env.SESS, 'utf8')) : {};
const ROUTES = JSON.parse(process.argv[2]); // [[role,path]]
const WIDTHS = (process.env.W || '390,1440').split(',').map(Number);
const LOC = (process.env.L || 'ar,en').split(',');
const N = Number(process.env.N || 50);
(async () => {
  const b = await chromium.launch();
  for (const w of WIDTHS) for (const role of [...new Set(ROUTES.map(r => r[0]))]) {
    const ctx = await b.newContext({ viewport: { width: w, height: w < 600 ? 844 : 900 }, reducedMotion: 'reduce' });
    if (SESS[role]) await ctx.addCookies([{ name: 'elba_session', value: SESS[role], url: BASE }]);
    const p = await ctx.newPage();
    for (const [rr, path] of ROUTES.filter(r => r[0] === role)) for (const loc of LOC) {
      const url = '/' + loc + path;
      try { await p.goto(BASE + url, { waitUntil: 'load', timeout: 45000 }); } catch (e) { console.log('ERR', url); continue; }
      await p.waitForTimeout(1500);
      const flags = []; const names = new Map();
      for (let i = 0; i < N; i++) {
        await p.keyboard.press('Tab'); await p.waitForTimeout(40);
        const info = await p.evaluate(() => {
          const el = document.activeElement; if (!el || el === document.body) return { tag: 'BODY' };
          const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
          const ring = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || (cs.boxShadow && cs.boxShadow !== 'none');
          let pr = false; let q = el.parentElement; for (let k = 0; k < 3 && q; k++, q = q.parentElement) { const c = getComputedStyle(q); if ((c.outlineStyle !== 'none' && parseFloat(c.outlineWidth) > 0) || (c.boxShadow !== 'none' && q.matches(':focus-within'))) pr = true; }
          const pts = [[r.left + r.width / 2, r.top + r.height / 2], [r.left + 2, r.top + 2], [r.right - 2, r.bottom - 2]];
          let hidden = 0; for (const [x, y] of pts) { if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) { hidden++; continue; } const t = document.elementFromPoint(x, y); if (!(t && (el.contains(t) || t.contains(el) || (el.labels && [...el.labels].some(l => l.contains(t)))))) hidden++; }
          const nm = (el.getAttribute('aria-label') || (el.labels && el.labels[0] && el.labels[0].textContent) || el.textContent || el.getAttribute('title') || '').trim().replace(/\s+/g, ' ').slice(0, 40);
          return { tag: el.tagName, nm, w: Math.round(r.width), h: Math.round(r.height), ring: ring || pr, hidden, inert: !!el.closest('[inert],[aria-hidden=true]') , cls: String(el.className).slice(0, 40)};
        });
        if (info.tag === 'BODY') { flags.push(`${i + 1}:BODY`); continue; }
        const k = info.tag + info.nm + info.w; names.set(k, (names.get(k) || 0) + 1);
        const f = [!info.ring && 'NORING', info.hidden === 3 && 'OBSCURED', info.hidden > 0 && info.hidden < 3 && 'PARTIAL', (info.w < 24 || info.h < 24) && 'SMALL', info.inert && 'INERT'].filter(Boolean);
        if (f.length) flags.push(`${i + 1}:${f.join('+')} ${info.tag}"${info.nm}" ${info.w}x${info.h} .${info.cls}`);
      }
      console.log(`== ${w} ${role} ${url}`); for (const f of flags) console.log('   ' + f);
    }
    await ctx.close();
  }
  await b.close();
})();
