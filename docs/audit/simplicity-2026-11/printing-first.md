# Printing-first repositioning of the marketing site (simplicity round, 2026-11)

Owner: "The marketing pages are still not selling the right thing. They sell the design tool, but we are really selling the printing. The design tool is just a hook to start."

Goal: every public page sells custom printed packaging (printed by vetted Egyptian printers, sold and guaranteed by Elba as merchant of record, paid online, delivered by Bosta, proof before print, tracking). The free 3D designer is the easy way in ("see your box with your logo before you pay", "exact price in seconds"), one supporting section, not the product.

Follows `marketing.md` (same folder): an earlier agent rebuilt the home page today around the designer's feature list.

Screenshots (not in the repo): `C:\Users\Admin\AppData\Local\Temp\claude\f8173f44571ee159\d92726ee-f788-4602-8df6-7bcebbbfc7a0\scratchpad\printing\`
- `before/<page>-<ar|en>-<phone|desk>-fold.png` and `-full.jpg`; `before/text.json` (headings, pill CTAs, header and footer links per page, desktop).
- Tool: `.tmp-audit.mjs` in the repo root while working (deleted at the end): `node .tmp-audit.mjs <outDir> [pages] [text]`.

## Status

- [x] 1. Audit (ar + en, 390x844 + 1440x900): home, start, designer, why-elba, pricing, catalog, boxes/mailer-box, header, footer
- [x] 2. Home rewritten printing-first (copy.ts, page.tsx, home.module.css); e2e storefront/journey/j1 strings updated
- [x] 3a. Header (CTA "Get a price" / «معرفة السعر», Products menu: "Order and print" before "See it before you print"), footer brand line, `meta.tagline`/`description`, catalogue h1, /start hero sub + closing + meta
- [x] 3b. Designer page intro + closing, why-elba, pricing
- [x] 4. e2e strings updated; `npx tsc --noEmit -p .` clean; eslint on every changed file clean; `npx vitest run src/components/marketing src/i18n` 8 files / 46 tests pass; `generate-i18n-scopes.ts` regenerated, `--check` up to date
- [x] 5. After screenshots: `after/<page>-<ar|en>-<phone|desk>-fold.png`, `-full.jpg`, section shots `after/sec-*.jpg`, text dumps `after/text.json` (home) and `after/text-all.json` (all pages)

## New home hierarchy

1. Hero. h1 «علب مطبوعة بشعار مشروعك» / "Printed boxes for your brand" (alternate: «تصلك حتى بابك» / "Delivered to your door"). Lead: printed by vetted Egyptian printers, guaranteed by Elba, delivered across Egypt; see it in 3D with the exact price before paying. CTAs «معرفة سعر علبتك» / "Get your box price" (→ /start) and «عرض أنواع العلب» / "Browse box types" (→ /catalog). Proof points: vetted Egyptian printers, price known before you pay, delivery across Egypt. 3D NOUR mailer render kept.
2. What we print (`#products`): mailer and shipping boxes (FEFCO_0427), product cartons (ECMA_RTE), food boxes (PIZZA), rigid gift boxes (RIGID_BOX), labels for bottles/jars/cans (ROLL_LABEL), pouches and squeeze tubes (PRINTED_POUCH), each with a live "From EGP X each" (`getLowestUnit`, default size, as on /boxes). Note: cups, paper bags, moulded pulp by quote.
3. How ordering works (`#how`), 5 steps: choose your box → add your logo, see the price → approve the proof and pay → we print it (quality check) → delivered to your door (+ live "500 mailers reach Greater Cairo in N days").
4. Library wall "Choose from 370 models" (navy). 5. Print quality: boards in plain words + 8 finishes (navy).
6. The full price before you order: live stats + receipt (VAT 14%, setup and delivery included) (green).
7. Elba stands behind every order: vetted printers, proof, reprint or refund within 30 days, secure payment, delivered and tracked (Bosta), one seller one receipt.
8. See it before you print: free 3D preview (violet, supporting): designer screenshot + turntable, note about the free account, CTAs "Try the 3D preview free" and "More about the designer" (→ /designer).
9. FAQ "Questions about ordering and printing": minimum (live min, instant up to 2,000), time, proof, reprints, delivery outside Cairo, payment, need a designer, box not listed.
10. Closing "Your boxes, printed and delivered" + "Get your box price".

