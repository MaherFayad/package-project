# Round 1 review: the buyer journey as an Egyptian shop owner (2026-11-07)

Reviewer: fresh agent, no transcript. Walked as a bakery or perfume-shop owner, Arabic, phone 390x844 (Playwright Chromium, touch), then English desktop 1440x900. Full path: `/ar` → what we print → `/ar/start` → `/ar/catalog` → `/ar/boxes` → `/ar/boxes/mailer-box` → `/ar/design/mailer-box` (logo uploaded) → sign-in (session row for buyer +201000000002, منى عادل) → `/ar/checkout/<designId>` → mock card payment → `/ar/orders/<id>?paid=1`. Order created: ELB-26305.

Screenshots: `C:\Users\Admin\AppData\Local\Temp\claude\f8173f44571ee159\d92726ee-f788-4602-8df6-7bcebbbfc7a0\scratchpad\round1\` (written as `round1\<file>` below). Prefixes: `m_` phone marketing, `d_`/`e_` designer, `f_`/`g_`/`h_` checkout and payment, `o_` order, `D_` English desktop.

## Verdict

1. The home hero now sells the right thing: «علب مطبوعة بشعار مشروعك», vetted Egyptian printers, delivery, and a price before you pay. Its first screen passes the 5-second test.
2. After the hero, the funnel falls back to selling the tool. «معرفة سعر علبتك» opens another long landing page (`/start`). Every product button says «التصميم مجانا». The designer then hides the price until the buyer gives a phone number.
3. Price and delivery figures contradict each other. Across the funnel the same 500-box order shows four different per-box prices (39.69 / 38.53 / 32.69 / "from 20.88") and two totals (22,625.58 vs 21,963.98). Delivery is given as 5 days in one place and 10 in another. The minimum order is 50 in one place and 100 in another. The "no die cost for standard sizes" promise is broken in the actual order.
4. The core mechanics work well and look good: logo upload, 3D, address prefill, mock payment and order tracking. No console errors, no hydration warnings and no broken internal links.
5. The remaining barriers are print-trade jargon (FEFCO/ECMA codes, «فورمة التكسير», DPI, «البصمة» as a file hash) and pages that are too long, especially `/ar/start` (broken hero on phones) and the 11,200 px home page.

**Counts: 6 high, 9 medium, 6 low.**

---

## High

### R1-01: The designer hides the price behind phone sign-up
- **Page:** designer, `/ar/design/mailer-box` (signed out)
- **What is wrong:** The price badge reads «500 علبة: اعرف السعر» with a lock icon. Tapping it opens «إنشاء حسابك المجاني … اعرف السعر الفوري لتصميمك برقم محمولك». Yet the home page, `/ar/boxes` and `/ar/boxes/mailer-box` all show the per-box price for the same box openly (39.69 ج.م for 500). The FAQ also says the exact price needs an account.
- **Why it matters:** The site's main promise is «اعرف سعرها بالضبط قبل الدفع». A shop owner who just put their logo on a box and then gets asked for a phone number to see the price feels baited. Public pages already reveal the number, so the gate protects nothing.
- **Fix:** Show the live price in the designer badge without an account. Ask for the phone number only at «طلب هذه العلبة», saving the design at the same time, or when they choose save or share. Change the FAQ answer and `gateReason` to match.
- **Files:** `src/components/designer/Modals.tsx:79` (badgeLocked); `src/i18n/designer.ar.ts:302,327-329,396`; `src/i18n/ar.ts:66,315`; `src/i18n/marketing.ar.ts:50`
- **Screenshots:** `round1\d_editor0.png`, `round1\d_pricepill.png`

### R1-02: One order, four per-box prices and two totals
- **Pages:** home `/ar` (pricing card), `/ar/boxes/mailer-box`, designer badge and price sheet, checkout `/ar/checkout/<id>`, order `/ar/orders/<id>`
- **What is wrong:** The same 500 natural-brown mailers, 250×180×80, show different numbers at each step:
  - home, box page and designer: 39.69 ج.م/box, total 22,625.58 incl. VAT («شامل التجهيز والتوصيل»);
  - checkout quantity card: 38.53 ج.م/box, total 21,963.98, after a 3% prepay discount that is first mentioned in small print in the designer sheet;
  - checkout summary: «500 علبة 18,764.65» plus a separate «التوصيل 502», even though delivery was described as included;
  - order page: «500 × 32.69 = 16,345», with «التجهيز 750» and «فورمة التكسير 2,250» added only inside the collapsed «تفاصيل السعر».
- **Why it matters:** For a small business owner spending 20,000+ EGP, numbers that keep moving read as hidden fees, even when the final total is lower. Trust breaks at the payment step.
- **Fix:** Pick one buyer-facing model, "price per box, all-in (print + setup + delivery), before VAT", and use it everywhere. Show that same per-box number in the designer, checkout and order. Apply the 3% prepay discount as one visible line ("خصم الدفع الكامل −580 ج.م") on every page, the designer included, or fold it into the price. Never re-split the unit price after payment. Keep the setup and die cost inside "per box" on the order page too, or list it at checkout as well.
- **Files:** `src/app/[locale]/(checkout)/checkout/_components/CheckoutClient.tsx`, `src/app/[locale]/orders/[id]/page.tsx`, `src/lib/orders/totals` (whichever builds the display lines), `src/components/marketing/home/copy.ts:204,210`, `src/i18n/designer.ar.ts:321`
- **Screenshots:** `round1\m_ar_3.png`, `round1\e_ed_price.png`, `round1\f_01_afterorder.png`, `round1\o_ar_orders_cmw6szd260037sg4caxdi5m5s_pai.png`

### R1-03: The "no die cost for standard sizes" promise is false in practice
- **Pages:** `/ar/pricing` («بدون تكلفة فورمة التكسير للمقاس القياسي»), `/ar/boxes/mailer-box` («المقاسات القياسية لها فورمة تكسير جاهزة… تكلفتها أقل», which lists 250×180×80 «طقم مستحضرات» as a common size), and the actual order.
- **What is wrong:** I ordered the designer's default mailer at exactly 250×180×80. The order breakdown charges «فورمة التكسير 2,250.00 ج.م». In the code, every designer quote passes `input.model`, and `engine.ts` then hard-codes `standardSize = false`. As a result every designer order pays the die cost, whatever its size.
- **Why it matters:** This is an untrue price promise on the pricing page, roughly 4.50 EGP per box at 500. A buyer who reads the receipt line by line will find it.
- **Fix:** Either honour standard dies for library models that map to a standard structure (vendor has a die within tolerance), or remove the claim from the pricing page, the box pages and "مقاسات شائعة". Do not keep both. Add a test that the advertised standard sizes quote without a die.
- **Files:** `src/lib/pricing/engine.ts:178-181`; `src/components/marketing/why/copy.ts:105,143`; box-page common sizes copy in `src/i18n/ar.ts` (boxes section)
- **Screenshots:** `round1\m_ar_pricing_0.png`, `round1\m_ar_boxes_mailer_box_1.png`, `round1\o_order_price.png`

### R1-04: «معرفة سعر علبتك» leads to another landing page, not a price
- **Page:** home `/ar` hero, final CTA and header «معرفة السعر» → `/ar/start`
- **What is wrong:** All five "get your price" links on the home page go to `/ar/start`, an 8,900 px marketing page. Its own button says «بدء التصميم مجانا». The buyer has to scroll, open the designer, pick a box and then sign in (R1-01) before seeing a price for their box. On `/ar/boxes` the same header slot is labelled «البدء مجانا».
- **Why it matters:** The main button breaks its promise on the first click. Every extra page between "how much?" and an answer loses phone users.
- **Fix:** Point «معرفة سعر علبتك» at a page that answers it immediately. Options: the box-type picker `/ar/boxes` with prices on every card, or a 2-question chooser (what do you sell → how many) that ends on a price table and an «اطلب/صمم» button. Retire `/start` as a hop in the main path, or make it that chooser.
- **Files:** `src/components/marketing/home/copy.ts` (hero/final CTA hrefs), `src/components/marketing/home/HomeHero.tsx`, `src/components/marketing/MarketingHeader.tsx:35-51`, `src/i18n/kit.ar.ts:14,84`, `src/i18n/marketing.ar.ts:21`
- **Screenshots:** `round1\m_ar_0.png`, `round1\m_ar_start_0.png`

### R1-05: Every product button sells the free tool, not the printed box
- **Pages:** `/ar/boxes` (every card: «التصميم مجانا»), `/ar/boxes/mailer-box` (hero «التصميم مجانا» + sidebar «التصميم مجانا … لا يلزم حساب للتصميم والمعاينة»), `/ar/start` («بدء التصميم مجانا», «فتح المصمم»), header for signed-in users and order page («تصميم جديد»), `/ar/pricing` wholesale («التصميم وطلب عرض سعر»)
- **What is wrong:** Elba sells printed boxes, but there is no «اطلب هذه العلبة مطبوعة» or «اطبع علبتك» call anywhere on the product pages. The verb is always "design". The English desktop is the same: "Design it free" next to a price table.
- **Why it matters:** The owner wants the 3D tool as the hook, not the product. A bakery owner does not want to "design". They want 500 boxes with their logo. "Free design" also suggests the paid part is the catch.
- **Fix:** Make the primary button «اطبع هذه العلبة بشعارك» or «اطلب هذه العلبة», going to the designer with the logo step first and the price visible. Demote "free 3D preview" to helper copy under the button («شاهدها ثلاثية الأبعاد قبل الدفع، مجانا»). In the signed-in header use «طلب جديد» instead of «تصميم جديد».
- **Files:** `src/i18n/ar.ts:112,365,409`, `src/i18n/marketing.ar.ts:21-22,49`, `src/components/marketing/BoxesLanding.tsx`, `src/components/marketing/start/copy.ts`
- **Screenshots:** `round1\m_ar_boxes_0.png`, `round1\m_ar_boxes_mailer_box_0.png`, `round1\m_ar_boxes_mailer_box_2.png`, `round1\D_en_boxes_mailer_box_0.png`

### R1-06: `/ar/start` is visually broken on phones and contradicts the home page
- **Page:** `/ar/start` (390x844)
- **What is wrong:**
  - The hero title «ابدأ اليوم» is split in two by the image collage, with «ابدأ» at the top and «اليوم» 300 px lower. The ATTAR bottle sits on top of the letters of «ابدأ».
  - The "اختر علبتك" section is a scroll-jacked phone mock-up 2,275 px tall (about 2.7 screens of scrolling past one picture). Earlier the screen is black while it animates.
  - On the price card, the floating «تأكيد المطبعة / خلال 24 ساعة من الدفع» chip covers the «ملخص الطلب» heading.
  - The stats say «11 تشطيب للطباعة», but the home page says «8 تشطيبات».
  - The page sells "sample first", "dieline.pdf" and "share link" features that a first-time buyer does not need.
- **Why it matters:** This is the page every "get a price" button lands on (R1-04). It is the first impression after the hero, and it looks broken.
- **Fix:** If the page stays, keep the title on one line above the collage on phones and cut the scroll-jacked section to one static screenshot. Anchor the chip outside the card heading. Use the same finish count everywhere: derive it from one constant. Better: remove `/start` from the main path (see R1-04).
- **Files:** `src/app/[locale]/(store)/start/page.tsx`, `src/components/marketing/start/start.module.css` (`.heroTitle`, `.collage`, phone block at line 275+), `src/components/marketing/start/copy.ts:55,76`
- **Screenshots:** `round1\m_ar_start_0.png`, `round1\m_ar_start_1.png`, `round1\m_ar_start_2.png`, `round1\start_scroll_1500.png`, `round1\D_en_start.png`

---

## Medium

### R1-07: Delivery time contradicts itself (5 vs 10 days)
- **Pages:** `/ar/pricing` (every tier «التسليم خلال 5 أيام»), home («10 أيام للتسليم في القاهرة الكبرى», «تصل 500 علبة بريدية… خلال 10 أيام»), `/ar/boxes/mailer-box` (10 days in the table, while the printer list says 4, 6, 8 or 10 days), checkout («تصلك تقريبا يوم الثلاثاء 17 نوفمبر» = 10 days)
- **Why it matters:** A shop owner plans around a launch or Ramadan. Two different promises means they believe neither.
- **Fix:** Use one delivery promise per box, from the same quote source as checkout, and phrase it as a date («تصلك حوالي ١٧ نوفمبر لو طلبت اليوم») on the pricing page as well. Hide per-printer lead times on buyer pages (see R1-13).
- **Files:** `src/components/marketing/why/pricing-facts.ts:62-156`, `src/components/marketing/why/copy.ts`, `src/i18n/ar.ts` (`vendorsTitle` block ~411)
- **Screenshots:** `round1\m_ar_pricing_0.png`, `round1\m_ar_3.png`, `round1\m_ar_boxes_mailer_box_2.png`

### R1-08: Minimum order and "starting from" prices mislead
- **Page:** `/ar` («50 علبة كحد أدنى للطلب»; "what we print": «ابتداء من 20.88 ج.م للقطعة»)
- **What is wrong:** Checkout and the mailer page start at 100 boxes (or a 5-box sample), not 50. The «ابتداء من» prices are the 2,000-box price, which is disclosed only in a 12-13 px grey footnote. A shop owner who wants 200 boxes will pay about 60-90 ج.م, not 20.
- **Why it matters:** The first price a buyer sees is roughly 4x cheaper than what they will actually pay. That is the biggest trust leak on the home page.
- **Fix:** Show the price at a realistic quantity on cards («500 علبة: 39.69 ج.م للعلبة»), or show a range («من 20 إلى 97 ج.م حسب الكمية»). Take the minimum stat from the same source as checkout (100), or drop it.
- **Files:** `src/components/marketing/home/copy.ts:171,205`, `src/i18n/marketing.ar.ts:93`
- **Screenshots:** `round1\m_ar_0.png`, `round1\m_ar_1.png`, `round1\m_ar_3.png`

### R1-09: The catalogue is a database, not a shop
- **Page:** `/ar/catalog` (and the picker on `/ar/design`)
- **What is wrong:**
  - Four counters (410 نموذج / 370 في المصمم / 394 متاح في مصر / 308 بسعر فوري).
  - A «متاح في مصر / عالميا» toggle that is irrelevant to an Egyptian shop.
  - Groups by board type («كرتون مضلع 210», «علب دوبلكس 40»), not by what the buyer sells.
  - Plain grey untextured models with no price.
  - Counts disagree with the designer picker («الكل 355», «علب كرتون مضلع 114» vs 210) and with home and start («370 نموذجا»).
  - The home button «عرض أنواع العلب» goes here and not to the curated 13-type `/ar/boxes`.
- **Why it matters:** A perfume-shop owner sees hundreds of grey shapes with codes. Choice overload, and nothing points to "your" box.
- **Fix:** Send «عرض أنواع العلب» to `/ar/boxes`. In the catalogue, group by use (حلويات ومخابز، عطور ومستحضرات، ملابس وأونلاين، أكل). Show a branded thumbnail and «من X ج.م لـ500» per card. Hide «عالميا» and the stat block, or move them to an "advanced" link. Use one model count across the site.
- **Files:** `src/components/catalogue/copy.ts:20-40`, `src/app/[locale]/(store)/catalog/(list)/page.tsx`, `src/components/designer/ModelPicker.tsx:123`, home "what we print" link in `src/components/marketing/home/copy.ts`
- **Screenshots:** `round1\m_ar_catalog_0.png`, `round1\m_ar_catalog_1.png`, `round1\d_picker.png`

### R1-10: Print-trade jargon on buyer screens
- **Pages:**
  - `/ar/boxes`, `/ar/boxes/mailer-box`: «FEFCO 0427», «ECMA A20.20.03.01», «بتموج E أو B», «كرتون مضلع E كرافت 380 جم، سمك 1.5 مم», «فورمة تكسير».
  - Designer picker: every card carries a FEFCO/ECMA code.
  - Home pricing card: «التجهيز وفورمة التكسير».
  - `/ar/start`: «dieline.pdf».
  - Designer «كل الخيارات»: «القالب», «الفحص», «رمز اللون», «تنزيل قالب العلبة (SVG)», «تقديم للأمام».
- **Why it matters:** None of these words mean anything to a bakery owner. They add reading load and make the product feel like it is for printers.
- **Fix:** Hide standard codes from Arabic buyer pages; keep them in a collapsed «للمطابع والمصممين» spec block. Rename: «فورمة التكسير» → «قالب القص (مرة واحدة)», «E/B» → «كرتون رفيع / كرتون سميك للشحن», «القالب» tab → «العلبة مفرودة». Drop dieline/SVG from marketing.
- **Files:** `src/components/marketing/BoxesLanding.tsx`, `src/i18n/ar.ts` (boxes section), `src/components/designer/ModelPicker.tsx`, `src/components/marketing/home/copy.ts:210`, `src/components/marketing/start/copy.ts`, `src/i18n/designer.ar.ts`
- **Screenshots:** `round1\m_ar_boxes_0.png`, `round1\m_ar_boxes_mailer_box_1.png`, `round1\e_ed_all.png`

### R1-11: The checkout approval step is confusing and alarming
- **Page:** checkout step 2, `/ar/checkout/<designId>` («العنوان والموافقة»)
- **What is wrong:**
  - A red «مشكلة: دقة الصورة منخفضة للطباعة (أقل من 300 نقطة في البوصة). (الأعلى)» box appears.
  - The buyer must tick «الطباعة كما هي» (a blocking checkbox) and then a second checkbox «راجعت التصميم، وأوافق على طباعته كما هو».
  - Tapping «المتابعة إلى الدفع» first shows a red error under the first checkbox. The buyer is not told how big their logo should be, and «(الأعلى)» is cryptic.
  - The order activity log later records «الموافقة على البروفة مع مشكلات فحص الطباعة».
- **Why it matters:** "Problem", "300 dots per inch" and two legal-style checkboxes right before paying 22,000 EGP make the buyer stop or phone someone. Many logos on WhatsApp are small PNGs, so this will fire often.
- **Fix:** Say it plainly: «شعارك صغير، وقد يظهر غير حاد في الطباعة على الغطاء. ارفع صورة أكبر (عرض 1000 بكسل على الأقل)، أو اطبعه كما هو». Offer two buttons («رفع صورة أكبر» / «اطبعه كما هو») instead of a checkbox. Merge it with the single approval checkbox. Show it as a warning (amber), not as «مشكلة». Raise it first in the designer, when the logo is placed.
- **Files:** `src/i18n/ar.ts:222` (LOW_DPI), `src/i18n/checkout.ar.ts:149,494-496`, `src/app/[locale]/(checkout)/checkout/_components/CheckoutClient.tsx`, `src/components/designer/lib/preflight.ts`
- **Screenshots:** `round1\g_13_step2_nocheck.png`, `round1\g_13_step2.png`

### R1-12: The home page is 11,200 px tall on a phone
- **Page:** `/ar` (390 wide, about 13 screens)
- **What is wrong:** The home page has 10 sections:
  - hero;
  - what we print;
  - how to order (5 cards);
  - a 370-model marquee;
  - finishes;
  - a stats-and-price card;
  - 6 trust cards;
  - the 3D preview;
  - an 8-question FAQ;
  - a final CTA.

  "Price" is explained 3 times, the steps twice, and «370 نموذجا» twice.
- **Why it matters:** Phone users read about 3 screens. Everything after "how to order" is mostly repetition, and the trust cards that matter (reprint or refund, proof before print) are on screen 8.
- **Fix:** Cut to hero → what we print (with realistic prices) → how it works (3 steps) → guarantee (reprint or refund, proof, secure pay, in one block) → FAQ (4) → CTA. Drop the model marquee and the stats block. Merge the finishes section into the product cards.
- **Files:** `src/app/[locale]/(store)/page.tsx`, `src/components/marketing/home/copy.ts`
- **Screenshots:** `round1\m_ar_1.png`, `round1\m_ar_2.png`, `round1\m_ar_3.png`, `round1\m_ar_4.png`

### R1-13: The buyer is asked to deal with printers
- **Pages:**
  - checkout step 1 («تطبعها نايل باك… تغيير المطبعة»);
  - designer price sheet («التنفيذ لدى نايل باك», «المطابع المتاحة للتنفيذ: 3»);
  - `/ar/boxes/mailer-box» («مطابع تنفذ هذه العلبة 4», each with its own lead time);
  - order page («4.7 (128) · جديد على علبة»).
