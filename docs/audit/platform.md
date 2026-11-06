# Audit: platform (identity, privacy, language)

Scope: login / OTP, session cookies, role routing and guards, PDPL (Law 151/2020) consent, notices, export / delete and retention, i18n (Arabic quality, RTL, formatting, locale switch).
Method: production build (`next start`) driven with Playwright at 390×844 and 1440×900 in `ar` and `en`, keyboard-only runs, axe-core (WCAG 2.0/2.1/2.2 A+AA tags), and direct API probes (parallel guessing, spoofed `X-Forwarded-For`, cross-site `text/plain` POSTs, crafted `?next=` values). Screenshots: `docs/screenshots/audit/platform/` (`before-*` = pass 1, `after*-*` = after fixes).

Severity: critical = broken flow / data / security; high = clearly wrong, ugly or inaccessible; medium = noticeable polish; low = nitpick.

## Findings

| id | severity | page / file | finding | standard | fix | status |
|---|---|---|---|---|---|---|
| P-01 | critical | `src/lib/auth/otp.ts` | OTP attempt counter was read, compared, then incremented in separate queries. 40 parallel wrong guesses against one code got **25** comparisons (limit 5). | OWASP ASVS 2.8.x / 11.1.6, NIST SP 800-63B §5.2.2 (throttling) | Each check first claims an attempt with one conditional `UPDATE … WHERE attempts < 5` and compares only if the claim succeeded. Unit test fires 25 parallel guesses: exactly 5 compared. Re-probed live: 5 `INVALID_CODE`, 35 `TOO_MANY_ATTEMPTS`. | fixed |
| P-02 | critical | `src/lib/rate-limit.ts`, `otp.ts` | Per-IP limits trusted the **first** `X-Forwarded-For` entry, which the client controls: a fresh fake IP per request skipped the verify limit. There was no per-phone lockout across codes either, so guessing was bounded only by "5 codes per hour × 5 tries" per process, and reset with each restart (in-memory). | ASVS 2.2.1, NIST 800-63B §5.2.2 | `clientIp` prefers `X-Real-IP`, else counts `TRUSTED_PROXY_HOPS` (default 1) from the right of `X-Forwarded-For`. New DB-backed lockout: 10 wrong codes per phone in 60 min blocks both verify (`429 LOCKED`) and new codes, across processes and IPs. Tests for both. | fixed |
| P-03 | high | `(auth)/login/page.tsx` | Open redirect: `?next=/%09/evil.com` passed the prefix check and was sent as `Location: /\t/evil.com`; browsers strip the tab and go to `//evil.com`. Same for the client `router.replace`. | CWE-601, ASVS 5.1.5 | `safeNextPath()` (`src/lib/auth/redirect.ts`) rejects control chars and `\`, resolves with the WHATWG URL parser, requires same origin, never returns the login page. 15 table-driven tests. | fixed |
| P-04 | high | `api/auth/verify-otp` | Account enumeration: an unregistered phone with any code returned `TERMS_REQUIRED` before the code was checked, a registered one `INVALID_CODE`/`EXPIRED`. | ASVS 2.2.x / OWASP auth cheat sheet (generic errors) | Code is checked first (`checkOtp`), so `TERMS_REQUIRED` is only seen by someone holding a valid code. The code is consumed only after the terms check, so a missing tick no longer burns it. | fixed |
| P-05 | high | `api/auth/{request-otp,verify-otp,logout}` | Login CSRF: route handlers parse any body type, so a cross-site `<form enctype="text/plain">` POST was accepted (verified: 200). An attacker could sign a victim into the attacker's account or burn the victim's OTP quota. | ASVS 4.2.2, OWASP CSRF | `isCrossSiteRequest()` (`src/lib/auth/csrf.ts`) rejects `Sec-Fetch-Site` other than same-origin/none, or a mismatched `Origin`; non-browser clients (curl, tests) still work. Re-probed: 403. | fixed |
| P-06 | high | `OtpForm.tsx`, `verify-otp` | **Silent consent withdrawal**: the form always sent `marketingConsent: false` (box unticked by default), so a returning user who had opted in was opted out at every sign-in and a `MARKETING granted=false` row was logged as if they had chosen it. | Egypt PDPL 151/2020 (consent must be explicit and provable; withdrawal a deliberate act) | Form sends the field only when ticked. `consentRowsForSignIn()` (`src/lib/auth/consent.ts`): at sign-in only a tick is acted on; withdrawal stays on the account page. Unit tests. | fixed |
| P-07 | high | `otp.ts` | Replay race: two concurrent requests with the correct code could both pass and create two sessions. | ASVS 2.8.4 (OTP single use) | `consumeOtp` is a conditional `UPDATE … WHERE consumedAt IS NULL` and the hash is overwritten. Test runs two in parallel: one succeeds. | fixed |
| P-08 | high | `OtpForm.tsx` | Typing the code on an Arabic keyboard (٠-٩) produced an empty field: the `\D` filter stripped Arabic-Indic digits, so Arabic users could not finish sign-in. `maxLength=6` also truncated a pasted "123 456". | WCAG 2.2 3.3.1 / ISO 9241-110 (error tolerance) | `toWesternDigits()` then strip, slice to 6. Verified: typed `١٢٣` -> `123`; keyboard-only Arabic sign-in completes. | fixed |
| P-09 | high | `OtpForm.tsx` | The phone in the Arabic hint rendered as `201513833983+` (bidi reordering of `+` and digits). | WCAG 1.3.2 meaningful sequence | Shown as the local format `015 1383 3983` inside an LTR isolate (U+2066/2069). Verified by measuring glyph positions. | fixed |
| P-10 | medium | `OtpForm.tsx` | Terms checkbox said "Terms of Service and Privacy Notice" with no links, and there was no notice at the point of collecting the phone number. | PDPL 151/2020 (inform the data subject at collection), WCAG 3.3.2 | Terms label links to `/legal/terms` and `/legal/privacy` (new tab, announced). One-line privacy note under the phone field. "Required for new accounts" hint. | fixed |
| P-11 | medium | `OtpForm.tsx` | After "Send code" focus fell to `<body>`; errors did not move focus to the field. | WCAG 2.4.3 focus order | Focus moves to the code field on step change, back to the phone on "Change number", and to the field in error (phone, code, terms checkbox). | fixed |
| P-12 | medium | `OtpForm.tsx` | Errors on the code step were not tied to the code field (`aria-describedby` only on phone); the terms error was not tied to the checkbox. | WCAG 3.3.1, 1.3.1 | `aria-invalid` + `aria-describedby` on the field each error is about. | fixed |
| P-13 | medium | `OtpForm.tsx` | Resend always counted 30 s even when the server said otherwise; no confirmation that a code was (re)sent. | WCAG 4.1.3 status messages | Cooldown follows `retryAfterSec`; a `role=status` notice says where the code went and that the old one stopped working. | fixed |
| P-14 | medium | `src/lib/auth/session.ts` | No session rotation at sign-in (a previous token in the browser stayed valid); logout deleted the cookie without its attributes. | ASVS 3.2.1, 3.3.1 | `createSession` revokes the browser's previous session and this user's expired ones; logout expires the cookie with the same attributes (`HttpOnly; Secure; SameSite=Lax; Max-Age=0`). Cookie flags verified in the browser. | fixed |
| P-15 | medium | `src/middleware.ts` | No security headers: login and checkout could be framed (clickjacking), no `nosniff`, full referrer (incl. `?next=`) sent to third parties. | OWASP Secure Headers, ASVS 14.4 | `frame-ancestors 'none'` + `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, HSTS on production HTTPS only. A full script CSP is left to deploy config (see Open). | fixed |
| P-16 | medium | `api/auth/verify-otp` | Expired anonymous designs (past the 30-day TTL) were **claimed and kept forever** at sign-in; elsewhere they were purged only when someone else saved a design. | PDPL 151/2020 storage limitation | At sign-in expired drafts of that browser are deleted and only unexpired ones are claimed. A scheduled purge is still needed (see Open). | fixed (partly, see Open) |
| P-17 | medium | `otp.ts`, `session.ts` | OTP rows (phone + IP) and expired sessions were never deleted. | PDPL storage limitation | OTP rows older than 24 h are purged on each request; a user's expired sessions are purged at sign-in. | fixed |
| P-18 | medium | `verify-otp` | User row and consent rows were written without a transaction; a returning user never re-accepted a newer terms version (`CONSENT_TEXT_VERSION`). | PDPL (provable consent) | One transaction; ticking terms records TERMS + PRIVACY when the last accepted version differs. | fixed |
| P-19 | medium | `[locale]/layout.tsx` | Site-wide `alternates.languages {ar:"/ar", en:"/en"}`: every page without its own alternates told search engines its translation was the home page. | hreflang correctness | Removed from the layout (pages set their own, the login page now does). | fixed |
| P-20 | medium | `(auth)/login/page.tsx` | Login page had no title of its own (tab read the site tagline). | WCAG 2.4.2 page titled | "Sign in · Elba" / "تسجيل الدخول · علبة"; `noindex, nofollow`. | fixed |
| P-21 | medium | login page UI | Inline-styled flat card, primary button grey/disabled before typing, the phone value left-aligned under a right-aligned Arabic label, plain code field, 1 px horizontal overflow at 390 px. | Visual quality bar, WCAG 1.4.10 reflow | CSS module: lock badge, 24 px title, balanced text, surface shadow; phone aligned to the inline start in RTL; code field large, spaced, tabular, centred; consent group as a `fieldset`; no overflow. | fixed |
| P-22 | medium | `OtpForm.tsx` | "Send code" and "Verify" were disabled until the input looked long enough, with no explanation. | WCAG 3.3.1 | Buttons are enabled once hydrated; client-side validation gives the same message the server would ("Enter all 6 digits…", "Enter a valid Egyptian mobile…"). | fixed |
| P-23 | medium | admin privacy page | On phones the requests table scrolled sideways and truncated the status badge to "مك…"; "متبق 27 يوم" (wrong number agreement). | WCAG 1.4.10 reflow | Card list under 48 rem; days via `formatCount` ("متبق 27 يوما", "27 days left"). | fixed |
| P-24 | low | `src/lib/format.ts`, dictionaries | Arabic counted nouns are written as "{n} ثانية / أيام / طلبات", wrong for 1, 2, 3–10 and 11+. | Arabic grammar (CLDR plural rules) | New `formatCount(n, unit, locale)` with the six CLDR Arabic categories; used in auth and admin privacy. Other namespaces keep their strings (owners must switch call sites; see Open). | fixed in scope |
| P-25 | low | `ar.ts`, `checkout.ar.ts`, `marketing.ar.ts`, `designer.ar.ts` | Arabic copy: plural imperative "أرسلوا لي" for consent, verb-form button "تحقق ومتابعة", abbreviation "ث", one field called "رقم الهاتف المحمول" / "رقم الموبايل" in different places, missing accusative ("رقم موبايل مصري صحيح", "رقم بطاقة صحيح"). | Brief: MSA natural for Egypt, noun-form labels | "أوافق على تلقي العروض…", "التحقق والمتابعة", "ثانية" via `formatCount`, the phone field is "رقم المحمول" in every form label, "مصريا صحيحا" / "صحيحا". | fixed |
| P-26 | low | cookie notice | "موافق" (I agree) on a notice that asks for no consent (essential cookies only) misstates what the button does. | PDPL (consent only where it is asked for) | "حسنا". | fixed |
| P-27 | low | `src/components/store/CookieNotice.tsx` (outside scope) | The store cookie notice covered the end of the footer: it reserved scroll padding but not page space. | WCAG 2.4.11 focus not obscured | Also reserves its height as body padding while shown. | fixed |
| P-28 | low | `src/middleware.ts` | `elba_locale` was set only by the switcher: open `/en/...` from a shared link, then `/` and you got Arabic. | Locale persistence | Middleware remembers the locale of any `/ar` or `/en` page. Switcher keeps path and query (verified `/ar/account` <-> `/en/account`). | fixed |
| P-29 | low | `LoginClient.tsx` | Admins and vendors signing in from `/login` landed on the storefront home. | Role routing | Without a `?next=`, ADMIN -> `/admin`, VENDOR -> `/vendor`. Verified for the seeded vendor. | fixed |
| P-30 | low | `src/lib/phone.ts` | Numbers pasted from Arabic text with bidi marks (LRM/RLM/isolates) were rejected. | Error tolerance | Bidi controls stripped before normalising; tests. | fixed |
| P-31 | low | account, admin and vendor frames (outside scope) | The `LogOut` icon is not mirrored in RTL. | Directional icons in RTL | Not changed (owners: storefront, admin, vendor). Every other directional icon in the app already flips (`flipInRtl`, `:dir(rtl)`). | open |
| P-32 | low | browser console | Chrome logs "Failed to load resource: 400" for expected validation answers (wrong code, invalid phone). | — | Correct HTTP semantics; not changed. | won't fix |
| P-34 | medium | `legal.privacy.sections.retention` (pass 2) | The privacy policy did not say how long OTP codes (phone + IP) and sign-in sessions are kept. | PDPL 151/2020 (inform data subjects of retention) | Added: codes deleted after 24 h, sessions end after 30 days (matches the code). | fixed |
| P-35 | low | `auth.*` (pass 2) | Links and checkbox said "Privacy Notice" but the page and footer are titled "Privacy policy" / "سياسة الخصوصية". | WCAG 3.2.4 consistent identification | Link and error texts use the page title. | fixed |
| P-36 | high | `src/app/fonts.ts`, `[locale]/layout.tsx`, `tokens.css` (PERF-05, from the performance audit) | Every page, English included, preloaded 9 font files and downloaded ~240 KB of fonts (Plex Arabic in 4 weights x Arabic + Latin, all preloaded). | Core Web Vitals (LCP), performance budget | Plex: `subsets: ["arabic"]`, `preload: false`, weights 400/500/600/700 declared (unused cuts never download; 500 kept for the designer's "Medium"). `[locale]/layout.tsx` preloads Plex 400 + 700 on Arabic pages only (URLs read from the built CSS by `src/app/font-preload.ts`, unit-tested). Arabic font stack puts Inter first so digits and Latin use the Inter file every page already has; Arabic medium maps to 600. Language switch links no longer prefetch the other locale (its payload carried the other locale's font preloads). Measured: `/ar` 9 files / 240 KB -> 5 / 183 KB, `/ar/login` -> 4 / 148 KB, `/en` -> 2 / 82 KB; preloads 9 -> 3 (ar) / 1 (en). Arabic rendering compared before/after (`perf05-before-*`, `perf05-after-*`): same shapes and metrics, digits now Inter. | fixed |
| P-37 | medium | `auth.phoneHint`, `auth.errors.INVALID_PHONE`, `checkout.payment.card.testHint` | Space-separated digit groups inside Arabic sentences rendered reversed ("5678 1234 010"). | WCAG 1.3.2 meaningful sequence | Wrapped in LTR isolates; a dictionary test now fails on any un-isolated digit groups in Arabic. | fixed |
| P-33 | low | lockout | Someone who knows a phone number can lock that number's sign-in for up to an hour by entering wrong codes. | NIST 800-63B §5.2.2 accepts throttling with this trade-off | Kept; window is 60 min, not permanent. | accepted |

Counts: critical 2, high 8, medium 16, low 11 (37 total). Fixed 34 (P-16 and P-24 fixed in scope with a remainder below), open 1, won't fix 1, accepted 1.

## Open (needs another owner or a deploy decision)

- **Scheduled retention job** (P-16): expired anonymous designs are purged at sign-in and when a design is saved, but nothing runs on a timer. Add a daily job (cron / platform scheduler) running `db.design.deleteMany({ where: { ownerId: null, expiresAt: { lt: now }, proofs: { none: {} } } })` plus the OTP / session clean-up.
- **Arabic plural call sites** (P-24): `pricing.leadTime`, `designer.price.*`, `checkout.offers.delivery/production`, `account.ordersCount`, `orders.boxes` and similar still interpolate a bare number before a fixed noun. Owners should pass `formatCount(n, "day" | "order" | "box", locale)` and drop the noun from the string.
- **Full CSP** (P-15): `script-src` with nonces needs to be designed with the 3D worker and the payment gateway; only the non-breaking directives are set now.
- **`TRUSTED_PROXY_HOPS`** (P-02): set it in the deployment if there is more than one proxy in front of the app (CDN + load balancer); the default (1) is right for Vercel and a single nginx.
- **LogOut icon mirroring** (P-31).

## Files touched outside the listed scope

- `src/components/store/CookieNotice.tsx`: two lines to reserve body padding while the notice is visible (P-27).
- Dictionary values in `checkout.ar.ts`, `marketing.ar.ts`, `designer.ar.ts`, `admin.{ar,en}.ts` (owned for quality per the brief; values only, `admin.privacy.dueIn` now takes a pre-formatted count).
- `package.json` / `package-lock.json`: `@axe-core/playwright` dev dependency for the audit.
- PERF-05 (requested by the integrator): `src/app/fonts.ts`, `src/styles/tokens.css` (`:root:lang(ar)` font stack and medium weight), and `prefetch={false}` on `src/components/store/LanguageSwitcher.tsx`, `src/components/marketing/LangLink.tsx`, `src/components/designer/TopBarLanguage.tsx`.

## Verification

- `npm run lint`, `npm run typecheck`, `npm test` (all suites, including the new `src/lib/auth/__tests__/auth-security.test.ts` and `src/lib/__tests__/platform-i18n.test.ts`), `npm run build`: pass.
- e2e (`--workers=2 --trace off`): smoke, checkout, journey, admin, vendor, designer, storefront on desktop and mobile. 41 passed, 4 skipped (by the specs themselves on mobile). One run had `checkout.spec.ts:68 [mobile]` time out waiting for vendor offers (after sign-in, in the checkout offers step); it passes when re-run alone, so it is load-related flakiness outside this scope. Likewise `storefront.spec.ts:15 [desktop]` failed once right after a cold `next start` (the size-page link click did not navigate) and passed on the next two runs.
- Browser re-audit after fixes: no axe violations on login (both steps), account, privacy policy and admin privacy pages in ar/en at 390 and 1440; no horizontal overflow; keyboard-only Arabic sign-in with Arabic-Indic digits completes; cookies `elba_session` HttpOnly + Secure + SameSite=Lax; logout expires it with the same flags.
- API probes after fixes: parallel guessing 5/40 compared; cross-site `text/plain` POST 403; `?next=/\t/evil.com` -> `/en`; enumeration probe returns `INVALID_CODE` for unknown phones.

## Round 2

Method: fresh production build (`next start`, `OTP_DEV_ECHO=1`, mock payments), Playwright at 390×844 and 1440×900 in `ar` and `en`, axe-core (WCAG 2.0/2.1/2.2 A+AA tags), keyboard runs, glyph-position checks for bidi, HTML payload measurement, and a line-by-line copy read of every dictionary (`ar.ts`, `en.ts`, `checkout.*`, `designer.*`, `library.*`, `marketing.*`, `admin.*`, `vendorPortal.*`, plus the UI kit strings). Terminology now follows one shared glossary: [`platform-glossary.md`](platform-glossary.md). Screenshots: `docs/screenshots/audit/platform/r2-*`.

### Round 1 re-verification

