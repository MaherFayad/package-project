// a11y sweep: crawl per role+locale, axe (WCAG 2.2 AA tags), reflow 320, text spacing, target size.
const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');
const fs = require('fs');
const BASE = process.env.BASE || 'http://localhost:3000';
const OUT = process.env.OUT || 'docs/audit/a11y-out';
fs.mkdirSync(OUT, { recursive: true });
const ROLES = { anon: null, buyer: '+201000000002', vendor: '+201000000010', admin: '+201000000001', applicant: '+201000000020' };
const only = process.env.ROLES ? process.env.ROLES.split(',') : Object.keys(ROLES);
const LOCALES = (process.env.LOCALES || 'ar,en').split(',');
const MAX = Number(process.env.MAX || 60);
const SEEDS = { anon: ['/', '/login', '/vendor/apply', '/design', '/catalog', '/boxes', '/bottles', '/vendors', '/legal/privacy', '/legal/terms'],
  buyer: ['/account', '/orders', '/checkout', '/design'], vendor: ['/vendor', '/vendor/jobs', '/vendor/payouts', '/vendor/profile', '/vendor/rate-cards'],
  admin: ['/admin', '/admin/orders', '/admin/vendors', '/admin/users', '/admin/disputes', '/admin/catalog', '/admin/pricing', '/admin/privacy', '/admin/audit', '/admin/vendors/applications'],
  applicant: ['/vendor/apply', '/account'] };
