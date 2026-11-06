# R6 · `/[locale]/start` (main "start designing free" landing)

Reference: `https://www.shopify.com/sa/start` (ar) and `https://www.shopify.com/start` (en), captured 6 Nov 2026 with Playwright at 1440x900 and 390x844 (scroll frames every half viewport, scroll video, computed styles). Captures are kept out of git (Shopify imagery); only measurements are recorded here.

## Measured reference (computed styles)

| Item | Measured |
|---|---|
| Page bg | `rgb(2,9,10)` throughout; bento sheet `#fff` with 48px top radius; dark inset card `rgb(2,8,8)` 32px |
| Hero h1 | 200px / 300px line, weight 300, tracking -4px, white; en "start · today" split horizontally around a central collage; ar «ابدأ» above, «اليوم» below, collage between and around |
| Section h2 | 56px / 60.5px, weight 330, tracking -0.56px ("Choose your design", "Make your products shine", "Get ready to get paid"); 64px / 69px, -1.28px ("Join an all-star lineup", "Get going, then get growing") |
| Subcopy | 16px, ~60% white, centred under h2 |
| Primary pill | `#fff` bg, `#000` text, radius 9999px, 44px (header/hero) and 56px / 18px (closing), weight 550 |
| Keyframes | `hero-title-slide-in`, `marquee-ltr/rtl`, `ticker`, `fade-in`, `typing-fade-in`, `logo-group-marquee` |
| Section heights at 1440 | hero 869, choose-design pinned run 3361 (sticky), shine 680, paid 712, lineup 1208, bento 814, closing ~634 |
| Phone 390 | hero words 96px stacked, collage between; pinned card full-bleed minus 16px gutters; cards fan scroll horizontally |

## Section table