- **What is wrong:** The message is "one seller, Elba, guarantees it", but the buyer is shown a printer choice and per-printer timings. The printer count differs between pages (3 vs 4). The rating line contradicts itself: 128 reviews, yet "new on Elba".
- **Why it matters:** It adds a decision the buyer cannot make well, it weakens "Elba is responsible", and the contradictory rating looks fake.
- **Fix:** Show «تطبعها مطبعة معتمدة من علبة في السادس من أكتوبر» without a change link by default; keep «تغيير المطبعة» behind "خيارات متقدمة" or remove it for buyers. Remove the printer list from box pages, or move it under «من يطبع لنا». Show either the rating or «جديد على علبة», never both.
- **Files:** `src/i18n/checkout.ar.ts:617`, `src/app/[locale]/(checkout)/checkout/_components/CheckoutClient.tsx`, `src/app/[locale]/orders/[id]/page.tsx`, `src/i18n/ar.ts:411,484`
- **Screenshots:** `round1\f_01_afterorder.png`, `round1\e_ed_price.png`, `round1\m_ar_boxes_mailer_box_2.png`, `round1\o_ar_orders_cmw6szd260037sg4caxdi5m5s_pai.png`

### R1-14: The order page shows production internals
- **Page:** `/ar/orders/<id>`
- **What is wrong:**
  - Buyer download links «ملف الطباعة PDF» and «ملف البروفة PDF».
  - «تفاصيل العلبة» shows «الإصدار 1» and «البصمة 394709433bb9e0f8…», a file hash. «البصمة» is also the Arabic word for foil stamping, a finish sold on the same site.
  - The activity log reads «الموافقة على البروفة مع مشكلات فحص الطباعة».
