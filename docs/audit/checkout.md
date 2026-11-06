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

## Round 5

Base: main at `aa726b9` (round 4 of every area merged), fast-forwarded into this branch. Work list: the checkout row of `docs/audit/ROUND5.md`, plus three items the integrator added: a11y R4-04 (invoice table at 320 px), real 404s for unknown `/orders/<id>` and `/s/<token>` (the R4-MK-09 Suspense boundary made them answer 200), and the R4-B-03 data shape agreed with the admin session.

### Work list

| id | result |
|---|---|
| **R4-B-01** (critical) | The fork fix itself (`modelCode` and `config` copied, the duplicate check includes them) came in with catalogue round 4 (`13f12e7`), along with its deep-link e2e. This round adds the server-side guard: `instantOrderBlock()` (`src/lib/orders/order-guard.ts`) runs in `createOrderFromOffer`, the single place every order is written (checkout, sample, reorder). A model whose order mode is quote or preview, or a run above 2,000 boxes, throws `MANUAL_QUOTE` unless the order comes from a price the team sent (`quoteId`). Unit test: `order-guard.test.ts`. New e2e `checkout-share-guard.spec.ts`: a wrong token, another design's id with a real token, and no token all give "Design not found" and create no copy. The real deep link creates one copy that keeps `LIQUID_ASEPTIC_BRICK`, shows "Request a price", and shows no per-box prices, no sample and no Continue. Opening it again reuses the same copy. **fixed** |
| **R4-B-03** (high, checkout half) | Shape agreed by `send_message` with the admin session. The lead's own `Quote` row goes `REQUESTED → PRICED → ACCEPTED`, using three new nullable columns: `pricedAt`, `deliveryDays` and `vendorCostPiasters` (the printer's agreed price, needed for payouts). There is no prepay discount on a sent price. The link is `quoteCheckoutPath()` → `/checkout/<design>?quote=<id>` (`src/lib/orders/quote-status.ts`). `loadPricedQuote()` accepts only the buyer's own quote, for this design, still `PRICED`, still valid, from an active printer, with a vendor cost. The checkout then shows one offer card and "Your price for 5,000 boxes … valid until …". The governorate is locked to the one in the request (with help text). Order creation claims the quote (`PRICED → ACCEPTED`, conditional update) in the same transaction, so it works once. It writes a `QUOTE_ACCEPTED` audit row and sets `order.quoteId`. The 2,000-box cap is lifted only through this path (action schema + guard). A used, expired or foreign link shows "This price is no longer available" above the normal checkout. The account's "Price requests" card shows "Price ready · EGP 105,678.00 for 5,000 boxes, valid until …" and "Review price and pay". New e2e `checkout-quote.spec.ts` covers: another account gets nothing → account card → checkout → paid order with 5,000 boxes and the sent total and vendor cost → quote `ACCEPTED` → link refused when reused. **fixed** (admin "Send price" form: admin session) |
| **R4-B-05** (medium) | The sample card label now reads "Sample + delivery, incl. VAT" / "العينة والتوصيل، شامل الضريبة", which matches the figure it shows. **fixed** |
| **R4-B-06** (medium) | Already fixed by catalogue round 4: the quote-only reason shows at every quantity, there is no "Order 2,000 now" and no sample, and the summary says "priced by quote". Re-verified by `catalogue-order-modes.spec.ts`. The two hard-coded ar/en ternaries left in `CheckoutClient` are now dictionary keys (`buyer.qty.byQuote`, `byQuoteSummary`, `byQuoteHelp`). **fixed** |
| **R4-B-07 / R4-CR-12** (medium) | `sellerTaxReady()` (`src/lib/orders/tax-document.ts`) checks for a 9-digit `ELBA_TAX_ID`. Until one is set, the document is "Order receipt INV-… (not a tax invoice)" / "إيصال طلب … (ليس فاتورة ضريبية)". The ETA block and its "is submitted" sentence are replaced by a plain note, and the order page action says "View receipt". With the variable set, the tax invoice returns unchanged. The checkout e2e now asserts "(not a tax invoice)" and the absence of "Pending submission"; VAT 14% is still asserted. Blocking a live deployment while it is unset is a platform/env check (open). **fixed** |
| **R4-B-09 / R4-CR-07** (low / medium) | One stated minimum: `minOrderQuantity()` (smallest `minOrderQty` among active printers) drives the placeholder ("{min} to 2,000"). Each case gets its own message: a non-integer gives "Enter a whole number of boxes. Above 2,000 boxes we price by hand."; below the minimum gives "Printers start at {min} boxes. To try a few first, choose the sample."; above 1,000,000 gives "A price request takes up to 1,000,000 boxes." **fixed** |
| **R4-B-13** (low) | The tier help text adds "Prices per box include setup and delivery, after the 3% prepay discount." **fixed** |
| **R4-CR-02** (high) | `IsolatedList` (`orders/_components`) wraps every typed address part (street, building, city, governorate, landmark, name, company name) in its own `<bdi>`, joined with "، " in Arabic. It is used on the invoice/receipt and in the order's delivery card. The vendor job and admin order pages are other owners' files (open for them). **fixed (checkout files)** |
| **R4-CR-04** (medium) | `BUYER_TRACK` (`src/lib/orders/buyer-track.ts`) adds a "Printer acceptance" / "قبول المطبعة" step between Paid and In production. Right after payment (status `PAID`) that step is current, so the tracker agrees with the "Awaiting printer" badge. The shared `BUYER_STEPS` in `state.ts` is unchanged, as vendor and admin use it. Unit test added. The checkout e2e now expects "Printer acceptance" as the current step after payment (this was the bug, so the assertion changes with it). **fixed** |
| **R4-CR-15** (low) | The minus sign was fixed in round 4 (R4-02). This round: discount and credit lines use the success tone on checkout, payment and the order page. **fixed** |
| **R4-CR-16** (low) | Already "، " in `orders.invoice.lineDesc` and the spec lines (verified in the ar receipt). **fixed (no change)** |
| **R4-CR-23** (low) | The orders view tabs at 390 px get an end fade mask (direction-aware) plus end padding, so "Delivered" scrolls fully clear of it. Below 640 px only. **fixed** |
| **CR-35** (medium, reopened) | Every money column in checkout, payment, the order and the receipt uses two decimals (`alwaysDecimals` on every `PriceTag`, tier and per-box figures), with tabular figures from `PriceTag`. The vendor jobs list and the public price list are other owners'. **fixed (checkout files)** |
| **vendor R4-13** (low) | "Photos appear here once our team has checked them." / "تظهر الصور هنا بعد أن يراجعها فريقنا." **fixed** |
| **a11y R4-04** (medium) | The phone invoice rows wrap (flex-wrap) instead of using a fixed 3-column grid, so a long amount drops to its own line. Measured at 320 px (ar and en, receipt, order, orders list): no table wrapper scrolls (`scrollWidth − clientWidth = 0`), 0 px page overflow, axe 0. Nothing left to make keyboard-scrollable. **fixed** |
| **404s** (integrator) | `orders/layout.tsx` and `s/layout.tsx` render the shell with `boundary={false}`. The new segment layouts `orders/[id]/layout.tsx` and `s/[id]/layout.tsx` validate first (same viewer rule as the page; same token rules as `loadSharedDesign`) and then add the Suspense boundary themselves. `orders/(list)/layout.tsx` gives the list its boundary back. They pair with `orders/not-found.tsx` and `s/not-found.tsx`. An unknown order, another buyer's order (by id or number) and its invoice all answer the same 404, never 403. An unknown token answers 404 for anonymous visitors in ar and en. New e2e in `checkout-share-guard.spec.ts`. **fixed** |

