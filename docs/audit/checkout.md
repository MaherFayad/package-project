# Audit: buyer journey after design (key: checkout)

Scope: `src/app/[locale]/(checkout)`, `src/app/[locale]/orders`, `src/app/[locale]/(store)/account`, `src/app/[locale]/s`, their components, buyer i18n keys (additive `buyer.*` block in `src/i18n/checkout.{en,ar}.ts`).

Method: walked the journey as a first-time Egyptian D2C brand owner with Playwright (390x844 and 1440x900, `ar` and `en`): sign-in gate, saved designs, quantity + printer, delivery address (empty, invalid, valid), proof (3D + flat, approval required), mock payment (declined card, then paid), success, order tracking, invoice, orders list, account, share link (owner copy, anonymous visitor, unknown token), not-found states, >2,000 manual quote, unpaid-order cancel. axe-core (WCAG 2.0/2.1/2.2 A + AA tags) on every screen. Before/after screenshots: `docs/screenshots/audit/checkout/`.

Step count (phone, design saved to paid): before 9 taps + full re-entry of the card after a decline; after 7 taps, card form kept on decline. Scroll to the primary action on phones: before ~1,700px on step 1; after 0 (sticky bar).

## Findings

| id | severity | page / file | finding | standard | fix | status |
|---|---|---|---|---|---|---|
| CO-01 | critical | `/orders` (IndexFilters → `components/ui/Tabs.tsx`) | View tabs set `aria-controls` to a tab panel that is never rendered; axe `aria-valid-attr-value` (critical) on every orders page. | WCAG 4.1.2 | `aria-controls` only when a panel is rendered for the selected tab (out-of-scope file, one line). | fixed |
| CO-02 | critical | payment declined (`components/ui/Button.module.css`) | A loading button hides its label with `visibility:hidden`, so the busy primary "Pay" button has no accessible name; axe `button-name` (critical). | WCAG 4.1.2 | Hide with `opacity:0` instead (label stays in the accessibility tree). Out-of-scope file, one line. | fixed |
| CO-03 | high | checkout, all steps (phone) | The only primary action sits under three offer cards and the full price breakdown: about 1,700px of scroll on 390px before "Continue". | ISO 9241-110 (efficiency), Polaris checkout pattern | Sticky bottom action bar below 1040px with the live total, "View price breakdown" and the primary button (same button element as desktop, so tests and focus order are unchanged). Hidden when there is no offer. | fixed |
| CO-04 | high | checkout stepper (phone) | Vertical 4-step stepper takes ~300px above the fold on every step. | ISO 9241-110 | Compact progress on phones: "Step 1 of 4", "Next: Delivery", 4-segment bar; full stepper from 640px. | fixed |
| CO-05 | high | checkout, custom quantity | "Apply" truncated to "A…" / "تط…" at every width; Enter in the field did nothing; `type=number` rejected Arabic-Indic digits and commas. | WCAG 1.4.10, 3.3.2 | Real `<form>` (Enter submits), button keeps its width, text input with numeric keypad, accepts `٢٠٠٠` and `2,000`, range hint "1 to 2,000". | fixed |
| CO-06 | high | checkout, >2,000 boxes | Dead end: banner says "we reply within one working day" but there is no quote request behind it and no action; the primary button is disabled. | ISO 9241-110 (error tolerance) | Round 1: honest copy plus "Order 2,000 boxes now". Round 2: real price request (see R2-01). | reopened (round 2), fixed |
| CO-07 | high | payment, declined card | A decline threw the buyer back to the method list: tap Continue again and retype every field. | ISO 9241-110 (error tolerance), WCAG 3.3.1 | Open a fresh attempt with the same method automatically, keep expiry / CVC / name, clear only the number, show the error on the number field and focus it ("Nothing was charged"). The form stays busy until the new attempt exists (no race). e2e updated to the shorter path; assertions kept. | fixed |
| CO-08 | high | `/orders` (phone) | Index table clips on 390px: total, payment and status are scrolled off-screen, so the list shows only number, date, printer. | WCAG 1.4.10 | Phone layout: one tappable card per order (number, total, date · printer · boxes, status badge, chevron); table from 640px. Shared filters. | fixed |
| CO-09 | high | order page after payment | The success moment led with "Reorder" as the primary action and a one-line banner; no "what happens next". | ISO 9241-110 (self-descriptiveness) | Success banner (one 300ms entrance, off under reduced motion) with printer, estimated delivery date and 3 next steps. Reorder becomes primary only once delivered; before that a quiet tertiary action. | fixed |
| CO-10 | high | order page, cancelled | Cancelled order showed a "Pending" payment badge and "Due EGP 24,199.35", plus "print file is prepared after payment"; the banner had no way forward. | ISO 9241-110 | Hide payment-pending badge, due row and print hint on cancelled/refunded orders; banner action "Order this design" (restarts checkout with the same design). | fixed |
| CO-11 | medium | checkout chrome | Full store navigation and marketing footer around checkout pull attention away at the moment of highest intent. | Polaris checkout (screen 19) | Focused `CheckoutShell`: wordmark, lock + "Secure checkout", language switch, compact legal footer (returns, privacy, terms, VAT note). Cookie notice kept (PDPL). Orders/account keep the store chrome. | fixed |
| CO-12 | medium | checkout + payment summaries | No subtotal before VAT: the 14% line had no visible base, unlike the invoice (net, VAT, total). | Egyptian VAT 14%, ETA e-invoice layout | "Subtotal (excl. VAT)" line before VAT in both summaries. | fixed |
| CO-13 | medium | checkout totals | Totals changed silently when quantity, printer or governorate changed; nothing announced to screen readers. | WCAG 4.1.3 | 250ms price tick on changed amounts (skipped on first paint and under `prefers-reduced-motion`), polite status "Total updated: EGP …". | fixed |
| CO-14 | medium | checkout quantity tiers | 5 tiers in an auto-fill grid left an orphan card (4+1 desktop, 2+2+1 phone). | Polaris layout rhythm | One row per tier on phones (quantity left, price per box right); one column per tier from 490px. | fixed |
| CO-15 | medium | offer cards (phone) | Price block wrapped under the name and floated centre. | Visual hierarchy | Two-column head (name + badges / price + per box), price column capped. | fixed |
| CO-16 | medium | payment, cancel order | `window.confirm` (unstyled, browser language, no context). | Polaris modal (screen 20), WCAG 3.3.4 | Modal: "Cancel this order?", explains nothing is charged and the design stays saved; "Keep order" / destructive "Cancel order". | fixed |
| CO-17 | medium | payment, method step (phone) | The amount is only in the summary card below the fold when choosing a method. | ISO 9241-110 | "Amount due now" box right above Continue. | fixed |
| CO-18 | medium | payment, card form | Expiry placeholder "12/30" read as a pre-filled value (worse in Arabic); card number not grouped. | WCAG 3.3.2 | Placeholders "0000 0000 0000 0000" and "MM/YY"; number grouped in fours, slash inserted after the month, Arabic-Indic digits accepted. | fixed |
| CO-19 | medium | account, recent orders | Own status-tone table disagreed with the orders list (different tones and progress icons for the same status). | Consistency (Polaris badges) | Uses the shared `statusBadge()`. | fixed |
| CO-20 | medium | account, saved designs | Journey dead-ends at "Open in designer"; no way to order a saved design from the account. | ISO 9241-110 | "Order" button per design (to `/checkout/[id]`); "Open in designer" becomes plain. | fixed |
| CO-21 | medium | share link `/s/[id]` → checkout | Every tap on "Order this box" created another copy in the visitor's saved designs; the page did not say a copy is made or that sign-in comes first. | ISO 9241-110 | Reuse an identical copy the visitor already owns (same structure, dims, material, finish, artwork); helper text "Ordering gives you your own copy…" and, when signed out, "You will sign in with your mobile number first". | fixed |
| CO-22 | medium | checkout start list | "Order this design" was a secondary button next to a link; no clear primary. | Polaris (one primary per card) | Primary. | fixed |
| CO-23 | low | proof viewer (phone) | Seven 44px view controls wrapped to two rows (reset alone) on 390px. | Visual polish (targets stay 44px, WCAG 2.5.8) | Tighter toolbar gap/padding on phones; one row. | fixed |
| CO-24 | low | account header | New accounts see a bare "Hello" with no hint. | UX copy | Hint to add a name in Profile. | fixed |
| CO-25 | low | phone order cards | Pending orders showed both "Awaiting payment" status and a "Pending" payment badge. | Copy redundancy | Payment badge on cards only when refunded. | fixed |
| CO-26 | high | checkout (phone), pass 2 | Found by the mobile e2e: on a first visit the cookie notice sat on top of the new sticky action bar and swallowed the tap on "Continue". | WCAG 2.4.11 | Inside the checkout shell the notice is lifted above the bar whenever a sticky action is present (`:has([data-sticky-action])`); store pages unchanged. | fixed (reopened, then fixed) |
| CO-27 | medium | checkout (phone), pass 2 | Tabbing to fields near the bottom could scroll them under the fixed bar. | WCAG 2.4.11 | `scroll-padding-block-end` on the document while the bar exists. Keyboard walk: 18 stops on step 1, none under the bar, radios one tab stop per group. | fixed |
| CO-28 | low | `checkout/loading.tsx`, pass 2 | Skeleton was a single column, so the 2/3 + 1/3 layout jumped in when prices arrived (CLS). | CLS < 0.1 | Skeleton mirrors the step card + summary grid. | fixed |
| CO-29 | low | proof viewer fold control | The 100% fold state said "Closed" for open-top models (trays, open styles), which never close. Raised by the integrator to match the designer. | UX copy consistency | "Assembled" / "مجمعة" when the model is open-top (flag read defensively); `designer.view.assembled` added with the same key and values as the designer branch. | fixed |
| CO-30 | critical | `/checkout/[designId]`, `/s/[id]` (perf, raised by the integrator as PERF-03b) | First-load JS 483 KB (checkout) and 474 KB (share): `docSpec` and the proof/share viewers pulled the whole model library, dieline engine and three.js into the initial bundle. | Core Web Vitals (INP/LCP on phones) | `docSpec(doc)` computed on the server and passed as strings; `ProofViewer` loaded with `next/dynamic` only on the proof step; share viewer loaded the same way through `s/[id]/SharedViewerLazy.tsx`; placeholders keep the viewers' footprint. Build: checkout **150 KB**, share **138 KB**. | fixed |
| CO-31 | critical | `orders/loading.tsx` (perf, PERF-01) | Short skeleton streamed first, the footer sat in the first viewport and jumped when the order page arrived: CLS 0.93 on order tracking. | CLS < 0.1 | Removed `orders/loading.tsx` (pages answer in tens of ms); checkout, account and share fallbacks fill the first viewport (`min-block-size: 100dvh`). Measured CLS: tracking 0.000 (ar/en), checkout 0.000, orders 0.000, account 0.000, share 0.003 (390) / 0.008 (1440). | fixed |