- **Why it matters:** "Print file" and a hex code are noise. Calling a hash «البصمة» will make buyers think they ordered foil.
- **Fix:** Keep one «معاينة علبتك (PDF)» link. Hide the hash and version from buyers (keep them in admin/vendor). Reword the log line to «وافقت على التصميم».
- **Files:** `src/i18n/checkout.ar.ts:270,293`, `src/app/[locale]/orders/[id]/page.tsx`
- **Screenshots:** `round1\o_ar_orders_cmw6szd260037sg4caxdi5m5s_pai.png`, `round1\o_order_price.png`

### R1-15: The pricing page cannot be compared with the rest of the site
- **Page:** `/ar/pricing`
- **What is wrong:**
  - SaaS-style plan names («تجربة / انطلاق / توسع / جملة») for what is just a quantity.
  - A different reference box (300×220×60) from the home page and the box page (250×180×80).
  - Prices shown incl. VAT and after the 3% prepay discount (41.99 for 500), while every other page shows prices before VAT and before the discount (39.69).
  - "PDF proof" listed as a plan feature.
- **Why it matters:** The buyer cannot reconcile 41.99 with 39.69. "Plans" suggest a subscription.
- **Fix:** Use the same reference box and the same price basis as the home page. Show a plain quantity table (100 / 250 / 500 / 1,000 / 2,000) and drop the tier names and features.
- **Files:** `src/app/[locale]/(store)/(why)/pricing/page.tsx`, `src/components/marketing/why/copy.ts`, `src/components/marketing/why/pricing-facts.ts`, `src/components/marketing/why/VatToggle.tsx`
- **Screenshots:** `round1\m_ar_pricing_0.png`, `round1\m_ar_pricing_1.png`

