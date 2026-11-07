# Round 1 fixes (2026-11-07)

Fixes for `round-1-review.md`, by area.

## Marketing and entry

Owner of the area: marketing pages, box chooser, catalogue, box pages, cookie notice.

- **Home to price, 2 taps:** home «معرفة سعر علبتك» (hero, header, products, how, closing) → `/boxes` box chooser → «طلب هذه العلبة» on a card → designer with that box (the designer's price badge belongs to the designer area, R1-01).
- **R1-04 / R1-19:** `startHref()` (`navModel.ts`) now points to `/boxes` for every visitor and signed-in CTA. The header pill has one label, «معرفة سعر علبتك» / "Get your box price", and one destination for everyone. `StartLink.tsx` (the visitor vs signed-in «تصميم جديد» switch) is deleted. The menu item "Price your box" goes to the same place. `/boxes` is a short chooser: title «اختر علبتك», one line, one price note, then the box types grouped by use.
- **R1-05:** box cards and box pages say «طلب هذه العلبة» / "Order this box" (`marketing.boxes.order`, `store.structure.designCta`). The hint under it reads «أضف شعارك وشاهد علبتك ثلاثية الأبعاد قبل الدفع. المعاينة مجانية». Catalogue model pages say «طلب هذه العبوة بشعارك». On /start, «بدء التصميم مجانا» and «فتح المصمم» are replaced with selling labels.
- **R1-06 / R1-17:** /start is off the main path (it stays as the "How it works" page). On phones its title sits above the collage, the scroll-scrubbed 2-screen designer section is static, and the «تأكيد المطبعة» chip moves into the flow under the order card. The closing step arrows point down in Arabic. The start price chip shows the 500-box price «قبل الضريبة», not «ابتداء من». "Working days" became calendar days with the right Arabic plural. The dieline.pdf and "print-ready PDF" copy is gone.
- **R1-09:** `/boxes` groups the 13 box types by what you sell: shipping and online shops, food, cosmetics and shelves, gifts. Each card has a render, everyday name, description, «X ج.م للعلبة عند طلب 500 علبة» and the delivery days, with no codes or mm ranges. The catalogue drops the four-counter block; a «معرفة سعر علبتك» link to the chooser takes its place. The Egypt/Worldwide toggle is now one small secondary switch («إظهار الأنواع صعبة التوفير في مصر») next to the result count. The lead counts only the types available in Egypt. The hero «عرض أنواع العلب» became «عرض ما نطبعه» (#products).
- **R1-12:** the home page is down from 10 sections to 6: hero → what we print → guarantee (4 cards: reprint or refund, proof, payment and one receipt, delivery) → how (3 steps) → FAQ (4) → closing. Cut: the model wall, finishes band, stats and receipt, and the 3D preview band. Height on a 390 px phone went from about 11,200 px to 6,539 px.
- **R1-15:** the pricing cards are named by quantity («500 علبة»), not «تجربة / انطلاق…». Feature lists are gone (no "PDF proof" feature). Each card shows the per-box price before VAT under the VAT-inclusive one, the same basis as the home page and `/boxes`, so 37.97 can be matched across pages. The comparison table headers are quantities.
- **R1-16:** the cookie notice on phones uses physical `left/right: 0` with a doubled class and `inline-size: auto`. It measures 0 to 390 at 390 px. Its text is 14 px.
- **R1-07 / R1-08 / R1-20 (marketing parts):** cards use `getReferenceUnit` / `getPriceFrom(...).rows[500]` and `minQuantity` from `store/data.ts` exactly as returned, labelled «للعلبة عند طلب 500 علبة» plus the note «شاملة التجهيز والتوصيل إلى القاهرة الكبرى عند الدفع الإلكتروني، قبل ضريبة القيمة المضافة 14%». The FAQ minimum is checkout's `minQuantity`. Prices and delivery lines are 16 px or more.
- **R1-10:** no FEFCO/ECMA codes on box cards or the box page hero chip. «فورمة تكسير» / «فورمة جاهزة» became «قالب قص» / «مقاس جاهز». The «بتموج E أو B» family copy is gone, and so is «التجهيز وفورمة التكسير» on home (the receipt was removed). Catalogue meta and empty state no longer mention codes or «عالميا».
- **e2e updated:** `storefront`, `start`, `journey`, `journeys/j1-brand-orders`, `catalogue`, `marketing-kit` (labels, `/boxes` URL, «Order this box», scope switch). Not run (long).
- **Checks:** `tsc --noEmit` clean in this area (the remaining errors are in checkout, orders and designer files other agents are editing). eslint is clean on every changed file. `vitest run src/components/marketing src/components/catalogue src/i18n`: 9 files, 48 tests pass. `generate-i18n-scopes.ts` was regenerated and `--check` is up to date. No horizontal overflow on any page shot, and no console errors.
- **Screenshots:** `scratchpad\round1-fix\marketing\` (`ar-phone-home`, `ar-phone-boxes`, `boxes-food`, `ar-phone-mailer`, `ar-phone-start`, `start-steps`, `ar-phone-pricing`, `pricing-tier`, `ar-phone-catalog`, `ar-phone-home-cookie`, `en-desk-home`, `en-desk-boxes`, `en-desk-mailer`, each with `-full.jpg`).
- **Left:**
  - The pricing page shows «التسليم خلال 5 أيام» for 500 mailers, while `/boxes` shows 10 days for food boxes. Those days come from `pricing-facts` and `data.ts`, which belong to the price-truth area.
  - The /start Arabic title words still render far apart on phones, though no longer split by the images.
  - Catalogue cards still use the plain grey model renders and have no per-card price (computing 410 quotes is too heavy for the list).
  - The box page still lists printers (R1-13, buyer-flow area).
  - Material names such as «كرتون مضلع E كرافت» are shared dictionary entries used by the designer and checkout, and are unchanged.
  - The first-load JS budget was not measured (`npm run test:size` needs a build). This change removed a client island (StartLink) and added none.

## Checkout and orders

Owner of the area: checkout, payment page, order pages, orders list (`src/app/[locale]/(checkout)/**`, `src/app/[locale]/orders/**`), checkout dictionaries.

- **R1-18 (box name and picture):** a design without a name is now called by its box and size in centimetres, e.g. «علبة بريدية 25 × 18 × 8 سم», never «علبة بدون اسم» (new `src/lib/orders/box-name.ts`). The checkout summary shows the design's saved render (or the model drawing) with that name on every step; the payment page, the order item line, the orders list and the design picker use the same name.
- **R1-13 (no printers to manage):** step 1 says «تطبعها مطبعة معتمدة من علبة في {المدينة}» plus «علبة مسؤولة عن الطلب كاملا», with no printer name. Choosing another printer moved into a quiet «خيارات متقدمة: اختيار مطبعة أخرى» disclosure (vendor matching untouched). The printer line was removed from the price details and the payment summary. On the order page the buyer reads «من يطبع علبك» with the same promise, and staff still see the printer, its rating and its city. The self-contradicting "4.7 (128) · جديد على علبة" line is gone, and staff see either the rating or «جديد». The quote, sample, reorder and success copy no longer name or offer a printer.
- **R1-11 (approval step):** the heading is «راجع شكل علبتك قبل الطباعة». Print-check notes are plain sentences in an amber note, one per kind, never «مشكلة» or DPI. Example: «صورتك صغيرة، وقد تظهر غير حادة في الطباعة. ارفع صورة أكبر (عرضها 1000 بكسل على الأقل)، أو اطبعها كما هي». The note offers «رفع صورة أكبر» (to the designer) or printing it as it is. The separate «الطباعة كما هي» checkbox is gone: the single approval tick accepts the notes and reads «... رغم الملاحظات أعلاه» when there are any. A «بعد الموافقة والدفع» box lists what happens next in three steps. The proof tabs are «شكل العلبة» / «العلبة مفرودة», and the legend uses plain words. The order log reads «وافقت على التصميم كما هو». The server still records the acknowledgement (`acknowledgePreflight` = the approval tick).
- **R1-14 (order page):** a plain 4-stage tracker «استلمنا طلبك ← نطبع علبك ← في الطريق إليك ← تم التسليم» with dates (`BUYER_SIMPLE_TRACK` in `buyer-track.ts`, unit-tested). The 7 production steps sit behind «كل المراحل بالتفصيل». Buyers no longer get the print-file link. The proof link is «معاينة علبتك (PDF)». The proof version and file hash («البصمة») show only to staff. QC wording uses «أول علبة مطبوعة» instead of «فرخ». The delivery date is now a semibold line.
- **R1-10 (jargon, checkout and orders):** the «فورمة التكسير» price line reads «تجهيز الطباعة لمقاس علبتك (مرة واحدة)» on checkout, payment, order and receipt. «بروفة» and «ملف الطباعة» are gone from buyer copy. FEFCO code, board grade and mm size stay behind «تفاصيل العلبة».
- **R1-20 (type size):** the checkout shell and the orders area raise the kit's type scale for their subtree only: body 16px (17px Arabic), small text 14px (15px Arabic), and no badge, price or date under 14px. A walk on a 390px phone found no visible text under 14px on step 2 or the order page.
- **e2e:** `e2e/checkout.spec.ts` updated: the printer list opens from the disclosure, and the current tracker step is «Printing your boxes». Specs that tick `#preflight-override` already skip it when it is absent.
- **Checks:** `tsc --noEmit` clean; eslint clean on all changed files; `vitest run src/lib/orders src/i18n src/app` passes except `css-chunking.test.ts`, which compares the vendored Next file and is unrelated to this change. `generate-i18n-scopes.ts --check` is up to date. Arabic phone walk (390x844): checkout → mock card → order ELB-26306 → orders list. Screenshots are in `scratchpad\round1-fix\checkout\` (01-07).
- **Left:** the order page still re-splits the unit price (36.61 per box vs 37.97 at checkout; R1-02, price-truth area). The account page (`(store)/account`) was not restyled. English proof tab names are unchanged («3D proof»).

## Price truth

Owner of the area: pricing engine, `src/components/store/data.ts`, `/api/quote`, the designer price badge, price sheet and gate.

**One buyer price, everywhere.** New `buyerPrice()` and `PRICE_REFERENCE` in `src/lib/pricing/buyer.ts`. The per-box price is what checkout charges ex-VAT divided by the quantity: printing, setup, cutting die (non-standard sizes only), delivery to Greater Cairo, minus the online-payment discount, because every order is paid online. The total is what checkout charges incl. VAT. These are the same two numbers `toCheckoutOffer` / `tierPrices` compute (`orderTotals(lines, prepayDiscountPct)`). `getPriceFrom` (home, box pages, /start, /designer), `/api/quote` (a `pay` field on every offer) and the designer read through it. Verified in the browser (Arabic, 390 px), anonymous for home, box page and designer, signed in for checkout. The same 500 natural-brown mailers at 250×180×80 now show:

| Surface | Per box | Total | Delivery |
|---|---|---|---|
| Home "what we print" card | 37.97 | | 5 days |
| `/ar/boxes/mailer-box` table | 37.97 | 18,985.35 ex-VAT | 5 days |
| Designer badge and price sheet | 37.97 | 21,643.30 incl. VAT | "arrives around Thursday 12 November" (5 days) |
| Checkout, 500 card | 37.97 | 21,643.30 | "arrives around Thursday 12 November" |

Screenshots: `scratchpad\round1-fix\price\` (`home.png`, `box.png`, `box-table.png`, `designer-anon.png`, `designer-anon-sheet.png`, `designer-anon-order-gate.png`, `designer-signed-sheet.png`, `checkout.png`, `checkout-top.png`, `designer-after-logo.png`, `designer-sheet-after-logo.png`).

- **R1-03 (die cost on standard sizes): fixed.** There were two causes.
  1. `engine.ts` hard-coded `standardSize = false` for every library model. It now uses `modelHasStandardDie()`, which checks the model's own standard presets.
  2. The designer's default mailer size, 250×180×80 («طقم مستحضرات»), was not a standard preset, so the box most buyers start with paid the 2,250 EGP die. It is now marked `standard: true` in `prisma/seed.ts`, `src/lib/dieline/registry.ts` and `src/components/designer/lib/catalog.ts`. The dev database row was updated in place; no reseed was needed.

  Tests: a library model at its own standard size has no die and saves 3 days. The reference mailer is a standard size.
  - **Owner review:** this treats 250×180×80 as a die that every mailer printer already owns. The alternative is to keep it custom and drop the "no die cost for standard sizes" claim from the box pages.
- **R1-02 (four prices, two totals): fixed on the price-source side.** Home, box pages, /start, /pricing, the designer and the checkout cards now agree, as the table shows.
  - The designer sheet no longer adds the «قبل خصم الدفع المقدم» condition. The discount is already in the number, and the sheet says so in one line.
  - `pricing-facts.ts` uses the same reference box (`PRICE_REFERENCE`, 250×180×80, was 300×220×60).
  - **Left to the checkout and orders fixer:** the checkout summary still splits "500 boxes" from delivery, and the order page re-splits the unit price into product + setup + die.
- **R1-07 (delivery 5 vs 10): fixed on the source side.**
  - Delivery is always the best-match offer's `deliveryDays`, the value checkout turns into a date. With the die gone, the 500 mailer is 5 days on every surface.
  - The designer sheet shows the date with `arrivalDate()`, now also exported from `@/lib/pricing`. It is the same function as checkout's `_components/arrival.ts`, which could re-export it.
  - **Left to the marketing fixer:** the box page still lists per-printer lead times (R1-13).
- **R1-08 (minimum order, "from" prices): fixed on the data side.**
  - `getLowestUnit` (name kept for the existing call sites, now an alias of `getReferenceUnit`) returns the 500-box price, not the 2,000-box price. The home cards now read «37.97 ج.م للقطعة عند طلب 500 قطعة».
  - `PriceFrom.minQuantity` is the first quantity checkout offers (100). The home "minimum order" stat and FAQ use it instead of the printers' own minimum (50), via a one-line change in `(store)/page.tsx`.
  - `pricing-facts.minOrderQty` follows the same rule. `getMinOrderQuantity()` is available for other copy.
- **R1-01 (price behind the phone): changed, owner review.** The old soft gate G2 hid the price until sign-in. The price is now public:
  - `/api/quote` answers anonymous visitors, rate limited 60/min per user or per IP.
  - The designer badge prices on load with no lock state, and the price sheet opens without the gate.
  - The phone is asked for only on Order, Save, Share and Export. The `price` gate reason was removed from the designer; the analytics enum keeps it.
  - Copy updated: `auth.gateReason`, the home FAQ a1, the box-page `priceNote` and the designer-page `hero.fine` line in `marketing.{en,ar}.ts` (en + ar). The designer `badgeLocked` and `gate.reason.price` keys were removed.
  - e2e `designer.spec.ts` and `journey.spec.ts` now expect the price signed out and the gate on Share / Order.
- **R1-21 (price sheet clarity, toast on top): fixed.**
  - The sheet shows per box (all-in, ex-VAT), subtotal, VAT and total, then one arrival line and one "includes … and the 3% online-payment discount · valid until" line. The printer name and printer count were dropped (R1-13).
  - The badge says «500 علبة: 37.97 ج.م للعلبة شامل التوصيل، دون الضريبة · تصلك خلال 5 أيام», with no «ابتداء من».
  - Opening the sheet dismisses the editor's toasts: «تمت إضافة الصورة إلى وجه الأعلى» was visible before the badge tap and gone after it (checked in the browser).

Checks:
- `npx tsc --noEmit -p .`: clean for these files. The remaining errors are missing `buyer.*` / `orders.*` keys in CheckoutClient and the order pages, which the checkout fixer is working on.
- eslint on the changed files: clean.
- `npx vitest run src/lib/pricing src/lib/configurator src/components/designer src/components/store src/components/marketing/why src/i18n`: 641 passed.
- `generate-i18n-scopes`: run, `--check` up to date.
