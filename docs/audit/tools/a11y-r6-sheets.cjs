// Text contrast on gradient sheets, computed against the LIGHTEST and DARKEST colour stop of the
// nearest ancestor background gradient (axe leaves gradients "incomplete"). URLS W
const { chromium } = require('playwright'); const BASE = 'http://localhost:3000';
(async () => { const b = await chromium.launch(); const w = +(process.env.W || 1440); const c = await b.newContext({ viewport: { width: w, height: 900 }, reducedMotion: 'reduce' }); await c.addCookies([{ name: 'elba_cookie_notice', value: '1', url: BASE }]); const p = await c.newPage();
  for (const u of (process.env.URLS || '/en,/ar,/en/why-elba,/ar/why-elba,/en/pricing,/en/designer,/ar/designer,/en/start').split(',')) { await p.goto(BASE + u); await p.waitForTimeout(1200);
    const r = await p.evaluate(() => {
      const L = (r, g, b) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
      const R = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); const parse = (s) => (s.match(/[\d.]+/g) || []).map(Number);
      const out = new Map();
      for (const e of document.querySelectorAll('main *')) { if (!e.childNodes.length || ![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue; if (!e.getClientRects().length || e.closest('[aria-hidden=true],.visually-hidden,[class*=srOnly]')) continue;
        const cs = getComputedStyle(e); if (cs.visibility === 'hidden') continue; let x = e, stops = null, solid = null;
        while (x && x !== document.documentElement) { const s = getComputedStyle(x); if (s.backgroundImage.includes('gradient')) { stops = (s.backgroundImage.match(/rgba?\([^)]+\)/g) || []).map(parse).filter((q) => (q[3] ?? 1) > 0.6); break; } const bg = parse(s.backgroundColor); if (bg.length && (bg[3] ?? 1) > 0.9) { solid = bg; break; } if (s.backgroundImage.includes('url(')) break; x = x.parentElement; }
        if (!stops || !stops.length) continue; const fc = parse(cs.color); const a = fc[3] ?? 1; const big = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.66 && +cs.fontWeight >= 700); let worst = 99;
        for (const st of stops) { const f = fc.slice(0, 3).map((v, k) => v * a + st[k] * (1 - a)); worst = Math.min(worst, R(L(...f), L(...st.slice(0, 3)))); }
        const need = big ? 3 : 4.5; if (worst < need) { const k = `${cs.color} ${cs.fontSize}/${cs.fontWeight} on ${x.className.toString().slice(0, 28)}`; if (!out.has(k)) out.set(k, `${worst.toFixed(2)}<${need} "${e.textContent.trim().slice(0, 40)}"`); } }
      return [...out].map(([k, v]) => `${v} :: ${k}`); });
    console.log(u, r.length ? '\n  ' + r.join('\n  ') : 'ok'); }
  await b.close(); })();
