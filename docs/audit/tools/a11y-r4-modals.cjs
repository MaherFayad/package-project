const { chromium } = require('playwright');
const loc = process.argv[2] || 'en'; const W = Number(process.argv[3] || 1440);
const act = (p) => p.evaluate(() => { const e = document.activeElement; return e ? (e.tagName + '[' + (e.getAttribute('role')||'') + '] "' + (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 40) + '" inDialog=' + !!e.closest('[role=dialog]')) : 'none'; });
(async () => { const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: W, height: W < 600 ? 844 : 900 } });
  const p = await ctx.newPage(); await p.goto(`http://localhost:3000/${loc}/design/mailer-box`, { waitUntil: 'load' }); await p.waitForTimeout(3000);
  // 3D canvas keys
  const app = p.getByRole('application'); await app.focus(); console.log('app focus:', await act(p));
  for (const k of ['ArrowLeft', 'ArrowUp', '+', '0']) { await p.keyboard.press(k); await p.waitForTimeout(150); }
  console.log('live regions:', JSON.stringify(await p.$$eval('[aria-live],[role=status],[role=alert]', (els) => els.map((e) => e.textContent.trim().slice(0, 60)).filter(Boolean))));
  // Each modal: open via keyboard, tab cycle, escape, focus return
  for (const name of loc === 'en' ? ['Export', 'Share', 'Save', 'Order this box', 'Change model'] : ['تصدير', 'مشاركة', 'حفظ', 'اطلب هذه العلبة', 'تغيير الموديل']) {
    const btn = p.getByRole('button', { name, exact: true }).first();
    if (!(await btn.count())) { console.log('no button', name); continue; }
    await btn.focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(700);
    const dlg = await p.evaluate(() => { const d = document.querySelector('[role=dialog][aria-modal=true],dialog[open]'); if (!d) return null; const lab = d.getAttribute('aria-labelledby'); return { name: d.getAttribute('aria-label') || (lab && document.getElementById(lab)?.textContent) , tag: d.tagName }; });
    console.log('\n#', name, '-> dialog', JSON.stringify(dlg), 'focus:', await act(p), 'url:', p.url().slice(21));
    if (!dlg) { if (!p.url().includes('mailer-box')) { await p.goBack(); await p.waitForTimeout(2500); } continue; }
    let out = 0; for (let i = 0; i < 40; i++) { await p.keyboard.press('Tab'); const inD = await p.evaluate(() => !!document.activeElement?.closest('[role=dialog],dialog')); if (!inD) out++; }
    let outS = 0; for (let i = 0; i < 10; i++) { await p.keyboard.press('Shift+Tab'); const inD = await p.evaluate(() => !!document.activeElement?.closest('[role=dialog],dialog')); if (!inD) outS++; }
    console.log('  tab escapes:', out, 'shift-tab escapes:', outS);
    await p.keyboard.press('Escape'); await p.waitForTimeout(500);
    console.log('  after Esc focus:', await act(p), 'dialog still:', await p.evaluate(() => !!document.querySelector('[role=dialog][aria-modal=true],dialog[open]')));
  }
  await b.close(); })();
