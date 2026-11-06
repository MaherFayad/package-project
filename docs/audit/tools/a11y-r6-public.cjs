// Round 6 (pass 3): new public pages. Per page × locale × width × motion: axe after a full scroll,
// overflow, contrast of text over gradients / images (axe "incomplete": pixels sampled with the
// text hidden), running animations and every pause control (2.2.2), header menus by keyboard,
// a Tab walk (focus visible, obscured, lost). PAGES=/,/start LOCS WIDTHS MOTION=both|reduce|normal OUT
const { chromium } = require('playwright'); const { AxeBuilder } = require('@axe-core/playwright'); const fs = require('fs'); 
const BASE = 'http://localhost:3000'; const OUT = process.env.OUT || 'docs/audit/a11y-out'; fs.mkdirSync(OUT, { recursive: true });
const PAGES = (process.env.PAGES || '/,/start,/why-elba,/pricing,/designer,/dev/kit').split(','); const LOCS = (process.env.LOCS || 'ar,en').split(',');
const WIDTHS = (process.env.WIDTHS || '320,390,1024,1440').split(',').map(Number); const MOTIONS = process.env.MOTION === 'reduce' ? ['reduce'] : process.env.MOTION === 'normal' ? ['no-preference'] : ['no-preference', 'reduce'];
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const lum = (r, g, b) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
(async () => {
  const b = await chromium.launch();
  for (const motion of MOTIONS) for (const w of WIDTHS) for (const loc of LOCS) {
    const ctx = await b.newContext({ viewport: { width: w, height: w < 600 ? 844 : 900 }, reducedMotion: motion, hasTouch: w < 600, isMobile: w < 600 });
    await ctx.addCookies([{ name: 'elba_cookie_notice', value: '1', url: BASE }]); const p = await ctx.newPage();
    for (const path of PAGES) { const url = `/${loc}${path === '/' ? '' : path}`; const tag = `${motion === 'reduce' ? 'RM' : 'M'} ${w} ${url}`;
      let st = 0; try { st = (await p.goto(BASE + url, { waitUntil: 'load', timeout: 60000 })).status(); } catch (e) { console.log(tag, 'LOAD FAIL', String(e).slice(0, 80)); continue; }
      await p.waitForTimeout(800);
      // scroll through so reveals run
      await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += innerHeight * 0.7) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } scrollTo(0, 0); }); await p.waitForTimeout(600);
      const ax = await new AxeBuilder({ page: p }).withTags(TAGS).analyze();
      const viol = ax.violations.map((v) => `${v.id}×${v.nodes.length}[${v.nodes[0].target.join(' ').slice(0, 60)}]`);
      const info = await p.evaluate(() => ({ ov: document.documentElement.scrollWidth - document.documentElement.clientWidth, h1: document.querySelectorAll('h1').length, lang: document.documentElement.lang, dir: document.documentElement.dir,
        anims: document.getAnimations().filter((a) => a.playState === 'running' && (a.effect?.getTiming?.().iterations === Infinity || (a.effect?.getTiming?.().duration || 0) > 5000)).length,
        videos: [...document.querySelectorAll('video')].filter((v) => !v.paused).length }));
      // contrast over gradients/images: axe incomplete color-contrast nodes
      const inc = (ax.incomplete.find((x) => x.id === 'color-contrast')?.nodes || []).slice(0, 25); const low = [];
      for (const n of inc) { const sel = n.target[0]; if (typeof sel !== 'string') continue; const el = p.locator(sel).first(); if (!(await el.count())) continue;
        try { await el.scrollIntoViewIfNeeded({ timeout: 2000 }); } catch { continue; }
        const meta = await el.evaluate((e) => { const cs = getComputedStyle(e); const m = cs.color.match(/[\d.]+/g).map(Number); const r = e.getBoundingClientRect(); const big = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.66 && +cs.fontWeight >= 700); for (const x of [e, ...e.querySelectorAll('*')]) { x.style.setProperty('color', 'transparent', 'important'); x.style.setProperty('text-shadow', 'none', 'important'); x.style.setProperty('-webkit-text-fill-color', 'transparent', 'important'); x.style.setProperty('caret-color', 'transparent', 'important'); if (x.tagName === 'svg') x.style.setProperty('visibility', 'hidden', 'important'); } return { c: m, a: m[3] ?? 1, r: { x: r.x, y: r.y, w: r.width, h: r.height }, big, text: (e.textContent || '').trim().slice(0, 30) }; });
        if (meta.r.w < 2 || meta.r.h < 2 || meta.r.y < 0 || meta.r.x >= w - 2 || meta.r.x + meta.r.w < 2 || meta.r.y + meta.r.h > (w < 600 ? 844 : 900)) { await el.evaluate((e) => { for (const x of [e, ...e.querySelectorAll('*')]) for (const k of ['color', 'text-shadow', '-webkit-text-fill-color', 'caret-color', 'visibility']) x.style.removeProperty(k); }); continue; }
        await p.waitForTimeout(60); const buf = await p.screenshot({ clip: { x: Math.max(0, meta.r.x), y: Math.max(0, meta.r.y), width: Math.min(meta.r.w, w - Math.max(0, meta.r.x)), height: meta.r.h } });
        await el.evaluate((e) => { for (const x of [e, ...e.querySelectorAll('*')]) for (const k of ['color', 'text-shadow', '-webkit-text-fill-color', 'caret-color', 'visibility']) x.style.removeProperty(k); });
        const px = await p.evaluate(async (b64) => { const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0); return Array.from(x.getImageData(0, 0, c.width, c.height).data); }, buf.toString('base64'));
        const rs = []; const tl = lum(...meta.c.slice(0, 3));
        for (let i = 0; i < px.length; i += 4 * 7) { const bl = lum(px[i], px[i + 1], px[i + 2]); const fg = meta.a < 1 ? lum(...meta.c.slice(0, 3).map((c, k) => c * meta.a + px[i + k] * (1 - meta.a))) : tl; rs.push(ratio(fg, bl)); }
        rs.sort((a, b) => a - b); const worst = rs[Math.floor(rs.length * 0.05)] ?? 99; // 5th percentile: one highlight pixel is not the background
        const need = meta.big ? 3 : 4.5; if (worst < need) low.push(`"${meta.text}" ${worst.toFixed(2)}<${need}`); }
      // pause controls
      let pauses = ''; if (motion !== 'reduce') { const btns = p.locator('button[aria-pressed], button').filter({ hasText: /^$/ }).or(p.getByRole('button', { name: loc === 'ar' ? /إيقاف|إيقاف مؤقت|تشغيل/ : /pause|play/i }));
        const pb = p.getByRole('button', { name: loc === 'ar' ? /إيقاف|تشغيل/ : /pause|play/i }); const nb = await pb.count(); const before = info.anims;
        const sizes = []; const hs = await pb.elementHandles(); for (const h of hs) { if (!(await h.isVisible())) continue; const bx = await h.boundingBox(); sizes.push(`${Math.round(bx.width)}x${Math.round(bx.height)}`); await h.scrollIntoViewIfNeeded().catch(() => {}); await h.focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(150); }
        await p.waitForTimeout(300); const after = await p.evaluate(() => ({ a: document.getAnimations().filter((a) => a.playState === 'running' && (a.effect?.getTiming?.().iterations === Infinity || (a.effect?.getTiming?.().duration || 0) > 5000)).map((a) => (a.effect?.target?.className || '').toString().slice(0, 30) + ':' + (a.animationName || a.id || '')), v: [...document.querySelectorAll('video')].filter((v) => !v.paused).length }));
        pauses = `pause:${nb}[${sizes.join(',')}] anims ${before}→${after.a.length}${after.a.length ? ' still:' + [...new Set(after.a)].slice(0, 4).join('|') : ''} video→${after.v}`; await p.reload(); await p.waitForTimeout(800); }
      // header menus by keyboard
      const menus = []; const exp = p.locator('header [aria-expanded], [role=banner] [aria-expanded]'); const ne = await exp.count();
      for (let i = 0; i < ne; i++) { const m = exp.nth(i); if (!(await m.isVisible())) continue; const name = ((await m.getAttribute('aria-label')) || (await m.textContent()) || '').trim().slice(0, 20); await m.focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(350);
        const e1 = await m.getAttribute('aria-expanded'); await p.keyboard.press('Tab'); const inside = await p.evaluate((ctl) => { const a = document.activeElement; const c = ctl && document.getElementById(ctl); return a === document.body ? 'BODY' : c ? (c.contains(a) ? 'in' : 'OUT:' + a.tagName + ' ' + (a.textContent || '').trim().slice(0, 20)) : 'nocontrols:' + a.tagName + ' ' + (a.textContent || '').trim().slice(0, 20); }, await m.getAttribute('aria-controls'));
        await p.keyboard.press('Escape'); await p.waitForTimeout(300); const e2 = await m.getAttribute('aria-expanded'); const back = await m.evaluate((el) => document.activeElement === el);
        menus.push(`${name}:${e1}/${inside}/esc→${e2}${back ? '' : ' FOCUS-NOT-BACK'}`); if (e2 === 'true') { await p.keyboard.press('Escape'); } }
      // Tab walk
      const bad = new Set(); for (let i = 0; i < 40; i++) { await p.keyboard.press('Tab'); const r = await p.evaluate(() => { const a = document.activeElement; if (!a || a === document.body) return 'BODY'; const bx = a.getBoundingClientRect(); const cs = getComputedStyle(a); const ring = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0 || /rgb/.test(cs.boxShadow); const cx = bx.left + bx.width / 2, cy = bx.top + Math.min(bx.height / 2, 12); const e = document.elementFromPoint(Math.min(Math.max(cx, 0), innerWidth - 1), Math.min(Math.max(cy, 0), innerHeight - 1)); const vis = e && (a === e || a.contains(e) || e.contains(a)); const name = (a.getAttribute('aria-label') || a.textContent || '').trim().slice(0, 24); return (!ring ? `NORING "${name}"` : '') + (!vis ? ` OBSCURED "${name}"` : '') + (bx.width < 24 || bx.height < 24 ? ` SMALL "${name}" ${Math.round(bx.width)}x${Math.round(bx.height)}` : ''); }); if (r === 'BODY') { bad.add('BODY@' + i); break; } if (r) bad.add(r.trim()); }
      console.log(`${loc} ${tag} ${st} axe:${viol.join(',') || 'ok'} ov:${info.ov} h1:${info.h1} ${info.lang}/${info.dir} anims:${info.anims} vid:${info.videos} lowC:${low.length ? low.join(' ; ') : 0} ${pauses} menus:${menus.join(' ; ') || '-'} kb:${[...bad].slice(0, 6).join(' ; ') || 'ok'}`);
      if (w === 390 || w === 1440) await p.screenshot({ path: `${OUT}/r6p-${loc}-${w}-${motion === 'reduce' ? 'rm' : 'm'}-${path.replace(/\W+/g, '_') || 'home'}.png` });
    }
    await ctx.close();
  }
  await b.close();
})();