### Findings (new this round)

| id | severity | page / file | finding | standard | fix | status |
|---|---|---|---|---|---|---|
| R5-01 | low | receipt (`invoice/page.tsx`) | The new receipt still printed "Tax registration number: To be assigned" and "Commercial register: To be assigned" for the seller. | Egyptian VAT Law 67/2016 (do not present tax-invoice fields on a receipt) | The seller tax lines are shown only when `sellerTaxReady()`. | fixed |
| R5-02 | low | step 1, sample tile | "EGP 750 + VAT" in a column where every other price has two decimals. | CR-35 consistency | "EGP 750.00 + VAT". | fixed |
| R5-03 | medium | account, price requests, 390 (`account/page.tsx`, `account.module.css`) | A priced request's badge and "Review price and pay" button squeezed the text column to one word per line, and the request title disappeared. | WCAG 1.4.10 Reflow | The row uses the saved-design phone layout (actions on their own row), indented to the text edge because requests have no thumbnail. | fixed |
| R5-04 | medium | order 404 (`orders/not-found.tsx`, order page, receipt) | An unknown order said "We could not find this design." | ISO 9241-110 (self-descriptiveness) | "We could not find this order" plus "Check the order number in our message, or open your orders…" and "My orders" (ar: «لم نجد هذا الطلب»، «طلباتي»). | fixed |

Counts (round 5, new findings before fixing): **critical 0, high 0, medium 2, low 2** (4 total). All fixed and re-checked in the browser. R5-03 came from this round's own new feature, the priced-request row. The rounds should stop only when a round finds nothing of medium or worse, so this round does not close them. The re-check after these fixes, below, found nothing new.

### Verification (round 5)

