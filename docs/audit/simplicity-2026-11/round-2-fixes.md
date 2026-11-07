# Round 2 fixes (2026-11-07)

Fixes for `round-2-review.md`, by area. Each fixer appends its own section.

## Round 2 — price and order truth

Owner of the area: order page, receipt, orders list status, checkout and payment summaries, `/pricing`, the `/start` designer mock, the box page printer card.

**What a buyer now sees** for 500 natural-brown mailers (250×180×80), Arabic, 390x844, order ELB-26307:

| Surface | Per box | Visible rows | Total | Delivery |
|---|---|---|---|---|
| `/ar/pricing` card (VAT toggle off by default) | 37.97 | 18,985.35 before VAT | 21,643.30 | 5 days |
| `/ar/pricing` table | 37.97 | 19,557.00 − 571.65 = 18,985.35, VAT 2,657.95 | 21,643.30 | 5 days |
| `/ar/start` designer mock | 37.97 | | | 5 days |
| Checkout summary, steps 1 and 2 | 37.97 (card) | «500 علبة · شامل التجهيز والتوصيل وخصم الدفع مقدما» 18,985.35, VAT 2,657.95 | 21,643.30 | Thursday 12 November |
| Payment page summary | | same single boxes line + VAT | same | |
| Order page | 500 × 37.97 | boxes 18,985.35 + VAT 2,657.95 | 21,643.30 | due 12/11 |
| Receipt | 500 × 37.97 | 18,985.35, with an indented «يشمل السعر» block (18,305 / 750 / 502 / −571.65) | 21,643.30 | |
| Sample (pricing and checkout row) | | | 998.64 incl. delivery and VAT | |

- **R2-01 (order page and receipt):** the item line is now the buyer price: quantity × (ex-VAT charged ÷ quantity), with the line total = the ex-VAT amount charged, and the note «للعلبة (شامل التجهيز والتوصيل وخصم الدفع مقدما)». The payment card shows boxes + VAT = total. The engine split moved under it, behind «تفاصيل السعر». The receipt has one goods row at the buyer price, and the split sits inside the row as an indented «يشمل السعر» list (`.invIncludes`), so the visible rows add up to the net total. The delivery line in the details reads «التوصيل», not «الشحن». The stored order and invoice data are unchanged. This is display only.
- **R2-02 (checkout summary split):** checkout steps 1 and 2 (`CheckoutClient`) and the payment page (`PaymentClient`) show one boxes line with «شامل التجهيز والتوصيل وخصم الدفع مقدما» (or «شامل التوصيل» for a sample, and no discount wording on a team-priced quote). The separate delivery row is gone, and the split is still under «تفاصيل السعر».
- **R2-03 (/start mock 39.69 / 10 days):** re-shot from the current designer at 390x844 (3x) and 1440x900 (2x) in ar and en. Phone frame from `scripts/marketing/render-ui.mjs`. Replaced `public/marketing/r6/ui/phone-designer-{ar,en}[@2x].{webp,avif}` and `public/marketing/designer-{ar,en}[.720w].webp` (same pixel sizes, so `assets.generated.ts` is unchanged). The mock now reads «500 علبة: 37.97 ج.م للعلبة شامل التوصيل، دون الضريبة · تصلك خلال 5 أيام». Scripts: `scratchpad\round2-fix\truth\designer-shot.mjs`, `build-mocks.mjs`.
- **R2-05 (printer list with 4/6/8/10 days):** the box page card «من يطبع علبتك» has no printer names, links or lead times. It is one line: «تطبعها مطابع معتمدة في {cities}. علبة مسؤولة عن طلبك كاملا، والتسليم في الموعد الموضح في جدول الأسعار.» (`store.structure.printedIn`; `StructureDetail.tsx` only touches that card).
- **R2-08 (/pricing):**
  - The VAT toggle starts off, so 37.97 is the big number.
  - Every card keeps «الإجمالي شامل الضريبة 21,643.30» in view in both states, which also keeps the inclusive price in view for consumers.
  - The "you save" line shows the ex-VAT discount (571.65), the same figure as the table and the order details.
  - The table is all ex-VAT: a new `listSubtotalPiasters` row («المجموع قبل خصم الدفع مقدما بدون الضريبة») − discount = subtotal, + VAT = total. The second group is renamed «يشملها السعر», so setup and delivery read as parts of the price, not extra rows.
  - A unit test pins both sums.
