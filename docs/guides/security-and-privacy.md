# Security and privacy

## Purpose

Elba handles phone numbers, addresses, company tax details, designs and payments for Egyptian buyers and printers. The code is reviewed against **OWASP ASVS 4.0.3 Level 2**, **OWASP Top 10 2021** and **Egypt's Personal Data Protection Law 151/2020 (PDPL)**. Code comments cite the ASVS requirement they implement (for example `ASVS V4.2.1` next to an ownership check). The reviews are `docs/audit/security.md` (rounds 5 and 6) and `docs/audit/technical.md`.

## Key files

| Path | Role |
|---|---|
| `src/lib/auth/otp.ts`, `crypto.ts`, `constants.ts` | OTP issue, hash, attempts, lockout, retention constants |
| `src/lib/auth/session.ts` | Sessions, role guards, `requireAdminPage`, `isAdminSession` |
| `src/lib/auth/csrf.ts` | `isCrossSiteRequest`, `crossSiteResponse` |
| `src/lib/auth/consent.ts`, `marketing-consent.ts`, `unsubscribe.ts` | Consent rows, marketing opt-in and opt-out, signed unsubscribe links |
| `src/lib/auth/erasure.ts` | `scrubErasedUserTraces` (right to erasure) |
| `src/lib/security-headers.ts` | CSP and the header set |
| `src/lib/rate-limit.ts` | `rateLimit`, `clientIp` |
| `src/app/api/_lib/body.ts` | Body caps (`readJsonCapped`, `readFormCapped`, `readBodyCapped`) |
| `src/lib/storage/blob.ts`, `src/components/vendor/lib/files.ts` | Key validation, upload rules, `canReadFile` |
| `src/lib/orders/state.ts` | `canViewOrder` (production files), `canViewBuyerOrder` (buyer pages) |
| `src/lib/jobs/retention.ts`, `src/lib/jobs/cronAuth.ts` | Retention purges, cron bearer check |
| `src/lib/analytics/track.ts` | PII stripping for analytics |
| `src/components/store/account-logic.ts` | `buildDataExport` (right of access) |
| `docs/business/compliance-checklist.md` | Legal checklist (PDPL, VAT, ETA, consumer law) |

## Authentication and sessions (ASVS V2, V3)

- Phone OTP only. Codes are 6 random digits, hashed as `sha256(phone:code:SESSION_SECRET)`, compared in constant time, 5 minutes, 5 attempts per code claimed atomically, earlier codes invalidated.
- Lockout: 10 wrong codes per phone in 60 minutes (database backed). **R5-SEC-09 (accepted)**: this lets anyone lock a known number out for an hour.
- Per-phone limits 1 per 30 s and 5 per hour; per IP 20 requests per hour and 30 verifies per 10 minutes. **R5-SEC-13 (open)**: no global OTP send ceiling (SMS pumping risk once a real sender exists).
- Session cookie `elba_session`: random 32 bytes, httpOnly, SameSite=Lax, Secure in production, 30 days; only the sha256 is stored; rotated on sign-in. Admin sessions end 12 hours after creation. **R5-SEC-10 (open, deploy)**: no `__Host-` prefix.
- `SESSION_SECRET` must be 32+ characters and not a placeholder in production, or `sessionSecret()` throws.

## Authorisation (ASVS V4)

