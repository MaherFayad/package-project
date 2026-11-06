# Copy audit (key: copy)

Scope: every user-facing string in Arabic and English. That covers the `src/i18n/**` dictionaries, hard-coded strings in components, WhatsApp/SMS/email templates, metadata, error and empty states, and seeded content. Rules: docs/audit/BRIEF.md (round 4 rules, ids `R5-CP-`) and docs/audit/platform-glossary.md. This round extended the glossary with a "Copy round 5 additions" table.

Method:
1. Read every dictionary key side by side (en | ar): 3,190 keys.
2. Ran an independent line-by-line review of the admin and vendor-portal dictionaries.
3. Swept components, `src/lib`, `prisma/seed.ts` and the data files for hard-coded strings and templates.
4. Crawled every route in ar and en at 1440, 390 and 320 as anon, buyer, admin and vendor staff. The crawler flagged Latin text on Arabic pages, raw keys or placeholders, generic titles, horizontal overflow and clipped text. Script: scratchpad `crawl.cjs`.
5. Added a unit test (`src/i18n/__tests__/copy-rules.test.ts`) that fails on any of these:
   - ar/en key-parity drift or empty values
   - any Arabic diacritic, including U+0653–U+065F, superscript alef, Quranic marks and tatweel. The old test only covered U+064B–U+0652.
   - Arabic-Indic digits
   - banned glossary terms
   - a "Tax invoice" title
   - a bare «من {price}» or «من {qty}»
   - ASCII double quotes in English

Standards cited: Egypt PDPL Law 151/2020 (consent scope and disclosure accuracy); Egyptian VAT 14% and ETA e-invoicing (a document must not call itself a tax invoice before the seller is registered); WCAG 2.2 3.3.2 (labels) and 3.3.1 (errors); ISO 9241-110 (conformity with user expectations, so one term per concept).

## Round 5 (first copy round)

New findings this round, counted before fixing: **critical 0 · high 15 · medium 41 · low 29** (85 in total; several rows group a pattern that repeats across keys).

### High

