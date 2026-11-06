# Audit: public marketing experience (key: marketing)

Scope: home `/[locale]`, `(store)/layout.tsx`, `/boxes`, `/bottles`, `/vendors`, `/vendors/[slug]`, `/boxes/[structure]`, `/legal/[doc]`, `src/components/marketing`, `src/components/store` (not the catalogue grid), `src/styles` motion and marketing styles, and marketing i18n keys.

Method: a production build (`next build && next start`), driven with Playwright at 390x844 and 1440x900 in `ar` and `en`. Each pass took a full-page screenshot and a fold screenshot of every route, ran axe-core (WCAG 2.0/2.1/2.2 A and AA tags), measured CLS and LCP with PerformanceObserver, and checked horizontal overflow. Each pass also checked keyboard tab order, the running CSS animations with and without `prefers-reduced-motion`, and the hover transform, and recorded short videos (desktop en, mobile ar, reduced-motion en).

Reference: `docs/design-refs/shopify-marketing-reference.md`.

## Results summary

| Metric | Before | After |
|---|---|---|
| CLS (/, /boxes, /bottles, /vendors, /boxes/[structure], legal; both viewports) | 0.46 to 0.48 on most routes | 0.000 on every route |
| LCP (390x844, no throttling, no scroll) | 0.2 to 0.9 s | 0.1 to 0.9 s |
| axe violations | 1 serious (`scrollable-region-focusable`) on 3 routes | 0 |
| Horizontal scroll at 390px | none | none (one regression from pass 1 caught and fixed) |
| Marquee, chip float, pulse dot, menu, sheet, cookie animations | not running at all | running; all stop under reduced motion |
| /boxes page height (desktop / mobile) | 18,559 px / 46,153 px | about 7,100 px / about 14,000 px |

## Findings

