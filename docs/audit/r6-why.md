# r6-why: `/[locale]/why-elba` and `/[locale]/pricing`

Owner: r6-why. Branch `claude/exciting-albattani-8kzgsu-r6-why`. Spec: `docs/design-refs/shopify-2026-reference.md` §3 (`/sa/sell` → why-elba, `/sa/pricing` → pricing).

## 0. Reference capture (6 Nov 2026)

Captured with Playwright (Chromium) at 1440x900 and 390x844, Arabic (`/sa/...`) and English (`/...`): scroll frames every 80% of the viewport, a scroll video per run, and computed styles of every section, heading, button and running animation. The captures stay out of git (they are Shopify's pixels); the measured values are below.

| Page | Viewport | Doc height (ar / en) | Frames (ar / en) |
|---|---|---|---|
| `/sa/sell` | 1440x900 | 5190 / 5126 | 8 / 8 |
| `/sa/sell` | 390x844 | 7482 / 7989 | 12 / 12 |
| `/sa/pricing` | 1440x900 | 11495 / 13046 | 16 / 19 |
| `/sa/pricing` | 390x844 | 11727 / 13980 | 18 / 21 |

### Measured tokens (both pages)

| What | Value |
|---|---|
| Hero band | `rgb(0,8,5)` (sell), `rgb(2,9,10)` (pricing); padding-top 80 to 104px |
| Light sheet | `rgb(245,245,243)`, radius `48px 48px 0 0`, padding 80px 0 |
| Violet band | `linear-gradient(rgb(91,50,244) -32%, rgb(53,29,142) ...)`, radius 48px top |
| Green band | `rgb(4,30,24)`, padding 80px 0 165px, faint vertical-line texture bottom-left |
| Closing / migrate band | `rgb(2,9,10)`, radius 48px top |
| Pricing card band | `rgb(20,26,26)` cards on `rgb(2,9,10)`; card radius 32px; feature rows split by 1px hairlines |
| Compare table | white sheet, radius 48px top, sticky plan header row with outline pills |
| H1 | sell: an image wordmark at ~200px light (text is visually hidden); pricing: 64px / 330 / -1.28px |
| H2 section | 56px / 330 / line-height 1.08 / -0.56px; secondary H2 44px / 330 |
| H3 point | 28px / 360 / -0.28px (light sheet); card title 20px / 450; stat title 24px / 400 |
| Body | 16 to 18px / 400, muted ~60% |
| Stat figure | ~120px / 300, tabular |
| Pills | primary white bg / black text, 550 weight, radius 9999px, 44px (header) and 56px (hero, CTA), padding 12px 24px; outline 1px white; on violet a lilac `rgb(151,141,231)` pill |
| Transitions | `0.15s cubic-bezier(0.4,0,0.2,1)` on colour/background/border |
| Animations | `marquee-rtl 49s linear infinite` (logo strip), `fadeInUpDesktop 1.1s cubic-bezier(0.34,1.56,0.64,1)` (plan cards), `flipCard 0.8s cubic-bezier(0.65,0,0.35,1)` (stat cards) |
| Container | 1260px content, 90px side padding at 1440; 16px on phone |

## 1. `/sa/sell` → `/[locale]/why-elba` section table

| # | Shopify section (measured) | Elba section | Content source (no fabricated proof) | Built with | Status |
|---|---|---|---|---|---|
| W1 | Dark band `rgb(0,8,5)`, giant two-line headline over a collage of floating UI cards, subline, white + outline 56px pills | "علب أكثر. / إنفاق أقل." (More boxes. / Less spend.) at hero size, word slide-in, over a collage of our renders (mailer, rigid box, tube, carton) with violet + green glows and a floating price chip | Renders from `public/marketing/renders`; chip = 500 reference boxes, total incl. VAT, from the pricing engine | kit `Sheet hero`, `HeroTitle`, `Glow`, `Pill`; page-local collage | done |
| W2 | Logo marquee (`marquee-rtl` 49s) | Marquee of our 12 box styles (with renders) and 8 finishes, reading direction, pause button + hover/focus pause (SC 2.2.2), plain scroller under reduced motion; thumbnails load after `load` | `BOX_STRUCTURE_LIST`, `finishes.*` labels | kit `Marquee` (49s, 56px gap); page-local `DeferredImg` | done |
| W3 | Light sheet "More customers": centred H2 + sub, three items with an active rule beside a large media card that swaps | Light sheet "تغليف أفضل": three points (3D before print, N vetted printers, one price start to finish) with a sticky media column that cross-fades: real designer screenshot, printer-match card (top 3 ranked offers for 500 boxes), order summary | DB printer count, ranked offers, checkout totals | kit `StickyStory` (media end side); page-local mockups | done |
| W4 | Violet gradient sheet "More sales": three cards, each a floating UI mockup + title + one-line stat | Violet sheet "طلبات أكثر": price badge (live per-box tiers), checkout summary (prepay discount line), tracking timeline (real door-to-door days) | `computePricingFacts` | kit `Sheet violet`, `Reveal`; page-local `Mock*` | done |
| W5 | Green band "Less spend": three ~120px stats with icon titles | Green sheet "إنفاق أقل": 73% lower per box (100 → 2,000), 50-box minimum, 5 days door-to-door, 370 designer models; a 5th digital-setup stat appears only when a digital offer exists (none for the reference box in the seed, so it is not shown) | pricing engine, active printers' minimum, `CATALOGUE` designer count | kit `CountUp`, `Sheet green` | done |
| W5b | (not on the reference) | White sheet "لكل نشاط تجاري" with `#cafes`, `#beauty`, `#ecommerce` cards linking to the style pages. Added because the foundation header's "Why Elba" menu links these anchors | style pages | kit `Sheet white`, `Reveal` | done |
| W6 | Dark sheet "Migrate": H2 + three steps; a photo with a customer quote card | "انتقل من مطبعتك الحالية.": three numbered steps; an **Elba promise** card signed "فريق علبة" over our render: the price you see is the price you pay, reprint or refund per the returns policy, quote validity 72 h, sample credit 60 days, defects within 30 days, link to `/legal/returns` | our policy text (legal/returns), pricing config, checkout settings | kit `Display`, `Reveal` | done |
| W6b | (reference has none) | FAQ `#faq` (the header's help link), 5 questions, exclusive accordion, FAQPage JSON-LD | product facts | kit `Faq` | done |
| W7 | Closing CTA, two pills | "لماذا تطبع في مكان آخر؟" + Start designing / See pricing | n/a | kit `Pill`, `PillRow` | done |

## 2. `/sa/pricing` → `/[locale]/pricing` section table

| # | Shopify section (measured) | Elba section | Content source | Built with | Status |
|---|---|---|---|---|---|
| P1 | 64px / 330 H1 "You've got plans. Us too." + offer line | "علبة واحدة. سعر واحد." + the reference box (مايلر 300 × 220 × 60 مم, E-flute kraft) and what the price includes | `REFERENCE_BOX` | kit `Sheet hero`, `Display 64`, `Lead` | done |
| P2 | "Pay yearly" switch + "Compare all features" | "الأسعار شاملة ضريبة القيمة المضافة 14%" switch (on by default; consumer prices are shown with taxes, Consumer Protection Law 181/2018) + link to the comparison | engine totals | page-local `VatToggle` (`aria-pressed`, 44px target) | done |
| P3 | Four plan cards: name, audience line, price, outline pill, hairline feature rows | تجربة 100 / انطلاق 500 / توسع 2,000 / جملة (above the configured instant maximum: سعر عند الطلب). Each card: per box, total, "saved by the 3% prepay discount", door-to-door days, no die on standard sizes, setup once, PDF proof, VAT receipt | `computePricingFacts().tiers`; maximum from pricing config | page-local tier card CSS, kit `Pill` | done |
| P4 | "Always included" cards on `rgb(20,26,26)` | متضمن دائما: free 3D designer, PDF proof, vetted printers, VAT receipt, delivery to every governorate | product facts | kit `Reveal` | done |
| P5 | "But wait, there's more" add-on card | Sample order: 5 digitally printed pieces, total incl. delivery and VAT, delivered in 4 days, credited within 60 days | checkout settings `sample` + `sampleOffer` | page-local | done |
| P6 | Testimonial strip and big numbers | **Omitted on purpose**: it is social proof we do not have | n/a | n/a | omitted |
| P7 | White compare sheet, sticky plan header, grouped rows | All five tiers + wholesale: per box, list total, prepay discount, subtotal, VAT 14%, total; setup, die, delivery; method, days, proof, receipt. Sticky header and sticky label column, horizontal scroll region on phone | `computePricingFacts` | page-local table | done |
| P8 | Dark FAQ, big plus icons | 7 questions (delivery in the price, what changes the price, above 2,000, prepay, samples, quote validity, minimum), FAQPage JSON-LD | copy + live figures | kit `Faq` | done |
| P9 | "Turn plans into progress" with email field | CTA with two pills (no data collected on this page) | n/a | kit `Pill` | done |

## 3. Page-local pieces (`src/components/marketing/why/`)

Everything the kit ships is used from the kit (`Sheet`, `Display`, `Lead`, `HeroTitle`, `Pill`, `PillRow`, `Reveal`, `Glow`, `Marquee`, `StickyStory`, `CountUp`, `Faq`). Only these are page-local, none is a fork of a kit component:

| File | Kind | Why page-local |
|---|---|---|
| `pricing-facts.ts` | pure | the one price computation for both pages (§4) |
| `server.ts` | server-only | loads pricing data, pricing config and checkout settings exactly as checkout does |
| `copy.ts` | strings | Arabic first, English twin; next to the pages so it cannot collide with the foundation's dictionary edits |
| `Mockups.tsx` | server | DOM UI mockups fed only engine numbers: price badge, checkout summary, tracking timeline, printer match |
| `VatToggle.tsx` | client | incl./excl. VAT switch; both figures are in the HTML, CSS shows one |
| `DeferredImg.tsx` | client | decorative marquee thumbnails that load after `load` (phone LCP) |
| `why.module.css` | styles | hero collage, ticker items, mockups, stats, segments, promise, tier cards, table; reads `--mk-*` tokens |

## 4. Price integrity

- Every price is computed from `loadPricingData()` + `loadPricingConfig()` + `loadCheckoutSettings()` (the checkout loaders, not the 5-minute catalogue cache) through `quote()` → `headlineOffer()` (best match, the offer checkout pre-selects) → `orderTotals()` / `sampleOffer()`.
- Every checkout payment method is online (card, wallet, Fawry, InstaPay), and checkout always applies the admin prepay discount. So the published total is the **prepaid** total, and per box is `round(pay.subtotal / quantity)`, the exact formula of the checkout offer card. An earlier draft showed a "pay on delivery" total, a price nobody can pay; removed.
- Unit test `src/components/marketing/why/__tests__/pricing-facts.test.ts` (11 tests): for every tier, per box, subtotal, VAT, discount, list total, saving, delivery and days equal `toCheckoutOffer()` from the order service for the same box; the sample equals the checkout sample offer; the prepay % follows the admin setting; tiers stop at the configured instant maximum.
- e2e `card prices equal the instant quote checkout uses`: signs in, calls `POST /api/quote` for the reference box at 100, 500 and 2,000, applies the returned `prepayDiscountPct` and 14% VAT, and compares to the card totals (ar + en, desktop + phone).
- Freshness: the pages prerender with `revalidate = 60` and are purged at once by `purgeCatalogCache()` on every pricing-relevant edit (rate cards, pricing settings, price index, vendor status, and, added here, checkout settings). Per-request rendering was tried first and put the phone LCP at 3.4 s (the page streamed behind the shell's Suspense boundary after ~300 KB of flight data).

## 5. Findings fixed while building

| id | severity | page | finding | standard | fix | status |
|---|---|---|---|---|---|---|
| R6W-01 | critical | pricing | First draft offered a "pay on delivery" total; no such payment method exists and checkout always applies the prepay discount, so the headline price was not the price charged | price integrity | publish the prepaid total and checkout's per-box formula; VAT toggle instead | fixed |
| R6W-02 | high | why-elba | Phone LCP 3.39 s (ar) / 2.63 s (en) | budget LCP < 2.5 s | prerender + purge, 400w AVIF + phone preload, no opacity fade on the LCP render, deferred thumbnails | fixed (1.38 / 1.34 s) |
| R6W-03 | high | pricing | Hydration mismatch: `[data-reveal]` inside the toggle's client island got `data-revealed` before hydration | correctness | tier cards animate with CSS only, no reveal attribute | fixed |
| R6W-04 | medium | why-elba | Mock "next step" text 4.4:1 on its card | WCAG 2.2 SC 1.4.3 | #5c5c5c (6.6:1) | fixed |
| R6W-05 | medium | why-elba | Promise copy first claimed "we reprint at our cost", stronger than the policy | no fabricated claims | worded as the returns policy (reprint or refund, your choice, within 30 days) with a link | fixed |
| R6W-06 | medium | pricing | Phone table wrapped money onto two lines, caption cut off inside the scroller | SC 1.4.10 | nowrap cells, sticky label column, caption shown above the region (kept in `<caption>` for AT) | fixed |
| R6W-07 | medium | both | Header links `#cafes`, `#beauty`, `#ecommerce`, `#faq` had no targets | navigation | segments sheet + FAQ sheet | fixed |
| R6W-08 | low | pricing | Negative discount label rendered "(3%−)" in RTL | bidi | own label "خصم الدفع المسبق 3%", amounts through `formatMoney` (isolated minus) | fixed |

## 6. Checks (final build)

| Check | Result |
|---|---|
| `npm run lint` (incl. direct UI-kit imports rule) | 0 problems |
| `npm run typecheck` | pass |
| `npm test` | 113 files, 8,782 tests pass (incl. 11 new pricing-facts tests and the i18n scope size test) |
| `npm run build` | pass; both pages prerendered, revalidate 1 min |
| `e2e/why-pricing.spec.ts` (ar + en × desktop + phone) | 18 / 18 pass |
| foundation `e2e/marketing-kit.spec.ts` on this branch | 16 / 16 pass |
| axe (wcag2a/aa, 21a/aa, 22aa) on both pages, both locales, both viewports | 0 violations |
| existing `storefront`, `a11y-routes`, `smoke` specs on the merged branch | 102 / 102 pass |
| sitemap | `/ar|en/why-elba`, `/ar|en/pricing` with hreflang alternates |

Performance (`docs/audit/tools/perf-pages.mjs`, phone = 390x844 DPR 2, 4x CPU, Slow 4G; data in `docs/audit/perf-data/r6-why.json`):

| Page | Phone LCP | Phone CLS | Phone TBT | Desktop LCP | Desktop CLS |
|---|---|---|---|---|---|
| /ar/why-elba | 1.36 s | 0.008 | 490 to 610 ms | 0.52 s | 0 |
| /en/why-elba | 1.30 s | 0 | 370 to 390 ms | 0.40 s | 0 |
| /ar/pricing | 1.34 s | 0.011 | 440 to 530 ms | 0.26 s | 0 |
| /en/pricing | 1.10 s | 0 | 290 to 390 ms | 0.15 s | 0 |

(Re-measured after merging foundation `cdf37a4`.)

Phone TBT is over the 200 ms target but matches the home page on the same build (290 to 550 ms): it is the shell's hydration (header islands, dictionary flight data), not these pages. Logged for the foundation owner.

## 7. Outside this scope (smallest additive changes)

- `src/components/admin/server/actions.ts`: one line, `purgeCatalogCache()` after saving checkout settings, so the prepay % and sample price reach the public pages at once.
- `src/app/sitemap.ts`: two entries.
- i18n scopes (R5-PL-08): both pages live in the route group `src/app/[locale]/(store)/(why)/` (URLs unchanged) whose layout mounts `<I18nScope scope="why">`, and `scripts/generate-i18n-scopes.ts` gains one line `why: "(store)/(why)"`. Without it the shared price computation (checkout's `orders/sample` and `orders/totals`, whose line labels are dictionary keys) and the kit marquee controls added 1.6 KB to the root scope and broke its 40 KB budget (41.1 KB); now root is back at the foundation's size and the "why" scope holds 6 keys. `scopes.generated.ts` regenerated.
- `docs/audit/tools/perf-pages.mjs`: two page entries.
- Header and footer links were already in the foundation header (`/pricing`, `/why-elba`, `#cafes`, `#beauty`, `#ecommerce`, `#faq`); this branch adds the targets, not links.