Counts: critical 4, high 9, medium 13, low 5 (31 total). Fixed 31 (CO-06 partially, see below).

Pass 2 checks: axe 0 violations on all 21 screens x 4 (390/1440 x ar/en), no horizontal overflow; keyboard-only walk of step 1; `prefers-reduced-motion: reduce` runs zero animations (price tick, success entrance, segments off); live total announced ("Total updated: EGP 17,969.25").

## Open / outside scope (reported, not changed)

- **Manual quote request (>2,000 boxes)**: there is no endpoint or admin queue to request a hand-priced quote, and no support WhatsApp number in config. Needs the technical session (API + `NEXT_PUBLIC_SUPPORT_WHATSAPP` or a quote request model). The UI now avoids the dead end and the false promise.
- **Cookie notice** (`components/store/CookieNotice`, storefront owner) still covers bottom content on store pages until dismissed; inside checkout it is now lifted above the action bar (CO-26).
- **Flaky `e2e/smoke.spec.ts:16`** (auth area): clicks "Send code" before the login form hydrates, so it fails about 1 run in 8 under `next start`. `checkout.spec.ts` already retries the fill until the button is enabled; smoke should do the same.
- **Page "More actions" popover in RTL on phones** opens at the top of the viewport over the top bar instead of under the ⋯ button (`components/ui/Page` / `Popover`, UI-kit owner).
- **Designer price modal and soft sign-up gate** live in `src/components/designer` (designer session). Not changed here.
- Seeded and API-created designs have no thumbnail, so checkout/account lists show the placeholder icon (thumbnail generation is designer-owned).

## Files touched outside scope

- `src/components/ui/Tabs.tsx` (one line, CO-01)
- `src/components/ui/Button.module.css` (one line, CO-02)
- `src/i18n/designer.{en,ar}.ts`: `view.assembled` (identical to the designer branch, CO-29)
- `e2e/checkout.spec.ts` (decline step follows the shorter flow; all assertions kept, one added)