- Browser, rebuilt `next start`. The full journey walk (`checkout-walk.cjs`, 22 screens × en/ar × 390/1440 = 88) had axe 0 and 0 px overflow. Twenty-six round-5 screens were checked: the quoted checkout, an invalid quote link, the account priced row, order 404 and share 404 (ar/en × 390/1440), plus the receipt, order and orders list at 320 px (ar/en). All had axe 0, 0 px overflow and no table scroll. Seen: the tracker shows "قبول المطبعة" as current after payment; the ar receipt reads "12 شارع التحرير، الدقي، الجيزة" with green "−621.53" discount lines and two decimals in every column; the quoted step shows one printer and EGP 105,678.00.
- `npm run lint` and `npm run typecheck` are clean. `npm test` passed 92 files and 8,501 tests (new: `order-guard`, `buyer-track`, `tax-document`). Two Arabic copy rules in `platform-i18n.test.ts` caught my first `buyer.quoted.title` (tatweel and a bare count); I fixed the copy, not the test. `next build` is OK with no warnings. First-load JS: checkout 159 KB, pay 150 KB, orders 148 KB, order 149 KB, invoice 146 KB, account 152 KB, share 142 KB.
- e2e (`--workers=2 --trace off`, desktop + mobile, on a freshly seeded DB): `checkout`, `checkout-quote` (new), `checkout-share-guard` (new), `catalogue-order-modes`, `journey`, `smoke`, `admin` and `vendor` gave 52 passed and 17 skipped by the specs themselves. `storefront` gave 16 passed. Two earlier `storefront` runs failed 7 tests (legal pages, the box page and the vendor directory answered 404). The cause was this environment, not the code: a server process left over from before the rebuild, on a dev DB that had not been reseeded after the merge. A build of main on the same fresh DB answered 200 on those pages. After restarting my build on that DB, all 16 passed.

### Open / for other owners (round 5)

- **Admin**: the "Send price" form that writes the agreed shape. Set `vendorId`, `lines`, the totals (`vatOn`), `validUntil` (from the quote-validity setting), `deliveryDays`, `vendorCostPiasters`, `pricedAt` and `status = "PRICED"`, plus a `QUOTE_PRICED` audit row. Send the buyer `quoteCheckoutPath()`. The checkout refuses a priced quote without `vendorCostPiasters`. No reply yet in this session.
- **Platform**: the `quote_sent` / `quote_accepted` analytics events (the event list in `src/lib/analytics/events.ts` belongs to platform; checkout writes the `QUOTE_ACCEPTED` audit row today), and blocking a live deployment while `ELBA_TAX_ID` is unset (R4-B-07).
- **Vendor / admin**: `dir`-isolated addresses on the vendor job "Delivery" card and the admin order page (R4-CR-02), and one money precision in the vendor jobs list (CR-35).
- **Platform (R4-CR-09)**: signed-in order pages still show the promo bar and "New design" in the header.

### Files touched outside scope (round 5)

- `prisma/schema.prisma`: `Quote.pricedAt`, `Quote.deliveryDays`, `Quote.vendorCostPiasters` (nullable, additive; agreed with admin).
- `src/lib/orders/`: `order-guard.ts`, `buyer-track.ts`, `tax-document.ts`, `quote-status.ts` (new); `service.ts` (guard call, `minOrderQuantity`, `loadPricedQuote`, quoted order path, `OrderOffer` type); `quote-requests.ts` (re-exports, `quoteGovernorate`); three new unit tests.
- `e2e/checkout-quote.spec.ts`, `e2e/checkout-share-guard.spec.ts` (new). `e2e/checkout.spec.ts`: two assertions follow the intended changes (receipt title, "Printer acceptance"); nothing removed or weakened.

## Round 6

Base: main at `d61f21f` (my round 5 merged, plus designer R8, performance, marketing and catalogue R8; `boxes/[structure]` and `legal/[doc]` now sit in the `(detail)` group with guard layouts). Fresh audit of the whole scope on a freshly seeded DB under `next start`:
- the full journey walk (88 screens, en/ar × 390/1440);
- the round 5 screens (quoted checkout, account price row, 404s, 320 px receipt);
- for the first time in these rounds, the three non-card payment methods (mobile wallet, Fawry, InstaPay) at ar/en × 390/1440, including the clipboard.

### Re-verification of round 5

All round 5 rows still hold after the merge. Every walk screen had axe 0 and 0 px overflow. The tracker shows "Printer acceptance" after payment. The receipt title applies while `ELBA_TAX_ID` is unset. Unknown or other buyers' orders and unknown share tokens answer 404 (e2e). The guard and the quoted path pass their e2e. The admin "Send price" form is not on main yet (see Open).

### Findings (new this round)

| id | severity | page / file | finding | standard | fix | status |
|---|---|---|---|---|---|---|
| R6-01 | medium | payment, InstaPay (`PaymentClient.tsx`) | The buyer must type the InstaPay address and the order number into the bank app exactly, but neither had a copy action (Fawry has one). A wrong note means a transfer ops cannot match. | ISO 9241-110 (error tolerance); WCAG 3.3.4 spirit (prevent errors on financial actions) | "Copy address" and "Copy note" buttons (`buyer.copy.*`, "تم النسخ" toast) next to each value, wrapping under the value on phones. Verified: the clipboard holds exactly the order number. | fixed |
| R6-02 | low | payment, card and wallet | "Pay EGP 14,250" / "دفع 14,250 ج.م" next to a summary that says "EGP 14,250.00". | CR-35 consistency | The pay amount always has two decimals. | fixed |
| R6-03 | low | account header hint | "Add your name in Profile so the courier knows who to ask for" was not true: the courier uses the name on each delivery address. | Copy accuracy | "Add your name in Profile. It appears on your account and on your receipts; the courier uses the name on each delivery address." (ar likewise). | fixed |
| R6-04 | low | payment, Fawry | The 13-digit reference was one unbroken run of digits, hard to read out at an outlet. | Readability | Shown in groups of four; screen readers and Copy get the raw digits (visually hidden span). | fixed |

