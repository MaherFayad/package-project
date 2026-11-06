// Round 5 WCAG 2.2 AA sweep: crawl per role, then every URL x locale x width (320, 390, 1440):
// axe (wcag2a/2aa/21a/21aa/22aa), reflow (1.4.10), text spacing (1.4.12, once per URL+locale at 390),
// placeholder contrast (1.4.3; axe skips ::placeholder), landmarks/headings summary.
// SESS=path/to/sessions.json (from a11y-r5-sessions.ts) OUT=dir ROLES=anon,buyer,...
const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');
const fs = require('fs');
const BASE = process.env.BASE || 'http://localhost:3000';
const OUT = process.env.OUT || 'docs/audit/a11y-out'; fs.mkdirSync(OUT, { recursive: true });
const SESS = process.env.SESS ? JSON.parse(fs.readFileSync(process.env.SESS, 'utf8')) : {};
const ROLES = (process.env.ROLES || 'anon,buyer,vendor,admin,applicant').split(',');
const WIDTHS = (process.env.WIDTHS || '320,390,1440').split(',').map(Number);
const MAX = Number(process.env.MAX || 40);
const SEEDS = { anon: ['/', '/login', '/vendor/apply', '/design', '/catalog', '/boxes', '/bottles', '/vendors', '/legal/privacy', '/legal/terms', '/legal/cookies', '/nope-404', '/unsubscribe'],
  buyer: ['/account', '/orders', '/checkout', '/design'], vendor: ['/vendor', '/vendor/jobs', '/vendor/payouts', '/vendor/profile', '/vendor/rate-cards'],
  admin: ['/admin', '/admin/orders', '/admin/vendors', '/admin/users', '/admin/disputes', '/admin/catalog', '/admin/pricing', '/admin/privacy', '/admin/audit', '/admin/quotes', '/admin/payouts', '/admin/moderation'],
  applicant: ['/vendor/apply'] };