## Round 2

Base: round 1 fixes of every area merged (`b240eba`). Walked again as a first-time Egyptian D2C brand owner on a phone, then on desktop: share link (anonymous, signed-in non-owner, owner, unknown token), soft gate (checkout while signed out → login with `next`), checkout start (empty and with a design), steps 1 to 3 (tiers, custom quantity incl. Arabic-Indic digits, >2,000, empty and invalid address, proof), payment (methods, card, declined, paid), success, invoice, orders list (empty, seeded), order tracking (5 seeded statuses, unknown id), account (empty, seeded). Script: 27 screens x ar/en x 390/1440 = 108 captures, plus the new quote screens (16). axe-core (WCAG 2.0/2.1/2.2 A + AA) and horizontal-overflow check on every capture.

### Round 1 re-verification

| id | result |
|---|---|
| CO-01, CO-02 | axe 0 violations on all 108 captures (both were axe criticals). Still fixed. |
| CO-03, CO-26, CO-27 | 390px viewport: sticky bar with total + "Continue" on every step; on a first visit the cookie notice sits above the bar, not on it (`round2/after/vp-ar-390-step1-cookie.png`). Still fixed. |
| CO-04, CO-05, CO-14, CO-15, CO-17, CO-18, CO-22, CO-23 | Seen in captures; custom quantity accepts `٥٠٠٠` and `5,000`; Enter submits. Still fixed. |
| CO-06 | Reopened: the "Order 2,000 boxes now" action avoided the dead end, but a brand that needs 5,000 boxes still had no way to ask for a price, and the copy "Above 2,000 boxes we price by hand" promised a service with nothing behind it. Fixed in R2-01. |
| CO-07 | e2e decline → retry on the same form passes (desktop + mobile). Still fixed. |
| CO-08, CO-19, CO-25 | Orders cards on 390, shared status badges. Still fixed. |
| CO-09, CO-10 | Success banner with date and 3 next steps; cancelled order hides due/pending. Still fixed. |
| CO-11, CO-12, CO-13, CO-16, CO-20, CO-21, CO-24, CO-28, CO-29 | Checked in captures / code. Still fixed. |
| CO-30, CO-31 | Build: checkout 151 KB, pay 146 KB, orders 144 KB, order 145 KB, account 148 KB, share 138 KB first-load JS (all < 200 KB). Perf numbers below. Still fixed. |

### Findings

| id | severity | page / file | finding | standard | fix | status |
|---|---|---|---|---|---|---|
| R2-01 | high | checkout step 1, >2,000 boxes (`CheckoutClient.tsx`, `checkout/actions.ts`) | Completes CO-06. Above the instant cap the buyer could only drop to 2,000; no way to ask for the larger run, and the summary showed a disabled "Continue" with "Choose a quantity and printer". | ISO 9241-110 (task suitability, error tolerance) | **Price request**: in place of the offers, a panel "Request a price for 5,000 boxes" explains the 2,000 instant cap, that a request is free and does not commit, takes an optional note (500 chars: batches, target date, budget) and says where we reply (WhatsApp/SMS on the account phone, LTR-isolated in Arabic). "Order 2,000 boxes now" stays as the plain alternative. On send: success banner (announced, focused) "Price request sent for 5,000 boxes" with "View my requests". The summary says large orders are priced by the team; the disabled Continue and sticky bar are gone in this mode. Server: `requestQuoteAction` (session, zod, owner check through `loadCheckoutDesign`, quantity 2,001 to 1,000,000, 5 per hour per user) stores a `Quote` with status `REQUESTED`, zero totals and one product line carrying the quantity, open for 72 h, and writes a `QUOTE_REQUEST` / `QUOTE` audit row (quantity, governorate, note) so operations see it in `/admin/audit`. Re-sending the same quantity for the same design within 72 h returns the open request (no duplicates). No schema change. e2e added. | fixed |
| R2-02 | medium | account (`account/page.tsx`) | After a price request there was nowhere to see it. | ISO 9241-110 (self-descriptiveness) | "Price requests" card (anchor `#quote-requests`): "5,000 boxes · design name", sent date, badge "Waiting for price" (attention) or "Closed" after 72 h, and "We reply to each request within one working day". Only shown when the buyer has requests. | fixed |
| R2-03 | medium | payment (`PaymentClient.tsx`) | Steps 1 to 3 show "Step n of 4" (phone) or the stepper (desktop); the payment page, step 4, showed neither, so the buyer lost the sense of being on the last step. | ISO 9241-110 (self-descriptiveness), Polaris checkout | Same stepper on desktop (current: Payment) and the compact "Step 4 of 4 · Next: printing" bar on phones. | fixed |
| R2-04 | medium | account saved designs, 390px | The name was truncated to "E2E m…" and the meta wrapped to five lines because three actions shared the row. | WCAG 1.4.10 (reflow), visual hierarchy | Below 640px the actions move to their own row aligned with the text (local `account.module.css`, the shared store stylesheet is untouched). | fixed |
| R2-05 | medium | order tracking, payment card (`orders/[id]/page.tsx`) | CO-12 added "Subtotal (excl. VAT)" to checkout and payment, but the order page went straight from lines to VAT 14%: no visible base for the tax, unlike the invoice. | Egyptian VAT 14%, ETA e-invoice (net, tax, total) | "Subtotal (excl. VAT)" line with the same top rule as checkout. | fixed |
| R2-06 | low | share link, owner (`s/[id]/page.tsx`) | The owner opening their own link read "Ordering gives you your own copy…" (they order the original) and got "Design your own" (a blank design) as the second action. | UX copy accuracy | For the owner: "This is your design. Anyone with this link sees this read-only page and can order their own copy." and "Open in designer" on this design. Visitors unchanged. | fixed |
| R2-08 | high | share link `/s/[id]`, phone (`SharedViewerLazy.tsx`, `share.module.css`) | Phone LCP 11.4 to 11.8 s: the placeholder shown while the 3D chunk loads was an empty grey box, so the LCP became the 3D scene's poster after ~775 KB of 3D JS. | Core Web Vitals LCP < 2.5 s | The server-rendered placeholder now shows the model poster (`fetchpriority=high`, same footprint, `lazy` + `Suspense` so the poster comes from props, not shared module state). It is a hair wider than the 3D poster so the first paint of the box stays the LCP. Phone LCP **3.46 s (en) / 4.02 s (ar)**, CLS 0.001; the rest is FCP (see Open). | fixed |
| R2-07 | low | Arabic copy (`buyer.shareSignIn`) | "برقم الموبايل" while every form label says "رقم المحمول" (platform P-25). | Terminology consistency | "ستسجل الدخول برقم المحمول أولا، ويستغرق ذلك دقيقة." | fixed |

