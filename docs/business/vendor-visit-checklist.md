# Vendor Visit Checklist

Use on every factory or print-shop visit together with `vendor-interview-guide.md`. Tick each item, write evidence (photo number, document seen). A vendor goes live on Elba only when every **Required** item is ticked and the test job passes.

**Vendor:** ______  **Address / GPS pin:** ______  **Date:** ______  **Visited by:** ______
**Photo folder:** `vendors/V-__/visit-YYYY-MM-DD/` (shared drive, access limited to ops)

> Ask permission before taking photos: "هل تسمحون لنا بتصوير الماكينات والعينات لاستخدامها في صفحة المطبعة على موقعنا؟" Record the answer. Do not photograph other customers' branded work without their permission; blur or skip it.

---

## 1. Legal and admin

| ✔ | Item | Required | Evidence |
|---|---|---|---|
| ☐ | Commercial register extract (مستخرج سجل تجاري), less than 3 months old | Required | copy |
| ☐ | Tax card (بطاقة ضريبية) and VAT registration certificate | Required | copy |
| ☐ | Issues ETA e-invoices, or committed date to start | Required | screenshot of ETA portal or ERP |
| ☐ | Industrial licence / operating licence for the site (رخصة تشغيل) | Recommended | copy |
| ☐ | Bank account in company name for payouts (no personal accounts) | Required | bank letter |
| ☐ | Named contact for orders + backup, both on WhatsApp | Required | names, numbers |
| ☐ | Signed NDA before sharing our rate card logic | Recommended | signed copy |

## 2. Machines (photograph each, plate showing model and year if possible)

| ✔ | Machine | Model / year | Count | Max sheet (mm) | Colours | Notes |
|---|---|---|---|---|---|---|
| ☐ | Offset press | | | | | coater? |
| ☐ | Flexo press (corrugated, inline or post-print) | | | | | |
| ☐ | Digital press (sheet-fed / wide-format on corrugated) | | | | | which substrates |
| ☐ | Flatbed die cutter (تكسير) | | | | n/a | auto or manual feed |
| ☐ | Digital cutting table (sample cutter, no die needed) | | | | n/a | good for samples and 50 to 250 runs |
| ☐ | Folder gluer | | | | n/a | crash-lock capable? |
| ☐ | Laminator (سلوفان) matte / gloss | | | | n/a | |
| ☐ | UV coater / spot UV screen | | | | n/a | |
| ☐ | Corrugator (own board) or buys sheets | | | | n/a | board supplier name |
| ☐ | Plate making (CTP) in house or outsourced | | | | n/a | |

Map each machine to our codes in `src/types/vendor.ts`: OFFSET, FLEXO, DIGITAL, DIE_CUTTER, FOLDER_GLUER, LAMINATOR, UV_COATER.

## 3. Capabilities and minimums

| ✔ | Item | Answer |
|---|---|---|
| ☐ | Structures produced: FEFCO_0427 mailer / FEFCO_0201 RSC / ECMA_RTE / ECMA_STE / PIZZA / SLEEVE / rigid | |
| ☐ | Materials: E-flute kraft / E-flute white / B-flute kraft / SBS 300 / SBS 350 / other | |
| ☐ | Finishes: none / matte lamination / gloss lamination / spot UV / foil | |
| ☐ | Max colours, print sides (outside only / inside too) | |
| ☐ | Minimum order per structure (units) | |
| ☐ | Digital vs offset/flexo breakpoint (units) per structure | |
| ☐ | Monthly capacity for our size range (units) | |
| ☐ | Service area for delivery (our `EgyptCity` codes) | |

## 4. Dies

| ✔ | Item | Answer |
|---|---|---|
| ☐ | List of existing dies with inner dimensions L x W x H mm (photo of die rack and list) | |
| ☐ | New die cost range (EGP) and lead time (days) by structure | |
| ☐ | Die ownership when customer pays: customer / vendor / Elba. Target: **Elba owns, vendor stores** | |
| ☐ | Die storage period and condition (labelled, dry) | |
| ☐ | Will release a die we paid for to another vendor on request | |