Removed: the 9-card designer feature list, the business-type "uses" grid (folded into "What we print"), the 3-step design-led "how" with UI mockups.

## Other changes

- Header: pill «معرفة السعر» / "Get a price" (was «البدء مجانا» / "Start free"); Products menu groups now Packaging → Order and print → «شاهدها قبل الطباعة» / "See it before you print" (items "Free 3D preview", "Price your box"); featured card "Your boxes, printed and delivered". Files: `src/i18n/kit.{en,ar}.ts`, `src/components/marketing/navModel.ts`.
- Footer brand line: printed packaging by vetted Egyptian printers, delivered across Egypt.
- `meta.tagline` / `meta.description` (`src/i18n/{en,ar}.ts`): printed boxes, made in Egypt, delivered.
- Catalogue h1 "Every packaging type, printed with your logo" (`src/components/catalogue/copy.ts`).
- /start: hero sub and meta lead with printed boxes delivered; closing h2 "Ready to get your boxes printed?" / «هل تريد طباعة علبك؟». h1 and CTAs unchanged (the page is the designer entry).
- /designer: hero body now ends in ordering prints from a vetted printer; closing h2 "From a free design to printed boxes". h1 and CTA unchanged (e2e).
- why-elba: hero sub printing-first, CTA "Get your box price", first point "Your printed box, before you pay"; pricing: tier CTAs "Get your box price", included item "Free 3D preview", closing "Your boxes, printed and delivered".
- Home CSS: new `.productCard`, `.howCard`, `.designerFoot`; removed dead `.trio`, `.mediaCard`, `.floatUi*`, `.howText`, `.howTitle`, `.useCard`; Arabic card/FAQ body 17px; phone icon-card body 16px (was 15); `.howNum` 14px (was 13); stats `.footnote` 14px (was 12).
- e2e updated for intentional copy changes: `storefront.spec.ts` (h1, "What we print for you", "Choose from N models", FAQ title, "Browse box types"), `start.spec.ts` (closing h2, header pill), `marketing-kit.spec.ts` (header pill), `journey.spec.ts` (hero "Get your box price"), `journeys/j1-brand-orders.spec.ts` (header pill via `tr("Get a price")`).

## Left to do

- e2e not run (long): run `storefront`, `start`, `journey`, `journeys/j1`, `marketing-kit`, `marketing-spacing`, `restyle-height`, `why-pricing`, `designer-page` with `--project=desktop`. Spacing: the new sections use kit `Sheet`/`SectionHead`/`Grid`/`Stack`; `.howCard` adds its own 20/16 px padding like the old icon cards.
- Pre-existing, not from this change: with `prefers-reduced-motion: reduce`, kit `Reveal` renders `data-revealed` on the server but not the client, so dev shows a hydration attribute warning ("1 Issue" badge) on the trust and designer cards.
- /start h1 "ابدأ اليوم" / "start today" and its sections ("Choose your box", "Make your packaging shine") are still tool-led; it is the designer landing, so only its promise and close changed. A deeper rewrite would need e2e `start.spec.ts` h2 list updates.
- Pricing tier CTA accessible name reads "Get your box price Trial" (label + tier); consider "Price for Trial" wording.
- Box detail (`(detail)` routes) unchanged: CTA "Design it free" is fine (price is the first section).
- Optional native review of the new Arabic copy.

## Findings: where the tool comes first

