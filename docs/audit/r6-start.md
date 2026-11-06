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

| # | Shopify section | What it does | Elba section | Elba content | Kit / local pieces | Status |
|---|---|---|---|---|---|---|
| 1 | Hero "start today" | Giant 2-word light headline split around a central product photo; collage pieces (photos, sketch paper, product chips) at different depths, parallax on scroll; subline + white pill | `StartHero` | «ابدأ اليوم» / "Start today"; centre = our FEFCO 0427 render (LCP, AVIF preload), around it rigid box, carton, tube, jar, can, a price chip from the engine and a "3D proof" chip; subline "Design your box free today, print it this week" + pill to `/design` | local `Collage` (`data-depth` parallax, CSS-var transform, rAF, off under reduced motion) | done |
| 2 | "Choose your design" | Centred h2 + sub; a template card starts small with siblings, scales to near full width while pinned; inside, the template scrolls | `ChooseBox` | "Choose your box"; pinned card grows from 62% to 100% into a poster of the live designer (real screenshot `designer-<locale>.webp`), side cards are style renders; button "Open the designer" to the real editor (`/design?structure=FEFCO_0427`). Poster only: no three.js | local `PinnedScale` (sticky + scroll progress var, CSS fallback) | done |
| 3 | "Make your products shine" | h2 + sub; one product image with a glow halo and an AI tool chip | `Shine` | "Make your packaging shine": render in a violet/green glow, finish chips (foil, spot UV, emboss, soft touch, window) from the finish list, "Preview in 3D" chip | CSS glow | done |
| 4 | "Get ready to get paid" | h2 + sub; a small checkout card with item, price, "Pay now"; phone with notification | `GetPaid` | "Price it, then pay your way": checkout preview card with real engine prices for a 250x180x80 mailer (100 / 500 / 1,000 rows, unit + subtotal, VAT 14% line, delivery days) and payment methods (card, wallet, Fawry, InstaPay); a status chip "Printer confirmed" | server data from `getPriceFrom` | done |
| 5 | "Join an all-star lineup" | Tall tilted cards in an arc, drifting; brand stories with "since" tags; last card is the CTA | `SampleFan` | "Sample brand boxes": 6 tilted cards from our sample tiles, each labelled «نموذج» / "Sample" with the box style name, explicit note that brands are fictional samples; last card "Your brand here" CTA. No fake logos, no "since" years | local `CardFan` (CSS transforms, scroll drift, horizontal scroll on phone) | done |
| 6 | "Get going, then get growing" | White 48px sheet over dark; 2x2 light bento with UI mockups; dark inset banner | `Bento` | "Start, then grow": share link for review, export print-ready PDF, order a sample first, reorder in one tap; dark inset with real counts (models in library, finishes, active printers) | local `Bento` grid | done |
| 7 | "Need more muscle?" (help rows) | Icon + linked help lines | folded into 6 | not mirrored separately: would need Elba support content that does not exist yet | — | skipped (no content) |
| 8 | "See for yourself" videos | How-to video cards | not built | no Elba tutorial videos yet; no fakes | — | skipped (no content) |
| 9 | Closing "Ready to start selling?" | Mark, h2, 3-step incentive line, email field with arrow button, consent fine print | `ClosingCta` | "Ready to design your box?"; steps "Design free → Approve the proof → Printed and delivered"; phone field reusing `HeroPhoneForm` (Egyptian mobile, no number in URL, PDPL 151/2020 fine print) | `HeroPhoneForm` (reused) | done |

## Decisions
- All CTAs on `/start` go to `/[locale]/design` (with the mailer preset); the site's "Start designing free" link CTAs now go to `/[locale]/start`. Signed-in users' header CTA ("New design") still goes straight to the designer (task label, not a pitch: R4-CR-09).
- The home hero phone form keeps its designer target: it is a sign-up action, and sending a just-signed-in person back to a landing page adds a step.
- No social proof: the fan cards say "Sample" on each card and in the section copy; numbers are counted from the DB/engine at build time (ISR hourly).
- Motion is enhancement only: content is visible without JS; `prefers-reduced-motion` stops parallax, pinned scale (card shown at full size) and fan drift.
- Foundation kit (`PinnedScale`, `Collage`, `CardFan`, `Bento`, `Reveal`, `HeroTitle`) was not on the remote when this page was built; page-local pieces live in `src/components/marketing/start/` and should be swapped for the kit versions once merged (see "Kit swap" below).
