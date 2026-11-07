# Elba: final report (2026-11-07)

Branch `claude/exciting-albattani-8kzgsu`. Final full checks ran on commit `120b5b6e`. After that commit, main gained only screenshots, docs and this report.

## 1. Final checks

Three independent full checks ran in parallel cloud sessions on the same commit, using the command in `CLAUDE.md`: install, Prisma push and seed, lint, typecheck, unit, build, then the full Playwright suite with 2 workers.

| Check | Session | Lint | Typecheck | Unit | Build | e2e |
|---|---|---|---|---|---|---|
| 1 | final-1 | RESULT_1_LINT | RESULT_1_TC | RESULT_1_UNIT | RESULT_1_BUILD | RESULT_1_E2E |
| 2 | final-2 | RESULT_2_LINT | RESULT_2_TC | RESULT_2_UNIT | RESULT_2_BUILD | RESULT_2_E2E |
| 3 | final-3 | RESULT_3_LINT | RESULT_3_TC | RESULT_3_UNIT | RESULT_3_BUILD | RESULT_3_E2E |

The same suite also ran on the Cloudflare Worker locally, against Postgres 16 through Hyperdrive and local R2. The result: 760 passed. The two real failures (a malformed URL returning 500) are fixed. Five more failed only under load and passed on a single-worker re-run (`docs/DEPLOY-CLOUDFLARE.md`, verification log).

## 2. What was built

- **3D model library:**
  - 370 designer models: 274 boxes (FEFCO 02 to 09, ECMA tuck and specials, rigid, food service, liquid cartons, tubes) and 96 containers (bottles, jars, tubs, cans, cosmetics, pharma, flexible packs).
  - The public catalogue lists 410 models: those 370 plus 40 quote-only models.
  - Each model has true dielines in mm, a fold animation, print areas, finishes and closures.
- **3D designer:** a live model, size presets, boards, finishes, artwork layers, a preflight check, a dieline view, PDF export, share links, and an instant price or a quote request.
- **Commerce:**
  - instant pricing (rate cards, margin, 14% VAT, prepay discount), quotes and checkout;
  - payments (Paymob, plus a mock gateway for tests), orders with a state machine, proofs, QC photos, Bosta shipping, disputes, refunds, invoices and receipts;
  - printer payouts (advance and balance).
- **Printer portal:** application, jobs, rate cards, profile and portfolio, payouts.
- **Admin console:** orders, printers and applications, disputes, quotes, moderation, pricing, catalogue, payouts, users, the audit log, and privacy requests.
- **Public site:**
  - pages: home, start, designer, why Elba, pricing, catalogue, box styles, bottles, printers, legal;
  - built in a Shopify-2026-style design system of its own (no Shopify assets or copy), with measured spacing tokens enforced by tests;
  - Arabic (RTL, default) and English.
- **Platform:** phone OTP auth and sessions, PDPL consent and retention jobs, security headers and CSP, rate limits, first-party analytics, i18n scopes, real 404s.
- **Production target:** Cloudflare Workers (OpenNext), Neon Postgres via Hyperdrive, R2 storage, a daily Cron Trigger. The Worker is 5.4 MiB gzip, under the 10 MiB limit.

Size of the codebase:

| Item | Count |
|---|---|
| Pages | 58 |
| API routes | 26 |
| Prisma models | 30 |
| e2e spec files | 31 |
| e2e tests per run | 1,260 listed, 767 run (the other 493 are desktop-only or phone-only by design) |
| Unit tests | 9,030 |
| Commits | 769 |
| Branch merges | 243 |
| Audit reports | 35 |

## 3. Audit rounds and the stop rule

Each area was audited in rounds until a fresh pass found nothing of medium or worse. Full status: `docs/audit/STATUS.md`.

| Area | Last round | Outcome |
|---|---|---|
| Designer | 16 | Stop rule met |
| Admin | 9 | Stop rule met |
| Catalogue | 8 | Stop rule met |
| Checkout | 11 | Stop rule met |
| Vendor portal | 7 | Stop rule met |
| Security | 6 | Stop rule met |
| Marketing | 4 | Stop rule met |
| 3D engine | 7 | Every row sent to it in round 7 was fixed, and the nail-polish regression found later was fixed too |
| 3D visual QA of every model | 7 | **The user set round 7 as the last.** Round 7 found 3, fixed 2. One low is open (R7-3Q-V-01, milky band on COS-PERFUME-ROUND) |
| Platform | 5 (i), the final pass | Two mediums open, see section 4 |
| Copy (Arabic / English) | 5, pass 2 | **Final pass skipped by the user** |
| Accessibility | 6, pass 4b | **Re-verify skipped by the user** |

Bugs found by the docs session and then fixed (`169fa262`):
- the admin audit row is now written in the same transaction as its change;
- a refund now voids pending and approved payouts;
- an order reassigned to another printer now gets its advance exactly once;
- the catalogue cache is now cleared when prices or catalogue data change;
- the catalogue price request now refuses models with an instant price;
- dev flags are now ignored on an `https://` deployment.

