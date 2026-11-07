# Checkout, orders, payments and shipping

## Purpose

Turn a saved design into a paid order: pick an offer (printer, quantity, delivery), enter delivery and billing, approve the proof, pay. Then track it through production, QC, shipping and delivery, with refunds, disputes and reprints.

## Key files

| Path | Role |
|---|---|
| `src/app/[locale]/(checkout)/checkout/page.tsx` | Pick one of your designs |
| `checkout/[designId]/page.tsx`, `_components/CheckoutClient.tsx` | Stepper `offer`, `delivery`, `proof`, `payment`. Handles `?share=` (copies a shared design) and `?quote=` (a team-priced quote) |
| `checkout/actions.ts` | Server actions: `getOffersAction`, `placeOrderAction`, `requestQuoteAction`, `startPaymentAction`, `cancelOrderAction`, `supersedeUnpaidOrders`, `saveCompany` |
| `checkout/pay/[orderId]/page.tsx`, `PaymentClient.tsx` | Payment step (mock "test mode" banner when the mock is on) |
| `src/app/[locale]/orders/(list)`, `orders/[id]`, `orders/[id]/invoice` | Buyer order list, tracking page, receipt / invoice |
| `src/lib/pricing/engine.ts`, `config.ts`, `money.ts`, `server.ts` | Pricing (see section below) |
| `src/lib/orders/state.ts` | Status edges, actors, dispute window, print-file unlock, view checks |
| `src/lib/orders/service.ts` | `placeOrder`, `createOrderFromOffer`, `transitionOrder`, `cancelOrder`, `reorder`, `openDispute`, `shipOrder`, `syncShipments`, `startPayment` |
| `src/lib/orders/totals.ts` | `orderTotals` (prepay discount line, VAT), `invoiceBreakdown`, `nextSequence` |
| `src/lib/orders/payment-rules.ts` | `decidePaymentOutcome` |
| `src/lib/orders/quote-status.ts`, `quote-requests.ts`, `quote-spec.ts`, `order-guard.ts` | Quote statuses, price-request inbox, spec hash, `instantOrderBlock` |
| `src/lib/orders/pdf/print.ts` | `generatePrintPdf` (pdf-lib): one page per printed surface, dieline spot colour on its own layer, crop marks, 3 mm bleed |
| `src/lib/orders/checkout-settings.ts` | Prepay discount (default 3%), samples |
| `src/lib/payments/` | `config.ts` (`mockPaymentsEnabled`), `mock.ts`, `paymob.ts` |
| `src/lib/shipping/` | `index.ts`, `bosta.ts` (skeleton), `mock.ts` |
| `src/lib/notify/index.ts` | Buyer and printer messages |

## Pricing in one paragraph

`quote()` prices every eligible ACTIVE vendor from its rate card: tiers interpolated in log(quantity), scaled by blank area against the card's reference area (board share 0.6, ratio clamped 0.25 to 6) and the weekly board/FX index, colours and print sides, offset vs digital short run (whichever is cheaper), finishes, die (waived for a standard die within 2 mm, else +3 days), setup, per-zone shipping. Margin (default 25%) is added to every line except shipping, then VAT 14% on the subtotal. `rankOffers` weights price 0.5, speed 0.25, quality 0.25 and assigns badges. `toPublicOffer` strips the internal economics before anything reaches the browser. Instant prices stop at 2,000 units.

## Order flow

1. **Offers**: `getOffersAction` (120/min) prices the design. A quote-only model or more than 2,000 units returns `manual_quote`.
2. **Price request** (manual path): `requestQuoteAction` (5/h) creates a REQUESTED `Quote`. Admin prices it (PRICED); the buyer opens `/checkout/<designId>?quote=<id>`; `loadPricedQuote` and `quoteMatchesDesign` re-check it.
3. **Place**: `placeOrderAction` (10 per 10 min) calls `placeOrder`: server preflight (`PREFLIGHT_BLOCKED`), re-price on the server, then `createOrderFromOffer` writes the immutable `Proof` (snapshot + sha256), the `Quote` (OPEN, or claims PRICED to ACCEPTED), the `Order` (`PENDING_PAYMENT`, `ELB-YYnnn`), `ORDER_PLACED` and `PROOF_APPROVED` events. Older unpaid orders for the same design are cancelled (`SUPERSEDED:<number>`).
4. **Pay**: `startPaymentAction` (30 per 10 min) starts the provider. Card and wallet redirect or confirm; Fawry gives a code (48 h); InstaPay is marked sent by the buyer and matched by ops.
5. **Webhook**: `POST /api/payments/webhook?provider=` verifies the signature, `decidePaymentOutcome` binds reference, currency and amount, `applyPaymentOutcome` moves the order to PAID, the quote to ACCEPTED, writes the `INV-` invoice in one transaction, then `ensurePrintPdfs` and the notifications.
6. **Production**: the printer accepts (40% advance payout row), starts, uploads QC photos and submits QC. Admin approves QC (READY_TO_SHIP) or rejects it (back to IN_PRODUCTION).
7. **Ship and deliver**: `shipOrder` creates the shipment; `syncShipments` polls the courier (once a minute per order) and moves SHIPPED to DELIVERED.
8. **After delivery**: review, dispute (30 days, up to 5 photos), reorder.