| id | re-check (round 2, real browser / API) | status |
|---|---|---|
| P-01, P-07 | 40 parallel wrong guesses: 5 compared (`INVALID_CODE`), the rest `TOO_MANY_ATTEMPTS` / `RATE_LIMITED`; two parallel correct codes: one 200, one 400 | fixed (re-verified) |
| P-02 | 8 request-otp calls for one phone, each with a different spoofed `X-Forwarded-For`: 200 then 429 ×7 | fixed (re-verified) |
| P-03 | signed in, `/en/login?next=` `/%09/evil.com`, `//evil.com`, `/\evil.com`, `https://evil.com`: all 307 -> `/en` | fixed (re-verified) |
| P-04 | unknown phone + wrong code -> `INVALID_CODE` (same as a known phone) | fixed (re-verified) |
| P-05 | cross-site `text/plain` POST to request-otp -> 403 | fixed (re-verified) |
| P-06, P-18 | browser sign-in of the seeded buyer without ticking marketing: account still shows "مشترك", no new MARKETING row in the history | fixed (re-verified) |
| P-08 | phone typed in Arabic-Indic digits (٠١١…) and code pasted work end to end in `ar` at 390 px | fixed (re-verified) |
| P-09, P-37 | phone digits in Arabic hint, status and error read in LTR order (measured glyph x-positions) | fixed (re-verified); see R2-03 for wrapping |
| P-10, P-35 | terms and privacy links open in a new tab and are announced; label says "سياسة الخصوصية" | fixed (re-verified) |
| P-11, P-12 | focus: invalid phone -> phone field; code step -> code field; missing terms -> terms checkbox, with `aria-invalid` + `aria-describedby` | fixed (re-verified) |
| P-13 | `role=status` "أرسلنا رمزا من 6 أرقام إلى …"; resend shows "إعادة الإرسال بعد 29 ثانية" | fixed (re-verified) |
| P-14 | `elba_session` HttpOnly + Secure + SameSite=Lax | fixed (re-verified) |
| P-15 | `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy` present on login | fixed (re-verified) |
| P-20, P-21, P-22 | login titled, card layout, buttons enabled after hydration; no axe violations either step, no overflow | fixed (re-verified) |
| P-23 | admin privacy at 390 px: card list, no overflow, "متبق 27 يوما" | fixed (re-verified) |
| P-24 | remainder (other namespaces) closed by R2-01 | fixed (round 2) |
| P-26 | cookie notice button "حسنا" | fixed (re-verified) |
| P-28, P-29 | `/en/...` remembered; admin without `?next=` lands on `/admin` | fixed (re-verified) |
| P-36 | `Link` preload header: `/ar/login` 3 fonts (Inter + Plex 400/700), `/en/login` 1 (Inter) | fixed (re-verified) |
| P-31 | LogOut icon still not mirrored in RTL (owners: storefront, admin, vendor) | open |
| P-16, P-17, P-19, P-27, P-30, P-32, P-33, P-34 | unchanged code paths; behaviour as recorded in round 1 | as round 1 |

### Round 2 findings

| id | severity | page / file | finding | standard | fix | status |
|---|---|---|---|---|---|---|
| R2-01 | high | `src/i18n/core.ts`, `src/lib/format.ts`, all dictionaries | Round 1 left ~45 Arabic strings that put a bare number before a fixed noun ("{days} أيام", "{count} طلبات", "{count} تقييم", "{count} مطابع"): wrong for 1, 2, 3–10 and 11+ in buyer, vendor and admin copy alike. Owners could not fix them without touching call sites. | Arabic grammar (CLDR plural rules); brief: MSA natural for Egypt | Counted placeholders in the shared interpolator: `{days:day}` renders "يوم واحد / يومين / 5 أيام / 14 يوما / 100 يوم" (and "1 day / 5 days" in English) from the same number the call site already passes. 21 units in `formatCount`; locale comes from the translator (falls back to the template's script). Every bare counted placeholder in every namespace converted (call sites checked first) or rephrased as "label: {n}". New tests: rendering per plural category, unknown units, and a guard that fails on any new "{n} أيام"-style string. | fixed |
| R2-02 | high | `[locale]/layout.tsx`, `src/i18n/index.ts` | The whole dictionary, including the admin console and vendor portal namespaces (43 KB of 106 KB in Arabic), was serialised into the HTML of every public page: the login page was 197 KB HTML / 53.4 KB gzip for one form. | Performance budget (brief), Core Web Vitals (LCP) | `getPublicDictionary()` leaves `admin` and `vendorPortal` out of the root provider; the admin and vendor area layouts mount a nested provider with the full dictionary. `/ar/login` 197 -> 131 KB HTML, 53.4 -> 37.2 KB gzip (−30%); `/ar` 74.0 -> 58.2 KB gzip; `/ar/legal/privacy` 58.0 -> 41.8 KB gzip. All admin and vendor pages checked for raw keys: none. | fixed |
| R2-03 | medium | `auth.errors.INVALID_PHONE`, `auth.phoneHint`, `OtpForm.tsx` | At 390 px the example number in the Arabic error broke across lines ("010 1234" / "5678"), and so could the user's own number in "أرسلنا رمزا… إلى …". | WCAG 2.2 1.3.2 meaningful sequence | No-break spaces inside the LTR isolate (dictionary examples and the `ltr()` helper for the user's number). Measured at 390 and 340 px: the three groups share one line, in LTR order. | fixed |
| R2-04 | medium | `OtpForm.tsx` | A server fault (5xx or a non-JSON body) on request-otp / verify-otp showed "راجع البيانات وحاول مرة أخرى" (check your details), blaming the user's input. Seen live when the server lacked `SESSION_SECRET`. | WCAG 2.2 3.3.1 error identification | 5xx / missing error code -> "حدث خطأ. حاول مرة أخرى." with no field marked invalid; 4xx codes keep their specific message. | fixed |
| R2-05 | high | all dictionaries | One concept, several words across roles: order طلب vs طلبية (vendor); buyer المشتري (admin) vs العميل (vendor); dispute نزاع (admin) vs بلاغ (buyer); rate card بطاقة أسعار vs قائمة أسعار; mobile محمول / موبايل / هاتف; Fawry كود مرجعي / كود فوري; online أونلاين / إلكترونيا; digital ديجيتال / رقمية; dieline الفرد / خط القص / القالب; die قالب القص / فورمة القص / فورمة التكسير; folding carton علب كرتون / كرتون مقوى / دوبلكس. | Brief: one term per concept across buyer, vendor and admin; WCAG 3.2.4 consistent identification | Glossary written (`docs/audit/platform-glossary.md`) and applied to every namespace. Per-file detail in R2-I-* rows below. | fixed |
| R2-06 | medium | `structures.*`, `store.seo.keyword.ECMA_STE` | Folding-carton styles were named "علبة كرتون بلسان…" while the catalogue, SEO and materials say "دوبلكس"; FEFCO 0201 was "علبة شحن" in the picker but "كرتونة شحن" in SEO and marketing; two SEO keywords were near-duplicates. | Consistent identification; SEO | "علبة دوبلكس بلسان عكسي/مستقيم"، "علبة دوبلكس بقاع…"، "كرتونة شحن"; STE keyword "علبة دوبلكس بلسان مستقيم مطبوعة". | fixed |
| R2-07 | low | `orderStatus.CANCELLED/REFUNDED`, `paymentMethods.FAWRY`, `pricing.printMethod.DIGITAL` | "ملغي" (misspelt passive participle), "مسترد" (ambiguous: refunded what?), "كود مرجعي فوري", "طباعة ديجيتال". | Arabic orthography; glossary | "ملغى"، "تم الاسترداد"، "فوري (رقم مرجعي)"، "طباعة رقمية". | fixed |
| R2-08 | low | `account.greeting`, `account.granted/withdrawn` | "مرحبا منى" without the vocative comma; consent history read "الرسائل التسويقية: موافقة / سحب" (bare nouns, unclear whether an event or a state). | Arabic punctuation; PDPL 151/2020 (consent record must be unambiguous to the data subject) | "مرحبا، {name}"; "تمت الموافقة" / "تم السحب" (EN "Hello, {name}"). | fixed |
| R2-09 | low | `auth.phoneHint`, `auth.errors.INVALID_PHONE` (ar, en) | The hint gave an example but not the rule (11 digits). | WCAG 2.2 3.3.2 labels or instructions | "رقم محمول مصري من 11 رقما، مثل …" / "11-digit Egyptian mobile, e.g. …". | fixed |
| R2-10 | low | `pricing.*`, `store.home.*`, `legal.terms.*` (ar.ts) | "أونلاين" in Arabic body copy, "برقم موبايل" in the terms, "استلم أسرع بـ {days} أيام", "يمكن للمشترين". | Glossary; MSA | "إلكترونيا"، "برقم محمول ورمز تحقق"، "أسرع بفارق {days:day}"، "للعملاء". | fixed |
| R2-11 | low | `src/components/ui/strings.ts` (outside scope) | UI kit Arabic "{count} محدد" and "تم استخدام {count} من {max} حرف" (wrong agreement for most counts). | Arabic grammar | "المحدد: {count}"، "الأحرف المستخدمة: {count} من {max}" (values only). | fixed |
| R2-12 | low | `src/lib/__tests__/platform-i18n.test.ts` | The dictionary tests did not understand `{name:unit}`: placeholder parity would have ignored it and the "left in English" check rejected a bare counted value. | Test coverage | Parity compares placeholder names (`{days}` ≡ `{days:day}`); allow-list accepts counted placeholders. Still catches untranslated English. | fixed |
| R2-13 | low | admin frame `Frame_UserButton` (outside scope) | axe `label-content-name-mismatch` on the admin user menu button (accessible name does not contain the visible name). | WCAG 2.2 2.5.3 label in name | Not changed (owner: admin / UI kit). | open |
| R2-14 | low | store vs marketing chrome (outside scope) | `/login` renders in the store chrome with the dark cookie notice; `/account` renders in the marketing chrome with a light one. Same text, two looks, and the header changes between the two steps of one flow. | Consistency (ISO 9241-110 conformity with expectations) | Not changed (owners: storefront, marketing). | open |
| R2-15 | low | UI kit `Toast` stack (outside scope) | An always-present empty `role="alert" aria-live="assertive"` container on every page. Harmless today, but every toast interrupts the screen reader, including success toasts. | WCAG 2.2 4.1.3 (status messages should be polite) | Not changed (owner: UI kit). Suggest `role="status"` for non-error toasts. | open |

#### Copy sweep detail (per dictionary)

