// Vendor profile: edit, Save in the top-bar save bar by keyboard, follow focus. LOC W
const { chromium } = require('playwright'); const fs = require('fs'); const BASE = 'http://localhost:3000';
(async () => { const S = JSON.parse(fs.readFileSync(process.env.SESS, 'utf8')); const b = await chromium.launch(); const w = +(process.env.W || 1440);
  const c = await b.newContext({ viewport: { width: w, height: 900 } }); await c.addCookies([{ name: 'elba_session', value: S.vendor, url: BASE }, { name: 'elba_cookie_notice', value: '1', url: BASE }]);
  const p = await c.newPage(); const loc = process.env.LOC || 'en'; await p.goto(`${BASE}/${loc}/vendor/${process.env.PAGE || 'profile'}`); await p.waitForTimeout(1500);
  const fi = () => p.evaluate(() => { const a = document.activeElement; return !a || a === document.body ? 'BODY' : `${a.tagName} "${(a.labels?.[0]?.textContent || a.getAttribute('aria-label') || a.textContent || '').trim().slice(0, 40)}"`; });
  const field = p.locator('main textarea, main input[type=text], main input:not([type])').first(); await field.focus(); await p.keyboard.press('End'); await p.keyboard.type(' x');
  const bar = p.getByRole('region', { name: loc === 'ar' ? /غير محفوظة/ : /Unsaved/ }); await bar.waitFor(); const save = bar.getByRole('button').last(); console.log('save btn', await save.textContent());
  await p.evaluate(() => { window.__log = []; const L = (e) => window.__log.push(`${Math.round(performance.now())} ${e.type} ${e.target.tagName} "${(e.target.textContent || '').slice(0, 20)}" connected=${e.target.isConnected}`); document.addEventListener('focusin', L, true); document.addEventListener('focusout', L, true); });
  await save.focus(); await p.keyboard.press('Enter'); for (const t of [50, 300, 1000, 2500]) { await p.waitForTimeout(t); console.log('t+', t, await fi()); }
  if (process.env.DEBUG) console.log((await p.evaluate(() => window.__log)).join('\n'));
  await b.close(); })();