| id | severity | page / file | finding | standard | fix | status |
|---|---|---|---|---|---|---|
| MK-01 | critical | `src/components/marketing/marketing.module.css` | None of the module's animations ran. CSS Modules renamed every `animation: m-…` reference (for example `m-marquee` became `marketing_m-marquee__hash`), but the keyframes are defined only in global `src/styles/motion.css`. The samples marquee stood still, the hero proof chips did not float, the eyebrow dot did not pulse, and the menu panel, mobile sheet and cookie bar had no entrance. So the "live" feel the reference asks for was missing. | Reference: motion (marquee, floating chips) | Added module-local copies of the six keyframes, with a comment saying why they are there. Checked in the browser: the marquee transform changes over time, and the chips run `m-float`. | fixed |
| MK-02 | high | `(store)/loading.tsx` | CLS was 0.46 to 0.48 on most marketing routes. The streamed route fallback was short (two Polaris cards), so the black footer painted inside the viewport and was then pushed down when the page streamed in. | Core Web Vitals (CLS < 0.1) | The fallback now reserves at least one viewport of height (`min-block-size: calc(100dvh - 64px)`), so the footer never paints in view. CLS is now 0.000 on all 26 route and viewport pairs. | fixed (pass 3: the fallback was then deleted, see PERF-01) |
| MK-03 | high | `(store)/loading.tsx` | The loading state was the admin skeleton (grey canvas, boxed cards), so every marketing navigation flashed an off-brand admin screen. | Reference: "no boxed card-everything layout on marketing pages"; skeletons, not spinners | Replaced it with a marketing hero skeleton: a mint hero band with eyebrow, display-headline, lead and pill shapes, and a shimmer that stops under reduced motion. | superseded (pass 3: the fallback was deleted, see PERF-01) |
| MK-04 | high | `/vendors/[slug]` | The printer profile was an admin page: 20px Polaris title, small logo, and everything boxed in cards on a white canvas. It did not match the marketing chrome around it, and the profile is the main trust page in the funnel. | Reference w01/w05: big headline, stats with accent rule | Added a marketing hero: mint band, breadcrumbs, logo with a city eyebrow, a 36 to 64px name, the bio as lead, badges, a black pill "Design a box with this printer" plus an outline "All printers" pill, and a 2x2 stats block (rating, on-time %, lead time, minimum order) with the accent rule. The detail cards now sit on a `#f5f5f3` band. The duplicate About card and the duplicate stats rows in the aside were removed. | fixed |
| MK-05 | high | `/boxes` (`BoxesLanding.tsx`) | `/boxes` rendered the full 370-model library grid under the landing page (18.5k px desktop, 46k px mobile). That buried the landing page, broke the band rhythm and left the page with no closing CTA. | Reference w02 category landing + w09 closing CTA band | Added a `library` prop. `/boxes` now ends with a grey band ("Every model we print", count, an outline pill to `/catalog#all-models`) and then a dark closing CTA band with a lime primary pill and a ghost secondary pill. `/catalog` (out of scope) keeps the full grid through the default. | fixed |
| MK-06 | high | `/boxes/[structure]`, `/vendors/[slug]` at 390px (`ui/IndexTable.tsx` DataTable) | The price and machines tables scroll sideways on phones, but the scroll container could not be focused, so keyboard users could not reach the hidden columns. axe flagged it as serious (`scrollable-region-focusable`). | WCAG 2.1.1 Keyboard | The DataTable scroll wrapper now has `tabIndex=0`, `role="region"` and `aria-label={caption}`. This is an additive change outside scope (ui). | fixed |
| MK-07 | medium | Header at 360 to 479px (`marketing.module.css`) | The header's black pill CTA was hidden below 480px, so phones showed only the wordmark and the menu button. The reference header always carries the pill. | Reference: header with pill CTA | The CTA now shows from 360px. Checked at 390px with the wordmark, pill and menu button: no overflow. | fixed |
| MK-08 | medium | All marketing CTAs at < 560px | Only the hero CTA was full width on phones. The secondary and closing CTAs were shrink-wrapped and centred, including "Open the designer", the closing pair, "Browse box styles", "See all printers" and the category hero pairs. | Reference: "CTA full width" on mobile; WCAG 2.5.8 target size | Below 560px, `.actions` stacks and stretches, and section-head pills stretch too. `.ctaInner` and the printer hero force their actions to full width. | fixed |
| MK-09 | medium | Cookie bar (`CookieBar` + CSS) | On phones the bar took about 140px (text, then a full-width button row) and covered most of the hero visual at first view. Its reserved space also sat as padding on `.site`, which left a white strip under the black footer. | PDPL (Law 151/2020): essential-only notice; WCAG 2.4.11 Focus Not Obscured | On phones the bar is now one row with the text beside the button (about 76px). The reserved height moved into the footer's bottom padding, so the footer stays black to the edge. Focus and scroll padding still clear the bar. The copy still says only essential cookies are used, with no advertising cookies, and links to the cookie notice. That is the right pattern under the PDPL, because nothing optional is set, so no opt-in toggle is needed. | fixed |
| MK-10 | medium | `(store)/error.tsx` | The route error state was a Polaris card with an admin button inside the marketing chrome. | Reference: marketing language | Restyled as a centred mint band with an H2, a lead, a black "Try again" pill and an outline "Go to home page" pill, still inside `role="alert"`. | fixed |
| MK-11 | medium | `src/styles/motion.css` | Scroll reveals ran for 720ms with a 24px rise, and the hero visual scaled in over 900ms. That read as slow and floaty against the brief's "subtle reveal once". | Brief: token-based, ease-out enter | `--m-dur-reveal` is now 480ms, `--m-rise` is 16px and the hero scale-in is 600ms. Ease-out and the single run are unchanged. Hover, press and menu motion stay at 80 to 240ms. | fixed |
| MK-12 | medium | `marketing.ar.ts` | `صمم. قلب. اعتمد.` is ambiguous: قلب reads first as "heart". The values body has the same issue (`وقلب العلبة`). The stats highlight `بطباعة مطابع نعرفها` is clunky. | Arabic UX: natural MSA for Egypt | Changed to `صمم. عاين. اعتمد.`, `وأدر العلبة` and `تطبعها مطابع نعرفها.` | fixed |
| MK-13 | low | `Marquee.tsx` | Chrome makes the marquee viewport a keyboard-focusable scroller, and it had no accessible name (it was announced as an empty group). | WCAG 4.1.2 Name, Role, Value | Added `role="group"` and `aria-label` to the viewport. | fixed |
| MK-14 | low | `page.tsx` closing CTA | The closing headline size was an inline `style`, so it could not be reused. | Maintainability | Moved it to a `.ctaTitle` class, which the /boxes closing band also uses. | fixed |
| MK-15 | low | `marketing.module.css` | A class-name collision, found in the pass 1 re-audit: the new printer-profile body class reused `.vendorBody`, which `VendorShowcaseCard` already uses. That made the band a grid and caused 41px of horizontal scroll at 390px in Arabic. | No horizontal scroll (reference, mobile) | Renamed it to `.profileBody`. The overflow check now returns no elements in either locale. | fixed |
| MK-16 | low | Display H1s (`m-enter`) on home, /boxes, /bottles, /vendors, /vendors/[slug], /boxes/[structure], legal | Page headlines faded in from opacity 0. Chrome skips text that paints at opacity 0 as an LCP candidate, so the true visual LCP (the headline, once visible) was never measured, and the headline appeared about 0.8s late. | Core Web Vitals (LCP) | Added `.m-enter-lcp` in motion.css: a rise without the fade, switched off under reduced motion. All page H1s use it now, and the eyebrow, lead and CTA keep the fade. Note: the earlier "6.6s LCP" in the scroll-through script was an artifact of programmatic scrolling; without scrolling, LCP is 0.7 to 0.9s. | fixed |
| MK-17 | high | Mobile menu sheet (`HeaderNav.tsx`) | Found in pass 2. The full-screen menu (`position: fixed; inset: 0`) was rendered inside the sticky header, and the header's `backdrop-filter` makes it the containing block for fixed descendants. The sheet was clipped to the 64px bar. Focus moved into invisible links, and the page stayed visible underneath. Every phone user who opened the menu saw nothing. | WCAG 2.4.7 / 2.4.11 (focus on invisible controls); broken navigation | The sheet is portalled into the `.site` wrapper, which has no filter and still provides the tokens. Checked at 390px: the menu fills the screen, Shift+Tab stays trapped inside, and Escape closes it and returns focus to the menu button. | fixed |
| MK-18 | medium | `/boxes` at < 560px | Found in pass 2. Each family stacked full-width 4:3 product cards, 13 cards over about 11.7k px of scrolling. | Reference mobile: "collage becomes a horizontal scroll strip" | On phones each family is now a scroll-snap rail (82% cards, the next card peeking, full bleed inside the container; it never scrolls the page). Added a separate `.productRail` class so `/design` (out of scope), which shares `.productGrid`, is unchanged. I tried the rail on `/bottles` too and reverted it, because those "coming soon" cards contain nothing focusable, so the rail would not be keyboard scrollable (axe `scrollable-region-focusable`). | fixed |
| MK-19 | medium | Hero CTAs on `/boxes/[structure]`, `/vendors/[slug]` and the home design band at < 560px | Pass 2 reopened MK-08. Parents with `justify-items: start` shrink-wrapped the stacked `.actions`, so these CTAs were still not full width. | Reference: CTA full width on mobile | On phones `.actions` now sets `justify-self: stretch; inline-size: 100%` itself. Checked on `/en/boxes/mailer-box` at 390px: both pills span the full width. | fixed |