Counts (round 2): high 2 (+ CO-06 reopened), medium 4, low 2: 8 new findings, all fixed; CO-06 now fully fixed.

Pass 2 checks (after the fixes, rebuilt with `next build`): walk of all 108 screens again, axe 0 violations and 0 px horizontal overflow on every one; new quote form / sent / account screens (ar/en x 390/1440) axe 0; focus moves to the sent banner; `٥٠٠٠` accepted as 5,000; the phone number renders `012 3352 1195` in the Arabic sentence (isolated).

Pass 2 (round 2): `npm run lint`, `npm run typecheck` clean; `npm test` 54 files / 6,245 tests pass; `next build` ok; e2e `checkout`, `journey`, `smoke` (`--workers=2 --trace off`, desktop + mobile): 15 passed, 1 skipped by the journey spec itself on mobile. Keyboard only on the price request: quantity field → Enter → Tab order Apply, note, "Request a price", "Order 2,000 boxes now"; Enter on "Request a price" sends and moves focus to the sent banner (visible ring). Under `prefers-reduced-motion: reduce` only the focus-ring transition runs (no entrance or price motion). Share link as its owner: owner copy and "Open in designer", 0 px overflow (`round2/after/ar-390-share-owner.png`).

### Performance (round 2, `docs/audit/tools/perf-pages.mjs`, `next start`)

Phone = 390x844, DPR 2, 4x CPU, Slow 4G (562 ms RTT); desktop = 1440x900, no throttling. First-load JS from `next build` (gzip): checkout 151 KB, pay 146 KB, orders 144 KB, order 145 KB, account 148 KB, share 137 KB (3D chunk lazy).

| page | profile | LCP (en / ar) | CLS | INP | LCP element |
|---|---|---|---|---|---|
| checkout | desktop | 180 / 232 ms | 0.000 | 32 / 24 ms | first text |
| checkout | phone | 3.14 / 3.71 s | 0.024 / 0.000 | 128 / 96 ms | cookie notice text (= FCP) |
| order tracking | desktop | 164 / 196 ms | 0.000 | n/a / 24 ms | first text |
| order tracking | phone | 3.15 / 3.24 s | 0.000 | 48 ms | cookie notice text (= FCP) |
| share | desktop | 616 / 676 ms | 0.008 | 160 ms | model poster |
| share | phone | 3.46 / 4.02 s (was 11.4 / 11.8 s) | 0.001 | 104 / 128 ms | model poster (placeholder) |

All CLS and INP within budget. Phone LCP equals FCP on checkout and tracking: it is bound by Slow-4G round trips for the HTML, render-blocking CSS (65 to 73 KB) and the Arabic/Latin fonts (118 to 151 KB), and the LCP element is the shared cookie notice (PERF-07, storefront owner). Nothing in these pages' own code delays it; see Open.

### Open / outside scope (round 2)

- **Admin queue for price requests**: requests are stored (`Quote.status = REQUESTED`) and logged (`/admin/audit`, entity `QUOTE`, action `QUOTE_REQUEST`), but there is no admin screen to price one and send it back, and no outbound WhatsApp/SMS. Needs the admin owner (list `REQUESTED` quotes, enter price, mark priced) and the notifications owner. Until then the account badge stays "Waiting for price" and turns "Closed" after 72 h.
- **Soft gate copy**: the login page reached from checkout says "Sign in or create a free account" with no mention of the box being ordered or that the design is kept (auth owner, `components/auth`).
- **Two store headers**: the share page and orders use the dark store header, the account page the marketing header (storefront / marketing owners).
- **Phone LCP 3.1 to 3.7 s on checkout / tracking** (budget 2.5 s): LCP = FCP = the shared cookie notice text after fonts and CSS on Slow 4G. Needs the shell owners: SSR the notice decision (PERF-07), `font-display`/subset the Arabic font, inline critical CSS.
- `statusBadge(PAID)` renders yellow (attention) in the account and orders lists although payment is done (shared `lib/orders/state`).

### Files touched outside scope (round 2)

- `e2e/checkout.spec.ts`: one new test (price request → account); existing tests unchanged.
- None in `src` outside the checkout scope (account styles live in a new local `account.module.css`; the share placeholder is in `s/[id]`).

## Round 3

Base: main branch with every round 2 branch merged and `docs/audit/ROUND3.md` (`d1ea599`), merged into this branch. Work list for checkout: CR-08, CR-09, CR-19, CR-22, CR-23, CR-34, CR-35, CR-48, CR-51, CR-59 (`craft.md`), X-01 (`a11y.md`), B-04, B-05, B-11, B-13, B-14, B-15 (`business.md`). X-06 (`a11y.md`, filed under designer) is in `s/[id]/page.tsx`, a checkout-scope file, so it is fixed here too.

### Findings

