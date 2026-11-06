// Round 6: checkout (dispute photos, refund views, history steps), admin (send price, bio queue,
// reprint, threshold, 404 cards, condensed tables), vendor (bio banner, rate card decimals).
// SESS=sessions.json DATA=r6-data.json OUT=dir SECTION=checkout|admin|vendor|tables LOCS=ar,en WIDTHS=390,1440
const { chromium } = require('playwright'); const { AxeBuilder } = require('@axe-core/playwright'); const fs = require('fs');
const BASE = 'http://localhost:3000'; const OUT = process.env.OUT || 'docs/audit/a11y-out'; fs.mkdirSync(OUT, { recursive: true });
const SESS = JSON.parse(fs.readFileSync(process.env.SESS, 'utf8')); const DATA = process.env.DATA ? JSON.parse(fs.readFileSync(process.env.DATA, 'utf8')) : {};
const LOCS = (process.env.LOCS || 'ar,en').split(','); const WIDTHS = (process.env.WIDTHS || '390,1440').split(',').map(Number); const SECTION = process.env.SECTION;
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']; const log = (...a) => console.log(...a);
const fi = (p) => p.evaluate(() => { const a = document.activeElement; if (!a || a === document.body) return 'BODY'; const r = a.getBoundingClientRect(); return `${a.tagName}${a.getAttribute('role') ? '[' + a.getAttribute('role') + ']' : ''} "${(a.getAttribute('aria-label') || a.textContent || a.value || '').trim().slice(0, 40)}" ${Math.round(r.width)}x${Math.round(r.height)}`; });
const axe = async (p, inc) => { let b = new AxeBuilder({ page: p }).withTags(TAGS); if (inc) b = b.include(inc); const r = await b.analyze(); return r.violations.map((v) => `${v.id}×${v.nodes.length}:${v.nodes[0].target.join(' ')}`).join(' ; ') || 'ok'; };
function png() { const z = require('zlib'); const crc = (buf) => { let c = ~0; for (const b of buf) { c ^= b; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; }; const ch = (t, d) => { const T = Buffer.from(t); const L = Buffer.alloc(4); L.writeUInt32BE(d.length); const C = Buffer.alloc(4); C.writeUInt32BE(crc(Buffer.concat([T, d]))); return Buffer.concat([L, T, d, C]); }; const h = Buffer.alloc(13); h.writeUInt32BE(8, 0); h.writeUInt32BE(8, 4); h[8] = 8; h[9] = 2; const raw = Buffer.alloc(8 * 25, 0x80); for (let y = 0; y < 8; y++) raw[y * 25] = 0; return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), ch('IHDR', h), ch('IDAT', z.deflateSync(raw)), ch('IEND', Buffer.alloc(0))]); }
async function ctxFor(b, role, w) { const c = await b.newContext({ viewport: { width: w, height: w < 600 ? 844 : 900 }, hasTouch: w < 600, isMobile: w < 600 }); await c.addCookies([{ name: 'elba_cookie_notice', value: '1', url: BASE }, ...(SESS[role] ? [{ name: 'elba_session', value: SESS[role], url: BASE }] : [])]); return c; }
(async () => {
  const b = await chromium.launch();
  for (const w of WIDTHS) for (const loc of LOCS) { const tag = `${loc}-${w}`;
    if (SECTION === 'checkout') { const c = await ctxFor(b, 'buyer', w); const p = await c.newPage();
      // dispute
      await p.goto(`${BASE}/${loc}/orders/${DATA.delivered.id}`); await p.waitForTimeout(1200);
      const open = p.getByRole('button', { name: loc === 'ar' ? /الإبلاغ عن مشكلة|مشكلة/ : 'Report a problem' }).first();
      if (await open.count()) { await open.focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(500); log(tag, 'DISPUTE open → focus', await fi(p));
        await p.locator('input[type=file]').setInputFiles([{ name: 'box-1.png', mimeType: 'image/png', buffer: png() }, { name: 'box-2.png', mimeType: 'image/png', buffer: png() }, { name: 'invoice.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') }]);
        await p.waitForTimeout(3000); log(tag, 'DISPUTE list', (await p.locator('li[class*=photoItem]').allTextContents()).join(' | '), 'alerts', await p.locator('li [role=alert]').count());
        log(tag, 'DISPUTE axe', await axe(p, 'form'));
        const rm = p.locator('li[class*=photoItem] button').last(); await rm.focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(600); log(tag, 'DISPUTE remove last → focus', await fi(p));
        const rm0 = p.locator('li[class*=photoItem] button').first(); await rm0.focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(600); log(tag, 'DISPUTE remove first → focus', await fi(p));
        await p.locator('input[type=file]').focus(); log(tag, 'DISPUTE picker focus ring', await p.locator('label[class*=photoPick]').evaluate((e) => getComputedStyle(e).outlineStyle + ' ' + getComputedStyle(e).outlineColor), await fi(p));
        await p.locator('input[type=file]').setInputFiles([1, 2, 3, 4].map((i) => ({ name: `more-${i}.png`, mimeType: 'image/png', buffer: png() }))); await p.waitForTimeout(3000);
        log(tag, 'DISPUTE at limit: picker present', await p.locator('input[type=file]').count(), 'focus', await fi(p));
        await p.screenshot({ path: `${OUT}/r6-dispute-${tag}.png`, fullPage: true });
        if (process.env.SUBMIT === tag) { await p.getByRole('textbox').first().fill('Logo smudged on 40 boxes, see photos.'); const sb = p.getByRole('button', { name: loc === 'ar' ? /إرسال البلاغ/ : 'Send report' }); await sb.focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(3000); log(tag, 'DISPUTE sent → focus', await fi(p)); }
      } else log(tag, 'DISPUTE no open button');
      // refund views
      for (const u of [`/orders/${DATA.refunded.id}`, `/orders/${DATA.refunded.id}/invoice`, '/orders']) { await p.goto(`${BASE}/${loc}${u}`); await p.waitForTimeout(1200); log(tag, 'REFUND', u, await axe(p), 'ov', await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)); }
      await p.screenshot({ path: `${OUT}/r6-refund-orders-${tag}.png` });
      await p.goto(`${BASE}/${loc}/orders/${DATA.refunded.id}`); await p.waitForTimeout(800); await p.screenshot({ path: `${OUT}/r6-refund-${tag}.png`, fullPage: true });
      log(tag, 'REFUND text', (await p.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 400));
      // history steps
      await p.goto(`${BASE}/${loc}/checkout/${DATA.designId || 'cmw59mkt700ih7dh5p9tq0lf6'}`); await p.waitForTimeout(2000);
      const cont = p.getByRole('button', { name: loc === 'ar' ? /متابعة|التالي/ : /Continue/ }).first();
      if (await cont.count()) { await cont.focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(800); log(tag, 'STEP next → focus', await fi(p), 'title', await p.title());
        await p.goBack(); await p.waitForTimeout(800); log(tag, 'STEP back → focus', await fi(p), 'title', await p.title(), 'url', p.url().slice(21));
        await p.goForward(); await p.waitForTimeout(800); log(tag, 'STEP fwd → focus', await fi(p)); log(tag, 'STEP axe', await axe(p));
      } else log(tag, 'STEP no continue', (await p.locator('main').innerText()).slice(0, 200));
      await c.close(); }
    if (SECTION === 'admin') { const c = await ctxFor(b, 'admin', w); const p = await c.newPage();
      await p.goto(`${BASE}/${loc}/admin/quotes`); await p.waitForTimeout(1500); log(tag, 'QUOTES axe', await axe(p));
      const sp = p.getByRole('button', { name: loc === 'ar' ? /إرسال السعر|إرسال سعر/ : /Send price/ }).first();
      if (await sp.count()) { await sp.focus(); await p.keyboard.press('Enter'); const d = p.getByRole('dialog'); await d.waitFor(); await p.waitForTimeout(500); log(tag, 'SEND open focus', await fi(p), 'axe', await axe(p, '[role=dialog]'));
        const prim = d.locator('button').filter({ hasText: loc === 'ar' ? /إرسال/ : /^Send/ }).last(); await prim.focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(600);
        log(tag, 'SEND empty → focus', await fi(p), 'invalid', await d.locator('[aria-invalid=true]').count(), 'unlinked', await d.locator('[aria-invalid=true]').evaluateAll((els) => els.filter((e) => !(e.getAttribute('aria-describedby') || '').split(' ').some((i) => document.getElementById(i)?.textContent)).length));
        await p.screenshot({ path: `${OUT}/r6-sendprice-errors-${tag}.png` });
        const sel = d.locator('select').first(); const opts = await sel.locator('option').evaluateAll((o) => o.map((x) => x.value).filter(Boolean)); if (opts[0]) await sel.selectOption(opts[0]);
        const tf = d.locator('input'); const labels = await tf.evaluateAll((els) => els.map((e) => e.labels?.[0]?.textContent?.trim())); log(tag, 'SEND fields', labels.join(' | '));
        for (let i = 0; i < labels.length; i++) { const l = labels[i] || ''; const v = /unit|الوحدة|سعر الوحدة/i.test(l) ? '٤٫٥' : /day|أيام|يوم/i.test(l) ? '12' : /cost|buy|تكلفة|شراء/i.test(l) ? '15000,50' : null; if (v) await tf.nth(i).fill(v); }
        await p.waitForTimeout(300); log(tag, 'SEND invalid after fill', await d.locator('[aria-invalid=true]').evaluateAll((els) => els.map((e) => e.labels?.[0]?.textContent + '=' + e.value)));
        if (process.env.SUBMIT === tag) { await prim.focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(2500); log(tag, 'SEND sent → focus', await fi(p), 'axe', await axe(p, '[role=dialog]')); await p.screenshot({ path: `${OUT}/r6-sendprice-sent-${tag}.png` }); const done = p.getByRole('dialog').getByRole('button', { name: loc === 'ar' ? 'تم' : 'Done' }); if (await done.count()) { await done.focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(800); log(tag, 'SEND done → focus', await fi(p)); } }
        else { await p.keyboard.press('Escape'); await p.waitForTimeout(400); log(tag, 'SEND esc → focus', await fi(p)); }
      } else log(tag, 'SEND no button');
      const tabs = await p.getByRole('tab').allTextContents(); log(tag, 'QUOTES tabs', tabs.join('|'));
      const priced = p.getByRole('tab', { name: loc === 'ar' ? /تم التسعير|مسعر/ : /Priced/ }); if (await priced.count()) { await priced.first().click(); await p.waitForTimeout(1200); log(tag, 'PRICED axe', await axe(p)); await p.screenshot({ path: `${OUT}/r6-priced-${tag}.png`, fullPage: true }); }
      // bio queue
      await p.goto(`${BASE}/${loc}/admin/moderation`); await p.waitForTimeout(1200); const bt = p.getByRole('tab', { name: loc === 'ar' ? /النبذ|نبذة|السير/ : /Bio/ }).first(); if (await bt.count()) { await bt.click(); await p.waitForTimeout(800); } log(tag, 'BIOS axe', await axe(p), 'tabs', (await p.getByRole('tab').allTextContents()).join('|'));
      await p.screenshot({ path: `${OUT}/r6-bios-${tag}.png`, fullPage: true });
      const appr = p.getByRole('button', { name: loc === 'ar' ? /اعتماد|قبول|موافقة/ : /Approve/ }).first(); if (process.env.SUBMIT === tag && await appr.count()) { await appr.focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(1500); log(tag, 'BIO approve → focus', await fi(p)); }
      // reprint
      await p.goto(`${BASE}/${loc}/admin/disputes/${process.env.DISPUTE || 'cmw59mktg00ix7dh5o53sf824'}`); await p.waitForTimeout(1200); log(tag, 'DISPUTE page axe', await axe(p));
      const rep = p.getByRole('radio', { name: loc === 'ar' ? /إعادة الطباعة|إعادة طباعة/ : /Reprint/ }).first(); if (await rep.count()) { await rep.check(); await p.waitForTimeout(500); log(tag, 'REPRINT form axe', await axe(p), 'radios', (await p.getByRole('radio').evaluateAll((r) => r.map((x) => x.labels?.[0]?.textContent?.trim().slice(0, 30)))).join('|'));
        const part = p.getByRole('radio', { name: loc === 'ar' ? /جزئي|جزء/ : /Partial/ }); if (await part.count()) { await part.first().check(); await p.waitForTimeout(300); }
        const sels = await p.locator('main select').evaluateAll((s) => s.map((x) => x.labels?.[0]?.textContent)); log(tag, 'REPRINT selects', sels.join('|'));
        const inputs = p.locator('main form input[type=text], main form input:not([type])'); const n = await inputs.count(); for (let i = 0; i < n; i++) { await inputs.nth(i).fill('abc'); } await p.waitForTimeout(300);
        log(tag, 'REPRINT invalid', await p.locator('main [aria-invalid=true]').evaluateAll((els) => els.map((e) => (e.labels?.[0]?.textContent || '').slice(0, 30) + ' desc:' + (e.getAttribute('aria-describedby') || '').split(' ').map((i) => document.getElementById(i)?.textContent?.slice(0, 50)).join('/'))));
        await p.screenshot({ path: `${OUT}/r6-reprint-${tag}.png`, fullPage: true }); } else log(tag, 'REPRINT no radio', (await p.getByRole('radio').allTextContents()).join('|'));
      // threshold
      await p.goto(`${BASE}/${loc}/admin/pricing`); await p.waitForTimeout(1200); const th = p.getByLabel(loc === 'ar' ? /قبل إظهار|التسليمات/ : /Deliveries before/).first();
      if (await th.count()) { await th.fill('0'); await p.waitForTimeout(300); log(tag, 'THRESH 0 invalid', await th.getAttribute('aria-invalid'), 'role', await th.getAttribute('role'), 'desc', await th.evaluate((e) => (e.getAttribute('aria-describedby') || '').split(' ').map((i) => document.getElementById(i)?.textContent).join(' / ')));
        const form = th.locator('xpath=ancestor::form[1]'); const save = form.locator('button[type=submit]'); if (await save.count()) { await save.focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(1200); log(tag, 'THRESH save(0) → focus', await fi(p), 'invalid', await th.getAttribute('aria-invalid')); } else log(tag, 'THRESH no submit in form');
        await th.fill('5'); } else log(tag, 'THRESH not found');
      log(tag, 'PRICING axe', await axe(p));
      // 404 cards
      for (const u of ['/admin/orders/ELB-NOPE', '/admin/users/nope', '/admin/disputes/nope', '/admin/vendors/nope', '/admin/vendors/applications/nope', '/admin/nope']) { const r = await p.goto(`${BASE}/${loc}${u}`); await p.waitForTimeout(800); log(tag, '404', u, r.status(), await axe(p), 'h1', await p.locator('h1').allTextContents(), 'title', await p.title()); }
      await p.screenshot({ path: `${OUT}/r6-admin404-${tag}.png` });
      await c.close(); }
    if (SECTION === 'vendor') { const c = await ctxFor(b, 'vendor', w); const p = await c.newPage();
      await p.goto(`${BASE}/${loc}/vendor/profile`); await p.waitForTimeout(1500);
      const bio = p.locator('textarea').filter({ has: p.locator('xpath=.') }).nth(loc === 'ar' ? 0 : 1); const before = await p.locator('textarea').count();
      if (process.env.SUBMIT === tag) { const ta = p.locator('textarea').first(); await ta.fill((await ta.inputValue()) + ' A11y round 6.'); await p.waitForTimeout(300); const save = p.getByRole('button', { name: loc === 'ar' ? 'حفظ' : 'Save' }).first(); await save.focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(2500); log(tag, 'BIO save → focus', await fi(p)); await p.reload(); await p.waitForTimeout(1200); }
      log(tag, 'BIO banner', await p.locator('main [class*=Banner]').evaluateAll((els) => els.map((e) => (e.getAttribute('role') || '-') + ':' + e.textContent.slice(0, 80))), 'axe', await axe(p));
      await p.screenshot({ path: `${OUT}/r6-vendor-profile-${tag}.png` });
      await p.goto(`${BASE}/${loc}/vendor/rate-cards`); await p.waitForTimeout(1000); const href = await p.locator('main a[href*="/rate-cards/"]').first().getAttribute('href'); await p.goto(BASE + href); await p.waitForTimeout(1500);
      log(tag, 'RATE axe', await axe(p)); const unit = p.getByRole('textbox', { name: loc === 'ar' ? /سعر/ : /price/i }).first();
      for (const v of ['12,5', '١٢٫٥', '12.555', 'abc']) { await unit.fill(v); await p.waitForTimeout(150); const save = p.getByRole('button', { name: loc === 'ar' ? 'حفظ' : 'Save' }).last(); await save.click(); await p.waitForTimeout(1200); log(tag, 'RATE', v, 'invalid', await unit.getAttribute('aria-invalid'), 'desc', await unit.evaluate((e) => (e.getAttribute('aria-describedby') || '').split(' ').map((i) => document.getElementById(i)?.textContent).filter(Boolean).join(' / ')), 'val', await unit.inputValue(), 'focus', await fi(p)); }
      await p.screenshot({ path: `${OUT}/r6-ratecard-${tag}.png`, fullPage: true });
      await c.close(); }
    if (SECTION === 'tables') { const c = await ctxFor(b, 'admin', w); const p = await c.newPage();
      for (const u of ['/admin/orders', '/admin/users', '/admin/vendors', '/admin/disputes', '/admin/quotes', '/admin/payouts', '/admin/audit']) { await p.goto(`${BASE}/${loc}${u}`); await p.waitForTimeout(1200);
        const t = p.locator('main table').first(); if (!(await t.count())) { log(tag, 'TABLE none', u); continue; }
        const snap = (await t.ariaSnapshot()).split('\n'); const roles = { table: snap.filter((l) => /^\s*- table/.test(l)).length, row: snap.filter((l) => /- row/.test(l)).length, cell: snap.filter((l) => /- (cell|gridcell)/.test(l)).length, colheader: snap.filter((l) => /columnheader/.test(l)).length };
        const disp = await t.evaluate((e) => [getComputedStyle(e).display, getComputedStyle(e.querySelector('tbody tr') || e).display, getComputedStyle(e.querySelector('tbody td') || e).display].join('/'));
        log(tag, 'TABLE', u, JSON.stringify(roles), disp, 'axe', await axe(p, 'main'), 'ov', await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)); }
      await c.close(); }
  }
  await b.close();
})();