## Pass 3: integrator performance findings (docs/audit/performance.md)

Measured with the integrator's harness (`docs/audit/tools/perf-pages.mjs`) on a production build. Phone means 390x844, DPR 2, 4x CPU slowdown and Slow 4G; desktop means 1440x900 with no throttling. "Before" is this branch after pass 2; the integrator's own baseline was worse (CLS 0.48, because it predates MK-02).

| Page / profile | LCP before → after | INP before → after | TBT before → after | JS before → after | CLS before → after |
|---|---|---|---|---|---|
| home, phone ar | **10,060 → 3,988 ms** | **664 → 104 ms** | **5,502 → 580 ms** | **519 → 171 KB** | 0.000 → 0.000 |
| home, phone en | 2,952 → 2,652 ms | **736 → 104 ms** | **5,235 → 446 ms** | **519 → 171 KB** | 0.000 → 0.000 |
| home, desktop ar | 1,428 → 224 ms | 312 → 40 ms | **4,438 → 26 ms** | 519 → 176 KB | 0.000 → 0.000 |
| home, desktop en | 884 → 172 ms | 368 → 80 ms | **4,082 → 0 ms** | 519 → 176 KB | 0.000 → 0.006 |
| boxes, phone ar / en | 3,980 / 3,944 → 3,308 / 3,312 ms | 16 / 24 → 24 / 24 ms | 253 / 214 → 397 / 314 ms | 168 → 180 KB | 0.030 / 0.053 → 0.001 / 0.000 |
| bottles, phone ar / en | 4,524 / 4,676 → 3,644 / 3,448 ms | ≤ 16 ms | 333 / 221 → 329 / 236 ms | 160 → 175 KB | 0.036 / 0.080 → 0.001 / 0.000 |
| vendors, phone ar / en | 3,660 / 3,648 → 3,600 / 3,712 ms | ≤ 48 ms | 501 / 250 → 490 / 394 ms | 175 → 190 KB | 0.000 |
| home images (desktop ar) | 330 KB → 186 KB | | | | |

The +12 to 15 KB of JS on the store pages is the client session island and the cookie hook (PERF-06/07). It is the cost of making the pages static; the TBT changes on boxes and vendors are within run-to-run noise.

| id | severity | finding (from performance.md) | fix | status |
|---|---|---|---|---|
| PERF-01 | critical | CLS 0.48 from the `(store)/loading.tsx` streaming fallback. | Already at 0.000 after MK-02. In pass 3 I deleted the fallback: every marketing page now prerenders (PERF-06), so it bought nothing. It also caused **soft 404s**: `notFound()` streamed after a 200 header, so `/ar/vendors/nope` and `/en/boxes/nope-box` returned HTTP 200. Without the boundary they return 404. The unused skeleton CSS was removed. | fixed |
| PERF-02 | critical | LCP 10 s on phone ar. HeroScene3D unmounted the poster `<img>` and PackagingScene painted its own poster div only after three/r3f booted. | The poster `<img>` (fetchpriority high, now with srcset) stays mounted permanently. The canvas mounts above it and fades in after its first frame, and only then does the poster fade out (`[data-live]`). No `poster` is passed to HeroScene3D. LCP is now the `<img>` (phone ar 3.99 s, right after FCP 2.86 s on Slow 4G; desktop 0.17 to 0.22 s). | fixed |
| PERF-13 | critical | INP 624 ms and TBT 5 s: the 3D hero booted on idle as one 550 to 770 ms task and then rendered every frame forever. | The 3D hero mounts **only on intent**: the pointer enters or presses the box. It deliberately does not start from the pause button, which must never begin heavier motion. The chunk loads first and the mount waits for an idle callback, so the intent event paints at once. The dieline build, artwork paint and canvas mount are separate tasks with `scheduler.yield()` (or `setTimeout`) between them. The turntable stops after **8 s** and resumes when the pointer re-enters. Phones and keyboard users keep the identical poster; the designer has the full keyboard-operable viewer. Checked: no canvas before hover, a canvas after hover, poster opacity 0, box turning. | fixed |
| PERF-06 | high | `MarketingHeader` called `getSession()`, so every store page was dynamic (9 prerendered routes, `no-store`). | Added the `useSessionRole()` client hook: one cached `/api/auth/me` request per page load. `AccountLink` switches "Log in" to "My account", and HeaderNav adds the Orders and Vendor portal / Admin links on the client. The home `?denied` banner moved to a client island (`useSearchParams`). Home, /boxes, /boxes/[structure], /boxes/[structure]/[size] and /bottles have `revalidate = 3600`. /vendors/[slug] has `generateStaticParams() { return [] }` and ISR on first request. **157 prerendered routes** (was 9). `/ar` now answers `x-nextjs-cache: HIT`, `Cache-Control: s-maxage=3600, stale-while-revalidate`. The /vendors list stays dynamic on purpose, because its filters are query parameters. | fixed |
| PERF-07 | high | The cookie notice rendered only after hydration and became a late LCP element. | `CookieBar` and `CookieNotice` are now in the server HTML. A 1-line inline script after the notice hides it before paint when `elba_cookie_ack=1`. A `useSyncExternalStore` hook uses the server snapshot ("not acknowledged") during hydration, so there is no mismatch, and the real cookie afterwards, so client navigations do not flash it. The cookie text is no longer the LCP element on any measured page. | fixed |
| PERF-16 | medium | Images were served at more than 2.2x their rendered width, with no srcset and no lazy loading on samples. | `scripts/marketing/responsive-variants.cjs` writes `.400w` renders, `.320w` samples and `.720w` designer screenshots (renders already under 400 px wide are skipped). `srcSetFor()` and native widths in `assets.ts` drive `srcSet` + `sizes` on the hero poster, marquee, CTA tiles, product cards, printer cards, showcase rows, structure hero and designer screenshot. The marquee samples are now `loading="lazy"`. Home images on desktop ar went from 330 to 186 KB. No AVIF: it would need `<picture>` everywhere for a few KB on files of 6 to 41 KB. | fixed |
| MK-20 | medium | Found while measuring: the showcase rows on /boxes and /bottles grew when their images loaded (CSS `inline-size/block-size: auto` overrode the width/height hint, and every image had fixed 480x360 attributes), giving phone CLS 0.026 to 0.080. The rows also entered from opacity 0, which delayed LCP. | The images now carry their real intrinsic size (`renderDims()`) and a definite CSS height with `object-fit: contain`. The rows use the transform-only `m-enter-lcp` entrance, and the bottles centre render gets `fetchpriority=high`. CLS is now 0.000 to 0.001 and bottles phone LCP dropped about 1 s. | fixed |

