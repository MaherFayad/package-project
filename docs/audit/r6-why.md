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

| # | Shopify section (measured) | Elba section | Content source (no fabricated proof) | Page-local piece | Status |
|---|---|---|---|---|---|
| W1 | Hero: dark band, giant two-line wordmark headline over a collage of UI cards, subline, white + outline pills | Two-line hero "More boxes. / Less spend." in light display type over a collage of our renders (mailer, rigid box, tube, carton) with a floating price-badge mockup and a glow; subline; "Start designing free" + "See pricing" pills | Renders in `public/marketing/renders`; badge price = reference box at 500 from the pricing engine | `WhyHero` (server) | built |
| W2 | Logo marquee (customer logos, two copies, `marquee-rtl` 49s) | Ticker of our box styles and finishes (names + small renders), RTL-correct direction, pause button (SC 2.2.2), hover pause, static under reduced motion | `STRUCTURE_LIST` names + `DESIGN_FINISH_CODES` labels | `Ticker` (client) | built |
| W3 | Light sheet "More customers": centred H2 + sub, then a 3-item list with a vertical progress rule beside a large media card that swaps per item | Light sheet "Better packaging": three points (see it in 3D, real printers, one price) beside a sticky device mockup that swaps its screen to the active point; on phone each point stacks under its own mockup | Our designer screenshot, price badge, printer card built from DOM (no fake data: printer count from DB) | `StickyPoints` (client), `DeviceMock` | built |
| W4 | Violet band "More sales": H2 + sub, three cards each with a floating UI mockup and a title + one-line stat | Violet band "More orders": three cards: price badge (live tiers), checkout summary (prepay saving), order tracking timeline (real lead-time days) | All numbers from `computePricingFacts` | `MockPrice`, `MockCheckout`, `MockTracking` | built |
| W5 | Green band "Less spend": three 120px count-up stats with an icon title and body | Green band "Less spend": four real stats that count up once on enter: per-box drop 100 → 2,000 (%), minimum order (boxes), door-to-door days, models in the designer; digital setup cost when a digital offer exists | `computePricingFacts`, `CATALOGUE` designer count | `CountUp` (client) | built |
| W6 | Dark sheet "Migrate": H2, three steps on one side; on the other a photo with a quote card (customer testimonial) | Dark sheet "Switch from your print shop": three steps (send your box, we match a printer, same price you saw); an "Elba promise" card (our own commitments, signed "Elba", not a testimonial) over a render | Promise = our policy (72 h quote validity, price you saw is the price you pay, sample credit days) | `PromiseCard` | built |
| W7 | Closing CTA "Why sell anywhere else?" two pills | Closing CTA with two pills | n/a | page markup | built |

## 2. `/sa/pricing` → `/[locale]/pricing` section table

| # | Shopify section (measured) | Elba section | Content source | Page-local piece | Status |
|---|---|---|---|---|---|
| P1 | Hero: 64px H1 "You've got plans. Us too." + one-line offer | H1 "One box. One price." + line with the reference box and that prices include delivery and VAT | `REFERENCE_BOX` | page markup | built |
| P2 | Toggle "Pay yearly" + "Compare all features" link | Toggle "Prepay online, save N%" that switches every card total between pay-on-delivery and prepaid; link to the comparison | `prepayDiscountPct` from admin checkout settings | `PrepayToggle` (client, `aria-pressed`) | built |
| P3 | Four plan cards (name, audience line, price, outline pill, hairline feature rows) | Four order-band cards: Trial run (100), Launch (500), Growth (2,000), Wholesale (above 2,000: price on request); each shows per-box price, order total incl. delivery and 14% VAT, door-to-door days and feature rows | `computePricingFacts().tiers`; wholesale is the engine's `manual_quote` band | `TierCards` | built |
| P4 | "Always included" white cards on dark band (5 features) | "Always included": free 3D designer, PDF proof, vetted printers, 14% VAT receipt, delivery across Egypt | product facts | page markup | built |
| P5 | "But wait, there's more" add-on card | Sample order card: N printed pieces, price, delivery days, credited against the next order within N days | `checkout.sample` settings + `sampleOffer` | page markup | built |
| P6 | Testimonial strip + big numbers ("Word on the street") | Left out: it is social proof we do not have. Replaced by nothing (no invented stats) | n/a | n/a | omitted on purpose |
| P7 | White compare sheet, sticky plan header, grouped rows of ticks and values | Comparison table: rows for per-box price, order total, prepaid total, setup, die on standard sizes, delivery days, printing method, sample credit, VAT receipt, quote validity; sticky header on desktop, horizontal scroll region on phone | `computePricingFacts` | `CompareTable` | built |
| P8 | FAQ: dark sheet, big plus icons | FAQ: why prices include delivery, what changes the price, above 2,000, prepay, samples, VAT and receipts | copy | `<details>` styled page-locally (kit `Faq` not forked) | built |
| P9 | Closing CTA "Turn plans into progress" with email field | Closing CTA with two pills (no data collection here) | n/a | page markup | built |

## 3. Page-local pieces (`src/components/marketing/why/`)

Not forks of kit components; each is page-local and reads the foundation `--mk-*` tokens with the measured values as fallbacks, so the pages pick up the foundation tokens when they merge.

| File | Kind | Notes |
|---|---|---|
| `pricing-facts.ts` | pure | the one computation (see §4) |
| `server.ts` | server-only | loads pricing data, config and checkout settings exactly as checkout does |
| `copy.ts` | strings | Arabic first, English twin; page-local so it cannot collide with the foundation's dictionary edits |
| `why.module.css` | styles | sheets, type scale, pills, cards, mockups, motion with reduced-motion fallbacks |
| `Ticker.tsx` | client | pausable ticker (SC 2.2.2) |
| `StickyPoints.tsx` | client | active point by IntersectionObserver; static without JS |
| `CountUp.tsx` | client | final value in the HTML; animates only with motion allowed |
| `PrepayToggle.tsx` | client | toggles a data attribute; both totals are in the HTML |
| `Mockups.tsx` | server | DOM UI mockups (price badge, checkout summary, tracking, device) |

## 4. Price integrity

Every price on both pages is computed per request from `loadPricingData()` + `loadPricingConfig()` + `loadCheckoutSettings()` (the checkout inputs) through `quote()` → `headlineOffer()` → `orderTotals()` / `sampleOffer()`. The unit test `src/components/marketing/why/__tests__/pricing-facts.test.ts` checks, for the same box, that each tier equals `toCheckoutOffer(quoteDesign-equivalent offer, prepayDiscountPct)` from the order service, and that the sample equals `sampleOffer` + `orderTotals(…, 0)`.

## 5. Checks

Filled in at the end of the work (see the final section).
