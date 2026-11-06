// Discover detail routes per role from list pages (for the explicit a11y-r4-phone run).
const { chromium } = require('playwright');
const PH = { buyer: '+201000000002', vendor: '+201000000010', admin: '+201000000001' };
const LISTS = { buyer: ['/orders', '/account'], vendor: ['/vendor/jobs', '/vendor/rate-cards'], admin: ['/admin/orders', '/admin/disputes', '/admin/users', '/admin/vendors', '/admin/vendors/applications', '/admin/quotes', '/admin/payouts', '/admin/moderation'] };
const DETAIL = /^\/en\/(orders\/[^/]+$|orders\/[^/]+\/invoice$|checkout\/[^/]+$|checkout\/pay\/[^/]+$|s\/[^/]+$|vendor\/jobs\/[^/]+$|vendor\/rate-cards\/[^/]+$|admin\/(orders|disputes|users|vendors|vendors\/applications)\/[^/]+$)/;
(async () => { const b = await chromium.launch(); const out = [];
  for (const role of Object.keys(PH)) { const ctx = await b.newContext();
    for (let k = 0; k < 4; k++) { const r = await ctx.request.post('http://localhost:3000/api/auth/request-otp', { data: { phone: PH[role] } }); const j = await r.json().catch(() => ({})); if (j.devCode) { await ctx.request.post('http://localhost:3000/api/auth/verify-otp', { data: { phone: PH[role], code: j.devCode, locale: 'en', acceptTerms: true } }); break; } await new Promise(r => setTimeout(r, ((j.retryAfterSec || 5) + 1) * 1000)); }
    const p = await ctx.newPage(); const seen = new Map();
    for (const l of LISTS[role]) { out.push([role, l]); await p.goto('http://localhost:3000/en' + l, { waitUntil: 'load' }); await p.waitForTimeout(800);
      for (const h of await p.$$eval('a[href]', (as) => as.map((a) => a.getAttribute('href').split('?')[0].split('#')[0]))) { if (!DETAIL.test(h)) continue; const pat = h.replace(/\/[^/]+$/, ''); const n = seen.get(pat) || 0; if (n >= 2 || out.some(o => o[1] === h.slice(3))) continue; seen.set(pat, n + 1); out.push([role, h.slice(3)]); } }
    await ctx.close(); }
  console.log(JSON.stringify(out)); await b.close(); })();