Still above budget, outside my scope: phone FCP is 2.3 to 3.0 s on Slow 4G, which keeps phone LCP at 2.7 to 4.0 s. The cause is render-blocking CSS plus 242 KB of web fonts (Inter + IBM Plex Sans Arabic, several weights) from the root layout `src/app/[locale]/layout.tsx`. Subsetting or trimming weights there is the next lever.

## Checked and clean (no change needed)

- **Arabic typography.** IBM Plex Sans Arabic, `letter-spacing: 0` on `:lang(ar)`, display line height 1.25 (H2 1.3), eyebrows without uppercase or tracking, and logical properties throughout. Price numerals are isolated (`unicode-bidi: isolate`), and the 3D canvas and artwork are not mirrored.
- **Reference anatomy.** The page has every section the reference lists, each in the right band:
  - announcement bar (dismissible)
  - sticky header with menus, "Log in" and a pill CTA
  - split hero: 88px tight headline (EN) or 76px (AR), live 3D box with four floating proof chips (two on phones), phone field and pill
  - samples marquee
  - six-icon value grid
  - stats with highlighted phrase and accent rules
  - audience cards
  - designer screenshot band with three steps
  - finishes tiles
  - featured printers
  - FAQ
  - dark closing CTA with tiles
  - black footer with four columns, region, legal and social links
- **WCAG 2.2.2 Pause, Stop, Hide.** The marquee has its own pause button and also pauses on hover. A single button stops both the hero 3D turntable and the chip float. Both start paused under reduced motion.
- **WCAG 2.3.3 Animation from Interactions.** With `reducedMotion: reduce`, no CSS animations run, reveals show at once, and hover keeps colour changes but drops the transform.
- **Keyboard.** Tab order is: skip link, announcement link and close button, header, hero field, pill, 3D viewer, pause, marquee pause, then the cards. Every stop has a visible 2px focus ring. The hero field's ring is on the pill container through `:focus-within`, and card links outline the whole card through `:has()`.
- **PDPL.** The hero phone field is optional. The fine print says a one-time code is sent and no marketing messages go out without opt-in. The cookie bar covers essential cookies only and links to `/legal/cookies`. Legal pages carry a "draft for lawyer review" banner.

## Open / outside scope

- Printer portfolio images are crude seed placeholders: flat white and brown boxes on `/vendors/[slug]`. They come from seed data, which is outside this scope, and should be replaced with real printed-sample renders.
- The `/boxes/[structure]` lower body (price table, specs, popular sizes) still uses Polaris cards. This is acceptable for dense data, but it could later move to marketing tables.

## Screenshots

`docs/screenshots/audit/marketing/` (indexed PNG, 1x DPR, 1.7 MB total):

- `before-` / `after-home-en-1440-fold.png`, `before-` / `after-home-ar-390-fold.png`: the hero, header pill and compact cookie bar
- `before-` / `after-printer-profile-ar-1440.png`, `after-printer-profile-ar-390.png`: the printer profile hero
- `before-` / `after-boxes-en-1440-full.png`, `before-` / `after-boxes-en-390-full.png`, `after-boxes-en-390-rail.png`: the /boxes landing, library teaser, closing CTA and mobile rails
- `before-` / `after-structure-en-390-fold.png`: full-width hero CTAs
- `before-` / `after-home-ar-390-closing-cta.png`: the closing CTA band on mobile
- `after-mobile-menu-sheet-en-390.png`: the mobile menu sheet, now full screen (the clipped "before" state is described in MK-17)

