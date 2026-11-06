// R6: reproduce the catalogue quote-request race. JS chunks are held for HOLD ms, the quantity is
// typed before hydration (as Playwright's fill() does on a slow server), then Send is pressed.
// SESS=sessions.json HOLD=3000
const { chromium } = require('playwright'); const fs = require('fs'); const BASE = 'http://localhost:3000';
(async () => { const S = JSON.parse(fs.readFileSync(process.env.SESS, 'utf8')); const b = await chromium.launch(); const c = await b.newContext({ viewport: { width: 1280, height: 800 } });
  await c.addCookies([{ name: 'elba_session', value: S.buyer, url: BASE }, { name: 'elba_cookie_notice', value: '1', url: BASE }]);
  const p = await c.newPage(); const hold = +(process.env.HOLD || 3000);
  await p.route('**/_next/static/chunks/**', async (r) => { await new Promise((ok) => setTimeout(ok, hold)); await r.continue(); });
  const posts = []; p.on('request', (r) => { if (r.url().includes('quote-request')) posts.push(r.postData()); });
  p.on('framenavigated', (f) => { if (f === p.mainFrame()) console.log('navigated', f.url()); });
  await p.goto(BASE + '/en/catalog/FS_PULP_EGG_6', { waitUntil: 'domcontentloaded' });
  await p.getByLabel('Quantity').fill('50'); console.log('typed before hydration; value now', await p.getByLabel('Quantity').inputValue());
  await p.waitForTimeout(hold + 2500); console.log('after hydration value', await p.getByLabel('Quantity').inputValue());
  await p.getByRole('button', { name: 'Send request' }).click(); await p.waitForTimeout(1500);
  console.log('posts', posts, '| qty error shown:', await p.getByText('Enter a quantity from 100').isVisible(), '| sent shown:', await p.getByText(/Request sent/).isVisible().catch(() => false));
  await b.close(); })();
