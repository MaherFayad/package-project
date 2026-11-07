# Buyer journey simplicity audit (2026-11)

Owner complaint: "The flows are really complicated for a simple Egyptian man." Target user: a small business owner (bakery, perfume shop, online seller) on a phone, Arabic first, low tech literacy. The job: choose a box, put my logo, see the price, pay, receive it.

Scope of this agent: start/picker entry, catalogue components, checkout, payment, orders, account, auth. The designer itself (`src/components/designer/**`) and marketing pages (`src/components/marketing/**`) belong to other agents; findings there are listed as hand-offs only.

Screenshots: `C:\Users\Admin\AppData\Local\Temp\claude\f8173f44571ee159\d92726ee-f788-4602-8df6-7bcebbbfc7a0\scratchpad\flows\` (`before-ar-390-*.png`, `after-ar-390-*.png`). Audit script pattern: a `.tmp-audit.mjs` at the repo root (deleted after use) that opens each page at 390x844 with the `elba_session` cookie and records fields, small tap targets and main text.

## Status

- [x] Audit, phone, Arabic (before)
- [x] Checkout simplification (3 steps, printer chosen for the buyer, remembered address, plain summary, help box)
- [x] Payment page (step 3 of 3, plain method names, compact summary, help box)
- [x] Orders / confirmation (price lines and proof fingerprint behind "details")
- [x] Catalogue jargon (cards show the plain kind, not FEFCO/ECMA codes)
- [x] Checks (tsc, eslint, vitest) and phone walkthrough to a paid order (5 taps)
- [ ] e2e specs other than `e2e/journeys/helpers.ts` still use the old selectors (see "Left")

## Journey map (before)

Returning buyer who already has a design open in the designer (the designer is out of scope):

| # | Screen | Decisions | Fields | Primary action |
|---|---|---|---|---|
| 1 | Designer, "Order" | - | - | طلب |
| 2 | Sign-in gate: phone | - | 1 | إرسال الرمز |
| 3 | Sign-in gate: code | terms + marketing checkboxes, name | 2 + 2 checkboxes | التحقق والمتابعة |
| 4 | Checkout 1/4 "الكمية والمطبعة" | 6 quantity tiles + custom quantity form; 3 printer cards (8 facts each) + "show all" | 1 (custom) | متابعة |
| 5 | Checkout 2/4 "التوصيل" | company tax details toggle | 10 address fields (5 required) | متابعة |
| 6 | Checkout 3/4 "البروفة" | approve checkbox (+ "print as is" override when preflight errors) | 1-2 checkboxes | الموافقة على البروفة والدفع |
| 7 | Payment 4/4: method | 4 methods | - | متابعة |
| 8 | Payment: card form | - | 4 | دفع |
| 9 | Order page (confirmation) | - | - | - |

Checkout to paid, defaults kept, returning buyer: **5 screens, 9 taps, 3 typed fields** (card). The summary shows 11 price lines (product, setup, die, finish, shipping, prepay discount, subtotal, VAT, total, delivery days, price validity).

## Findings (prioritised)

P1 = blocks or confuses the target user; P2 = slows them down; P3 = polish.

| Id | P | Where | Finding | Screenshot |
|---|---|---|---|---|
| SIM-01 | P1 | Checkout step 1 | The buyer must compare 3+ printers with 8 facts each (print method, "custom size: includes die-cutting form", on-time %, rating, production days, delivery days, verified, profile link). A bakery owner cannot judge offset vs digital. The best match is already preselected: the list is noise. | before-ar-390-checkout.png |
| SIM-02 | P1 | Checkout | 4 steps (quantity+printer, delivery, proof, payment) before paying; delivery and proof are separate screens although the proof step is one checkbox. | before-ar-390-checkout.png |
| SIM-03 | P1 | Checkout summary | 11 lines incl. "فورمة التكسير", "التجهيز", "خصم الدفع المقدم", "المجموع الفرعي (دون الضريبة)". The one number that matters (total incl. VAT and shipping) is at the bottom; delivery is "خلال 10 أيام من الدفع", not a date. | before-ar-390-checkout.png |
| SIM-04 | P1 | Checkout | No help contact anywhere in checkout or payment (no WhatsApp, no phone). | all checkout shots |
| SIM-05 | P1 | Proof step | Jargon: "البروفة", "فحص الطباعة", "المنطقة الآمنة", "لسان اللصق", "خط طي", spec table with board grade ("كرتون مضلع E كرافت") and finish codes, a "fingerprint" line. | (step 3) |
| SIM-06 | P2 | Checkout step 1 | Quantity tiles show only the per-box price; the buyer must multiply. The most common quantity (500) is preselected but not labelled as such. The custom quantity form is always open. Tier note "بعد خصم الدفع المقدم 3%" repeats on every card. | before-ar-390-checkout.png |
| SIM-07 | P2 | Delivery step | Address is prefilled from the last order but still shown as a 10-field form every time; landmark, notes and company tax fields add length. Errors say only "مطلوب". | (step 2) |
| SIM-08 | P2 | Primary button | Same label "متابعة" on every step; does not say where it goes. | before-ar-390-checkout.png |
| SIM-09 | P2 | Payment | 4 methods with short help; Fawry not described as cash; the summary repeats the 11-line breakdown. Stepper says 4 of 4. | (pay) |
| SIM-10 | P2 | Catalogue / picker cards | Every card leads with "FEFCO 0427" / "ECMA A20.20.03.01"; the catalogue intro says "من طرازات FEFCO وECMA". | before-ar-390-catalog.png, before-ar-390-picker.png |
| SIM-11 | P2 | Order page | "البصمة 8fc3…" (proof hash), "الإصدار 1" shown to the buyer; 7-step timeline is fine. | before-ar-390-order.png |
| SIM-12 | P2 | Sign-in code step | Returning buyers still see name, terms and marketing checkboxes (terms only needed for new accounts). Kept for now: 7 e2e specs tick the terms box before "verify" (see "Left"). | before-ar-390-login.png |
| SIM-13 | P3 | Tap targets | Inline links under 24 px tall: "عرض ملف المطبعة" (121x17) on each printer card, "تفاصيل السعر" link in the sticky bar. | report json |
| SIM-14 | P3 | Orders list | Search input label measured 1x1 (visually hidden label, fine), filters OK. | before-ar-390-orders.png |

Hand-offs (not this agent's files):
- Designer: `ModelLinks` (picker list on /ar/design) leads each card with FEFCO/ECMA codes (`src/components/designer/ModelLinks.tsx`). The designer's "Order" button goes straight to checkout (good); the price modal is a second, different price display from the checkout tiles.
- Marketing: /ar/start is a long marketing page (7 sections) with the CTA at the top going to the designer (OK, no dead end); its price table and "dieline.pdf" mock use jargon.

## Journey map (after)

| # | Screen | Decisions | Fields | Primary action |
|---|---|---|---|---|
| 1 | Checkout 1/3 "كم علبة تحتاج؟" | 5 quantity tiles (each with the total incl. VAT and delivery, 500 preselected and tagged «الأكثر طلبا») + sample; printer chosen for the buyer, «تغيير المطبعة» optional; «كمية أخرى» opens the custom field | 0 | المتابعة إلى العنوان |
| 2 | Checkout 2/3 "العنوان والموافقة" | remembered address as a card («تغيير العنوان»); 3D preview; one approval tick | 0 (returning) / 5 required (first order) | المتابعة إلى الدفع |
| 3 | Payment 3/3 | 4 methods with plain names («نقدا في فوري», «محفظة إلكترونية (فودافون كاش وغيرها)») | - | متابعة |
| 4 | Card form | - | 3 | دفع |
| 5 | Order page with "paid" banner | - | - | - |

Checkout to paid, defaults kept, returning buyer: **4 screens, 5 taps** (measured by `.tmp-walk.mjs`: continue, tick, continue to payment, continue, pay), down from 5 screens and 9 taps. Summary: 4 lines (boxes, delivery, VAT 14%, total "شامل الضريبة والتوصيل") + the arrival day («تصلك تقريبا يوم الثلاثاء، 17 نوفمبر»), the engine's 9 lines behind «تفاصيل السعر».

Screenshots: `after-ar-390-walk1-quantity.png`, `walk2-review.png`, `walk3-pay.png`, `walk4-card.png`, `walk5-confirmation.png`.

## Changes

| Finding | Change | Files |
|---|---|---|
| SIM-01 | Best-match printer preselected and shown as one line ("تطبعها {printer}، مطبعة مصرية معتمدة اخترناها لك"); full list behind «تغيير المطبعة»; printer cards lose print method, die and on-time facts; profile link gets a 44 px row | `src/app/[locale]/(checkout)/checkout/_components/CheckoutClient.tsx`, `checkout.module.css` |
| SIM-02 | Steps 2 (address) and 3 (proof) merged into "العنوان والموافقة"; stepper is 3 steps incl. payment; browser Back/reload map old step 2 to the merged step | same + `PaymentClient.tsx` |
| SIM-03 | Summary = boxes, delivery, VAT, total incl. VAT and delivery, arrival weekday/date; breakdown, validity and prepay note behind «تفاصيل السعر» (checkout, payment, order page) | `CheckoutClient.tsx`, `PaymentClient.tsx`, `src/app/[locale]/orders/[id]/page.tsx`, `orders.module.css`, new `checkout/_components/arrival.ts` |
| SIM-04 | «تحتاج مساعدة؟» box under the summary on checkout and payment: WhatsApp + call buttons when `ELBA_SUPPORT_PHONE` is set, else "reply to any message we send you" | new `src/lib/support.ts`, new `checkout/_components/HelpBox.tsx`, both checkout `page.tsx` files |
| SIM-05 | Proof wording plain («راجع علبتك», «راجعت التصميم، وأوافق على طباعته كما هو»); spec table, checklist and "recorded with fingerprint" behind «تفاصيل العلبة»; "print check" title dropped, ready state reads «تصميمك جاهز للطباعة»; "fix in designer" is a real button | `CheckoutClient.tsx` |
| SIM-06 | Tiles show the total and per-box price; «الأكثر طلبا» on 500; custom quantity behind «كمية أخرى» | `CheckoutClient.tsx` |
| SIM-07 | Complete remembered address shown as a card; landmark/notes and company tax fields in "(optional)" disclosures; each error says what to write; a saved company without a valid tax number no longer turns the tax fields on (it blocked the seeded buyer) | `CheckoutClient.tsx` |
| SIM-08 | Button says where it goes: «المتابعة إلى العنوان», «المتابعة إلى الدفع» | `CheckoutClient.tsx` |
| SIM-09 | Payment: amount due (incl. VAT and delivery) first, then «كيف تريد الدفع؟» with plain names and one line each; "nothing is charged until you confirm" | `PaymentClient.tsx` |
| SIM-10 | Catalogue and in-designer picker cards show the plain kind instead of the FEFCO/ECMA code (codes still searchable, still on the model page); catalogue intro and search placeholder without codes | `src/components/catalogue/CatalogueBrowser.tsx`, `CataloguePicker.tsx`, `copy.ts` |
| SIM-11 | Order page: proof version and fingerprint behind «تفاصيل العلبة» | `orders/[id]/page.tsx` |
| - | Strings: new `buyer.easy.*` block in `src/i18n/checkout.en.ts` / `checkout.ar.ts`; scopes regenerated (`src/i18n/scopes.generated.ts`) | |
| - | Tests: new `src/lib/__tests__/support.test.ts`; `e2e/journeys/helpers.ts` (`checkoutToPayStep`, `payByCard`) moved to the new flow | |

Nothing changed in pricing, the order state machine, payment rules or server actions: `placeOrderAction` still receives `approved: true`, the address, company and preflight acknowledgement exactly as before.

## Checks run (2026-11-07)

- `npx tsc --noEmit -p .`: clean for these files. The only errors are in `src/app/[locale]/(store)/page.tsx`, which the marketing agent is editing.
- `npx eslint` on every changed file: clean.
- `npx vitest run src/i18n src/components/catalogue src/data/catalogue src/lib/orders src/lib/payments src/lib/__tests__/support.test.ts src/components/marketing/kit/__tests__/arabic-labels.test.ts`: all pass. `src/app/__tests__/css-chunking.test.ts` fails on a patched `node_modules` file, which is unrelated.
- `npx tsx scripts/generate-i18n-scopes.ts`: regenerated. Re-run it if another agent's keys make it stale again.
- Phone walkthrough in Arabic: /ar/checkout/<design> to a paid order in 5 taps with no console errors. English on desktop went through to the card form; the script stopped there because `/^Pay/` also matches "Payment method", which is a script problem, not an app bug.

## Left / follow-ups

1. **e2e specs still use the old 4-step selectors.** They were not run: e2e needs a production build into `.next`, which would break the shared dev server. Only `e2e/journeys/helpers.ts` is migrated. The mapping for the rest (`checkout.spec.ts`, `checkout-states.spec.ts`, `checkout-quote.spec.ts`, `a11y.spec.ts`, `journey.spec.ts`, `security-r6.spec.ts`, `admin-quote-price.spec.ts`, `journeys/j1-brand-orders`, `j2-price-request`, `j5-failure-paths`):
   - `getByTestId("vendor-offer").first()` visible becomes `getByTestId("checkout-total")`. Printer cards only appear after clicking «تغيير المطبعة» / "Change printer"; the chosen printer has `data-testid="chosen-printer"`.
   - The summary filter "Summary" (`checkout.summary.title`) becomes "Your order" (`buyer.easy.summaryTitle`).
   - The 1st "Continue" becomes "Continue to address" (`buyer.easy.actions.toAddress`). The 2nd "Continue" is gone. "Approve proof and pay" becomes "Continue to payment" (`buyer.easy.actions.toPay`).
   - "I approve this proof for printing" becomes `buyer.easy.proof.approve`.
   - With a remembered address, click "Change address" before filling the fields. The company toggle sits inside the "Company tax details for the receipt (optional)" `<details>`: open it first.
   - The Fawry radio "Fawry reference number" becomes "Cash at Fawry" (`buyer.easy.pay.methods.FAWRY`). The payment "Continue" is unchanged.
   - Address errors now read "Write the name of the person who will receive the boxes." and similar, not "Required".
   - The compact stepper reads "Step x of 3".
2. **Support number:** set `ELBA_SUPPORT_PHONE` (an Egyptian mobile number) in the deployment env and add it to `.env.example`. Until then the help box shows the "reply to our messages" fallback.
3. **Sign-in (SIM-12):** show name, terms and marketing only after the server answers `TERMS_REQUIRED`. The server already keeps the code valid for that retry (`src/app/api/auth/verify-otp/route.ts`). This needs the 7 e2e specs that tick terms before "verify" updated in the same change.
4. **Order page:** the item line still shows the board grade («كرتون مضلع E كرافت»). Map it to a plain material name, or move it under the details disclosure.
5. **Hand-offs:** `ModelLinks` on /ar/design (designer agent) still leads with FEFCO/ECMA codes. /start is a 7-section marketing page; the marketing agent should consider a shorter "choose box → logo → price" path.
6. **Not done:** the account page and the orders list were audited and left as they are; there were no P1 findings there.