## Status edges

See the table in `src/lib/orders/state.ts`; a summary is in `docs/ARCHITECTURE.md` section 7. Key rules:

- Always go through `transitionOrder()`; it uses a conditional update to win races and stamps `paidAt`, `deliveredAt`, `cancelledAt`.
- `POST /api/orders/[id]/status` (VENDOR, ADMIN) refuses PAID and REFUNDED even for admins; vendors may only target ACCEPTED, IN_PRODUCTION, QC_PENDING, SHIPPED (`src/lib/orders/api-rules.ts`).
- Buyers may cancel only in PENDING_PAYMENT. A printer gets print files from ACCEPTED on.
- REFUNDED issues a credit note `CN-YYnnn`.

## Payments: mock vs real

| | Mock | Paymob |
|---|---|---|
| Selected by | `PAYMENTS_PROVIDER` unset or `mock` | `PAYMENTS_PROVIDER=paymob` + `PAYMOB_*` keys |
| Allowed | Dev always; `next start` only with `ALLOW_MOCK_PAYMENTS=1` | Always |
| Signature | HMAC-SHA256 of the raw body, header `x-mock-signature`, secret `MOCK_PAYMENTS_SECRET` | HMAC-SHA512 over the Paymob field list, `?hmac=` or header, secret `PAYMOB_HMAC_SECRET` |
| Driver | `POST /api/payments/mock` (404 when disabled) | Paymob hosted checkout |

## Shipping

Bosta when `SHIPPING_PROVIDER=bosta`, else the mock. There is no Bosta webhook. Without `BOSTA_API_KEY`, `shipOrder` fails with `NOT_ALLOWED` and reverts the status. The mock moves to DELIVERED 26 hours after creation (divided by `MOCK_SHIPPING_SPEED`; e2e helper `ageShipments` back-dates instead).

## Common changes

- **New order status or event**: extend `ORDER_STATUSES` / `ProductionEventType` in `src/types/order.ts`, add edges in `state.ts`, labels `orderStatus.*` in both dictionaries, buyer steps in `BUYER_STEPS`, and tests in `src/lib/orders/__tests__`.
- **New price line**: `QuoteLine["kind"]` (`src/types/pricing.ts`), the engine, `pricing.line.*` labels, the invoice breakdown.
- **New payment method**: `PAYMENT_METHODS`, the provider adapters, `paymentMethods.*` labels, `PaymentClient`.

## Tests

- Unit: `src/lib/orders/__tests__`, `src/lib/payments/__tests__`, `src/lib/pricing/__tests__`, `src/lib/money/__tests__`.
- e2e: `checkout.spec.ts`, `checkout-quote.spec.ts`, `checkout-states.spec.ts`, `checkout-share-guard.spec.ts` (share links cannot bypass the quote gate), `checkout-dispute-photos.spec.ts`, `checkout-vendor-view.spec.ts`, `admin-quote-price.spec.ts`, `a11y.spec.ts` (keyboard checkout), `journeys/j1-brand-orders`, `j2-price-request`, `j5-failure-paths`.

## Pitfalls

- Money: integer piasters, `vatOf` throws on a non-integer subtotal, parse input only with `src/lib/money/input.ts` (R6-AD-01, R7-AD-01).
- **R5-SEC-01**: printer staff must never see the buyer order page or invoice; buyer pages use `canViewBuyerOrder`, production files use `canViewOrder`.
- **R4-B-01**: a share-link order must not turn a quote-only model into an instant order.
- **R4-B-07 / CR-43**: the document is a receipt, not a tax invoice, until a 9-digit `ELBA_TAX_ID` is set (`sellerTaxReady()`). ETA e-invoicing is a stub (`src/lib/eta`).
- **R5-CP-38 (open)**: the Fawry WhatsApp message has no amount or expiry. **R5-CP-89 (open)**: receipt numbering.
- Notifications only log to the console until a real transport is set (`setNotifyTransport`).