---

## Low

### R1-16: The cookie notice sticks out 16 px past the left edge on phones
- **Pages:** all pages at 390 px (seen on `/ar`, checkout, pay, order)
- **What is wrong:** The measured notice box spans `left: -16px; right: 374px`. The «حسنا» button touches the screen edge and the card's left border is cut off. Its text is 13 px.
- **Fix:** In the `max-width: 489px` block, set `inset-inline-start: 0; inset-inline-end: 0; inline-size: auto;` (the base `inset-inline-start` plus `inline-size: 100%` still win in RTL), and use 14 px text.
- **Files:** `src/components/ui/CookieNotice.module.css:2-9,64-78`
- **Screenshots:** `round1\h_21_mockpay.png`, `round1\o_order_top.png`

### R1-17: The step arrows point up on phones in Arabic
- **Page:** `/ar/start`, closing block «هل تريد طباعة علبك؟» (التصميم مجانا ↑ الموافقة على البروفة ↑ الطباعة والتسليم)
- **What is wrong:** `.flip:dir(rtl) { scaleX(-1) }` combined with the phone rule `.steps svg { rotate: 90deg }` makes the arrows point up, against the reading order.
- **Fix:** On phones use `ArrowDown` (no flip), or `rotate: -90deg` under `:dir(rtl)`.
- **Files:** `src/components/marketing/start/start.module.css:19-20,288-290`, `src/app/[locale]/(store)/start/page.tsx:457-460`
- **Screenshot:** `round1\m_ar_start_4.png`