| id | severity | page / file | finding | standard | fix | status |
|---|---|---|---|---|---|---|
| R2-I-A01 | high | `admin.ar.ts` nav.disputes, overview.metrics.disputes, overview.help.disputes, overview.tasks.disputes, orders.dispute, orders.metrics.disputes, order.disputes.*, vendors.scorecard.dispute, vendors.scorecard.healthHelp, disputes.title/resourceSingular/resourcePlural/empty/emptyBody/detail.back/detail.title/detail.success/detail.refundConfirmBody, privacy.blockers.OPEN_DISPUTES, audit.entities.DISPUTE, audit.actions.DISPUTE_* | Admin used "نزاع/النزاعات" while buyer and vendor copy use "بلاغ"; same object named differently across roles | Glossary: one term per concept (Dispute = بلاغ) | Replaced every نزاع with بلاغ/البلاغات; "فتح النزاع" -> "فتح بلاغ" | fixed |
| R2-I-A02 | high | `admin.ar.ts` overview.help.gmv, orders.columns.buyer, orders.emptyBody, order.buyer.*, order.routing.awaiting, order.override.help/priceLocked, order.refund.confirmBody, order.ship.help, disputes.columns.buyer, disputes.emptyBody, disputes.detail.description/refundConfirmBody/noteHelp, pricing.settings.validityHelp, catalog.activeLabel, users.roles.BUYER, privacy.emptyBody, privacy.actions.completeExport | "المشتري/المشترون/مشتر" used for the buyer; glossary term is العميل | Glossary: Buyer = العميل | Replaced with العميل/العملاء/عميل throughout | fixed |
| R2-I-A03 | medium | `admin.ar.ts` orders.search, application.fields.contactPhone, users.search, users.columns.phone, privacy.actions.completeDelete, audit.search (+ en twins) | "الهاتف" for the sign-in mobile number; EN said "Phone" | Glossary: Mobile number = رقم المحمول | Arabic -> "رقم المحمول"; EN -> "Mobile number"/"mobile" | fixed |
| R2-I-A04 | medium | `admin.ar.ts` overview.tasks.qc, orders.views.qc, orders.metrics.qc, order.qc.title, order.qc.noPhotos, vendors.scorecard.qcPass, order.events.QC_REJECTED (+ en twins) | "مراجعة الجودة" and "صور جودة" while buyer copy says "فحص الجودة"; "رفضت الجودة" reads as "quality refused" | Glossary: Quality check = فحص الجودة | Unified on فحص الجودة; QC_REJECTED -> "لم يجتز فحص الجودة" (EN "QC failed"); EN keeps "QC review" (the ops term the e2e admin spec targets) | fixed |
| R2-I-A05 | medium | `admin.ar.ts` errors.OUT_OF_ENGINE_RANGE, catalog.structures.help | "محرك الفورمة" for the dieline engine; فورمة is the physical cutting die, dieline is القالب | Glossary: Dieline = القالب, Cutting die = فورمة التكسير | -> "محرك القوالب"; EN "Outside the range the dieline engine supports." | fixed |
| R2-I-A06 | medium | `admin.ar.ts` catalog.families.FOLDING_CARTON | "كرتون مطوي" calque; core dictionary uses علب دوبلكس | Glossary: Folding carton = علب دوبلكس | -> "علب دوبلكس" | fixed |
| R2-I-A07 | medium | `admin.ar.ts` orders.search, vendors.search, users.search, audit.search | Search field labels in imperative "ابحث ..." | Brief: noun-form labels | -> "البحث ..." | fixed |
| R2-I-A08 | high | `admin.ar.ts` overview.funnel.steps.*, overview.funnel.note | Funnel step labels as verb clauses ("تصميمات بدأت"، "حسابات أنشئت"); "عرض السعر" for "Price viewed" collides with "عرض سعر" (quote), so the note read as "the quote counts users with a saved quote" | Brief: noun-form labels; Glossary: Quote = عرض سعر | Steps -> "بدء تصميم"، "إنشاء حساب"، "مشاهدة السعر"؛ note names the step in «» | fixed |
| R2-I-A09 | high | `admin.ar.ts` vendors.emptyBody, vendors.applications.emptyBody (+ en) | vendors.emptyBody said "approved orders appear here" (meaning drift from "approved applications"); applications.emptyBody had wrong verb form "التي تقدم"; EN exposed a raw route "/vendor/apply" | Meaning parity; Arabic grammar | Ar: "تظهر هنا المطابع بعد اعتماد طلبات انضمامها." / "تظهر هنا طلبات المطابع المقدمة عبر صفحة الانضمام."؛ EN rewritten without the path | fixed |
| R2-I-A10 | high | `admin.ar.ts` order.override.goodsHelp, pricing.zones.help, pricing.index.help | Agreement/structure errors: "تعاد حساب" (حساب is masculine), "لأول كيلوجرامات" (ungrammatical), "يضرب حصة الكرتون في كل أسعار" (garbled subject) | Arabic grammar (gender agreement, idafa) | "يعاد حساب الضريبة والإجمالي، وتلغى ..."؛ "للكيلوجرامات المشمولة، وسعر كل كيلوجرام إضافي ..."؛ "معامل يطبق على حصة الكرتون ..." (EN zones help clarified to match) | fixed |
| R2-I-A11 | high | `admin.ar.ts` pricing.preview.affected (+ en) | "يتغير {count} من {total} سعر نموذجي" puts a singular counted noun after a variable number (wrong for 3–10); no "price" unit exists | Glossary: counted nouns; Arabic grammar (CLDR plurals) | Rephrased to label form: "الأسعار النموذجية المتغيرة: {count} من {total}." / "Sample prices changed: {count} of {total}." | fixed |
| R2-I-A12 | medium | `admin.ar.ts` pricing.preview.help (+ en) | "لكمية {qty}" / "{qty} units": number + noun hard-coded; call site passes formatNumber(500) (numeric string) | Glossary: counted placeholders | Ar "{qty:piece}", EN "{qty:unit}" (unit renders the noun) | fixed |
| R2-I-A13 | low | `admin.ar.ts` privacy.dueIn | "متبق {days}" ungrammatical without tanween; call site already passes formatCount(left,"day") so unit syntax would double the noun | Arabic grammar | -> "يتبقى {days}" (plain placeholder kept) | fixed |
| R2-I-A14 | medium | `admin.ar.ts` orders.paymentStatus.PENDING/FAILED, order.qc.statuses.PENDING, order.shipments.statuses.RETURNED, disputes.statuses.RESOLVED_REPRINT, application.checklist.items.TEST_JOB (+ en) | Status chips not following pattern: verb "فشل"، bare "بالانتظار"، "مرتجع" not agreeing with الشحنة، "أعيدت الطباعة" verb form, checklist item without "تم" | Brief: status chips (participle / تم + مصدر / بانتظار + مصدر) | "بانتظار الدفع"، "فاشل"، "بانتظار المراجعة"، "مرتجعة"، "تمت إعادة الطباعة"، "تم اجتياز الطلب التجريبي" | fixed |
| R2-I-A15 | medium | `admin.ar.ts` disputes.detail.opened, disputes.detail.decisionTitle, disputes.columns.opened (+ en) | "فتح في {date} بواسطة {name}" passive calque of "by"; decision heading "الحل" duplicated the resolution heading; EN heading "Resolve" was a verb | Brief: calques, noun-form headings | "قدمه {name} في {date}"؛ decisionTitle -> "القرار" / "Decision"؛ column -> "تاريخ الإبلاغ" / "Reported" | fixed |
| R2-I-A16 | medium | `admin.ar.ts` order.routing.help, order.override.priceLocked/costLocked, order.refund.confirmBody, order.ship.help, vendors.detail.suspendBody, order.qc.reject/rejectNote, application.noDocuments, overview.help.margin/onTime | Stiff or colloquial phrasing ("ناقص"، "لانتظار"، "لذلك سعر المشتري مقفل"، "تم التسليم أو الإغلاق: لا يمكن التغيير"، "سيعاد"، "ما الذي يحتاج إلى إصلاح" as a field label) | Brief: MSA natural for Egypt, no "سوف"-style future in help text | Rewritten idiomatically ("مطروحا منها"، "يعود بانتظار قبول ..."، "تم تسليم الطلب أو إغلاقه، فلا يمكن تغيير السعر"، "المطلوب إصلاحه" ...) | fixed |
| R2-I-A17 | low | `admin.ar.ts` nav.label | "لوحة الإدارة" close to the banned "لوحة التحكم"; admin console is الإدارة | Glossary: Admin console = الإدارة | -> "قائمة تنقل الإدارة" | fixed |
| R2-I-A18 | low | `admin.ar.ts` users.detail.consentsHelp, privacy.subtitle | Law cited as "قانون حماية البيانات 151" without "الشخصية رقم" | Glossary: قانون حماية البيانات الشخصية رقم 151 لسنة 2020 | Full glossary form used | fixed |
| R2-I-A19 | low | `admin.ar.ts` errors.NONE_REQUIRED, pricing.notWired | Latin straight quotes around Arabic text | Brief: Arabic punctuation | -> «...» | fixed |
| R2-I-A20 | low | `admin.ar.ts` pricing.subtitle, pricing.settings.title, pricing.settings.validity, pricing.zones.columns.includedKg/freight/transit, catalog.materials.columns.gsm, vendors.columns.reprint/health, users.resourcePlural, users.detail.lastLogin, privacy.actions.completeDelete, application.decision.rejectTitle/success | "العروض" ambiguous for quotes; unit columns inconsistent ("ساعات"، "كجم مشمولة"، "أيام النقل"، "الوزن جم/م2"); "مستخدمين" (accusative) used as a standalone caption; "آخر دخول" vs glossary تسجيل الدخول; "التصميمات غير المطلوبة" meant "unwanted" not "not ordered"; application decision toasts said just "الطلب" | Glossary: Quote, Sign in; Arabic grammar (case); meaning parity | "عروض الأسعار"، "(بالساعات)"، "الوزن المشمول (كجم)"، "مدة النقل (أيام)"، "الوزن (جم/م2)"، "إعادات الطباعة"، "مؤشر الأداء"، "مستخدمون"، "آخر تسجيل دخول"، "التصميمات التي لم تطلب"، "طلب الانضمام" | fixed |
| R2-I-A21 | low | `admin.ar.ts` admin.en: errors.generic/UNAUTHENTICATED/INVALID, order.vendorCard.due, order.routing.locked/help, order.override.costLocked, order.qc.reject, pricing.settings.marginHelp, pricing.preview.none, vendors.columns.health, audit.search | English polish: "Please" used inconsistently in errors; lowercase "due {date}" chip; "the vendor can no longer change" (wrong subject); "Report target" leftover; "No sample price changes" ambiguous; "Send back" without target; "record id" | English copy style: sentence case, clarity, consistency | Removed "Please"; "Due {date}"; "can no longer be changed"; "Target: 20 to 30%"; "No sample prices change."; "Send back to production"; "record ID"; "Health score" | fixed |
| R2-I-V01 | high | `vendorPortal.ar.ts` nav.jobs, topBar.search, jobs.*, job.* (title, back, notFound*, actions.accept, accept*/decline*, banners.*, events.VENDOR_*), dashboard.awaiting*/due*/viewAll, payouts.subtitle/columns.order/triggers/emptyBody/termsAdvance, apply.benefits.demand/steps/alreadyVendorBody, errors.NOT_ALLOWED/STALE, common.suspendedBody/pendingBody | "طلبية/الطلبيات" used for jobs while buyer/admin copy says "طلب"; one concept had two terms | Glossary: one term per concept (Job = طلب / الطلبات) | Replaced with طلب/الطلبات everywhere | fixed |
| R2-I-V02 | high | `vendorPortal.ar.ts` views.ready/done/declined, due.overdueOne/overdue/dueSoon/overdueBadge, jobs.dueSoonOnly/appliedDue, job.notFoundBody, job.dueHelp, job.banners.readyTitle/declinedBody/awaitingBody, dashboard.awaitingHelp | Feminine agreement left over from طلبية (جاهزة، مكتملة، متأخرة، قريبة الموعد، موجهة، سيوجهها، ارفضها) | Arabic grammar (gender agreement) | Switched adjectives, verbs and pronouns to masculine (جاهز، مكتمل، مرفوض، متأخر، قريب الموعد، ارفضه، سيوجهه)؛ status tabs now match core status chips (جاهز للشحن، مكتمل، مرفوض) | fixed |
| R2-I-V03 | high | `vendorPortal.ar.ts` nav.rateCards, dashboard.rateCards*/setup.rateCards, rateCards.title/back/resource*/emptyTitle/emptyBody/activeLabel/saved | "بطاقة أسعار" is a banned calque of "rate card" | Glossary: Price list = قائمة أسعار | Replaced with قائمة أسعار / قوائم الأسعار; activeLabel now says "بهذه القائمة" | fixed |
| R2-I-V04 | high | `vendorPortal.ar.ts` job.dielinePreview, job.dielineSvg, job.actions.downloadDieline, job.banners.awaitingBody, apply.benefits.files | Dieline called "خط القص" (the cut line), not the template term buyers see | Glossary: Dieline = القالب | Replaced with القالب | fixed |
| R2-I-V05 | medium | `vendorPortal.ar.ts` rateCards.columns.die, rateCards.die, rateCards.diesTitle, rateCards.diesHelp | "فورمة القص" differs from the glossary and buyer copy | Glossary: Cutting die = فورمة التكسير | Replaced with فورمة التكسير؛ diesHelp reworded so orders don't "pay" ("لا تحسب تكلفة فورمة...") | fixed |
| R2-I-V06 | high | `vendorPortal.ar.ts` apply.contactPhone, apply.signInBody, apply.errors.PHONE, common.notLinkedBody | "رقم الهاتف (المحمول)" banned; notLinkedBody "رقم أحد موظفي المطبعة" read as "staff ID" (en had the same ambiguity) | Glossary: Mobile number = رقم المحمول | Changed to رقم المحمول / رقم محمول؛ en notLinkedBody now "a vendor staff member's mobile number" | fixed |
| R2-I-V07 | high | `vendorPortal.ar.ts` apply.pendingTitle (common), apply.submittedTitle, apply.statusTitle, apply.signInTitle, apply.submit, apply.agreement, apply.errors.ALREADY_APPLIED | Vendor application also called "الطلب", clashing with the order/job term on the same screens | Glossary: one term per concept | Used "طلب الانضمام" for the application | fixed |
| R2-I-V08 | high | `vendorPortal.ar.ts` common.days, due.inDays, due.overdue | "{count} يوم" wrong for 2 and 3–10 (يومين، أيام); en "1 days" | Arabic grammar (CLDR plurals); Brief: counted placeholders | {count:day} in ar and en (call sites pass a number / formatNumber string); ar common.days is "خلال {count:day}" so it differs from en (else the not-left-in-English test flags it) | fixed |
| R2-I-V09 | high | `vendorPortal.ar.ts` dashboard.ratingCount, profile.rating, job.qcUploaded, portfolio.limit, rateCards.tierQty, job.acceptBody, jobs.count | "{count} تقييم / صورة / قطعة / علبة / طلبية" wrong for 2 and 3–10; en "1 reviews/photos" | Arabic grammar (CLDR plurals) | {count:review}, {count:photo}, {max:photo}, {count:piece}, {quantity:box}, ar {count:order} (en "Jobs: {count}" to keep "job"); ratingCount now "بناء على {count:review}" / "Based on {count:review}"; acceptBody uses "وفق البروفة" so no adjective has to agree with a dual | fixed |
| R2-I-V10 | high | `vendorPortal.ar.ts` profile.errors.summary, rateCards.errors.summary, apply.errors.summary | "يرجى تصحيح {count} أخطاء" says "errors" for 1 and 2, and uses "يرجى" | Arabic grammar (CLDR plurals); Brief: no يرجى | "يلزم تصحيح {count:error} قبل الحفظ/الإرسال." (genitive works for every form); en "Fix {count:error} before saving/sending." | fixed |
| R2-I-V11 | medium | `vendorPortal.ar.ts` dashboard.setupProgress, dashboard.rateCardsBody | "{total} خطوات" and "{active} بطاقة أسعار نشطة" are counted nouns with no unit (step) or with dual-adjective agreement problems | Brief: counted nouns, or rephrase as "label: {count}" | "الخطوات المكتملة: {done} من {total}"؛ "قوائم الأسعار النشطة: {active}." (en "Steps done: …", "Active rate cards: {active}.") | fixed |
| R2-I-V12 | medium | `vendorPortal.ar.ts` job.banners.awaitingTitle, apply.errors.AGREEMENT_REQUIRED, errors.generic, errors.upload.FAILED | "يرجى" in copy | Brief: no يرجى/الرجاء | "الرد مطلوب خلال 24 ساعة"، "أكد صحة البيانات للمتابعة."، "أعد المحاولة." | fixed |
| R2-I-V13 | medium | `vendorPortal.ar.ts` apply.title, apply.signInTitle, apply.submittedOn | Headings/labels in imperative or ambiguous verb form (انضم، سجل الدخول، أرسل في) | Brief: noun-form labels | "الانضمام إلى علبة كمطبعة"، "تسجيل الدخول لتقديم طلب الانضمام"، "تاريخ الإرسال: {date}" | fixed |
| R2-I-V14 | medium | `vendorPortal.ar.ts` job.productionStarted, portfolio.moved, job.banners.declinedTitle | Success toasts/banners as bare past verbs, which read ambiguously (رفضت = you/she declined) | Brief: success toasts "تم + مصدر" | "تم بدء الإنتاج"، "تم نقل الصورة…"، "تم رفض هذا الطلب" | fixed |
| R2-I-V15 | medium | `vendorPortal.ar.ts` errors.RATE_LIMITED | "طلبات كثيرة" (requests) reads as "many orders" in a portal where طلبات means orders | Glossary: one term per concept | "محاولات كثيرة. انتظر دقيقة ثم أعد المحاولة." | fixed |
| R2-I-V16 | medium | `vendorPortal.ar.ts` job.declineReasons.LEAD_TIME (ar+en), job.declineReasons.CAPACITY | A date is not "قصير/too short"; "الوقت المطلوب" vague | Meaning / natural MSA | "موعد التسليم قريب جدا" / "Due date too soon"؛ "لا تتوفر طاقة إنتاجية في الموعد المطلوب" | fixed |
| R2-I-V17 | medium | `vendorPortal.ar.ts` jobs.filters, jobs.clearFilters, jobs.emptyFilteredBody | "عوامل التصفية" is a stiff calque of "filters" | Brief: avoid calques | "التصفية" / "مسح التصفية" | fixed |
| R2-I-V18 | medium | `vendorPortal.ar.ts` rateCards.subtitle (ar+en), dashboard.rateCardsBody (en) | "سعر بيعك لعلبة لكل علبة" confuses the brand with the box; en "buy price to Elba" says the opposite of what is meant | Meaning drift / clarity | "سعر العلبة الذي تبيع به لعلبة… إلى سعر العميل"؛ en "Your selling price to Elba per box…" | fixed |
| R2-I-V19 | medium | `vendorPortal.ar.ts` apply.agreement (ar+en) | Law cited as "القانون 151 لسنة 2020" / "Law 151/2020" without its name | Glossary: قانون حماية البيانات الشخصية رقم 151 لسنة 2020 | Full law name in both languages | fixed |
| R2-I-V20 | low | `vendorPortal.ar.ts` profile.machineKinds.UV_COATER, profile.maxColors, profile.digitalShortRun, profile.errors.DIGITAL_MACHINE_REQUIRED, profile.notVerified | Transliteration "يو في"; "أقصى عدد ألوان" telegraphic; "كميات رقمية" is a calque | Brief: no English in Arabic letters, natural MSA | "ماكينة طلاء UV"، "الحد الأقصى لعدد الألوان"، "طباعة رقمية للكميات الصغيرة"، "غير موثقة بعد" | fixed |
| R2-I-V21 | low | `vendorPortal.ar.ts` payouts.eInvoiceTitle, payouts.statuses.ON_HOLD, payouts.termsBank, payouts.eInvoiceBody | "مطلوب فاتورة" (agreement), status chip not in "بانتظار" form, "اتفاقية التعاون" ≠ framework agreement, tax authority not named in full | Arabic grammar; Brief: status chips; Glossary: مصلحة الضرائب المصرية | "فاتورة إلكترونية مطلوبة"، "بانتظار الفاتورة"، "الاتفاقية الإطارية"، "منظومة مصلحة الضرائب المصرية" | fixed |
| R2-I-V22 | low | `vendorPortal.ar.ts` job.printSides (ar+en), job.banners.qcPendingTitle, job.banners.readyBody, job.banners.deliveredBody, job.dueHelp, apply.contactTitle, apply.subtitle, apply.benefitsTitle (ar+en), dashboard.dueEmpty, jobs.emptyBody | Vague label "الطباعة/Print"; "جار" status not in "قيد" form; minor fluency and punctuation fixes (missing ؟ and ، ) | Brief: status chips, MSA fluency, Arabic punctuation | "أوجه الطباعة"/"Printed sides"، "فحص الجودة قيد التنفيذ"، "غلف الطلب…"، "بعد إصدار فاتورتك"، "لماذا تطبع مع علبة؟" etc. | fixed |
| R2-I-V23 | low | `vendorPortal.ar.ts` (en) job.filesHelp, job.qcLocked, job.dielinePreview, payouts.eInvoiceBody | English polish: "plant" vs "factory" used everywhere else, missing "only", "preview of", "ETA e-invoice" | English copy consistency | "inside your factory", "can only be added", "Dieline preview for {name}", "an e-invoice … on the ETA system" | fixed |
| R2-I-V24 | medium | `vendorPortal.ar.ts` common.pcs | "{count} قطعة" is wrong for 3–10, but RateCardForm.tsx calls it with count: "" and trims the result to get a bare suffix, so a counted placeholder would render empty there | Arabic grammar (CLDR plurals) | Left as is (needs a separate suffix key or a call-site change; quantities are normally ≥100 where قطعة is correct) | open |
| R2-I-B01 | high | checkout.ar/en: checkout.offers.delivery, checkout.offers.production, checkout.suggestion.body, checkout.summary.deliveryBy; designer.ar/en: price.badge, price.delivery, price.suggestion; marketing.ar/en: printers.lead | Counted days written as "{days} يوم" / "{days} أيام" (wrong for 1, 2 and 11+: "2 يوم", "14 أيام"); English "{days} days" wrong for 1 | Glossary: counted nouns use `{count:unit}` | Switched to `{days:day}` in both languages after checking the call sites (offer.deliveryDays, offer.leadTimeDays, suggestion.leadTimeDaysSaved, best.deliveryDays, vendor.leadTimeDays are all numbers). Rephrased "قبل الموعد بـ/قبلها بـ" as "أسرع بـ {days:day}"; marketing.ar printers.lead became "التنفيذ خلال {days:day}" | fixed |
| R2-I-B02 | high | checkout.ar/en: offers.rating; marketing.ar/en: hero.chips.ratingCount, printers.rating | "{count} تقييم" / "{count} reviews" did not agree with the count | Glossary: counted nouns | Switched to `{count:review}` (ratingCount is a number or a formatNumber string). Hero chip is now "من {count:review}" in Arabic | fixed |
| R2-I-B03 | high | checkout.ar/en: summary.quantity, orders.boxes; designer.ar/en: price.badge, price.badgeLocked; marketing.ar/en: printers.from | "{qty} علبة" reaches custom quantities from 1 to 2,000, so "2 علبة" or "5 علبة" could appear | Glossary: counted nouns | Switched to `{qty:box}` (qty is passed through toLocaleString/formatNumber, so it is a numeric string). In Arabic, summary.quantity and orders.boxes are "الكمية: {qty:box}" because the "not left in English" test flags a bare "{qty:box}" that matches the English | fixed |
| R2-I-B04 | medium | checkout.ar/en: payment.methodHelp.FAWRY; designer.ar/en: artwork.tooManyLayers, box.removedLayers; library.ar/en: picker.count, catalog.subtitle | Counted hours, items and models ("{hours} ساعة", "{max} عنصرا", "{count} نموذج") and a broken counted list ("{count} علبة وصينية…") | Glossary: counted nouns | `{hours:hour}`, `{max:item}`, `{count:item}`, `{count:model}` (fawryHours, MAX_LAYERS, removed and MODELS.length are numbers). catalog.subtitle is now "{count:model} من العلب والكراتين والصواني…". In Arabic, picker.count is "عدد النماذج: {count}" (same test constraint as B03). removedLayers is now "حذفنا {count:item} لعدم وجود وجه مناسب لها…" | fixed |
| R2-I-B05 | low | library.ar/en: catalog.groupCount; designer: price.badgeShort; checkout: quantity.customHelp, quantity.manualBody | No call site found under src/, so the type of the value passed in could not be checked | Task rule: convert only after checking the call site | groupCount rephrased neutrally as "النماذج: {count}" / "Models: {count}". The others were left alone: their {max} is MAX_INSTANT_QTY (2,000), so "علبة" is correct | fixed |
| R2-I-B06 | high | checkout.ar: payment.methodHelp.FAWRY, payment.fawry.code/steps/copy/copied, notify.FAWRY_CODE (+en) | "كود مرجعي" / "الكود المرجعي لفوري" / "نسخ الكود" | Glossary: الرقم المرجعي لفوري (not كود فوري or كود مرجعي) | Changed to "الرقم المرجعي لفوري" / "الرقم المرجعي" throughout. English is now "Fawry reference number" | fixed |
| R2-I-B07 | high | checkout.ar: buyer.shareSignIn; designer.ar: start.body | "رقم الموبايل" / "برقم موبايلك" | Glossary: رقم المحمول | "برقم المحمول" / "برقم محمولك" | fixed |
| R2-I-B08 | high | designer.ar: shared.ctaHelp; marketing.ar: values.payTitle, design.steps.s3Body, values.payBody | "ادفع أونلاين", "دفع آمن أونلاين", "محفظة موبايل" | Glossary: إلكترونيا / المحفظة الإلكترونية | "ادفع إلكترونيا", "دفع إلكتروني آمن", "محفظة إلكترونية" | fixed |
| R2-I-B09 | high | checkout.ar/en: orders.invoice.buyer, buyerTaxId, orders.review.help | "المشتري" / "المشترين الآخرين" (EN "Buyer", "other buyers") | Glossary: العميل / العملاء (not المشتري) | "العميل", "الرقم الضريبي للعميل", "العملاء الآخرين"; EN "Customer", "Customer tax number", "other customers" | fixed |
| R2-I-B10 | high | designer.ar: view.dieline, view.dielineLabel, export.noPdf, picker.presetsSubtitle; checkout.ar: offers.standardSize, offers.customDie | Dieline called "الفرد", and the cutting die called "قالب" / "قالب القص", which clashes with القالب (= dieline) | Glossary: القالب = dieline; فورمة التكسير = cutting die | "القالب", "القالب المسطح مع التصميم", "ملف القالب الجاهز للطباعة", "بدون تكلفة فورمة", "يشمل فورمة التكسير". Also fixed the broken grammar of presetsSubtitle ("لها فورمة تكسير جاهزة لدى المطابع") | fixed |
| R2-I-B11 | high | designer.ar: picker.family.FOLDING_CARTON; marketing.ar: nav.productsMenu.cartons, boxes.family.FOLDING_CARTON, boxes.familyBody.FOLDING_CARTON/RIGID | Folding carton called "كرتون مقوى" / "علب كرتون مطوية" / "علب الكرتون المطوية"; rigid board called "كرتون مقوى" | Glossary: علب دوبلكس; الكرتون المقوى is forbidden (ambiguous) | "علب دوبلكس" / "علب الدوبلكس" / "كرتون دوبلكس مطبوع"; rigid: "كرتون صلب" | fixed |
| R2-I-B12 | high | designer.ar: productPresets.tshirt; marketing.ar: nav.productsMenu.boxesBody | Mailer called "علبة شحن" (EN "Mailer"); "علب مضلعة بريدية" has awkward word order | Glossary: علبة بريدية (mailer); علبة شحن is forbidden | "علبة بريدية لتيشيرت"; "علب بريدية من الكرتون المضلع" | fixed |
| R2-I-B13 | high | marketing.ar: announce.text, finishes.items.foil*/spotUv*/emboss*/softTouch*, useCases.items.cosmeticsBody; library.ar: panel.finishesHelp | Finish names clashed with the core option names (ar.ts: بصمة حرارية، يو في موضعي، طباعة بارزة، سلوفان مخملي). Marketing used "التذهيب، الورنيش الموضعي، البصمة البارزة (emboss!)، الملمس المخملي، سلفنة", so "بصمة" meant emboss in marketing and foil in the product | Glossary: one term per concept; match ar.ts | Aligned to "البصمة الحرارية، اليو في الموضعي، الطباعة البارزة، السلوفان المخملي" in all these places | fixed |
| R2-I-B14 | medium | checkout.ar: payment.status.PENDING/FAILED, payment.pending, orders.views.unpaid, orders.invoice.etaPending (+en payment.status.PENDING) | "قيد الانتظار" / "في انتظار…" / "فشل" (a bare verb as a status chip) | Form rules: "بانتظار + مصدر" for waiting; a status, not a verb | "بانتظار الدفع", "بانتظار الإرسال", "لم يكتمل". EN PENDING is now "Awaiting payment", matching the orders view | fixed |
| R2-I-B15 | medium | designer.ar: order.button, shared.cta, shared.copyDesign; library.ar: catalog.design; checkout.ar: payment.fawry.later, payment.instapay.sent, checkout.suggestion.title | Buttons/titles in imperative or first person ("اطلب هذه العلبة", "صمم علبتك", "سأدفع لاحقا", "قمت بالتحويل", "وفر مع…") | Form rules: noun form for buttons/titles; no "قم بـ" | "طلب هذه العلبة", "تصميم علبتك", "تصميم هذا النموذج", "الدفع لاحقا", "تأكيد إرسال التحويل", "مقاس قياسي أوفر". EN "Pay later", "Design this model". Marketing hero/nav CTAs ("ابدأ التصميم مجانا", "صمم مجانا") were left as they are, to match ar.ts | fixed |
| R2-I-B16 | high | designer.ar: picker.emptyBody (+en) | "يرجى العودة قريبا" / "Please come back soon" | Form rules: no يرجى | "نجهز الكتالوج الآن. عد إلينا قريبا." / "We are setting up the catalog. Check back soon." | fixed |
| R2-I-B17 | medium | checkout.ar: orders.detail.refundedNote, orders.dispute.status.RESOLVED_REFUND | "رد المبلغ" used as the refund noun | Glossary: استرداد المبلغ | "تم استرداد مبلغ هذا الطلب", "تم الحل: استرداد المبلغ" | fixed |
| R2-I-B18 | medium | designer.ar: export.heading/download/done, gate.reason.export; checkout.ar: orders.subtitle | Download given as "تحميل/حمل", which is ambiguous with upload and loading; ar.ts uses تنزيل | Consistency with ar.ts (تنزيل بياناتي) | "تنزيل صورة العلبة", "تنزيل", "تم تنزيل الصورة", "نزل صورة علبتك", "نزل الفواتير" | fixed |
| R2-I-B19 | medium | checkout.ar: summary.prepaidNote, payment.chooseHelp, payment.testMode, proof.help, approveHelp | Calques and stiff phrasing: "العلب المخصصة", "لا تتحرك أموال حقيقية", "تأكد أن لا شيء مهم يقع…". approveHelp suggested a 30-day refund instead of a 30-day window to report | No calques; meaning matches EN | "العلب المطبوعة حسب الطلب", "لن يخصم أي مبلغ حقيقي", "تأكد من عدم وجود عناصر مهمة…", "أبلغنا خلال 30 يوما من الاستلام لنعيد الطباعة أو نرد المبلغ". Matching EN clarification: "tell us within 30 days of delivery and we reprint or refund" | fixed |
| R2-I-B20 | medium | designer.ar: save.failed, save.anonNote, export.needs3d, view.faceEditorHint, gate.note; marketing.ar: hero.fine | Passive calques ("ستتم إعادة المحاولة"), clumsy fronting, "رسائل التسويق فقط إذا اخترت ذلك", "رمزا لمرة واحدة" | Natural MSA; glossary: رمز التحقق | "سنعيد المحاولة بعد قليل", "تحفظ التصميمات دون حساب…", "تؤخذ الصور…", "بلوحة المفاتيح/بالمؤشر… وفي لوحة التصميم…", "نرسل رمز التحقق… لا رسائل تسويقية إلا بموافقتك", "نرسل لك رمز تحقق". EN gate.note: "verification code … only if you opt in" | fixed |
| R2-I-B21 | medium | marketing.ar: hero.chips.approved, hero.chips.delivered, cta.tileProof | Chips that show completed events used bare masdars ("اعتماد البروفة", "توصيل إلى") where EN says "Proof approved" / "Delivered to" | Form rules: "تم + مصدر" for completed events | "تم اعتماد البروفة", "تم التوصيل إلى {place}" | fixed |
| R2-I-B22 | medium | marketing.ar: values.priceBody, values.proofBody, values.deliveryBody, stats.minOrder, useCases.items.foodBody, boxes.familyBody.CORRUGATED, boxes.renderAlt, vendors.body | Telegraphic or ungrammatical lines ("علبة حد أدنى", "من مطابع بكرتون ملامس للطعام"), the E/B-flute detail missing from the EN, "مطبوعة" not agreeing with masculine names in renderAlt | Grammar; meaning matches EN; persuasive tone | Rewritten: "اعرف سعر العلبة… عرض السعر صالح لمدة 72 ساعة", "اعتمد المعاينة… ونراجع أول فرخ مطبوع…", "نشحن العلب مسطحة إلى المحافظات الـ27 كلها", "علبة كحد أدنى للطلب", "مطابع تستخدم كرتونا صالحا لملامسة الطعام", "بتموج E أو B", "لـ{name} بعد الطباعة", "…البائع في كل طلب: تدفع لنا، ونحن ندفع للمطبعة" | fixed |
| R2-I-B23 | low | marketing.ar: useCases.eyebrow, useCases.items.cosmeticsTitle/cosmeticsBody, design.body, marquee.pause/play, printers.all, bottles.secondary, nav.productsMenu.cartonsBody, announce.text | Missing "؟"; meaning drift from EN (skin care missing; "القطارات" = trains); "الموبايل" in body text; "شريط النماذج" clashes with نموذج (= library model); links missing their verb | Arabic punctuation; one term per concept | "لمن علبة؟", "التجميل والعناية بالبشرة", "زجاجات القطارة", "حتى على هاتفك", "شريط التصميمات", "عرض كل المطابع", "عرض أنواع العلب", "علب بلسان أو بقاع مقفل…" | fixed |
| R2-I-B24 | low | checkout.ar: start.emptyBody, start.updated, orders.detail.placed/dueBy/proofApproved, offers.help, offers.verified, errors.FORBIDDEN, dispute.reasons.WRONG_ITEM, dispute.help, invoice.print, invoice.back, buyer.subtotalExVat, buyer.shareOwnCopy, notify.PAYMENT_RECEIVED, notify.VENDOR_NEW_JOB | Nitpicks: "ارجع هنا", label+date with no colon, "تم التحقق منها" / "موثقة" vs "معتمدة" in ar.ts, "صلاحية على", colloquial "خطأ" as an adjective, "العودة للطلب", "الإجمالي قبل الضريبة" for the subtotal, the repetitive "للطلب أو التعديل", "صندوق الطلبات" | Consistency with ar.ts; MSA polish | "عد إلى هنا", "…: {date}", "معتمدة", "صلاحية الوصول إلى", "خاطئ", "العودة إلى الطلب", "المجموع الفرعي (دون الضريبة)", "تعدلها وتطلبها", "بانتظارك في صفحة الطلبات" | fixed |
| R2-I-B25 | low | designer.ar: view.flat, view.dielineLegend, artwork.hex, artwork.hexError, layer.duplicate, layer.placement, price.total; library.ar: panel.sceneReference, panel.removedFinishes | "مفرودة" vs "مسطحة" in checkout; the legend's word order differs from checkout.proof.legend; "كود اللون"; "نسخ" used for duplicate (= copy); "وضع سريع" | Consistency; MSA | "مسطحة", "أزرق متقطع / أخضر منقط / خال من الحبر", "رمز اللون", "تكرار", "مواضع جاهزة", "الإجمالي شامل الضريبة", "علبة مشروبات", "حذفنا التشطيبات التي لا تناسب…" | fixed |
| R2-I-B26 | medium | checkout.en, designer.en, marketing.en: payment.fawry.later, orders.detail.steps.QC_PASSED, notes.DISPUTE_OPENED, notes.PRINT_PDF_FAILED, notify.VENDOR_NEW_JOB, picker.presetsSubtitle, price.vendorsCount, shared.ctaHelp, nav.login, hero.fine, stats.governorates | English inconsistencies: "Log in" vs "Sign in" in en.ts; "vendors" / "print vendor" vs "printer"; "QC passed" vs "Quality check"; "opened a claim" vs "report"; "job inbox"; "{count} vendors can make it" wrong for 1; passive phrasing | One term per concept (EN mirrors the glossary) | "Sign in", "printers", "Quality check passed", "You reported a problem", "Our team is preparing the print file", "new paid order … on your orders page", "Printers available: {count}", "Add your mobile number", "governorates served", "Lead time: {days:day}" | fixed |
| R2-I-B27 | low | designer.ar: describe.rotated; designer.en: price.total | "مدور {deg}°" is ambiguous (it can also mean rounded); "Total with VAT" vs "Total incl. VAT" in checkout | Consistency | Not changed: describe.test.ts asserts "مدور 15°", and e2e designer.spec.ts and journey.spec.ts assert getByText("Total with VAT"). Suggest "مدار بزاوية {deg}°" and "Total incl. VAT" when those tests are updated | open (designer owner: test-locked text) |
| R2-I-B28 | low | src/lib/__tests__/platform-i18n.test.ts ("Arabic values are not left in English") | The allow-list regex `\{[\w]+\}.*` does not accept counted placeholders, so an Arabic value that is just "{qty:box}" (the same as the English) fails, even though it renders Arabic | Test gap | Worked around with label forms ("الكمية: {qty:box}", "عدد النماذج: {count}", "من {count:review}", "التنفيذ خلال {days:day}"). Allow-list widened to accept `{name:unit}` (the test is not weakened: identical *English* text in an Arabic value is still caught); the four values went back to the bare counted form | fixed |

