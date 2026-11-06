# Security review (round 5)

Key: `security`. Ids: `R5-SEC-nn`. Scope: the whole app, reviewed as a pentester with the source code, against OWASP ASVS 4.0.3 Level 2, OWASP Top 10 2021 and Egypt's Personal Data Protection Law 151/2020 (PDPL). This round builds on the technical audit (`docs/audit/technical.md`, T-01 to R4-14). That audit already covered payment webhook trust, the order state machine, upload sniffing, body caps, CSP, the cron route and the per-route authorisation matrix. Its open rows (T-29 in-memory rate limiter, T-30 `script-src 'unsafe-inline'`) are still open and are not counted again here.

Method: production build (`next build && next start`) on a fresh SQLite file (`ELBA_DATABASE_URL=file:./sec.db`, `db push` and seed), with `OTP_DEV_ECHO=1`, `ALLOW_MOCK_PAYMENTS=1`, `E2E_INSECURE_COOKIES=1` and a random 43-character `SESSION_SECRET`. Sessions were made through the real OTP API for the admin (`…001`), the buyer (`…002`), Nile Pack staff (`…010`), the applicant `…020` (used as an unrelated second buyer) and new phones. Each finding was proven with a concrete request (curl, or Playwright for the admin UI) before it was fixed, then checked again on a rebuilt server.

Severity scale (BRIEF.md): critical = broken flow, data loss or security hole that is exploitable now; high = clearly wrong; medium = noticeable; low = nitpick or defence in depth.

## Pass 1 findings

