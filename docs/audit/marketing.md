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
| MK-02 | high | `(store)/loading.tsx` | CLS was 0.46 to 0.48 on most marketing routes. The streamed route fallback was short (two Polaris cards), so the black footer painted inside the viewport and was then pushed down when the page streamed in. | Core Web Vitals (CLS < 0.1) | The fallback now reserves at least one viewport of height (`min-block-size: calc(100dvh - 64px)`), so the footer never paints in view. CLS is now 0.000 on all 26 route and viewport pairs. | fixed |
| MK-03 | high | `(store)/loading.tsx` | The loading state was the admin skeleton (grey canvas, boxed cards), so every marketing navigation flashed an off-brand admin screen. | Reference: "no boxed card-everything layout on marketing pages"; skeletons, not spinners | Replaced it with a marketing hero skeleton: a mint hero band with eyebrow, display-headline, lead and pill shapes, and a shimmer that stops under reduced motion. | fixed |
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

`docs/screenshots/audit/marketing/`: before and after for the fold at both viewports, the printer profile, /boxes, and the mobile closing CTA.