### Round 2 counts

Round 2 rows: 88 (critical 0, high 30, medium 33, low 25). R2-01–R2-15 are platform-level; R2-I-A/V/B are the per-dictionary copy rows (admin 21, vendor portal 24, buyer-facing 28). Fixed 83; open 5 (R2-13, R2-14, R2-15 belong to other owners; R2-I-V24 `vendorPortal.common.pcs` needs a suffix key at its call site; R2-I-B27 is text pinned by designer tests). Round 1: P-31 still open, everything else re-verified.

### Round 2 verification

- `npm run lint`, `npm run typecheck`, `npm test` (54 files, 6,250 tests, including 5 new counted-placeholder tests), `npm run build`: pass.
- Full Playwright suite (`--workers=2 --trace off`, mock payments, `OTP_DEV_ECHO=1`): 409 passed, 374 skipped (by the specs themselves), 3 failed. `admin.spec.ts:50` failed on English copy changed in this round (`pricing.preview.affected`); the original wording is restored and the spec passes (4 passed, 2 skipped). `models.spec.ts` FEFCO_0309 and FEFCO_0439 (desktop) logged React #418 hydration errors under full-suite load; both pass when re-run on their own. They are 3D model pages outside this scope.
- Note for whoever runs e2e from a fresh clone: there is no `.env`, so payments are "not available" and checkout specs fail unless the `.env.example` values (`PAYMENTS_PROVIDER=mock`, …) and a `SESSION_SECRET` are exported.
- Browser: axe has no violations on login (phone, code, error and terms states), account, the privacy and cookies pages, in ar/en at 390 and 1440. The only remaining violation is R2-13 on the admin frame. No horizontal overflow and CLS 0. Every admin and vendor page loads without raw dictionary keys after the dictionary split.

### Files touched outside the listed scope (round 2)

- `src/app/[locale]/admin/layout.tsx`, `src/app/[locale]/vendor/layout.tsx`: a nested `<I18nProvider>` with the full dictionary (R2-02).
- `src/components/ui/strings.ts`: two Arabic values (R2-11).
- `src/lib/__tests__/platform-i18n.test.ts`: new tests, and placeholder parity that understands counted placeholders (R2-12).

## Round 3

Scope: the platform rows of `docs/audit/ROUND3.md` (from `craft.md`, `a11y.md`, `business.md`), after merging the integration branch. Same method: production build, Playwright at 390 and 1440 in ar and en, axe-core, keyboard, HTTP status probes.

| id | severity | page / file | finding | standard | fix | status |
|---|---|---|---|---|---|---|
| CR-01 | high | `globals.css`, `marketing.module.css`, `designer.module.css` | Global `a:hover` (0,1,1) beat `.pill` colours: header CTA 1.51:1, designer top-bar link 1.21:1, start CTA 1.86:1 on hover. | WCAG 1.4.3 | `a:where(:hover)` (0,0,1) and explicit `:hover` colours on pill links. After: 14.16:1, 8.86:1, 17.4:1. | fixed |
| CR-04 / X-03 | high | `[locale]/[...missing]`, `app/not-found.tsx`, `(store)/not-found.tsx` | Unknown `/ar/…` and `/en/…` paths fell to an unstyled global 404 (Times New Roman, no chrome, no title, mixed `lang`). | Brand; WCAG 2.4.2, 3.1.2, 3.2.3 | Catch-all calls `notFound()` inside the marketing chrome, in the page language, with a server `<title>` and `noindex`. Store detail pages get a chromed 404 too. The global 404 loads tokens and fonts and has a title, and its English part is tagged `lang="en" dir="ltr"`. Verified: `/ar/unknown` and `/en/unknown` return 404; `/unknown` redirects 307 to `/ar/unknown`. | fixed |
| CR-05 | high | `(auth)`, `orders`, `s`, `vendor/apply` layouts; `AccountLink`, `useSessionRole` | Buyer pages used three chromes (white marketing, dark store top bar, dark designer bar); the buyer crossed from white to black on the first click. | ISO 9241-110 conformity with expectations | Login, orders, share and vendor apply use the marketing chrome. The signed-in header has an account menu (My account, Sign out); session state refreshes on navigation. The checkout bar is white. StoreShell, SiteHeader, SiteFooter, NavLinks, LanguageSwitcher and SiteChrome.module.css are deleted. The designer keeps its full-screen bar. | fixed (design picker: see open) |
| CR-06 | high | `ui/CookieNotice.tsx` | Two cookie notices (white bar vs dark card) in one session. | Consistency; PDPL 151/2020 notice reads the same everywhere | One UI-kit component, used by the marketing and checkout shells. It is a named region and a white card (max 440px, full width under 490px) with a dark button. It enters with a 200ms rise and leaves with a 150ms fade (fade only under reduced motion), shows no flash before hydration, and reserves page and scroll padding so it never covers focus (WCAG 2.4.11). | fixed |
| CR-07 | medium | footers | Three footers. | Consistency | The store footer is gone. The marketing footer shows 2 columns on phones; checkout keeps its one-row footer. | fixed |
| CR-16 | medium | `ui/Toast.*` | Toast vanished at 5 s with no exit animation, and the region shifted. It used `--p-color-bg-inverse` instead of the surface-inverse token. | Motion consistency | 150ms exit (fade, 8px drop), `inert` while closing, unmounted on `animationend` with a 250ms fallback. Stacks are bottom-anchored, so nothing shifts. `--p-color-bg-surface-inverse` gives 13.2:1. Opacity only under reduced motion. | fixed |
| CR-17 | medium | `ui/Modal.*` | Modal and backdrop disappeared on close with no exit animation. | Motion consistency | 150ms exit: backdrop fades, dialog goes to opacity 0 and scale(.99). The root is `aria-hidden` and ignores input while closing. Focus returns to the opener as the exit starts: an existing kit test requires it, and it keeps focus out of an `aria-hidden` subtree. | fixed |
| CR-18 | medium | `tokens.css`, `motion.css`, `three/finishes/motion.ts`, CSS modules | Three motion token sets, three "ease-out" curves, ten durations. | Design-system hygiene | One scale: instant 80, fast 150, base 200, slow 300, reveal 480ms. Curves: enter (0.16,1,0.3,1), exit (0.4,0,1,1), standard (0.2,0,0,1), spring. `--p-motion-*` and `--m-*` are aliases, and reduced motion zeroes the scale. `cubic-bezier(` now appears only in `src/styles`. JS constants mirror the scale. | fixed |
| CR-37 | medium | `ui/Button.module.css`, `Frame.module.css` | Button heights 24/28/32/36/40/44. | Design-system hygiene | Slim 28, medium 32 (40 on coarse pointers), large 44. 36px top-bar buttons map to medium. Slim also grows to 40 on touch so targets never shrink (WCAG 2.5.8). | fixed |
| CR-38 | medium | `globals.css`, nine components | Lucide icons used stroke 2 (kit uses 1.75) and sizes 14, 15, 16, 18, 20, 24 and 28. | Icon consistency | `:where(svg.lucide){stroke-width:1.75}` overrides the attribute (the checkbox tick opts out). Off-scale sizes normalised to 16/20 (24 in marketing features). The 67 direct imports are not migrated to `<Icon>`; the rule covers the stroke. | fixed |
| CR-44 | medium | `marketing.module.css`, `login.module.css` | A late footer pushed content (CLS 0.0896 on `/s/<bad>`). | CLS < 0.1 | `main` reserves `100dvh - header`, and the login surface fills it. | fixed |
| CR-46 | low | `motion.css`, `Spinner.module.css` | Spinner pulses under reduced motion. | WCAG 2.3.3 | Kept as an essential indicator (an opacity pulse, no movement); the exception is documented. | fixed (documented) |
| CR-49 | low | rate card, admin user, admin vendor, admin dispute | Detail pages reused the list title. | WCAG 2.4.2 | The entity comes first: "علبة بريدية، كرتون مضلع E كرافت · قوائم الأسعار · …", the user's name (never the phone number), the vendor name, "Dispute ELB-…". | fixed |
| CR-60 | medium | orders, catalogue, boxes, printers | No `loading.tsx`, so navigation showed nothing. | Skeletons, not spinners | Grid and row skeletons in the page rhythm (`src/components/skeletons`), announced once as busy. Each skeleton sits in a `(list)` route group so it covers only the list page (see R3-01). | fixed |
| CR-66 | low | `marketing.module.css` | Pill focus ring was the browser default, offset 1px, on a dark fill. | WCAG 2.4.7, 2.4.11 | 2px ring offset 2px: blue 6.11:1 on white, lime 15.8:1 on dark bands. | fixed |
| X-08 | low | `OtpForm.tsx` | Native `disabled` while busy dropped focus to `<body>`. | WCAG 2.4.3 | `aria-disabled` while busy, and the handlers ignore presses. Native `disabled` stays only before hydration and during the resend cooldown. | fixed |
| X-09 | low | `OtpForm.tsx` | The terms checkbox name included both links and two "(opens in a new tab)". | WCAG 2.4.6, 2.5.3 | The label is the sentence only; the links sit in a line below ("اقرأ شروط الخدمة وسياسة الخصوصية."). e2e `getByLabel(/I agree to the Terms/)` still matches. | fixed |
| B-19 | high | `src/lib/analytics`, seams, `/api/events` | None of the 17 launch-metric events was emitted; "price viewed" counted only checkout quotes, so the funnel showed paid orders above price views. | Business plan §1.3/§6.3; PDPL data minimisation | First-party `Event` table with one server `track()`; all 17 events fire from their real seams. Properties are stripped of phone, email, IP and address before writing. `/api/events` takes six client events (allowlist, zod, 2KB cap, CSRF check, 60/min). The admin "price viewed" now reads events. Funnel helpers are ready for the admin owner. | fixed (platform half) |
| B-23 | medium | `src/lib/jobs`, `/api/jobs/follow-up`, `npm run jobs:daily` | No 24-hour follow-up on a saved design with no order. | PDPL 151/2020 (marketing needs consent; opt-out in every message) | Daily job: at most one WhatsApp message per user, for a design saved 24h–7d ago with no order. It needs the latest MARKETING consent to be a grant, runs once per design even when runs overlap, and retries if a send fails. The sender is mocked, and the message ends with the opt-out. The same job runs the retention purges (OTP 24h, expired sessions, expired anonymous designs, events older than 13 months), which closes the round-1 "scheduled retention job" item. The route needs `CRON_SECRET` (constant-time check; 503 in production when unset). | fixed (mocked sender) |
| B-24 | low | `prisma/schema.prisma` | No attribution field for the Phase 3 designer referral loop. | Plan Phase 3 #31 | `Order.referrerId` reserved (nullable, indexed); nothing writes it yet. | logged (Phase 3) |
| R3-01 | high | `(store)/{catalog,boxes,vendors}`, `orders` (found while verifying CR-60) | A segment-level `loading.tsx` also wrapped the `[slug]` detail routes in Suspense. The 200 status was sent before `notFound()` ran, so unknown printers, boxes, catalogue pages and orders were soft 404s (HTTP 200 with noindex), including for Googlebot. | HTTP semantics; SEO | Each list page and its skeleton moved into a `(list)` route group; detail routes have no streaming boundary above them. | fixed |
| R3-02 | low | `[...missing]/page.tsx` | The 404 tab title was only set on the client; the server HTML carried the site tagline. | WCAG 2.4.2 | `generateMetadata` on the catch-all: "الصفحة غير موجودة · علبة", noindex. | fixed |
| R3-03 | low | `login.module.css` | On desktop the login page's grey surface stopped above the fold, leaving a white strip before the footer. | Visual quality | The surface fills the reserved `main` height. | fixed |