Counts (round 6, new findings before fixing): **critical 0, high 0, medium 1, low 3** (4 total). All fixed and re-checked in the browser. R6-01 is medium, so the stop rule ("no medium or worse") is not met yet. The re-walk after these fixes (journey en-390 and ar-1440, plus the payment-method screens) found nothing new.

### Verification (round 6)

- `npm run lint` and `npm run typecheck` are clean. `npm test` passed 8,508 tests. `next build` is OK with no warnings.
- e2e (`--workers=2 --trace off`, desktop + mobile, fresh DB): `checkout`, `checkout-quote`, `checkout-share-guard`, `catalogue-order-modes`, `journey`, `smoke`, `storefront`, `admin` and `vendor` gave 59 passed and 17 skipped by the specs themselves, with 0 failures.
- Browser: the payment methods had axe 0 and 0 px overflow, with focus on the step heading after Continue (X-01 holds). The journey re-walk had axe 0 and 0 px overflow on every screen.

### Open (round 6)

- **Admin "Send price"** (R4-B-03 admin half) is not on main yet. Until it is, a price request can only be priced by writing the row directly.
- Native date input ("Needed by") shows the browser's date format, e.g. "mm/dd/yyyy" in an Arabic page; it follows the browser locale and is not set by the page.

## Round 7

Base: this branch at `c9864b5` (round 6), on a freshly seeded DB under `next start`. This was a fresh pass, focused as the integrator asked on what earlier walks never reached:
- every order-tracking state: awaiting payment, cancelled, refunded, QC pending (with a photo), ready to ship, and shipped (with a shipment and tracking), each with its orders list and receipt, in ar 390 and en 1440 (32 screens);
- the Arabic phone payment screens (card, declined, wallet, Fawry, InstaPay);
- receipts after a refund.
All screens had axe 0 and 0 px overflow, so every finding below is visible content, not markup.

### Findings (new this round)

| id | severity | page / file | finding | standard | fix | status |
|---|---|---|---|---|---|---|
| R7-02 | high | order tracking, Activity (`orders/[id]/page.tsx` `eventText`) | Free-text notes on any event other than NOTE were shown to the buyer verbatim. Printers and staff write these notes through the status API (a decline reason, a QC remark). A printer's "Call me on 01001234567" on VENDOR_DECLINED reached the buyer, and an English staff note appeared as-is in the Arabic timeline ("إلغاء الطلب: Buyer cancelled"). Round 4 (vendor) closed this only for NOTE events. | Plan §0 / B-08 (managed marketplace: no direct printer contact); PDPL 151/2020 (staff notes are not for the buyer) | Buyers see an event's label only. The single exception is the courier's tracking number on SHIPPED. Staff and printers keep the full note (`internal`). e2e: the printer's phone number and the refund reason never render. | fixed |
| R7-01 | medium | refunded order, receipt (`orders/[id]/page.tsx`, `invoice/page.tsx`) | A refunded order showed no refund anywhere. The payment card dropped the paid line and showed nothing returned. The timeline said "Order cancelled", because a refund writes a CANCELLED event. The receipt still read "This is a receipt for your payment … Paid by Card". An unknown event type would have printed its raw dictionary key. | Consumer Protection Law 181/2018 (the buyer must be able to see the refund); ISO 9241-110 (self-descriptiveness) | The payment card now has a line "Refunded · Card  EGP 14,250.00" (success tone). On a refunded order the closing event reads "Order cancelled and refunded" / «إلغاء الطلب واسترداد المبلغ». The receipt gets a banner: "This order was refunded: EGP 14,250.00 went back to your Card on November 5, 2026. Credit note CN-… cancels this receipt." Unknown event types read "Order updated". e2e added (`checkout-states.spec.ts`). | fixed |
| R7-03 | low | payment, card form | "Name on card" is not required (payment succeeds without it), but it was the only optional field without "(Optional)". | WCAG 3.3.2 | Marked optional like every other optional field. | fixed |

Counts (round 7, new findings before fixing): **critical 0, high 1, medium 1, low 1** (3 total). All fixed and re-checked in the browser. R7-02 and R7-01 are high and medium, so the stop rule is not met. The re-check after the fixes (refunded order and receipt, ar 390 and en 1440: axe 0, 0 px overflow, no printer phone in the HTML) found nothing new.

Also checked and fine: awaiting payment shows "Pay now" and a "Due" line, with the "print file after payment" hint before payment only. Cancelled shows "Order this design" and no due amount. QC pending shows no unreviewed photo to the buyer ("appear once our team has checked them"). Shipped shows the carrier, tracking number, status badge and tracking link. Ready to ship is current on Shipped. A typed Latin street ("14 Abbas El Akkad St") stays in order in every Arabic address card. On the Arabic phone card form, the decline keeps the expiry and CVC and focuses the number.

### Verification (round 7)

