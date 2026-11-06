// R6-AX-11 / R6-AX-12: admin 404 tab titles; checkout step titles through Continue / Back / Forward. SESS
const { chromium } = require('playwright'); const fs = require('fs'); const BASE = 'http://localhost:3000';
(async () => { const S = JSON.parse(fs.readFileSync(process.env.SESS, 'utf8')); const b = await chromium.launch();
  for (const loc of ['en', 'ar']) { const c = await b.newContext(); await c.addCookies([{ name: 'elba_session', value: S.admin, url: BASE }]); const p = await c.newPage();
    for (const u of ['/admin/orders/ELB-NOPE', '/admin/orders/ELB-26001', '/admin/users/nope', '/admin/disputes/nope', '/admin/vendors/nope', '/admin/vendors/nile-pack', '/admin/vendors/applications/nope']) { const r = await p.goto(`${BASE}/${loc}${u}`); await p.waitForTimeout(600); console.log(r.status(), u, '→', await p.title()); }
    await c.close(); const c2 = await b.newContext(); await c2.addCookies([{ name: 'elba_session', value: S.buyer, url: BASE }]); const q = await c2.newPage();
    await q.goto(`${BASE}/${loc}/checkout/${process.env.DESIGN || 'cmw59mkt700ih7dh5p9tq0lf6'}`); await q.waitForTimeout(2000); console.log('step0', await q.title());
    await q.getByRole('button', { name: loc === 'ar' ? /متابعة/ : /Continue/ }).first().click(); await q.waitForTimeout(800); console.log('step1', await q.title());
    await q.goBack(); await q.waitForTimeout(800); console.log('back', await q.title()); await q.goForward(); await q.waitForTimeout(800); console.log('fwd', await q.title()); await c2.close(); }
  await b.close(); })();