| id | severity | page / file | finding | standard | fix | status |
|---|---|---|---|---|---|---|
| R5-CP-01 | high | /orders/[id]/invoice · `orders.invoice.title/metaTitle/notIssued`, `orders.detail.invoice`, `orders.subtitle` | The buyer document is titled «فاتورة ضريبية» / "Tax invoice", but Elba has no seller tax registration number yet. | ETA e-invoicing; Egyptian VAT law | Now "Order receipt {number} (not a tax invoice)" / «إيصال الطلب {number} (ليس فاتورة ضريبية)». "View receipt", "download receipts", «إيصالات». A test locks it. | fixed |
| R5-CP-02 | high | invoice page ETA card · `orders.invoice.etaNote`, `etaPending` | Says the receipt "is submitted to the ETA e-invoicing system", which is not true today. | ETA | The note now says it is not a tax invoice and that e-invoices start once Elba's registration is active. "Not submitted yet". | fixed |
| R5-CP-03 | high | checkout delivery step · `buyer.company.toggle/toggleHelp` | "I need a company tax invoice / نصدر الفاتورة الإلكترونية" promises a document Elba cannot issue yet. | ETA; Consumer Protection Law 181/2018 (no misleading claims) | "Add company details for tax / إضافة بيانات الشركة الضريبية". The help text says the details go on the receipt, and on the e-invoice once registration is active. | fixed |
| R5-CP-04 | high | order timeline · `orders.detail.notes.PREFLIGHT_OVERRIDE` (ar) | «مع قبول مشكلات فحص الطباعة كما هي» is a sentence fragment and does not match "Proof approved with print-check problems". | ISO 9241-110 | «الموافقة على البروفة مع مشكلات فحص الطباعة» | fixed |
| R5-CP-05 | high | /legal/privacy · `legal.privacy.sections.security` (ar) | «في صورة مشفرة» (encrypted), where the English and the code say hashed. This is a factual error in a PDPL disclosure. | PDPL 151/2020 art. on security disclosure | «في صورة قيم تجزئة فقط» (draft banner kept) | fixed |
| R5-CP-06 | high | cookie notice, /legal/cookies · `store.cookie.message`, `legal.cookies.intro` (ar) | «قياسا داخليا … لا يشارك أي جهة أخرى» means "measurement that does not take part in any party", not "is never shared". | PDPL | «لا نشاركه مع أي جهة أخرى» | fixed |
| R5-CP-07 | high | /account consent · `account.marketingLabel/marketingHelp` (en) | The English consent label omits "saved-design reminders" that the Arabic label and the sign-up consent include. The en and ar consent scopes differed. | PDPL (specific, informed consent) | "Offers, tips and saved-design reminders on WhatsApp and SMS". The help text names where to withdraw. | fixed |
| R5-CP-08 | high | admin audit · `admin.audit.actions.ORDER_QC_REJECT` (ar) | «رفض الجودة» reads as "rejecting quality". | ISO 9241-110 | «عدم اجتياز فحص الجودة». Related QC calques fixed too (`ORDER_QC_APPROVE`, `order.qc.approved`, `events.QC_APPROVED`, `QC_UPLOADED`). | fixed |
| R5-CP-09 | high | admin overview, vendor rate cards · `repeatEmpty`, `tasks.quoteLeads`, `rateCards.modelsTitle`, `rateCards.tooling/sizesHelp` | Banned glossary terms in prominent labels: «مشتر», «طلبات تسعير», «البطاقة» (rate card), and «القوالب» (the dieline word) for tooling. | glossary | «عميل», «طلبات عروض أسعار», «قائمة الأسعار», «أدوات التصنيع». Glossary extended. | fixed |
| R5-CP-10 | high | catalogue, designer, store family labels, seed · `src/lib/configurator/catalog.ts`, `rules.ts`, `src/lib/vessels/stocks.ts`, `prisma/seed.ts` | "Spot UV" is transliterated «يو في موضعي» / «اليو في». Foil names have gender errors («بصمة ذهبي»). Greyboard is «كرتون مقوى». | glossary | «طلاء UV موضعي», «بصمة ذهبية/فضية/ذهبية وردية», «بصمة حرارية», «كرتون رمادي». | fixed |
| R5-CP-11 | high | /ar/admin/audit, admin order timeline · `src/components/admin/server/actions.ts` (19 `summary:` strings) | Audit summaries are English sentences (`${nameEn} → …`, `${amount/100} EGP`) and render as-is on Arabic pages. | WCAG 3.1.2 (language of parts) | Store structured params and render with `admin.audit.summary.<ACTION>` + formatMoney. That needs a server-action and schema change in the admin area, which another session is editing. | open (admin owner) |
| R5-CP-12 | high | /ar/design model picker · `src/lib/dieline/registry.ts:224,242,261`, vessel `standard` strings | The standard chip shows English descriptors on Arabic pages ("Gable carrier", "Rigid set-up box", "Composite can", "CETIE 29 mm crown / cork finish (sparkling)", "ISO 1361 (open-top food cans…)"). | WCAG 3.1.2 | Make `standard` a code only (show nothing when there is no FEFCO/ECMA/ISO code), or localize it as `{ar,en}`. This is a designer/3D data change, and those files are being edited in parallel. | open (designer / 3d-engine owners) |
| R5-CP-13 | high | /ar/boxes/pizza-box and other non-FEFCO styles · `src/components/store/StructureDetail.tsx:90` | The fact row shows the internal enum ("PIZZA", "SLEEVE", "GABLE BOX") as if it were a standard code. | ISO 9241-110 | The row renders only for FEFCO/ECMA codes (3-line component change). | fixed |
| R5-CP-14 | high | /ar/catalog, /ar/boxes · `src/components/catalogue/copy.ts` | «كود» (banned), imperative buttons («صممها مجانا», «اطلب عرض سعر»), «المصنع» for the vendor, «رقم هاتف حسابك», and «{count} نموذج» / «من {count} مطبعة» with broken agreement for counts 3–10. | glossary; counted-noun rule | «رمز», «التصميم مجانا», «طلب عرض سعر», «المطبعة», «رقم المحمول المسجل في حسابك». Counts rephrased as «النماذج: {count}» / «(عددها: {count})». | fixed |
| R5-CP-83 | high | /ar and /en /boxes/{telescope-box, display-tray, crash-lock-carton, snap-lock-carton, gable-box, paper-tube, rigid-box} `<title>` and h1 | `store.seo.keyword.*` / `store.seo.use.*` were missing for seven box styles, so the page title showed the raw key «store.seo.keyword.RIGID_BOX» (found by the crawl). | WCAG 2.4.2 (page titled) | Keys added in both languages. The new copy-rules test fails if any box style lacks them. | fixed |

