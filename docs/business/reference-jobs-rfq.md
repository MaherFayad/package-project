# Reference Jobs and RFQ (Request for Quotation)

**Purpose:** get at least 3 comparable quotes for each of 5 reference jobs (`docs/research-report.md` section 10, Phase 0 step 3) so we can (1) build the first rate card, (2) check that market prices leave about 25% contribution margin (section 6.2), and (3) learn real digital vs offset/flexo breakpoints.

**Rules**
- Send the same spec to every vendor. Do not change a spec mid-round; if a vendor proposes an alternative, record it as a separate line.
- Always ask for **all five quantity tiers** (100, 250, 500, 1,000, 2,000) even when the job's headline quantity is one tier. These are the tiers the pricing engine uses (`QTY_TIERS` in `src/types/pricing.ts`).
- Ask vendors to split one-off costs (setup, plates, die) from the unit price. This maps directly to `setupPiasters`, `dieCostPiasters` and `qtyTiers` in the rate card.
- Prices ex-VAT, delivered to one address in Cairo (also ask ex-works).
- All dimensions are **inner dimensions in millimetres**, L x W x H (length x width x height), matching `Dims` in `src/types/structure.ts`.

---

## 1. The five reference jobs

### R1. Printed mailer box (D2C hero product)

| Field | Value |
|---|---|
| Elba structure code | `FEFCO_0427` (mailer, roll end tuck front) |
| Inner size | 250 x 200 x 80 mm |
| Material | `E_FLUTE_KRAFT`: E-flute corrugated, kraft outer liner, approx. 380 gsm combined [confirm grade with vendor] |
| Print | 1 colour (black or one Pantone), outside only (`printSides: OUTSIDE`), approx. 40% coverage, logo on lid + front |
| Finish | `NONE` |
| Headline quantity | 250 |
| Die | New die unless the vendor has a close existing size (ask for both prices) |
| Packing | Flat, in bundles of 25, shrink-wrapped or tied, labelled |
| Typical buyer | Instagram fashion, candles, accessories |

### R2. Reverse tuck end folding carton (cosmetics / perfume)

| Field | Value |
|---|---|
| Elba structure code | `ECMA_RTE` |
| Inner size | 65 x 55 x 160 mm (perfume 100 ml preset) |
| Material | `SBS_350`: solid bleached board 350 gsm |
| Print | 4 colours CMYK, outside only, full coverage |
| Finish | `MATTE_LAMINATION` (matte lamination outside) |
| Headline quantity | 1,000 |
| Die | Ask for existing die price and new die price |
| Gluing | Side seam glued, delivered flat |
| Packing | Cartons of 250 |
| Typical buyer | Perfume, skincare, candles |

### R3. Pizza box (F&B)

| Field | Value |
|---|---|
| Elba structure code | `PIZZA` (FEFCO 0426 style) |
| Inner size | 310 x 310 x 40 mm (30 cm pizza preset) |
| Material | `E_FLUTE_WHITE`: E-flute white top liner, **food-contact grade board** |
| Print | 2 colours outside (lid), food-packaging (low-migration) inks, no print inside |
| Finish | `NONE` |
| Headline quantity | 500 |
| Food safety | Vendor must state board and ink are suitable for direct food contact and share evidence (see `vendor-visit-checklist.md` section 6) |
| Packing | Flat, bundles of 50 |
| Typical buyer | Pizzeria, bakery, cloud kitchen |

### R4. Shipping box, regular slotted container

| Field | Value |
|---|---|
| Elba structure code | `FEFCO_0201` (RSC) |
| Inner size | 300 x 200 x 150 mm |
| Material | `B_FLUTE_KRAFT`: B-flute corrugated, kraft, approx. 450 gsm combined [confirm ECT/BCT if available] |
| Print | 2 colours flexo, outside, 2 panels (long sides) |
| Finish | `NONE` |
| Headline quantity | 300 |
| Die | RSC normally needs no cutting die (slotter); ask |
| Joint | Glued or stitched manufacturer's joint (ask which) |
| Packing | Flat, bundles of 20 |
| Typical buyer | E-commerce, exporters |

### R5. Rigid gift box (market reference only, not in V1 catalog)

| Field | Value |
|---|---|
| Elba structure code | none yet (rigid boxes are V2 in report section 4.2) |
| Inner size | 200 x 150 x 60 mm, two-piece lid and base |
| Material | 1.5 mm grey board wrapped in printed 157 gsm art paper |
| Print | 4 colours CMYK on wrap paper |
| Finish | Matte lamination on wrap, gold foil logo on lid (one position, approx. 60 x 20 mm) |
| Headline quantity | 100 |
| Insert | None (ask price with a simple EVA or card insert as an option) |
| Typical buyer | Corporate Ramadan/Eid gifting, premium cosmetics |
| Why we price it | Tells us whether Ramadan/Eid corporate gifting is worth adding early |

