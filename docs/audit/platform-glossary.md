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
