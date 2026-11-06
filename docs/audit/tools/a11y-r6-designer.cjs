// Round 6: designer probes. Crop dialog (2.5.7, keyboard, numeric fields), brand colours dialog,
// the 409 "changed elsewhere" banner, size spinbuttons, tablet side panel 1000-1180.
// SESS=sessions.json OUT=dir LOCS=ar,en WIDTHS=390,1440
const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');
const fs = require('fs');
const BASE = process.env.BASE || 'http://localhost:3000';
const OUT = process.env.OUT || 'docs/audit/a11y-out'; fs.mkdirSync(OUT, { recursive: true });
const SESS = process.env.SESS ? JSON.parse(fs.readFileSync(process.env.SESS, 'utf8')) : {};
const LOCS = (process.env.LOCS || 'ar,en').split(',');
const WIDTHS = (process.env.WIDTHS || '320,390,1024,1440').split(',').map(Number);
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const log = (...a) => console.log(...a);
const focusInfo = (page) => page.evaluate(() => { const a = document.activeElement; if (!a || a === document.body) return 'BODY'; const r = a.getBoundingClientRect(); return `${a.tagName}${a.getAttribute('role') ? '[' + a.getAttribute('role') + ']' : ''} "${(a.getAttribute('aria-label') || a.textContent || a.value || '').trim().slice(0, 40)}" ${Math.round(r.width)}x${Math.round(r.height)}`; });
async function png(page) { return Buffer.from(await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 400; c.height = 200; const x = c.getContext('2d'); x.fillStyle = '#1f3d2b'; x.fillRect(0, 0, 200, 200); x.fillStyle = '#d13b3b'; x.fillRect(200, 0, 200, 200); return c.toDataURL('image/png').split(',')[1]; }), 'base64'); }
async function axeIn(page, sel) { const r = await new AxeBuilder({ page }).include(sel).withTags(TAGS).analyze(); return r.violations.map((v) => `${v.id}×${v.nodes.length}: ${v.nodes.slice(0, 2).map((n) => n.target.join(' ') + ' ' + (n.failureSummary || '').split('\n')[1]).join(' | ').slice(0, 300)}`); }
(async () => {
  const browser = await chromium.launch();
  for (const w of WIDTHS) for (const loc of LOCS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: w < 600 ? 844 : 900 }, hasTouch: w < 600, isMobile: w < 600 });
    await ctx.addCookies([{ name: 'elba_cookie_notice', value: '1', url: BASE }, ...(SESS.buyer ? [{ name: 'elba_session', value: SESS.buyer, url: BASE }] : [])]);
    const page = await ctx.newPage(); const tag = `${loc}-${w}`;
    await page.goto(`${BASE}/${loc}/design/mailer-box`, { waitUntil: 'load' });
    await page.getByTestId('stage-3d').locator('canvas').first().waitFor({ timeout: 60000 });
    await page.waitForTimeout(1500);
    // --- size spinbuttons
    const spins = await page.$$eval('[role=spinbutton]', (els) => els.filter((e) => e.getClientRects().length).map((e) => { const l = e.labels?.[0]?.textContent?.trim(); return `${l}|now=${e.getAttribute('aria-valuenow')}|vt=${e.getAttribute('aria-valuetext')}|min=${e.getAttribute('aria-valuemin')}|max=${e.getAttribute('aria-valuemax')}|val=${e.value}`; }));
    log(tag, 'SPINS', spins.length, spins.slice(0, 4).join(' ; '));
    const sp = page.locator('[role=spinbutton]:visible').first();
    if (await sp.count()) { await sp.focus(); const b = await sp.inputValue(); await page.keyboard.press('ArrowUp'); await page.waitForTimeout(150); const a = await sp.inputValue(); await page.keyboard.press('Home'); await page.waitForTimeout(100); const h = await sp.inputValue(); await page.keyboard.press('End'); const e = await sp.inputValue(); log(tag, 'SPIN keys', b, '->up', a, '->Home', h, '->End', e, 'aria-now', await sp.getAttribute('aria-valuenow'));
      await sp.fill('abc'); await page.waitForTimeout(100); log(tag, 'SPIN invalid text: aria-invalid=', await sp.getAttribute('aria-invalid'), 'now=', await sp.getAttribute('aria-valuenow')); await page.keyboard.press('Tab'); }
    // --- crop dialog
    const artTab = page.getByRole('tab', { name: loc === 'ar' ? /الرسوم|الصور|التصميم/ : 'Artwork' }).first();
    if (w < 600) { const more = page.getByRole('button', { name: loc === 'ar' ? /التصميم|تعديل/ : /Design|Edit/ }).first(); }
    try { await artTab.click({ timeout: 5000 }); } catch (e) { log(tag, 'no artwork tab', String(e).slice(0, 80)); }
    try {
      await page.locator('input[type=file]').first().setInputFiles({ name: 'two-tone.png', mimeType: 'image/png', buffer: await png(page) });
      const crop = page.getByRole('button', { name: loc === 'ar' ? 'قص' : 'Crop', exact: true });
      await crop.waitFor({ timeout: 15000 }); await crop.focus(); await page.keyboard.press('Enter');
      const dlg = page.getByRole('dialog').last(); await dlg.waitFor(); await page.waitForTimeout(400);
      log(tag, 'CROP open focus', await focusInfo(page));
      log(tag, 'CROP axe', JSON.stringify(await axeIn(page, '[role=dialog]')));
      const frame = dlg.getByTestId('crop-frame'); const fb = await frame.boundingBox(); const corner = await dlg.locator('[class*=cropCorner]').boundingBox();
      log(tag, 'CROP frame', JSON.stringify(fb), 'corner', JSON.stringify(corner));
      const desc = await frame.evaluate((el) => { const ids = (el.getAttribute('aria-describedby') || '').split(' '); return ids.map((i) => document.getElementById(i)?.textContent).join(' / '); });
      log(tag, 'CROP frame desc:', desc, '| roledesc', await frame.getAttribute('aria-roledescription'), '| keyshortcuts', await frame.getAttribute('aria-keyshortcuts'));
      const stops = []; for (let i = 0; i < 16; i++) { await page.keyboard.press('Tab'); stops.push(await focusInfo(page)); } log(tag, 'CROP tabs', stops.join(' > '));
      await frame.focus(); const fo = await frame.evaluate((el) => { const cs = getComputedStyle(el); return `outline:${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor} shadow:${cs.boxShadow.slice(0, 60)}`; }); log(tag, 'CROP frame focus style', fo);
      await page.keyboard.press('ArrowRight'); await page.keyboard.press('Shift+ArrowLeft'); await page.waitForTimeout(200);
      log(tag, 'CROP after keys', await dlg.locator('input').evaluateAll((els) => els.map((e) => e.labels?.[0]?.textContent + '=' + e.value).join(', ')), 'live:', await dlg.locator('[aria-live]').allTextContents());
      const num = dlg.locator('input').first(); log(tag, 'CROP numeric role', await num.getAttribute('role'), 'inputmode', await num.getAttribute('inputmode'), 'suffix?', await num.evaluate((e) => e.parentElement.textContent));
      await page.screenshot({ path: `${OUT}/r6-crop-${tag}.png` });
      // reflow in dialog
      log(tag, 'CROP dialog overflow', await page.evaluate(() => { const d = document.querySelector('[role=dialog]'); return d ? `${d.scrollWidth - d.clientWidth} docOv:${document.documentElement.scrollWidth - document.documentElement.clientWidth}` : 'none'; }));
      await page.keyboard.press('Escape'); await page.waitForTimeout(300); log(tag, 'CROP esc focus', await focusInfo(page));
    } catch (e) { log(tag, 'CROP fail', String(e).slice(0, 200)); await page.screenshot({ path: `${OUT}/r6-crop-fail-${tag}.png` }); }
    // --- brand colours dialog
    try {
      const manage = page.getByRole('button', { name: loc === 'ar' ? /ألوان العلامة|إدارة/ : /brand colours/i }).first();
      await manage.waitFor({ timeout: 8000 }); await manage.scrollIntoViewIfNeeded(); await manage.focus(); await page.keyboard.press('Enter');
      const dlg = page.getByRole('dialog').last(); await dlg.waitFor(); await page.waitForTimeout(400);
      log(tag, 'BRAND open focus', await focusInfo(page), 'axe', JSON.stringify(await axeIn(page, '[role=dialog]')));
      // submit empty
      const add = dlg.getByRole('button', { name: loc === 'ar' ? 'إضافة اللون' : /Add colou?r/ }); await add.focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(400);
      log(tag, 'BRAND empty add focus', await focusInfo(page), 'invalid:', await dlg.locator('[aria-invalid=true]').count());
      await dlg.getByRole('textbox').first().fill('Navy'); await dlg.getByRole('textbox').nth(1).fill('#1f3d2b');
      await dlg.getByRole('textbox', { name: 'C', exact: true }).fill('150'); await page.waitForTimeout(200);
      const c = dlg.getByRole('textbox', { name: 'C', exact: true }); log(tag, 'BRAND bad cmyk: aria-invalid', await c.getAttribute('aria-invalid'), 'describedby', await c.getAttribute('aria-describedby'));
      await c.fill(''); await add.focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(1200);
      log(tag, 'BRAND after add focus', await focusInfo(page), 'list', await dlg.getByTestId('brand-list').textContent().catch(() => '-'));
      const rm = dlg.getByRole('button', { name: loc === 'ar' ? /إزالة|حذف/ : /Remove/ }).first(); await rm.focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(1500);
      log(tag, 'BRAND after remove focus', await focusInfo(page));
      await page.screenshot({ path: `${OUT}/r6-brand-${tag}.png` });
      await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    } catch (e) { log(tag, 'BRAND fail', String(e).slice(0, 200)); }
    // --- 409 banner
    try {
      const nm = page.getByRole('textbox', { name: loc === 'ar' ? /اسم/ : /name/i }).first(); await nm.fill('A11y base ' + Date.now()); await page.keyboard.press('Tab');
      await page.getByTestId('save-status').and(page.locator('[data-state=saved]')).waitFor({ timeout: 30000 });
      await page.route('**/api/designs**', (r) => (r.request().method() === 'PUT' ? r.fulfill({ status: 409, body: '{"error":"STALE"}', contentType: 'application/json' }) : r.continue()));
      const name = page.getByRole('textbox', { name: loc === 'ar' ? /اسم/ : /name/i }).first(); await name.fill('A11y 409 ' + Date.now()); await page.keyboard.press('Tab');
      const banner = page.locator('[class*=banner] [role=status], [class*=banner] [role=alert]').first(); await banner.waitFor({ timeout: 25000 });
      log(tag, '409 banner role', await banner.getAttribute('role'), 'text', (await banner.textContent()).slice(0, 120));
      log(tag, '409 axe', JSON.stringify(await axeIn(page, '[class*=banner]')));
      const keep = banner.getByRole('button').nth(1); await keep.focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(800);
      log(tag, '409 after keep focus', await focusInfo(page));
      await page.unroute('**/api/designs**');
    } catch (e) { log(tag, '409 fail', String(e).slice(0, 200)); }
    await ctx.close();
  }
  // tablet side panel
  for (const w of [1000, 1024, 1100, 1180]) for (const loc of LOCS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 800 } }); await ctx.addCookies([{ name: 'elba_cookie_notice', value: '1', url: BASE }]);
    const page = await ctx.newPage(); await page.goto(`${BASE}/${loc}/design/mailer-box`); await page.getByTestId('stage-3d').locator('canvas').first().waitFor({ timeout: 60000 }); await page.waitForTimeout(1500);
    const ax = (await new AxeBuilder({ page }).withTags(TAGS).analyze()).violations.map((v) => v.id + '×' + v.nodes.length);
    const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    // keyboard walk for obscured / small
    const bad = []; for (let i = 0; i < 60; i++) { await page.keyboard.press('Tab'); const r = await page.evaluate(() => { const a = document.activeElement; if (!a || a === document.body) return 'BODY'; const b = a.getBoundingClientRect(); if (!b.width) return null; const pts = [[b.left + b.width / 2, b.top + b.height / 2]]; const vis = pts.some(([x, y]) => { const e = document.elementFromPoint(x, y); return e && (a === e || a.contains(e) || e.contains(a)); }); const small = b.width < 24 || b.height < 24; return (!vis || small || b.bottom > innerHeight || b.top < 0) ? `${a.tagName} "${(a.getAttribute('aria-label') || a.textContent || '').trim().slice(0, 30)}" ${Math.round(b.width)}x${Math.round(b.height)} ${vis ? '' : 'OBSCURED'} ${b.bottom > innerHeight || b.top < 0 ? 'OFFSCREEN' : ''}` : null; }); if (r) bad.push(r); }
    log(`panel ${loc}-${w} axe:${ax.join(',') || 'ok'} ov:${ov} kb:`, [...new Set(bad)].slice(0, 8).join(' ; '));
    await page.screenshot({ path: `${OUT}/r6-panel-${loc}-${w}.png` }); await ctx.close();
  }
  await browser.close();
})();