---

## 2. RFQ message (Arabic, WhatsApp)

Send one message per job, or the combined message below with the spec sheet attached as a PDF or image. Keep the tone formal and short.

### 2.1 Combined message

> السلام عليكم ورحمة الله،
>
> معكم [الاسم] من منصة علبة لطلب علب الكرتون المطبوعة أونلاين. نجهز قائمة أسعار مع مطابع شريكة، ونرجو تسعير الشغلات التالية بالكميات: 100 و250 و500 و1,000 و2,000 قطعة.
>
> **1) علبة بريدية (Mailer FEFCO 0427)**
> المقاس الداخلي: 250 × 200 × 80 مم
> الخامة: كرتون مضلع E كرافت
> الطباعة: لون واحد من الخارج
> بدون تشطيب
>
> **2) علبة دوبلكس بلسان عكسي (Reverse tuck end)**
> المقاس الداخلي: 65 × 55 × 160 مم
> الخامة: كرتون SBS 350 جم
> الطباعة: 4 ألوان من الخارج
> التشطيب: سلوفان مطفي، لصق جانبي
>
> **3) علبة بيتزا**
> المقاس الداخلي: 310 × 310 × 40 مم
> الخامة: كرتون مضلع E أبيض صالح لملامسة الأغذية
> الطباعة: لونان على الغطاء بأحبار مناسبة للأغذية
>
> **4) علبة شحن (RSC FEFCO 0201)**
> المقاس الداخلي: 300 × 200 × 150 مم
> الخامة: كرتون مضلع B كرافت
> الطباعة: لونان فلكسو على الجانبين الطويلين
>
> **5) علبة هدايا صلبة (Rigid) بغطاء وقاعدة**
> المقاس الداخلي: 200 × 150 × 60 مم
> الخامة: كرتون رمادي 1.5 مم مغلف بورق كوشيه 157 جم مطبوع 4 ألوان
> التشطيب: سلوفان مطفي وبصمة ذهبي للشعار على الغطاء
>
> **نرجو في عرض السعر:**
> - سعر القطعة لكل كمية بدون ضريبة القيمة المضافة
> - تكلفة التجهيز والزنكات منفصلة
> - تكلفة الاسطمبة منفصلة، وهل لديكم اسطمبة قريبة من المقاس
> - مدة التنفيذ بأيام العمل من اعتماد الملف
> - تكلفة التوصيل لعنوان واحد في القاهرة
> - مدة صلاحية العرض
>
> لا مانع من الاعتذار عن أي شغلة خارج تخصصكم. شكرا جزيلا لكم، ونتطلع للتعاون.

### 2.2 Follow-up after 48 hours

> السلام عليكم، نذكركم بطلب التسعير الذي أرسلناه يوم [اليوم]. لو كان أسهل نتحدث هاتفيا لمدة 10 دقائق ونكتب الأسعار معكم. شكرا لكم.

### 2.3 Thank you and next step

> شكرا لكم على عرض السعر. سنراجع العروض خلال هذا الأسبوع ونتواصل معكم بخصوص شغلة تجريبية مدفوعة إن شاء الله.

---

## 3. Quote capture sheet (one row per vendor per job per quantity)

Copy into a spreadsheet. Unit prices in EGP ex-VAT.

| Job | Vendor ID | Qty | Unit price (EGP) | Setup + plates (EGP) | Die (EGP) | Existing die? | Delivery Cairo (EGP) | Lead time (working days) | Print method (digital / offset / flexo) | Quote validity (days) | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| R1 | V-01 | 100 | | | | | | | | | |
| R1 | V-01 | 250 | | | | | | | | | |
| R1 | V-01 | 500 | | | | | | | | | |
| R1 | V-01 | 1000 | | | | | | | | | |
| R1 | V-01 | 2000 | | | | | | | | | |

## 4. Margin test (Phase 0 gate)

For each job and quantity, compute:

```
landed_cost  = unit_price x qty + setup + die + delivery
sell_price   = landed_cost / (1 - target_margin)        (target_margin = 0.25 [ASSUMPTION])
sell_unit    = sell_price / qty
market_unit  = typical unit price the customer told us they paid (customer interviews Q8)
```

A job **passes** if `sell_unit <= market_unit x 1.10` for at least 3 vendors (customers in interviews tolerate up to about +10% for proof, guarantee and speed; confirm with H6 in `customer-interview-guide.md`). Record pass/fail per job in the Phase 0 decision memo.

Note that delivery, payment fees (about 3%) and the 3% reprint reserve sit inside the 25% in section 6.2 of the report, so a pass here is necessary but not sufficient. Re-check with the full unit economics before committing.
