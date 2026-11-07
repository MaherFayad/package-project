# Arabic terminology and copy rules (platform, round 2)

One term per concept across buyer, vendor and admin. MSA that reads naturally in Egypt; no diacritics; Western digits; "ج.م" after amounts.

## Glossary

| Concept (en) | Arabic (use this) | Do not use |
|---|---|---|
| Order (a buyer's purchase) | طلب / الطلبات | أوردر |
| Job (the vendor's side of an order; same number) | طلب / الطلبات (vendor portal says "الطلبات" in nav) | طلبية، مهمة |
| Buyer / customer | العميل / العملاء | المشتري، المشترين، الزبون |
| Vendor / print shop | المطبعة / المطابع | المورد، البائع (Elba is the seller) |
| Seller of record | علبة هي البائع | |
| Proof | البروفة | النموذج المبدئي |
| Quote | عرض سعر / عروض الأسعار | تسعيرة |
| Price list / rate card | قائمة أسعار / قوائم الأسعار | بطاقة أسعار |
| Dieline (the flat template) | القالب | الديلاين |
| Cutting die | فورمة التكسير | |
| Lead time | مدة التنفيذ | وقت التسليم (that is delivery) |
| Delivery (to the buyer) | التوصيل / التسليم (the event) | |
| Shipping (the carrier leg, the cost line) | الشحن | |
| Dispute / problem report | بلاغ / البلاغات ("الإبلاغ عن مشكلة" as an action) | نزاع، شكوى (شكوى only for the regulator: مركز حماية البيانات) |
| Refund | استرداد المبلغ / الاسترداد | |
| Payout (money to a vendor) | المستحقات / تحويل المستحقات | |
| Quality check | فحص الجودة | |
| Mobile number | رقم المحمول | رقم الموبايل، رقم الهاتف، الجوال |
| One-time code | رمز التحقق | كود، OTP |
| Fawry reference | الرقم المرجعي لفوري (short: الرقم المرجعي) | كود فوري، كود مرجعي |
| Online (payment) | إلكترونيا / الدفع الإلكتروني | أونلاين |
| Mobile wallet | المحفظة الإلكترونية | محفظة موبايل |
| Digital printing | الطباعة الرقمية | الديجيتال |
| Folding carton (SBS) | علبة دوبلكس / علب دوبلكس | علبة كرتون (ambiguous) |
| Corrugated | الكرتون المضلع | الكرتون المقوى |
| Shipping carton (FEFCO 0201) | كرتونة شحن / كراتين شحن | علبة شحن |
| Mailer box (FEFCO 0427) | علبة بريدية | |
| Finish | التشطيب | |
| Sign in / Sign out | تسجيل الدخول / تسجيل الخروج | الدخول |
| Account | الحساب (nav: حسابي) | |
| Admin console | الإدارة | لوحة التحكم |
| Vendor portal | بوابة المطبعة | |
| Privacy policy | سياسة الخصوصية | إشعار الخصوصية |
| Terms of service | شروط الخدمة | الشروط والأحكام |
| Consent / withdraw | الموافقة / سحب الموافقة | |
| Personal Data Protection Law | قانون حماية البيانات الشخصية رقم 151 لسنة 2020 | |
| VAT | ضريبة القيمة المضافة (14%) | |
| Egyptian Tax Authority | مصلحة الضرائب المصرية | |
| Cancelled (status) | ملغى | ملغي |

## Form rules

- Buttons, menu items, tabs, column headers, field labels, section titles: noun form (مصدر): "حفظ"، "إرسال الرمز"، "تنزيل البيانات"، "قبول الطلب". Never an imperative or a plural imperative ("أرسلوا").
- Body and help text may address the user in the singular imperative ("أدخل"، "اختر"). No "يرجى"، "الرجاء"، "قم بـ"، "سوف".
- Status chips: past participle or "تم + مصدر" for completed events, "قيد + مصدر" for in-progress, "بانتظار + مصدر" for waiting.
- Success toasts: "تم + مصدر" ("تم الحفظ"). Errors say what happened and what to do.
- Counted nouns: never write "{count} أيام" or "{n} طلبات". Use a counted placeholder `{count:unit}` (rendered with the right Arabic form for 1, 2, 3–10, 11–99, 100+), or rephrase as "label: {count}". Units: second, minute, hour, day, week, month, box, order, item, vendor, review, unit, colour, piece, model, photo, error, priceList, design, file. The English string uses the same placeholder and gets "1 day" / "5 days".
- Arabic punctuation next to Arabic text: ، ؛ ؟. Space-separated digit groups go inside LTR isolates (U+2066 … U+2069).
- No diacritics, no tatweel, no English left in Arabic values (brand and standard codes such as FEFCO, PDF, ISO are fine).

## Copy round 5 additions (docs/audit/copy.md)

| Concept (en) | Arabic (use this) | Do not use |
|---|---|---|
| Order receipt (the buyer's document until Elba has a tax registration number) | إيصال الطلب (ليس فاتورة ضريبية) | فاتورة ضريبية، فاتورة |
| ETA e-invoice (only once Elba's tax registration is active) | الفاتورة الإلكترونية | |
| Price request (buyer asks Elba for a fixed price) | طلب عرض سعر / طلبات عروض الأسعار | طلب تسعير، طلب سعر، طلب السعر |
| Price on request (state of a model or quantity with no instant price) | السعر عند الطلب / يسعر عند الطلب | يسعر بعرض سعر، بعرض سعر |
| Instant price (valid 72 hours) | السعر الفوري | عرض السعر (that is the manual one) |
| From {price} | ابتداء من {price} | من {price} (reads as "of") |
| Model (an item in the library / catalogue) | النموذج / النماذج | الموديل، الموديلات |
| Box style (structure) | نوع العلبة / أنواع العلب | أشكال العلب، تصميمات قياسية |
| Rigid box family | علب صلبة (فاخرة) | علب مقواة |
| Greyboard | الكرتون الرمادي | الكرتون المقوى |
| Paper tube family | علب أسطوانية ورقية | أسطوانات ورقية |
| Spot UV | طلاء UV موضعي | يو في |
| Hot foil (gold / silver) | بصمة حرارية (ذهبية / فضية) | بصمة ذهبي |
| Tooling (non-die one-time cost: tube heads, shaped pouches) | أدوات التصنيع | القوالب (القالب is the dieline) |
| Blank (flat unfolded piece) | القطعة المفرودة | الفرخ (that is the printed sheet) |
| Quality check status | قيد فحص الجودة / اجتياز فحص الجودة / عدم اجتياز فحص الجودة | اعتماد الجودة، رفض الجودة |
| Shipping cost line | الشحن (Shipping) | التوصيل (that is the service/event) |
| Subtotal | المجموع الفرعي | الإجمالي الفرعي |
| Delivered (status) | تم التسليم | تم التوصيل |
| Download | تنزيل / نزل | حمل، تحميل (تحميل = loading) |
| Code (standard or colour code) | رمز | كود |
| Hashed (tokens, codes) | في صورة قيم تجزئة | مشفرة (that is encrypted) |
| Vendor's public page | الصفحة العامة / ملف المطبعة | الملف العام |
| Food-safe certificate | شهادة سلامة الغذاء | شهادة ملامسة الغذاء |
| Bleed | هامش النزف | هامش القص، هامش القص الزائد |
| 3D designer (the tool) | المصمم (ثلاثي الأبعاد) | المحرر |
| Vetted (printer) | معتمدة | موثقة، موثوقة |
| Mailer box (FEFCO 0427) | علبة بريدية | علبة شحن، صندوق شحن |
| Sign in (en) | Sign in | Log in |
| Receipt with VAT shown | إيصال يوضح الضريبة | إيصال ضريبي، فاتورة |
