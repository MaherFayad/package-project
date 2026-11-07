# Elba (علبة): architecture

Elba is a managed marketplace for custom printed packaging in Egypt. A visitor designs packaging in 3D for free, gets a price from printer rate cards (or asks for one), approves a proof and pays. Elba is the merchant of record: it buys the job from the printer (`vendorCostPiasters`) and sells it to the buyer with a margin. Product reasoning is in `docs/research-report.md`. Deploy is in `docs/DEPLOY-CLOUDFLARE.md`. Session orientation is in `CLAUDE.md`.

This file was refreshed against the code on 2026-11-07. Paths are relative to the repo root.

## 1. Runtime shape

| Concern | Dev, unit tests, e2e | Production |
|---|---|---|
| App server | `next dev` / `next start` on Node | One Cloudflare Worker (`worker.ts` wraps `.open-next/worker.js`) |
| Database | SQLite, `prisma/schema.prisma`, one client | Neon Postgres via Hyperdrive, `prisma/postgres/schema.prisma` (generated), one client per request (`src/lib/db.ts`) |
| Private files | `var/uploads`, `./storage` on disk | R2 binding `ELBA_FILES` |
| Static files | `public/`, `.next/static` | Workers static assets |
| Daily job | `npm run jobs:daily` | Cron Trigger `17 6 * * *` (09:17 Cairo) |

`src/lib/runtime/cloudflare.ts` detects Workers by reading the OpenNext context slot (`cloudflareContext()`); no code imports `@opennextjs/cloudflare` directly. `src/lib/runtime/build-facts.ts` replaces build-directory reads on Workers with `/_elba/build-facts.json` (written by `scripts/cloudflare/write-build-facts.ts`). `GET /api/health` reports runtime, build facts and database status.

## 2. Request flow

1. **Worker** (production only, `worker.ts`): a URL whose path cannot be percent-decoded gets `400 Bad Request` (OpenNext would throw a 500). Build facts load once per isolate. Then OpenNext handles the request.
2. **Middleware** (`src/middleware.ts`). Matcher skips `api`, `_next`, `seed`, `favicon.ico`, `robots.txt`, `sitemap.xml` and any path with a dot.
   - First segment `ar` or `en`: forwards request headers `x-elba-locale`, `x-elba-path` (R2-01, lets the design layout 404 an unknown model) and `x-elba-search` (R8-01, lets `/start` answer deep links with a 307). Sets the `elba_locale` cookie (1 year) when it differs.
   - **Static 404 rewrite** (R6-RS-11): `isKnownMissing()` in `src/lib/routing/static-404.ts` decides, without a database, that a URL cannot exist (unknown top segment, bad `/s/<token>`, unknown legal doc, design model, catalogue param, box style or size, children of leaf pages). Those are rewritten to `/{locale}/page-not-found` with status 404, so the server-rendered 404 is sent instead of a client-only `notFound()`. The slug sets come from `src/lib/routing/route-slugs.generated.ts`.
   - Any other path: 307 to `/{elba_locale cookie or "ar"}{path}` with the query kept.
   - Every response gets the security headers (section 12).
3. **Layouts**: `src/app/[locale]/layout.tsx` sets `<html lang dir>`, fonts, the root i18n scope and `VisitBeacon`. Area layouts add chrome: `MarketingShell` (store, detail, auth, orders, share, vendor apply, design picker), `CheckoutShell` (checkout), and their own frames for the editor, vendor portal and admin. Each renders exactly one `<main id="main">`.
4. **Detail pages** validate their record in `layout.tsx` and call `notFound()` above any Suspense boundary (R5-PL-03), because a `notFound()` inside a streamed boundary answers 200.

## 3. Route map (`src/app`)