- `npm run lint` and `npm run typecheck` are clean. `npm test` passed 8,508 tests. `next build` is OK with no warnings.
- e2e (`--workers=2 --trace off`, fresh DB): `checkout`, `checkout-quote`, `checkout-share-guard`, `checkout-states` (new), `catalogue-order-modes`, `journey`, `smoke`, `storefront`, `admin` and `vendor` gave 60 passed and 18 skipped by the specs themselves, with 0 failures. A first run of the new spec signed in against `dev.db` because `ELBA_DATABASE_URL` was not set for the test process. With the variable set it passed; nothing in the spec was weakened.

### Open (round 7)

- **Vendor / admin:** the same rule for their own screens is theirs to decide. Staff and printers still see full notes, by design.
- **Admin "Send price"** (R4-B-03 admin half): still not on main.

## Round 8

Base: this branch at `9c8bab9` (round 7), fresh DB, `next start`. Fresh pass on the angles the integrator listed:
- two tabs paying the same order;
- session expiry during payment;
- browser Back, Forward and refresh at each step;
- disputes and reprints from the buyer side;
- the sample and its credit, and the proof approve or edit loop;
- an address change mid-checkout;
- the PDPL export and deletion flow.

### Findings (new this round)

| id | severity | page / file | finding | standard | fix | status |
|---|---|---|---|---|---|---|
| R8-01 | high | pay page (`PaymentClient.tsx`, `actions.ts`) | A paid order was still offered for payment, and the buyer was told the wrong thing. (a) Back from the success page showed the method list with "Amount due now EGP 14,250.00" and Continue, because the router cache restores the old pay page. (b) In a second tab with an open Fawry code, after the first tab paid by card, "pay at outlet" said "Your card was declined. Try another card or another method." The server had correctly voided that attempt (`NOT_PENDING`), but the client read every non-success as a decline. Both push the buyer towards paying twice. The server already prevents a double capture on the same attempt and records a late second payment for refund. | Consumer Protection Law 181/2018 (no double charge); ISO 9241-110 (self-descriptiveness); WCAG 3.3.1 | New `orderPayStateAction()` (buyer-only, cheap). The pay page asks it on mount (covers a router-cache Back), on a bfcache `pageshow`, when the tab becomes visible, and after any refused attempt. A paid or closed order moves to its order page with the notice "This order is already paid or closed." `NOT_PENDING` no longer reads as a decline: if the order is still due, the buyer sees "This payment attempt was closed. Nothing was charged on it." e2e: Back after paying lands on the order; the Fawry tab moves to the order with no "declined"; exactly one PAID payment. | fixed |
| R8-02 | medium | pay page | When the session expired on the card form, Pay showed "Something went wrong. Try again." There was no way forward, and retrying kept failing. | WCAG 3.3.1 / 3.3.3 | Shows "Your session has ended. Sign in again to finish paying. Your order and its price are kept, and nothing was charged." with "Sign in" → `/login?next=/checkout/pay/<id>` (ar: «انتهت جلستك»). e2e asserts the message and the return link. | fixed |
| R8-03 | medium | `account/export/route.ts` | The PDPL data export left out personal data the buyer gave: price requests (note, needed-by date, governorate), problem reports (description), and their payments. | Egypt PDPL 151/2020, right of access | The export adds `priceRequests`, `problemReports` and `payments` (method, status, amount; no card data, Elba never has it). The storefront's `buildDataExport()` is untouched; the route extends its result. Verified in the browser: a 5,000-box request with "two batches", GIZA and 2026-12-01 is in the file. | fixed |
| R8-04 | medium | returns policy vs. "Report a problem" | The policy said "choose Report a problem and add photos", but the form has no photo upload. Its own help text says the team asks for photos on WhatsApp. | Consumer Protection Law 181/2018 (stated terms must match the service) | The policy text now matches what happens: "describe what went wrong. Our team then asks you on WhatsApp for photos…" (en/ar). A real photo upload needs a Dispute photos column and an admin view (open). | fixed (copy) |
| R8-05 | medium | checkout steps (`CheckoutClient.tsx`) | The steps were client state only. The browser or phone Back button on Delivery or Proof left checkout altogether (to the designer or share page) and dropped the typed address. Forward did nothing. | ISO 9241-110 (controllability); Polaris checkout (each step navigable) | Each step pushes a history entry, keeping Next's own state. `popstate` shows the step. The in-page Back and an error that returns to an earlier step use `history.go()`, so entries never pile up. Verified: step 3 → Back → step 2 with "Dokki" still typed → Forward → step 3 → Back ×2 → step 1 → Back leaves checkout. e2e (mobile). | fixed |

Counts (round 8, new findings before fixing): **critical 0, high 1, medium 4, low 0** (5 total). All fixed and re-checked in the browser. The stop rule is not met (R8-01 is high). The re-check after the fixes found nothing new: journey walk ar 390 and en 1440 had axe 0 and 0 px overflow, and all the scenarios above pass.

Checked and fine this round:
- Two tabs paying by card on the same attempt: the second tab lands on the paid order, with one PAID payment.
- Refresh on the card form keeps the attempt.
- A governorate change mid-checkout re-prices, with a status message.
- The proof's "Edit design" returns to the designer. A new proof is made on the next approval; there is no reject flow by design.
- The sample credit path is covered by the round 3 e2e.
- Deletion requests are logged once (a repeat returns the open one) for team review within 30 days.
- The review form and "Report a problem" (minimum 10 characters, one open report at a time) work.