if (process.env.URLS) for (const r of Object.keys(SEEDS)) SEEDS[r] = process.env.URLS.split(',');
const PREFIX = { anon: null, buyer: /^\/(account|orders|checkout|s\/)/, vendor: /^\/vendor/, admin: /^\/admin/, applicant: /^\/(vendor\/apply|account)/ };
function pattern(p) { return p.replace(/^\/(design|boxes|bottles|catalog|vendors|legal)\/[^/]+/, '/$1/:x').replace(/\/[0-9a-z]{20,}/gi, '/:id').replace(/\/(EL|ELB)[-A-Z0-9]+/g, '/:num').replace(/\/\d+(x\d+)+/g, '/:size').replace(/\/[a-z0-9]+(-[a-z0-9]+){2,}/g, '/:slug'); }
async function login(ctx, phone, locale) {
  for (let k = 0; k < 4; k++) {
  const r = await ctx.request.post(BASE + '/api/auth/request-otp', { data: { phone } });
  const j = await r.json();
  const v = await ctx.request.post(BASE + '/api/auth/verify-otp', { data: { phone, code: j.devCode, locale, acceptTerms: true } });
  if (v.ok()) return; console.error('login retry', JSON.stringify(j), await v.text()); await new Promise((r) => setTimeout(r, ((j.retryAfterSec || 2) + 1) * 1000)); }
  throw new Error('login failed ' + phone);
}
(async () => {
  const browser = await chromium.launch();
  const results = [];
  for (const role of only) { const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    if (ROLES[role]) await login(ctx, ROLES[role], LOCALES[0]);
    for (const locale of LOCALES) {
    const page = await ctx.newPage();
    const seen = new Set(); const pats = new Map(); const queue = SEEDS[role].map((s) => `/${locale}${s === '/' ? '' : s}`);
    let n = 0;
    while (queue.length && n < MAX) {
      const url = queue.shift();
      const path = url.replace(new RegExp('^/' + locale), '') || '/';
      const pat = pattern(path);
      if (!process.env.URLS && pats.has(pat) && (pats.get(pat) >= (/:x/.test(pat) ? 2 : 1))) continue;
      pats.set(pat, (pats.get(pat) || 0) + 1);
      if (seen.has(url)) continue; seen.add(url); n++;
      let status = 0;
      try { const resp = await page.goto(BASE + url, { waitUntil: process.env.WAIT || 'networkidle', timeout: 45000 }); status = resp ? resp.status() : 0; } catch (e) { results.push({ role, locale, url, error: String(e).slice(0, 200) }); continue; }
      await page.waitForTimeout(process.env.WAIT ? 2500 : 400);
      const links = await page.$$eval('a[href]', (as) => as.map((a) => a.getAttribute('href')));
      if (!process.env.URLS) for (const h of links) {
        if (!h || !h.startsWith('/' + locale)) continue;
        const clean = h.split('#')[0].split('?')[0];
        const p2 = clean.replace(new RegExp('^/' + locale), '') || '/';
        if (/\/invoice|\/api\//.test(p2) && role === 'anon') continue;
        if (PREFIX[role] && !PREFIX[role].test(p2.slice(1) ? p2.slice(1) : '') && !PREFIX[role].test(p2.slice(1))) continue;
        if (!seen.has(clean)) queue.push(clean);
      }
      const meta = await page.evaluate(() => ({ lang: document.documentElement.lang, dir: document.documentElement.dir, title: document.title, h1: document.querySelectorAll('h1').length }));
      let axe;
      try { axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze(); } catch (e) { axe = { violations: [{ id: 'axe-error', impact: 'n/a', nodes: [], help: String(e).slice(0, 200) }] }; }
      const viol = axe.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, n: v.nodes.length, targets: v.nodes.slice(0, 4).map((x) => x.target.join(' ') + ' :: ' + (x.failureSummary || '').split('\n').slice(1, 2).join('')) }));
      // reflow 320
      await page.setViewportSize({ width: 320, height: 640 }); await page.waitForTimeout(300);
      const reflow = await page.evaluate(() => {
        const w = document.documentElement.clientWidth; const sw = document.documentElement.scrollWidth;
        const off = []; for (const el of document.querySelectorAll('body *')) { const r = el.getBoundingClientRect(); if (r.width && (r.right > w + 2 || r.left < -2)) { const cs = getComputedStyle(el); if (cs.position === 'fixed' || el.closest('[aria-hidden=true],.visually-hidden')) continue; let p = el.parentElement, clipped = false; while (p) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') { clipped = true; break; } p = p.parentElement; } if (!clipped) off.push((el.tagName + '.' + String(el.className).slice(0, 40))); } if (off.length > 5) break; }
        return { w, sw, overflow: sw > w + 1, off };
      });
      // text spacing 1.4.12
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.addStyleTag({ content: '*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}' });
      await page.waitForTimeout(200);
      const spacing = await page.evaluate(() => {
        const bad = [];
        for (const el of document.querySelectorAll('body *')) {
          if (!el.childNodes.length || el.closest('.visually-hidden,[aria-hidden=true],svg,canvas')) continue;
          const hasText = [...el.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim());
          if (!hasText) continue;
          const cs = getComputedStyle(el);
          if ((cs.overflow === 'hidden' || cs.overflowY === 'hidden' || cs.overflowX === 'hidden' || cs.textOverflow === 'ellipsis') && (el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2)) bad.push(el.tagName + '.' + String(el.className).slice(0, 50) + ' "' + el.textContent.trim().slice(0, 30) + '"');
          if (bad.length > 8) break;
        }
        return bad;
      });
      const rec = { role, locale, url, pat, status, meta, viol, reflow, spacing };
      results.push(rec);
      console.log(`${role} ${locale} ${url} ${status} axe:${viol.map((v) => v.id + '×' + v.n).join(',') || 'ok'} reflow:${reflow.overflow ? 'OVER ' + reflow.sw : 'ok'}${reflow.off.length ? ' off:' + reflow.off.slice(0, 3).join('|') : ''} spacing:${spacing.length}`);
    }
    fs.writeFileSync(OUT + '/sweep-' + only.join('_') + (process.env.TAG||'') + '.json', JSON.stringify(results, null, 1));
    } await ctx.close();
  }
  fs.writeFileSync(OUT + '/sweep-' + only.join('_') + (process.env.TAG||'') + '.json', JSON.stringify(results, null, 1));
  await browser.close();
})();