| # | Shopify section | Elba section (`src/app/[locale]/(store)/start/page.tsx`) | Built with | Content | Status |
|---|---|---|---|---|---|
| 1 | Hero "start today": 200px light split headline around a central photo, collage at parallax depths, subline + pill | «ابدأ اليوم» / "start today": Latin split left/right of the box, Arabic stacked above/below (as on the reference's Arabic page); centre = NOUR mailer cutout (LCP, AVIF preload); 6 cutouts at depths 0.3 to 1; live price chip and "3D proof" chip | kit `Sheet hero`, `HeroTitle`, `Collage`, `Pill`; ASSETS `r6/collage/*` | price chip = engine price for 500 mailers 250x180x80 | done |
| 2 | "Choose your design": pinned card scales to full bleed | "Choose your box": designer screenshot pinned, grows 0.5 → full bleed over 190vh; phones get the portrait phone frame of the designer; "Open the designer" + model count + 4 ready styles | kit `PinnedScale`, `Display`, `Lead`, `Reveal`; ASSETS `r6/ui/phone-designer-*` | real editor link `/design?structure=FEFCO_0427`, 3D only after the click (poster first) | done |
| 3 | "Make your products shine": glowing product card + tool chip | "Make your packaging shine": rigid box in a violet glow card, "3D preview" chip, 5 finish chips | kit `Glow`, `Reveal` | finish count from `DESIGN_FINISH_CODES` | done |
| 4 | "Get ready to get paid": small checkout card | "See the price, pay your way": checkout preview with 100 / 500 / 1,000 rows from `getPriceFrom`, VAT 14%, total, delivery days, payment methods; "Printer confirms before you are charged" chip | kit `Glow`, `Pill dark` | live engine prices (ISR 1 h) | done |
| 5 | "Join an all-star lineup": tilted card arc, last card is the CTA | "Brands waiting for their box": 7 fictional brand cards, each with a «نموذج» / "Sample" badge and SAMPLE_LABEL in its alt, section copy says the brands are made up; last card "Your brand here" CTA | kit `CardFan`; ASSETS `r6/cards/*` | no logos, no "since" years, no counts | done |
| 6 | "Get going, then get growing": white 48px sheet, light bento with UI mockups | "Start, then grow": share link, print-ready PDF, sample first, one-tap reorder; dark stats card (models in library, finishes, active printers) | kit `Sheet white`, `Bento`, `BentoCard` | numbers counted from `MODELS`, finishes and the DB | done |
| 7 | "Need more muscle?" help rows | not built | — | needs Elba help content that does not exist yet | skipped (no content) |
| 8 | "See for yourself" videos | not built | — | no Elba tutorial videos yet; no fakes | skipped (no content) |
| 9 | Closing "Ready to start selling?": mark, h2, 3-step line, email field | "Ready to design your box?": mark, steps "Design free → Approve the proof → Printed and delivered", phone field | kit `Sheet`, `PhoneSignup` (HeroPhoneForm logic: Egyptian mobile, number never in the URL, PDPL 151/2020 fine print) | — | done |

Page-local code: `src/components/marketing/start/copy.ts` (ar/en copy, tested in `__tests__/copy.test.ts`) and `start.module.css` (layout and the page's own mockups: chips, checkout card, bento mocks). No kit component is forked; the early page-local motion island (`StartMotion`) was removed once the foundation kit landed.

## Checks (prod build, `next start`)

| Check | Result |
|---|---|
| `npm run lint` | 0 errors (1 warning in ASSETS' `scripts/marketing/render-ui.mjs`, not this page) |
| `npm run typecheck` | pass |
| `npm test` | 108 files, 8756 tests pass (adds `start/__tests__/copy.test.ts`: key/placeholder parity, no Arabic diacritics, sample labelling, no social-proof words) |
| `npm run build` | pass; `/[locale]/start` SSG, revalidate 1 h |
| `e2e/start.spec.ts` (desktop + mobile, ar + en) | 18/18: sections and h1, engine prices in the table, every fan card says Sample, every body link goes to `/design`, header pill goes to `/start`, empty phone submit opens the designer, bad number shows the error and a good one goes to login without the number in the URL, axe 0 (WCAG 2.2 AA tags), no horizontal scroll, reduced motion static (pinned card not sticky, no transform), no console or hydration errors |
| `e2e/journey.spec.ts` | pass (home → /start → designer → … → admin) |
| Perf, phone (390, 4x CPU, Slow 4G) | ar LCP 1.82 s, CLS 0.009; en LCP 1.61 s, CLS 0.000 |
| Perf, desktop | ar LCP 0.33 s, en 0.22 s, CLS 0.000 |
| Sitemap | `/ar/start`, `/en/start` (priority 0.9) |

CLS note: the Arabic display face swaps in late on Slow 4G; the hero lines are fixed 1.25em boxes and the phone subline reserves two lines, which took phone-ar CLS from 0.055 to 0.009 (the remainder is the shared cookie notice).

## Outside this page (small, additive)
- `src/components/marketing/navModel.ts`: `startHref()` now returns `/${locale}/start`; new `newDesignHref()`.
- `src/components/marketing/MarketingHeader.tsx` + `StartLink.tsx`: `signedInHref`, so signed-in "New design" still opens the designer.
- Home `cta.primary` and `/boxes` "Start designing free" links → `/start`.
- `e2e/journey.spec.ts` step 1 follows home → `/start` → designer.
- `src/app/sitemap.ts`, `docs/audit/tools/perf-pages.mjs` list `/start`.

## Open
- `e2e/storefront.spec.ts` "legal pages are marked for lawyer review" fails after the FOUNDATION footer merge (the footer no longer has a "Returns for custom goods" link in the expected place). Foundation scope.
- ASSETS: `assets.generated.ts` has no sizes for `collage/*` and `cards/*`, and `cards/sahwa-can` is listed but not rendered; this page passes explicit 400x400 / 600x900 sizes and uses only the rendered cards.
- The home hero phone form still opens the designer directly (sign-up action; a landing page in between adds a step).

## Decisions
- All CTAs on `/start` go to `/[locale]/design` (with the mailer preset); the site's "Start designing free" link CTAs now go to `/[locale]/start`. Signed-in users' header CTA ("New design") still goes straight to the designer (task label, not a pitch: R4-CR-09).
- The home hero phone form keeps its designer target: it is a sign-up action, and sending a just-signed-in person back to a landing page adds a step.
- No social proof: the fan cards say "Sample" on each card and in the section copy; numbers are counted from the DB/engine at build time (ISR hourly).
- Motion is enhancement only: content is visible without JS; `prefers-reduced-motion` stops parallax, pinned scale (card shown at full size) and fan drift.
