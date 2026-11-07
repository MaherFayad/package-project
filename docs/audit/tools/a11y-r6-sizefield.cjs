// Designer size field: type an invalid / out-of-range value, report what is exposed. LOC
const { chromium } = require('playwright'); const BASE = 'http://localhost:3000';
(async () => { const b = await chromium.launch(); const c = await b.newContext({ viewport: { width: 1440, height: 900 } }); await c.addCookies([{ name: 'elba_cookie_notice', value: '1', url: BASE }]);
  const p = await c.newPage(); const loc = process.env.LOC || 'en'; await p.goto(`${BASE}/${loc}/design/${process.env.MODEL || 'mailer-box'}`); await p.getByTestId('stage-3d').locator('canvas').first().waitFor({ timeout: 60000 }); await p.waitForTimeout(1500);
  const f = p.locator('[role=spinbutton]:visible').first();
  for (const v of ['abc', '1000', '5', '١٢٠']) { await f.fill(v); await p.waitForTimeout(400); await p.keyboard.press('Tab'); await p.waitForTimeout(300);
    console.log(JSON.stringify(v), await f.evaluate((e) => ({ val: e.value, invalid: e.getAttribute('aria-invalid'), now: e.getAttribute('aria-valuenow'), desc: (e.getAttribute('aria-describedby') || '').split(' ').map((i) => document.getElementById(i)?.textContent).join(' / '), alerts: [...document.querySelectorAll('[role=alert]')].map((a) => a.textContent).filter(Boolean).join(' | ') }))); await f.focus(); }
  await b.close(); })();
