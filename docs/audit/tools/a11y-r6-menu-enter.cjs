// R6-AX-16: Tab to each desktop mega-menu trigger (focus opens it), press Enter: still open? first link focused?
const { chromium } = require('playwright'); const BASE = 'http://localhost:3000';
(async () => { const b = await chromium.launch(); for (const loc of ['en', 'ar']) { const c = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p = await c.newPage(); await p.goto(`${BASE}/${loc}`); await p.waitForTimeout(1500);
  for (let i = 0; i < 40; i++) { await p.keyboard.press('Tab'); const t = await p.evaluate(() => document.activeElement?.hasAttribute('data-menu-trigger') ? document.activeElement.textContent.trim() : null); if (!t) continue;
    await p.waitForTimeout(200); const before = await p.evaluate(() => document.activeElement.getAttribute('aria-expanded')); await p.keyboard.press('Enter'); await p.waitForTimeout(400);
    const after = await p.evaluate(() => { const a = document.activeElement; return `${a.getAttribute('aria-expanded') ?? ''} focus=${a.tagName} "${(a.textContent || '').trim().slice(0, 24)}"`; }); console.log(loc, t, 'focus-open:', before, '→ Enter:', after);
    await p.keyboard.press('Escape'); await p.waitForTimeout(300); console.log('   esc → focus on trigger:', await p.evaluate(() => document.activeElement?.hasAttribute('data-menu-trigger')), 'expanded', await p.evaluate(() => document.activeElement?.getAttribute('aria-expanded'))); if (t.includes('Why') || t.includes('لماذا')) break; }
  await c.close(); } await b.close(); })();
