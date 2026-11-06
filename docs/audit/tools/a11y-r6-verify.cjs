// Round 6 verification: R4-10 3D status message; dispute "Send report" focus. SESS DATA LOC
const { chromium } = require('playwright'); const fs = require('fs'); const BASE = 'http://localhost:3000';
(async () => { const S = JSON.parse(fs.readFileSync(process.env.SESS, 'utf8')); const D = JSON.parse(fs.readFileSync(process.env.DATA, 'utf8')); const loc = process.env.LOC || 'en'; const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 1440, height: 900 } }); await c.addCookies([{ name: 'elba_session', value: S.buyer, url: BASE }, { name: 'elba_cookie_notice', value: '1', url: BASE }]); const p = await c.newPage();
  await p.goto(`${BASE}/${loc}/design/mailer-box`); const st = p.getByTestId('stage-3d'); await st.locator('canvas').first().waitFor({ timeout: 60000 }); await p.waitForTimeout(1500);
  const app = p.locator('[role=application]').first(); await app.focus();
  for (const k of ['ArrowLeft', 'ArrowLeft', 'ArrowUp', '+', '0']) { await p.keyboard.press(k); await p.waitForTimeout(450); console.log('R4-10', k, '→', JSON.stringify(await app.locator('[role=status]').textContent())); }
  await p.goto(`${BASE}/${loc}/orders/${D.delivered.id}`); await p.waitForTimeout(1200);
  const fi = () => p.evaluate(() => { const a = document.activeElement; return !a || a === document.body ? 'BODY' : `${a.tagName} "${(a.textContent || '').trim().slice(0, 50)}"`; });
  await p.getByRole('button', { name: loc === 'ar' ? 'الإبلاغ عن مشكلة' : 'Report a problem' }).click(); await p.getByLabel(loc === 'ar' ? /وصف المشكلة/ : 'Describe the problem').fill('Logo smudged on 40 boxes, see photos.');
  const send = p.getByRole('button', { name: loc === 'ar' ? /إرسال البلاغ/ : 'Send report' }); await send.focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(3000); console.log('DISPUTE sent → focus', await fi(p));
  await b.close(); })();
