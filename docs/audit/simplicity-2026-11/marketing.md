# Marketing site audit and fixes (simplicity round, 2026-11)

Owner complaint: "The marketing pages don't look good, and also don't sell the full thing."
Audience: small Egyptian business owner, phone first, Arabic first, not technical.

Screenshots (not in the repo): `C:\Users\Admin\AppData\Local\Temp\claude\f8173f44571ee159\d92726ee-f788-4602-8df6-7bcebbbfc7a0\scratchpad\marketing\`
- `before/<page>-<locale>-<phone|desk>-fold.png` and `-full.png` (full-page captures repeat the top of the page after ~9k px: a capture artefact, not a page bug).
- `before/seg/` and `after/seg/`: viewport-by-viewport captures (`<page>-<locale>-<vp>-NN.jpg`).
- Tools: `.tmp-shots.mjs`, `.tmp-seg.mjs`, `.tmp-slice.mjs` were in the repo root while working (deleted at the end). Run with `node` from the repo root. In Git Bash, do not pass `home=/` (MSYS rewrites `/` into a Windows path); the seg script treats `-` as the root path.

## Status

- [x] Audit (step 1)
- [x] Home rebuilt around the full offer (M1, M2, M8)
- [x] Designer page copy (M3) and phone hero frame (M4)
- [x] Start page hero on phone (M5)
- [x] Re-screenshots (home ar phone + en desktop, start + designer ar phone), tsc, eslint, vitest

## Findings (prioritised)

| # | Sev | Page | Finding | Screenshot |
|---|---|---|---|---|
| M1 | P1 | Home | Does not sell the full offer. Missing or buried: upload logo by dropping on the box, one full artwork, fold animation, automatic print checks, share link, exports (4K mockup, 3D model, print-ready PDF, template), order tracking, Arabic/English, Paymob, Bosta, proof before print. The "how it works" steps sit at the very bottom (section 11) as auto-rotating tabs. No FAQ, no trust block. | `before/home-ar-phone-full.png` |
| M2 | P1 | Home | Abstract sections a shop owner cannot read: the orbit diagram ("Run the whole order"), the dotted delivery map with floating chips (overlapping on phone), a giant grey "statement" paragraph, a sliding rail of renders. Long page (12k px on phone) with little information per screen. | `before/seg/home-ar-phone-*` |
| M3 | P1 | Designer page | Copy is outdated and wrong: says "our team prepares the print-ready PDF when you order" but the designer exports a print-ready PDF, dieline template, 4K PNG and GLB today. Jargon: dieline, bleed, safe zone (FAQ "What are bleed and the safe zone?"). | `before/designer-ar-phone-full.png` |
| M4 | P2 | Designer page | Hero headline sits in a purple selection frame with a "عنوان"/"Title" tag that overlaps the header on phone; looks like a debug overlay to a non-designer. | `before/designer-ar-phone-fold.png` |
| M5 | P2 | Start | Phone hero: the headline "ابدأ ... اليوم" is split by the collage, the two words sit ~500 px apart; the CTA falls below the fold. | `before/start-ar-phone-fold.png` |
| M6 | P2 | Box detail (`/boxes/mailer-box`) | "FEFCO 0427" chip at the top of the page (industry code); the size/specs table uses mm ranges, fine for detail but heavy. Detail routes are not owned by this task (src/app/[locale]/(detail)); left as a note. | `before/seg/box-ar-phone-00.jpg` |
| M7 | P3 | All | Cookie notice covers ~15% of the phone fold on first visit (expected, one-time). | any `*-phone-fold.png` |
| M8 | P3 | Home | Hero lead text overlaps the product render on phone; no trust line under the CTAs (made in Egypt, instant price, delivery). | `before/home-ar-phone-fold.png` |

What is already good: desktop hero (big type, real 3D render of the NOUR mailer), real numbers from data (370 models, 6 printers, from 50 boxes, live EGP price), pricing page is clear, why-elba hero sells the price, header/footer are clean.

Facts used (from code/data, no inventions): model count from `MODEL_INDEX`; printers and minimum order from the DB (`listVendors`, seed min 50); price of 500 mailer boxes from `getPriceFrom`; payment methods `PAYMENT_METHODS` (card, wallet, Fawry, InstaPay) via Paymob; delivery via Bosta (`src/lib/shipping/bosta.ts`); exports from `src/i18n/designer.en.ts` `export.*`.

## Changes

**Home** (`src/app/[locale]/(store)/page.tsx`, `src/components/marketing/home/copy.ts`, `home.module.css`). New order:
1. Hero (kept the real 3D turntable): shorter lead that names the whole promise (design free in 3D, instant price, printed in Egypt, delivered); secondary pill is now "How it works" (#how) instead of a second catalogue link; three facts under the pills (Made in Egypt, Instant price in EGP, Delivery across Egypt).
2. NEW "Your box in 3 simple steps": design in 3D, see the price at once (quote for special cases), we print and deliver (proof, vetted printer, tracking). Real UI renders (phone designer, price badge, order timeline). CTA.
3. Violet "See your box before it is printed": the real designer screenshot + perfume turntable (kept).
4. NEW "Everything you need, in one free designer": 9 icon cards in plain words: drop logo on a side, one full artwork, fold animation, foil/spot UV/emboss/laminations in 3D, automatic print checks, live price, share link, downloads (4K photo, 3D model, print-ready PDF, empty template), Arabic and English. Note that saving/sharing/downloads need a free account. CTA. Phone: icon beside title (compact).
5. Use cases: 6 business types (online stores, bakeries and sweets, cafés, cosmetics, perfumes and gifts, coffee and tea), 2 columns on phone, "Browse box styles".
6. Library wall, 7. Finishes (kept). 8. Green price band (kept the receipt and real numbers; dropped the payment globe, covered by trust).
9. NEW trust: vetted Egyptian printers (live count), proof before printing, secure payment (Paymob, Fawry, InstaPay), delivered by Bosta, order tracking, one receipt with VAT 14%.
10. NEW FAQ on a light sheet (kit `Faq`), 7 plain questions; answers with live numbers (minimum order, delivery days) are dropped when the number is unknown.
11. Closing CTA "Start your box today" (replaced the auto-rotating Steps tabs).
Removed: statement + rail, orbit "Run the whole order", dotted delivery map, green feature card with fake prompt, Steps tabs (and their dead CSS).

**Designer page** (`designer-page/copy.ts`, `designer-page.module.css`): exports now stated correctly (print-ready PDF, empty template, 4K mockup, 3D model with a free account; proof still approved when ordering); "dieline/bleed/safe zone" replaced by plain words ("print checks done for you", "Will my box print the way I see it?"). Phone: the purple "Title" selection frame and tag are hidden.

**Start page** (`start/start.module.css`, `start/copy.ts`): phone collage stage shortened (46svh) so "ابدأ/اليوم" sit close and the CTA is above the fold; sub no longer promises "print it this week" (delivery is ~9 to 10 days for 500 boxes): now "see the price instantly, get it at your door".

**Generated**: `src/i18n/scopes.generated.ts` regenerated (another agent's buyer.easy keys were changing at the same time; re-run `npx tsx scripts/generate-i18n-scopes.ts` before merging).

After screenshots: `after/seg/home-ar-phone-NN.jpg`, `after/seg/home-en-desk-NN.jpg`, contact sheets `after/m-home-ar-phone-{a,b,c}.jpg`, `after/m-home-en-desk-{a,b}.jpg`, `after/m-start-designer-ar-phone.jpg`.

## Left to do

- e2e not run (long): `e2e/storefront.spec.ts` (home still has the h1, "N models in one library" h2, the "EGP ... per box for 500 mailer boxes" rule and a "Browse box styles" link, now in the use-cases section; its comment "no FAQ" is outdated), `e2e/marketing-spacing.spec.ts` and `restyle-height.spec.ts` on the home (new sections use kit Sheet/SectionHead/Grid/Stack, but the icon cards add their own 24/16 px padding).
- Why-elba and pricing: not changed; both read well. Pricing page copy is plain; why-elba could link the new home FAQ themes.
- Box detail (`(detail)` routes, not owned here): "FEFCO 0427" chip at the top of /boxes/mailer-box (M6); specs table in mm ranges.
- Catalog listing is ~22k px tall on phone (410 rows); a "popular first" cut or pagination would help (catalogue component, not owned here).
- Home stats: the count-up animates from 0 so screenshots catch mid values; minimum order and printer count come from the live DB.
- Optional: Arabic copy review by a native Egyptian reader (brand names written باي موب / بوسطة).