| id | severity | page / file | finding (with proof) | standard | fix | status |
|---|---|---|---|---|---|---|
| R5-SEC-01 | high | `lib/orders/service.ts` `getOrderForViewer` → `/[locale]/orders/[id]`, `/orders/[id]/invoice`, `/checkout/pay/[orderId]` | **Vendor staff could open the buyer-side order page and the tax invoice of their own paid jobs.** The vendor portal hides the buyer on purpose ("Elba handles all buyer contact": first name and city only, vendor price only). The buyer pages used `canViewOrder`, which lets the job's vendor in for the production files. Proof: Nile staff cookie, `GET /en/orders/<ELB-26001 id>` returned 200 with «منى عادل, 14 Abbas El Akkad St, Floor 3, Apartment 7, Nasr City, 010 0000 0002», the buyer total **EGP 14,250** next to the vendor's own price on `/en/vendor/jobs/ELB-26001` (**EGP 10,100**, so Elba's margin) and the payment method. `GET /en/orders/<id>/invoice` returned the full tax invoice with the customer name and address. That lets a vendor take the customer off the platform and see the margin. | ASVS V4.2.1, V8.3.4; Top 10 A01:2021; PDPL 151/2020 purpose limitation and data minimisation | New pure `canViewBuyerOrder()` in `lib/orders/state.ts`: buyer or ADMIN only. `getOrderForViewer` (used only by the three buyer pages) uses it. The proof PDF, print PDF, dieline and proof preview keep `canViewOrder`, so production is unchanged. | fixed |
| R5-SEC-02 | medium | `components/admin/server/actions.ts` `decideDataRequestAction` (COMPLETE on a DELETE request) | **Erasure left the phone number, IP and free-text notes behind.** Proof: new buyer `+201055500001` filed a catalogue price request with the note "Call me on 01055500001, Villa 3 Street 9 Maadi", asked for deletion, and the admin pressed Complete in `/en/admin/privacy` (Playwright). `User.phone` became `deleted:…`, but `AuditLog` still had `actorPhone +201055500001`, `ip 127.0.0.1` and `after.phone` / `after.note` with the address. `Quote.lines[0].notes` still had the address, and `DataRequest.ip` was kept. The admin quote-leads inbox and audit log kept showing them. | PDPL 151/2020 right to erasure and storage limitation; ASVS V8.3.2 | New `lib/auth/erasure.ts` `scrubErasedUserTraces(tx, userId)`, run inside the anonymisation transaction (one added line in the action). On the user's own audit rows it nulls `actorPhone` and `ip` and drops the personal keys (phone, note(s), name, email, address, ip, userAgent) from `before`/`after`. It drops `notes` from their quote lines and nulls the IP on their data requests. It keeps the rows (the pseudonymous accountability record), the product spec and the proof approval record (`Proof.approvedIp`), which is evidence for orders that tax and consumer law require Elba to keep. | fixed |
| R5-SEC-03 | medium | `/[locale]/account/export` + `components/store/account-logic.ts` `buildDataExport` | **The self-service data export left out whole categories of the user's data.** Proof: second buyer filed a price request with the note "my private note". The export keys were `profile, organization, consents, designs, orders, reviews, privacyRequests`, and the note did not appear. Price requests and offers (with the buyer's notes), disputes (the buyer's own description) and signed-in devices (IP and user agent of each active session) were missing. | PDPL 151/2020 right of access; ASVS V8.3.2 | The export adds `priceRequests` (quote lines through an allowlist of fields, so a vendor cost or margin can never leak even if a line carries one), `disputes` and `signedInDevices` (active sessions). | fixed |
| R5-SEC-04 | low | `/[locale]/dev/3d`, `/[locale]/dev/ui` | Developer tools were public in production: both returned **200** under `next start` (the 3D bench and the UI kit). They are not linked and they are `noindex`, but they are unreviewed surface (debug controls, engine internals). `/dev/finishes` already checked `ELBA_DEV_PAGES`. | ASVS V14.3.2; Top 10 A05:2021 | `dev/layout.tsx` calls `notFound()` unless the new pure `devPagesEnabled()` (`lib/env.ts`) is true: `next dev`, `ELBA_DEV_PAGES=1` (render and perf scripts already build with it), or the e2e marker `ELBA_E2E=1` (the catalogue spec renders `/dev/catalogue/<code>`). | fixed |
| R5-SEC-05 | low | `components/marketing/HeroPhoneForm.tsx` | The landing-page hero form sent a valid mobile number to `/{locale}/login?next=…&phone=01012345678`. Nothing reads that parameter, so the number only ended up in server and proxy access logs, browser history and any copied link. | PDPL 151/2020 data minimisation; ASVS V8.3.1 (sensitive data in the URL) | The number is no longer put in the URL. | fixed |
| R5-SEC-06 | low | `api/webhooks/whatsapp` | The POST handler read the body with `req.text()` (no cap while streaming) before the size check and before the HMAC check. A chunked body with no Content-Length was buffered in full by anyone (the T-11 pattern; only live once `WHATSAPP_APP_SECRET` is set). The GET handshake compared `hub.verify_token` with `===`. | ASVS V12.1.1, V13.1.3; V2.9 / V6.2.1 (timing) | `readBodyCapped(req, 256 KB)` stops reading at the cap. The token comparison is constant-time. | fixed |
| R5-SEC-07 | low | `/[locale]/account/export` | The export is a GET that writes: it records an EXPORT `DataRequest` and uses the 5-per-hour quota. SameSite=Lax sends the session cookie on top-level cross-site navigations, so any site could make a signed-in buyer's browser run it. Proof: `Sec-Fetch-Site: cross-site` + `Sec-Fetch-Mode: navigate` returned **200** and the file. No data reaches the attacker (the download goes to the victim's own browser), so this is request forgery against the log and the quota. | ASVS V4.2.2, V13.1.1; Top 10 A01:2021 | `isCrossSiteRequest` check first, as on `/api/auth/*` and `/api/events`: 403. In-app links (`same-origin`) and typed URLs (`none`) still work. | fixed |
| R5-SEC-08 | low | `api/designs/[id]/share` | A share link (`/s/<token>`, and the `/checkout/<id>?share=` fork) could not be turned off. Once a link was forwarded too far, the only way to stop it was to delete the design. | ASVS V4.1.3, V8.3.1 (capability URLs) | `DELETE /api/designs/:id/share` (owner only, 404 for others, cross-site 403) clears the token. Sharing again mints a new one. The designer's share dialog still needs a "Stop sharing" button (designer owner, see open items). | fixed (API) |
| R5-SEC-09 | low | `lib/auth/otp.ts` lockout | Ten wrong codes for a phone lock that phone for up to 60 minutes, and request-otp then answers 429. Anyone who knows a buyer's number can keep that buyer from signing in (account lockout DoS). This is the documented trade-off: without the per-phone lockout, IP rotation would allow about 25 guesses per hour per phone. | ASVS V2.2.1 (soft lockout, anti-automation) | Accepted for launch. When the SMS provider is wired: lock only the OTP that was being guessed, add a CAPTCHA or proof-of-work after five failures, and alert ops on lockouts for phones that have orders. | open (accepted) |
| R5-SEC-10 | low | `lib/auth/constants.ts` `SESSION_COOKIE` | The session cookie is `elba_session`, without the `__Host-` prefix, so a sibling subdomain (or a non-HSTS HTTP response on first visit) could plant a cookie. That would give session fixation of the anonymous `elba_anon` id, and that browser's drafts are claimed at sign-in. HttpOnly, SameSite=Lax and Secure (production) are set; rotation on sign-in works (ASVS 3.2.1 verified). | ASVS V3.4.4 | Deploy-time change: `__Host-elba_session` / `__Host-elba_anon` once the site is HTTPS only (the prefix requires Secure, which local e2e over plain HTTP cannot send). It renames cookies that e2e fixtures and audit tools set by name. | open (deploy) |