### Round 3: left open, and found for other owners

| id | severity | owner | finding | note |
|---|---|---|---|---|
| R3-04 | medium | catalogue | `/ar/catalog` on a 360px phone (Pixel 5 emulation) lays out 1,184px wide for its first ~100ms. The virtualised grid positions its cells for a desktop width until JavaScript measures them, which widens the mobile layout viewport (`catalogue.spec.ts:73` sees overflow 824 if it measures at `load`). Not caused by this round (the catalogue CSS change here was transitions only). | Render the server-side cells in a CSS grid, or start from a phone-width estimate. |
| R3-05 | medium | performance | Phone (Slow 4G + CPU throttling) LCP is still above budget: home 3.2–4.9 s, catalogue 3.4–3.9 s, printers 4.8–4.9 s, order tracking 3.3–4.1 s, admin orders 3.2–5.9 s. Desktop is 0.18–0.42 s and CLS ≤ 0.067 everywhere. That is down from the performance audit's 10.3 s (home) and 6.7 s (order tracking). First-load JS 188–229 KB, just over the 200 KB budget on most pages. | Performance owner; the dictionary split (R2-02) and the light chrome help, but the remaining cost is the shared runtime. |
| CR-05 (part) | medium | designer | The design picker (`/design`) still uses the designer's dark top bar because it shares a layout with the editor. | Split `/design` into `(picker)` and `(editor)` route groups so the picker gets the marketing chrome. |
| B-19 (part) | — | admin | The funnel helpers (`loadEventFunnel`, `loadShareLoop`, `priceViewedUsers` in `src/lib/analytics/funnel.ts`) are ready, but the dashboard still shows only the switched "price viewed" tile. | Admin owner wires the new tiles. Repeat rate and vendor acceptance come from Order and ProductionEvent rows. |
| B-23 (part) | — | ops / counsel | Whether the follow-up counts as marketing or as a service message needs counsel (gated on MARKETING consent for now). The WhatsApp Business transport, the cron schedule (`POST /api/jobs/follow-up` with `CRON_SECRET`) and a "STOP" reply handler are not set up. | Deployment. |
| R2-I-V24, R2-I-B27, P-31 | low | vendor, designer, storefront | Unchanged from round 2. | |

### Round 3 verification

- `npm run lint`, `npm run typecheck`, `npm test` (68 files, 8,195 tests, including 33 new analytics/job/route tests), `npm run build`: pass.
- Full Playwright suite (838 tests, `--workers=2`): 440 passed, 395 skipped by the specs, 3 failed. On re-run against the final build: `journey.spec.ts` passed (a load timeout); `catalogue.spec.ts:73` [mobile] fails at load as described in R3-04 (catalogue owner); `models.spec.ts` FEFCO_0428a #418 is the known 3D load flake (passes alone). Smoke, storefront, checkout, vendor, admin, designer and journey: 54 passed, 7 skipped, 1 failed (the R3-04 catalogue item).
- HTTP: `/ar/unknown` and `/en/unknown` return 404 with "الصفحة غير موجودة · علبة" / "Page not found · Elba"; `/en/vendors/nope`, `/en/catalog/nope`, `/en/boxes/nope` and `/ar/legal/nope` return 404 (they were 200 before R3-01); `/unknown` redirects 307 to `/ar/unknown`; list pages return 200.
- Browser (ar/en, 390 and 1440): no axe violations on login (phone, code, terms-error states), account, the privacy and cookies pages, home or admin privacy. The admin user-menu violation (R2-13) is gone with the 32/40px top-bar button. No horizontal overflow; CLS 0 on these pages.
- Screenshots: `docs/screenshots/audit/platform/r3-*`.

### Round 3 counts

Platform rows: 21 from ROUND3.md and 3 new (R3-01 to R3-03), all fixed. B-24 is logged as Phase 3, and CR-46 is documented as an exception. Also logged: 2 findings for other owners (R3-04 catalogue, R3-05 performance) and 3 partial hand-offs (design picker chrome, admin dashboard tiles, follow-up deployment).

### Files touched outside the listed scope (round 3)

Chrome and UI kit (`src/components/marketing/*`, `src/components/ui/*`, `src/styles/*`, `src/components/store/*` deletions, checkout shell), catalogue, designer and 3D CSS (motion tokens and icon sizes only), admin and vendor detail-page metadata (CR-49), admin queries and actions (B-19), designer `DesignerApp.tsx` and `server.ts` (event calls), `src/lib/orders/service.ts` (event calls), `prisma/schema.prisma` (Event, `Design.followedUpAt`, `Order.referrerId`), `package.json` (`jobs:daily`), `docs/ARCHITECTURE.md`, `docs/business/compliance-checklist.md` (row 2.9).

### Round 3: merge with the integration branch (5df9871)

Resolved 19 conflicts so both sides survive:
- **Deleted store chrome:** main had only changed import paths in StoreShell, SiteHeader, SiteFooter and CookieBar, which my side deleted. They stay deleted.
- **Cookie notice:** the single notice (`ui/CookieNotice`) now takes its acknowledgement from main's dependency-free `store/cookieAck.ts`. MarketingShell imports it directly rather than through the UI-kit barrel, and keeps main's `MarketingProviders` and its no-Suspense header. Both keep the kit's CSS out of marketing pages (R2-MK-01, CR-45).
- **Admin detail-page titles (CR-49):** I took the admin owner's version from main.
- **"Price viewed" in the funnel:** a user counts if any of three sources shows it: event log, saved quotes, orders.
- **Orders service (`service.ts`):** main's double-charge recovery and race-safe dispute creation are kept. My `payment_succeeded` and `dispute_opened` events fire after those succeed.
- **Dictionaries:** every key from both sides is kept, with the glossary applied to main's new admin strings. Main's new sample-credit text uses `{days:day}`.

After the merge:
- `npm run lint`, `npm run typecheck`, `npm test` (76 files, 8,271 tests) and `npm run build` pass.
- The smoke, storefront, checkout, admin and vendor e2e specs (`--workers=2`) gave 41 passed, 8 skipped and 1 failed per run. The failing test was different each run (vendor accept-job, smoke mobile sign-in, admin QC).
- Each failing test passes on its own against a fresh seed. They share seeded orders and phone numbers when two run in parallel.

### Round 3: merge of the admin integration (e4edb94)

The integrator asked for the result to also contain the admin session's merge (e4edb94). Resolution:
- **Taken from the admin side:**
  - `admin/server/queries.ts`, which wires the B-19 event funnel and share-loop tiles (the admin half of B-19). Price viewed now counts event-log users plus order buyers.
  - Its admin dictionary wording.
- **Kept from main:**
  - the admin owner's CR-49 titles with ID validation;
  - the marketing header without Suspense;
  - the no-break space in the checkout unit price.
- **Screenshots:** I kept main's canonical model screenshots. The admin branch had committed copies regenerated by e2e.
- **Cookie notice:** the auto-merged `ui/CookieNotice.tsx` had redeclared the acknowledgement helpers. It now re-exports them from `store/cookieAck.ts` only.

Results:
- `npm run lint`, `npm run typecheck`, `npm test` (76 files, 8,273 tests) and `npm run build` pass.
- The smoke, storefront, checkout, admin and vendor e2e specs (`--workers=2`) gave 41 passed, 8 skipped and 1 failed (smoke sign-in, desktop). The smoke spec passes 6/6 on its own.
- The likely cause of that failure is the per-IP limit of 20 code requests per hour (P-02): a parallel run signs in more than 20 times from 127.0.0.1. The suite would need a test-only allowance or a higher IP limit under `OTP_DEV_ECHO`.

## Round 4

Base: main at 781d663 (rounds 1–3 merged). Method: production build (`next start`, `OTP_DEV_ECHO=1`), Playwright at 390×844 and 1440×900 in ar and en, axe-core (WCAG 2.0/2.1/2.2 A+AA), keyboard-only sign-in, DB checks of the Event, Consent and DataRequest rows after each flow, plus a scripted sweep of every Arabic dictionary value (diacritics, tatweel, ASCII punctuation and quotes, glossary terms, imperative labels, bare numbers before counted nouns, Latin left in Arabic).

### Round 3 rows re-verified

Every platform row marked fixed in round 3 was rechecked in the browser: 14 pages × 2 locales × 2 widths (home, login, three legal pages, 404, account, orders, admin overview and privacy, vendor home, vendor apply, catalogue, printers). Results: 0 axe violations, 0 horizontal overflow, correct `lang`/`dir`, and the 404s return HTTP 404 with "الصفحة غير موجودة · علبة". The single cookie notice, the 150/200ms motion tokens, the 28/32/44 button heights and the X-08/X-09 OTP focus fixes all behave as described. The sign-up flow writes TERMS, PRIVACY and MARKETING consent rows and one `account_created` event; reloading the page does not send a second `visit`. Account export downloads `elba-data-<last 4>-<date>.json`, and the deletion request creates `DELETE:OPEN`. No row reopened.

Events (B-19), seam by seam: `payment_succeeded` fires only after the PAID transition commits (not on a lost race), `order_delivered` fires only on the won transition, `proof_approved` is skipped on reorders, and `order_started`/`price_viewed` are de-duplicated for 10 minutes per user and design or structure. `share_link_visit` skips the owner. `design_started` fires once per design (on the first POST). `design_completed` and `artwork_uploaded` fire once per designer session. Payloads hold only enums, codes, counts and pseudonymous ids; `sanitizeProps` drops phone, email and IP-shaped values. The one timing defect found is R4-06.

### Round 4 findings

| id | severity | page / file | finding | standard | fix | status |
|---|---|---|---|---|---|---|
| R4-01 | high | `legal/cookies` (`legal.cookies.*`), cookie notice (`store.cookie.message`), `legal.privacy` | The cookie notice said "we only use essential cookies" and the policy said "we do not use analytics". Since round 3 the site records first-party funnel events (13-month retention), writes an `elba_gate` cookie for 30 minutes and keeps a visit flag in browser storage. The notice was untrue. | PDPL 151/2020 transparency (notice must match processing) | The notice, the cookie page ("القياس الداخلي") and the privacy policy (data, purposes, retention) now describe the in-house measurement: what is stored, that it uses only pseudonymous ids, that it is never shared, the 13-month deletion, and `elba_visit` / `elba_gate`. `LEGAL_UPDATED` is 2026-11-06. | fixed |
| R4-02 | medium | `jobs/followUp.ts`, notify `DESIGN_FOLLOW_UP` | The WhatsApp follow-up's opt-out pointed to the account page, which needs an OTP sign-in, so stopping marketing took more effort than agreeing to it. | PDPL 151/2020 (withdrawal as easy as consent) | Signed one-click link `/{locale}/unsubscribe?u=<id>&t=<HMAC>` (`lib/auth/unsubscribe.ts`). Opening the link (GET) only shows a confirmation, so link scanners and chat previews change nothing. The button (POST server action) appends a MARKETING withdrawal row and sets `marketingConsent=false`; pressing it twice is harmless. Invalid and already-off states are handled. The page is noindex and sends no referrer, and the link carries no phone number. | fixed |
| R4-03 | medium | `jobs/followUp.ts` | A user with an open erasure (DELETE) request still received the marketing follow-up. | PDPL 151/2020 (objection / erasure stops processing) | The store flags `erasurePending` from OPEN/IN_PROGRESS DELETE requests; `selectFollowUps` skips these users with reason `erasure_pending`, and a unit test covers it. | fixed |
| R4-04 | medium | `auth.marketingConsent`, `account.marketingLabel` | The consent wording covered "offers and tips" only, but the processing it gates (B-23) is a reminder about a saved design. | PDPL 151/2020 (specific consent) | The wording now names the reminders ("والتذكير بتصميماتي المحفوظة"). `CONSENT_TEXT_VERSION` is bumped to 2026-11-06 so the log shows which wording each person agreed to. | fixed (see open: earlier grants) |
| R4-05 | medium | 19 Arabic values (checkout, buyer quote and sample, admin quotes, vendor pcs, store vendor and structure, pricing, designer badge) | Bare `{max}` / `{qty}` / `{pieces}` / `{hours}` / `{count}` placeholders sat before a fixed noun, giving wrong forms such as "3 علبة", "1 علب" and "5 ساعة". | Glossary: counted nouns | Switched to counted placeholders (`{n:box}`, `{n:piece}`, `{n:hour}`) in ar and en. RateCardForm's unit suffix gets its own key (`vendorPortal.common.pcsUnit`). A dictionary test now blocks bare placeholders before counted nouns. | fixed |
| R4-06 | medium | `analytics/client.ts`, `VisitBeacon.tsx` | `visit` used per-tab `sessionStorage`, so every new tab counted a new visit. That inflated the funnel's denominator. | launch-metrics.md §1 ("first page view in a session") | The last-seen time is kept in `localStorage` (timestamp only, no id), and a visit starts after 30 idle minutes. The beacon also refreshes on route changes. Verified: two tabs plus client-side navigation give 1 `visit`. A unit test covers `startsVisit`. | fixed |
| R4-07 | medium | `marketing.announcement.text`, `library.catalog.finishesHelp`, `finishes.SPOT_UV`, `marketing.*.spotUv*`, `equipment.UV_COATER` | Spot UV was transliterated as "اليو في" ("واليو في الموضعي"), which reads as nonsense in the site-wide announcement bar. | Copy: MSA, no English written in Arabic letters | Now "طلاء UV الموضعي" everywhere, matching the vendor portal. The announcement is noun-form ("جديد: معاينة ثلاثية الأبعاد للبصمة الحرارية وطلاء UV الموضعي والسلوفان المخملي."). A test blocks "يو في". | fixed |
| R4-08 | medium | `marketing.nav.start`, `hero.submit`, `cta.primary`, `boxes.primary`, `common.ctaDesign`, `designer.start.cta/title`, `store.*.designCta`, `designFree`, `catalog.design` | Buttons used imperatives ("ابدأ التصميم مجانا", "صمم مجانا", "صمم علبة مع هذه المطبعة"). | Glossary form rule: noun-form labels | "بدء التصميم مجانا", "التصميم مجانا", "تصميم علبة مع هذه المطبعة", "بدء التصميم", heading "تصميم علبتك ثلاثية الأبعاد مجانا". | fixed |
| R4-09 | low | `auth/OtpForm.tsx` | The marketing checkbox's label wrapped its hint, so the accessible name ran together ("…النصيةاختياري. تصلك…"). | WCAG 2.5.3, 4.1.2 | Label is the sentence only. The hint is linked with `aria-describedby`, the same pattern as the terms box (X-09). | fixed |
| R4-10 | low | 8 Arabic values | Tatweel used for prefixed particles ("بـ {days}", "لـ {qty}", "الـ27", "لـ{name}"). | Copy rules: no tatweel | Rephrased: "بفارق", "لكمية", "بالرقم 01", "(27 محافظة)", "بعد الطباعة: {name}". A test now blocks tatweel. | fixed |
| R4-11 | low | `checkout.errors.PREFLIGHT_BLOCKED`, `buyer.preflight.overrideRequired`, `account.deleteDesignBody` | ASCII double quotes inside Arabic text. | Arabic punctuation | Changed to «». A test now blocks ASCII quotes in Arabic text. | fixed |
| R4-12 | low | `vendor/apply/page.tsx` | Tab title read "… · علبة · علبة": the page added the brand and so did the layout template. | WCAG 2.4.2 | The page title drops its own suffix. | fixed |
| R4-13 | low | `admin.nav.quotes`, `admin.quotes.title`, `metricsLabel`, `admin.privacy.actions.start` | "طلبات التسعير" (glossary: عرض سعر), and a bare "بدء" button. | Glossary; noun-form labels | "طلبات عروض الأسعار", "بدء المعالجة". | fixed |
| R4-14 | low | `account.marketingHelp` | "يمكنك السحب في أي وقت" leaves out what is being withdrawn. | Copy clarity | "يمكنك سحب الموافقة في أي وقت من هنا أو من الرابط في أي رسالة." | fixed |

Checked and kept:
- ETA terms "كود النشاط" and "كود الصنف (EGS)": these are the Tax Authority portal's own labels, so they are a documented glossary exception.
- "البائع" where Elba is the seller of record: correct.
- "شكوى" only for the regulator: correct.
- The "يرجى" sweep hits were false positives ("رقم بطاقة").
- The bidi of the phone number in the OTP hint matches a `<bdi dir="ltr">` control.

### Round 4: left open

| id | owner | note |
|---|---|---|
| R4-04 (part) | counsel | Users who agreed to the older "offers and tips" wording are still messaged by B-23. Counsel should decide whether that consent covers design reminders, or whether the job should require `textVersion ≥ 2026-11-06`. That is a one-line filter in `marketingConsents`. |
| B-23 (part) | ops | Unchanged: the WhatsApp Business transport, the cron schedule and a "STOP" reply handler. The signed link now covers opt-out without them. |
| CR-43, R3-05 | counsel, performance | Unchanged from ROUND3.md. |

### Round 4 counts (new findings, before fixing)

critical 0 · high 1 · medium 7 · low 6. All 14 are fixed. No round 3 row reopened.

### Round 4 verification

- `npm run lint`, `npm run typecheck`, `npm test` (81 files, 8,307 tests, including new `unsubscribe.test.ts`, `visit.test.ts`, the erasure skip in `followUp.test.ts` and 5 copy-rule tests in `platform-i18n.test.ts`), `npm run build`: pass.
- e2e (`--workers=2`, against `next start`): smoke, storefront, checkout, admin, vendor: 42 passed, 8 skipped by the specs. Designer and journey: 11 passed, 1 skipped.
- Browser: the 56 page × locale × width combinations above have 0 axe violations and 0 overflow after the fixes. Unsubscribe page states (confirm, done, already off, invalid) in ar and en at 390 and 1440: 0 axe violations, noindex. The withdrawal row is written only on POST, and focus moves to the outcome heading.
- Screenshots: `docs/screenshots/audit/platform/r4-*`.

### Files touched outside the listed scope (round 4)

- `src/app/[locale]/vendor/apply/page.tsx`: title suffix (R4-12).
- `src/components/vendor/RateCardForm.tsx`: unit suffix key (R4-05).
- `src/lib/jobs/followUp.ts` and its test: stop link and erasure skip (B-23 is a platform item).
- `src/components/store/legal.ts`: `LEGAL_UPDATED`.
- New route `src/app/[locale]/(auth)/unsubscribe/*` (PDPL consent).

## Round 5

Base: main at 553e407 (round 4 merged), merged into this branch. Scope: the platform rows of `docs/audit/ROUND5.md` (R4-B-04, R4-B-08, R4-CR-09, the CR-38 remnant), then a fresh look at everything those fixes touch. Method as before: production build, Playwright at 390 and 1440 in ar and en, axe, DB checks after each flow, and direct HTTP probes of `/api/events` and the new webhook.