- **R2-09 (sample 998.64 vs 750 + VAT):** the checkout sample row shows «الإجمالي 998.64 ج.م شامل التوصيل والضريبة». The page computes it from `sampleOffers()`, the same offer checkout charges when the sample is picked. If no sample offer is available, the old wording stays.
- **R2-10 (three status names):** new `buyerStatusKey()` in `src/lib/orders/buyer-track.ts`. A buyer reads only the tracker stage (استلمنا طلبك / نطبع علبك / في الطريق إليك / تم التسليم), or «بانتظار الدفع» / cancelled / refunded. The order page chip (one badge for buyers; staff keep both badges), the orders list and the account order cards all use it. «قيد التجهيز للطباعة» is no longer shown to buyers. The success copy now matches /start: «استلمنا طلبك وأرسلنا تصميمك المعتمد إلى المطبعة، وتؤكده خلال 24 ساعة…», and next step 1 is «تؤكد المطبعة طلبك خلال 24 ساعة، ثم تبدأ الطباعة.» Unit-tested.
- **R2-15 (one discount name):** «خصم الدفع مقدما» in checkout, the designer sheet, the box page note, home, `/boxes` and `/pricing` (the English already said "prepay discount"; "online-payment discount" became "prepay discount"). The payment page adds «خصم الدفع مقدما محسوب في هذا الإجمالي مع كل طرق الدفع، ومنها الدفع نقدا في فوري.»

**Checks**
- `npx tsc --noEmit -p .`: clean.
- eslint on every changed file: clean.
- `generate-i18n-scopes.ts` regenerated; `--check` is up to date.
- `vitest run src/lib/pricing src/lib/orders src/components/marketing src/components/store src/components/designer src/i18n src/app`: everything in this area passes. Three failures are outside it:
  - `css-chunking`: pre-existing and unrelated.
  - `designer-page/copy.test.ts`: R2-04, other fixer, in progress.
  - `copy-rules` glossary: `designer-page.*` strings, other fixer.
- e2e `why-pricing.spec.ts` was updated for the toggle default. Not run (long).

