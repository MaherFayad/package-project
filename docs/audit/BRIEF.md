You are one of several parallel Claude sessions auditing and fixing "Elba" (علبة), a Next.js App Router + TypeScript + Prisma (SQLite dev) + three.js/@react-three/fiber platform where Egyptian brands design packaging on a live 3D model for free and order printing from vetted Egyptian print vendors. The base is the head of on branch claude/exciting-albattani-8kzgsu; other sessions are working in parallel on other areas, and an integrator will merge your branch, so STAY INSIDE YOUR SCOPE (listed below). If a fix truly needs a file outside scope, make the smallest additive change and list it in your report.

SETUP
- npm ci (or npm install), then: export ELBA_DATABASE_URL="file:./dev.db"; npx prisma migrate reset --force (or db push + seed per package.json scripts). Read README.md and docs/ARCHITECTURE.md first.
- Run the app with npm run dev (or build + start). Routes are /ar/... and /en/....
- Dev login: POST /api/auth/request-otp {phone} returns devCode; POST /api/auth/verify-otp {phone, code, locale, acceptTerms:true} sets the session cookie. Seeded phones: admin +201000000001, buyer +201000000002, vendor staff +201000000010, applicant +201000000020.
- Chromium + Playwright are preinstalled: require('playwright') works, chromium.launch() needs no options. Never run "playwright install". Pass --trace off to Playwright test runs.
- Some code was mid-integration at the snapshot (3D model picker, seed, catalogue). If something outside your scope is broken, note it in your report and work around it; do not fix it.

REFERENCES
- docs/research-report.md (the business plan), docs/design-refs/shopify-mobbin-reference.md (admin / in-app look: Shopify Polaris language), docs/design-refs/shopify-marketing-reference.md (public marketing pages: shopify.com language: 64 to 96px headlines, pill buttons, banded white / #f5f5f3 / dark sections, 1200 to 1280px container). The image files those docs mention are not in git; work from the written descriptions and your knowledge of Polaris and shopify.com. Never use Shopify's logo, name, icons, illustrations, photos or copy.
- Arabic copy: Modern Standard Arabic natural for Egypt, noun-form labels, no diacritics, RTL correct.
- Standards to cite: WCAG 2.2 AA (contrast 1.4.3, focus visible 2.4.7 / not obscured 2.4.11, target size 2.5.8, dragging alternatives 2.5.7, reduced motion 2.3.3, pause 2.2.2, labels 3.3.2, errors 3.3.1), Egypt PDPL (Law 151/2020) for consent and personal data, Egyptian VAT 14% and e-invoicing (ETA) awareness.

METHOD (repeat until your area is clean, at least 2 passes)
1. AUDIT by actually using the product in a real browser with Playwright: every flow in your scope end to end, ar and en, 390x844 and 1440x900, loading / empty / error / success states, keyboard only, plus axe-core (npm i -D @axe-core/playwright if missing). Look at your screenshots. Judge against the bar "looks and feels amazing in every way": hierarchy, spacing rhythm, type scale, Arabic typography, alignment, colour restraint, icon consistency, copy, motion (token-based 100 to 300ms, ease-out enter, hover/press states, subtle reveal once, skeletons not spinners, prefers-reduced-motion respected, CLS < 0.1), correctness, security, performance.
2. WRITE every finding to docs/audit/<your-key>.md as a table: id, severity (critical = broken flow / data / security; high = clearly wrong, ugly or inaccessible; medium = noticeable polish; low = nitpick), page/file, finding, standard, fix, status.
3. FIX all of them, critical first, including lows. Never skip, weaken or delete a test to get green; fix the code.
4. VERIFY: npm run lint, npm run typecheck, npm test, npm run build, and the Playwright e2e specs that cover your scope (use --workers=2). Re-audit in the browser to confirm each fix; mark status fixed / reopened.
5. Save before/after screenshots under docs/screenshots/audit/<your-key>/ (png, 1x DPR is fine, keep total under 15 MB).
6. Commit with a clear message ending with these two lines:
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01ErLBsbrJGKcLzRPdTmLyhq
and push to your outcome branch (git push -u origin <branch>, retry with backoff on network errors). Commit and push after each pass, not only at the end. Do not open a pull request. Do not put model names in commits or files.

FINAL REPLY: counts of findings by severity, what was fixed, anything left open and why, files touched outside scope, and the test results.

ROUND 2 (and later rounds)
- Your base already contains the round 1 fixes of every area. First read docs/audit/<your-key>.md (if it exists) and every other docs/audit/*.md that touches your area.
- Re-verify every item marked fixed in the real browser; reopen any that is not truly fixed (status: reopened, round 2).
- Then do a completely fresh audit as if you had never seen the product: new findings get ids prefixed R2-.
- Append a "Round 2" section to docs/audit/<your-key>.md (keep round 1 rows). Same severity scale, same fix-and-verify method, same commit rules.
- Measure performance of your pages with docs/audit/tools/perf-pages.mjs and docs/audit/tools/perf-3d.mjs where relevant; budgets: LCP < 2.5 s, CLS < 0.1, INP < 200 ms, non-3D JS < 200 KB gz.

ROUND 4
- Base: everything from rounds 1 to 3 is merged (main at 64f5f32 or later). Read docs/audit/ROUND3.md and your area's docs/audit/<key>.md, docs/audit/craft.md, a11y.md, business.md and performance.md first.
- Re-verify every row marked fixed in your area in the real browser; reopen any that is not.
- Then a completely fresh audit with ids prefixed R4-. Same severity scale, same fix-and-verify method.
- e2e: use the factory in e2e/fixtures/factory.ts for any test that changes data (unique users and orders), so --workers=2 stays reliable. Playwright needs OTP_DEV_ECHO=1 and ALLOW_MOCK_PAYMENTS=1 under next start.
- After adding or renaming a model, run npx tsx scripts/generate-library-index.ts, scripts/generate-order-mode-table.ts and scripts/generate-catalogue-rows.ts.
- Append a "Round 4" section to docs/audit/<your-key>.md. FINAL REPLY must include counts of NEW findings by severity (critical/high/medium/low) found this round, before fixing; the rounds stop when a round finds no medium-or-worse issue.