const PREFIX = { anon: null, buyer: /^(account|orders|checkout|s\/)/, vendor: /^vendor/, admin: /^admin/, applicant: /^vendor\/apply/ };
const pattern = (p) => p.replace(/^\/(design|boxes|bottles|catalog|vendors|legal)\/[^/]+/, '/$1/:x').replace(/\/[0-9a-z]{20,}/gi, '/:id').replace(/\/(EL|ELB)[-A-Z0-9]+/g, '/:num').replace(/\/\d+(x\d+)+/g, '/:size');
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
async function settle(page) { await page.waitForTimeout(1200); }
(async () => {
  const browser = await chromium.launch(); const results = [];
  for (const role of ROLES) {
    const mk = (w) => browser.newContext({ viewport: { width: w, height: w < 600 ? 844 : 900 }, hasTouch: w < 600, isMobile: w < 600 }).then(async (c) => { if (SESS[role]) await c.addCookies([{ name: 'elba_session', value: SESS[role], url: BASE }]); await c.addCookies([{ name: 'elba_cookie_notice', value: '1', url: BASE }]).catch(() => {}); return c; });
    // discovery (en, 1440)
    if (process.env.URLS) SEEDS[role] = [];
    const dctx = await mk(1440); const dp = await dctx.newPage(); const urls = []; const pats = new Map(); const seen = new Set(); const q = [...SEEDS[role]];
    while (q.length && urls.length < MAX) { const path = q.shift(); if (seen.has(path)) continue; seen.add(path); const pat = pattern(path); const lim = /:x/.test(pat) ? 2 : 1; if ((pats.get(pat) || 0) >= lim) continue; pats.set(pat, (pats.get(pat) || 0) + 1);
      try { await dp.goto(BASE + '/en' + (path === '/' ? '' : path), { waitUntil: 'load', timeout: 45000 }); } catch { continue; }
      urls.push(path); await dp.waitForTimeout(500);
      for (const h of await dp.$$eval('a[href]', (as) => as.map((a) => a.getAttribute('href')))) { if (!h || !h.startsWith('/en')) continue; const p2 = h.split('#')[0].split('?')[0].replace(/^\/en/, '') || '/'; if (/\/api\/|\/dev\//.test(p2)) continue; if (PREFIX[role] && !PREFIX[role].test(p2.slice(1))) continue; if (/invoice$/.test(p2) && role === 'anon') continue; if (!seen.has(p2)) q.push(p2); } }
    await dctx.close();
    if (process.env.URLS) urls.splice(0, urls.length, ...process.env.URLS.split(','));
    console.error(role, 'urls', urls.length, urls.join(' '));
    for (const w of WIDTHS) { const ctx = await mk(w); const page = await ctx.newPage();
      for (const path of urls) for (const loc of ['ar', 'en']) { const url = '/' + loc + (path === '/' ? '' : path);
        let status = 0; try { const r = await page.goto(BASE + url, { waitUntil: 'load', timeout: 45000 }); status = r ? r.status() : 0; } catch (e) { results.push({ role, w, url, error: String(e).slice(0, 120) }); continue; }
        await settle(page);
        let ax; try { ax = await new AxeBuilder({ page }).withTags(TAGS).analyze(); } catch (e) { ax = { violations: [{ id: 'axe-error:' + String(e).slice(0, 60), nodes: [] }] }; }
        const viol = ax.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, t: v.nodes.slice(0, 3).map((x) => x.target.join(' ') + ' :: ' + (x.failureSummary || '').split('\n').slice(1, 2).join('').slice(0, 140)) }));
        const info = await page.evaluate(() => {
          const w = document.documentElement.clientWidth, sw = document.documentElement.scrollWidth;
          const ph = []; for (const el of document.querySelectorAll('input[placeholder],textarea[placeholder]')) { if (!el.getClientRects().length) continue; const c = getComputedStyle(el, '::placeholder').color; let bg = 'rgba(0, 0, 0, 0)', p = el; while (p && /rgba\(0, 0, 0, 0\)|transparent/.test(bg)) { bg = getComputedStyle(p).backgroundColor; p = p.parentElement; } ph.push([el.id || el.name || el.placeholder.slice(0, 20), c, bg]); }
          return { lang: document.documentElement.lang, dir: document.documentElement.dir, title: document.title, h1: document.querySelectorAll('h1').length, main: document.querySelectorAll('main,[role=main]').length, overflow: sw - w, ph };
        });
        let spacing = null;
        if (w === 390) { await page.addStyleTag({ content: '*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}' }); await page.waitForTimeout(250);
          spacing = await page.evaluate(() => { const bad = []; for (const el of document.querySelectorAll('body *')) { if (el.closest('.visually-hidden,[aria-hidden=true],svg,canvas')) continue; if (![...el.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())) continue; const cs = getComputedStyle(el); const clip = [cs.overflow, cs.overflowX, cs.overflowY].includes('hidden') || cs.textOverflow === 'ellipsis' || cs.webkitLineClamp !== 'none'; if (clip && (el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2)) bad.push(el.tagName + '.' + String(el.className).slice(0, 40) + ' "' + el.textContent.trim().slice(0, 30) + '"'); if (bad.length > 6) break; } return { bad, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth }; }); }
        const rec = { role, w, url, status, viol, info, spacing }; results.push(rec);
        console.log(`${role} ${w} ${url} ${status} axe:${viol.map((v) => v.id + '×' + v.n).join(',') || 'ok'} ov:${info.overflow} h1:${info.h1} main:${info.main}${spacing ? ' sp:' + spacing.bad.length + (spacing.overflow > 0 ? ' spOv:' + spacing.overflow : '') : ''}`);
      }
      await ctx.close(); fs.writeFileSync(OUT + '/r5-sweep-' + ROLES.join('_') + '.json', JSON.stringify(results, null, 1)); }
  }
  fs.writeFileSync(OUT + '/r5-sweep-' + ROLES.join('_') + '.json', JSON.stringify(results, null, 1)); await browser.close();
})();
