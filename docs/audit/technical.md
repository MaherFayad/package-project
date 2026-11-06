# Technical audit: server correctness and security

Scope: `src/app/api` (except `api/auth`), `src/lib/{orders,payments,pricing,shipping,notify}`, `src/lib/{db,env}.ts`, `prisma/schema.prisma` (additive), `next.config.ts`, unit tests.
Method: code review of every route and service in scope, then live requests against `next dev` and `next start` as each seeded role (anonymous, applicant `+201000000020`, buyer `…002`, vendor staff `…010` Nile Pack and `…011` Delta Cartons, admin `…001`), two passes. Each fix has a unit test (`src/lib/__tests__/technical-audit.test.ts`, `src/lib/orders/__tests__/{payment-rules,guards,totals}.test.ts`).

Standards: OWASP ASVS 4.0.3 (V2, V4, V6, V7, V11, V12, V13, V14) and OWASP Top 10 2021 (A01 broken access control, A04 insecure design, A05 misconfiguration, A08 integrity), Egypt PDPL Law 151/2020, Egyptian VAT Law 67/2016 (14%).

## Findings

| id | severity | page / file | finding | standard | fix | status |
|---|---|---|---|---|---|---|
| T-01 | critical | `src/lib/payments/paymob.ts`, `src/lib/orders/service.ts` | Paymob webhooks were trusted on HMAC alone, but Paymob's HMAC does not cover `merchant_order_id` (our Payment id). A buyer sees one signed callback (it is echoed on the redirect URL) and can replay it with another `merchant_order_id` to mark a second order of the same amount paid. | ASVS V11.1.1, V13.2.6; Top 10 A04, A08 | The intention's `intention_order_id` is stored on the Payment (`raw.intention.gatewayOrderId`). Every webhook must carry the signed `order.id` that matches it, plus EGP currency, the same provider and the exact amount. The logic lives in the pure `decidePaymentOutcome()` (`src/lib/orders/payment-rules.ts`), with 9 tests. Mismatches are logged to the order timeline and change nothing. `[VERIFY with Paymob]` the response field name. | fixed |
| T-02 | high | `api/orders/[id]/print-pdf` | Vendor staff could download the print-ready PDF (the buyer's artwork) of a PAID job before accepting it, through the order route. The vendor-job route enforced that lock but this route did not. Live: vendor `…011` on ELB-26201 (PAID) got 200 + PDF. | ASVS V4.2.1, V4.1.3; A01 | The shared `canDownloadPrintFile()` + `PRINT_FILES_UNLOCKED` in `orders/state.ts` is used by both routes. After the fix the same request returns 404. | fixed |
| T-03 | high | `api/orders/[id]/status` | The generic status API was a side door around the vendor job rules. Live: vendor `…010` moved ELB-26001 IN_PRODUCTION → QC_PENDING with zero QC photos (200). It could also accept a job it had already declined. | ASVS V11.1.1–V11.1.2; A01, A04 | `vendorMoveAllowed()` (`src/lib/orders/api-rules.ts`) applies the portal's `can()` rules. Suspended vendors get 403. Live result is now 409 NOT_ALLOWED. | fixed |
| T-04 | high | `api/orders/[id]/status` | ADMIN (any edge allowed) could set `PAID` or `REFUNDED` through the API. That leaves an order "paid" with no Payment row and no invoice, which breaks "webhooks are the only way an order becomes paid" and the e-invoice trail. | ASVS V11.1.2; A04 | `MONEY_STATUSES` are refused with 409 from every role. Money moves only through the verified webhook and the refund flow. | fixed |
| T-05 | high | `next.config.ts` | No security headers at all: no CSP, no frame-ancestors (the proof-approval and payment pages could be framed for clickjacking), no Referrer-Policy, no nosniff, no HSTS. | ASVS V14.4.1–V14.4.7; A05 | Added CSP (`default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri`/`form-action 'self'`, no `unsafe-eval` in production), X-Frame-Options DENY, nosniff, `strict-origin-when-cross-origin`, Permissions-Policy, COOP, and HSTS only when `NEXT_PUBLIC_SITE_URL` is https. Checked in Chromium on home, designer (WebGL) and catalogue: 0 CSP violations. | fixed |
| T-06 | high | `src/lib/payments/mock.ts` | Under `next start` with `ALLOW_MOCK_PAYMENTS=1`, the mock webhook secret was the published constant, so anyone could forge a signed "PAID" callback to `/api/payments/webhook?provider=mock`. | ASVS V6.4.1, V2.10.4; A02, A08 | In production the secret is now random per process (shared through `globalThis`) unless `MOCK_PAYMENTS_SECRET` is set. The in-process mock page still signs. | fixed |
| T-07 | high | `src/lib/orders/service.ts` `shipOrder` | Race: two concurrent "ship" requests (a double click, or two staff members) both booked a courier before the status check failed, giving two paid shipments. | ASVS V11.1.6 (concurrency); A04 | The order is claimed first with a conditional `READY_TO_SHIP → SHIPPED` update, then the courier is booked. A failed booking releases the claim. Shipment + event are written in one transaction. | fixed |
| T-08 | medium | `service.ts` `transitionOrder` | The status update and its timeline event were two separate writes. A crash between them left a status with no event, and the event had a different timestamp. | ASVS V11.1.6 | Both writes are in one `$transaction` with a conditional update. A lost race (double accept) throws INVALID_STATE and writes nothing. | fixed |
| T-09 | medium | `service.ts` `applyPaymentOutcome` | A REFUNDED callback for a payment that was never captured marked it REFUNDED. FAILED and PAID updates were unconditional, so a late FAILED could overwrite a concurrent PAID. | ASVS V11.1.1, V11.1.6 | Refunds need a PAID payment. FAILED, REFUNDED and PAID writes are conditional on the prior status. In the PAID transaction, losing the payment row rolls the order back too. | fixed |
| T-10 | medium | `api/payments/mock` | ADMIN could "pay" any buyer's order by card, wallet or Fawry; the doc says only the InstaPay confirmation is admin's. The route also answered `{status:"PAID"}` when the order had been cancelled meanwhile (NEEDS_REFUND). | ASVS V4.2.1; A01 | Only the buyer can pay by card, wallet or Fawry; admin only `instapay`. Outcomes other than PAID, FAILED or PENDING return 409 with the real result. | fixed |
| T-11 | medium | webhook, uploads, designs, quote, status, mock | Bodies were read whole before any size check (`req.text()`, `req.formData()`, `req.json()`). A chunked request without Content-Length bypassed the 12 MB check on uploads and was buffered in full. | ASVS V12.1.1, V13.1.3 | `src/app/api/_lib/body.ts` streams with a hard byte cap: webhook 200 KB, uploads 11 MB, designs 12 MB, quote 16 KB, status and mock 4 KB. Tested with chunked streams. | fixed |
| T-12 | medium | `api/vendor/uploads` | `cert` and `apply` files are not rows until a form is saved, so an applicant could store 60 × 10 MB every 10 minutes indefinitely (disk exhaustion). | ASVS V12.1.2; A04 | Additional cap of 30 loose files per user per day. | fixed |
| T-13 | medium | `src/lib/env.ts` | In production SESSION_SECRET was only checked for 16 characters (the docs say 32), and the `.env.example` value was accepted. | ASVS V2.9.1, V6.4.1, V14.1.3 | `sessionSecretProblem()`: 32+ characters, and no published placeholder unless the run is marked as a local production build (`OTP_DEV_ECHO=1`, never set in a deployment). | fixed |
| T-14 | medium | `src/lib/notify/index.ts` | Every notification logged the full phone or email and message text (order numbers, Fawry codes) in production, and kept them in an in-memory outbox in production. | PDPL 151/2020 (data minimisation); ASVS V7.1.1 | Addresses are masked (`+2010****67`, `m***@domain`), message text is logged only in `development`, and the outbox is off in production. | fixed |
| T-15 | medium | `src/lib/payments/paymob.ts`, `src/lib/shipping/bosta.ts` | Outbound gateway and courier `fetch` calls had no timeout, so a slow provider held request workers open with no limit. | ASVS V12/V13 resource limits | `AbortSignal.timeout(15s)`. | fixed |
| T-16 | medium | `src/lib/pricing/config.ts` | `makeConfig()` passed admin overrides straight through. A settings row could change the VAT rate, stretch quote validity past 72 h, or raise the 2,000-unit instant cap. | VAT Law 67/2016; business rules | VAT is pinned at 14%. Validity is clamped to 1–72 h, the instant cap to 1–2,000, and the margin to 0–500%. | fixed |
| T-17 | medium | `prisma/schema.prisma` | Neither SQLite nor Postgres indexes foreign keys automatically, so these lookups were full scans: order items, payments, QC photos, shipments, invoices, disputes, payouts, quotes by user, vendor staff (`User.vendorId`, used on every payment), proofs by approver, and the admin order list by status/date. | performance (N+1/scan) | 14 additive `@@index` lines; `prisma db push` applied. | fixed |
| T-18 | low | `src/lib/orders/totals.ts` | Order VAT used a float `Math.round(x*0.14+1e-9)`, a different rule from the engine's exact integer `vatOf`. That risks a 1-piaster gap between quote and invoice on large amounts. | VAT Law 67/2016; ETA e-invoice totals | `vatOn` delegates to `vatOf`; tests compare all subtotals 0–20,000 plus large values. | fixed |
| T-19 | low | `totals.ts` | Prepay discount on a fractional percentage used float math. | money integrity | Integer basis points, half up. Tested. | fixed |
| T-20 | low | `src/lib/notify/index.ts` | A broken template threw into the order flow, against the module's own contract. | ASVS V7.4.1 | Rendering is wrapped; the error is logged and an empty send is returned. | fixed |
| T-21 | low | `src/lib/shipping/bosta.ts` | An unknown Bosta state code reset the shipment to CREATED. | correctness | `bostaStatus()` keeps the last known status. | fixed |
| T-22 | low | `api/orders/[id]/status` | Another vendor's order returned 403 here (404 everywhere else), which confirmed the id exists. | ASVS V4.2.1 | Returns 404. | fixed |
| T-23 | low | `api/vendor/jobs/_shared.ts`, `api/orders/[id]/proof-pdf` | Vendor staff could fetch the dieline and the watermarked proof of PENDING_PAYMENT orders, which are never routed to a vendor. | ASVS V4.2.1 | 404 for vendors on unpaid orders; ids validated. | fixed |
| T-24 | low | `api/vendor/jobs/[id]/print-pdf` | The redirect followed any stored value starting with `/`, including protocol-relative `//host` (open redirect if the column were ever tainted). | ASVS V5.1.5 | Only `/api/orders/...` is followed. | fixed |
| T-25 | low | `service.ts` `submitReview` | A NaN rating or a double submit (unique `[orderId, authorId]`) surfaced as a 500. | ASVS V5.1.3, V7.4.1 | NaN is rejected; P2002 maps to NOT_ALLOWED; the body is capped at 2,000 characters. | fixed |
| T-26 | low | `api/quote` | The 400 response echoed every zod issue (unbounded). | ASVS V7.4.1 | Capped at 10, like the design routes. | fixed |
| T-27 | low | print-pdf, status | No rate limit on PDF generation (CPU-heavy) or on status moves. | ASVS V11.1.4 | 30 PDFs per 10 minutes and 60 moves per minute per user, with `Retry-After`. | fixed |
| T-28 | low | `service.ts` `openDispute` | Two simultaneous submits can open two disputes. The check-then-insert is not atomic, and a partial unique index (status = OPEN) is not portable to SQLite. | ASVS V11.1.6 | Needs a Postgres partial unique index at the prod migration, or a server-action debounce (the action is outside this scope). | open |
| T-29 | low | `src/lib/rate-limit.ts` | The rate limiter is in-memory per process, so limits multiply with instances. | ASVS V11.1.4 | Swap for Redis/Upstash at deploy time (foundation-owned file; infra). | open |
| T-30 | low | `next.config.ts` | The CSP keeps `script-src 'unsafe-inline'`, because Next's inline hydration needs it unless every page uses per-request nonces, which disables static rendering. | ASVS V14.4.3 | Accepted for now. Move to a nonce-based CSP in middleware when the static pages move to ISR. | open |

### Checked and found sound (no change)
- Designs (`/api/designs*`): owner or anonymous cookie only. Other users get 404 on GET and 403 on PUT. Share needs an account and ownership. Verified live as applicant and vendor.
- Admin export (`/api/admin/users/:id/export`): 401 for anonymous, 403 for buyer and vendor, 200 and audited for admin.
- Vendor files (`/api/vendor/files/...`): strict key regex (no traversal; `..%2F` gives 404), magic-byte sniffing (PNG/JPEG/WebP/PDF, never SVG), `nosniff` + `sandbox` CSP on served files, private scopes checked per order or owner.
- Dieline SVG is served with `sandbox` CSP and `nosniff`. Proof preview is private.
- Mock gateway is off outside dev unless `ALLOW_MOCK_PAYMENTS=1`. The webhook accepts only the configured provider. Unsigned calls get 401 (e2e covered).
- Quotes: >2,000 units returns `manual_quote`. Checkout caps validity at 72 h; `startPayment` refuses expired quotes. Offers never include vendor cost or margin.
- Order numbering retries on unique-number races (P2002).
- N+1: none in the routes in scope. Order reads use a single `include`. The vendor-staff notify loop is sequential I/O, not queries per row.

## Verification

| check | result |
|---|---|
| `npm run typecheck` | pass |
| `npm run lint` | pass |
| `npm test` | 46 files, 5,941+ tests, all pass (36 new tests for these fixes) |
| `npm run build` | pass |
| e2e `checkout`, `vendor`, `admin` on `next start` (`--workers=2 --trace off`, desktop + mobile) | 17 passed, 3 skipped by design (mutating flows run on desktop only, the 360px layout check on mobile only) |
| Live role probe (`next dev` pass 1, `next start` pass 2) | T-02: 200 → 404; T-03: 200 → 409; T-22: 403 → 404; T-06: forged mock webhook → 401; T-11: 300 KB webhook → 413; T-08: 3 parallel accepts → 200/409/409 with one event; designs/admin/files unchanged |
| CSP in Chromium (home, catalogue, designer WebGL, login; dev and prod) | 0 violations |

Evidence: `docs/screenshots/audit/technical/live-probe-before-after.png`, `designer-under-csp-after.png`.

## Files touched outside the listed scope
- `src/app/api/_lib/body.ts` (new, under `src/app/api`): shared capped body readers.
- `src/lib/orders/payment-rules.ts`, `src/lib/orders/api-rules.ts` (new, in `src/lib/orders`). `api-rules.ts` imports the pure `can()` from `src/components/vendor/lib/jobs.ts` (read only, not modified).
- No UI pages were changed.

---

# Round 2

Base: the round 1 merges of every area. Method: re-verified every round 1 row live on `next start` (SQLite seed, every role: anonymous, applicant `…020`, buyer `…002`, vendor staff `…010` Nile Pack and `…011` Delta Cartons, admin `…001`), then a fresh audit of every route and service in scope: authz / IDOR per role, input validation and upload safety, webhook HMAC and idempotency under concurrency, money math and the state machine, security headers and CSP in Chromium, and PERF-20. Probe fixtures: an unpaid order (ELB-26901) and an order cancelled before payment (ELB-26902) for the Nile Pack vendor, two concurrent PENDING payments, a refund callback signed with a known `MOCK_PAYMENTS_SECRET`, four concurrent dispute submits replayed from a captured server-action request.

## Round 1 re-verification

| id | round 2 result | status |
|---|---|---|
| T-01 | Unit tests pass; `decidePaymentOutcome` still binds every callback to the stored gateway order. | fixed |
| T-02 | Nile staff on paid ELB-26202 before accepting: print PDF 404. | fixed |
| T-03 | Vendor move on a cancelled order: 409 NOT_ALLOWED. | fixed |
| T-04 | Admin `to: PAID`: 409 FORBIDDEN_TRANSITION. | fixed |
| T-05 | **Reopened (round 2).** `next.config.ts` sends the full CSP, but the platform session's middleware (P-15, merged after round 1) set its own `frame-ancestors 'none'; base-uri 'self'; object-src 'none'` on every page, and a header set in middleware replaces the config one. Live `curl -I /ar`: no `default-src`, no `script-src`. Fixed as R2-01. | fixed (round 2) |
| T-06 | Unsigned or forged mock webhook: 401. | fixed |
| T-07 | Unchanged (conditional claim). The e2e journey ships once. | fixed |
| T-08 | Concurrent moves: correct on Postgres, but **on SQLite concurrent interactive transactions deadlocked** (R2-06). Fixed, and verified with 5 parallel payment callbacks. | fixed (round 2) |
| T-09 | Unit tests pass. | fixed |
| T-10 | Vendor `POST /api/payments/mock` on the buyer's payment: 404. | fixed |
| T-11 | Chunked 13 MB upload with no Content-Length: 413. | fixed |
| T-12 | Still capped; the quota is now only counted after authorisation (R2-12). | fixed |
| T-13, T-14, T-16, T-18–T-21 | Unit tests pass. | fixed |
| T-15 | Code unchanged (`AbortSignal.timeout(15s)`). | fixed |
| T-17 | Indexes present after `db push`. | fixed |
| T-22 | Another vendor's order: 404. | fixed |
| T-23 | **Partly reopened (round 2)**: only `PENDING_PAYMENT` was blocked. An order cancelled before payment still gave the vendor its proof PDF and dieline (200). Fixed as R2-02. | fixed (round 2) |
| T-24, T-25, T-26, T-27 | Unchanged; T-26 issues are still capped at 10. | fixed |
| T-28 | Fixed in round 2 (R2-09). | fixed (round 2) |
| T-29 | In-memory rate limiter; needs Redis or Upstash at deploy (foundation file, infra). | open |
| T-30 | `script-src 'unsafe-inline'` kept: Next inline hydration plus the round 1 cookie-bar pre-paint script. Nonces would make every page dynamic. | open |

## Round 2 findings

| id | severity | page / file | finding | standard | fix | status |
|---|---|---|---|---|---|---|
| R2-01 | critical | `src/middleware.ts`, `next.config.ts` | Every page was served without a real CSP: middleware replaced the full policy with `frame-ancestors 'none'; base-uri 'self'; object-src 'none'`. No `script-src`, `connect-src` or `default-src`, so any injected script could load and exfiltrate freely. Permissions-Policy was also narrowed differently. | ASVS V14.4.3, V14.4.7; Top 10 A05 | One source of truth, `src/lib/security-headers.ts`: `next.config.ts` and middleware both send the identical set. Added `frame-src 'none'`. Live: `/ar` now carries the full policy. Chromium on home, boxes, catalogue, designer (WebGL canvas 1008×582), vendor profile, checkout, orders, vendor portal, admin pricing and login: **0 violations**. Artwork upload (blob URL → canvas texture) and autosave work. | fixed |
| R2-02 | high | `lib/orders/service.ts` `canViewOrder`, `/orders/[id]`, `/checkout/pay/[id]`, `/api/orders/:id/proof-pdf`, `/api/orders/proofs/:id/preview`, `/api/vendor/jobs/_shared.ts` | Vendor staff could open orders that were never paid: unpaid ones through the order page, the pay page and the proof preview; ones cancelled before payment through those plus the proof PDF and dieline. The order page showed the buyer's name and full street address (live: ELB-26901 and ELB-26902 as `…010` rendered "منى عادل … 5 Mesaha Sq, Dokki"). Unpaid orders are never routed to a vendor. | PDPL 151/2020 data minimisation; ASVS V4.2.1; Top 10 A01 | `canViewOrder` (now pure, in `orders/state.ts`) requires `paidAt` for vendor staff. `paidAt` survives a refund, so job history stays visible. Job files use `paidAt === null` instead of `status === PENDING_PAYMENT`. The proof preview is `private, no-cache` (it was cached for 24 h after access was revoked). Live after fix: page shows not-found, proof-pdf and dieline 404. The buyer still sees everything. | fixed |
| R2-03 | high | `service.ts` `applyPaymentOutcome` | Double charge dropped silently. Two payments of the same order captured at once (two tabs, card and wallet): the losing callback read the order as PENDING_PAYMENT, lost the conditional update, and returned `ALREADY_PAID` with no record. Live: P1 charged, left `PENDING`/`FAILED`, no refund flag. | Money integrity; ASVS V11.1.6 | On a lost race, re-read the payment. If it is not PAID, record it as PAID and add the `PAID_AFTER_CANCEL_REFUND_NEEDED` note for ops (same path as late payments). Live, 5 parallel callbacks over 2 payments: 1 × PAID, 1 × NEEDS_REFUND, 3 × ALREADY_PAID; both payments PAID; 1 sale invoice; refund note written. | fixed |
| R2-04 | high | `service.ts` `transitionOrder` | A refund (admin refund, dispute refund or gateway refund webhook) moved the order to REFUNDED but issued no credit note. The SALE invoice stayed as the only tax document, so output VAT stays over-declared and the e-invoice trail cannot be reversed. | Egyptian VAT Law 67/2016; ETA e-invoicing (an issued invoice is cancelled by a credit note, never edited) | Inside the REFUNDED transition transaction, a `CREDIT_NOTE` (`CN-YYnnn`) mirroring the SALE invoice amounts is written, idempotently. The schema already had the kind. Live: refund webhook ×3 → 1 REFUNDED + 2 DUPLICATE, `INV-26002` and `CN-26001` (21,120.00 + 2,956.80 VAT = 24,076.80 EGP). The buyer invoice page still selects `kind === "SALE"`. ETA submission of the CN is still the integration's job (`etaUuid` empty). | fixed |
| R2-05 | medium | `lib/payments/paymob.ts`, `payment-rules.ts` | Paymob mapping read `success` only. A voided sale (`is_voided`) and an authorisation never captured (`is_auth && !is_capture`) both report `success: true` and were mapped to PAID. A partial refund (`refunded_amount_cents` < `amount_cents`) moved the whole order to REFUNDED. These flags are part of Paymob's HMAC string. | ASVS V11.1.1; money integrity | `paymobFlags()` / `paymobStatus()`: voided → REFUNDED, auth-only → PENDING, `error_occured` → FAILED. A partial refund sets `partialRefund`; the decision is `PARTIAL_REFUND`, which writes a note and changes nothing else. `refunded_amount_cents` is not HMAC-covered, so it can only make the handling more conservative. `[VERIFY with Paymob]` on a sandbox payload (the docs spell it `is_captured` in one place, `is_capture` in the HMAC list). | fixed |
| R2-06 | medium | `src/lib/db.ts` | On SQLite (dev, e2e, local `next start`), concurrent interactive transactions deadlocked: Prisma `updateMany` reads then writes, so two transactions each hold a read lock and wait to upgrade. Live: 5 parallel payment callbacks → 5 × 500 (P1008 socket timeout / P2028), nothing applied. Postgres is unaffected. | ASVS V11.1.6; availability | `databaseUrl()` appends `connection_limit=1` to `file:` URLs only (an explicit value wins). Verified: the same 5 callbacks now resolve correctly (see R2-03). | fixed |
| R2-07 | medium (perf) | `components/store/data.ts`, `lib/pricing/server.ts`, `service.ts` | PERF-20: catalogue reads uncached across requests. Checkout read rate cards, vendors, materials, finishes, structures and settings twice per request (19 queries). Whole rows were selected. | performance budget < 10 queries / request | **Store loaders** (`listMaterials/Structures/Vendors`, `getVendorBySlug`, pricing data and config for "from" prices): `unstable_cache`, tag `catalog`, 300 s TTL, `react.cache` on top. Existing `revalidatePath("/[locale]","layout")` in admin and vendor actions expires them through implicit tags. Live: suspending Delta Cartons in admin → profile 404 and gone from `/vendors` at once; reinstating → 200. The upload route and `submitReview` also call `revalidateTag("catalog")`. **Checkout/orders pricing** stays uncached across requests (money must come from the live DB), but is read once per request in parallel (`react.cache` + `Promise.all`). **Columns**: `select` only what is used (no vendor contact or payout fields), and rate-card structure codes come from the structures list instead of a second query. Checkout **19 → 11 queries**; `/vendors/[slug]` and size pages 0 when warm. | fixed |
| R2-08 | medium | `next.config.ts` | The global `/:path*` header rule also replaced the route handlers' own CSP. User files (`/api/vendor/files/...`) and the dieline SVG were served under the page policy (`script-src 'unsafe-inline'`) instead of their `default-src 'none'; sandbox`. Live: a PNG/HTML polyglot upload (magic bytes pass) was served with the page CSP. `nosniff` still blocked HTML sniffing, so this was defence in depth lost, not direct XSS. | ASVS V12.5.2, V14.4.3 | Page headers apply to `/((?!api/).*)`. `/api/:path*` gets the same headers without CSP (`apiHeaders()`), so the per-route sandbox policy survives. Live: the polyglot is served with `default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox`. JSON and PDF are unaffected; a sandboxed PDF would be blocked by Chrome's viewer, so no CSP is added there. | fixed |
| R2-09 | low | `service.ts` `openDispute`, `schema.prisma` | T-28: two simultaneous submits could open two disputes. | ASVS V11.1.6 | Additive `Dispute.seq Int?` + `@@unique([orderId, seq])`. Inside a transaction: re-check for an open dispute (catches serialised writers on SQLite), then `seq = count`, so concurrent writers on Postgres collide (P2002 → NOT_ALLOWED). Description capped at 4,000. Live: 4 concurrent replays of the real server action → exactly 1 OPEN dispute. | fixed |
| R2-10 | low | `service.ts` `submitReview` | The vendor rating was read-modify-write on `Vendor`. Two buyers reviewing the same vendor at once lose one update, and drift never heals. | ASVS V11.1.6 | Recomputed from `review.aggregate` (avg, count) inside the transaction. | fixed |
| R2-11 | low | `/api/vendor/jobs/:id/print-pdf` | ADMIN could generate a "print-ready" PDF for an unpaid order (200), unlike `/api/orders/:id/print-pdf` (404). | Consistency; ASVS V4.1.3 | Both routes require a paid status, for ADMIN too. Live: 409. | fixed |
| R2-12 | low | `/api/vendor/uploads` | The daily quota for loose `cert`/`apply` files was counted before authorisation, so refused attempts (wrong role, vendor already set) used it up. | ASVS V11.1.4 | Counted after the scope checks. | fixed |
| R2-13 | medium (perf) | `package.json`, `scripts/check-bundle-size.mjs` | No automated bundle budget. | Perf budget: non-3D JS < 200 KB gz | `npm run test:size` (after `npm run build`) computes first-load JS per App Router page (root main files + every layout/template/loading/error/not-found on the path + page, gzip -9). It fails when a non-3D page exceeds 200 KB or a non-3D page ships three.js/r3f. 3D pages are allow-listed (`/design*`, `/s/*`, `/dev/*`). Current: all 41 non-3D pages pass, largest `/vendor/profile` 172 KB; 3D: designer 526 KB. | fixed |
| R2-14 | low (perf) | admin dashboard (14 queries), vendor overview (15), order detail (15) | Still above 10 queries. Admin already runs its reads in parallel. Vendor loads the vendor twice (layout + page). Order detail is one `findFirst` with `include`, which Prisma splits into 13 SELECTs in one engine round trip (all < 1 ms). | PERF-20 | Loaders are owned by the admin and vendor sessions (out of scope). Suggested: `react.cache` around the vendor lookup in `components/vendor/server`; on Postgres, enable `relationJoins` and `relationLoadStrategy: "join"` for the order include. | open |
| R2-15 | low | `components/vendor/server/actions.ts` `saveRateCard`, `components/admin/server/actions.ts` `savePricingSettingsAction` | These edits only revalidate the portal and admin, so public "from" prices refresh within the 300 s TTL rather than at once. Before R2-07 the static pages were not refreshed at all. Checkout prices are always live. | Freshness | One line each, `revalidateTag("catalog")`, for the admin and vendor owners. | open |

### Checked and found sound in round 2
- Designs: owner or anonymous cookie only (vendor and anonymous 404; foreign share 403; foreign PUT is rejected before parsing).
- Webhook: wrong provider 400, unsigned 401, replayed refund → DUPLICATE, `amountPiasters` mismatch → REJECT with a note.
- Quote: dims below or above structure limits → INVALID_DIMS with bounds; a PENDING vendor's id returns no offers and leaks nothing; unknown keys stripped; `__proto__` in the JSON is inert (zod object parse).
- Uploads: SVG renamed `.png` and HTML renamed `.pdf` → 415 (magic bytes); buyer → portfolio 403; vendor → `apply` 403; QC upload on a job that is not in production → 409; anonymous 401; private files 404 for anonymous users.
- Money: `orderTotals` and `vatOf` stay integer and exact (unit tests unchanged); prepay discount only on goods; credit note equals the sale invoice.
- State machine: PAID/REFUNDED never reachable from the status API; vendor moves on cancelled orders → 409.

## Performance (PERF-20, measured)

Warm queries per request (`docs/audit/tools/prisma-query-log.cjs`, 3 requests each, `next start`):

| route | before | after |
|---|---|---|
| `/en/checkout/[designId]` (buyer) | 19 | **11** |
| `/en/vendors/nile-pack` | 3 cold / 0 | 0 |
| `/en/boxes/shipping-box/250x180x80` | n/a | 9 cold / 0 warm |
| `/en/design/mailer-box` | n/a | 1 |
| `/en/orders/[id]` | 15 | 15 (one include, see R2-14) |
| `/en/vendor` | 15 | 15 (out of scope, R2-14) |
| `/en/admin` | 14 | 14 (already parallel) |

Bundle budget (`npm run test:size`): 41 / 41 non-3D pages ≤ 200 KB gz (max 172 KB).

## Round 2 verification

| check | result |
|---|---|
| `npm run typecheck`, `npm run lint` | pass |
| `npm test` | 6,256 tests, all pass (11 new round 2 tests in `src/lib/__tests__/technical-audit-r2.test.ts`: middleware and config headers, API CSP exclusion, vendor visibility, Paymob flags and partial refunds, SQLite URL) |
| `npm run build`, `npm run test:size` | pass |
| e2e `checkout`, `vendor`, `admin`, `smoke`, `journey` (`--workers=2 --trace off`) | 24 passed, 4 skipped by design |
| e2e `storefront`, `designer`, `models` | storefront + designer all pass (the vendor-list check first failed on a stale on-disk cache entry baked in at build time; fixed by bypassing the cross-request cache during `next build`). models: 386 passed, 2 failed under 2 workers (FEFCO_0421_1, FS_BURGER_CLAMSHELL), and both pass when re-run alone, so this is software-WebGL timing, not related to these changes |
| Live probes | listed per row above |

Evidence: `docs/screenshots/audit/technical-r2/` (designer, home and checkout under the full CSP; designer with an uploaded image).

## Files touched outside the listed scope (round 2)
- `src/middleware.ts` (platform): `secure()` now calls the shared `applySecurityHeaders()`; nothing else changed.
- `src/lib/security-headers.ts` (new): shared header set used by `next.config.ts` and middleware.
- `package.json`: `test:size` script. `scripts/check-bundle-size.mjs` (new).

## Re-test after merging the integrated base (`origin/claude/exciting-albattani-8kzgsu` at d1ea599)

Merged with no conflicts. On the merged code, re-seeded, `next start`:

| check | result |
|---|---|
| CSP on pages | full policy on `/ar`, `/en/catalog`; Chromium on 11 pages incl. the new catalogue model page (3D canvas 636×636) and the designer (WebGL, image upload): **0 violations** |
| API headers | `nosniff` + `X-Frame-Options` on `/api/*`; served files keep their `sandbox` CSP |
| authz (fresh fixtures) | vendor on unpaid / cancelled-unpaid orders: page not found, proof PDF and dieline 404; other vendor's proof 404; vendor print PDF before accept 404; admin `PAID` 409; admin print PDF on unpaid 409; buyer still sees own unpaid order |
| caching | admin suspends Delta Cartons → `/vendors/delta-cartons` 404 and gone from `/vendors` at once; reinstate → back at once |
| unit / lint / types / build / size | 8,170 tests pass; lint and typecheck clean; build ok; 41/41 non-3D pages ≤ 200 KB (max 172 KB) |
| e2e checkout, vendor, admin, smoke, journey, storefront, designer | 44 passed, 4 skipped by design |

### New findings on the merged code

| id | severity | page / file | finding | standard | fix | status |
|---|---|---|---|---|---|---|
| R2-16 | medium | `api/catalogue/quote-request` (new route from the catalogue session) | Body read with `req.json()`, uncapped: a chunked body was buffered in full (the T-11 pattern). Unknown keys were silently accepted. | ASVS V12.1.1, V13.1.3 | `readJsonCapped(req, 4 KB)` → 413 `TOO_LARGE`; schema `.strict()`. Live: 5 KB body 413; unknown key 400; anonymous 401; unknown model 400; valid request 201 (`Quote` REQUESTED, totals 0); 6th request in a minute 429. | fixed |
| R2-17 (B-04, server side) | medium | `lib/orders/preflight.ts` (new), `service.ts` `placeOrder`, `schema.prisma` `Proof.preflight` (additive) | "Ready to print" ran only in the designer. The proof approval never ran preflight, so a design with red issues (image under 150 dpi, text across a fold) could be approved and sent to print. | Business plan §1.3 bridge 3; Consumer Protection Law 181/2018 (informed approval) | At approval, the server runs the designer's own `runPreflight()` on the exact snapshot that becomes the proof. Red issues block with `PREFLIGHT_BLOCKED` unless the buyer explicitly acknowledges (`acknowledgePreflight`). The result (counts, codes, faces, acknowledged) is stored on `Proof.preflight` and in the PROOF_APPROVED timeline note (`PREFLIGHT:1E/0W:ACK`), so vendor and ops see it. Geometry errors never block. Error copy in en/ar points to the designer's "Check" tab ("الفحص"). Unit tests: blank design passes, a 40 px image over a panel blocks, acknowledgement passes. Live: the e2e orders recorded `PREFLIGHT:0E/0W`. **Left to checkout**: show the result on the proof step and offer the acknowledge checkbox (the action already accepts the flag). | fixed (server); UI open |

Files touched outside scope for R2-17: `src/app/[locale]/(checkout)/checkout/actions.ts` (optional `acknowledgePreflight`, passed through) and `src/i18n/checkout.{en,ar}.ts` (one `PREFLIGHT_BLOCKED` string each).

## E2E test reliability (parallel-safe suite)

Base: merged `origin/claude/exciting-albattani-8kzgsu-r2-platform` (829ae34, main + platform). With `--workers=2`, specs collided on shared seeded rows and phones, so one random test failed per run (vendor accept-job, smoke mobile sign-in, admin QC), and journey / `admin.spec.ts:50` timed out on cold starts.

| id | severity | file | finding | fix | status |
|---|---|---|---|---|---|
| E-01 | high | `e2e/vendor.spec.ts`, `e2e/admin.spec.ts` | Mutating tests reset and drove shared seeded orders: vendor ELB-26201; admin QC and admin payout BOTH on ELB-26301 (one deleted the payouts the other was creating). | `e2e/fixtures/factory.ts`: `cloneOrder()` copies a seeded template (items, proof, timeline, QC photos, paid payment) into a private order `ELB-E2E-<label><worker><hex>`, outside the real `ELB-26nnn` sequence. Each mutating test gets its own order; the vendor test also gets its own Delta Cartons staff account. Everything is deleted in `afterAll` (`cleanup()`). | fixed |
| E-02 | high | smoke, checkout, storefront, designer, journey | OTP phones were `Date.now() % 1e8`. Two workers (or the desktop and mobile projects) starting in the same millisecond got the same phone and hit the per-phone limit (1 per 30 s). | `uniquePhone()`: worker index + per-process counter + random digits, checked against `User` and `OtpCode`. The per-phone limits can no longer collide. The per-IP limit (20/h) stays far away: about 11 OTP sign-ins per run. | fixed |
| E-03 | medium | `e2e/catalogue.spec.ts`, `e2e/admin.spec.ts` (quote leads) | Both created REQUESTED quotes for the seeded buyer; the catalogue test read "the latest REQUESTED quote of that buyer", which could be admin's. | Each uses a fresh buyer from the factory. | fixed |
| E-04 | medium | all OTP flows | A late hydration re-render could wipe the typed phone after the "button enabled" check, so "Send code" only showed the client "Enter a valid … number" alert (seen: checkout mobile). | Shared `sendOtp()`: verifies the field holds the phone before clicking. It re-types and re-clicks only while that client-side alert proves no request was sent (so it never spends the phone's rate limit). Same assertion on the OTP banner. | fixed |
| E-05 | medium | `admin.spec.ts` QC, `vendor.spec.ts` accept | Clicking the order link right after switching the list tab (a client navigation that re-renders the list) was sometimes lost: link present, no navigation. | Click until the order URL opens, then the same heading assertion (the pattern storefront.spec already used). | fixed |
| E-06 | medium | `playwright.config.ts`, `e2e/global-setup.ts` (new) | First test on a cold route paid the route-bundle / Prisma / cache load (journey and `admin.spec.ts:50` timeouts). | Global setup (it runs after `webServer` is up) waits for the server, then requests 32 heavy routes once each as anon, buyer, vendor and admin, using temporary session rows that it deletes afterwards. It takes about 1.4 s. | fixed |
| E-07 | high (product) | `src/components/catalogue/CatalogueBrowser.tsx`, `catalogue.module.css` (catalogue session's files) | Real bug found by `catalogue: Arabic RTL, no horizontal scroll`: until the grid was measured, the windowed grid laid out 24 absolutely positioned cells for a 1200 px desktop width. On a 360 px phone the layout viewport became 1184 px wide for up to ~2.5 s: horizontal overflow, the page painted zoomed out, then a large layout shift. Live: overflow 824 px at load on `/ar/catalog` and `/en/catalog`, 0 after 2.5 s. | Before measurement the `<ul>` is a plain responsive CSS grid (2 / 3 / 4 columns at the same breakpoints as `columnsFor()`, via a container query on `.browser`). After measuring it is the same virtual layout as before. Live after the fix: 0 overflow at every 50 ms sample from first paint; 4 / 3 / 2 columns at 1440 / 800 / 390. WCAG 2.2 1.4.10 Reflow. | fixed |

No assertion was removed or loosened and no test was skipped. The existing `test.skip` lines are the specs' own desktop-only / mobile-only splits.

| proof (`--workers=2 --trace off`, `next start`, seeded DB) | result |
|---|---|
| non-model specs (admin, catalogue, checkout, designer, journey, smoke, storefront, vendor), run 1 | 60 passed, 0 failed, 12 skipped by design |
| run 2 | 60 passed, 0 failed |
| run 3 | 60 passed, 0 failed |
| full suite including `models` and `catalogue-models` | see the commit message |

Before these fixes, the same three runs gave 1 failure each in the first attempt (`checkout` mobile OTP, E-04), then 1 and 2 failures (E-05, E-07).