| id | severity | page / file | finding | standard | fix | status |
|---|---|---|---|---|---|---|
| CR-08 | high | `lib/orders/status-tone.ts`, `lib/orders/state.ts`, orders list/detail, account | Same status, different badge tone per area (Paid yellow in the buyer list, grey elsewhere; Delivered green in admin, grey in vendor). | Consistency; WCAG 1.4.1 | One map in `src/lib/orders/status-tone.ts`. After merging the vendor branch this is the vendor session's file (`STATUS_TONE`, `statusTone()`, `PROBLEM_TONE`), extended here with `paymentTone()` (Paid = neutral, complete; Pending = attention; Failed/Refunded = critical), `ToneSpec` and `DISPUTED_TONE`. Status PAID is "awaiting printer" (attention) in that map, so buyer screens label it "Awaiting printer" / "بانتظار المطبعة", and "Paid" appears only as the neutral payment badge: "Paid" is never yellow. `statusBadge()` in `state.ts` delegates, so admin `OrdersIndex` matches; vendor jobs use the map. Unit tests in both sessions. | fixed |
| CR-09 | high | order line, account designs, checkout start list | Missing renders showed the broken-image glyph. | Polish, trust | `modelPoster(modelCode, structureCode)` (`lib/orders/poster.ts`, server only) gives the model's catalogue drawing as the fallback. Seeded `ELB-26001` now shows the mailer drawing. | fixed |
| CR-19 | medium | checkout summary, offer cards | Totals swapped with no tick, unlike the designer badge. | Motion consistency | `Tick` keyed on the value with the designer's motion (300 ms, 4 px rise from 40% opacity, ease-out), so the new figure animates in the frame it appears; on the summary subtotal, VAT, total, the sticky total, each offer price and the per-box figure. Only the number ticks, not the words around it (the CR-20 lesson). Off under reduced motion. | fixed |
| CR-22 | medium | pay button (`PaymentClient.tsx`) | Busy Pay button went flat grey with only a spinner. | WCAG 4.1.3; craft | Keeps the brand fill (not disabled; repeat submits ignored), leading 16 px spinner + "Paying…" / "جار الدفع…", `aria-busy` on the form. Verified: label "Paying…", `aria-busy=true`, button enabled. The shared `Button loading` style is unchanged (UI-kit owner). | fixed |
| CR-23 | medium | `/orders/[id]?paid=1` (`PaidHeader.tsx`, new) | Saturated green banner, focus left at the top. | Craft; WCAG 2.4.3 | White success header card: 32 px check drawn with `stroke-dashoffset` (300 ms ease-out, 120 ms delay, static under reduced motion) on a `bg-surface-success` disc (the tint is on the icon only, so the card stays calm), title "Payment received…", delivery promise, "What happens next" list. Focus moves to the heading once (verified: `activeElement = paid-title`, ar and en). | fixed |
| CR-34 | medium | order timeline | Timeline outside the card system; 24 h times. | Consistency | Card titled "Activity" / "سجل النشاط"; times use the same locale as `formatDateTime` (`en-EG` → "6:01 AM", `ar-EG` → "6:01 ص"). | fixed |
| CR-35 | medium | orders list (phone cards + table), account recent orders | "14,913" next to "6,976.80". | Polaris numeric columns | Always two decimals in lists (`alwaysDecimals`), tabular figures on the list containers. Two decimals rather than none so list totals match the invoice to the piaster (ETA). | fixed |
| CR-48 | low | checkout back button | Accessible name "Back: Back". | WCAG 2.5.3, 4.1.2 | `Page` prefixes "Back:", so the content is now the previous step: "Back: Quantity and printer" / "رجوع: الكمية والمطبعة". | fixed |
| CR-51 | low | offer card per-box price | "(excl. / VAT)" broke inside the parenthesis. | Typography | No-break space inside "(excl. VAT)" / "(دون الضريبة)". | fixed |
| CR-59 | medium | `prisma/seed.ts` `ELB-26001` | Line "500 × 24.70 = 12,350" vs "Printed boxes 12,950" (setup folded into the subtotal, VAT not on delivery). | Trust; ETA lines must reconcile | Seed stores it like `placeOrder()`: subtotal = goods + delivery, VAT 14% on that, total = subtotal + VAT; payment and invoice follow. Now 12,350 + 150 = 12,500, VAT 1,750, total 14,250. | fixed |
| X-01 | high | payment method step | After "Continue" focus fell to `<body>`. | WCAG 2.4.3, 4.1.3 | Focus moves to the card number (card) or to the method heading `#payment-step-heading` (wallet, Fawry, InstaPay). Verified with keyboard Enter: `activeElement = card-number`. | fixed |
| X-06 | medium | share link not found | No `h1`. | WCAG 1.3.1, 2.4.6 | `Page title` set to the not-found title. | fixed |
| B-15 | high | checkout + lead data | Round 2 added the request; ROUND3 asks for a lead the admin can work from. | Plan §4.1 step 4 | The request now also captures a "Needed by" date, and its audit row stores the buyer phone and a spec snapshot (structure, model, dims, board, finish, sides). `listQuoteRequests()` in `src/lib/orders/quote-requests.ts` (server only) returns each lead with buyer, quantity, governorate, deadline, note, spec, `dueAt` (24 h SLA) and `validUntil` for the admin inbox. | fixed (checkout half); admin inbox: admin owner |
| B-13 | high | delivery step, invoice, `lib/eta` (new) | No place for a company name or tax number; no ETA seam. | Egyptian e-invoicing (ETA), VAT Law 67/2016 | "I need a company tax invoice" in the delivery step: company name, tax registration number (9 digits; dashes, spaces and Arabic-Indic digits accepted, shown as 123-456-789), commercial register (optional). Validated on the client and in `placeOrderAction` (zod), saved on the buyer's `Organization` (created or updated), prefilled next time, printed on the invoice (verified: "Nour Candles LLC", "123-456-789"). `src/lib/eta/index.ts` is the documented adapter seam (`EtaAdapter`, `pendingEtaAdapter`, receiver type B/P); nothing is sent yet. | fixed (seam only; live ETA submission: platform/technical) |
| B-05 | high | checkout step 1, `lib/orders/sample.ts` (new), service | No paid physical sample. | Plan §1.3 bridge 4, §6.1 | A "Sample · 5 boxes" option under the tiers: fixed price (default EGP 750 + VAT) plus the chosen printer's delivery, digital print, 3 production days, no prepay discount. It runs the normal flow (address, proof, payment). The goods price is credited once, as a "Sample credit" discount line with VAT recomputed on the lower base, on the buyer's next order of the same design within 60 days of paying for the sample (banner "Sample credit EGP 750 applied, valid until …"; capped at the goods, never delivery). Markers in the order timeline: `SAMPLE_ORDER`, `SAMPLE_CREDIT:<n>`, `SAMPLE_CREDITED:<n>`; a cancelled order releases the credit. Monthly platform cap (default 100). Verified end to end: sample EGP 998.64 paid, next order shows the credit and pays less. | fixed (admin cap/cost screen: admin owner) |
| B-11 | medium | `lib/orders/checkout-settings.ts` (new), checkout, `.env.example` | Prepay discount defaulted to 0%. | Plan §7.3 | Default 3%, overridable by `PREPAY_DISCOUNT_PCT` and by an admin `PlatformSetting` row `"checkout"` (`{ prepayDiscountPct, sample: { enabled, pricePiasters, maxPieces, creditDays, monthlyCap } }`, validated, 0 to 20%). Used by offers, tier prices and `placeOrder`. Summary note "Paying in full now takes 3% off the boxes." `.env.example` now leaves it empty (= 3%). | fixed (admin form: admin owner) |
| B-14 | medium | `placeOrder` | Order quotes capped at the constant 72 h, ignoring the admin setting. | Plan §5.5 | `placeOrder` uses `loadPricingConfig().quoteValidityHours` (already clamped to 1 to 72 h in `makeConfig`), the same value the designer and offers use. The admin field still accepts up to 336 h (admin owner: cap and label it at 72). | fixed (checkout half) |
| B-04 | medium | proof step | Preflight only ran in the designer. | Plan §1.3 bridge 3; WCAG 3.3.1, 3.3.2 | Checkout half: the page runs the designer's `runPreflight` and shows "Print check" on the proof step: "Ready to print", or each problem with its panel and a "Fix in the designer" link. Red issues need the labelled "Print it as it is" checkbox (help text, inline error, focus moves to it). Server half (technical branch, merged): `placeOrder` runs `proofPreflight` on the approved snapshot, refuses with `PREFLIGHT_BLOCKED` unless `acknowledgePreflight`, and stores the result on `Proof.preflight` and the "Proof approved" event (`PREFLIGHT:1E/0W:ACK`). Checkout sends `acknowledgePreflight` from the checkbox, and the check also covers sample orders. The buyer timeline reads "Proof approved: print-check problems accepted as they are". Verified: blocked without the box; with it the order is placed and recorded. | fixed |