### Verification (round 8)

- `npm run lint` and `npm run typecheck` are clean. `npm test` passed 8,508 tests. `next build` is OK with no warnings.
- e2e (`--workers=2 --trace off`, fresh DB) gave 62 passed and 20 skipped by the specs themselves. One first run of the new pay-state test failed under parallel load: it clicked a visually-hidden radio input with `force` before the CSS settled. I changed the test to check the radio by its accessible name; nothing was weakened. It then passed three runs in a row with `checkout.spec.ts`, and the full set passed.

### Open (round 8)

- **Photos in "Report a problem"**: needs a `Dispute` photos field, buyer uploads with the image-magic check, and an admin view (checkout + admin + schema).
- **Refresh in the middle of checkout** returns to step 1, and a typed address is re-filled only from the last order or the account. Keeping a draft in `sessionStorage` was not done (address data in browser storage needs a PDPL decision).
- **Admin "Send price"**: now owned by `session_01ErLBscDBcwAe9g1EhxnAzG`; not on main yet.

### Files touched outside scope (round 8)

- `src/i18n/en.ts`, `src/i18n/ar.ts`: the returns policy "How to report a problem" body (R8-04).

## Round 9

Base: this branch at `942da8a` (round 8). First, the integrator's two decisions on round 8's open items; then a fresh pass on the new angles: the prepay discount with sample credit, quantity tier boundaries, VAT rounding, Arabic-Indic digits in inputs, and the buyer's SMS and WhatsApp texts.

### Decisions built

| item | what was built | verified |
|---|---|---|
| **Photos in "Report a problem"** (round 8 open) | **Upload:** a new private upload scope `dispute/<orderId>/…` in the existing pipeline (`components/vendor/lib/files.ts`): type by magic bytes (PNG, JPEG, WebP; never SVG or PDF), 10 MB, image metadata stripped (`saveUpload`). **Route:** `POST /api/orders/[id]/dispute-photos` (buyer of the order only, while a report can be opened, body capped and rate-limited). The vendor upload route explicitly refuses this scope. **Storage:** `Dispute.photos` (JSON list of keys). The report (`disputeAction` → `openDispute`) accepts at most 5 keys, each for this order only. **Form:** "Add photos" uploads on choose, with a thumbnail, "Uploading…" / "Added", a per-file error ("Use a JPG, PNG or WebP photo.", "This photo is over 10 MB…", "You can add up to 5…"), and "Remove {name}". Sending waits for uploads. **Reading:** the photos are readable by the order's buyer and admins only, not the printer, not other buyers. **Admin:** a read-only "Buyer's photos (n)" gallery on `/admin/disputes/[id]` (additive). The returns policy line about adding photos is restored (en/ar). | Unit: scope rules and readers (`dispute-scope.test.ts`). e2e `checkout-dispute-photos.spec.ts`: 2 PNG accepted, PDF rejected with a message, report stored with 2 keys, buyer 200, other buyer 404, printer 404, the vendor route refuses `scope=dispute` (400), and the admin page shows 2 images. Screens: `round9/after-dispute-photos-form-ar-390.png`, `round9/admin-dispute-buyer-photos-en-1440.png`. |
| **Checkout draft on refresh** (round 8 open) | No address or phone in the browser (PDPL 151/2020 data minimisation). A **reload or Back/Forward** return restores: the step from the history entry (`history.state` survives a reload), quantity, sample choice and printer from `sessionStorage`, and the payment method choice per order. The address comes from the server (last order or account). If that is incomplete, the buyer lands on Delivery, not on Proof. Opening checkout afresh starts clean, as do a placed order or a navigation from elsewhere. | e2e: after a reload on Delivery with a 250-box choice, the step is kept, the typed street is not stored (no name or street anywhere in `sessionStorage`), and Back shows 250 boxes still selected. The journey walk (88 screens) is clean. |

### Findings (new this round)

| id | severity | page / file | finding | standard | fix | status |
|---|---|---|---|---|---|---|
| R9-01 | medium | buyer SMS / WhatsApp (`checkout.*.ts notify`, `service.ts`) | No buyer message had a link: "Complete payment" and "try again from your orders page" left the buyer to find the page. The Fawry message gave the reference code but not the amount the outlet asks for, nor the deadline. | ISO 9241-110 (task suitability); Consumer Protection Law 181/2018 (price stated with the payment request) | Links in every buyer message: order placed → pay page; payment failed → pay page ("nothing was charged"); payment received, status change, shipped, delivered → order page. Fawry: "pay EGP 14,250.00 for order … at any Fawry outlet or in myFawry with reference number … before {date}" (ar likewise). Shipped links to the order page, which shows the tracking number (a status set without a shipment would otherwise have printed an empty number). | fixed |
| R9-02 | low | "Report a problem", a rejected file (`OrderActions.tsx`) | A rejected file (e.g. a PDF) showed the browser's broken-image icon as its preview. Found on the new feature. | Polish | A neutral placeholder for files with an error. | fixed |
| R9-03 | medium | "Report a problem", sending (`OrderActions.tsx`) | On the first report after a server start, the report was saved and the buyer notified, but the page did not change: `router.refresh()` alone did not re-render, so the buyer saw the filled form as if nothing happened. Found when the new e2e failed on a fresh server; it was not a test problem. | WCAG 4.1.3 (status messages); ISO 9241-110 | The form confirms at once with an announced "We received your report and will reply within one working day." and then refreshes. The e2e passes on a fresh server, three runs in a row. | fixed |

