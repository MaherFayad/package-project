# Round 3 fixes (2026-11-08)

## Round 3 — marketing pages

Area: home, /bottles, box pages, /start, the /designer marketing page and the catalogue.

- **R3-02 (labels priced on home, "coming soon" on /bottles):** labels **can** be ordered. Vessel models (jars, bottles, cans) are order mode `instant` (none of WIDE_JAR, ROUND_BOTTLE, DROPPER_BOTTLE, PUMP_BOTTLE or CAN-BEVERAGE is in `ORDER_MODE_TABLE`; the "imported" flag is about the bottle, not the label). They are priced as their `ROLL_LABEL`, which two seeded printers list. I checked /ar/design/glass-honey-jar-hexagonal: it shows «500 قطعة: 3.40 ج.م للقطعة … تصلك خلال 7 أيام» and «طلب هذا التصميم». So /bottles now lets you order:
  - The «قريبا» tags are gone. Each of the 5 cards opens its container in the designer, with the line «سعر فوري في المصمم».
  - The hero copy says labels are printed with your logo at your container's size.
  - The hero shows the same reference price as the home card (`getReferenceUnit("ROLL_LABEL")`, 4.06 today). The CTAs are «اختيار العبوة» (#vessels) and «تصميم علبة للزجاجة».
  - Menu and finishes copy lost «قريبا» too.
  - The home «أكياس وأنابيب» card (7.60) used to open /catalog with all 394 models. It now opens the stand-up pouch in the designer (STAND_UP_POUCH, instant).
- **R3-06 (box page):** `priceIntro` now reads «بمقاس ⁦25 × 18 × 8⁩ سم: … كرتون بني طبيعي» (cm and `materialsPlain`) in `PriceFromTable.tsx`. The /pricing hero and the receipt are the other fixer's area.
- **R3-07 (/start):**
  - Removed: «370 نموذجا في المكتبة», the 370 · 11 · 6 stats card, and the phone field. The closing is now one «معرفة سعر علبتك» link to /boxes, with «دون حساب ودون رقم محمول حتى تطلب».
  - UV became «طلاء لامع موضعي» (EN "Spot gloss").
  - The mock file names are now «رابط التصميم» / «بروفة علبتك».
  - The size is in cm, and «معاينة المصمم» became «معاينة حية».
  - `e2e/start.spec.ts` was updated: the phone-form test was dropped and the closing link must go to /boxes. Not run.
- **R3-13 (catalogue codes and English jargon):**
  - Catalogue model page: the «FEFCO 0200» eyebrow and the «المعيار» row are gone, and sizes are in cm. The code stays only in the English tab title, for search.
  - Sub-family names use `plainKindName` in the filter tree, the cards, the crumbs and the designer picker. It now also strips "(RTE, STE)" and "(VFFS)". Search still matches codes.
  - English box descriptions no longer say "roll-end tuck-front", "(FEFCO 0320)", "FEFCO 0426 style" or "SBS". The Arabic roll-label and pouch descriptions no longer say «بولي بروبيلين» or «PET/PE». I changed this in `registry.ts` and `seed.ts`, and updated the 11 dev-DB `Structure` rows in place, without reseeding.
- **Checks:**
  - `tsc` is clean.
  - eslint is clean on the changed files.
  - vitest on marketing, catalogue, store, i18n, data and dieline/library: 661 tests pass.
  - Scopes are regenerated, and `--check` is up to date. It went stale once from the parallel fixer's auth keys.
  - Playwright at 390 AR and 1440 EN on home, /bottles, /boxes, the box page, /start, /catalog and 2 model pages: 0 overflow and 0 console errors. Screenshots are in `scratchpad\round3-fix\marketing\final_*`.
- **Left / owner:**
  - Production `Structure` descriptions need the same update. Do not reseed.
  - The catalogue still lists 394 models with family chips. Moving the 13 boxes first is an owner call.
  - /designer keeps the `elba.eg/s/…` link and «MORNING COFFEE» in its mockups, on purpose: they show a URL and bilingual text.

## Round 3 — checkout and orders

Area: sign-in, checkout, payment, order page, receipt, /pricing.

**What a buyer now sees** (500 natural-brown mailers, Arabic, 390x844, new number, orders ELB-26315 and ELB-26316):

| Path | Per box | Total | Arrives |
|---|---|---|---|
| Designer, /pricing, checkout to Cairo | 37.97 | 21,642.90 (18,985.00 + VAT 2,657.90) | 5 days, Thu 12 Nov |
| New buyer: Cairo first, then picks أسوان | 35.17 | 20,046.90 | Wed 18 Nov |
| Same buyer again, saved Aswan address | 35.17 | 20,046.90 | Wed 18 Nov |

Before this round the two Aswan paths gave 38.98 / 22,219.46 and 35.18 / 20,052.09.

- **R3-01 (price depends on the path):**
  - **Root cause.** On a re-price, `CheckoutClient.fetchOffers` kept the current printer if it was still in the new offers. So the printer picked for the default Cairo address (العبور) stayed after the buyer chose Aswan, although the best match for Aswan is another printer (السادس من أكتوبر). The engine ranking is deterministic: ties are broken by vendor id.
  - **Fix.** New pure `checkoutVendor(offers, picked)` in `src/lib/pricing/headline.ts`. It returns the best match, or a printer the buyer chose under «خيارات متقدمة» if that printer still prices the run. A governorate change clears the buyer's pick. Only the latest re-price response is applied, so a slow Cairo reply cannot overwrite the Aswan one. The draft in sessionStorage keeps the printer only when the buyer chose it.
  - **Notice.** `designerReference()` in `service.ts` computes the designer's figure for this design and quantity: Greater Cairo, best match, with the prepay discount. `getOffersAction` and the checkout page send it whenever the governorate is outside Greater Cairo. When the governorate changes the price or the date, checkout shows one line under the address form and in the summary: «السعر في المصمم 37.97 ج.م للعلبة والتسليم خلال 5 أيام، وهو للتوصيل إلى القاهرة الكبرى. التوصيل إلى أسوان: 35.17 ج.م للعلبة، وتصلك تقريبا يوم الأربعاء، 18 نوفمبر.»
  - **Test.** `headline.test.ts` "R3-01" checks three things: the same ranking on repeated quotes and with the vendor list reversed (every zone); the same printer, subtotal and days whether the buyer came from Cairo or went straight to the zone; and that a buyer's own pick is kept.
  - The designer strip itself was not changed (still Cairo). The checkout line explains the difference.
- **R3-03 (terms only after a failed Verify):**
  - The code step now shows the same form for every number: the optional offers checkbox (unticked), then «بالمتابعة توافق على شروط الخدمة وسياسة الخصوصية.» with links, then the button. The form sends `acceptTerms: true`, so Verify never answers TERMS_REQUIRED. A new number verifies with one press (checked: 200, `isNew: true`).
  - The optional name field is gone; the address asks for the name (see R3-14).
  - The phone's status is still never revealed before a valid code.
  - The server still enforces TERMS_REQUIRED, and the consent rows are unchanged: a new account logs TERMS and PRIVACY. A returning user on an older terms version re-accepts the current one by continuing (`consentRowsForSignIn`).
  - e2e updated: `verifyNewAccount` (one press) and `smoke.spec` (a returning buyer sees the terms line and an unticked offers box).
- **R3-04 (phone reversed):**
  - In Chromium the old isolate characters measured in the right order (the 010 group sits left of the last group). The phone is now a real `<bdi dir="ltr">` element (`PhoneNum`, `.num`: isolate, nowrap) in the code-sent notice, the code hint and the example in the phone hint.
  - `auth.phoneHint` now takes an `{example}` placeholder.
- **R3-12 (qty × unit ≠ line):**
  - **Choice.** `orderTotals()` rounds the discounted ex-VAT amount **down** to a whole piaster per box. The remainder (always fewer piasters than the quantity) goes into «خصم الدفع مقدما», in the buyer's favour. Every surface reads these totals, so per box × quantity = the boxes line everywhere: 500 × 37.97 = 18,985.00, 500 × 35.17 = 17,585.00 on the receipt, and 100 × 79.56 = 7,956.
  - The charged amount equals what is shown. It is at most quantity − 1 piasters lower than before (≤ 4.99 ج.م on 500 boxes), plus VAT on that difference.
  - Not rounded: orders without the discount (a team-sent price, samples), and existing orders (stored totals are unchanged).
  - Tested in `totals.test.ts` "R3-12". `pricing-facts` and the checkout equality tests still pass.
- **R3-11 (`نطبع علبك` before the printer confirms):** `simpleTrackFrom` moves to «نطبع علبك» only from IN_PRODUCTION (printer accepted). A paid order shows «استلمنا طلبك» as the current step, and its chip reads «بانتظار تأكيد المطبعة» (`orders.detail.simple.AWAITING_PRINTER`), on the order page, the orders list and the account. Unit tests and `e2e/checkout.spec.ts` updated.
- **R3-15 / R2-17:**
  - The payment page's back link goes to the checkout of the same design («العنوان والموافقة», `restartUrl`), not the orders list.
  - The repeated «500 علبة» under the box name was removed.
- **R3-10 (part):**
  - The wallet number is prefilled with the account's mobile.
  - The expiry placeholder is «شهر/سنة» (`payment.card.expiryPlaceholder`).
  - Not done: the method form still opens after «متابعة» rather than inline. That is a larger PaymentClient change.
- **R3-16:** the Fawry screen adds «تصلك تقريبا يوم {date} إذا دفعت اليوم. كل يوم تأخير في الدفع يؤخر التسليم يوما.» The date comes from the order's dueDate − placedAt.
- **R3-09 (/pricing VAT switch):** the switch is now two segments, «بدون الضريبة | شاملة الضريبة 14%», each a toggle button (aria-pressed, 44 px). The pressed one is the price shown below it, and the ex-VAT segment starts pressed. `e2e/why-pricing.spec.ts` updated.
- **R3-06 (my part):**
  - The /pricing hero says «علبة بريدية 25 × 18 × 8 سم», with no-break spaces so the size stays on one line in order.
  - The receipt line says «علبة بريدية، 25 × 18 × 8 سم، كرتون بني طبيعي» (`materialsPlain`, falling back to the grade).
  - The order page's size detail is in cm.
- **R3-14:** placing an order copies the address name into an empty profile name.
- **R3-17:** the printer-profile link in «خيارات متقدمة» gets an aria-label with the printer's name. It already had visible text.
- **Checks:**
  - `tsc`: clean for these files. At the end, `src/app/[locale]/admin/orders/[number]/page.tsx` (not mine, being edited elsewhere) showed 3 prop errors.
  - eslint on every changed file: clean.
  - `vitest run src/lib/{pricing,orders,configurator,auth} src/i18n src/components/marketing/{why,kit}`: 20 files, 631 tests pass.
  - The full suite: 4 unrelated failures.
    - `css-chunking` and `cloudflare` schema: line-ending compares in the working copy.
    - `r7-audit` and `pricing-facts`: timeouts under load. Both pass on their own.
  - `generate-i18n-scopes --check`: up to date.
  - e2e specs edited, not run.
- **Screenshots** in `scratchpad\round3-fix\checkout\`, Arabic, 390x844:
  - `w_02_signin_code` (new buyer)
  - `w_03_checkout_cairo`
  - `w_04_checkout_aswan_note` and `w_05_checkout_aswan`
  - `w_06_pay` and `w_07_pay_card`
  - `w_08_order_paid`
  - `w_09_checkout_aswan_saved`
  - `w_10_pricing` and `w_11_pricing_incl`
  - `w_12_receipt`
  - 0 console errors and no horizontal scroll. Script: `walk.mjs`.
- **Owner decisions:**
  - Terms are accepted by continuing (a notice line) instead of a ticked box. The consent log records it the same way. Check that this is acceptable for PDPL and the terms.
  - The prepay discount absorbs the per-box rounding (a few piasters per order, in the buyer's favour).
  - The offers checkbox now shows for returning buyers too. It is unticked, and leaving it unticked changes nothing.