| Area | Routes |
|---|---|
| Public site | `(store)/page.tsx` home, `start`, `designer`, `(why)/why-elba`, `(why)/pricing`, `catalog/(list)`, `boxes/(list)`, `bottles`, `vendors/(list)`, `account` (+ `account/export` route), `page-not-found`, `[...missing]` |
| Detail | `(detail)/catalog/[slug]`, `boxes/[structure]/(overview)`, `boxes/[structure]/[size]`, `vendors/[slug]`, `legal/[doc]` |
| Auth | `(auth)/login`, `(auth)/unsubscribe` |
| Designer | `design/(picker)`, `design/(editor)/[structure]` |
| Buyer | `(checkout)/checkout`, `checkout/[designId]`, `checkout/pay/[orderId]`, `orders/(list)`, `orders/[id]`, `orders/[id]/invoice`, `s/[id]` (share) |
| Printer | `vendor/apply`, `vendor/(portal)`: overview, `jobs`, `jobs/[number]`, `payouts`, `profile`, `rate-cards`, `rate-cards/[id]` |
| Admin | `admin/(overview)`, `orders`, `orders/[number]`, `vendors`, `vendors/[slug]`, `vendors/applications/[id]`, `users`, `users/[id]`, `privacy`, `catalog`, `pricing`, `payouts`, `disputes`, `disputes/[id]`, `quotes`, `moderation`, `audit` |
| Dev (gated) | `dev/(tools)/3d`, `dev/(tools)/catalogue/[code]`, `dev/(tools)/finishes`, `dev/(tools)/ui`, `dev/kit` |
| API | `api/auth/{request-otp,verify-otp,logout,me}`, `api/designs`, `api/designs/[id]`, `api/designs/[id]/share`, `api/designs/brand-colors`, `api/quote`, `api/catalogue/quote-request`, `api/orders/[id]/{status,print-pdf,proof-pdf,dispute-photos}`, `api/orders/proofs/[proofId]/preview`, `api/payments/{mock,webhook}`, `api/vendor/{uploads,files/[...key],jobs/[id]/dieline,jobs/[id]/print-pdf}`, `api/admin/users/[id]/export`, `api/events`, `api/jobs/follow-up`, `api/webhooks/whatsapp`, `api/health` |
| Root | `robots.ts`, `sitemap.ts`, `not-found.tsx`, `global-error.tsx`, `fonts.ts`, `font-preload.ts`, `model-poster.ts` |

Most mutations are server actions (`actions.ts` next to the page, or `src/components/{vendor,admin}/server/actions.ts`), not API routes. `src/app/api/_lib/body.ts` caps request bodies (`readJsonCapped`, `readFormCapped`, 413 `TOO_LARGE`).

## 4. Data model (`prisma/schema.prisma`)

Conventions: money in integer piasters (`...Piasters`), enum-like columns are `String` with unions in `src/types/*.ts`, Json columns via `toJson` / `fromJson`, bilingual pairs `xxxAr` / `xxxEn`, ids are `cuid()`. Import the client as `import { db } from "@/lib/db"` (server only).