### R1-18: Checkout calls the box «علبة بدون اسم» and never shows it
- **Page:** checkout step 1 and order summary
- **What is wrong:** The page title is «إتمام الطلب / علبة بدون اسم», and the summary says «علبة بدون اسم · علبة بريدية». Step 1 and the summary have no thumbnail of the buyer's box with their logo; it appears only in step 2.
- **Fix:** Default the name to the box type plus the business name («علبة بريدية – Bloom Candles»). Add a small 3D or PNG thumbnail of the designed box to the summary card on all three steps.
- **Files:** `src/i18n/checkout.ar.ts:11`, `src/i18n/designer.ar.ts:11`, `src/app/[locale]/(checkout)/checkout/_components/CheckoutClient.tsx`
- **Screenshots:** `round1\f_01_afterorder.png`, `round1\D_en_checkout_cmw6swyeh002ysg4cd37z12jl.png`

### R1-19: The header button changes label from page to page
- **Pages:** «معرفة السعر» on home, start, catalogue and pricing; «البدء مجانا» on `/ar/boxes`; «تصميم جديد» when signed in and on order pages; «بدء التصميم» on the design picker
- **Fix:** Use one label and one destination everywhere («اطلب علبتك» or «معرفة السعر», see R1-04 and R1-05).
- **Files:** `src/components/marketing/MarketingHeader.tsx:35-51`, `src/i18n/kit.ar.ts:14,84`, `src/i18n/marketing.ar.ts:21-22`
- **Screenshots:** `round1\m_ar_0.png`, `round1\m_ar_boxes_0.png`, `round1\o_order_top.png`