Motion was checked with Playwright videos (desktop en, mobile ar, reduced-motion en; kept out of git) and with computed-style probes: the marquee transform changes over time, chips run `m-float`, card hover gives `translateY(-4px)`, and under reduced motion no animations run and hover leaves no transform.

## Verification (final build)

- `npm run lint`: clean. `npm run typecheck`: clean. `npm test`: 43 files, 5905 tests passed. `npm run build`: OK.
- Playwright e2e `smoke`, `storefront` and `journey` (desktop + mobile, `--workers=2 --trace off`): 19 passed, 1 skipped (skipped in the suite itself). One run had a transient failure in `smoke` (OTP "Send code" stayed disabled on /login, outside scope); it passed on re-run.
- Audit script over 13 routes x 2 viewports: 0 axe violations, CLS 0.000 everywhere, no horizontal scroll, no console errors.

## Round 2

Base: `b240eba` (round 1 of every area merged). Method as in round 1: production build, Playwright at 390x844 and 1440x900, ar and en, axe-core (WCAG 2.0/2.1/2.2 A + AA), overflow probe, keyboard tab walk, reduced-motion probe, plus `docs/audit/tools/perf-pages.mjs` (phone = 390x844 DPR 2, 4x CPU, Slow 4G) and a per-route LCP/resource-timing script for the pages the harness does not cover (`/boxes/[structure]`, `/vendors/[slug]`, legal).

### Round 1 re-verification

Every round 1 row marked fixed was re-checked in the browser on this base: 0 axe violations on all 10 marketing routes x 2 locales x 2 viewports, no horizontal page scroll, CLS 0.000 to 0.006, no animation running under `prefers-reduced-motion` (MK-11, WCAG 2.3.3), marquee and chip keyframes running otherwise (MK-01), mobile menu sheet 390x844 full screen (MK-17), unknown printer / structure / legal slugs answer 404 (PERF-01), price table scroll region focusable and named (MK-06), visible focus ring on every tab stop (WCAG 2.4.7). **Nothing reopened.**

### Performance: phone LCP

Phone LCP was 3.3 to 5.2 s on this base (FCP 3.3 to 4.2 s), not the 2.7 to 4.0 s quoted at the end of round 1: the PERF-17 switch to strict CSS chunking (last commit before round 2) exposed R2-MK-01 and R2-MK-02 below.

`perf-pages.mjs`, phone profile (first number before, second after):

| Page | ar FCP | ar LCP | en FCP | en LCP | render-blocking CSS files |
|---|---|---|---|---|---|
| home | 4,228 → 2,748 | **5,164 → 2,840** | 3,348 → 2,136 | **3,348 → 2,136** | 21 → 6 |
| /boxes | 3,904 → 2,556 | **3,952 → 2,616** | 3,844 → 2,072 | **3,844 → 2,156** | 22 → 6 |
| /bottles | 4,032 → 2,208 | **4,032 → 2,356** | 3,688 → 1,940 | **3,688 → 2,204** | 21 → 6 |
| /vendors | 3,856 → 2,280 | **4,768 → 2,280** | 3,440 → 2,168 | **4,704 → 2,168** | 22 → 9 |
| /boxes/[structure] (own script, median of 3) | ~3,400 → 2,700 | ~3,400 → 2,900 | ~2,800 → 2,350 | ~2,800 → 2,850 | 22 → 11 |
| /vendors/[slug] (own script, median of 3) | ~3,870 → 2,480 | ~3,870 → 2,480 | – | ~2,100 | 22 → 11 |

Desktop after: LCP 204 to 356 ms everywhere, CLS ≤ 0.006, TBT ≤ 73 ms. Phone INP 16 to 128 ms. JS on store pages 146 to 196 KB gz (budget 200).

**Result:** every page is under 2.5 s in English and /bottles, /vendors and /vendors/[slug] are under it in Arabic. Arabic home, /boxes and the structure pages are at 2.6 to 2.9 s; run-to-run spread on this profile is ±300 ms. What separates them from the budget is outside this scope (see "Open" below): 117 KB of preloaded fonts on `/ar` versus 49 KB on `/en`, and the whole i18n dictionary (155 KB raw, ~35 KB gz) serialized into every page by the root layout. I measured removing the Plex 400 preload: it made LCP worse (late font swap produced 4.5 s LCP entries), so I left the fonts alone.

### Findings

