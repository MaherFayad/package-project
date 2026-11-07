# Simplicity round 2: buyer walk review

Date: 2026-11-07. Reviewer: round 2 agent. This was a review only; no code was edited.

**Walk.** Arabic on a 390x844 phone first:
- home, `/ar/boxes`, the mailer box page, the designer with a 300 px PNG logo, and the price sheet
- real OTP sign-in as 01000000002 (code from the dev banner)
- checkout steps 1 to 3, mock card 4242, order ELB-26307, receipt, orders list, account
- `/ar/start`, `/ar/pricing`, `/ar/catalog`, `/ar/designer`, and the header menu

Then English at 1440x900: home, boxes, box page, pricing, start, designer, order page, account.

**Screenshots** are in `C:\Users\Admin\AppData\Local\Temp\claude\f8173f44571ee159\d92726ee-f788-4602-8df6-7bcebbbfc7a0\scratchpad\round2-review\`. The paths below are relative to that folder. `*.cN.png` files are slices of a full-page shot, and the matching `*.txt` files hold the page text.

**What is better since round 1.** The message on home, `/boxes` and the box cards is now "we print your boxes". The home CTA leads to the box chooser and then to the designer in 2 taps. Adding a logo is one tap and it lands on the lid. The price is public. The 37.97 ج.م per box, 21,643.30 ج.م total and 5-day delivery match on home, `/boxes`, the box page table, `/start` (order card), `/pricing` (secondary line), the designer badge and sheet, and checkout step 1. I saw no console errors, no horizontal scroll, no broken images and no visible key text under 14 px.

Tags: **[leftover]** means round 1 named it as left or did not cover it. **[new]** means it is not in `round-1-fixes.md`.

---

## High

### R2-01 · Order page and receipt: a different per-box price, and a total that does not add up [leftover R1-02]
- **Page:** `/ar/orders/{id}`, `/ar/orders/{id}/invoice`
- **What the shop owner sees:** every page before payment said 37.97 ج.م per box. After paying, the order page says «500 × 36.61 ج.م = 18,305.00 ج.م». The visible payment card then shows only VAT 2,657.95 and «الإجمالي 21,643.30». 18,305 + 2,657.95 is 20,962.95, so 680.35 ج.م looks unexplained until they open «تفاصيل السعر» (setup 750 + shipping 502 − prepay discount 571.65). The receipt shows the same 36.61 split.
- **Why it matters:** the page they keep and show their accountant gives a price that matches nothing they were told, and the sum looks wrong. That damages trust right after they have paid.
- **Fix:** print the line as the buyer price, «500 علبة × 37.97 ج.م = 18,985.35 ج.م (شامل التجهيز والتوصيل وخصم الدفع الإلكتروني)», then VAT, then the total. Keep the setup / shipping / discount split behind «تفاصيل السعر» on the order page. On the receipt, put it in an indented "includes" block so the visible rows add up.
- **Screens:** `f17-after-pay-2-full.c0.png`, `f19-receipt.png`, `f18-order-pricedetails.png`

### R2-02 · Checkout summary takes delivery out of a price that said it included delivery [leftover R1-02]
- **Page:** `/ar/checkout/{id}` steps 1 and 2, and the payment page
- **What the shop owner sees:** the 500 card says «37.97 ج.م للعلبة», and the designer said «شامل التوصيل». The «طلبك» summary then shows «500 علبة 18,483.35 + التوصيل 502.00». That works out to 36.97 per box, plus a delivery charge that looks added on top.
- **Why it matters:** this is a third per-box figure (37.97 / 36.97 / 36.61) for the same order. "Delivery included" now looks like a lie, even though the total is right.
- **Fix:** one summary line, «500 علبة (شامل التوصيل إلى القاهرة) 18,985.35», then VAT and the total. If delivery must show, write «منها التوصيل 502.00» as an indented note rather than a summed row.
- **Screens:** `f03-after-otp-full.png`, `f11-address-full.c1.png`

### R2-03 · `/start` shows 39.69 ج.م and 10 days right under a 37.97 / 5-day hero [leftover, static image]
- **Page:** `/ar/start`
- **What the shop owner sees:** the hero chip says «37.97 ج.م للعلبة». A few lines lower, the phone mock of the designer reads «500 علبة ابتداء من 39.69 ج.م للعلبة دون الضريبة · التوصيل خلال 10 أيام». The mock also shows the old «ابتداء من» wording and «PNG أو JPG أو WebP أو SVG حتى 10 ميجابايت».
- **Why it matters:** two prices and two delivery times sit on one screen of the "How it works" page.
- **Fix:** re-shoot the mock from the current designer (badge 37.97 · 5 أيام), or crop it to the 3D box with no price chip.
- **Screen:** `ar_ar_start.c0.png`

### R2-04 · `/ar/designer` still sells the design tool, with print jargon [new]
- **Page:** `/ar/designer`. It is linked from the menu («معاينة ثلاثية الأبعاد مجانية», «التشطيبات والخامات») and the footer («المصمم ثلاثي الأبعاد»).
- **What the shop owner sees:**
  - the eyebrow «مصمم العلب ثلاثي الأبعاد من علبة», the title «علامتك على كل وجه», the first line «صمم علبتك على نموذج ثلاثي الأبعاد…» and the CTA «بدء التصميم مجانا»
  - further down: «نزل ملف PDF جاهزا للطباعة أو القالب فارغا أو النموذج ثلاثي الأبعاد», a materials list with «كرتون دوبلكس SBS 300 جم» and «فيلم انكماش PETG» / «رقائق أكياس PET/PE», «البحث في كل النماذج (370)», a fake share link that reads «localhost:3000/s/k7m2q9», and colour hex codes
- **Why it matters:** this is the one public page whose headline is the tool, not printed boxes, and the menu sends people to it.
- **Fix:**
  - retitle it as a printing page, for example «شاهد علبتك المطبوعة قبل أن تطلبها», and make the CTA «معرفة سعر علبتك» → `/boxes`
  - drop the download-file and SBS/PET/PETG copy and the model count
  - show the share link as `elba.eg/s/…`
  - rename the menu and footer items to «معاينة علبتك»
- **Screens:** `ar_ar_designer.c0.png` … `c6.png`, `txt_ar_designer.txt` (lines 206 to 382)

---

## Medium

### R2-05 · The box page gives printer lead times that contradict its own delivery promise [leftover R1-13]
- **Page:** `/ar/boxes/mailer-box`
- **What the shop owner sees:** the table says «التسليم خلال 5 أيام». The «مطابع تنفذ هذه العلبة» list below it says «التنفيذ خلال 6 أيام / 4 / 8 / 10 أيام».
- **Why it matters:** a 6-day print job cannot arrive in 5 days. It also puts printers back in front of a buyer who should only deal with Elba.
- **Fix:** remove the printer list from the buyer box page, or reduce it to «تطبعها مطابع معتمدة في القاهرة والإسكندرية ودمياط» with no days.
- **Screen:** `ar_ar_boxes_mailer-box.png` (bottom), `txt_ar_boxes_mailer-box.txt`

### R2-06 · Box page specs read like a printer's sheet [leftover]
- **Page:** `/ar/boxes/mailer-box`: «المواصفات», «مقاسات شائعة», «الخامات»
- **What the shop owner sees:**
  - «الطول (مم) من 80 إلى 600», «قواعد المقاس: لا يزيد الارتفاع على العرض», «من 1 إلى 6 ألوان»
  - «قالب قص»
  - «كرتون مضلع E كرافت · 380 جم، سمك 1.5 مم», «كرتون مضلع B كرافت 450 جم، سمك 3 مم»
- **Why it matters:** these are board grades and mm ranges, about half of the page. The shop owner only needs to know "will my product fit" and "brown or white".
- **Fix:**
  - lead with the sizes in cm by use (accessories, t-shirt, shoes)
  - show materials as «بني طبيعي / أبيض / سميك للشحن»
  - fold the mm ranges, gsm and E/B flute into a closed «تفاصيل فنية» disclosure
- **Screen:** `ar_ar_boxes_mailer-box.c1.png`

### R2-07 · Designer «كل الخيارات» shows FEFCO codes and dieline tabs [leftover]
- **Page:** `/ar/design?structure=FEFCO_0427` → «كل الخيارات»
- **What the shop owner sees:**
  - «علبة بريدية · FEFCO 0427 · تغيير النموذج»
  - the view tabs «ثلاثي الأبعاد / الوجه / القالب» and the panel tabs «العلبة / التصميم / العناصر / الفحص»
  - mm sliders «80–600», and foil notes «اجعل خطوط البصمة 0.5 مم على الأقل» repeated three times
- **Why it matters:** one tap away from the simple mode, the tool turns into a prepress app. A curious shop owner gets lost and may not find the way back to «الأساسيات».
- **Fix:**
  - hide the FEFCO code
  - rename «القالب» to «العلبة مفرودة», which checkout already uses, and «الفحص» to «جاهزية الطباعة»
  - show the foil note once under the foil group
- **Screen:** `d10-alloptions.png`, `d10.txt`

### R2-08 · `/pricing` leads with a different headline number from every other page [leftover R1-15 by design]
- **Page:** `/ar/pricing`
- **What the shop owner sees:** the big number is «43.29 ج.م للعلبة شامل الضريبة» (and 90.71 for 100). Home, `/boxes`, the box page and the designer all lead with 37.97. The comparison table also mixes bases. "Total before the prepay discount" is 22,294.98 including VAT, the next row is −571.65 excluding VAT, and the result is 18,985.35 excluding VAT. The rows do not add up as read.
- **Why it matters:** a buyer comparing tabs sees 43.29 on one and 37.97 on another.
- **Fix:**
  - default the VAT toggle to off so 37.97 is the big number, matching the rest of the site
  - put every table row on one basis, ex-VAT: 19,556.99 − 571.65 = 18,985.35, then VAT, then the total
- **Screens:** `ar_ar_pricing.c0.png`, `en_en_pricing.txt`

### R2-09 · The sample price differs between pricing and checkout [new]
- **Page:** `/pricing` and checkout step 1
- **What the shop owner sees:** `/en/pricing` says "Sample order … EGP 998.64, delivery and VAT included, delivered in 4 days". Checkout says «عينة · 5 علب 750.00 ج.م + الضريبة للعينة كاملة», which is 855.00 with VAT and leaves delivery unclear. The sample row is also the only row in checkout without a VAT-inclusive total.
- **Why it matters:** the sample is the low-risk first purchase for a shop owner, and the price changes between pages.
- **Fix:** take both from one source and show «الإجمالي 998.64 ج.م» in the checkout row, like the other rows.
- **Screens:** `f03-after-otp-full.png`, `en_en_pricing.txt`

### R2-10 · Three status names for one order [new]
- **Page:** order page, orders list, account
- **What the shop owner sees:**
  - ELB-26307 is «مدفوع» in the order page chip and «نطبع علبك» in its tracker, while the list and account say «قيد التجهيز للطباعة»
  - the order page says «وصل تصميمك المعتمد إلى المطبعة» right after payment, while `/start` promises «تأكيد المطبعة خلال 24 ساعة من الدفع»
- **Why it matters:** they cannot tell whether printing has started.
- **Fix:** use the 4 tracker stage names (استلمنا طلبك / نطبع علبك / في الطريق إليك / تم التسليم) as the only buyer-facing status, in the chip, list and account. Align the success copy with the 24-hour confirmation promise.
- **Screens:** `f17-after-pay-2-full.c0.png`, `f20-_ar_orders.png`

### R2-11 · The account page is a wall of «تصميم بدون اسم» before the orders [leftover: account was not restyled, R1-18 naming not applied here]
- **Page:** `/ar/account`
- **What the shop owner sees:**
  - «حسابي» opens with «التصميمات المحفوظة»: 14 cards, 9 of them «تصميم بدون اسم», each with «فتح في المصمم / طلب / حذف»
  - the 3 latest orders only appear after scrolling past all of them
  - every visit to the designer silently saved a new design, and the design just ordered is still «تصميم بدون اسم»
- **Why it matters:** a returning buyer comes to see their order, and finds clutter they did not create on purpose.
- **Fix:**
  - put orders first
  - name designs by box and size, as checkout already does («علبة بريدية 25 × 18 × 8 سم»), and «علبة الطلب ELB-…» once ordered
  - show the 3 latest designs with «عرض الكل»
  - do not auto-save untouched designs
- **Screen:** `f21-_ar_account-full.c0.png`

### R2-12 · The "logo too small" warning appears only at checkout [new]
- **Page:** designer → checkout step 2
- **What the shop owner sees:**
  - the designer accepted a 300 px logo with the toast «تمت إضافة الصورة إلى وجه الأعلى» and no warning
  - two screens later, in an amber box at checkout: «صورتك صغيرة، وقد تظهر غير حادة في الطباعة… ارفع صورة أكبر»
  - «رفع صورة أكبر» sends them back to the designer, which loses their checkout place
- **Why it matters:** the most common upload (a logo saved from WhatsApp or Instagram) triggers a late surprise and a loop back.
- **Fix:** show the same sentence as a non-blocking note in the designer, right after upload (in the toast or under «إضافة صورة أخرى»). Keep the checkout tick as the final confirmation.
- **Screens:** `d02-logo.png`, `f11-address-full.c0.png`

### R2-13 · The catalogue has too many choices and looks unfinished [leftover]
- **Page:** `/ar/catalog`, linked from the menu («أنواع العلب») and the footer
- **What the shop owner sees:**
  - «عدد الأنواع: 394», with chips «كرتون مضلع 210», «علب دوبلكس 40»…
  - plain untextured brown and white renders, while `/boxes` shows branded boxes
  - «زجاجات HDPE», «PET»
  - the page title is «كتالوج العبوات: كل الأنواع بتقنية ثلاثية الأبعاد»
- **Why it matters:** 394 options is the opposite of "pick a box". The menu offers both «المنتجات» and «أنواع العلب», so the shop owner can land here instead of `/boxes`.
- **Fix:**
  - remove «أنواع العلب» from the top menu (keep it in the footer)
  - change the title to «كل ما نطبعه»
  - use the branded thumbnails
  - translate HDPE/PET («بلاستيك مقوى», «بلاستيك شفاف»)
- **Screen:** `ar_ar_catalog.c0.png`

### R2-14 · The home hero text sits on top of the moving box on phones [new]
- **Page:** `/ar` first screen, 390 px
- **What the shop owner sees:** the white subtitle «تطبعها بشعارك مطابع مصرية معتمدة…» runs across the box video (the gold-on-black ATTAR box, then the orange NOUR box). Parts of the line are hard to read.
- **Why it matters:** this is the one sentence that says what Elba does, and it sits in the first screen.
- **Fix:** on phones, place the box render under the subtitle, or give the text block a solid or gradient backing.
- **Screen:** `home-hero-8000ms.png`

---

## Low

### R2-15 · One discount, two names, and cash at Fawry gets it too [new]
- **Page:** designer sheet, pricing, payment, order page
- **What the shop owner sees:** the designer says «خصم الدفع الإلكتروني 3%», while pricing and the order page say «خصم الدفع المقدم». On the payment page, «نقدا في فوري» keeps the same 21,643.30.
- **Fix:** one name, «خصم الدفع مقدما 3%», and say it applies to every payment method.
- **Screens:** `d03-pricechip.png`, `f13-payment-step.png`

### R2-16 · The sign-in sheet says "create your free account" to a returning buyer [new]
- **Page:** designer → «طلب هذه العلبة»
- **What the shop owner sees:** the title is «إنشاء حسابك المجاني» for a known number. The footnote promises «يمكنك اختيار تلقي العروض أو رفضها في الخطوة التالية», but no such step appeared.
- **Fix:** use the title «رقم محمولك لإتمام الطلب», and remove or honour the next-step promise.
- **Screens:** `d04-order.png`, `f01-otp.png`

### R2-17 · An order is created before payment, and the payment page's back link leaves checkout [new]
- **Page:** `/ar/checkout/pay/{id}`
- **What the shop owner sees:** the order number appears before payment. «رجوع: الطلبات» leads to the orders list, where earlier abandoned tries show as «بانتظار الدفع» (ELB-26304).
- **Fix:** make the back link return to step 2. Hide unpaid orders older than a day from the list, or label them «لم يكتمل الدفع».
- **Screens:** `f13-payment-step.png`, `f20-_ar_orders.png`

### R2-18 · Latin text left on Arabic pages [leftover]
- **Pages:** home («طلاء UV الموضعي»), the payment form («MM/YY» placeholder), account («ملف JSON»), `/start` («proof.pdf», «elba.eg» in the collage)
- **Fix:** «طلاء لامع موضعي», «شهر/سنة», «ملف بياناتك».
- **Screens:** `txt_ar.txt`, `f15-card-form-full.c0.png`, `f21-_ar_account.txt`

### R2-19 · Checkout step 1 asks for the quantity again [new]
- **Page:** checkout step 1
- **What the shop owner sees:** they already chose 500 in the designer sheet, and step 1 asks «كم علبة تحتاج؟» again (preselected). It costs one tap. The step also offers «خيارات متقدمة: اختيار مطبعة أخرى» with 3 printers.
- **Fix:** when the quantity came from the designer, open on the address step with the quantity shown as an editable summary line.
- **Screen:** `f03-after-otp-full.png`

### R2-20 · The desktop designer header still brands it as a tool [new]
- **Page:** `/en/design` at 1440 px
- **What the shop owner sees:** «Elba · 3D box designer», and four top buttons: Export / Share / Save / Order this box.
- **Fix:** label the page «Your box», and fold Export and Share into the «⋯» menu as the phone layout already does.
- **Screen:** `en_en_design_structure_FEFCO_0427.png`

---

## Tap count, home to paid order (Arabic phone, returning buyer with a saved address)

1. Home «معرفة سعر علبتك»
2. `/boxes` «طلب هذه العلبة»
3. «إضافة الشعار»
4. Pick the file
5. «طلب هذه العلبة»
6. (type phone) «إرسال الرمز»
7. (type code) «التحقق والمتابعة»
8. «المتابعة إلى العنوان»
9. Tick the approval
10. «المتابعة إلى الدفع»
11. Card is preselected; «متابعة»
12. (type card) «دفع 21,643.30 ج.م»

**Total: 12 taps plus 3 typing moments.** A new buyer adds the address form (5 required fields: name, mobile, governorate, area, street). Fixing R2-19 would save one tap.

## Verdict

**Yes, high-severity issues are left.** The order page, receipt and checkout still re-split the 37.97 price (R2-01, R2-02), `/start` shows a stale 39.69 / 10-day mock (R2-03), and `/ar/designer` still sells the tool (R2-04).