## 4. Remaining gaps

| Item | Severity | Notes |
|---|---|---|
| R5-PL-24: React #418 on cold admin order loads (about 1 in 3 on a slow phone) | medium | The mismatch is in the admin frame chrome above `<main>`. Fixing it needs a frame rework (options in `docs/audit/platform.md`). Admin 404s still pass. |
| R5-PL-27: share page INP 184 to 536 ms after the 3D view buttons | medium | Long tasks from the 3D re-render. Owner: 3D engine. |
| R6-AX-10, R6-AX-18 (accessibility) | medium | The re-verify was skipped by the user. |
| Copy round 5 open rows (R5-CP-11, R5-CP-12 high; ten mediums) | high / medium | The final copy pass was skipped by the user. R5-CP-12 (raw "PP28" chips) is fixed by R14-04. |
| Order progress label wraps mid-word ("acceptanc / e") on desktop | low | Seen in the final screenshots; `/[locale]/orders/[id]` progress tracker. |
| R7-3Q-V-01: milky band on the round perfume bottle | low | Not diagnosed (likely a softbox reflection). |
| Per-IP rate limits are per isolate on Workers (T-29) | low | Add the two Cloudflare WAF rules in `docs/DEPLOY-CLOUDFLARE.md`. The OTP lockout is in the database. |
| Postgres `contains` is case-sensitive | low | Admin audit search only. |
| Inside-lid print orientation (E-32) | medium, deferred | Needs an artwork migration. |

## 5. How to run

```bash
npm install
cp .env.example .env
npm run db:push && npm run db:seed
npm run dev
```

Open http://localhost:3000. It redirects to `/ar`. For local OTP sign-in and mock payments, uncomment the LOCAL TESTING block in `.env`.

Full check, tests and generators: see `CLAUDE.md`. Cloudflare deploy: `docs/DEPLOY-CLOUDFLARE.md`.

### Demo accounts (seed only; the OTP is shown in the dev banner)

| Role | Phone |
|---|---|
| Admin | 01000000001 |
| Buyer | 01000000002 |
| Printers | 01000000010 to 01000000015 |

## 6. What is mocked today

| Feature | Today | To go live |
|---|---|---|
| OTP SMS | Sending is an empty stub; the code is shown only with `OTP_DEV_ECHO` locally | Pick an SMS provider and implement its transport in `src/lib/notify` |
| WhatsApp, SMS and email notifications | Logged to the console | Real transports (WhatsApp Business API keys) |
| Payments | Paymob adapter plus a mock gateway, which is off on any `https://` site | Paymob live keys as Worker secrets |
| Shipping | Bosta adapter plus a mock. Bosta has no webhook, so delivery status is polled | `BOSTA_API_KEY` |
| E-invoicing (ETA) | Invoice and receipt PDFs; the ETA submission adapter is not built (B-13) | ETA registration, seller TRN |
| Turntable loop videos on `/designer` and the home page | Pages fall back to posters and on-demand 3D | Push the rendered loop files |

## 7. Founder actions before launch

1. **Cloudflare:**
   - subscribe to Workers Paid ($5 a month; the Pro zone plan does not include it);
   - create the Neon project (Frankfurt), the Hyperdrive connection, and the R2 buckets `elba-files` and `elba-next-cache`;
   - add the secrets, run the migration, and add the two WAF rate-limit rules;
   - point the domain.

   Every step is in `docs/DEPLOY-CLOUDFLARE.md`.
2. **Production data:** split the catalogue part of `prisma/seed.ts` out from the demo accounts and orders. The seed wipes every table; never run it on production as is.
3. **Legal identity (CR-43, B-13):**
   - company name, commercial register number, seller tax registration number, and a data protection officer, all shown in the footer, invoices and legal pages;
   - a Personal Data Protection Center (PDPC) licence under PDPL 151/2020, including for storing data outside Egypt (Neon and R2 regions);
   - ETA e-invoicing registration.
4. **Providers:** an SMS provider for OTP, WhatsApp Business API, Paymob live account, Bosta account.
5. **Policies:** the charge-back policy for disputes (admin report).
6. **Assets:** push the turntable loop videos for the home and designer pages.

## 8. Screenshots and videos

| Folder | Contents |
|---|---|
| `docs/screenshots/final-r7/pages/` | 129 full-page captures: public, designer, buyer, printer and admin; Arabic and English on desktop (1440), Arabic on phone (390). Listed in `index.json`. |
| `docs/screenshots/final-r7/videos/` | 7 clips: home scroll (en desktop, ar phone), designer (mailer rotate and views), Arabic design picker on phone, catalogue, printer job, admin order |
| `docs/screenshots/models/` | Every model from the green e2e run |
| `docs/screenshots/audit/` | Before / after sheets per audit round |