Counts (round 3 work list): high 7 (CR-08, CR-09, X-01, B-15, B-13, B-05; plus X-06 picked up), medium 9, low 2. All fixed on the checkout side; the remaining halves are listed below.

Round 2 open item closed: "`statusBadge(PAID)` renders yellow" (CR-08).

### Verification (round 3)

- Browser walk (`next start`, seeded DB), ar 1440 and en 390: sample order → company invoice (invalid tax number focuses the field) → proof print check → keyboard Continue (focus to card number) → paying state → success header (focus on heading) → second order with the sample credit → invoice with company and tax number → orders list → preflight error blocks approval until override. axe 0 violations and 0 px overflow on every screen; no page errors. Seeded `ELB-26001` (en 1440, ar 390): model drawing, lines reconcile, Activity card, axe 0. Screenshots: `docs/screenshots/audit/checkout/round3/`.
- `npm run lint`, `npm run typecheck` clean; `npm test` 65 files / 8,165 tests pass (new: `src/lib/orders/__tests__/checkout-round3.test.ts`, 8 tests: tone map, tax number, sample pricing and credit, settings defaults); `next build` ok (checkout 153 KB, pay 147 KB, orders 144 KB, order 146 KB, account 149 KB, share 138 KB first-load JS).
- e2e `checkout`, `journey`, `smoke`, `admin`, `vendor` (`--workers=2 --trace off`, desktop + mobile): 26 passed, 4 skipped by the specs themselves. (One earlier run had `journey` time out under parallel load; it passed alone and in the full re-run.)

### Open / for other owners (round 3)

- **Admin**: quote-leads inbox reading `listQuoteRequests()` (B-15); a form for the `"checkout"` setting (prepay %, sample price, pieces, credit days, monthly cap) and sample cost per order sourced (B-05, B-11); cap the quote-validity field at 72 h (B-14).
- **Platform / technical**: a live `EtaAdapter` (accredited provider or ETA API with signing), EGS item codes per structure, e-receipts for B2C (B-13).
- **UI kit**: the shared `Button loading` still hides the label behind a grey fill elsewhere; checkout no longer uses it for Pay.
- Tier prices on step 1 do not subtract a sample credit (the credit shows on the offer totals and summary).

### Files touched outside scope (round 3)

- `src/lib/orders/`: `status-tone.ts`, `poster.ts`, `sample.ts`, `company.ts`, `checkout-settings.ts`, `quote-requests.ts` (new); `service.ts` (offers take the prepay %, samples, sample credit, preflight override note, admin quote validity); `state.ts` (`statusBadge` delegates); `__tests__/checkout-round3.test.ts` (new).
- `src/lib/eta/index.ts` (new, documented stub).
- `prisma/seed.ts` (`ELB-26001` totals only, CR-59).
- `.env.example` (`PREPAY_DISCOUNT_PCT` empty = 3%).
- Read-only imports of `components/designer/lib/preflight` and `lib/library/doc` (server side).

### Round 3, integration pass

Merged the marketing (B-26 `lib/pricing/headline.ts`), vendor (shared `status-tone.ts`) and technical (B-04 server preflight) branches as the integrator asked.
- **B-26**: checkout pre-selects `headlineOffer(offers)` (the best match), and the order service takes its defaults from `HEADLINE_DEFAULTS` (4 colours, Greater Cairo), so the public page, the designer badge and checkout quote the same price.
- **B-04**: my action-level check was replaced by the service's `proofPreflight` + `acknowledgePreflight` (one mechanism, stored on the proof).
- **CR-08**: adopted the vendor's map; see the row above.
- **Conflicts outside scope**: in `components/store/data.ts` and `api/vendor/uploads/route.ts`, vendor and technical conflicted with each other. Kept both sides: technical's cached select plus vendor's approved-only portfolio; vendor's review status plus technical's `revalidateTag("catalog")`.
- **Re-verified** after the merges: lint and typecheck clean; `npm test` 69 files / 8,206 tests pass; `next build` ok. e2e `checkout`, `journey`, `smoke`, `admin`, `vendor`, `storefront`: 38 passed, 4 skipped by the specs. The round 3 browser walk (en 390, ar 1440) is all axe 0 with 0 px overflow, no page errors. The preflight override places the order and shows on the timeline.
- **B-15 follow-up (reported by admin via the integrator)**: price-request leads stored whatever string the client sent for the governorate, which was the English address name ("Cairo"); nothing validated it. `requestQuoteAction` now accepts a name or a code, stores the governorate code (`CAIRO`) and rejects unknown values (`toGovernorateKey()` and `GOVERNORATE_KEYS` in `lib/orders/governorates.ts`). `listQuoteRequests()` returns codes, also for leads written before the fix. Addresses keep the English name, which is the canonical form in `ShippingAddress`. Tests: name/code mapping, and a legacy row read back as a code. Checked: new e2e leads store `CAIRO`. The checkout e2e specs never wrote a governorate into leads; fixtures that seed leads on the admin branch should write codes.

## Round 4