Counts (round 9, new findings before fixing): **critical 0, high 0, medium 2, low 1** (3 total). All fixed and re-checked. The stop rule is not met (two medium). The re-check after the fixes found nothing new.

Checked and fine this round:
- **Prepay 3% with a sample credit:** the credit is taken after the prepay discount, capped at the discounted goods (never delivery), and VAT is recomputed once on the lower subtotal. The lines reconcile to the subtotal on the summary, receipt and order. Note: the 3% applies to the goods before the credit, so the buyer also gets 3% of the credited sample price. That is a business choice and consistent with "Paying in full takes 3% off the boxes".
- **Tiers:** 49 gives "Printers start at 50 boxes. To try a few first, choose the sample." (the real minimum, 50). 50, 99 and 100 price, with more printers eligible from 100 and 250. 2,000 is instant. 2,001 becomes a price request. 2000.5, −5 and "12abc" give "Enter a whole number…". 1,000,001 gives the request cap.
- **Arabic-Indic digits:** «٩٩» and «٢٠٠١» in the quantity field, and «٠١٠١٢٣٤٥٦٧٨» in the delivery phone, are all accepted (ar and en).
- **VAT rounding:** VAT is computed once on the ex-VAT subtotal, half-up to the piaster. Lines are never taxed one by one, so the total always equals subtotal + VAT on every surface.

### Verification (round 9)

- `npm run lint` and `npm run typecheck` are clean. `npm test` passed 8,510 tests (new: `dispute-scope`). `next build` is OK with no warnings.
- e2e (`--workers=2 --trace off`, fresh DB): all checkout specs plus `catalogue-order-modes`, `journey`, `smoke`, `storefront`, `admin` and `vendor` gave 64 passed and 22 skipped by the specs themselves, with 0 failures.
- Browser: the journey walk at en/ar × 390/1440 (88 screens) had axe 0 and 0 px overflow.

### Files touched outside scope (round 9)

- `prisma/schema.prisma`: `Dispute.photos Json?`.
- `src/components/vendor/lib/files.ts` (`dispute` scope, rule, key pattern, readers); `src/app/api/vendor/uploads/route.ts` (refuses `dispute`); `src/app/api/vendor/files/[...key]/route.ts` (order lookup for `dispute` keys); `src/components/vendor/lib/__tests__/dispute-scope.test.ts` (new).
- `src/app/[locale]/admin/disputes/[id]/page.tsx` (additive gallery); `src/i18n/admin.{en,ar}.ts` (`buyerPhotos`, `buyerPhoto`).
- `src/i18n/{en,ar}.ts`: the returns policy line restored.
- New: `src/app/api/orders/[id]/dispute-photos/route.ts`, `e2e/checkout-dispute-photos.spec.ts`.

## Round 10 (audit-only pass on R7 to R9 changes)

Focus: dispute photo flow on a phone (camera capture, iPhone HEIC, slow uploads, removal mid-upload), the checkout draft restored across reload on every step, refunded and cancelled order views, and the SMS/WhatsApp texts in both languages. Audited at 390 and 1440, ar and en, with axe.

### Findings

| ID | Severity | Where | Finding | Fix |
|---|---|---|---|---|
| R10-01 | Medium | Report a problem, photos | Some Android camera and gallery pickers hand over a `File` with an empty `type`. The client rejected it as "Use a JPG, PNG or WebP photo.", so a buyer taking a photo of a damaged box could not attach it. The server already sniffs magic bytes, so the client check was stricter than the real gate. | Empty `type` passes the client check; the server's magic-byte check decides. |
| R10-02 | Low | Report a problem, photos | An iPhone HEIC photo got the generic type error, which does not tell the buyer what to do. | A HEIC-specific message (by MIME or `.heic/.heif` name) with the iOS steps: Share, Options, Most Compatible, or a screenshot. Also used when the server refuses the type. |
| R10-03 | Low | Report a problem, photos | The remove button was disabled while a photo uploaded, so a slow upload could not be cancelled; a photo removed after upload stayed on disk although it was never sent (PDPL 151/2020, data minimisation). | Remove is always enabled: it aborts an upload in flight (`AbortController`), and for an uploaded photo calls the new `DELETE /api/orders/[id]/dispute-photos?key=` (buyer only, `dispute/<orderId>/` keys only, refused when the key already belongs to a sent report). |
| R10-04 | Low | SMS/WhatsApp, refund | A refunded order sent the generic "status changed" text, with no amount and no payment method (Consumer Protection Law 181/2018: the buyer should know what is refunded and where). | New `REFUNDED` template: en "Elba: order {number} is cancelled and {amount} is on its way back to your {method}. Details: {url}"; ar "علبة: ألغي الطلب {number} وجار رد {amount} إلى {method}. التفاصيل: {url}". Falls back to the generic text when no payment row exists. |