| Group | Model | One line |
|---|---|---|
| Identity | `User` | Phone (E.164, unique), name, `role` BUYER/VENDOR/ADMIN, locale, marketing consent, `vendorId` for printer staff, `brandColors` Json |
| | `Organization` | Buyer company: name, tax id, commercial register, city |
| | `Session` | `tokenHash` (sha256 of the cookie token), expiry, ip, user agent |
| | `OtpCode` | Hashed 6-digit code, expiry, attempts, `consumedAt` |
| | `Consent` | PDPL log: kind TERMS/PRIVACY/MARKETING/RETARGETING, granted, `textVersion`, locale, ip |
| Printers | `Vendor` | Slug, bilingual name/city/bio (+ pending bio under review), machines, capabilities, certifications, rating, on-time stats, lead time, MOQ, service areas, status PENDING/ACTIVE/SUSPENDED |
| | `VendorPortfolioItem` | Photo + bilingual caption, status PENDING/APPROVED/REJECTED (public only once approved) |
| | `VendorApplication` | Onboarding form: legal name, CR and tax card numbers, documents (private upload keys), status SUBMITTED/UNDER_REVIEW/APPROVED/REJECTED |
| Catalogue | `Structure` | The 16 core structure codes (the rate-card bases): limits, default dims, presets |
| | `CatalogModel` | One row per library model: code, slug, kind box/vessel, group, `baseCodes` (structures it is priced as), materials, presets |
| | `Material` | Board or stock: code, family, board type, flute, colour, gsm, thickness, food safe |
| | `Finish` | Finish code with default unit surcharge and setup (piasters) |
| | `RateCard` | Per vendor x structure x material: qty tiers (buy price ex-VAT at `referenceAreaM2`), setup, die cost, sides surcharge, finish surcharges, lead time, `standardDies` |
| Design | `Design` | Owner or `anonId`, `structureCode` (base), `modelCode`, `config` (features, finishes, vessel), dims, material, finish, print sides, artwork, `shareToken`, `expiresAt` (anonymous: 30 days), `followedUpAt` |
| | `Proof` | Immutable `snapshot` of the DesignDoc, `hash`, PDFs, approval (time, ip, user), server `preflight` |
| Commerce | `Quote` | Lines, subtotal/VAT/shipping/total, `validUntil`, status (OPEN, ACCEPTED; price requests REQUESTED, PRICED, ACCEPTED), `pricedAt`, `deliveryDays`, `vendorCostPiasters` |
| | `Order` | `number` (`ELB-YYnnn`, reprints `<number>-R<n>`), buyer, vendor, quote, `status`, money fields, `vendorCostPiasters`, shipping address, `billing` snapshot, timestamps, reserved `referrerId` |
| | `OrderItem` | Proof, structure, `modelCode`, `config`, dims, material, finish, sides, quantity, unit and line totals, `printPdfUrl` |
| | `ProductionEvent` | Order timeline: type (ProductionEventType), note, actor |
| | `QcPhoto` | Printer QC photo: kind FIRST_SHEET/PACKED_BUNDLE/OTHER, status PENDING/APPROVED/REJECTED |
| | `Shipment` | Provider mock/bosta/vendor_van, tracking number, status, events |
| | `Payment` | Provider mock/paymob, method CARD/WALLET/FAWRY/INSTAPAY, status, amount, gateway refs, sanitised `raw` |
| | `Payout` | To the printer: kind ADVANCE (40%)/BALANCE, status PENDING/APPROVED/PAID |
| | `Invoice` | SALE (`INV-YYnnn`) or CREDIT_NOTE (`CN-YYnnn`), totals, ETA e-invoice uuid/status |
| | `Review` | 1 to 5 rating per order and author |
| | `Dispute` | Reason, description, photos (private keys), status OPEN/UNDER_REVIEW/RESOLVED_REPRINT/RESOLVED_REFUND/REJECTED, `seq` unique per order |
| Privacy | `DataRequest` | PDPL EXPORT or DELETE request, status, no relation (survives anonymisation) |
| Ops | `AuditLog` | Append-only log of admin mutations: actor, action, entity, before/after, ip |
| | `PlatformSetting` | Key/value settings edited in admin (`pricing`, `checkout`, `vendor-metrics`) |
| Analytics | `Event` | First-party funnel event: name, pseudonymous ids, small props; deleted after 13 months |

Shared types live in `src/types/` (`common.ts`, `structure.ts`, `material.ts`, `design.ts`, `pricing.ts`, `vendor.ts`, `order.ts`), re-exported from `@/types`. Change them additively.

## 5. Auth, sessions and roles

- **Phone OTP only**, no passwords. `POST /api/auth/request-otp` `{ phone }` (any Egyptian format, Arabic digits accepted, normalised by `normalizeEgyptPhone`) then `POST /api/auth/verify-otp` `{ phone, code, name?, locale, acceptTerms?, marketingConsent?, gateReason? }`. Also `logout` and `me`.
- OTP: 6 digits, 5 minutes, 5 attempts per code (claimed atomically). Hash is `sha256(phone:code:SESSION_SECRET)` (`src/lib/auth/crypto.ts`). A new request invalidates older codes; rows older than 24 h are deleted. **Lockout**: 10 wrong codes per phone in 60 minutes (database backed).
- Sending: `sendOtpSms()` in `src/lib/auth/otp.ts` is an empty stub. With `OTP_DEV_ECHO` on, the code is logged and returned as `devCode`.
- New accounts must accept terms; marketing consent is a separate unchecked box. Each choice writes a `Consent` row with `CONSENT_TEXT_VERSION` (`src/lib/auth/constants.ts`). Verify claims anonymous designs by the `elba_anon` cookie.
- **Sessions**: random token in cookie `elba_session` (httpOnly, SameSite=Lax, Secure in production, 30 days); only its sha256 is stored. `createSession` rotates. ADMIN sessions die 12 hours after creation (`sessionLive`).
- **Roles**: BUYER, VENDOR, ADMIN. ADMIN passes every role check. Helpers in `src/lib/auth/session.ts`:

| Helper | Use |
|---|---|
| `getSession()` | Cached per request |
| `requireUser(locale, next?)` | Redirects to `/{locale}/login?next=` |
| `requireRole(roles, locale, next?)` | Wrong role redirects to `/{locale}?denied=1` |
| `requireAdminPage()` | `notFound()` unless ADMIN (first line of every admin page, R6-SEC-09) |
| `apiRequireRole(roles?)` | Route handlers: returns the user or a 401/403 Response |

- **CSRF**: `isCrossSiteRequest()` (`src/lib/auth/csrf.ts`) uses `Sec-Fetch-Site`, then Origin vs Host; mutating API routes return 403 on cross-site requests. Server actions rely on Next's own origin check.

## 6. Pricing and quotes

- Pure engine in `src/lib/pricing/engine.ts` (`quote`, `priceTable`, `rankOffers`); database loading in `src/lib/pricing/server.ts` (`loadPricingData`, `quoteFromDb`); defaults in `src/lib/pricing/config.ts` (`DEFAULT_PRICING_CONFIG`), overridden by the admin `pricing` setting.
- A price per vendor: interpolate the rate card tiers in log(quantity), scale by blank area vs the card's reference area (board share 0.6, clamped 0.25 to 6) and the weekly board/FX index, apply colours and sides, compare offset with digital short run, add finishes, die (waived for a standard die within 2 mm), setup and shipping (per zone), add margin (default 25%, not on shipping), then VAT 14% on the subtotal.
- Instant prices cover quantities up to `MAX_INSTANT_QTY = 2000` (tiers 100, 250, 500, 1000, 2000). Above that, or for a model whose order mode is not instant, the outcome is `manual_quote` and the buyer files a **price request**: a `Quote` with status REQUESTED. Admin sends a price (PRICED, `validUntil` from settings, `vendorCostPiasters` stored), the buyer checks out with `?quote=<id>` and the quote becomes ACCEPTED on payment.
- Library models price through their base structure's rate card with their own area (`QuoteInput.model`). Containers price as `ROLL_LABEL`, `PRINTED_POUCH` or `PRINTED_TUBE`.
- `POST /api/quote` (signed in, 60/min) returns `toPublicOutcome()`, which strips vendor cost and margin. Details: `docs/guides/checkout-and-orders.md`.

## 7. Orders lifecycle

Statuses (`src/types/order.ts`): `PENDING_PAYMENT`, `PAID`, `PROOF_APPROVED`, `ACCEPTED`, `IN_PRODUCTION`, `QC_PENDING`, `READY_TO_SHIP`, `SHIPPED`, `DELIVERED`, terminal `CANCELLED`, `REFUNDED`.

```
PENDING_PAYMENT --pay (SYSTEM)--> PAID --accept (VENDOR)--> ACCEPTED --start--> IN_PRODUCTION
   |  cancel (BUYER/SYSTEM)                                        QC upload (VENDOR) |
   v                                                                                  v
CANCELLED            READY_TO_SHIP <--QC approve (ADMIN)-- QC_PENDING --QC reject--> IN_PRODUCTION
                         | ship (VENDOR/SYSTEM)
                         v
                      SHIPPED --courier sync (SYSTEM)--> DELIVERED
Any paid status --refund (SYSTEM via admin)--> REFUNDED
```

- The edge table and actors live in `src/lib/orders/state.ts` (`assertTransition`, `canActorTransition`). `transitionOrder()` in `src/lib/orders/service.ts` applies one with a conditional update, writes the `ProductionEvent`, stamps dates, issues a credit note on REFUNDED and notifies the buyer.
- The proof is approved at checkout, before the order exists. A printer can download the print PDF from ACCEPTED on (`PRINT_FILES_UNLOCKED`).
- Disputes open within 30 days of DELIVERED. Admin resolves by refund or reprint (a new zero-price PAID order `<number>-R<n>`).
- Payouts: 40% ADVANCE on vendor acceptance, BALANCE after delivery, both moved RAISE, APPROVE, PAY by admin. A BALANCE is held during an open dispute.

