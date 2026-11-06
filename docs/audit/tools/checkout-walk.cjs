// Checkout round 4 walker: the buyer journey after design, as a fresh account, per locale x viewport.
// share (anon) -> soft gate -> checkout start -> step 1 (tiers, sample, quote) -> step 2 (errors, company)
// -> step 3 (proof, print check) -> payment (method, card, decline, paid) -> success -> order -> invoice
// -> orders list -> account -> share (owner). axe (WCAG 2.2 AA + best practice) and overflow per screen.
// Usage: BASE=http://localhost:3000 OUT=dir COMBOS=en-390,ar-1440 node docs/audit/tools/checkout-walk.cjs
const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');
const fs = require('fs');
const BASE = process.env.BASE || 'http://localhost:3000';
const OUT = process.env.OUT || '/tmp/checkout-walk';
const COMBOS = (process.env.COMBOS || 'en-390,ar-390,en-1440,ar-1440').split(',');
const FULL = process.env.FULL !== '0';
fs.mkdirSync(OUT, { recursive: true });

const doc = {
  v: 1, name: 'Nour candles mailer', structureCode: 'FEFCO_0427', dims: { L: 250, W: 180, H: 80 },
  materialCode: 'E_FLUTE_KRAFT', finishCode: 'MATTE_LAMINATION', printSides: 'OUTSIDE',
  artwork: { outside: { background: '#f4e9d8', layers: [{ id: 't1', kind: 'text', face: 'top', surface: 'outside', x: 125, y: 90, width: 120, height: 14, rotation: 0, text: 'Nour', fontFamily: 'Inter', fontSizePt: 28, fontWeight: 700, color: '#303030', align: 'center', direction: 'ltr' }] }, inside: { background: null, layers: [] } },
};

function phone() { return '+2015' + String(Math.floor(Math.random() * 1e8)).padStart(8, '0'); }
async function login(ctx, ph, locale) {
  for (let k = 0; k < 4; k++) {
    const r = await ctx.request.post(BASE + '/api/auth/request-otp', { data: { phone: ph } });
    const j = await r.json();
    const v = await ctx.request.post(BASE + '/api/auth/verify-otp', { data: { phone: ph, code: j.devCode, locale, acceptTerms: true } });
    if (v.ok()) return;
    await new Promise((res) => setTimeout(res, ((j.retryAfterSec || 2) + 1) * 1000));
  }
  throw new Error('login failed');
}