Checked and not a finding: the photo input has no `capture` attribute, so phones offer both camera and gallery (right for a report that may use older photos); the restored draft on reload holds on steps 1 to 4, including the proof step for a buyer whose address comes from a previous order, and two Back presses return to the chosen tier; no address or phone goes to sessionStorage; refunded and cancelled order views, receipt and credit note read correctly in both languages; Arabic SMS texts stay within 2 UCS-2 segments.

Counts of NEW findings: critical 0, high 0, medium 1, low 3.

### Verification

- lint clean, `tsc --noEmit` clean, unit tests 8510 passed, build clean.
- e2e (checkout*, journey, smoke, storefront, admin, vendor, catalogue-order-modes, `--workers=2 --trace off`): 64 passed, 22 skipped (single-project tests), 0 failed.
- New e2e in `checkout-dispute-photos.spec.ts` (mobile): HEIC message, empty-type camera photo uploads, removing an uploaded photo sends DELETE 200; passed 3 of 3 with `--repeat-each=3`.
- Browser checks at 390: removal mid-upload with a 3 s delayed upload leaves 0 rows and 0 files on disk; removal after upload deletes the stored file.
- Walker (ar-390, en-1440): 44 screens, 0 overflow, 0 axe violations.
- Screenshots: `r10-en-390-dispute-heic.png`, `r10-ar-390-dispute-heic.png`.

### Files touched outside scope

- `src/lib/notify/index.ts`: `REFUNDED` added to `NOTIFY_TEMPLATES` (additive).

Medium finding present, so by the stop rule one more round is due.

## Round 11 (audit-only pass on the merged code)

Main (`eda6d57`) merged into this branch with no conflicts. Walked the whole buyer path again in ar 390 and en 1440 on the merged build: soft gate, step 1 with the quote request, delivery with errors and company invoice, proof with print check, mock payment with decline and success, order, receipt, orders list, account, share links (owner and signed out). I also checked the printer's view of the order event rules.

### Findings

| ID | Severity | Where | Finding | Fix |
|---|---|---|---|---|
| R11-01 | Low | `/orders/[id]` and its receipt, opened by printer staff | Security R5-SEC-01 (on main) keeps printer staff off buyer order pages through `getOrderForViewer`, but the order layout still gated on `canViewOrder`. So the order's printer got the buyer "We could not find this order" card with status 200, not a real 404 and not a way to its job. A printer following a link from a message or the admin to `/orders/<id>` hit a dead end. | The layout now gates on `canViewBuyerOrder`. The order's own printer staff are redirected to `/vendor/jobs/<number>` while the order is in a status the portal shows, where their notes are. Everyone else gets the same 404 as an unknown id. No buyer address or phone reaches printers (B-08, PDPL 151/2020). |

Checked and not a finding:
- **Printer notes.** The vendor job page shows every note the portal lets a printer write: free notes, decline reason and QC rejection. A note sent through the status API on accept or start-production is not shown in the portal, but that path is API-only and owned by the vendor portal; noted for that owner. The buyer sees none of these notes in ar or en (B-08).
- **axe `target-size` on ar-390 step 1 after opening the quote form.** Opening the form scrolls the page 84 px, and the page back link (28×28 px) is then partly under the sticky checkout header. That is content scrolled under a sticky bar, not an undersized target: at the top of the page it is 28×28 with 65 px to the nearest target (WCAG 2.2 SC 2.5.8 passes).
- **Pre-existing, out of scope.** `src/lib/dieline/__tests__/geometry-snapshot.test.ts` fails on main itself (all 127 generators differ from the recorded snapshot after the dieline merges). Left for the designer and dieline owner.

Counts of NEW findings: critical 0, high 0, medium 0, low 1.

### Verification

- **Static checks.** Lint clean, typecheck clean, build clean.
- **Unit tests.** 8647 passed and 1 failed: the dieline snapshot above, which fails on main too.
- **e2e.** The run covered checkout*, journey, smoke, storefront, admin, vendor, catalogue-order-modes and security, with `--workers=2 --trace off`. Result: 66 passed, 24 skipped (single-project tests), 0 failed.
- **e2e changes.**
  - New `checkout-vendor-view.spec.ts`: the printer is redirected to its job page and sees its note, the receipt redirects too, another buyer gets 404, and the buyer never sees the note.
  - `checkout-states.spec.ts`: the Fawry radio selector now follows main's copy change ("reference code" to "reference number").
- **Walker** (ar-390, en-1440, full page): 44 screens, 0 overflow, 0 page errors. axe is clean except the scrolled `target-size` case above.
- **Screenshots.** `r11-vendor-job-en-1440.png`, `r11-vendor-job-ar-390.png`, `r11-buyer-order-en-1440.png`, `r11-buyer-order-ar-390.png`.

### Files touched outside scope

None. `orders/[id]/layout.tsx` is in scope; it imports `VENDOR_VISIBLE_STATUSES` read-only.

No medium or worse finding this round, so by the BRIEF stop rule the checkout rounds stop here.