## 8. Payments

- `getPaymentProvider()` (`src/lib/payments`) returns Paymob when `PAYMENTS_PROVIDER=paymob`, else the mock. Methods CARD, WALLET, FAWRY (Paymob kiosk integration), INSTAPAY (manual match against `INSTAPAY_ADDRESS`).
- **Mock**: allowed in dev; under `next start` only with `ALLOW_MOCK_PAYMENTS=1` (`mockPaymentsEnabled()`). Its webhook is signed with HMAC-SHA256 (`x-mock-signature`). `POST /api/payments/mock` drives it and returns 404 when disabled.
- **Webhook**: `POST /api/payments/webhook?provider=` (600/min per IP, 200 KB cap). Paymob uses HMAC-SHA512 over the documented field list. `decidePaymentOutcome()` (`src/lib/orders/payment-rules.ts`) binds the gateway reference, currency and amount and ignores duplicates; `applyPaymentOutcome()` marks the order PAID, the quote ACCEPTED and issues the `INV-` invoice in one transaction, then generates print PDFs and notifies buyer and printer. A capture after cancel is flagged `PAID_AFTER_CANCEL_REFUND_NEEDED`.
- Prepay discount: 3% by default (`src/lib/orders/checkout-settings.ts`), overridden by `PREPAY_DISCOUNT_PCT` or the admin `checkout` setting.

## 9. Shipping

`getShippingProvider()` (`src/lib/shipping`) returns Bosta when `SHIPPING_PROVIDER=bosta`, else the mock. Bosta (`bosta.ts`, a skeleton) creates deliveries and reads their state; there is **no Bosta webhook**. `syncShipments()` polls at most once a minute per order and moves SHIPPED to DELIVERED. Without `BOSTA_API_KEY`, shipping fails with `NOT_ALLOWED` and the order stays where it was. The mock walks PICKED_UP, IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED over 26 hours (`MOCK_SHIPPING_SPEED` divides that).

## 10. Notifications

`notify()` (`src/lib/notify/index.ts`) tries WhatsApp, falls back to SMS, and also emails when an address is known. **All transports are console transports today**; `setNotifyTransport()` is the seam for real ones. Failures never throw. Templates (`NOTIFY_TEMPLATES`): ORDER_PLACED, PAYMENT_RECEIVED, PAYMENT_FAILED, FAWRY_CODE, INSTAPAY_PENDING, VENDOR_NEW_JOB, STATUS_CHANGED, SHIPPED, DELIVERED, REFUNDED, DISPUTE_OPENED, REVIEW_THANKS, DESIGN_FOLLOW_UP; texts live under `notify.*` in the dictionaries (server only). Inbound WhatsApp (`/api/webhooks/whatsapp`) verifies `X-Hub-Signature-256` and treats a STOP reply as withdrawing marketing consent; without `WHATSAPP_APP_SECRET` it answers 503.

## 11. Files and storage

`src/lib/storage/blob.ts`: `putBlob`, `getBlob`, `hasBlob`, `deleteBlob`, `listBlobs`. On Workers it uses R2 (`ELBA_FILES`); on Node, keys `uploads/*` go to `ELBA_UPLOAD_DIR` (default `var/uploads`) and `storage/*` to `ELBA_STORAGE_DIR` (default `./storage`). Keys are validated against path traversal. There are **no signed URLs**: private files are served only by authorised routes (`/api/vendor/files/[...key]` via `canReadFile`, the order PDF and preview routes). Upload rules (`UPLOAD_RULES` in `src/components/vendor/lib/files.ts`): images or PDF by magic bytes, never SVG, 8 to 10 MB, metadata stripped.

## 12. Security headers, CSP, rate limiting

