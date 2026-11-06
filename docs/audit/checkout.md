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
