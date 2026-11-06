// 2.5.8: for every visible link/button under 24 px in either dimension, does a 24 px circle on its
// centre overlap another target (or its circle)? URL W
const { chromium } = require('playwright'); const BASE = 'http://localhost:3000';
(async () => { const b = await chromium.launch(); const w = +(process.env.W || 1440); const c = await b.newContext({ viewport: { width: w, height: 900 }, reducedMotion: 'reduce' }); await c.addCookies([{ name: 'elba_cookie_notice', value: '1', url: BASE }]); const p = await c.newPage();
  for (const u of (process.env.URLS || '/en,/ar,/en/start,/en/why-elba,/en/pricing,/en/designer').split(',')) { await p.goto(BASE + u); await p.waitForTimeout(1200);
    const bad = await p.evaluate(() => { const T = [...document.querySelectorAll('a[href],button,input,select,[role=button]')].filter((e) => e.getClientRects().length && !e.closest('[aria-hidden=true],[inert]')).map((e) => ({ e, r: e.getBoundingClientRect() })).filter((x) => x.r.width > 0);
      const out = []; for (const a of T) { if (a.r.width >= 24 && a.r.height >= 24) continue; if (a.e.closest('p,li') && a.e.closest('p')?.textContent.trim().length > a.e.textContent.trim().length + 20) continue; // inline in a sentence: exception
        const cx = a.r.left + a.r.width / 2, cy = a.r.top + a.r.height / 2;
        const hit = T.find((o) => { if (o === a) return false; const nx = Math.max(o.r.left, Math.min(cx, o.r.right)), ny = Math.max(o.r.top, Math.min(cy, o.r.bottom)); const d = Math.hypot(cx - nx, cy - ny); const small = o.r.width < 24 || o.r.height < 24; const ocx = o.r.left + o.r.width / 2, ocy = o.r.top + o.r.height / 2; return d < 12 || (small && Math.hypot(cx - ocx, cy - ocy) < 24); });
        if (hit) out.push(`"${a.e.textContent.trim().slice(0, 24)}" ${Math.round(a.r.width)}x${Math.round(a.r.height)} near "${hit.e.textContent.trim().slice(0, 24)}"`); }
      return [...new Set(out)].slice(0, 8); });
    console.log(u, bad.length ? bad.join(' ; ') : 'ok'); }
  await b.close(); })();