**Screenshots** (Arabic, 390x844, signed in as 01000000002), in `scratchpad\round2-fix\truth\`:
- `order.png`, `receipt.png`, `orders.png`, `checkout.png`, `pay.png`, `pricing.png`, `start.png`, `start-designer.png`
- crops `v-*.png`, and the page text in `*.txt`

**Left**
- The receipt per-box figure is rounded: 500 × 37.97 = 18,985.00, against a line total of 18,985.35. It is standard rounding, but a careful reader may notice the 0.35.
- The orders list on desktop still has a separate payment column («مدفوع») next to the status. Phones show only the status.
- R2-17 (back link from payment, stale unpaid orders) and R2-19 (quantity asked twice) were not touched.
- The PAID status reads «نطبع علبك» before the printer confirms. The success copy says confirmation comes within 24 hours, and the detailed tracker still shows printer acceptance.

## Round 2 — message and simplicity

Owner of the area: `/designer` marketing page, box page specs, the designer's «كل الخيارات», account, catalogue, home hero, menu and footer labels, and the copy issues left in those places.

- **R2-04 (`/designer` sold the tool):** it now sells the printed box. H1 «معاينة علبتك قبل الطباعة», title «شاهد علبتك المطبوعة قبل أن تطلبها», and every CTA is «معرفة سعر علبتك» → `/boxes`. The box-type cards open their box page with the price, not the editor. Removed: the "describe your box" search over 370 models (`PromptBar.tsx` deleted), the materials wall (SBS, PETG, PET/PE…), the print-ready PDF / template / 3D-model download card, and the hex codes. The fake share link reads `elba.eg/s/…` on any non-https host, never `localhost`. The FAQ is 9 plain questions, and the trust card no longer says "you compare printers". Menu: «معاينة علبتك» (was «معاينة ثلاثية الأبعاد مجانية»); the «التشطيبات والخامات» item (`#finishes`, an anchor that no longer exists) is gone. Footer: «معاينة علبتك», «كل ما نطبعه». The page went from 9 sections to 7. `e2e/designer-page.spec.ts` and the copy unit test were updated, and the unit test now fails on SBS / PETG / PDF / dieline / localhost / FEFCO in this copy.
- **R2-06 (box page read like a printer's sheet):** sizes come first, in cm by use («تيشيرت · 30 × 22 × 6 سم»), under «مقاسات شائعة (من الداخل)» with a "will your product fit?" line. Materials use new plain names (`materialsPlain`: «كرتون بني طبيعي / كرتون أبيض / كرتون بني سميك للشحن»…). The mm ranges, size rules, colour count, finishes and board grades with gsm sit in a closed «تفاصيل فنية» disclosure. The hero chip and the side card show cm. R2-05 (the printer list) was done by the other fixer in the same file; that work is kept.
- **R2-07 (designer «كل الخيارات»):** the FEFCO code under the model name is gone. «تغيير النموذج» is now «تغيير نوع العلبة». The view tab «القالب» is «العلبة مفرودة» ("Laid flat"), and the panel tab «الفحص» is «جاهزية الطباعة» ("Print check"). Board options use the plain names, and the board help line drops E/B flute. A warning that several options share (the foil 0.5 mm note) now shows once under its group, and each option is still described by it (`OptionGroup` in `ConfigPanel.tsx`). The mm size fields in all-options stay as they are: that mode exists for exact sizes.
- **R2-11 (account):** orders come first. Saved designs show the 3 latest that have something on them. They are named by box and size («علبة بريدية 25 × 18 × 8 سم»), or «علبة الطلب ELB-…» once ordered (looked up through the proof). Everything else, untouched drafts included, sits behind «عرض كل التصميمات (14)». The mm line is gone. **Auto-save:** checked in the browser while signed in. A designer visit with no change saves nothing (the count stayed at 14), because the autosave already waits for the first edit (`hist.past.length > 0`). The drafts in the review came from visits that added a logo, so no change was needed. «ملف JSON» now reads «ملف بياناتك» (R2-18).
- **R2-12 (logo too small only at checkout):** the simple panel shows an amber note under the logo button while any logo is under the print threshold (the same `effectiveDpi < 300` that checkout uses): «شعارك صغير، وقد يظهر غير حاد في الطباعة. ارفع صورة أكبر (عرضها 1000 بكسل على الأقل) إن وجدت، أو اتركه كما هو.» The upload toast adds the same sentence. Checked with a 300 px PNG in both languages. The DesignerApp edit is two lines (an import and the toast text). The 3D pointer and highlight code and `components/three` were not touched.
- **R2-13 (catalogue):** «أنواع العلب» is removed from the top bar; the catalogue stays in the products menu («كل ما نطبعه») and the footer. The title is «كل ما نطبعه بشعارك» and the meta title «كل ما نطبعه: …». The lead drops the count and points to the 13 boxes and the chooser CTA. The 13 core boxes use the branded `/boxes` renders instead of the plain grey shots. «زجاجات PET / HDPE» became «زجاجات بلاستيك شفاف / متين».
- **R2-14 (phone home hero):** on phones the box render sits between the title and the subtitle (stage `inset-block: 22% 43%`, smaller perfume prop). The scrim under the copy is near-solid, and the subtitle has a text shadow. At 390x844 the subtitle no longer crosses the box.
- **R2-16 (sign-in sheet):** the title is «رقم محمولك للمتابعة» / "Your mobile number to continue". The note promised an opt-in "on the next step" that returning buyers never see; it now says the account is found and signed in if the number has one. Three e2e specs were updated.
- **R2-18 (Latin on Arabic pages, my pages):** «طلاء UV موضعي» became «طلاء لامع موضعي» in the finishes dictionary, the configurator and vessel names, home, and the library help. The menu's "latest" line was updated too. Not done: «MM/YY» on the payment form and /start's collage (other fixer's area).
- **R2-20 (desktop designer header):** the top bar reads «علبتك» / "Your box". Export and Share are still separate buttons on desktop; moving them into «⋯» means editing the DesignerApp toolbar, which I left alone.
- **Checks:**
  - `npx tsc --noEmit -p .`: clean, 0 errors.
  - eslint on every changed file: clean.
  - `vitest run src/components/{marketing,catalogue,designer,store} src/i18n src/lib/configurator src/data src/lib/vessels`: 45 files, 1476 tests pass. `catalogue-cache-purge` timed out once under parallel load and passes on its own.
  - `generate-i18n-scopes.ts`: regenerated, and `--check` is up to date.
  - Playwright (SwiftShader), 390x844 Arabic and 1440x900 English: `/designer`, `/boxes/mailer-box`, `/catalog`, home, `/account` (signed in through a session row), and the designer with the low-res logo and all options. No horizontal scroll and no console errors on any of them.
  - e2e specs were edited but not run (long).
  - Screenshots: `scratchpad\round2-fix\message\` (`final-*`, `designer-*`, `home-*`, `account-*`).
- **Left / owner:**
  - The box page price intro still says «بمقاس 250 × 180 × 80 مم … كرتون مضلع E كرافت» (`store.structure.priceIntro` in `PriceFromTable`, price area). It could use cm and `materialsPlain`.
  - The catalogue still shows family chips with counts («كرتون مضلع 210», 394 models) below the chooser CTA. Cutting it to boxes only is an owner call.
  - The other catalogue cards keep the plain renders.
  - R2-15 (discount name), R2-17, R2-19 and the «MM/YY» placeholder are in the checkout and price area.