- Pages: `requireUser`, `requireRole`, `requireAdminPage`. API: `apiRequireRole`. ADMIN passes every role check.
- Ownership is checked in the query or service, not only in the UI: buyers see their own orders, vendors only their own jobs (`loadJobItem`, `vendorForMutation`), others get 404 rather than 403 to avoid confirming that a record exists.
- **R5-SEC-01**: printers must never open the buyer order page or invoice (customer contact and Elba's margin). Buyer pages use `canViewBuyerOrder`.
- Server-side preflight runs again at proof approval; the server re-prices every order (never trust client prices).

## Request integrity

- CSRF: mutating route handlers call `isCrossSiteRequest()` (Sec-Fetch-Site, then Origin vs Host) and answer 403. Server actions rely on Next's origin check. GET routes that write (the account export) also check (R5-SEC-07).
- Body caps on every route that reads a body (ASVS V12/V13 resource limits), for example 16 KB for `/api/quote`, 12 MB for design saves, 200 KB for payment webhooks, 256 KB for WhatsApp.
- Webhooks: payment HMAC (SHA-256 mock, SHA-512 Paymob) with constant-time compare and reference/amount/currency binding; WhatsApp `X-Hub-Signature-256`; the cron route uses a hashed constant-time bearer compare and answers 503 when `CRON_SECRET` is unset in production.
- Uploads: magic-byte type sniffing, never SVG, size limits, metadata stripped, keys validated against traversal, private files served only through authorised routes (no public bucket, no signed URLs).

## Headers (ASVS V14.4)

`src/lib/security-headers.ts`: CSP with `default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, `form-action 'self'`; `X-Frame-Options: DENY`; `nosniff`; `strict-origin-when-cross-origin`; Permissions-Policy denying camera, microphone, geolocation, payment, USB; COOP `same-origin`; HSTS on production HTTPS. API routes add `X-Robots-Tag: noindex`; file and SVG routes send a `sandbox` CSP. **T-30 (open)**: `script-src 'unsafe-inline'` stays because nonces would disable static rendering.

## Rate limiting

In-memory fixed windows per process (`src/lib/rate-limit.ts`); per isolate on Workers. **T-29 (open)**: move to a shared store; until then Cloudflare WAF rules are the edge backstop (`docs/DEPLOY-CLOUDFLARE.md` step 9). `clientIp()` trusts only `CF-Connecting-IP` when `TRUST_CF_CONNECTING_IP=1`, else `X-Real-IP`, else the right-most `X-Forwarded-For` hop.

## PDPL 151/2020

| Principle | Where it lives |
|---|---|
| Consent | `Consent` rows for TERMS, PRIVACY, MARKETING, RETARGETING with `CONSENT_TEXT_VERSION`, locale, IP. Terms required for new accounts; marketing is a separate unchecked box. A WhatsApp STOP or «إيقاف» reply and the signed unsubscribe link withdraw marketing consent |
| Purpose limitation | Printers see first name and city only; vendor-facing text is filtered for contact details |
| Data minimisation | Analytics stores pseudonymous ids only; `track()` drops phone, email, IP, name, user agent keys and values. The landing form never puts the phone in a URL (R5-SEC-05) |
| Storage limitation | Daily `runRetention`: OTP rows after 24 h, expired sessions, expired anonymous designs without proofs, analytics events after 13 months |
| Right of access | `/{locale}/account/export` (5 per hour) and admin `GET /api/admin/users/[id]/export`; both log a `DataRequest` |
| Right to erasure | DELETE requests are reviewed in `/admin/privacy`; completing one anonymises the user and runs `scrubErasedUserTraces` (audit actor phone and IP, personal keys in before/after, quote notes, request IPs). Orders, invoices and proof approvals are kept for tax law |
| Cross-border | Neon region AWS Frankfurt (EU); see the compliance checklist for the licence and DPO items |

Founder items still open (CR-43 and business R4.4): legal entity name, commercial register number, seller tax number, DPO contact, PDPC licence.

## Dev flags that must never reach production

`OTP_DEV_ECHO`, `ALLOW_MOCK_PAYMENTS`, `ELBA_E2E`, `ELBA_DEV_PAGES`, `E2E_INSECURE_COOKIES`. No startup check refuses them; the deploy doc and secrets list are the control. `/[locale]/dev/*` answers 404 in production unless `devPagesEnabled()` (R5-SEC-04).

## How to add a protected route

1. Guard first: `apiRequireRole([...])` or the page helper; for admin pages `requireAdminPage()`.
2. `isCrossSiteRequest()` on any mutating handler.
3. Cap the body with `src/app/api/_lib/body.ts`; validate with a strict zod schema.
4. Check ownership in the query; answer 404 for records the caller may not see.
5. `rateLimit()` with a namespaced key.
6. Never return internal economics (vendor cost, margin) or another party's contact data.
7. Add a test: unit for the pure rule, e2e for cross-role access (see `e2e/security-r6.spec.ts`).

## Open items (see `docs/audit/STATUS.md`)

T-29, T-30, R5-SEC-09, R5-SEC-10, R5-SEC-13, plus the prose items in `security.md` round 6: idle timeout for buyer and vendor sessions, defence-in-depth role asserts, a money ceiling check for BigInt-size totals (R6-SEC-05), a sweep for unreported dispute photos (R6-SEC-06), the designer "Stop sharing" button (R5-SEC-08), and the unsigned `elba_anon` cookie (R4-B-04).