### R1-20: Small text where money and dates are shown
- **Pages:** checkout, order, orders list, account, designer
- **What is wrong:** Text at 12-13 px for: per-box prices in the quantity cards («38.53 ج.م للعلبة», 12 px on desktop), order dates, status chips («بانتظار الدفع»), line items (16,345.00, 750.00, −580.35), the designer's price badge text and helper text («Or tap any side…», 12 px).
- **Why it matters:** These are the numbers a buyer reads most carefully. Older shop owners on budget phones struggle below 14 px.
- **Fix:** Set a 14 px minimum for any price, date or status. Keep 13 px only for legal fine print.
- **Files:** checkout and order CSS modules next to `CheckoutClient.tsx` and `src/app/[locale]/orders/[id]/page.tsx`; `src/components/designer/designer.module.css`
- **Screenshots:** `round1\f_01_afterorder.png`, `round1\o_ar_orders_cmw6szd260037sg4caxdi5m5s_pai.png`

### R1-21: The designer price sheet adds conditions and is covered by a toast
- **Page:** designer price sheet (`/ar/design/mailer-box`, signed in)
- **What is wrong:** The sheet adds a fourth condition in small print («الأسعار هنا قبل خصم الدفع المقدم 3% عند إتمام الطلب»; validity; printer; printer count). The «تمت إضافة الصورة إلى وجه الأعلى» toast sits on top of that text for several seconds. The badge says «ابتداء من 39.69», a hedge, even though this is the price for this exact box.
- **Fix:** Show the final number the buyer will pay (with the discount applied) and drop «ابتداء من» for a configured design. Lift the toast above the sheet or dismiss it when a sheet opens.
- **Files:** `src/i18n/designer.ar.ts:302,321`, `src/components/designer/Modals.tsx`
- **Screenshot:** `round1\e_ed_price.png`