| id | severity | page / file | finding | standard | fix | status |
|---|---|---|---|---|---|---|
| R4-B-04 | medium | `api/events/route.ts` | Rotating the unsigned `elba_anon` cookie gave every request a fresh rate-limit key, so a script could add unlimited `visit`s and inflate the other browser events. | Plan §6.3, §10 gates (data integrity) | Limits also key on what a script cannot rotate for free (the IP comes from `clientIp`, which already trusts only proxy-added hops). The caps:<br>- **All events:** 120 per minute per IP, on top of the per-browser 60.<br>- **`visit`:** one per browser fingerprint (SHA-256 of IP + User-Agent, held in memory, never stored) per 30 minutes, and at most 30 per IP per 30 minutes (for shared NAT).<br>- **Other browser events:** 30 per name per IP per 10 minutes.<br>Over a cap the event is dropped silently (204).<br>Verified against `next start`: 25 visits with 25 rotated cookies record 1 visit. Unit tests: 90 rotated cookies give 1 visit; 40 user agents behind one IP give 30; 50 rotated `artwork_uploaded` give 30; 130 rotated `gate_shown` give 10 × 429. | fixed |
| R4-B-08 (a) | medium | `jobs/followUp.ts` | An untitled design produced 'your design “”'. | Copy quality | `designLabel()`: the design's name, else the library model name, else the box style ("علبة بريدية" / "Mailer box"), never empty. | fixed |
| R4-B-08 (b) | medium | `api/webhooks/whatsapp`, `lib/notify/whatsapp-inbound.ts`, `lib/auth/marketing-consent.ts`, notify `DESIGN_FOLLOW_UP` | There was no reply-STOP opt-out. | PDPL 151/2020; WhatsApp Business messaging policy | **Message:** now ends "لإيقاف هذه الرسائل أرسل «إيقاف» أو افتح: {stop}" / "reply STOP or open: {stop}".<br>**Webhook** (Cloud API format): the GET handshake checks `WHATSAPP_VERIFY_TOKEN`. A POST needs a valid `X-Hub-Signature-256` for `WHATSAPP_APP_SECRET`: without one it answers 401, and with no secret configured 503.<br>**Matching:** STOP, UNSUBSCRIBE, إيقاف, ايقاف, إلغاء الاشتراك, توقف, … with alef forms, diacritics and punctuation folded. Only a short message that is the keyword counts, so "لا" and "please stop by" do not.<br>**Withdrawal:** goes through the shared `withdrawMarketingConsent()` (consent log row and flag), which the one-click link now uses too.<br>Verified on `next start`: unsigned → 401 with the consent unchanged; signed "إيقاف" → 200 and the consent off; the handshake echoes the challenge. | fixed (Meta app setup is ops) |
| R4-B-08 (c) | medium | `jobs/followUp.ts` | Designs with an open price request were still nudged to "order printing here". | Business: no nudge while the team is pricing | The store flags designs that have a non-instant, non-expired Quote (price request, or a later admin offer) from the last 30 days. They are skipped with reason `price_requested`. | fixed |
| R4-CR-09 | medium | `marketing/AnnouncementBar.tsx`, `MarketingHeader.tsx`, new `StartLink.tsx` | The promo bar and "Start designing free" sat above the account, orders, order tracking and invoice pages. At 390 ar the bar took 3 lines and split its link. | Hierarchy; Polaris (no promo in task flows) | **Transactional routes:** the bar is never rendered on account, orders (including invoice and tracking), sign-in or unsubscribe. The path is known on the server, so there is no flash.<br>**Dismissal:** lasts 30 days via a functional cookie. An inline script hides the bar before paint (CLS 0 after dismissing).<br>**Phones:** at 480 px and below a short text ("جديد: معاينة البصمة والسلوفان ثلاثية الأبعاد."), with `white-space: nowrap` on the link. At 390 it is 2 lines and the link is whole.<br>**Signed in:** the header CTA reads "تصميم جديد" / "New design". | fixed |
| CR-38 (remnant) | low | `HeaderNav`, `AccountLink`, `LangLink`, `MarketingFooter`, `CheckoutShell`, `DesignStart`, `AnnouncementBar` | The craft report saw `stroke-width="2"` on chrome icons. The global rule already rendered them at 1.75; the report read the DOM attribute, not the computed style. Sizes were off-scale: menu and close 24, checkout lock 14. | Icon consistency | `strokeWidth={1.75}` is set explicitly, so the attribute matches. Menu and close are now 20, the lock 16. Measured computed values in the chrome: only `1.75px` at 16 and 20. | fixed |
| R5-01 | low | `legal.cookies.sections.essential` | The cookie page did not list `elba_cookie_ack` (exists since round 2) or the new `elba_announce`. | PDPL 151/2020 transparency | Both are listed, with their lifetimes, in ar and en. | fixed |

Also: `.env.example` documents `WHATSAPP_APP_SECRET` and `WHATSAPP_VERIFY_TOKEN`.

### Round 5: left open

| id | owner | note |
|---|---|---|
| R4-B-04 (part) | designer / ops | `elba_anon` is still unsigned. Signing it (HMAC, as the brief suggests) changes the value format read by the designer server, `verify-otp` and share pages, which is outside platform scope. Event counts no longer depend on it. The in-memory limiter is per process: a multi-instance deployment needs a shared store (Redis), as `rate-limit.ts` already notes. |
| R4-B-08 (part) | ops | Register the webhook URL and the two secrets in the Meta app. Optional: send a "you will not get these messages" confirmation reply. Not done: skipping designs whose share-fork copy was ordered. Forks keep no link to the original, so this would need a schema field (designer). |
| R4-04 (part) | counsel | Unchanged from round 4: older marketing grants. |

### Round 5 counts (new findings, before fixing)

critical 0 · high 0 · medium 0 · low 1 (R5-01). The four ROUND5.md rows (4 medium, 1 low remnant) are fixed. Under the brief's rule ("stop when a round finds nothing of medium or worse") the platform area is done.

### Round 5 verification

- `npm run lint`, `npm run typecheck`, `npm test` (83 files, 8,390 tests; new: `whatsapp-inbound.test.ts`, cookie-rotation and per-IP cases in `routes.test.ts`, the label, price-request and STOP-text cases in `followUp.test.ts`), `npm run build`: pass.
- e2e (`--workers=2`, `next start`): smoke, storefront, checkout, designer, journey, admin, vendor: 58 passed, 12 skipped by the specs.
- Browser checks:
  - Signed-in account, orders and order tracking: no bar, CTA "تصميم جديد".
  - Home: visitor sees the bar and "بدء التصميم مجانا".
  - Dismissal: catalogue without the bar, CLS 0, and the cookie lasts 30 days.
  - axe: 0 violations on signed-in home.
- Screenshots: `docs/screenshots/audit/platform/r5-*`.

### Files touched outside the listed scope (round 5)

- `src/lib/jobs/followUp.ts` and its test.
- `src/app/[locale]/(checkout)/_components/CheckoutShell.tsx` and `src/components/designer/DesignStart.tsx`: icon stroke only.
- `src/app/api/events/route.ts` (the analytics endpoint).
- New `src/app/api/webhooks/whatsapp/route.ts`.
- `src/lib/notify/whatsapp-inbound.ts`.
- `.env.example`.

### Round 5 (b): performance follow-ups (R4-08, R4-09 from `performance.md` round 4)

Base: main at aa2c78f, fast-forwarded. **The performance branch (`…-r4-performance`, 699a954) was not merged.** It conflicts with main in five designer and share files (`StartViewer.tsx`, `DesignStart.tsx`, `DesignerApp.tsx`, `design/(editor)/[structure]/page.tsx`, `s/[id]/page.tsx`). Both sides rewrote the LCP poster: main's round 5 `/models/<code>.webp` poster layer, and the branch's inline `modelPosterSrc()` posters. Picking a side decides another owner's design, so the integrator should merge it with the designer and performance owners. Neither fix below depends on `experimental.inlineCss`.

Measurement: a production build (`next start`), signed in as admin where needed. For each route I summed the stylesheets the HTML links (raw / gzip) and searched the HTML for references to the marketing CSS chunk (the one that contains `.bandMint`). The script was `css.cjs`, kept out of the repo.

| id | severity | page / file | finding | standard | fix | status |
|---|---|---|---|---|---|---|
| R4-09 | medium | `src/app/[locale]/not-found.tsx` | The locale-level 404 imported `marketing.module.css` (64 KB raw). Next embeds every layout's not-found element in each page's RSC payload, so every admin, vendor, checkout and editor page referenced the marketing chunk (1 reference each; with `inlineCss` the whole sheet is inlined). | Performance budget (non-3D CSS/JS) | The locale 404 has its own 2 KB `not-found.module.css` and a small `NotFoundBody` client component: same look, copy, `<main id="main">` and title. The marketing `NotFoundState` stays for the marketing 404s. Before/after: references from `/ar/admin`, `/ar/admin/orders` and `/ar/vendor` to the marketing chunk went from 1 to 0, and the linked CSS is unchanged. The page still answers 404 with "الصفحة غير موجودة · علبة". axe shows 0 violations and there is no overflow at 390 ar and 1440 en. | fixed |
| R4-08 | medium | `components/ui` barrel, `next.config.ts` | Every route that imports one kit component gets every kit stylesheet, because the barrel re-exports 45 modules and their CSS imports count as side effects. | Performance budget | **Tried:** marking `src/components/ui/*.tsx` side-effect free (a webpack rule) so unused re-exports and their CSS are dropped. **Measured (gzip CSS linked per route, before → after):** catalogue 42.7 → 30.7 (−12.0), home and legal 21.9 → 24.6 (+2.7), admin and vendor 33.3 → 38.9 / 37.3 (+5.6 / +4.0), editor 49.7 → 56.4 (+6.7), account 50.5 → 50.9, orders 44.9 → 51.0. Under `cssChunking: "strict"` the pruned graph splits into more chunks that repeat the same rules, so 7 of 9 routes got heavier. **Reverted.** Splitting `Misc.module.css` alone changes nothing while the barrel imports every module. The fix that works is per-area: route-level code (admin `*Index.tsx`, vendor portal, designer panels) imports kit components from their files (`@/components/ui/Button`), as MarketingShell already does for `CookieNotice` (R2-MK-01). That touches about 100 files across admin, vendor and designer. | open: per-area import migration (owners admin, vendor, designer); the RSC duplication itself is Next's `inlineCss` behaviour |
| R5-02 | low | `common.notFoundBody` | The 404 body repeated the heading ("الصفحة التي تبحث عنها غير موجودة."). | Copy | "ربما تغير الرابط أو لم تعد الصفحة متاحة. ابدأ من الصفحة الرئيسية أو تصفح أنواع العلب." (en to match). | fixed |

Counts (new findings this pass, before fixing): critical 0 · high 0 · medium 0 · low 1 (R5-02). Of the two assigned rows, R4-09 is fixed and R4-08 is measured and handed to the area owners.

Verification: `npm run lint`, `npm run typecheck`, `npm test` (85 files, 8,419 tests) and `npm run build` pass. e2e (`--workers=2`) for smoke, storefront, admin, vendor, designer and checkout: 58 passed, 12 skipped by the specs. Screenshots: `docs/screenshots/audit/platform/r5b-*`.

Files outside the listed scope: none. `next.config.ts` was changed for the experiment and restored.

### Round 5 (c): barrel imports (R4-08), locale 404 (R4-09), fresh shell pass

Base: `4c11648` (main with rounds 1 to 4 merged). Production build (`next build && next start`, `OTP_DEV_ECHO=1`), Playwright at 390 and 1440 in ar and en. Other sessions are editing checkout, admin, designer and 3D files, so in their files **only import lines changed**.

**R4-08: fixed.**
- **Codemod:** `scripts/codemods/debarrel-ui.mjs` reads the barrel's export map (`src/components/ui/index.ts`) and turns each `import { … } from "@/components/ui"` into one import per kit file. Type-only specifiers are kept, and every other byte of the file is untouched.
- **Scope:** it rewrote 89 files: `components/admin` 23, admin routes 11, `components/vendor` 10, vendor portal and apply 11, `components/designer` 10, editor routes 2, checkout 9, orders 7, account 3, dev 3.
- **Lint rule:** `no-restricted-imports` in `eslint.config.mjs` rejects `@/components/ui` and `@/components/ui/index` anywhere in `src/` outside the kit. The error message names the codemod.
- **Check:** `node scripts/codemods/debarrel-ui.mjs --check` exits 1 if a barrel import is left.

**R4-09: re-verified fixed** (round 5 b gave the locale 404 its own 2 KB sheet).
- `docs/audit/tools/notfound-check.mjs` opens all 15 not-found boundaries: root, `[...missing]`, store, box style, catalogue, printers, legal, editor, share, order, and 5 admin. It runs each in ar and en at 390 and 1440, 58 runs in all.
- Every run is styled (tokens loaded, brand font, h1 ≥ 18 px), has one `<main>`, no overflow and no console errors.
- Every one answers 404 except the streamed pages (R5-PL-03).
- The locale 404 sheet appears exactly twice per page (`<style>` and RSC copy, about 2 KB). Admin, editor and checkout pages carry no marketing CSS (`marketing_bandMint` is not in the HTML).
- Screenshots: `docs/screenshots/audit/platform/r5c/404-*`.

**Bytes before → after.** Measured with `perf-pages.mjs`, phone profile, `ISOLATE=1`, 18 routes × 2 locales. The harness now records inline `<style>` bytes and the RSC payload (`self.__next_f`), both UTF-8 and uncompressed. Raw data: `docs/audit/perf-data/r5-platform/pages-{before,after}-phone.json`.

| Route | Inline CSS ar (KB) | RSC payload ar (KB) | HTML on the wire ar (KB gz) | Inline CSS en (KB) | RSC payload en (KB) | Phone LCP ar (s) |
|---|---|---|---|---|---|---|
| home | 108 → **111** (+3) | 286 → **282** (-4) | 102 → **103** | 108 → **111** | 255 → **251** | 2.68 → 1.52 |
| boxes | 108 → **111** (+3) | 270 → **266** (-4) | 90 → **91** | 108 → **111** | 240 → **236** | 1.46 → 1.47 |
| bottles | 108 → **111** (+3) | 237 → **233** (-4) | 83 → **84** | 108 → **111** | 211 → **207** | 1.56 → 1.56 |
| catalog | 127 → **134** (+8) | 480 → **481** (+1) | 126 → **129** | 127 → **134** | 453 → **454** | 2.09 → 2.18 |
| vendors | 108 → **111** (+3) | 267 → **263** (-4) | 105 → **103** | 108 → **111** | 239 → **235** | 1.54 → 1.41 |
| design-picker | 200 → **194** (-6) | 484 → **472** (-12) | 161 → **160** | 200 → **194** | 458 → **445** | 2.65 → 2.81 |
| designer-box | 189 → **159** (-29) | 321 → **289** (-32) | 123 → **113** | 189 → **159** | 296 → **263** | 1.43 → 1.36 |
| designer-bottle | 189 → **159** (-29) | 324 → **292** (-32) | 124 → **115** | 189 → **159** | 299 → **267** | 1.45 → 1.34 |
| designer-pouch | 189 → **159** (-29) | 321 → **289** (-32) | 123 → **113** | 189 → **159** | 296 → **263** | 1.41 → 1.34 |
| designer-fefco09 | 189 → **159** (-29) | 321 → **289** (-32) | 123 → **113** | 189 → **159** | 295 → **263** | 1.40 → 1.31 |
| share | 164 → **175** (+11) | 328 → **315** (-13) | 145 → **146** | 164 → **175** | 301 → **288** | 1.94 → 2.35 |
| checkout | 134 → **116** (-18) | 269 → **302** (+33) | 106 → **114** | 134 → **116** | 243 → **277** | 2.00 → 2.04 |
| order-tracking | 204 → **210** (+6) | 439 → **380** (-59) | 163 → **150** | 204 → **210** | 411 → **353** | 2.15 → 2.21 |
| account | 236 → **214** (-22) | 470 → **380** (-90) | 174 → **148** | 236 → **214** | 443 → **353** | 2.09 → 2.12 |
| vendor-portal | 146 → **130** (-16) | 376 → **352** (-24) | 135 → **129** | 146 → **130** | 321 → **297** | 1.91 → 1.18 |
| vendor-jobs | 146 → **146** (-0) | 360 → **353** (-7) | 128 → **130** | 146 → **146** | 306 → **299** | 1.16 → 1.10 |
| admin | 146 → **124** (-23) | 395 → **386** (-8) | 144 → **141** | 146 → **124** | 338 → **330** | 2.43 → 2.14 |
| admin-orders | 146 → **132** (-15) | 361 → **361** (-0) | 131 → **132** | 146 → **132** | 307 → **307** | 4.63 → 1.13 |

Across the 18 Arabic routes:
- inline CSS fell by **181 KB** in total;
- the RSC payload fell by **324 KB**;
- gzip HTML fell by **74 KB**.