Base: main at `781d663` (rounds 1 to 3 merged). I walked the journey again as a first-time Egyptian brand owner with a fresh account per run, using `docs/audit/tools/checkout-walk.cjs` (new). The walk covers the soft gate, the empty start list, the start list with a design, step 1 (tiers, sample, 5,000-box quote and quote sent), step 2 (empty, errors, company invoice), step 3 (proof, approval error), payment (method, card, declined), paid, order, invoice, orders list, account, and the share link as owner and as an anonymous visitor. That is 22 screens for each of en and ar at 390 and 1440, plus the seeded orders (in production, awaiting printer, QC, delivered with a dispute, unknown id, unknown share token). Every screen ran axe-core (WCAG 2.0/2.1/2.2 A + AA plus best practice) and a horizontal-overflow check, under `next start` with `OTP_DEV_ECHO=1` and `ALLOW_MOCK_PAYMENTS=1`. Screenshots are in `docs/screenshots/audit/checkout/round4/{before,after}/`.

### Re-verification of rounds 1 to 3

| rows | result |
|---|---|
| CO-01, CO-02, X-01, X-06 | axe found 0 violations on every walk screen, before and after. Keyboard Continue on the payment method step moves focus to the card number. Still fixed. |
| CO-03, CO-04, CO-26, CO-27 | At 390 the sticky bar shows the total, "View price breakdown" and Continue on steps 1 to 3, and "Step n of 4" shows on every step including payment (R2-03). The cookie notice sits above the bar. Still fixed. |
| CO-05, R2-01, B-15 | `5000` and `٥٠٠٠` give the price request. Enter submits. The sent banner takes focus and the account lists the request. Still fixed. The input now also shows the grouped value (R4-09). |
| CO-07, CR-22 | A declined card keeps the form, clears only the number and focuses it. The Pay button keeps its label and shows "Paying…". Still fixed. |
| CO-08, CO-19, CO-25, CR-08, CR-35 | Phone order cards and status tones: in production is info, awaiting printer is attention, QC is info, delivered is success. "Paid" is never yellow, and every amount has two decimals. Still fixed. |
| CO-09, CR-23 | The success header has the check, the delivery date and three next steps. Still fixed. |
| CO-10, CO-16 | Cancel modal and the cancelled order view were checked in code, and the e2e paths are unchanged. Still fixed. |
| CO-12, R2-05, CR-59 | "Subtotal (excl. VAT)" appears on checkout, payment and the order. `ELB-26001` reconciles: 12,350 + 150 = 12,500, VAT 1,750, total 14,250. Still fixed. |
| CO-30, CO-31, R2-08 | First-load JS: checkout 159 KB, pay 150 KB, orders 147 KB, order 149 KB, invoice 146 KB, account 152 KB, share 142 KB. CLS is 0.000 to 0.001. Still fixed. |
| CR-09, CR-19, CR-34, CR-48, CR-51 | Poster fallback, price tick, Activity card, back label "Back: Quantity and printer" and no-break "(excl. VAT)" are all seen in the captures. Still fixed. |
| B-04, B-05, B-11, B-13, B-14 | The print check shows on the proof step. The sample tier is "EGP 750 + VAT". The 3% prepay line shows. The company fields validate and print on the invoice. Prices stay valid for 72 h. Still fixed. |

No row reopened.

### Findings (new this round)

