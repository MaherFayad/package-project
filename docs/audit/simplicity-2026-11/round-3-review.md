# Round 3 review: buyer walk as an Egyptian shop owner (2026-11-08)

Review only, no code changes. I walked the site in Arabic on a 390x844 phone (touch), then gave English at 1440x900 a shorter pass, against the dev server on :3000. I did the walk before reading earlier reviews, then skimmed `round-2-fixes.md` to mark leftovers (**[left from R2]**) and regressions.

Covered: home, /boxes, /boxes/mailer-box, the designer (logo by button and by tapping a side of the box in 3D), sign-in for a **new** number and a **returning** one, checkout (quantity, first-time address, approval), payment by **wallet** (paid), **card declined** (4000 0000 0000 0002), **Fawry** (reference issued), card (paid), order page, orders list, account, receipt, /bottles, /start, /pricing, /designer, /catalog, and the header and footer.

Screenshots: `C:\Users\Admin\AppData\Local\Temp\claude\f8173f44571ee159\d92726ee-f788-4602-8df6-7bcebbbfc7a0\scratchpad\round3-review\`. Below, **S\\** stands for that folder. A file named `*.txt` next to each screenshot holds the page text.

What works well: the home hero says "printed boxes with your logo, Egyptian printers, delivered" in the first screen. The designer is now one "Order this box" button. Tapping a box face opens the photo picker on a phone. On desktop, hovering a face lights it with a blue outline and the hint «انقر لإضافة صورة إلى وجه الأعلى». Prices are the same on home, /boxes, the box page, /start, /pricing, the designer strip and checkout for a Cairo delivery: 37.97 per box, 18,985.35 before VAT, 2,657.95 VAT, 21,643.30 total. Changing the governorate updates the total and says so («تم تحديث الإجمالي»). The declined-card message is clear and states that nothing was charged. The Fawry screen shows the reference number, the amount and the deadline. No horizontal scroll and no console errors on any page.

## High

### R3-01: The same box, quantity and address get a different price, printer and delivery date depending on the path
- **Page:** checkout step 1 → order page
- **What the owner sees:** a new buyer orders 500 mailers. The printer is picked while the address is still Cairo (العبور). They then choose أسوان, and the price goes to **38.98** per box, **22,219.46** total, delivered 16 Nov (ELB-26310). The same buyer orders again, and checkout reuses the saved Aswan address. Now it picks a different printer (السادس من أكتوبر): **35.18** per box, **20,052.09** total, delivered **18 Nov** (ELB-26313). That is 2,167 ج.م less for the same order. Through all of this, the designer strip said «37.97 … تصلك خلال 5 أيام» both times.
- **Why it matters:** the first-time buyer pays more because the printer was chosen before their governorate was known. The returning buyer is promised "5 days" and then sees about 11. This breaks "the price you see is the price you pay".
- **Fix:**
  - Pick the printer again (best price and date) whenever the governorate changes.
  - Have the designer strip use the saved governorate, or say «إلى القاهرة الكبرى».
  - Show the delivery date in checkout with a note when it differs from the designer.
- **Screenshots:** S\r1_04_checkout_qty.png, S\r1_02_designer.png, S\card\f1_06_payment.png

### R3-02: Home sells bottle labels with a price, but the labels page says "coming soon"
- **Page:** home «ما نطبعه لك» → /ar/bottles
- **What the owner sees:** a card on home says «ملصقات للزجاجات والبرطمانات والعلب المعدنية … 4.07 ج.م للقطعة عند طلب 500 قطعة». Tapping it opens /ar/bottles, where every item is «قريبا» and the copy says «نضيف الملصقات … حتى ذلك الحين، صمم العلبة».
- **Why it matters:** a shop owner who sells honey or oil comes for labels, sees a price, and then learns they cannot order. That costs trust in every other price on the site.
- **Fix:** take the price off the labels card and mark it «قريبا», or make labels orderable. Do the same check on the «أكياس وأنابيب مطبوعة 7.60» card.
- **Screenshots:** S\v_ar__390_1.png, S\v_ar_bottles_390_0.png

### R3-03: A new buyer is shown the terms checkbox only after their first "Verify" fails
- **Page:** the designer sign-in sheet (new number 0101234000x)
- **What the owner sees:**
  1. They type the phone and the code, then tap «التحقق والمتابعة».
  2. The request fails with a 400. The sheet then grows: a green box «لإنشاء حساب، يلزم الموافقة على شروط الخدمة…», a name field, a required terms checkbox and a marketing checkbox.
  3. The verify button is now below the fold, so they scroll, tick the box and tap Verify again.
- **Why it matters:** the very first purchase hits what looks like an error, and it costs 2 to 3 extra taps at the most fragile moment.
- **Fix:** request-otp already knows whether the number is new, so return `isNew` there. Show the terms line (and the optional name) together with the code field, and keep the button in view.
- **Screenshot:** S\fawry\f1_03_after_otp.png

## Medium

### R3-04: Phone numbers are shown backwards in Arabic text
- **Page:** the sign-in sheet
- **What the owner sees:** «مثل 5678 1234 010» in the hint, and «المرسل إلى 0001 1234 010» after the code is sent. The digit groups are in reverse order.
- **Why it matters:** the owner reads their own number wrong and wonders whether the code went to the right phone.
- **Fix:** wrap the numbers in `<bdi dir="ltr">` or use ⁦…⁩ isolates, as the sizes already do.
- **Screenshots:** S\fawry\f1_01_order_click.png, S\fawry\f1_03_after_otp.png

### R3-05: The "small logo" toast covers the sign-in sheet
- **Page:** designer → «طلب هذه العلبة»
- **What the owner sees:** the toast about the low-resolution logo stays on screen and sits over the sign-in sheet's privacy line and the space below «إرسال الرمز».
- **Why it matters:** the screen looks cluttered, and the owner can mistake the toast for an error during sign-in.
- **Fix:** dismiss toasts when a sheet opens, or auto-hide this toast after about 5 seconds.
- **Screenshot:** S\fawry\f1_01_order_click.png

### R3-06: The box page and /pricing still use printer jargon and mm
- **Pages:** /ar/boxes/mailer-box («الأسعار تبدأ من»), /ar/pricing hero, the receipt line
- **What the owner sees:**
  - «بمقاس 250 × 180 × 80 مم: … كرتون مضلع E كرافت». The same page shows cm everywhere else (25 × 18 × 8 سم).
  - In the /pricing hero, the size wraps into the wrong order: «علبة بريدية 180 × 250 / 80 × مم».
- **Why it matters:** "E" and mm read as printer talk, and a scrambled size looks like a mistake.
- **Fix:** use cm and the plain material name («كرتون بني طبيعي») in `priceIntro`, the pricing hero and the receipt description. Isolate the size string. **[left from R2]**
- **Screenshots:** S\v_ar_pricing_390_0.png, S\ar_boxes_mailer_box_390.txt, S\r1_10_*invoice.txt

### R3-07: /start still sells the tool, with Latin text on the Arabic page
- **Page:** /ar/start
- **What the owner sees:**
  - «370 نموذجا في المكتبة», «معاينة المصمم», «طلاء UV موضعي» (twice).
  - The mock file names «proof.pdf» and «elba.eg/s/…».
  - A counter block «نموذج علبة وعبوة 370 · تشطيب 11 · مطبعة 6».
  - A phone field «رقم المحمول (اختياري)» whose button is «معرفة سعر علبتك», which suggests you need to give your number to see a price.
- **Why it matters:** this is the ad landing page, and it leads with the 3D library instead of "we print and deliver". R2-18 fixed «UV» everywhere except here.
- **Fix:** take out the 370 and 11 counts and the Latin file names, and change «UV» to «طلاء لامع موضعي». Drop the phone field, or label it «إرسال رابط التصميم لي» and keep it apart from the price CTA. **[left from R2]**
- **Screenshots:** S\ar_start_390.png, S\ar_start_390.txt

### R3-08: The key price line in the designer is 13px
- **Page:** designer (phone)
- **What the owner sees:**
  - The only price on screen, «500 علبة: 37.97 ج.م للعلبة شامل التوصيل، دون الضريبة · تصلك خلال 5 أيام», is a 13px two-line pill.
  - The tool labels (تحريك، تدوير، ملء الجهة، قص، طي) are 12px.
  - The phone hint chip says «انقر على أي وجه» ("click"), while the panel says «المس».
- **Why it matters:** the price is the reason they opened the designer, and 13px is hard to read on a phone in sunlight.
- **Fix:** make the pill 16px with the price in bold, use the verb «المس» on touch devices, and set tool labels to at least 14px.
- **Screenshot:** S\d2_hover.png

### R3-09: The /pricing VAT switch reads as a fact, not a choice
- **Page:** /ar/pricing
- **What the owner sees:** next to the switch, «الأسعار شاملة ضريبة القيمة المضافة 14%». The big number right below it is «79.57 ج.م للعلبة بدون الضريبة».
- **Why it matters:** the label says "prices include VAT" while the number says "without VAT". The owner cannot tell which one is true.
- **Fix:** label the switch as a choice, «عرض الأسعار شاملة الضريبة», or use two segments «بدون الضريبة | شاملة الضريبة».
- **Screenshot:** S\v_ar_pricing_390_0.png

### R3-10: Payment takes an extra tap, and the wallet number is not prefilled
- **Page:** /checkout/pay
- **What the owner sees:** they pick a method, tap «متابعة», and only then get the form. For a wallet, the «رقم المحفظة» field is empty even though most wallets use the phone they just verified. The card form also shows «لا نرى رقم بطاقتك» when paying by wallet, and an «MM/YY» placeholder in English **[left from R2]**.
- **Why it matters:** one more screen and more typing at the payment step.
- **Fix:** open the form inline under the selected radio. Prefill the wallet number with the account phone. Use «شهر/سنة» as the placeholder.
- **Screenshots:** S\fawry\f1_06_payment.png, S\card\f1_10_after_pay.png

### R3-11: Status says «نطبع علبك» right after payment
- **Page:** order page, orders list, account
- **What the owner sees:** the chip and tracker say «نطبع علبك» (the current step) a few seconds after paying. The text underneath says the printer will confirm within 24 hours.
- **Why it matters:** this is a small overpromise. If the printer declines, the buyer has been told printing already started.
- **Fix:** keep «استلمنا طلبك» as the current step until the printer accepts, then move to «نطبع علبك». **[left from R2]**
- **Screenshot:** S\r1_07_paid.png

### R3-12: Shown totals don't equal quantity × shown per-box price
- **Page:** box page table, /start, /pricing, order page, receipt
- **What the owner sees:**
  - 100 × 79.57 = 7,957.00, but the page shows 7,956.81.
  - 500 × 35.18 = 17,590.00, but the order page shows 17,589.55.
- **Why it matters:** a shop owner checks with a calculator, and the numbers never match.
- **Fix:** price per box in whole piasters and compute the line as qty × the rounded unit price, or show the unit to 3 decimals only where it is explained. **[left from R2]**
- **Screenshots:** S\ar_boxes_mailer_box_390.txt, S\r1_07_paid.txt

## Low

### R3-13: The catalogue is still a printer's catalogue
- **Page:** /ar/catalog, /en/catalog, /en/boxes
- **What the owner sees:**
  - 394 models, with chips «كرتون مضلع 210», «صناديق بالتات 2» and 11px badges.
  - In English, group names «Slotted boxes (FEFCO 02)» and descriptions «(FEFCO 0320)», «FEFCO 0426 style», «roll-end tuck-front» on /en/boxes and the box page.
- **Why it matters:** this is jargon on the main box list in English.
- **Fix:** remove FEFCO codes from buyer copy in English, as was done in Arabic. In the catalogue, show the 13 boxes first and keep the families behind «عرض كل الأنواع». **[left from R2]**
- **Screenshots:** S\ar_catalog_390.png, S\v_en_boxes_mailer_box_1440_0.png

### R3-14: The name is asked three times and never saved to the profile
- **Page:** sign-up sheet (optional name), the address form («الاسم الكامل *»), account
- **What the owner sees:** after typing a name in the address form, the account still says «مرحبا … أضف اسمك في الملف الشخصي».
- **Fix:** copy the first address name into an empty profile name. Drop the optional name from the sign-up sheet.
- **Screenshot:** S\r1_09__ar_account.png

### R3-15: The payment page summary repeats lines, and the back link leaves checkout
- **Page:** /checkout/pay
- **What the owner sees:** «500 علبة» is printed twice in a row in «طلبك». The back arrow says «رجوع: الطلبات», which leaves checkout for the orders list instead of going back to the address step **[left from R2, R2-17]**.
- **Screenshot:** S\fawry\f1_08_pay_FAWRY_next.png

### R3-16: Fawry doesn't say what happens to the delivery date
- **Page:** Fawry reference screen
- **What the owner sees:** «ادفع قبل 09/11/2026، 11:23 م», but the delivery date checkout promised («عند الدفع اليوم») is not repeated, and nothing says it moves if they pay tomorrow.
- **Fix:** add one line: «تصلك تقريبا يوم … إذا دفعت اليوم».
- **Screenshot:** S\fawry\f1_08_pay_FAWRY_next.png

### R3-17: Vendor radio rows have empty links
- **Page:** checkout step 1 («خيارات متقدمة: اختيار مطبعة أخرى»)
- **What the owner sees:** each printer row has an `<a>` with no text or label. Screen readers announce it as "link".
- **Fix:** give it an `aria-label` («صفحة المطبعة …») or remove it.
- **Screenshot:** S\fawry\f1_04_after_terms.txt

## Tap count, home → paid order (Arabic phone, 500 mailers, card)

- **Returning buyer (address saved): 14 taps + 5 typed fields** (phone, code, card number, expiry, CVC). The taps:
  1. Cookie banner.
  2. Hero CTA.
  3. «طلب هذه العلبة» on /boxes.
  4. «إضافة الشعار».
  5–6. The photo picker (about 2 taps).
  7. «طلب هذه العلبة» in the designer.
  8. «إرسال الرمز».
  9. Verify.
  10. «المتابعة إلى العنوان».
  11. Approve the design.
  12. «المتابعة إلى الدفع».
  13. «متابعة» on the payment method.
  14. Pay.
- **New buyer: 18 taps + 8 typed fields.** On top of the returning path, they need:
  - the failed Verify, the terms tick and Verify again (R3-03);
  - the governorate select (2 taps);
  - three more typed fields: name, city or district, and street.

## Verdict

Yes, 3 high-severity issues remain: the price, printer and date change with the path (R3-01), the labels card is priced but not orderable (R3-02), and the terms checkbox appears only after a failed verify (R3-03).

## Not tested

- InstaPay.
- Fawry completion with «محاكاة الدفع».
- A wallet decline.
- Shipping tracking (no shipped order).
- Reorder.
- The English checkout.
- The real tap-to-face glow on a physical phone (touch has no hover; tapping does open the picker).

## Test data left

- Users +2010123400**01** to **08** (dev DB).
- Orders: ELB-26310 (paid, wallet) and ELB-26313 (paid, card); ELB-26311 (card declined, unpaid); ELB-26312 (Fawry, pending); ELB-26308 and ELB-26309 (unpaid).
- Several saved mailer designs.
