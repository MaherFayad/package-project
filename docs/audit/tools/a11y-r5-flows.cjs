// Round 5 interactive checks: OTP paste + error announcement (3.3.1, 3.3.8, 4.1.3), 3D stage keys and
// status (2.1.1, 2.5.7, 4.1.3), admin refund dialog (2.1.2, 2.4.3), toast vs focus (2.4.11).
// SESS=sessions.json node docs/audit/tools/a11y-r5-flows.cjs
const { chromium } = require('playwright'); const { AxeBuilder } = require('@axe-core/playwright'); const fs = require('fs');
const BASE = 'http://localhost:3000'; const SESS = JSON.parse(fs.readFileSync(process.env.SESS));
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const act = (p) => p.evaluate(() => { const e = document.activeElement; return e ? `${e.tagName}#${e.id}[${(e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 40)}]` : 'none'; });
const live = (p) => p.evaluate(() => [...document.querySelectorAll('[role=status],[role=alert],[aria-live]')].map((n) => n.textContent.trim()).filter(Boolean).join(' / ').slice(0, 300));
(async () => { const b = await chromium.launch();
  for (const loc of ['ar', 'en']) {
    // OTP
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, permissions: ['clipboard-read', 'clipboard-write'] }); const p = await ctx.newPage();
    await p.goto(`${BASE}/${loc}/login`, { waitUntil: 'load' }); await p.waitForTimeout(800);
    const phone = '10' + String(Date.now()).slice(-8); const tel = p.locator('input[type=tel], input[autocomplete=tel]').first();
    console.log(loc, 'phone autocomplete', await tel.getAttribute('autocomplete'), 'inputmode', await tel.getAttribute('inputmode'));
    await tel.focus(); await p.keyboard.type('12'); await p.keyboard.press('Enter'); await p.waitForTimeout(800);
    console.log(loc, 'bad phone →', await act(p), 'invalid=', await tel.getAttribute('aria-invalid'), 'live:', await live(p));
    await tel.fill(''); await tel.focus(); await p.keyboard.type(phone); await p.keyboard.press('Enter'); await p.waitForTimeout(1500);
    const code = p.locator('input[autocomplete=one-time-code]');
    console.log(loc, 'after send →', await act(p), 'live:', await live(p));
    await p.evaluate(() => navigator.clipboard.writeText('١٢٣ ٤٥٦')); await code.focus(); await p.keyboard.press('Control+V'); await p.waitForTimeout(200);
    console.log(loc, 'pasted arabic-indic "١٢٣ ٤٥٦" →', await code.inputValue());
    const ax = await new AxeBuilder({ page: p }).withTags(TAGS).analyze(); console.log(loc, 'otp step axe', ax.violations.map((v) => v.id).join(',') || 'ok');
    await ctx.close();
    // 3D stage
    const c2 = await b.newContext({ viewport: { width: 1440, height: 900 } }); const d = await c2.newPage();
    await d.goto(`${BASE}/${loc}/design/mailer-box`, { waitUntil: 'load' }); await d.waitForTimeout(4000);
    const app = d.locator('[role=application]').first();
    console.log(loc, '3D', JSON.stringify(await app.evaluate((e) => ({ name: e.getAttribute('aria-label'), rd: e.getAttribute('aria-roledescription'), hint: document.getElementById(e.getAttribute('aria-describedby'))?.textContent, keys: e.getAttribute('aria-keyshortcuts'), tab: e.tabIndex }))));
    const before = await live(d); await app.focus(); await d.keyboard.press('ArrowLeft'); await d.keyboard.press('+'); await d.waitForTimeout(700);
    console.log(loc, '3D after keys, live regions changed:', (await live(d)) !== before, '|', (await live(d)).slice(0, 160));
    const vc = await d.evaluate(() => [...document.querySelectorAll('[role=toolbar] button')].map((x) => x.getAttribute('aria-label') + ' ' + Math.round(x.getBoundingClientRect().width) + 'x' + Math.round(x.getBoundingClientRect().height)));
    console.log(loc, '3D view buttons (2.5.7 single-pointer alternative):', vc.join(' | '));
    await c2.close();
    // admin refund dialog
    const c3 = await b.newContext({ viewport: { width: 1440, height: 900 } }); await c3.addCookies([{ name: 'elba_session', value: SESS.admin, url: BASE }]); const a = await c3.newPage();
    await a.goto(`${BASE}/${loc}/admin/orders/ELB-26001`, { waitUntil: 'load' }); await a.waitForTimeout(1500);
    const btns = a.locator('main button'); const n = await btns.count(); let opened = 0;
    for (let i = 0; i < n && opened < 4; i++) { const bt = btns.nth(i); if (!(await bt.isVisible()) || (await bt.isDisabled())) continue; const label = (await bt.textContent()).trim();
      if (!/refund|change|edit|استرداد|تغيير|تعديل/i.test(label)) continue;
      await bt.focus(); await a.keyboard.press('Enter'); await a.waitForTimeout(500);
      const dlg = a.locator('[role=dialog]'); if (!(await dlg.count())) { console.log(loc, 'admin', label, '→ inline (no dialog)', await act(a)); await a.keyboard.press('Escape'); continue; }
      opened++; const inside = []; for (let k = 0; k < 15; k++) { await a.keyboard.press('Tab'); inside.push(await a.evaluate(() => !!document.activeElement.closest('[role=dialog]'))); }
      const dax = await new AxeBuilder({ page: a }).include('[role=dialog]').withTags(TAGS).analyze();
      await a.keyboard.press('Escape'); await a.waitForTimeout(400);
      console.log(loc, 'admin dialog', label, 'trap:', inside.every(Boolean), 'axe:', dax.violations.map((v) => v.id).join(',') || 'ok', 'after Esc focus:', await act(a)); }
    // toast vs focus: post an internal note
    const note = a.locator('textarea').last(); await note.focus(); await a.keyboard.type('a11y r5 note'); await a.keyboard.press('Tab'); await a.keyboard.press('Enter'); await a.waitForTimeout(1200);
    const ov = await a.evaluate(() => { const f = document.activeElement.getBoundingClientRect(); const t = [...document.querySelectorAll('[class*=Toast]')].map((x) => x.getBoundingClientRect()).filter((r) => r.width); return { focus: document.activeElement.tagName + ' ' + Math.round(f.top) + '-' + Math.round(f.bottom), toasts: t.map((r) => Math.round(r.top) + '-' + Math.round(r.bottom) + ' x' + Math.round(r.left) + '-' + Math.round(r.right)), overlap: t.some((r) => r.top < f.bottom && r.bottom > f.top && r.left < f.right && r.right > f.left) }; });
    console.log(loc, 'toast after note:', JSON.stringify(ov), 'live:', (await live(a)).slice(0, 120));
    await c3.close();
  }
  await b.close(); })();