---

## Errors check (e)
- No console errors, no hydration warnings and no page errors on any page walked, in AR mobile or EN desktop. The only warnings are font `preload … not used within a few seconds` on `/ar` and `/ar/start` (harmless; worth trimming one of the two preloaded woff2 files).
- 206 unique internal links from `/ar`, `/ar/start`, `/ar/boxes`, `/ar/pricing`, `/ar/catalog`, `/en`, `/ar/why-elba` and `/ar/boxes/mailer-box` all return 200, or 307 for `/design?structure=` redirects. No 404s. (`/ar/catalogue` is a 404, but nothing links to it.)

## Already good: keep
- **Home hero message:** «علب مطبوعة بشعار مشروعك» + «تطبعها مطابع مصرية معتمدة، وتضمنها علبة، وتصلك في أي محافظة» + three ticks. Clear in 5 seconds. The English desktop hero is equally clear.
- **Basic designer mode:** numbered 1-2-3-4 (logo, text, colour, size), friendly size presets («تيشيرت، حذاء، طقم مستحضرات»), and the uploaded logo landing on the lid instantly with a toast. The desktop layout is clean.
- **The checkout skeleton:** 3 clear steps, quantity cards with totals and «الأكثر طلبا», the 5-box sample option with credit back, address prefilled from the account, an approval proof that shows the box in 3D or flat with fold animation, and local payment methods (card, wallets, Fawry, InstaPay) with plain explanations.
- **Order page tracking:** «تم استلام الدفع. طلبك في طريقه إلى المطبعة» + three next steps + a 7-step timeline with a dated ETA and the WhatsApp promise. Exactly what a buyer wants after paying.
- **The guarantee copy:** «إعادة الطباعة أو رد المبلغ … خلال 30 يوما», «لا تبدأ الطباعة إلا بعد أن تعتمد بروفة علبتك», «بائع واحد وإيصال واحد». Strong. Promote it higher up (R1-12).
- **Honesty labels:** «تصميم توضيحي · علامة غير حقيقية» on the sample brands.
- **Clean RTL** across marketing, designer and checkout: no horizontal overflow on any page at 390 px, apart from the cookie notice (R1-16).