const results = [];
async function snap(page, name, combo, opts = {}) {
  await page.waitForTimeout(opts.wait ?? 500);
  const file = `${OUT}/${combo}-${name}.png`;
  await page.screenshot({ path: file, fullPage: opts.full ?? FULL });
  let viol = [];
  try {
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
    viol = axe.violations.map((v) => `${v.id}(${v.impact}) x${v.nodes.length}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
  } catch (e) { viol = ['axe-error ' + String(e).slice(0, 120)]; }
  const ov = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  const r = { combo, name, url: page.url().replace(BASE, ''), overflow: ov, axe: viol };
  results.push(r);
  console.log(`${combo} ${name} ov=${ov} axe=${viol.length}${viol.length ? ' ' + viol.join(' ;; ') : ''}`);
}

(async () => {
  const browser = await chromium.launch();
  for (const combo of COMBOS) {
    const [locale, w] = combo.split('-');
    const vp = Number(w) < 600 ? { width: Number(w), height: 844 } : { width: Number(w), height: 900 };
    const ctx = await browser.newContext({ viewport: vp, locale: locale === 'ar' ? 'ar-EG' : 'en-US' });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)); });
    const L = (p) => `${BASE}/${locale}${p}`;
    const t = (en, ar) => (locale === 'ar' ? ar : en);
    try {
      // Soft gate
      await page.goto(L('/checkout'));
      await snap(page, '00-gate', combo);
      const ph = phone();
      await login(ctx, ph, locale);
      // Checkout start (empty)
      await page.goto(L('/checkout'));
      await snap(page, '01-start-empty', combo);
      const res = await page.request.post(BASE + '/api/designs', { data: { doc } });
      const { id: designId } = await res.json();
      // share link
      const sh = await page.request.post(BASE + `/api/designs/${designId}/share`).catch(() => null);
      let shareUrl = null;
      if (sh && sh.ok()) { const j = await sh.json(); shareUrl = j.url || j.shareUrl || (j.token ? `/s/${j.token}` : null); }
      await page.goto(L('/checkout'));
      await snap(page, '02-start-list', combo);
      await page.goto(L(`/checkout/${designId}`));
      await page.getByTestId('vendor-offer').first().waitFor({ timeout: 30000 });
      await snap(page, '03-step1', combo);
      await snap(page, '03b-step1-viewport', combo, { full: false });
      // quote
      const other = page.getByLabel(t('Other quantity', 'كمية أخرى'));
      if (await other.count()) {
        await other.fill('5000'); await other.press('Enter');
        await page.waitForTimeout(800);
        await snap(page, '04-quote', combo);
        const send = page.getByRole('button', { name: t('Request a price', 'طلب السعر') });
        if (await send.count()) { await send.first().click(); await page.waitForTimeout(1200); await snap(page, '04b-quote-sent', combo); }
        await page.goto(L(`/checkout/${designId}`));
        await page.getByTestId('vendor-offer').first().waitFor({ timeout: 30000 });
      }
      const summary = page.getByRole('complementary');
      const cont = async () => {
        const btns = page.locator('[data-sticky-action] button, aside button').filter({ hasText: t('Continue', 'متابعة') });
        const vis = summary.getByRole('button', { name: t('Continue', 'متابعة') });
        if (await vis.isVisible().catch(() => false)) await vis.click(); else await btns.last().click();
      };
      await cont();
      await page.waitForTimeout(800);
      await snap(page, '05-step2-empty', combo);
      await cont();
      await page.waitForTimeout(500);
      await snap(page, '05b-step2-errors', combo);
      await page.getByLabel(t('Full name', 'الاسم الكامل')).fill(t('Mona Adel', 'منى عادل'));
      await page.getByLabel(t('Mobile number', 'رقم المحمول')).fill('010 1234 5678');
      await page.getByLabel(t('Governorate', 'المحافظة')).selectOption({ index: 2 });
      await page.getByLabel(t('City or district', 'المدينة أو الحي')).fill(t('Dokki', 'الدقي'));
      await page.getByLabel(t('Street address', 'عنوان الشارع')).first().fill(t('12 Tahrir St', '12 شارع التحرير'));
      const company = page.getByLabel(t('I need a company tax invoice', 'أحتاج فاتورة ضريبية باسم شركة'));
      if (await company.count()) { await company.check({ force: true }); await page.waitForTimeout(300); await snap(page, '05c-step2-company', combo); await company.uncheck({ force: true }); }
      await cont();
      await page.waitForTimeout(2500);
      await snap(page, '06-step3-proof', combo);
      const approveName = t('Approve proof and pay', 'الموافقة على البروفة والدفع');
      const approve = page.getByRole('button', { name: approveName });
      await approve.last().click().catch(async () => { await page.locator('button', { hasText: approveName }).last().click(); });
      await page.waitForTimeout(500);
      await snap(page, '06b-step3-error', combo);
      await page.locator('input[type=checkbox]').filter({ visible: true }).last().check({ force: true });
      // acknowledge boxes: check all visible checkboxes in proof step
      const boxes = page.locator('input[type=checkbox]');
      for (let i = 0; i < await boxes.count(); i++) { const b = boxes.nth(i); if (await b.isVisible() && !(await b.isChecked())) await b.check({ force: true }).catch(() => {}); }
      await approve.last().click();
      await page.waitForURL(/checkout\/pay\//, { timeout: 30000 });
      await snap(page, '07-pay-method', combo);
      await page.getByRole('button', { name: t('Continue', 'متابعة') }).click();
      await page.waitForTimeout(800);
      await snap(page, '07b-pay-card', combo);
      await page.getByLabel(t('Card number', 'رقم البطاقة')).fill('4000 0000 0000 0002');
      await page.getByLabel(/MM\/YY|الشهر/).fill('12/30').catch(() => {});
      await page.getByLabel(t('Security code', 'رمز الأمان')).fill('123').catch(() => {});
      await page.getByRole('button', { name: new RegExp(t('^Pay ', '^دفع')) }).click();
      await page.waitForTimeout(2500);
      await snap(page, '07c-pay-declined', combo);
      await page.getByLabel(t('Card number', 'رقم البطاقة')).fill('4242 4242 4242 4242');
      await page.getByRole('button', { name: new RegExp(t('^Pay ', '^دفع')) }).click();
      await page.waitForURL(/orders\/[^/?]+\?paid=1/, { timeout: 30000 });
      await snap(page, '08-paid', combo, { wait: 1200 });
      const orderUrl = page.url().split('?')[0];
      await page.goto(orderUrl);
      await snap(page, '09-order', combo);
      await page.goto(orderUrl + '/invoice');
      await snap(page, '10-invoice', combo);
      await page.goto(L('/orders'));
      await snap(page, '11-orders', combo);
      await page.goto(L('/account'));
      await snap(page, '12-account', combo);
      if (shareUrl) {
        const su = shareUrl.startsWith('http') ? shareUrl : BASE + (shareUrl.startsWith('/' + locale) ? shareUrl : `/${locale}${shareUrl}`);
        await page.goto(su); await snap(page, '13-share-owner', combo, { wait: 2000 });
        const anon = await browser.newContext({ viewport: vp });
        const ap = await anon.newPage();
        await ap.goto(su); await snap(ap, '14-share-anon', combo, { wait: 2000 });
        await anon.close();
      } else console.log('no share url', sh && sh.status());
      // seeded order for the seeded buyer handled elsewhere
    } catch (e) {
      console.log(combo, 'FAILED', String(e).slice(0, 400));
      await page.screenshot({ path: `${OUT}/${combo}-FAIL.png`, fullPage: true }).catch(() => {});
    }
    if (errors.length) console.log(combo, 'page errors:', [...new Set(errors)].join('\n  '));
    await ctx.close();
  }
  fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 1));
  await browser.close();
})();
