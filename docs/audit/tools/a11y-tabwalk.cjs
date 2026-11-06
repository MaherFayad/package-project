// Keyboard walk: Tab N times, log role/name, focus-visible indicator, obscured (2.4.11), target size (2.5.8).
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:3000';
const [,, path, phone, nStr, vw] = process.argv;
(async () => {
  const b = await chromium.launch();
  const width = Number(vw || 1440);
  const ctx = await b.newContext({ viewport: { width, height: width < 600 ? 844 : 900 }, hasTouch: false });
  if (phone && phone !== '-') {
    const r = await ctx.request.post(BASE + '/api/auth/request-otp', { data: { phone } });
    const j = await r.json();
    await ctx.request.post(BASE + '/api/auth/verify-otp', { data: { phone, code: j.devCode, locale: path.slice(1, 3), acceptTerms: true } });
  }
  const p = await ctx.newPage();
  await p.goto(BASE + path, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
  const N = Number(nStr || 40);
  const seen = [];
  for (let i = 0; i < N; i++) {
    await p.keyboard.press('Tab');
    await p.waitForTimeout(60);
    const info = await p.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return { tag: 'BODY' };
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const ring = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || (cs.boxShadow && cs.boxShadow !== 'none');
      let parentRing = false; let q = el.parentElement; for (let k = 0; k < 3 && q; k++, q = q.parentElement) { const c = getComputedStyle(q); if (c.outlineStyle !== 'none' && parseFloat(c.outlineWidth) > 0) parentRing = true; }
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const top = document.elementFromPoint(Math.min(Math.max(cx, 0), innerWidth - 1), Math.min(Math.max(cy, 0), innerHeight - 1));
      const obscured = !(top && (el.contains(top) || top.contains(el) || (el.labels && [...el.labels].some(l => l.contains(top)))));
      const name = el.getAttribute('aria-label') || (el.labels && el.labels[0] && el.labels[0].textContent) || el.textContent || el.getAttribute('title') || el.getAttribute('placeholder') || '';
      return { tag: el.tagName, role: el.getAttribute('role') || '', type: el.type || '', name: name.trim().replace(/\s+/g, ' ').slice(0, 50), w: Math.round(r.width), h: Math.round(r.height), ring, parentRing, obscured, inView: r.bottom > 0 && r.top < innerHeight, outline: cs.outlineStyle + ' ' + cs.outlineWidth + ' ' + cs.outlineColor };
    });
    const flags = [info.ring || info.parentRing ? '' : 'NO-RING', info.obscured ? 'OBSCURED' : '', info.inView === false ? 'OFFSCREEN' : '', (info.w < 24 || info.h < 24) && info.tag !== 'BODY' ? 'SMALL' : ''].filter(Boolean).join(',');
    console.log(`${String(i + 1).padStart(2)} ${info.tag}${info.role ? '[' + info.role + ']' : ''}${info.type && info.tag === 'INPUT' ? '(' + info.type + ')' : ''} "${info.name}" ${info.w}x${info.h} ${flags}`);
    seen.push(info);
  }
  if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT });
  await b.close();
})();