By route:
- **Editor:** −29 KB CSS and −32 KB RSC on each of the four routes.
- **Account:** −22 / −90 KB.
- **Order tracking:** −59 KB RSC.
- **Admin and vendor:** −15 to −23 KB CSS.
- **Marketing routes:** +3 KB CSS (the new locale error boundary's segment), −4 KB RSC (R5-PL-06).

Two routes went up:
- **Checkout** gained 33 KB of RSC even though its CSS fell 18 KB. Without the barrel, its page, loading and error segments each inline their own small chunks (R5-PL-07).
- **Share** gained 11 KB of CSS for the same reason.

LCP is reported for context only. Both runs passed the budget except `design-picker` (R4-15, designer). The after run shared the CPU with lint and unit tests, so ±0.3 s is noise.

| id | severity | page / file | finding | standard | fix | status |
|---|---|---|---|---|---|---|
| R4-08 | medium | 89 files in admin, vendor, designer, checkout, orders, account | Barrel imports pulled every kit stylesheet into the route. With `inlineCss` that CSS lands twice: in `<head>` and in the RSC payload. | Performance budget | Codemod + lint rule (above). | fixed |
| R4-09 | medium | `[locale]/not-found.tsx` | Re-verified in the browser (above). | Performance budget | (round 5 b) | fixed, verified |
| R5-PL-01 | high | `src/app/[locale]/error.tsx` (new), `src/app/global-error.tsx` (new) | There was no locale-level error boundary and no `global-error`. An exception on sign-in, unsubscribe, share, legal or dev pages, or in any area layout, showed Next's unstyled English "Application error" with no way back. Arabic users got English. | WCAG 3.1.1, 3.3.1; ISO 9241-110 (error tolerance) | **Locale boundary:** one `<main>`, a `role="alert"` h1, a retry button that calls `reset()`, and a home link that keeps the locale. It reuses the locale 404 sheet, so it costs no new CSS.<br>**`global-error`:** bilingual, `lang`/`dir` per part, a title, noindex. Its links are plain `<a>` so they force a full reload.<br>The error message is never shown. Unit test: `src/app/__tests__/error-boundaries.test.tsx`. | fixed |
| R5-PL-02 | low | `src/app/not-found.tsx` | The root 404 still repeated its heading in the body. Round 5 b fixed only the locale copy. | Copy | Same wording as `common.notFoundBody` (ar/en). | fixed |
| R5-PL-03 | low | admin detail `not-found.tsx` (5), `orders/[id]`, `s/[id]` | These "not found" states answer **HTTP 200**: the segment's `loading.tsx` starts streaming before `notFound()` runs. `AdminNotFound`'s comment says "a real HTTP 404". The page itself is styled and correct, and noindex. | HTTP semantics; SEO for share links | Owners (admin, orders, designer): validate the id above the Suspense boundary (in the layout, as `design/(editor)` does with `x-elba-path`) or drop `loading.tsx` for detail pages. Not done here: only import lines may change in those files. `notfound-check.mjs` lists them as SOFT. | open (owners) |
| R5-PL-04 | medium | `src/app/global-error.tsx` (pass 1 of this round) | My first `global-error` imported `globals.css` and `next/font`. Next keeps the global error boundary in every page's tree and embeds its CSS in each RSC payload, so every page gained ~30 KB. Pass 2 caught it with the measurement. It was never merged, but I count it. | Performance budget | Self-contained: system font stack and literal colours, no CSS or font import. A unit test blocks either import. Home RSC went from 320 to 282 KB. | fixed |
| R5-PL-05 | medium | `components/ui/Misc.module.css` | One 18 KB sheet held 11 components (EmptyState, Skeleton, Thumbnail, ProgressBar, Tooltip, DropZone, Link, PriceTag, Stepper, Timeline, MetricsStrip). Every segment that rendered any one of them inlined all of it: `/vendor/apply` carried it 3 times, 53 KB. | Performance budget | Split into one `<Component>.module.css` per component. The sections were already self-contained (checked: no shared selectors; dynamic `size-`/`tone-` classes stay with their component). `Misc.module.css` is deleted. | fixed |
| R5-PL-06 | medium | `src/app/layout.tsx`, `src/app/not-found.tsx`, `[locale]/layout.tsx` | Every page inlined the `@font-face` CSS twice (9 KB raw): the root 404 and the locale layout import the fonts from different segments, and Next inlines CSS once per segment. | Performance budget | `import "@/app/fonts"` in the root layout, so the CSS belongs to the root segment and both users share it. Verified: 0 duplicated text rows on `/ar`, and Inter + Plex Arabic 400–700 still load on `/ar`, `/en/admin` and the root 404. | fixed |
| R5-PL-07 | medium | checkout, account, admin orders (Next `inlineCss` behaviour) | With `inlineCss` the RSC payload inlines a chunk again for each segment that uses it (page, `loading.tsx`, `error.tsx`). Measured duplicates: checkout **61 KB** (`checkout.module.css` chunk ×3, the OTP/login chunk ×2), account **29 KB**, admin orders 7 KB, vendor 0. A parent segment's chunk is not repeated (R5-PL-06 relies on that). | Performance budget | Owners: import the CSS that the area's page, loading and error share in the area layout (checkout: `checkout.module.css`, Card, Page, Stack), so it belongs to the ancestor. Out of scope (import-only rule), measured for them. | open (checkout, account owners) |
| R5-PL-08 | medium | `[locale]/layout.tsx` (`clientDictionary`) | Every page serialises the whole public dictionary into the RSC payload: **90 KB raw ar / 64 KB en** after R4-11. The largest namespaces are designer 15.5, store 15.1, marketing 12.6, checkout 7.8, orders 7.5 and buyer 5.6 KB. Marketing pages need about a third of it. | Performance budget | Per-area namespaces: the locale layout passes a core set (common, nav, meta, auth, store, marketing), and area layouts (designer, checkout, orders, account) wrap their subtree in a provider that adds theirs. This touches every area layout and needs a missing-key test per area, so it is left for the integrator with the measurement. | open (platform + area owners) |
| R5-PL-09 | low | `admin/AdminFrame.tsx`, `vendor/VendorFrame.tsx` | The language switch in the user menu drops the query string (a filtered `/admin/orders?status=…` loses its filter). Its label ("English" in the Arabic UI) has no `lang`, so a screen reader pronounces it with the Arabic voice. The marketing and checkout `LangLink` does both. | WCAG 3.1.2 | Reuse `LangLink`'s href and `lang` logic in the two frames. | open (admin, vendor owners) |
| R5-PL-10 | low | strict CSS chunking | Marketing pages inline a 4.7 KB chunk that starts with `CheckoutShell` CSS. `cssChunking: "strict"` grouped it with modules that the shell does use. | Performance budget | Accepted: changing chunking was measured worse in round 4 (performance R4.3). | accepted |

**Fresh shell pass (`docs/audit/tools/platform-shell.cjs`).** 12 routes (home, catalogue, boxes, printers, legal, sign-in, design picker, vendor apply, account, orders, admin, vendor) were each run in ar and en at 390 and 1440, with `prefers-reduced-motion: reduce`. Results:
- **axe** (WCAG 2.0 to 2.2 A/AA): 0 violations.
- **Layout:** no overflow, correct `lang`/`dir`, one `<main>` and one `h1`.
- **Skip link:** the first Tab lands on it and Enter moves focus into `<main>`.
- **Motion:** no infinite animation runs under reduced motion.
- **Console:** no errors.
- **Language switch:** `/ar/catalog?family=boxes` goes to `/en/catalog?family=boxes` with `lang=en dir=ltr`, and `elba_locale=en` is set.
- **Motion tokens:** every transition in the shell uses the 80/150/200/300 ms tokens. The literal values left are loop periods or designer-owned (`library.module.css`).
- **Loading states:** every `loading.tsx` is a skeleton with `aria-busy` and a `role="status"` label (in `SkeletonPage`).

Screenshots: `docs/screenshots/audit/platform/r5c/shell-*`.

### Round 5 (c) counts (new findings, before fixing)

critical 0 · high 1 (R5-PL-01) · medium 5 (R5-PL-04 to R5-PL-08) · low 4 (R5-PL-02, 03, 09, 10). Of these, 5 are fixed (01, 02, 04, 05, 06), 4 are open for other owners or the integrator (03, 07, 08, 09) and 1 is accepted (10). R4-08 is fixed and R4-09 re-verified. Medium findings were found this round, so the rounds continue: R5-PL-07 and R5-PL-08 are the next byte wins.

### Round 5 (c) verification

- `npm run lint` clean, including the new rule; a probe file with a barrel import fails it.
- `npm run typecheck` clean.
- `npm test`: 93 files, 8,505 tests (new: `error-boundaries.test.tsx`).
- `npm run build` clean.
- e2e (`--workers=2`, `next start`):
  - smoke + storefront + designer: **32 passed**;
  - checkout + admin + vendor: **30 passed, 12 skipped by project**.
- `notfound-check.mjs`: 58 / 58 OK.

### Files touched outside the listed scope (round 5 c)

- **Import lines only** (codemod): 89 files under `src/components/{admin,vendor,designer,store}` and `src/app/[locale]/{admin,vendor,(checkout),orders,(store)/account,design,dev}`. Nothing else changed in them.
- `src/components/ui/*`: the `Misc.module.css` split (11 new sheets, one import line in each component).
- `eslint.config.mjs`; `docs/audit/tools/perf-pages.mjs` (new metrics, plus an `account` route).

### Round 5 (d): fresh pass after merging main `fd40cef`

Base: main `fd40cef`, which includes 530c6af plus the designer crop and brand-colour dialogs, admin Send price, checkout dispute photos and the copy round. The merge was clean, and `debarrel-ui.mjs --check` reports **no barrel imports** (the designer's new dialogs already use direct imports).

**Bytes, 530c6af → merged** (`perf-pages.mjs`, phone, `ISOLATE=1`; data: `perf-data/r5-platform/pages-merged-fd40cef-phone.json`):

| Route | Inline CSS ar (KB) | RSC payload ar (KB) | HTML gz ar (KB) | Inline CSS en (KB) | RSC en (KB) | Phone LCP ar (s) |
|---|---|---|---|---|---|---|
| home | 111 → **111** (-0) | 282 → **292** (+9) | 103 → **105** | 111 → **111** | 251 → **258** | 1.52 → 1.61 |
| boxes | 111 → **111** (-0) | 266 → **275** (+9) | 91 → **93** | 111 → **111** | 236 → **243** | 1.47 → 1.40 |
| bottles | 111 → **111** (-0) | 233 → **243** (+9) | 84 → **86** | 111 → **111** | 207 → **213** | 1.56 → 1.54 |
| catalog | 134 → **137** (+2) | 481 → **493** (+12) | 129 → **132** | 134 → **137** | 454 → **463** | 2.18 → 2.12 |
| vendors | 111 → **111** (-0) | 263 → **272** (+9) | 103 → **108** | 111 → **111** | 235 → **241** | 1.41 → 1.45 |
| design-picker | 194 → **200** (+5) | 472 → **476** (+4) | 160 → **162** | 194 → **200** | 445 → **447** | 2.81 → 1.29 |
| designer-box | 159 → **161** (+2) | 289 → **300** (+11) | 113 → **115** | 159 → **161** | 263 → **272** | 1.36 → 1.32 |
| designer-bottle | 159 → **161** (+2) | 292 → **303** (+11) | 115 → **117** | 159 → **161** | 267 → **275** | 1.34 → 1.36 |
| designer-pouch | 159 → **161** (+2) | 289 → **300** (+11) | 113 → **115** | 159 → **161** | 263 → **272** | 1.34 → 1.32 |
| designer-fefco09 | 159 → **161** (+2) | 289 → **300** (+11) | 113 → **115** | 159 → **161** | 263 → **272** | 1.31 → 1.31 |
| share | 175 → **177** (+3) | 315 → **359** (+44) | 146 → **158** | 175 → **177** | 288 → **329** | 2.35 → 2.35 |
| checkout | 116 → **119** (+3) | 302 → **317** (+15) | 114 → **118** | 116 → **119** | 277 → **289** | 2.04 → 2.06 |
| order-tracking | 210 → **216** (+5) | 380 → **427** (+47) | 150 → **164** | 210 → **216** | 353 → **397** | 2.21 → 2.08 |
| account | 214 → **218** (+3) | 380 → **394** (+14) | 148 → **152** | 214 → **218** | 353 → **364** | 2.12 → 2.12 |
| vendor-portal | 130 → **133** (+3) | 352 → **373** (+21) | 129 → **135** | 130 → **133** | 297 → **313** | 1.18 → 1.12 |
| vendor-jobs | 146 → **152** (+6) | 353 → **376** (+23) | 130 → **136** | 146 → **152** | 299 → **317** | 1.10 → 1.10 |
| admin | 124 → **141** (+17) | 386 → **418** (+32) | 141 → **150** | 124 → **141** | 330 → **356** | 2.14 → 1.20 |
| admin-orders | 132 → **137** (+5) | 361 → **383** (+22) | 132 → **138** | 132 → **137** | 307 → **323** | 1.13 → 1.05 |

Where the growth comes from (the RSC rows broken down per route):
- **+9 KB on every route** is the client dictionary: 90 → **99.7 KB** raw (ar) after the copy round (R5-PL-08, still open).
- **share** (+44 KB) and **order tracking** (+47 KB): the new `s/not-found.tsx` and `orders/not-found.tsx` use `Page`/`Card`/`EmptyState`. That adds one more segment, which inlines its chunks again: share duplicates 30 KB, order tracking 61 KB, checkout 64 KB (R5-PL-07, plus R5-PL-11).
- **admin** (+17 KB CSS): the dashboard's new chart styles, which are admin-owned growth.

Phone LCP stays within budget on every route. The design picker is now **1.29 s**, down from 2.81 s.

**Not-found pages:** 58 / 58 OK, styled and with no console errors. **Share and order 404s now answer HTTP 404**: the owners moved the guard into `s/[id]/layout.tsx` and `orders/[id]/layout.tsx`, closing that half of R5-PL-03. The five admin detail 404s still answer 200.

**App shell:** 16 routes × ar/en × 320/390/1440, 96 runs. The routes now include admin quotes, admin disputes, checkout and share. Results: 0 axe violations, no overflow, skip link and `lang`/`dir` correct, no infinite animations under reduced motion, no console errors. The language switch keeps path and query.

The cookie notice is about 140 px tall at 320 × 568. A Tab walk on share, home, catalogue and privacy found **no focused element fully hidden** behind it (WCAG 2.4.11 pass).

| id | severity | page / file | finding | standard | fix | status |
|---|---|---|---|---|---|---|
| R5-PL-11 | medium | `next.config.ts` (`cssChunking: "strict"`) | Strict chunking merged `ui/EmptyState.module.css` into the same chunk as `checkout.module.css` (12.4 KB, `dcff75ac…`). Every page that renders an empty state (orders, both new 404s, admin empty lists) inlines the checkout stylesheet, once per segment. The same mechanism puts `CheckoutShell` CSS on marketing pages (R5-PL-10). | Performance budget | **Measured** `cssChunking: false` on a separate build (not shipped), RSC change per route: `/ar` −17 KB, share −57 KB, catalogue −23 KB, editor +10 KB, vendor apply +116 KB. It is mixed, and cross-module order guarantees are lost. **Left for the performance owner:** either find what pins `EmptyState` next to `checkout.module.css` in import order, or try `cssChunking: true`. | open (performance) |
| R5-PL-12 | low | `ui/Frame.module.css` (`.SearchInput`) | At 320 px the admin and vendor top-bar search placeholder was cut mid-word ("البحث في الطل"). | Craft; WCAG 1.4.10 (reflow, content not lost) | `text-overflow: ellipsis` on the input and its placeholder. It now reads "البحث في ال…" (screenshot `r5d/shell320-admin-quotes-ar-after.png`). | fixed |
| R5-PL-13 | medium | `components/admin/DisputeDecision.tsx` (found by `e2e/admin.spec.ts:239`) | After applying a reprint decision, the "Reprint ELB-… created" success banner never appears: it sits inside the decision form, which is gone once the dispute resolves. The page shows only the "Reprinted" status, so the admin never sees the new order number. The test fails 2 of 2 times on `fd40cef`; my diff against it is one CSS rule. | WCAG 4.1.3 (status messages); ISO 9241-110 (feedback) | Admin owner: render the reprint banner outside the decision form (or from the resolved state with the reprint number). | open (admin) |

Re-reported, not new: R5-PL-08 grew (dictionary 99.7 KB). R5-PL-07 now also covers share and order tracking. R5-PL-03 is down to the admin detail pages.

### Round 5 (d) counts (new findings, before fixing)

critical 0 · high 0 · medium 2 (R5-PL-11, R5-PL-13) · low 1 (R5-PL-12). Fixed: R5-PL-12. Open: R5-PL-11 (performance) and R5-PL-13 (admin). Medium findings were found, so the rounds continue.

### Round 5 (d) verification (merged code + R5-PL-12)

- `npm run lint` clean and `npm run typecheck` clean.
- `debarrel-ui.mjs --check`: no barrel imports.
- `npm test`: 107 files, 8,752 passed.
- `npm run build` clean.
- e2e (`--workers=2`):
  - smoke + storefront + designer: **36 passed, 4 skipped**;
  - checkout + admin + vendor: **31 passed, 14 skipped, 1 failed** (`admin.spec.ts:239`, R5-PL-13, admin-owned).
- `notfound-check.mjs`: 58 / 58. `platform-shell.cjs`: 96 / 96.
- Screenshots: `docs/screenshots/audit/platform/r5d/`.

### Round 5 (e): R5-PL-07, R5-PL-08 and R5-PL-11 (assigned by the integrator)

Base: `044c9f8` (main `fd40cef` + round 5 d). Scope kept to the dictionary loader, the shared kit CSS, area layouts (imports and one provider wrapper each) and the build config. `marketing.module.css` is untouched (the R6 foundation session is replacing it).

**R5-PL-11: fixed.** The cause is in Next's strict `CssChunkingPlugin`. While a chunk is under `MIN_CSS_CHUNK_SIZE` (30 KB), it keeps absorbing the next CSS module, even when that module is also used by other routes. Those routes then receive the whole merged chunk, so `checkout.module.css` (12 KB) took `EmptyState` with it to every empty-state page. Merging saves CSS requests, but with `inlineCss` there are none, so it only adds bytes.
- **The fix:** `scripts/next/css-chunking-plugin.cjs` is a verbatim copy of next@15.5.29's plugin (MIT, attributed) with `MIN_CSS_CHUNK_SIZE = 0`. `next.config.ts` swaps it in for Next's instance; `cssChunking: "strict"` stays.
- **What is unchanged:** the strict order check, so cascade order is preserved, and modules that always load together still merge.
- **Result:** `EmptyState` is its own 1 KB chunk, and marketing pages no longer carry `CheckoutShell` CSS (R5-PL-10 is closed too).
- **Guard:** `src/app/__tests__/css-chunking.test.ts` fails if the installed Next's file differs from the copy, so a Next upgrade forces a fresh copy.

**R5-PL-08: fixed.** Each area now ships only the dictionary keys its code can read.
- **Generator:** `scripts/generate-i18n-scopes.ts` walks the import graph from each area's route files (page, layout, loading, error, not-found). It collects every key literal, every key prefix (`"materials."`, ``store.badges.${x}``) and every `dict.<ns>` access, and writes `src/i18n/scopes.generated.ts`. The scopes are root, design, share, checkout, orders, account, admin, vendor and dev.
- **Shipping:** `src/i18n/scope.ts` ships each scope by **second-level subtree** (for example `store.cookie`, `designer.price`), not by leaf. A key chosen at run time inside a named subtree (`t(RULE_KEYS[r])`, ``t(`materials.${code}`)``) is therefore always present.
- **Wiring:** the locale layout ships the root scope. Area layouts wrap their output in `<I18nScope>`, and `I18nProvider` merges a nested dictionary into its parent's. Admin and vendor keep their whole namespace but **no longer ship a second full dictionary** (R5-PL-14).
- **Sizes:** marketing pages carry **38.1 KB ar / 26.5 KB en** (target < 40 KB), down from 99.7 / 69.6 KB. Area pages add 7 to 24 KB (admin 58 KB, vendor 38 KB).
- **Tests** (`src/i18n/__tests__/scopes.test.tsx`): the generated file is current; the root scope is < 40 KB ar and < 30 KB en; `legal` and `notify` never reach the browser; every key a scope's code names resolves in root + that scope in both locales; nested providers merge.
- **Browser check:** `platform-shell.cjs` now flags any raw dictionary key rendered on the page.
- **When adding keys:** after adding a key in a new subtree, run `npx tsx scripts/generate-i18n-scopes.ts` (the test says so when it is stale).

**R5-PL-07: fixed.** Each area layout (checkout, orders, share, account, admin, vendor and the new `design/layout.tsx`) imports the kit sheets that its page, loading, error and not-found segments share. Those sheets now belong to the ancestor segment and are not repeated per segment. With `docs/audit/tools/rsc-breakdown.mjs`, duplicated CSS in the RSC payload is **0 KB** on all 15 probed routes, against 64 KB on checkout, 61 KB on order tracking, 30 KB on share and 29 KB on account before.

**Bytes, merged `fd40cef` → this pass** (phone, `ISOLATE=1`, `perf-data/r5-platform/pages-r5e-phone.json`):

| Route | Inline CSS ar (KB) | RSC payload ar (KB) | HTML gz ar (KB) | Inline CSS en (KB) | RSC en (KB) | Phone LCP ar (s) |
|---|---|---|---|---|---|---|
| home | 111 → **95** (-16) | 292 → **216** (-75) | 105 → **82** | 111 → **95** | 258 → **199** | 1.61 → 1.54 |
| boxes | 111 → **95** (-16) | 275 → **200** (-75) | 93 → **70** | 111 → **95** | 243 → **184** | 1.40 → 1.42 |
| bottles | 111 → **95** (-16) | 243 → **167** (-75) | 86 → **63** | 111 → **95** | 213 → **154** | 1.54 → 1.54 |
| catalog | 137 → **111** (-26) | 493 → **408** (-84) | 132 → **106** | 137 → **111** | 463 → **395** | 2.12 → 2.13 |
| vendors | 111 → **95** (-16) | 272 → **197** (-75) | 108 → **85** | 111 → **95** | 241 → **182** | 1.45 → 1.49 |
| design-picker | 200 → **172** (-27) | 476 → **410** (-66) | 162 → **143** | 200 → **172** | 447 → **391** | 1.29 → 1.34 |
| designer-box | 161 → **141** (-20) | 300 → **231** (-69) | 115 → **96** | 161 → **141** | 272 → **212** | 1.32 → 1.31 |
| designer-bottle | 161 → **141** (-20) | 303 → **234** (-69) | 117 → **98** | 161 → **141** | 275 → **216** | 1.36 → 1.29 |
| designer-pouch | 161 → **141** (-20) | 300 → **231** (-69) | 115 → **96** | 161 → **141** | 272 → **212** | 1.32 → 1.28 |
| designer-fefco09 | 161 → **141** (-20) | 300 → **230** (-69) | 115 → **96** | 161 → **141** | 272 → **212** | 1.31 → 1.28 |
| share | 177 → **125** (-52) | 359 → **228** (-131) | 158 → **118** | 177 → **125** | 329 → **212** | 2.35 → 1.40 |
| checkout | 119 → **98** (-20) | 317 → **190** (-127) | 118 → **85** | 119 → **98** | 289 → **172** | 2.06 → 2.06 |
| order-tracking | 216 → **156** (-59) | 427 → **268** (-159) | 164 → **116** | 216 → **156** | 397 → **249** | 2.08 → 1.99 |
| account | 218 → **161** (-57) | 394 → **254** (-139) | 152 → **110** | 218 → **161** | 364 → **239** | 2.12 → 2.00 |
| vendor-portal | 133 → **97** (-36) | 373 → **216** (-157) | 135 → **91** | 133 → **97** | 313 → **193** | 1.12 → 1.32 |
| vendor-jobs | 152 → **115** (-37) | 376 → **212** (-164) | 136 → **90** | 152 → **115** | 317 → **189** | 1.10 → 1.34 |
| admin | 141 → **115** (-26) | 418 → **268** (-150) | 150 → **109** | 141 → **115** | 356 → **236** | 1.20 → 1.41 |
| admin-orders | 137 → **104** (-33) | 383 → **226** (-157) | 138 → **91** | 137 → **104** | 323 → **196** | 1.05 → 1.05 |

Totals over the 18 Arabic routes:
- inline CSS **−518 KB**;
- RSC payload **−1,913 KB**;
- gzipped HTML **−557 KB**.

Home is 105 → 82 KB gzip, share 158 → 118 KB, the vendor portal 135 → 91 KB. Phone LCP stays within budget on every route; share is 2.35 → 1.40 s.

| id | severity | page / file | finding | standard | fix | status |
|---|---|---|---|---|---|---|
| R5-PL-07 | medium | area layouts | (above) | Performance budget | Shared kit CSS imported in the area layout | fixed |
| R5-PL-08 | medium | `[locale]/layout.tsx`, `src/i18n` | (above) | Performance budget | Scoped client dictionaries | fixed |
| R5-PL-11 | medium | `next.config.ts` | (above) | Performance budget | Vendored strict chunking with no cross-route merging | fixed |
| R5-PL-10 | low | marketing pages | `CheckoutShell` CSS on marketing pages (round 5 c). | Performance budget | Closed by R5-PL-11 | fixed |
| R5-PL-14 | medium | `admin/layout.tsx`, `vendor/layout.tsx` | Found this pass. Both mounted a second `<I18nProvider>` with the **full** dictionary (107 KB raw ar), so admin and vendor pages, and the public `/vendor/apply`, serialised the dictionary twice (97 + 107 KB). | Performance budget | `<I18nScope scope="admin" / "vendor">`, which adds only the area namespace and keys: 57.7 / 37.6 KB. | fixed |

### Round 5 (e) counts (new findings, before fixing)

critical 0 · high 0 · medium 1 (R5-PL-14) · low 0. The assigned rows R5-PL-07, R5-PL-08 and R5-PL-11 are fixed, and R5-PL-10 closes with them. R5-PL-03 (admin detail 404s) went to admin, and R5-PL-13 is fixed on admin's branch (integrator).

### Round 5 (e) verification

- `npm run lint` clean and `npm run typecheck` clean.
- `npm test`: 109 files, 8,759 passed (new: `scopes.test.tsx`, `css-chunking.test.ts`).
- `npm run build` clean. `generate-i18n-scopes.ts --check` and `debarrel-ui.mjs --check` both clean.
- e2e (`--workers=2`):
  - smoke + storefront + designer: **36 passed, 4 skipped**;
  - checkout + admin + vendor + journey + catalogue: **47 passed, 19 skipped**;
  - a11y: **4 passed**.
- `notfound-check.mjs`: 58 / 58.
- `platform-shell.cjs`: 96 / 96 (16 routes × ar/en × 320/390/1440), with no raw keys, axe 0, no overflow and no console errors.
- Screenshots: `docs/screenshots/audit/platform/r5e/`.

### Files touched outside the listed scope (round 5 e)

- **Area layouts**, one `<I18nScope>` wrapper plus kit CSS imports each: `(checkout)/layout.tsx`, `orders/layout.tsx`, `s/layout.tsx`, `admin/layout.tsx`, `vendor/layout.tsx`, `dev/layout.tsx`.
- **New files:** `design/layout.tsx` and `(store)/account/layout.tsx`.
- **Build config:** `next.config.ts` (webpack hook) and `scripts/next/css-chunking-plugin.cjs`.

### Round 5 (f): audit-only pass on main `a935f6f` (contains 176b4e0)

No new features. The checks:
- bytes and phone LCP/CLS/INP on every route;
- the raw-key sweep per role;
- the not-found pages and the app shell;
- `next dev` with the vendored chunking plugin.

`debarrel-ui.mjs --check`: no barrel imports.

**Bytes and Web Vitals, R5e → main** (phone, `ISOLATE=1`, `perf-data/r5-platform/pages-r5f-phone.json`):

| Route | Inline CSS ar (KB) | RSC ar (KB) | HTML gz ar (KB) | LCP ar (s) | LCP en (s) | CLS ar | INP ar (ms) |
|---|---|---|---|---|---|---|---|
| home | 95 → **95** | 216 → **217** (+0) | 82 → **82** | 1.54 → **1.50** | 0.96 → **0.98** | 0.010 | 96 |
| boxes | 95 → **95** | 200 → **200** (+0) | 70 → **70** | 1.42 → **1.42** | 1.32 → **1.38** | 0.013 | 40 |
| bottles | 95 → **95** | 167 → **168** (+0) | 63 → **64** | 1.54 → **1.52** | 1.41 → **1.40** | 0.005 | 40 |
| catalog | 111 → **111** | 408 → **408** (+0) | 106 → **106** | 2.13 → **2.07** | 1.92 → **1.88** | 0.007 | 72 |
| vendors | 95 → **95** | 197 → **197** (+0) | 85 → **85** | 1.49 → **1.47** | 1.08 → **1.05** | 0.003 | 32 |
| design-picker | 172 → **172** | 410 → **411** (+0) | 143 → **143** | 1.34 → **1.27** | 1.25 → **1.23** | 0.002 | 128 |
| designer-box | 141 → **141** | 231 → **231** (+0) | 96 → **96** | 1.31 → **1.28** | 1.23 → **1.28** | 0.002 | 112 |
| designer-bottle | 141 → **141** | 234 → **234** (+0) | 98 → **98** | 1.29 → **1.29** | 1.25 → **1.27** | 0.002 | 168 |
| designer-pouch | 141 → **141** | 231 → **231** (+0) | 96 → **96** | 1.28 → **1.28** | 1.24 → **1.25** | 0.002 | 160 |
| designer-fefco09 | 141 → **141** | 230 → **231** (+0) | 96 → **96** | 1.28 → **1.28** | 1.22 → **1.24** | 0.002 | 128 |
| share | 125 → **125** | 228 → **228** (+0) | 118 → **118** | 1.40 → **1.39** | 1.29 → **1.30** | 0.001 | 160 |
| checkout | 98 → **98** | 190 → **191** (+0) | 85 → **85** | 2.06 → **2.05** | 1.94 → **2.02** | 0.121 | 128 |
| order-tracking | 156 → **156** | 268 → **268** (+0) | 116 → **116** | 1.99 → **2.03** | 1.76 → **1.80** | 0.019 | 104 |
| account | 161 → **161** | 254 → **254** (-0) | 110 → **110** | 2.00 → **1.99** | 1.74 → **1.72** | 0.010 | 96 |
| vendor-portal | 97 → **97** | 216 → **209** (-7) | 91 → **89** | 1.32 → **1.32** | 1.30 → **1.24** | 0.001 | 16 |
| vendor-jobs | 115 → **115** | 212 → **211** (-2) | 90 → **89** | 1.34 → **1.31** | 1.24 → **1.21** | 0.014 | 64 |
| admin | 115 → **115** | 268 → **270** (+2) | 109 → **109** | 1.41 → **1.42** | 0.99 → **1.32** | 0.000 | 16 |
| admin-orders | 104 → **104** | 226 → **228** (+3) | 91 → **92** | 1.05 → **4.97** | 0.98 → **0.94** | 0.001 | 72 |

Bytes are unchanged (±3 KB per route). Phone LCP is within budget on every route except **admin orders ar: 4.97 s in this run, 5.0 / 5.3 / 1.1 s in three re-runs** (R5-PL-17). CLS is within budget except **checkout ar: 0.121** (R5-PL-16). INP is ≤ 168 ms everywhere.

**Raw dictionary keys** (`docs/audit/tools/rawkey-sweep.cjs`, data `rawkeys-r5f.json`):
- **Coverage:** 78 screens across visitor (26), buyer (14), vendor (10) and admin (28), in ar and en at 390 px.
- **Interactions:** 229 dialogs, menus, popovers and tabs opened, and 16 forms submitted. Every non-GET request (API and server actions) was answered with a 500, so the error toasts and banners rendered and nothing was written.
- **What it reads:** visible text, `aria-label`, `title`, `placeholder`, `alt` and the document title.
- **Result: no raw key on any screen.** The detector was checked by injecting keys into a page.

**Dev server.** `next dev` was started with a module-load probe on `scripts/next/css-chunking-plugin.cjs`.
- **Dev:** the probe never fired. Next only adds `CssChunkingPlugin` for `!dev && isClient`, so the `next.config.ts` hook finds nothing and leaves dev alone. Home, catalogue, editor, sign-in and vendor apply render styled (linked CSS, tokens loaded), with no console errors and no raw keys.
- **Production:** the same probe fired once during `npm run build`, and `EmptyState` is its own 1 KB chunk, so the plugin is active.

**Not-found pages:** 58 / 58. **App shell:** 96 / 96 (16 routes × ar/en × 320/390/1440): no raw keys, axe 0, no overflow, skip link OK, and the language switch keeps the query.

| id | severity | page / file | finding | standard | fix | status |
|---|---|---|---|---|---|---|
| R5-PL-15 | low | `src/i18n/scopes.generated.ts` on main | Main's later merges added 6 key references (`store.vendor.newBadge`, `store.vendors.onTimeNew`, `orders.dispute.*`) without regenerating. `scopes.test.tsx` fails on main. Nothing broke on screen: all six sit in subtrees that already ship (the reason for subtree granularity). A key in a brand-new subtree would have rendered raw. | Robustness | Regenerated. `package.json` gets `"prebuild": "tsx scripts/generate-i18n-scopes.ts"`, so every production build ships fresh scopes even when a merge forgets. The test still flags an uncommitted stale file. | fixed |
| R5-PL-16 | medium | checkout ar, phone (`ui/CookieNotice`, `CheckoutShell`) | CLS **0.121** (budget 0.1), the same 0.1204 on `fd40cef`, R5e and this run. At 2.04 s IBM Plex Sans Arabic swaps in for the fallback. The notice shrinks 159 → 140 px and the sticky action bar's text reflows 64 → 84 px (rects in `perf-pages.mjs`, which now records them). It is an Arabic first visit with a cold cache only: en is 0.005, and a warm cache gives 0. The notice text is also checkout's LCP element. | WCAG-neutral; CWV CLS < 0.1 | This is the open R4-10 font decision (performance R4.7). Option A is `display: "optional"` for Plex Arabic. Option B is a self-hosted Plex Arabic with a metric-matched fallback. A shorter notice does not fix the cause. Decision for the integrator/founder; not changed in an audit-only pass. | open (decision) |
| R5-PL-17 | medium | admin and vendor frame pages, phone | An intermittent **React #418 hydration mismatch** ("server rendered HTML didn't match the client") under 4× CPU / Slow 4G. It appeared in 1 of 4 admin-orders runs and 2 of 6 and 2 of 8 vendor-jobs runs (on `fd40cef` too, so it predates R5e). React then client-renders the tree, and the replaced text becomes a second LCP entry at about 5 s (admin orders ar 4.97 / 5.02 / 5.26 s; 1.1 s when it hydrates cleanly). Not reproduced on `next dev`, and a MutationObserver probe hides it (0 of 10). | WCAG 4.1.2 (robust); CWV LCP | Ruled out: the frames' `matchMedia`, `navigator.platform` and dates all run in effects or are deterministic (`formatDate` with a fixed time zone). Next step: a production build with React's non-minified errors (`react-dom/profiling` alias, or `next build --debug-prerender`) to read the diff. | open (platform, next round) |

### Round 5 (f) counts (new findings, before fixing)

critical 0 · high 0 · medium 2 (R5-PL-16, R5-PL-17) · low 1 (R5-PL-15). Fixed: R5-PL-15. Open: R5-PL-16 (font decision, R4-10) and R5-PL-17 (needs a debug build). Medium findings were found, so the rounds continue.

### Round 5 (f) verification

- `npm run lint` clean and `npm run typecheck` clean.
- `npm test`: 112 files, 8,770 passed.
- `npm run build` clean (the `prebuild` scope generation ran).
- e2e (`--workers=2`):
  - smoke + storefront + designer: **36 passed, 4 skipped**;
  - checkout + admin + vendor + journey + catalogue + a11y: **53 passed, 19 skipped**.
- `notfound-check.mjs`: 58 / 58. `platform-shell.cjs`: 96 / 96. `rawkey-sweep.cjs`: 78 screens, no raw keys.

### Round 5 (g): R6-RS-11, server-rendered 404s (assigned by the integrator)

Base: main `c9b4f9a4` (R6 public pages) merged into this branch.

**Root cause.** Missing CSS was a symptom. **Every** 404 response (catch-all, legal, catalogue, share, editor, orders, admin, root) was Next's SSR error shell: `<html id="__next_error__">` with an empty body and no `<style>`. The not-found UI rendered only after the JavaScript loaded, so phone LCP was 4.4 to 4.9 s.
- **Mechanism:** in Next 15.5 a `notFound()` thrown while rendering a request reaches React's SSR shell, which has no error boundaries. Next then sends that error document and renders the 404 on the client.
- **Reproduced in a minimal app** with the same Next (`[locale]/[...missing]/page.js` calling `notFound()` next to `not-found.js`): error shell with and without `inlineCss`, with a normal or pass-through root layout, and with `experimental.globalNotFound`.
- **What does render on the server:** a route that does not throw, rewritten by middleware with `status: 404`. Related upstream reports: [vercel/next.js#62228](https://github.com/vercel/next.js/issues/62228), [#69480](https://github.com/vercel/next.js/issues/69480).

**Fix (shell level).**
- **Middleware:** `src/middleware.ts` checks the path against `isKnownMissing()` (`src/lib/routing/static-404.ts`). URLs that are certainly unknown without a database lookup are rewritten, **with HTTP 404**, to `/{locale}/page-not-found`. The address bar keeps the visitor's URL.
- **The page:** `src/app/[locale]/(store)/page-not-found/page.tsx` is a statically generated page that renders the marketing `NotFoundState` without throwing. Its HTML is complete: `<style>`, marketing chrome, title "الصفحة غير موجودة · علبة", noindex.
- **URLs covered:**
  - an unknown first segment (the catch-all case);
  - an unknown legal document;
  - an unknown editor model (`/design/<x>`, matched like `modelFromParam` against the generated `MODEL_INDEX`);
  - a malformed share token (tokens are always 16 base64url characters);
  - `/page-not-found` itself.
- **Tests** (`src/lib/routing/__tests__/static-404.test.ts`): `TOP_SEGMENTS` equals the route folders under `src/app/[locale]`, so a new top-level route fails the test until it is listed. No real page is ever treated as missing. The editor-model check agrees with `modelFromParam` on all 370+ slugs, codes and dashed codes and on invalid inputs.

**Phone LCP, 404 renders** (`perf-pages.mjs`, phone, `ISOLATE=1`, data `perf-data/r5-platform/pages-404-phone.json`):

| 404 | Before LCP ar / en (s) | After LCP ar / en (s) | After FCP ar / en (s) | HTML |
|---|---|---|---|---|
| `/no-such-page` | 4.69 / 4.37 (r6-restyle) | **2.27 / 1.88** | 1.03 / 0.96 | SSR, `<style>` in head |
| `/s/no-such-token-123` | 4.87 / 4.45 (r6-restyle) | **2.28 / 1.90** | 1.03 / 0.98 | SSR |
| `/legal/no-such-policy` | error shell | **2.26 / 1.92** | 1.04 / 0.95 | SSR |
| `/design/no-such-model` | error shell | **2.25 / 1.85** | 1.08 / 0.98 | SSR |
| `/catalog/no-such-model` | error shell | 5.06 / 4.68 | 5.06 / 4.68 | still the error shell (R5-PL-19) |
| `/s/aaaaaaaaaaaaaaaa` (well-formed, unknown) | error shell | 4.70 / 4.39 | 4.70 / 4.39 | still the error shell (R5-PL-19) |

All four rewritten 404s are under 2.5 s in ar and en, CLS ≤ 0.007.

| id | severity | page / file | finding | standard | fix | status |
|---|---|---|---|---|---|---|
| R6-RS-11 | high | every 404 | (above) | CWV LCP < 2.5 s | Middleware rewrite to the static 404 page | fixed for unknown paths, legal documents, editor models and malformed share tokens |
| R5-PL-19 | medium | 404s that need a lookup: catalogue model, box style, bottle, printer, order, admin record, a well-formed unknown share token | These still use `notFound()`, so they still get the client-rendered error shell (phone LCP 4.4 to 5.1 s). This is a Next 15.5 limitation: the middleware cannot see the database. | CWV LCP | Catalogue and box styles are static datasets. Their owner can generate a slug set for the middleware, as `MODEL_INDEX` is used for the editor. Entities in the database need a framework change, so re-check on the next Next upgrade. | open (catalogue, then Next upgrade) |
| R5-PL-20 | low | `/{locale}/page-not-found` | The rewritten 404 inherits the static page's `Cache-Control: s-maxage=31536000`, so a CDN keeps a 404 for that URL until the next deploy. | – | Accepted. A URL can only stop being missing through a deploy, which purges the CDN. | accepted |

### Round 5 (g) counts (new findings, before fixing)

critical 0 · high 0 · medium 1 (R5-PL-19, open) · low 1 (R5-PL-20, accepted). R6-RS-11 (from r6-restyle) is fixed for every 404 the middleware can decide.

### Round 5 (g) verification

- `npm run lint` clean and `npm run typecheck` clean.
- `npm test`: 116 files, 8,795 passed (new: `static-404.test.ts`).
- `npm run build` clean (middleware 40.6 KB).
- e2e (`--workers=2`):
  - smoke + storefront + designer: **36 passed, 4 skipped**; this includes "unknown marketing URLs answer a real 404 with the marketing chrome" and "unknown structure is a 404";
  - checkout + admin + vendor + journey + catalogue + a11y: **53 passed, 19 skipped**.
- `notfound-check.mjs`: 58 / 58 (404 status, styled, one `<main>`, no console errors). Screenshots: `docs/screenshots/audit/platform/r5g/`.