| id | severity | page / file | finding | standard | fix | status |
|---|---|---|---|---|---|---|
| R2-MK-01 | critical | every marketing page (`MarketingShell.tsx`) | 21 render-blocking stylesheets on home, /boxes, /bottles, /vendors (17 of them the (auth) layout's admin kit CSS: Popover, Modal, Tabs, Form, Spinner…). `AppProvider` is a client reference rendered by the (store), (auth) and (checkout) layouts; Next resolves a shared client reference to one entry's chunk group, so the marketing pages linked the (auth) layout's CSS. On Slow 4G that is 3 to 4 extra round trips before first paint. | Core Web Vitals LCP < 2.5 s | New `MarketingProviders.tsx`: a marketing-only `"use client"` boundary that wraps `AppProvider`, so the reference resolves to the store layout's own chunk. Home and category pages: 21 → 6 stylesheets. The cookie-ack hook moved out of `CookieNotice.tsx` into a CSS-free `store/cookieAck.ts` (re-exported, API unchanged). | fixed |
| R2-MK-02 | high | /boxes (`BoxesLanding.tsx`) | /boxes only shows the library teaser, but `BoxesLanding` statically imported `ModelLinks` → the client `ModelBrowser` with the UI kit barrel, so /boxes still linked 16 extra stylesheets and the picker chunk. | LCP | `library` is now a `ReactNode` slot: /catalog passes `<ModelLinks />`, /boxes passes nothing. 22 → 6 stylesheets. | fixed |
| R2-MK-03 | high | hero leads on /vendors, /boxes, /bottles, structure, printer profile, legal, home (`motion.css`) | The hero lead was often the LCP element (/vendors: LCP 4.7 s, FCP 3.4 s). It entered with a delayed `both` fade from opacity 0; Chrome does not count an opacity-0 paint, and on a throttled phone the animation does not start until the main thread is free after hydration. The home hero visual (which holds the poster, the ar LCP image) also faded in (`m-scale-in`). | LCP; motion "subtle, ease-out" | Leads use the transform-only `m-enter-lcp` rise. `.m-enter-scale` now settles from `scale(0.96)` without a fade (new `m-scale-only` keyframes). Reduced motion still disables both. /vendors phone LCP 4.7 → 2.2 to 2.3 s. | fixed |
| R2-MK-04 | high | home hero poster, `/boxes/[structure]` hero (`assets.ts`, `responsive-variants.cjs`, `StructureDetail.tsx`) | A 390 px DPR 2 phone picked the 914 px original (38 KB) for a 358 px poster; the structure hero declared `sizes="92vw"` for a 286 px image and was discovered only when the parser reached it. | LCP; image budget | 720w variants (quality 78) for the seven wide box renders (19 to 27 KB instead of 25 to 39 KB), `srcSetFor()` emits the extra step. Structure hero: correct `sizes` (74vw) and a React `preload()` with `imageSrcSet` + `fetchPriority: high` so it starts from `<head>`. | fixed |
| R2-MK-05 | high | /boxes/[structure], /vendors/[slug] (`PriceFromTable.tsx`, printer page, `PortfolioGallery.tsx`, `StructureDetail.tsx`) | The price and machines tables used the kit `DataTable`, which lives in `IndexTable.tsx` with the admin filters (Popover, TextField, Tabs); with Button, Banner, EmptyState, Breadcrumbs and an eagerly imported Modal the pages linked 19 to 22 stylesheets. They also read as admin screens inside the marketing chrome (round 1 open item). | LCP; reference "no admin look on marketing pages" | New server `SpecTable` (store): caption, column + row headers, tabular figures, focusable named scroll region (WCAG 2.1.1), marketing styling (grey rounded head row, row rules). Design CTA is a marketing pill, "See all printers" a text link, breadcrumbs reuse the marketing crumbs, reviews empty state and contact note are plain markup, the lightbox `Modal` loads on demand (`next/dynamic`) with 44 px plain nav buttons. 22 → 11 stylesheets; the lightbox e2e still passes. | fixed |
| R2-MK-06 | medium | home "Packaging for every kind of brand" at < 560 px | Six audience cards stacked to about 1,400 px of scrolling. | Reference mobile: "collage becomes a horizontal scroll strip" | Phone-only snap rail (`.useRail`): 78% cards, next card peeking, full bleed, never scrolls the page. Each card has a link, so the rail is keyboard reachable (axe clean). | fixed |
| R2-MK-07 | medium | home "Finishes" at < 560 px | Six finishes, each a full-width row with a 64 px icon tile: about 1,300 px for six one-line facts. | Reference rhythm; mobile density | Two compact columns on phones (48 px tiles, 17 px titles, 14 px body). Section went from about 1,300 to about 560 px. | fixed |
| R2-MK-08 | medium | home stats band (`statsOrb`) | The "Egypt" visual was a plain green ball with floating city labels; it read as a placeholder next to the reference's globe. | Reference w05 (stats with visual) | A faint dot-matrix texture masked to the sphere, and a green pin in each city tag that pulses three times when the band is revealed, then rests (finite, so no pause control is needed under WCAG 2.2.2; off under reduced motion). | fixed |
| R2-MK-09 | low | /boxes/[structure] "Printers that make this box" | Printer names rendered in the admin link blue (#005bd3) inside the marketing page. | Colour restraint (reference: black, white, greys, one accent) | Ink, semibold, underlined links scoped to that list (`.makerList`). | fixed |
| R2-MK-10 | low | 404 page (`src/app/[locale]/not-found.tsx`, outside scope) | axe `document-title` (serious): the not-found page renders without a `<title>`. | WCAG 2.4.2 Page Titled | Not changed: the file is outside this scope. Fix: `export const metadata = { title: … }` is not allowed in not-found; render `<title>` in the component (React 19 hoists it). | open (outside scope) |

Totals round 2: 1 critical, 4 high, 3 medium, 2 low. Fixed: 9. Open: 1 (outside scope).

### Open / outside scope (for the integrator)

- **Whole dictionary in every page (performance, high).** `src/app/[locale]/layout.tsx` passes the full `getDictionary(locale)` to `I18nProvider`: 155 KB raw on `/ar` (admin 32 KB, vendorPortal 32 KB, store 16 KB, designer 14 KB, marketing 13 KB, legal 13 KB…), about 35 KB gz of the 55 to 73 KB gz HTML, on every route. Recommended: provide `common`/`nav`/`meta` at the root and let each area layout add only the namespaces its client components use (nested provider that merges), or move client strings to props.
- **Arabic font weight in the critical window (performance, medium).** `/ar` preloads Inter (49 KB) plus Plex Arabic 400 and 700 (68 KB) ahead of the CSS. Inter only renders digits and a few Latin words on Arabic pages; preloading it only on `/en` (same trick as `font-preload.ts`) would free about 0.3 s on Slow 4G. Dropping a Plex preload instead was measured and is worse.
- **R2-MK-10** above.
- Remaining 11 stylesheets on `/boxes/[structure]` and `/vendors/[slug]` come from the Polaris Card / Text / Layout / Badge used for the dense lower body. Moving those to marketing markup would bring them to 6 like the other pages; left as is because the dense data is fine in cards and the files are small (0.5 to 1.3 KB gz each).

### Files touched outside scope

- `src/app/[locale]/(store)/catalog/page.tsx` (catalog area): one line, passes `<ModelLinks />` into the new `BoxesLanding` `library` slot (R2-MK-02). Behaviour unchanged.

### Screenshots (round 2)

`docs/screenshots/audit/marketing/r2/` (indexed PNG, 1x DPR, 0.7 MB): `before-`/`after-home-ar-390-stats-audience.png` (R2-MK-06/08), `before-`/`after-home-ar-390-finishes.png` (R2-MK-07), `before-`/`after-structure-en-390-body.png` (R2-MK-05/09), `after-structure-en-1440-full.png`, `after-printer-profile-ar-1440-full.png`, `after-home-ar-390-fold.png`.

### Verification (round 2)

- `npm run lint` clean, `npm run typecheck` clean, `npm test`: 54 files, 6,245 tests passed, `npm run build` OK.
- Playwright `smoke`, `storefront`, `journey` (desktop + mobile, `--workers=2 --trace off`): 19 passed, 1 skipped (skipped in the suite itself).
- Audit script, 10 routes x 2 locales x 2 viewports: 0 axe violations except R2-MK-10 (404, outside scope), no horizontal page scroll, no console errors.

## Round 3

Base: this branch merged with `origin/claude/exciting-albattani-8kzgsu` at `0e30478` (every round 2 branch). Work list: the marketing rows of `docs/audit/ROUND3.md` (sources `craft.md`, `a11y.md`, `business.md`). One merge conflict: `(store)/catalog/page.tsx`, which the catalogue area rewrote; I took theirs (it no longer uses `BoxesLanding`, so the round 2 slot change needs nothing there).

| id | severity | page / file | finding | fix | status |
|---|---|---|---|---|---|
| B-26 | medium (business priority) | public structure page, home hero chip, designer badge, checkout | Three prices for one 500-box mailer: public page EGP 34.20 / 10 days (1 colour, best match), designer badge 37.95 / 13 days (4 colours, cheapest), checkout 40.06 (4 colours, best match). | **One price source**, `src/lib/pricing/headline.ts` (pure, re-exported from `@/lib/pricing`): `HEADLINE_DEFAULTS` (4 colours, outside, no finish, Greater Cairo: the same defaults as `/api/quote` and the order service), `headlineInput()`, and `headlineOffer()` = the best-match offer, which checkout pre-selects. `store/data.ts getPriceFrom()` (structure table, size pages, home chip, /boxes cards) now prices through it. The table intro says so: "Price per box from the best-match printer … full-colour print … The designer and checkout start from this same price." Unit tests: `src/lib/pricing/__tests__/headline.test.ts`. Designer half (badge: `headlineOffer` instead of cheapest) and checkout half were handed to those owners through the integrator. | fixed (marketing half) |
| B-22 / B-03 | medium | PNG export | Exported mockups carry no attribution, so the social loop gets nothing back. | `src/components/marketing/exportMark.ts`: `stampExportMark(blob, { locale })` stamps a white pill in the bottom end corner (right in English, left in Arabic) with the kraft box glyph and "Design your box on Elba · elba.eg" / "صمم علبتك على علبة · elba.eg". It is about 2.2% of the width and capped at 46%, and the host comes from `NEXT_PUBLIC_SITE_URL`. For standard exports only; HD stays clean (G2). Geometry is unit tested; rendered output in `r2/after-r3-export-mark-en-ar.png`. The designer calls it in `exportPng` for `size === "standard"` (designer half). | fixed (marketing half) |
| CR-02 | high | footer social icons | The icon turned white on its white disc on hover. | `.social a:hover/:focus-visible { color: #000 }` with the lift kept. Verified: black on white on hover. | fixed |
| CR-01 (marketing belt and braces) | high | every pill and ink link on marketing pages | The global `a:hover` link colour out-ranked `.pill`, so the hovered header CTA was #004299 on #2b2b2b (1.51:1, WCAG 1.4.3). Brand, nav, language, card and announcement links also turned blue. | Pinned hover colours in `marketing.module.css` (`.pill:hover { color: var(--pill-fg) }`, ink for brand, nav and language links, inherit for card, text and crumb links). Verified every variant: CTA white on #2b2b2b, outline white on ink, lime ink on lime, ghost ink on white. The global rule stays the platform owner's. | fixed |
| CR-10 | high | `/boxes/[structure]/[size]` price table at 390 px | The last column was clipped, and Arabic showed "0." for "10 أيام". | `SpecTable` reflows under 490 px: each row becomes a stacked card, with the quantity (row header) as its title and "label … value" lines from `data-label`. It stays a real `<table>` for assistive tech, with no sideways scroll. WCAG 1.4.10. Before and after: `r2/before-r3-…-price-table.png`, `r2/after-r3-…-price-stacked.png`. | fixed |
| CR-45 | low | home on load (CLS 0.0063) | The page shifted down 9 px after hydration. Root cause: (1) `MarketingShell` wrapped the header in Suspense with a 64 px fallback, so the 73 px header streamed in late; (2) `LangLink` used `useSearchParams()`, which bails the language links out of the static HTML. | Removed the header Suspense (the header reads no request data since PERF-06). `LangLink` renders from the pathname and adds the query string at click time. Home CLS is now 0.0000 (en) and 0.0001 (ar, font swap only), on desktop and phone. Bonus: the header is now in the static HTML, so it paints with the first frame instead of after streaming. | fixed |
| CR-29 | medium | home "Everything you need" | Heading alignment differed by locale. | Re-checked on the merged base: centred in both ar and en at 1440 and 390 (no `:lang(ar)` override left). | fixed (verified) |
| CR-39 | low | Arabic display type | Arabic H1 line height 1.25 was tight for Plex Arabic on two-line heads. | `--mk-lh-display: 1.3` under `:lang(ar)`, and H2 1.35. | fixed |
| CR-55 | low | top nav | "Pricing / الأسعار" opened `/catalog`, the box catalogue. | The item is now "Box styles / أنواع العلب" (`nav.catalog`), and it shows active on `/catalog`. Prices stay on each style page ("Prices" anchor on the structure hero). | fixed |
| CR-62 | low | box size H1 | The H1 said "25×18×8 سم" while the body said "250 × 180 × 80 مم". | The visible H1 uses `formatDims` (mm, spaced ×, bidi-isolated): "Custom printed mailer box 330 × 200 × 120 mm". `<title>`, meta and keywords keep the cm form people search for. JSON-LD uses the plain-text H1. The e2e assertion was updated to the new copy and now also checks the title. | fixed |
| X-02 | medium | `/boxes/rigid-box`, `/boxes/paper-tube` | Raw key `store.catalog.family.RIGID` / `.TUBE` was shown, and the page was 336 px wide at 320 px. | Added RIGID, TUBE, LABEL and FLEXIBLE family names in en and ar ("علب مقواة فاخرة", "أسطوانات ورقية", "ملصقات", "تغليف مرن"). `.specRow dd { overflow-wrap: anywhere }`. Verified: 320 px wide, no raw keys. WCAG 1.4.10, 3.1. | fixed |
| CR-43 | medium | `/legal/privacy` | Visible placeholder "[اسم الكيان القانوني، سجل تجاري رقم ___]". | Not changed: the legal entity name, commercial register number and DPO contact are business facts I must not invent (PDPL 151/2020 requires the real controller identity). The "draft for lawyer review" banner stays until legal provides them. | open (needs business / legal input) |
| CR-53, CR-54 | low | `/catalog` hero and family header | Dead space under the CTA row; detached family count. | Superseded: the catalogue area rewrote `/catalog` (no shelf illustration, no family header row; checked at 1440 ar). `/catalog` is outside this scope. | n/a (superseded) |
| CR-61 | medium | `/login`, `/vendor/apply` shells | Acquisition pages sit in the dark app chrome. | Covered by platform CR-05 (one buyer-facing chrome). `MarketingShell` is ready to be reused: it needs only `locale`. | handed to platform (CR-05) |

### Files touched outside scope (round 3)

- `src/lib/pricing/headline.ts` (new), `src/lib/pricing/index.ts` (one re-export line), `src/lib/pricing/__tests__/headline.test.ts` (new): the B-26 shared source, as assigned by the integrator.
- `src/i18n/en.ts`, `src/i18n/ar.ts`: `store.catalog.family.*` (X-02), `store.structure.priceIntro` (B-26), `store.seo.h1` (CR-62).
- `src/app/[locale]/(store)/boxes/[structure]/[size]/page.tsx` (size H1; this is my scope, but listed because it is a store SEO page).
- `e2e/storefront.spec.ts`: the H1 assertion now expects the mm form and also asserts the cm `<title>` (the spec changed; the test is not weakened).

### Verification (round 3)

- `npm run lint` and `tsc --noEmit` clean. `npm test`: 66 files, 8,164 tests passed. `npm run build` OK.
- Playwright `smoke`, `storefront`, `journey` (desktop + mobile, `--workers=2 --trace off`): 19 passed, 1 skipped (in the suite).
- Audit script on home, structure, size, rigid-box, paper-tube, printer profile and privacy (ar/en, 390/1440): 0 axe violations, no horizontal scroll, no console errors. CLS probe: home 0.0000 to 0.0001.