- One source: `src/lib/security-headers.ts`, applied by `next.config.ts` and repeated by the middleware (a header set in middleware replaces the config one). CSP: `default-src 'self'`, `script-src 'self' 'unsafe-inline'` (no nonce, so pages stay static; T-30), `frame-ancestors 'none'`, `object-src 'none'`, `frame-src 'none'`, `form-action 'self'`. Also `X-Frame-Options: DENY`, `nosniff`, strict referrer, a Permissions-Policy that denies camera, mic, geolocation and payment, `Cross-Origin-Opener-Policy: same-origin`, and HSTS on production HTTPS. API routes get the same set without CSP plus `X-Robots-Tag: noindex`.
- Rate limiting: `rateLimit(namespace, key, limit, windowMs)` in `src/lib/rate-limit.ts`, a fixed window **in memory per process** (per isolate on Workers; T-29 open). `clientIp()` trusts `CF-Connecting-IP` only when `TRUST_CF_CONNECTING_IP=1`. OTP: 1 per 30 s and 5 per hour per phone, 20 per hour per IP; verify 30 per 10 minutes per IP. Production adds Cloudflare WAF rules (`docs/DEPLOY-CLOUDFLARE.md` step 9).

## 13. Jobs

`runDailyJobs(now)` (`src/lib/jobs/index.ts`) runs, each isolated: `runRetention` (OTP rows over 24 h, expired sessions, expired anonymous designs without proofs, analytics events over 13 months), `runFollowUps` (one WhatsApp nudge for a design saved 24 h to 7 days ago with no order, only with marketing consent; recorded in `Design.followedUpAt`) and `syncVendorOnTime`. Triggered by `POST /api/jobs/follow-up` with `Authorization: Bearer $CRON_SECRET` (503 when the secret is unset in production), by the Worker cron, or locally by `npm run jobs:daily`.

## 14. i18n

Locales `ar` (default, RTL) and `en`. Dictionaries are TypeScript in `src/i18n/` (`en.ts` defines the shape; namespaces split into `designer`, `vendorPortal`, `checkout`, `admin`, `kit` (`mk.*`), `marketing`, `library`). Server: `getT(locale)`, `pick()`, `dirOf()`. Client: `useI18n()`. Each area sends only its keys to the browser through `<I18nScope>` and `src/i18n/scopes.generated.ts`. Formatting in `src/lib/format.ts` (Western digits, «ج.م» after amounts, Africa/Cairo). Details: `docs/guides/i18n-and-copy.md`.

## 15. Analytics

First-party only (`src/lib/analytics`). 17 funnel events (`ANALYTICS_EVENTS`); the browser may send only `CLIENT_EVENTS` (visit, artwork_uploaded, design_completed, gate_shown, export_png, design_saved) through `POST /api/events` (rate limited, 2 KB, strict zod). Everything else is tracked server-side with `track()`, which drops personal keys and values (phone, email, IP, name...). Rows go to `Event` with pseudonymous ids and are deleted after 13 months. There is no consent gate because no third-party tools run; the cookie notice is an acknowledgement. Admin overview funnels read these rows (`src/components/admin/lib/metrics.ts`).

## 16. 3D and the model library

`src/lib/library` registers every designer model from packs (`packs/*.ts`) built on the family generators in `src/lib/dieline/families/*` (boxes) and `src/lib/vessels/families/*` (containers). Each box model knows how to build its dieline and which base structure it is priced as. The browser loads packs lazily (`loadModel(code)`, `MODEL_INDEX`). `docGeometry(doc)` turns a design into one flat `DielineModel`, so the editor, preflight, dieline view and print PDF treat boxes and labels alike. The renderer is `src/components/three`. Details: `docs/guides/3d-engine-and-model-library.md` and `docs/guides/designer.md`.

## 17. Styling

Plain CSS custom properties plus CSS Modules, no Tailwind, no Polaris package, icons from `lucide-react`. App tokens `src/styles/tokens.css` (`--p-*`, `--e-*`); marketing tokens `src/components/marketing/kit/tokens.css` (`--mk-*`, scoped to `[data-mk]`). Quality bars: WCAG 2.2 AA, 360 px without side scroll, 44 px touch targets, `prefers-reduced-motion`. See `docs/design-system.md` and `docs/guides/marketing-site.md`.