| id | severity | page / file | finding | standard | fix | status |
|---|---|---|---|---|---|---|
| R4-01 | high | invoice, 390 (`orders/[id]/invoice/page.tsx`, `orders.module.css`) | The 4-column invoice table was cut off on phones. The Amount column read "Amoun" and "EGP 16,52", and the description wrapped one word per line in a 90 px column. The table sat in a scroll box, so the overflow checker reported 0. | WCAG 1.4.10 Reflow; ETA (every line must be readable) | Below 640 px each line is one block: the description on its own line, then "500 × EGP 33.04" in secondary tone and the amount at the end in semibold. The header row stays for assistive technology (visually hidden). Explicit table roles keep the table semantics when the display changes. Print and desktop layouts are unchanged. | fixed |
| R4-02 | medium | every money figure with a negative value (`lib/format.ts`) | The prepayment discount and sample credit read "EGP -621.53" with an ASCII hyphen. In Arabic the bidi algorithm moved it behind the digits: "621.53- ج.م" on checkout, payment, the order and the invoice. | Typography; Unicode bidi (UAX #9); WCAG 1.3.2 | A true minus (U+2212) goes in front: "−EGP 621.53". In Arabic the signed number is LTR-isolated ("⁦−621.53⁩ ج.م"). Positive amounts are unchanged. Unit test added. | fixed |
| R4-03 | medium | Arabic invoice | The customer address read "12 شارع التحرير, الدقي, Giza": the governorate in English and Latin commas. The order page localises it, the invoice did not. | Localisation; ETA receiver address | The governorate comes from `governorates.<KEY>` in the page language and is joined with "، " in Arabic. Result: "12 شارع التحرير، الدقي، الجيزة". | fixed |
| R4-04 | medium | step 2, 390 (`checkout.module.css`) | Building, floor and apartment: "Building (Optional)" wraps to two lines and "Floor (Optional)" does not, so the three inputs sat at different heights. | Visual rhythm; Polaris form layout | `.grid3` aligns to the end, so the inputs share one baseline in both languages. | fixed |
| R4-05 | medium | company invoice, tax number | The placeholder "123-456-789" in a field of the same colour read as a pre-filled number. Round 1 fixed the same issue on the card expiry (CO-18). | WCAG 3.3.2 Labels or instructions | The placeholder is removed. The example moves into the help text: "9 digits, as on your tax card, for example 123-456-789." The Arabic example is LTR-isolated. | fixed |
| R4-06 | low | payment, card and method steps | Heading order went from h1 to h3 (axe `heading-order`, the only axe result in the round 4 walk, 4 screens). | WCAG 1.3.1 | The step headings are h2 with the same visual variant. | fixed |
| R4-07 | medium | account, consent history (`account/page.tsx`, `account.module.css`) | A new account shows "Marketing messages: Withdrawn" although the buyer never gave it (the box at sign-up was left unticked). The date also jumped under the long labels only. | Egypt PDPL 151/2020 (an accurate consent record); visual consistency | A refusal with no earlier "yes" for that kind reads "Not given" / "دون موافقة". "Withdrawn" is kept for a real withdrawal. Every entry shows the state with the date beneath it. | fixed |
| R4-08 | low | step 1 in quote mode | The summary still said "Paying in full now takes 3% off the boxes" next to "Large orders are priced by our team". | Copy accuracy | The prepay note is hidden in quote mode, as it already was for samples. | fixed |
| R4-09 | low | step 1, other quantity | After Apply the field kept "5000" while every other figure is grouped. The Arabic thousands separator "٬" and the Arabic comma were not accepted. | Consistency; WCAG 3.3.2 | The field echoes the applied value as "5,000". "٬" and "،" are accepted as group separators. | fixed |
| R4-10 | low | step changes and "View price breakdown" | `scrollIntoView({ behavior: "smooth" })` ran even with `prefers-reduced-motion: reduce`. | WCAG 2.3.3 | `scrollBehavior()` returns "auto" under reduced motion. | fixed |
| R4-11 | low | Arabic print check | "الطباعة كما هو" (wrong agreement) in the override label, its error and `PREFLIGHT_BLOCKED`. | MSA grammar | "الطباعة كما هي". | fixed |
| R4-12 | medium | share link `/s/[id]` (`s/[id]/page.tsx`, `share.module.css`) | A visitor from a share link saw the box and "Order this box" but no price, and was asked to sign in before seeing one. The plan puts price and lead time at peak intent (§1.3), and B-26 asks every surface to show the same number. | Plan §1.3 (G2 soft gate after the price); B-26 | A headline line above the order button: "500 boxes from EGP 41.21 each excl. VAT, delivered in 10 days" / "500 علبة من 41.21 ج.م للعلبة دون الضريبة، والتوصيل خلال 10 أيام". The figure comes from the checkout 500-box tier (`tierPrices`) and the lead time from the best-match offer, so the visitor sees exactly what checkout shows. It is hidden for quote-only models or when pricing fails. TTFB is still 17 to 31 ms. New e2e compares it to the checkout tier. | fixed |
| R4-13 | medium | order page, delivered (`orders/[id]/page.tsx`) | A delivered, paid order said "The print file is prepared after payment". Its tracking card said "Tracking appears here when the printer hands your boxes to the courier", and its QC card said "Photos appear here during production" (seeded `ELB-26203`). | ISO 9241-110 (self-descriptiveness); trust | The "after payment" hint shows only before payment. The tracking and QC empty states show only while that stage is still ahead. A delivered or cancelled order without a record hides the empty card instead of promising one. | fixed |
| R4-14 | low | order page, rating (`orders.module.css`) | The "Rating" legend used the browser's legend size and looked bigger than its card title. | Type scale | It uses the form label size and weight (14 px semibold). | fixed |
| R4-15 | low | account, profile | The mobile number showed as "+201507263242" while checkout and the order page show "015 0726 3242". | Consistency | Formatted with `formatEgyptPhone`. The field is read-only and is not submitted. | fixed |
| R4-16 | low | invoice, ETA card | The "To be assigned" placeholder for the ETA UUID used the small monospace hash style, unlike the other placeholders. | Typography | The mono style applies only to a real UUID. | fixed |

Counts (round 4, new findings before fixing): **critical 0, high 1, medium 7, low 8** (16 total). All 16 are fixed and re-verified in the browser.

### Verification (round 4)

- Pass 2 (rebuilt, `next start`): the full walk at en/ar × 390/1440 (88 captures) had axe 0 violations and 0 px overflow on every screen. The seeded orders at ar 390 had axe 0 and 0 px overflow. Checks run: the Arabic invoice reads "12 شارع التحرير، الدقي، الجيزة" with 2-line rows. The discount shows as "−EGP 621.53" and "⁦−621.53⁩ ج.م". The three address inputs line up. The account consent reads "الرسائل التسويقية: دون موافقة" and the phone reads "015 0544 9312". The share price is the same as the checkout tier (en and ar). The delivered order no longer shows the three contradicting messages.
- `npm run lint` and `npm run typecheck` are clean. `npm test` passed 79 files and 8,296 tests (new: the negative-amount format). `next build` is OK.
- e2e (`--workers=2 --trace off`, desktop + mobile): `checkout`, `journey` and `smoke` gave 17 passed and 1 skipped by the journey spec itself. The new test is "a share link shows the checkout price to a signed-out visitor". `admin`, `vendor` and `storefront` (which also use `formatMoney`) gave 28 passed and 8 skipped by the specs.
- Performance (`perf-pages.mjs`, new `ONLY=` filter; phone = 4× CPU on Slow 4G):

| page | profile | LCP (ar / en) | CLS | INP | note |
|---|---|---|---|---|---|
| share | desktop | 632 / 688 ms | 0.000 | 264 ms | INP comes from the lazy 3D chunk (TBT 3.5 s), not from this round's text |
| share | phone | 4.11 / 3.58 s | 0.000 / 0.001 | 184 / 192 ms | FCP-bound, same as round 2 |
| order tracking | desktop | 284 / 392 ms | 0.000 / 0.001 | 24 / 16 ms | |
| order tracking | phone | 3.92 / 4.11 s | 0.000 | 72 / 80 ms | FCP-bound (fonts, CSS, cookie notice) |

### Open / for other owners (round 4)

- **Soft gate copy (auth owner)**: the login page reached from checkout or a share link still says only "Sign in or create a free account". It does not name the box or say the design is kept. The share page now shows the price and says that sign-in comes first. The login page itself is outside this scope.
- **Seller tax registration and commercial register** on the invoice show "To be assigned" until `ELBA_TAX_ID` and `ELBA_COMMERCIAL_REGISTER` are set. This is CR-43 and needs the real legal entity. An invoice without the seller's tax number is not a valid ETA tax invoice.
- **Share page INP 264 ms on desktop** (budget 200 ms) and TBT about 3.5 s. Both come from the 3D viewer chunk (3d-engine / performance owners). Round 2 measured 160 ms, so the change is in the 3D bundle, not in this page's code.
- **Phone LCP 3.6 to 4.1 s** on share and tracking: FCP-bound by fonts, render-blocking CSS and the shared cookie notice (shell owners, PERF-07).
- **Success `Banner` tone** (UI kit) is a saturated mint fill. It is used for the "Price request sent" message, which round 3 calmed on the paid header (CR-23) but which is shared kit styling.

### Files touched outside scope (round 4)

- `src/lib/format.ts`: the negative branch of `formatMoney` (R4-02); positive output is unchanged. `src/lib/__tests__/foundation.test.ts` has one new test.
- `src/i18n/en.ts`, `src/i18n/ar.ts`: one key, `account.notGiven` (R4-07).
- `docs/audit/tools/perf-pages.mjs`: an optional `ONLY=` page filter. `docs/audit/tools/checkout-walk.cjs` is new.
- `e2e/checkout.spec.ts`: one new test. Existing tests are unchanged.
