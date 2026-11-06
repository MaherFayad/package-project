// axe at phone width + reduced-motion running animations
const { chromium } = require('playwright'); const { AxeBuilder } = require('@axe-core/playwright');
const PH = { anon: null, buyer: '+201000000002', vendor: '+201000000010', admin: '+201000000001' };
const ROUTES = JSON.parse(process.argv[2]); const W = Number(process.env.W || 390);
(async () => { const b = await chromium.launch();
  for (const role of [...new Set(ROUTES.map(r => r[0]))]) {
    const ctx = await b.newContext({ viewport: { width: W, height: 844 }, reducedMotion: 'reduce', hasTouch: true, isMobile: W < 600 });
    if (PH[role]) { for (let k = 0; k < 4; k++) { const r = await ctx.request.post('http://localhost:3000/api/auth/request-otp', { data: { phone: PH[role] } }); const j = await r.json().catch(() => ({})); if (j.devCode) { await ctx.request.post('http://localhost:3000/api/auth/verify-otp', { data: { phone: PH[role], code: j.devCode, locale: 'ar', acceptTerms: true } }); break; } await new Promise(r => setTimeout(r, ((j.retryAfterSec || 5) + 1) * 1000)); } }
    const p = await ctx.newPage();
    for (const [, path] of ROUTES.filter(r => r[0] === role)) for (const loc of ['ar', 'en']) {
      try { await p.goto('http://localhost:3000/' + loc + path, { waitUntil: 'load', timeout: 45000 }); } catch { console.log('ERR', path); continue; }
      await p.waitForTimeout(2000); await p.mouse.wheel(0, 1500); await p.waitForTimeout(600);
      const ax = await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze().catch((e) => ({ violations: [{ id: 'axe-error', nodes: [] }] }));
      const anims = await p.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').map((a) => (a.animationName || a.constructor.name) + '@' + (a.effect?.target?.className || '').toString().slice(0, 30) + ':' + a.effect?.getComputedTiming().duration));
      const ov = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      console.log(`${role} /${loc}${path} axe:${ax.violations.map((v) => v.id + '×' + v.nodes.length + '[' + v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' ; ') + ']').join(', ') || 'ok'} anims:${anims.length ? anims.slice(0, 4).join('|') : 'none'} overflow:${ov}`);
    }
    await ctx.close(); }
  await b.close(); })();