| # | Page | Where | What it says now | Problem |
|---|---|---|---|---|
| P1 | Home | Hero h1 + lead | "Packaging worthy of your brand" / "Design your box free in 3D, see the price instantly, and we print it..." | Lead opens with the tool; printing is the last clause. Primary CTA "Start designing free". Trust line "Instant price" (tool). |
| P2 | Home | Section order | how (design → price → print) · violet "See your box before it is printed" · "Everything you need, in one free designer" (9 editor features) · uses · "370 models in one library" · finishes · price · trust · FAQ · "Start your box today" | 3 of the first 4 sections are about the designer; what Elba prints and from what price never appears; trust/printing comes 9th. |
| P3 | Home | FAQ | First 2 questions: "Do I need a designer or design software?", "Is designing really free?" | FAQ opens on the tool, not on ordering (minimum, time, proof, reprints, delivery, payment). Reprint/refund promise missing. |
| P4 | Home | CTAs | "Start designing free" x4 | Every action is about designing, none about getting boxes or a price. |
| P5 | Header | Nav + featured card + CTA | "Start free" pill; Products menu lists "3D designer", "Start a design"; featured card "Your box, live in 3D" | Header CTA and the menu's lead card sell the tool. |
| P6 | Footer | Brand line | "Custom printed packaging, designed in 3D, made in Egypt." | OK-ish; leads with packaging but omits delivery/merchant. |
| P7 | Meta | `meta.tagline` | "Custom printed boxes, designed in 3D, made in Egypt" | Search/social title mentions the tool, not delivery. |
| P8 | Start | h1 "start today", h2s "Choose your box", "Make your packaging shine", ..., "Ready to design your box?" | Landing ends on "design"; no printing/delivery promise in the hero. |
| P9 | Designer page | h1 "Elba 3D packaging designer" | Allowed to be about the tool, but the intro never says the boxes are printed and delivered by Elba until section 4. |
| P10 | Why Elba | h1 "More boxes. Less spend."; first point "See it in 3D before it prints"; CTA "Start designing free" | Mostly printing-led already; first point and CTA are tool-first. |
| P11 | Pricing | Tier CTAs "Start designing"; "Always included" opens with "3D designer"; close "Turn your design into an order" | Pricing sells printed boxes but CTAs/first included item are the tool. |
| P12 | Catalog | h1 "Every packaging type, in 3D" | Catalogue headline is about 3D, not printed packaging. |
| P13 | Box detail | h1 "Mailer box", "Price from", CTA "Design it free" | Detail page is fine (price first); CTA "Design it free" kept (it is the path to an order). `(detail)` routes not changed here. |

What is already right: the 3D hero render (a real printed NOUR mailer), live numbers (models, printers, min order, 500-mailer price, delivery days), the trust block, the receipt mock, the pricing page's real tiers.

## Facts available in code (no inventions)

| Fact | Source |
|---|---|
| Instant price tiers 100, 250, 500, 1,000, 2,000 boxes; above 2,000 a quote | `QTY_TIERS` in `src/types/pricing.ts`; `maxInstantQty: 2000` in `src/lib/pricing/config.ts` |
| Minimum order = lowest active printer `minOrderQty` (seed: 50) | `listVendors()` (`src/components/store/data.ts`), `prisma/seed.ts` |
| Price per box for 500 mailers, delivery days (live) | `getPriceFrom("FEFCO_0427", 250x180x80)` |
| "From" price per product type (live) | `getLowestUnit(code, defaultDims)` (same as `/boxes`) |
| Delivery days = printer lead time (+3 for a new die, min 2) + transit (Greater Cairo 1, Alexandria/Delta/Canal 2, Upper Egypt 4, +1 between zones) | `src/lib/pricing/engine.ts`, `src/lib/pricing/config.ts` |
| Proof approved at checkout before the order exists; QC step before shipping | `src/lib/orders/state.ts` (`BUYER_STEPS`) |
| Reprint or refund within 30 days of delivery if boxes differ from the proof, are damaged or short | `src/i18n/en.ts` returns policy `defects`, `checkout.en.ts` |
| Payment: card, wallet, Fawry, InstaPay (Paymob) | `PAYMENT_METHODS` `src/types/order.ts`, `src/lib/payments/paymob.ts` |
| Delivery: Bosta, all 27 governorates | `src/lib/shipping/bosta.ts`, `GOVERNORATE_ZONE` in `src/lib/pricing/delivery.ts` |
| Printed products with instant prices: mailer/shipping boxes, pizza and food boxes, folding cartons, gable boxes, rigid gift boxes, paper tubes, roll labels (bottles, jars, cans), printed pouches, squeeze tubes | `capabilities.structures` in `prisma/seed.ts`; `STRUCTURE_CODES` |
| Cups, moulded pulp, kraft paper bags: quote only | `src/data/catalogue/order-mode.ts` |
| Finishes: matte/gloss/soft-touch lamination, varnish, spot UV, hot foil, emboss, deboss | `FINISH_CODES` |