Counts of new findings in pass 1: critical 0, high 1, medium 2, low 7.

### Checked and found sound (pass 1, live)

- **OTP**: 6 digits from `crypto.randomInt`, 5-minute TTL, hash is SHA-256 over phone, code and secret, compared in constant time. Each attempt is claimed atomically before the compare, so parallel guesses cannot exceed 5 per code. A code is consumed once (replay gives EXPIRED). A new code voids the old one. Limits: 1 per 30 s and 5 per hour per phone, 20 per hour per IP, 30 verifies per 10 minutes per IP, plus the per-phone lockout. Responses are identical for known and unknown phones; TERMS_REQUIRED is only returned to someone holding a valid code. Login CSRF is blocked (`Sec-Fetch-Site`/Origin check on request, verify and logout).
- **Session**: 256-bit random token, only its SHA-256 stored; rotated on sign-in (the old token is deleted); logout deletes the row; erasure and suspension delete sessions. Cookie flags in the jar: HttpOnly, path `/`, SameSite=Lax, Secure in production.
- **Authorisation, live matrix** (buyer A, unrelated buyer B, Nile staff): buyer B gets a not-found view or 404 on A's order page, receipt, pay page, checkout and design JSON, and 404 on the proof and print PDF. A vendor gets 404 on another vendor's job. Every admin action is guarded by `adminForMutation` (role read from the DB session). Every vendor action uses `vendorForMutation` with vendor-scoped queries (`getJob`, `getRateCard`, portfolio, QC photo delete). Every checkout, order and account action re-reads the session and ownership.
- **Price integrity**: `placeOrder` re-prices on the server from the stored design (`quoteDesign`) and accepts only a vendor present in the fresh offers; quantity is capped at the instant maximum and `manual_quote` refuses. The client never sends a total. Sample orders take the sample offer only. (The share-fork model swap R4-B-01 is the checkout owner's this round.)
- **Mass assignment**: route and action schemas are explicit zod objects (`.strict()` on events, status and quote-request). No schema accepts `role`, `ownerId`, `vendorId` of the caller, `status` or money fields from a buyer.
- **XSS**: user text (design names, vendor bios, captions, dispute text, share pages) is rendered through React only. `dangerouslySetInnerHTML` is used only for constant scripts, the escaped JSON-LD (`<` escaped) and the dieline SVG generated from numbers and i18n labels. Image layers accept `data:image/(png|jpeg|webp)` or same-origin paths only, and the PDF renderer decodes data URLs only (no fetch, no SSRF).
- **Open redirects**: `safeNextPath` (WHATWG URL parser, control characters and backslashes refused, `//`, `/\`, `/%2F%2F` and `/../..//` all fall back to `/{locale}`). The middleware locale redirect keeps the path on the same origin.
- **Secrets**: no server env names or secret material in `.next/static` (searched for SESSION/CRON/BOSTA/WHATSAPP/PAYMOB/HMAC); only `NEXT_PUBLIC_SITE_URL` is public. A missing `SESSION_SECRET` in production fails closed (500 with an empty body, no stack trace).
- **Headers**: full CSP with `frame-ancestors 'none'`, X-Frame-Options DENY, nosniff, `strict-origin-when-cross-origin`, Permissions-Policy and COOP on pages; API routes keep their per-route sandbox CSP; HSTS on HTTPS production only; `robots.txt` disallows the private areas; share pages are `noindex` and `no-store`.
- **Analytics and logs**: `track()` drops personal keys and values that look like a phone, email or IP. Visit counting keys on IP and user agent in memory only. OTP codes are logged only with the dev echo on.

## Re-test on the rebuilt server (pass 1)

Same production build and seed, rebuilt from this branch.

| id | request | before | after |
|---|---|---|---|
| R5-SEC-01 | Nile staff `GET /en/orders/<ELB-26001>`, `…/invoice`, `/en/checkout/pay/<ELB-26201>` | 200 with buyer name, street, phone, EGP 14,250 and tax invoice | not-found view: no order number, no address. Buyer and admin unchanged (number and address present). Vendor still gets the proof PDF, print PDF and dieline (200, 200, 200) |
| R5-SEC-02 | erase `+201055500002` after a price request with a note (Playwright, admin Complete) | `actorPhone`, `ip`, `after.phone`, `after.note`, `Quote.lines.notes`, `DataRequest.ip` kept | all null or removed; product spec and quantity kept |
| R5-SEC-03 | `GET /en/account/export` as a buyer with a price request | 11 keys, note missing | adds `priceRequests` (note present), `disputes`, `signedInDevices` |
| R5-SEC-04 | `GET /en/dev/3d`, `/en/dev/ui` | 200, 200 | 404, 404 (`/dev/finishes` 404 as before) |
| R5-SEC-05 | hero form submit with a valid number | `…/login?next=…&phone=010…` | `…/login?next=…` (unit test) |
| R5-SEC-06 | chunked 2 MB POST with no Content-Length (server started with `WHATSAPP_APP_SECRET`) | read in full, then 413 | 413 after the first 256 KB (10 ms); unit test asserts the stream is not drained |
| R5-SEC-07 | export with `Sec-Fetch-Site: cross-site` | 200 + file | 403; same-origin still 200 |
| R5-SEC-08 | `DELETE /api/designs/<id>/share` | no DELETE handler: no way to revoke | other buyer 404; owner `{ok:true,revoked:true}`; `/en/s/<old token>` shows "Link not found" |

Tests: `src/lib/__tests__/security-r5.test.ts` (10 tests) and `src/components/marketing/__tests__/hero-phone-privacy.test.tsx` (1). With the fixes stashed, 8 of these 11 fail: R5-SEC-01 (2), 03, 05, 06, 07, 08 (2). The other three cover new modules (`erasure.ts`, `devPagesEnabled`) and are backed by the live before/after above.

## Open items (pass 1)

- R5-SEC-08 UI: the designer's share dialog needs a "Stop sharing" button that calls `DELETE /api/designs/:id/share` (designer owner; the API is done).
- R5-SEC-05 follow-up (marketing): the hero form validates the number but no longer carries it. If the login form should be prefilled, pass it in `sessionStorage`, never the URL.
- R5-SEC-09, R5-SEC-10: accepted and deploy-time, see the table.
- Carried from technical.md: T-29 (Redis rate limiter at deploy), T-30 (nonce CSP).

## Pass 2 findings (fresh read: logs, storage paths, cache headers, names, sessions, OTP cost)

| id | severity | page / file | finding (with proof) | standard | fix | status |
|---|---|---|---|---|---|---|
| R5-SEC-11 | low | `api/auth/verify-otp` (`name`), `components/store/account-logic.ts` `profileSchema`, `lib/orders/schemas.ts` `addressSchema` | Stored names and address text accepted control and bidi-override characters. Proof: verify-otp with `name: "Ahmed ‮FEDCBA‬\u0000\u0007 Admin"` returned 200 and stored it as is. The right-to-left override reverses how the rest of the line renders in admin tables, on the receipt and on the courier label (display spoofing). NUL and BEL break PDFs, logs and the ETA e-invoice JSON this text will be sent in. | ASVS V5.1.4, V5.2.2; Unicode TR #36 (bidi spoofing) | New pure `lib/auth/display-name.ts` `cleanDisplayName()`: NFC, drop C0/C1 controls, bidi embeddings, overrides, isolates, LRM/RLM/ALM and BOM, collapse whitespace. ZWJ/ZWNJ (Arabic shaping) are kept. Used for the sign-up name, the profile name and the delivery address name, city, street and optional lines. | fixed |
| R5-SEC-12 | low | `lib/auth/session.ts` `getSession` | ADMIN sessions lasted the full 30 days. Proof: the admin session's `createdAt` set 3 days back, then `/en/admin` returned 200 and `/api/auth/me` returned the admin. An admin can refund, read and export every buyer's data. | ASVS V3.3.2 (Level 2: re-authenticate within 12 hours); V3.3.1 | `sessionLive()` (pure, `lib/auth/constants.ts`): an ADMIN session ends 12 hours after sign-in (`ADMIN_SESSION_MAX_HOURS`). The dead row is deleted on first use. Buyers and vendor staff keep 30 days, the product decision for a phone-OTP shop; idle timeout needs a `lastSeenAt` column (open, below). | fixed |
| R5-SEC-13 | low | `lib/auth/otp.ts` `requestOtp` | No global ceiling on OTP sends. The per-phone (1 per 30 s, 5 per hour) and per-IP (20 per hour) limits stop one client, but a botnet can send to many numbers (SMS or WhatsApp pumping, a cost attack). Proof: 8 requests from 8 client IPs to 8 new numbers, all 200. | ASVS V11.1.4 (anti-automation), V2.2.1 | Open, provider side: when the SMS/WhatsApp BSP is wired (`sendOtpSms` is still a stub), turn on its fraud guard (per-prefix rate limits, conversion-based blocking) and add an alert on the daily send count. A hard global cap in the app would let an attacker lock out every sign-in. | open |

Counts of new findings in pass 2: critical 0, high 0, medium 0, low 3.

### Checked and found sound (pass 2)

- **Cache**: `/account`, `/orders`, order detail, `/admin`, `/vendor/*` answer `private, no-cache, no-store`; `/api/auth/me` and the export `no-store`.
- **Storage paths**: `lib/orders/storage.ts` allows `[\w./-]` only, refuses `..` and checks the resolved path stays under the root. Vendor uploads are keyed by the strict `KEY_RE` and read through `path.join` on parsed parts only. `printPdfBytes` re-checks that the item belongs to the order.
- **Logs**: the only phone in a log line is the OTP dev echo (off in a deployment). Notifications log a masked address and the text only in dev. Error logs carry `e.message`, never request bodies.
- **Buyer-side service functions** (`cancelOrder`, `reorder`, `submitReview`, `openDispute`, `markInstapaySent`, `startPayment`) check `buyerId === user.id` and answer NOT_FOUND otherwise. Vendor queries (`getJob`, `getRateCard`) filter by the caller's vendor.
- **Unsubscribe**: HMAC of the user id (192 bits shown), compared in constant time; the GET page reads only the consent flag; withdrawal needs the POST.

## Re-test on the rebuilt server (pass 2)

| id | request | before | after |
|---|---|---|---|
| R5-SEC-11 | verify-otp with the RLO/NUL/BEL name above (new phone) | stored as sent | `"Ahmed FEDCBA Admin"` |
| R5-SEC-12 | `/en/admin` with a session created 3 days ago | 200 | 307 to `/en/login?next=%2Fen%2Fadmin`, `/api/auth/me` → `{user:null}`; a fresh admin sign-in → 200; a 3-day-old buyer session still works |

Tests added to `src/lib/__tests__/security-r5.test.ts` (now 13 tests). With the schema changes stashed, the R5-SEC-11 schema test fails. `sessionLive` is new, so its live before/after is the proof.

## Summary

New findings this round, counted before fixing: **critical 0, high 1, medium 2, low 10** (13 in total). Pass 2 found nothing of medium severity or worse.

Fixed: R5-SEC-01 to R5-SEC-08 and R5-SEC-11, R5-SEC-12 (R5-SEC-08 needs a designer UI button). Open: R5-SEC-09 (lockout DoS, accepted), R5-SEC-10 (`__Host-` cookies at HTTPS deploy), R5-SEC-13 (provider fraud guard), the R5-SEC-05 prefill follow-up, plus the carried T-29 and T-30. One more for later: an idle timeout for 30-day buyer and vendor sessions (ASVS V3.3.2 at Level 2) needs an additive `Session.lastSeenAt` column. Not done this round because the schema is shared with sessions working in parallel.

Verification: `npm run lint` clean; `npm run typecheck` clean; `npm test` 94 files, 8,515 tests passed; `npm run build` OK; Playwright on `next start` (`--workers=2 --trace off`): vendor, admin, storefront, journey, smoke (43 passed, 13 skipped by project), catalogue-models and checkout (28 passed, 18 skipped), and after pass 2 smoke, storefront, admin, checkout and journey (42 passed, 8 skipped). The skips are project-specific tests (desktop-only or mobile-only).

## Files touched

In scope (`src/lib/auth`, `src/app/api`): `src/lib/auth/erasure.ts` (new), `src/lib/auth/display-name.ts` (new), `src/lib/auth/constants.ts`, `src/lib/auth/session.ts`, `src/app/api/designs/[id]/share/route.ts`, `src/app/api/webhooks/whatsapp/route.ts`, `src/app/api/auth/verify-otp/route.ts`.

Outside that scope (each change is a few lines and additive):
- `src/lib/orders/state.ts`: new `canViewBuyerOrder` (R5-SEC-01).
- `src/lib/orders/service.ts`: `getOrderForViewer` uses it (R5-SEC-01; one import, one line).
- `src/lib/orders/schemas.ts`: address text cleaned (R5-SEC-11).
- `src/components/admin/server/actions.ts`: one import plus one call in the erasure transaction (R5-SEC-02).
- `src/app/[locale]/(store)/account/export/route.ts`, `src/components/store/account-logic.ts`: export categories and cross-site check (R5-SEC-03, 07); profile name cleaned (R5-SEC-11).
- `src/app/[locale]/dev/layout.tsx`, `src/lib/env.ts` (`devPagesEnabled`): R5-SEC-04.
- `src/components/marketing/HeroPhoneForm.tsx`: R5-SEC-05.
- Tests: `src/lib/__tests__/security-r5.test.ts`, `src/components/marketing/__tests__/hero-phone-privacy.test.tsx`.