### Medium

| id | severity | page / file | finding | standard | fix | status |
|---|---|---|---|---|---|---|
| R5-CP-15 | medium | every page `<title>` / meta · `meta.tagline`, `meta.description` (ar) | «تصممها ثلاثية الأبعاد» says "you design it three-dimensional", a calque. | MSA naturalness | «بتصميم ثلاثي الأبعاد وصناعة مصرية» / «على نموذج ثلاثي الأبعاد» | fixed |
| R5-CP-16 | medium | designer start, price gate · `designer.start.body`, `designer.gate.reason.price` | «رقم هاتفك المحمول» instead of the glossary term. | glossary | «رقم محمولك» | fixed |
| R5-CP-17 | medium | catalogue cards, designer badge, store pages, share page (11 keys) | A bare «من {price}» / «من {qty:box}» reads as "of 2.50 EGP" or "of 100 boxes". | MSA | «ابتداء من …». A test guards it. | fixed |
| R5-CP-18 | medium | designer, catalogue, checkout, legal (≈16 keys, en + ar) | One concept, five names: "Request a quote", "Request a price", "price request", "Priced by quote", "Price on request", plus "Quotes stay valid 72 hours" for the instant price. Arabic mixes «طلب سعر» / «طلب السعر» / «طلبات الأسعار». | ISO 9241-110; glossary | EN: action "Request a price", object "price request", state "Price on request", and "Prices are valid for 72 hours". AR: «طلب عرض سعر», «طلبات عروض الأسعار», «السعر عند الطلب», «السعر صالح لمدة 72 ساعة». Matches the existing e2e wording. | fixed |
| R5-CP-19 | medium | order status chip · `orderStatus.QC_PENDING` | "Quality check / فحص الجودة" is a noun, not a status. | glossary (status chips) | "In quality check / قيد فحص الجودة" | fixed |
| R5-CP-20 | medium | /orders tabs · `orders.views.done` (ar) | «تم التوصيل», while the status chip says «تم التسليم». | one term per concept | «تم التسليم» | fixed |
| R5-CP-21 | medium | checkout summary, receipt line, address step · `checkout.summary.shipping`, `address.help`, `shippingChanged`, `buyer.sample.incl` | The cost line is "Delivery / التوصيل" in checkout but "Shipping / الشحن" in pricing lines. | glossary (shipping = cost line) | "Shipping / الشحن", "Shipping cost updated for {governorate}" / «تم تحديث تكلفة الشحن لمحافظة {governorate}». e2e/a11y.spec.ts selector updated. | fixed |
| R5-CP-22 | medium | `pricing.subtotal` vs `checkout.summary.subtotal` | «الإجمالي الفرعي» and «المجموع الفرعي» both used. | one term | «المجموع الفرعي» | fixed |
| R5-CP-23 | medium | share page · `designer.shared.subtitleDesign` | «تصميم عبوة مشترك» means "a joint / common design". | meaning | «تصميم عبوة تمت مشاركته» | fixed |
| R5-CP-24 | medium | export gate · `designer.gate.reason.export` | «حمل» is ambiguous (carry / load); the dialog itself says «تنزيل». | one term | «نزل صورة تصميمك» | fixed |
| R5-CP-25 | medium | store catalogue families, availability data · `store.catalog.family.*`, `data.ts:68,95` | Rigid is «علب مقواة فاخرة» (banned word). Tubes are «أسطوانات ورقية». Folding cartons are listed as «علب كرتون مقوى». | glossary | «علب صلبة فاخرة», «علب أسطوانية ورقية», «علب الكرتون المضلع», «علب دوبلكس» | fixed |
| R5-CP-26 | medium | home catalogue band · `store.home.catalogBody` | Box styles are called «تصميمات قياسية», which collides with "design" (the buyer's artwork). | one term | «أنواع قياسية» | fixed |
| R5-CP-27 | medium | design picker · `library.catalog.more` | «{count} نوعا آخر» has a bare number before a counted noun, which is wrong for counts 3–10. | counted-noun rule | Rephrased «… وعددها: {count}». EN no longer starts with a bare count. | fixed |
| R5-CP-28 | medium | vendor portal (17 strings) | «موديل / موديلات», while admin and buyer use «نموذج / نماذج». | glossary | All «نموذج». A test bans «موديل». | fixed |
| R5-CP-29 | medium | vendor portal · `rateCards.modelCount`, `modelsUnlisted`, `portfolio.uploadedForReview` | "{count} models / photos" produces "1 models" and «أرسلت» (ambiguous unvocalised passive). | counted-noun rule | `{count:model}`, `{count:photo}`, «تم إرسال {count:photo} للمراجعة». | fixed |
| R5-CP-30 | medium | admin chips · `orders.paymentStatus.FAILED`, `moderation.statuses.PENDING`, `shipments.statuses.OUT_FOR_DELIVERY` | «فاشل» is harsh, «للمراجعة» is not a status, «خرج للتسليم» has a gender clash with الشحنة. | status chip rule | «تعذر الدفع», «بانتظار المراجعة», «خرجت للتوصيل» | fixed |
| R5-CP-31 | medium | admin · `errors.PAYOUT_ORDER_CLOSED`, `overview.events.conversion` | «استرد الطلب أو ألغي» reads as an imperative. «دافع» also means "motive". | MSA | «تم استرداد مبلغ الطلب أو إلغاؤه…», «التحويل من زيارة إلى دفع» | fixed |
| R5-CP-32 | medium | admin / vendor · food-safe and public-page terms | «شهادة ملامسة الغذاء» vs «شهادة سلامة الغذاء». «الملف العام» vs «الصفحة العامة». | one term | Aligned in both languages. | fixed |
| R5-CP-33 | medium | vendor portfolio · `portfolio.help`, `moveUp/moveDown`, `payouts.columns.trigger` | «أكثر من التصاميم» should mean renders, not designs. «تقديم / تأخير» read as "submit / delay". The column header is a verb («تصرف بعد»). | meaning; noun-form labels | «صور المحاكاة», «نقل إلى موضع سابق / لاحق», «شرط الصرف» | fixed |
| R5-CP-34 | medium | admin audit / pricing (en) | "Box style changed" under the entity "Production style". The preview help used `{qty:unit}` in en and `{qty:piece}` in ar. | one term | "Production style changed", `{qty:piece}` | fixed |
| R5-CP-35 | medium | sign-in, legal links · `auth.acceptTerms`, `termsLink`, `privacyLink`, `TERMS_REQUIRED` (en) | "Terms of Service and Privacy Policy" in title case. | sentence case | "terms of service and privacy policy" (the footer and page titles were already sentence case) | fixed |
| R5-CP-36 | medium | WhatsApp · `notify.DESIGN_FOLLOW_UP` (ar + en) | The URL runs straight into the next sentence ("…here: {url} and reply here…"), so WhatsApp autolinks badly and the STOP line is buried. | PDPL (clear opt-out) | Link, question line and STOP line each sit on their own line. «إيقاف» and STOP still match the inbound handler; the tests pass. | fixed |
| R5-CP-37 | medium | WhatsApp · `notify.STATUS_CHANGED`, `notify.DELIVERED` | "is now: {status}" has a double colon. "Tell us how it went" gives no place to do it. | plain language | "order {number} status: {status}". "You can rate it from your orders page" / «يمكنك تقييمه من صفحة الطلبات». | fixed |
| R5-CP-38 | medium | WhatsApp · `notify.FAWRY_CODE` | No amount and no expiry, so the buyer cannot pay at the outlet from the message alone. | plain language | Pass `amount` and `expires` from src/lib/orders/service.ts:650 and use "pay {amount} for order {number} … before {expires}". That is a checkout service change. | open (checkout owner) |
| R5-CP-39 | medium | seed (Arabic buyer) · `prisma/seed.ts:612,641,680,704,754,766,793,799,812` | English design names ("Bloom mailer", "ELB-26201 box"), addresses ("Nasr City", "14 Abbas El Akkad St"), dispute text and applicant data appear on /ar order, receipt and admin pages. | WCAG 3.1.2 | Arabic values for the Arabic seed buyer and applicant. Vendor staff are named «فريق {nameAr}». | fixed |
| R5-CP-40 | medium | seed and model names · `prisma/seed.ts`, `src/lib/dieline/registry.ts`, `families/fefco-02`, `families/fefco-03-05` | «علبة شحن» and «علبة كرتون دوبلكس / بلسان», while the glossary and dictionary say «كرتونة شحن» and «علبة دوبلكس». | glossary | Aligned (value-only edits). The vendor captions and bio use «كراتين شحن». | fixed |
| R5-CP-41 | medium | catalogue Egypt badge · `src/data/catalogue/order-mode.ts:122` | ar «متوفر في مصر» vs en "Made in Egypt" (different claims). It also collides with the «متاح في مصر» filter, which includes imported items. | ISO 9241-110 | «يصنع في مصر» | fixed |
| R5-CP-42 | medium | checkout quantity step · `CheckoutClient.tsx:381,403,921` | Inline ar/en strings («بعرض سعر», «يسعر هذا النوع بعرض سعر…») bypass the dictionary and now drift from "Price on request". | one term | Use `store.catalog.priceOnRequest` and add `checkout.quantity.helpByQuote` / `byQuoteSummary`. The checkout session is editing this file. | open (checkout owner) |
| R5-CP-43 | medium | model picker · `ModelPicker.tsx:117,120,157,211`, `CataloguePicker.tsx:57,227`, `ConfigPanel.tsx:580-591`, `designer/lib/config.ts:156` | Inline strings: scope filter, «عرض الكل (n)», the «بعرض سعر» badge, the «اختر نموذجا» title (imperative), and surface names (WRAP drifts from vessels/labels.ts). | one term; noun form | Move to `library.picker.*` / `library.surfaces.*`. The designer session is editing these files. | open (designer owner) |
| R5-CP-44 | medium | vendor file links · `src/app/api/vendor/jobs/_shared.ts`, `files/[...key]/route.ts`, `jobs/[id]/dieline/route.ts:41` | A failure returns a bare English "Not found" / "Invalid size". The dieline case saves an ".svg" that contains that text. | WCAG 3.3.1 | Return error codes plus `vendorPortal.errors.FILE_NOT_FOUND` / `DIELINE_INVALID_SIZE`. Vendor API change. | open (vendor owner) |
| R5-CP-45 | medium | proof PDF · `src/app/api/orders/[id]/proof-pdf/route.ts:20`, `src/lib/orders/pdf/print.ts:203` | The watermark "PROOF - NOT FOR PRINT" and PDF title are English on the Arabic buyer's copy. | WCAG 3.1.1 | A localized or bilingual watermark («بروفة - غير مخصصة للطباعة»). It needs an Arabic-capable PDF font. | open (checkout owner) |
| R5-CP-46 | medium | admin order page · `admin/orders/[number]/page.tsx:108,121` | Raw note codes ("INSTAPAY_SENT", "PAID_AFTER_CANCEL_REFUND_NEEDED") are shown to ops. | WCAG 3.3.2 | Map them to `admin.order.notes.<CODE>`. | open (admin owner) |
| R5-CP-47 | medium | home stats band · `(store)/page.tsx:232` + `marketing.stats.printers` | «{n} مطابع معتمدة» is wrong once there are 11 or more vendors («12 مطابع»). | counted-noun rule | Render the label with `formatCount(n, "vendor")` without the number, or as «مطبعة معتمدة» for n ≥ 11. Component change on the marketing page. | open (marketing owner) |
| R5-CP-48 | medium | OTP · `src/lib/auth/otp.ts:84` | No SMS/WhatsApp text exists for the one-time code (empty seam). | PDPL / security copy | Add `notify.OTP_CODE` when the SMS provider is wired: «علبة: رمز التحقق {code}، صالح لمدة {minutes:minute}. لا تشاركه مع أحد.» / "Elba: your verification code is {code}. It expires in {minutes:minute}. Do not share it." | open (platform owner) |
| R5-CP-49 | medium | email · `src/lib/notify/index.ts:103-141` | Email reuses the WhatsApp text and has no subject. | plain language | Add `notify.subject.<TEMPLATE>`. | open (platform owner) |
| R5-CP-50 | medium | sample tier · `buyer.sample.help` (ar) | «غير متأكد من الألوان؟» is masculine-only. | gender strategy | «تريد التأكد من الألوان أولا؟» | fixed |
| R5-CP-51 | medium | sample tier · `buyer.sample.price` (ar) | «+ الضريبة لكل العلب» reads as "VAT for all boxes". | meaning | «+ الضريبة للعينة كاملة» | fixed |
| R5-CP-52 | medium | price-request form · `buyer.quote.send/summary/listTitle/neededBy` (ar) | «طلب السعر», «طلب سعر», «طلبات الأسعار». «مطلوب قبل» is a fragment used as a label. | glossary | «إرسال طلب عرض السعر», «طلب عرض سعر», «طلبات عروض الأسعار», «الموعد المطلوب» | fixed |
| R5-CP-53 | medium | account delete · `account.deleteBody` (en + ar) | "Invoices are kept" now that the document is a receipt. | ETA wording | "Order receipts and records are kept…" / «نحتفظ بإيصالات الطلبات وسجلاتها…» | fixed |
| R5-CP-54 | medium | legal pricing · `legal.terms.sections.pricing` | "An instant quote is valid for 72 hours" mixes quote and instant price. | one term | "An instant price…" / «السعر الفوري صالح لمدة 72 ساعة». The draft banner and the [LAWYER] flags are unchanged. | fixed |
| R5-CP-55 | medium | catalogue quote form · `copy.ts formSent` vs `buyer.quote.sentBody` | Catalogue requests promise a reply in 2 working days, buyer quantity requests in 1. | consistency | Kept on purpose: catalogue requests go to importers and regional converters (`egyptLong.rare`). Wording aligned otherwise. Business to confirm. | won't fix (business decision) |

### Low

| id | severity | page / file | finding | fix | status |
|---|---|---|---|---|---|
| R5-CP-56 | low | `designer.box.errors.TOO_LARGE`, `box.rules.H <= W` | «لا يزيد عن» → «لا يزيد على» (as in store.structure.rule.HW) | fixed | fixed |
| R5-CP-57 | low | `designer.backToStyles` | «أشكال العلب» vs nav «أنواع العلب» | «أنواع العلب» | fixed |
| R5-CP-58 | low | three suggestion strings | «استلم قبل الموعد بفارق» vs «استلم أسرع بفارق» | unified | fixed |
| R5-CP-59 | low | `checkout.summary.validUntil` | «سار حتى» vs «صالح حتى» | «صالح حتى» | fixed |
| R5-CP-60 | low | `payment.card.expiry` (ar) | "(MM/YY)" Latin in the Arabic label | «(شهر/سنة)». The field placeholder in PaymentClient.tsx:187 stays "MM/YY" (open, checkout). | fixed (label) |
| R5-CP-61 | low | `paymentMethods.FAWRY`, `store.home.faq.a5` (en) | "Fawry reference code" vs glossary "reference number" | "reference number" | fixed |
| R5-CP-62 | low | `checkout.errors.PREFLIGHT_BLOCKED`, `buyer.preflight.overrideRequired`, `account.deleteDesignBody`, two admin strings (en) | ASCII quotes | curly quotes; a test guards it | fixed |
| R5-CP-63 | low | `library.panel.finishOnImages/Items` (en) | "On 1 images" | `{count:photo}` / `{count:item}` | fixed |
| R5-CP-64 | low | `marketing.announce.textShort` | «ثلاثية» agrees with the wrong noun | «معاينة ثلاثية الأبعاد للبصمة والسلوفان» | fixed |
| R5-CP-65 | low | `marketing.printers.profile`, `store.vendors.viewProfile` | «عرض الصفحة» is vague | «عرض ملف المطبعة» (as in checkout) | fixed |
| R5-CP-66 | low | `marketing.boxes.renderAlt` | «صورة ثلاثية الأبعاد بعد الطباعة» | «… لعلبة مطبوعة» | fixed |
| R5-CP-67 | low | `store.vendor.cert.FSC` | «سلسلة توريد» (supply chain) for chain of custody | «سلسلة الحيازة FSC» | fixed |
| R5-CP-68 | low | `orders.invoice.etaActivity/etaItemCode` | «كود» (banned) | «رمز النشاط / رمز الصنف» | fixed |
| R5-CP-69 | low | `legal.privacy.sections.sharing` (ar) | «الهاتف» | «رقم المحمول» | fixed |
| R5-CP-70 | low | `pricing.manualQuote` (ar) | «وسنرد خلال يوم عمل» (the glossary says no «سوف / س» future padding, and "one" was missing) | «ونرد خلال يوم عمل واحد» | fixed |
| R5-CP-71 | low | admin chips and labels (`vendors.statuses.PENDING`, `privacy.statuses.OPEN`, `disputes.views.resolved`, `disputes.reasons.DAMAGED`, `application.noDocuments`, `vendorCard.due`, `refund.success`, `audit PAYOUT_PAY`) | vague or calqued | aligned to the chip rules | fixed |
| R5-CP-72 | low | vendor (`job.qcStatus.APPROVED`, `rateCards.referenceBody` «فرخ» for blank, `portfolio.saveCaption`, `banners.awaitingTitle` "please", `portfolio.status.PENDING` "In review") | small drifts | aligned | fixed |
| R5-CP-73 | low | admin en (`applications.emptyBody` "print shops", `steps.account_created` "Gate passed", `quotes.search` "phone") | jargon / term drift | "vendors", "Account created", "Search by buyer, mobile or model" | fixed |
| R5-CP-74 | low | `src/lib/configurator/catalogue.ts:116` | "The converter sets this in the quote / يحدد المصنع" | "The printer … / تحدد المطبعة" | open (designer owner, configurator file) |
| R5-CP-75 | low | `rateCards.errors.UNIT_INCREASES` | hard-codes "box" for labels, pouches and tubes | needs `{theUnit}` passed by RateCardForm | open (vendor owner) |
| R5-CP-76 | low | aria-labels `CheckoutShell.tsx:25`, `MarketingFooter.tsx:60` | `${siteName}, ${home}` gives «علبة, الرئيسية» (Latin comma) | add `nav.homeLabel` («علبة، الرئيسية») | open (checkout / marketing owners) |
| R5-CP-77 | low | `src/lib/payments/paymob.ts:141,149` | "Order …" / "Elba customer" on the hosted checkout | localize via `orders.detail.metaTitle` | open (checkout owner) |
| R5-CP-78 | low | three.js fallbacks (`EngineCanvas.tsx`, `ViewControls.tsx`) | English default props (every caller passes `viewer.*` today) | make the props required | open (3d-engine owner) |
| R5-CP-79 | low | inline preview art (`StartViewer.tsx`, `HeroBox.tsx`, `exportMark.ts`) | «علامتك», «صنع في مصر», «صمم علبتك على علبة» inline | move to `designer.artwork.*` | open (designer / marketing) |
| R5-CP-80 | low | `marketing.hero.chips.approvedBy` | "Proof approved / by {vendor}". The vendor does not approve proofs. | "Printed by {vendor}" / «تطبعها {vendor}» once marketing confirms what the chip shows | open (marketing owner) |
| R5-CP-81 | low | `legal.terms.sections.payment`, `store.home.faq.a5` | "First orders are paid in full", while checkout says every custom order is prepaid. | Business to confirm repeat-customer terms. The legal text stays flagged for the lawyer. | open (business) |
| R5-CP-82 | low | `designer/lib/catalog.ts:26,41` | product preset ar «حذاء» vs en "Shoe box" | «علبة حذاء» | open (designer owner) |
| R5-CP-84 | low | /boxes/* fact row | After R5-CP-13, ECMA styles would still show pseudo codes («ECMA RTE»). Real ECMA codes (A20.20…) appear on the catalogue pages. | the chip shows FEFCO codes only | fixed |
| R5-CP-85 | low | /vendors/[slug] machines (seed) | Machine model strings are English descriptions ("Flexo 4-colour printer-slotter", "HP Indigo-class digital press") on Arabic profiles. | Vendor-entered manufacturer designations stay Latin. Seed descriptions could become brand + model only. | won't fix (vendor content) |

### Checked and clean

- **Diacritics and digits.** No diacritics, tatweel or Arabic-Indic digits in any Arabic value, and none in the crawled Arabic pages.
- **Key parity.** 3,190 keys, identical in ar and en; placeholders match.
- **Mixed direction.** Phone examples and card test numbers sit inside LTR isolates and render in order at 390 (screenshot: anon-ar-390-login). Prices render as «1,250.50 ج.م» with a true minus isolated. Units (مم, جم) and Latin model codes are wrapped in `<bdi>` on the structure, order and receipt pages.
- **VAT.** Always "VAT 14%" / «ضريبة القيمة المضافة 14%», shown separately, with "Total incl. VAT" / «الإجمالي شامل الضريبة».
- **PDPL consent.**
  - Sign-up marketing consent is optional, separate from the terms, names the channels and purposes, and says how to withdraw.
  - The account page keeps a consent history.
  - Unsubscribe confirms the withdrawal.
  - The STOP / «إيقاف» reply is honoured (whatsapp-inbound.ts).
- **Legal pages.** The privacy, terms, returns and cookies pages all keep the "Draft for lawyer review" banner, and every `[LAWYER: …]` / `[للمحامي: …]` flag is still in place.
- **Metadata.** Every localized page sets a dictionary title. No English or title-case titles on /ar pages.
- **Social network names.** Instagram, Facebook, TikTok and LinkedIn stay in Latin script in the footer (brand names, accepted).

## Files changed outside src/i18n

- `src/components/store/StructureDetail.tsx`: the code chip renders only for FEFCO codes (R5-CP-13, R5-CP-84).
- `src/components/catalogue/copy.ts`, `src/data/catalogue/order-mode.ts`, `src/data/packaging-availability/data.ts`: string values only.
- `src/lib/configurator/catalog.ts`, `src/lib/configurator/rules.ts`, `src/lib/vessels/stocks.ts`: Arabic name and reason values only.
- `src/lib/dieline/registry.ts`, `src/lib/dieline/families/fefco-02/definitions.ts`, `src/lib/dieline/families/fefco-03-05/definitions.ts`, `src/lib/dieline/families/ecma-tuck/definitions.ts`: Arabic model name values only.
- `prisma/seed.ts`: Arabic values only.
- `e2e/a11y.spec.ts`: one text selector follows the renamed toast ("Shipping cost updated for Giza.").
- `docs/audit/platform-glossary.md`: additive "Copy round 5 additions" table.
- New test: `src/i18n/__tests__/copy-rules.test.ts`.