## 5. Quality control

| ✔ | Item | Required | Evidence |
|---|---|---|---|
| ☐ | Colour management: proofs against a standard (ISO 12647 / FOGRA), spectrophotometer or at least a light booth | Recommended | photo |
| ☐ | Pre-press checks files (bleed, CMYK, dieline layer) before plates | Required | ask for their checklist |
| ☐ | First-sheet approval routine (OK sheet signed) | Required | sample OK sheet |
| ☐ | Agrees to send QC photos: first printed sheet, 3 finished boxes (front, open, side), packed bundle with label | Required | yes / no |
| ☐ | Counts and packs in bundles with a label (job no., qty) | Required | photo |
| ☐ | Reprint rate in the last 6 months (their estimate) | Required | % |
| ☐ | Clean, dry storage away from floor (corrugated absorbs moisture) | Required | photo |
| ☐ | Waste / overrun policy (do they deliver +/- 5%?) | Required | answer |

## 6. Food contact (only for vendors who will serve F&B)

| ✔ | Item | Required for "food-safe" badge | Evidence |
|---|---|---|---|
| ☐ | Board supplier declaration that the board is suitable for food contact (virgin fibre or certified recycled), dated and per grade | Required | copy |
| ☐ | Ink and varnish supplier declaration: low-migration / food packaging inks | Required | copy |
| ☐ | Migration test report from an accredited lab for the board + ink combination we will sell | Required | report no. |
| ☐ | Compliance with NFSA Decision 17/2022 (Binding Technical Rules for Food Contact Materials) confirmed by vendor | Required | signed statement |
| ☐ | ISO 22000 / FSSC 22000 or GMP certificate for the line | Recommended | copy, validity |
| ☐ | Separate area / cleaning procedure for food packaging runs | Recommended | photo |

If any **Required** item is missing, the vendor can still produce F&B boxes that do **not** touch food directly (outer delivery boxes, sleeves over trays) but must not carry the `FOOD_SAFE` certification on their profile.

## 7. Commercial terms

| ✔ | Item | Answer |
|---|---|---|
| ☐ | Current payment terms with other customers | |
| ☐ | Accepts Elba terms: 40% advance at acceptance, 60% within 7 days of QC approval and delivery [ASSUMPTION: confirm in framework agreement] | |
| ☐ | Quote validity they can hold for us (we show customers 72 h) | |
| ☐ | Accepts non-solicitation of Elba customers | |
| ☐ | Accepts reprint at own cost for vendor-caused defects | |
| ☐ | Delivery: own van / courier / pickup; cost per drop in Cairo | |
| ☐ | Spare capacity for Elba jobs per month | |

## 8. Portfolio photo set (for the vendor profile)

Shoot in landscape, good light, no faces without consent, no third-party brands without permission.

- ☐ Factory exterior or sign (if they agree)
- ☐ Each main machine (wide + detail)
- ☐ 5 to 10 sample boxes on a neutral background: closed, open, detail of print and finish
- ☐ Die rack
- ☐ QC area / light booth
- ☐ Packed bundles ready for dispatch

## 9. Test job and decision

| ✔ | Item | Answer |
|---|---|---|
| ☐ | Test job chosen (one of R1 to R5) and paid at quoted price | job no. |
| ☐ | Delivered on time (promised vs actual days) | |
| ☐ | Passed our QC: colour, registration, cut accuracy within 1 mm, crease quality, glue, count | pass / fail |
| ☐ | QC photos sent as agreed | |

**Overall score (1 to 5):** quality __ price __ speed __ reliability __ communication __
**Decision:** onboard / onboard after fixes (list) / reject
**Signed off by (ops lead):** ______ **Date:** ______
