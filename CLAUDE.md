# Elba (علبة): orientation for Claude Code sessions

Elba is a packaging marketplace for Egypt. A brand designs its packaging on a live 3D model, gets an instant price (or asks for a quote) and orders it from a vetted Egyptian printer. Elba is the merchant of record: it sells at its own price and buys from the printer at the rate card price.

- **372 designer models** (276 boxes + 96 containers) live in `src/lib/library`. The public **catalogue lists 412** (`src/data/catalogue`): the 372 plus 40 quote-only family models (FEFCO 09 fittings, moulded pulp, cups, lids, bags, blister).
- Stack: Next.js 15 App Router, React 19, TypeScript (strict), Prisma 6 (SQLite in dev and tests, Postgres on Neon in production), three.js + react-three-fiber, pdf-lib, zod, Vitest, Playwright.
- Locales: `/ar` (default, RTL) and `/en`. Every page lives under `/{locale}/...`.
- Production: one Cloudflare Worker (OpenNext) + Neon via Hyperdrive + R2. Read `docs/DEPLOY-CLOUDFLARE.md` before touching deploy code. It is current.

Docs index: `docs/README.md`. Architecture: `docs/ARCHITECTURE.md`. Area guides: `docs/guides/`. Audit status: `docs/audit/STATUS.md`.

## Directory map

| Path | What lives there |
|---|---|
| `src/middleware.ts` | Locale redirect, `x-elba-*` request headers, static 404 rewrite, security headers |
| `src/app/[locale]/(store)`, `(detail)` | Public site: home, start, designer page, why-elba, pricing, catalogue, boxes, vendors, legal, account |
| `src/app/[locale]/design` | The 3D designer (picker + editor `[structure]`) |
| `src/app/[locale]/(checkout)`, `orders`, `s` | Checkout and payment, buyer orders and invoice, public share page |
| `src/app/[locale]/vendor`, `admin`, `dev` | Printer portal, ops console, dev tools (gated by `devPagesEnabled()`) |
| `src/app/api` | Route handlers: auth, designs, quote, orders, payments, vendor files/uploads, events, jobs, webhooks |
| `src/lib/library` | Model registry (packs, lazy loader, `model-index.generated.ts`, `doc.ts`) |
| `src/lib/dieline` | Box dielines in mm, folding (`fold.ts`), SVG, families under `families/` |
| `src/lib/vessels` | Bottles, jars, cans, tubes, flexible packs: profiles and print areas |
| `src/components/three` | Renderer (`engine.ts` eager, `index.ts` lazy entry), finishes, vessels |
| `src/components/designer` | Editor UI, `server.ts` (save, load, share), `lib/` (history, preflight, storage) |
| `src/lib/pricing`, `src/lib/configurator` | Pure pricing engine, rate cards, margin, VAT; configurator rules and vendor matching |
| `src/lib/orders` | State machine (`state.ts`), `service.ts`, totals, payment rules, PDFs (`pdf/`) |
| `src/lib/{payments,shipping,notify,storage,jobs,analytics,auth}` | Paymob/mock, Bosta/mock, notifications, blob storage, daily jobs, first-party analytics, OTP and sessions |
| `src/components/{vendor,admin}` | Portal and console UI plus `server/` (actions, queries) and `lib/` (pure rules) |
| `src/components/marketing` | Public site shell and the R6 kit (`kit/`), page sections |
| `src/components/ui` | App UI kit (Polaris-style). Import per file, never the barrel |
| `src/data/catalogue`, `src/data/packaging-availability` | 412-row catalogue, order modes, Egypt availability research |
| `src/i18n` | Dictionaries (`en.ts` defines the shape), namespaces, scopes |
| `src/types` | Shared types and the String "enum" unions |
| `prisma/` | `schema.prisma` (source of truth, SQLite), `postgres/` (generated copy + migrations), `seed.ts` |
| `scripts/` | Generators, daily jobs, Cloudflare build helpers, codemods, perf and marketing render tools |
| `e2e/` | Playwright specs, `fixtures/factory.ts`, `journeys/` |
| `docs/audit/` | Round-by-round audit reports with finding ids |

## Commands

```bash
npm install                      # postinstall runs prisma generate (SQLite client)
cp .env.example .env             # first time; gives SESSION_SECRET (dev flags are commented out)
npm run db:push && npm run db:seed
npm run dev                      # http://localhost:3000 -> /ar (Turbopack; npm run dev:webpack for the old bundler)
npm run lint                     # eslint (also run by next build)
npm run typecheck                # tsc --noEmit
npm test                         # vitest run (unit, about 124 files)
npx vitest run src/lib/pricing   # one folder or file
npm run build                    # prebuild regenerates i18n scopes + route slugs
npm run test:size                # non-3D first-load JS < 200 KB gzip (after build)
npx playwright test e2e/vendor.spec.ts --project=desktop --trace off   # one spec
npm run jobs:daily               # retention + follow-ups + on-time sync, locally
```

**Full check** (what a merge must pass; needs a `.env` with `SESSION_SECRET`). Do not run the whole e2e suite casually: it takes over an hour.

```bash
pkill -f next-server; rm -rf .next; rm -f prisma/merge-check.db*; export ELBA_DATABASE_URL=file:./merge-check.db; npm install; npx prisma generate; npx prisma db push && npx prisma db seed; npm run lint; npm run typecheck; npm test; npm run build; OTP_DEV_ECHO=1 ALLOW_MOCK_PAYMENTS=1 npx playwright test --workers=2 --trace off --reporter=line
```

Playwright starts `npm run start -- -p $E2E_PORT` (default 3100) with `ELBA_E2E=1`, or reuses a server already on that port. Chromium is preinstalled: never run `playwright install`.

**Generators** (each writes a checked-in file; tests fail when stale). See `docs/guides/3d-engine-and-model-library.md`.

| Command | Writes |
|---|---|
| `npx tsx scripts/generate-library-index.ts` | `src/lib/library/model-index.generated.ts` |
| `npx tsx scripts/generate-model-thumbnails.ts` | `public/models/<slug>.svg`, `e2e/fixtures/models.json` |
| `npx tsx scripts/generate-catalogue-rows.ts` | `src/data/catalogue/picker-rows.generated.json` |
| `npx tsx scripts/generate-order-mode-table.ts` | `src/data/catalogue/order-mode-table.ts` |
| `npx tsx scripts/generate-route-slugs.ts [--check]` | `src/lib/routing/route-slugs.generated.ts` (also in prebuild) |
| `npx tsx scripts/generate-i18n-scopes.ts [--check]` | `src/i18n/scopes.generated.ts` (also in prebuild) |
| `npm run db:schema:pg` | `prisma/postgres/schema.prisma` |
| `npx tsx scripts/render-catalogue-thumbnails.ts --only CODE` | `public/models/<CODE>.webp`, `e2e/fixtures/catalogue-models.json` (app must be running) |

**Prisma, SQLite vs Postgres**
- Dev and tests: `prisma/schema.prisma` (SQLite), URL in `ELBA_DATABASE_URL` (not `DATABASE_URL`, which some hosts pre-set).
- After editing the schema: `npm run db:push`, then `npm run db:schema:pg`, then a migration with `npx prisma migrate dev --schema prisma/postgres/schema.prisma --name <change>` against a Postgres URL. `src/lib/__tests__/cloudflare.test.ts` fails when the Postgres copy is stale.
- Generating the Postgres client (`npx prisma generate --schema prisma/postgres/schema.prisma`) replaces the SQLite client. Run `npx prisma generate` afterwards to restore it.

**Cloudflare**: `npm run cf:build` (Postgres schema + client, `ELBA_TARGET=cloudflare opennextjs-cloudflare build`, build facts, then restores the SQLite client), `npm run cf:preview`, `npm run cf:deploy`.

## Hard rules

- **Money is integer piasters** (1 EGP = 100). Columns end in `Piasters`. No floats. Maths in `src/lib/pricing/money.ts` (`toPiasters`, `vatOf`, `withMargin`), parsing user input only with `src/lib/money/input.ts` (`parseEgpInput`; a decimal comma is rejected), display only with `formatMoney()` (`src/lib/format.ts`). VAT is 14% (`VAT_RATE`).
- **Enum-like columns are `String`.** Allowed values are TS unions or const arrays in `src/types/*.ts` (`OrderStatus`, `Role`, `PaymentMethod`...). Validate with zod at API boundaries. Add values additively.
- **Bilingual columns** come in pairs `xxxAr` / `xxxEn`; read with `pick(locale, row.nameAr, row.nameEn)`.
- **Json columns**: write with `toJson`, read with `fromJson<T>` (`src/lib/json.ts`); hash proofs with `canonicalJson`.
- **Never import `@/components/ui`** (the barrel). ESLint errors on it (R4-08). Import `@/components/ui/Button`. The marketing kit has no barrel either. Fix a file with `node scripts/codemods/debarrel-ui.mjs <file>`.
- **i18n**: add every key to both `src/i18n/<ns>.en.ts` and `.ar.ts` in the same edit. Page-level scopes are generated (`scopes.generated.ts`); `npm run build` regenerates them, `npx tsx scripts/generate-i18n-scopes.ts --check` verifies.
- **Arabic copy**: MSA, noun-form labels on buttons and links (never imperatives), no diacritics or tatweel, Western digits, «ج.م» after amounts. Enforced by `src/i18n/__tests__/copy-rules.test.ts` and `src/components/marketing/kit/__tests__/arabic-labels.test.ts`. Glossary: `docs/audit/platform-glossary.md`.
- **Server-only modules**: about 26 files start with `import "server-only"` (`grep -rl '^import "server-only"' src`), among them `src/lib/orders/service.ts`, `src/lib/auth/session.ts`, `src/lib/storage/blob.ts`, `src/lib/pricing/server.ts`, `src/components/{admin,vendor}/server/*`, `src/components/designer/server.ts`. `@/lib/db` is server-only by comment, not by import. Never import any of them from a `"use client"` file. `legal` and `notify` dictionary namespaces are server-only.
- **Generated files**: never hand-edit anything with a "Generated ... Do not edit" header, `picker-rows.generated.json`, `e2e/fixtures/*.json`, `public/models/*` or the geometry snapshot. Re-run the generator.
- **Geometry snapshot**: any change to a box dieline or fold changes `src/lib/dieline/__tests__/__snapshots__/geometry.json`. Update it only for an intended change: `UPDATE_GEOMETRY_SNAPSHOT=1 npx vitest run src/lib/dieline/__tests__/geometry-snapshot.test.ts`, and say so in the commit.
- **Keep three.js out of `src/lib/dieline` and `src/lib/vessels`** (pure TS, local `./math`). Load the renderer lazily (`src/components/three/index.ts`); non-3D pages must not ship three.js (`npm run test:size`).
- **Every layout renders exactly one `<main id="main">`** (skip link target).
- **Do not mirror** the 3D scene, dielines, dimensions or artwork coordinates in RTL. Use logical CSS properties elsewhere.
- **Order status changes go through `src/lib/orders/state.ts`** (`assertTransition`) and `transitionOrder()` in `src/lib/orders/service.ts`. Never write `Order.status` directly.
- **Admin mutations** use `adminForMutation()` and write an `AuditLog` row via `audit()` (`src/components/admin/server/context.ts`).
- **Detail pages** check the record in `layout.tsx` and call `notFound()` above any Suspense boundary, otherwise Next answers 200 (R5-PL-03).

## Dev-only env flags (never set in production)

| Flag | Effect | Guard in code |
|---|---|---|
| `OTP_DEV_ECHO=1` | Returns the OTP as `devCode` and logs it; also relaxes the `SESSION_SECRET` placeholder check | `otpDevEcho()`: "exactly 1" under `next start`. Under `next dev` it is on unless `0` |
| `ALLOW_MOCK_PAYMENTS=1` | Enables the mock gateway under `next start` | `mockPaymentsEnabled()` in `src/lib/payments/config.ts` |
| `ELBA_E2E=1` | Lifts per-IP OTP limits (with dev echo) and opens `/dev` pages | `otpIpLimits()`, `devPagesEnabled()` in `src/lib/env.ts` |
| `ELBA_DEV_PAGES=1` | Opens `/[locale]/dev/*` in production builds | `devPagesEnabled()` |
| `E2E_INSECURE_COOKIES` | Session cookie without `Secure` | None |
| `ELBA_DEMO_SITE=1` | Feedback copy: keeps `OTP_DEV_ECHO` and `ALLOW_MOCK_PAYMENTS` on an https site, only when the site URL is `*.workers.dev` | `isDemoSite()` in `src/lib/env.ts` |

**Guard**: when `NEXT_PUBLIC_SITE_URL` starts with `https://` (a real deployment) the first four flags are ignored and one warning is logged (`devFlag()` / `isRealDeployment()` in `src/lib/env.ts`). Local runs, e2e and the local preview use `http://localhost`, so they keep working. `.env.example` lists the flags commented out in a "LOCAL TESTING ONLY" block; the e2e command passes `OTP_DEV_ECHO=1 ALLOW_MOCK_PAYMENTS=1` itself.

## Known gotchas

- **Stale server on 3100**: Playwright reuses whatever answers on the port, including an old build. Run `pkill -f next-server` before e2e.
- **Prisma refuses `db push --force-reset`** without explicit consent when run by an agent. Do not work around it: point `ELBA_DATABASE_URL=file:./merge-check.db` at a fresh file (`rm -f prisma/merge-check.db*`) and `npx prisma db push && npx prisma db seed`.
- **Postgres client left behind**: after any `--schema prisma/postgres/schema.prisma` generate, run `npx prisma generate`. `cf:build` does this itself.
- **Seed is destructive**: `prisma/seed.ts` wipes every table. Never run it against production (it creates demo accounts and orders).
- **Rate limits are in memory per process** (`src/lib/rate-limit.ts`); on Workers they are per isolate. Only the OTP lockout is in the database.
- **Postgres `contains` is case-sensitive**, SQLite is not (admin audit search).
- **`next build` prerenders with live data**, so it needs a seeded database.
- **e2e specs are parallel-safe** only because they clone orders and create users through `e2e/fixtures/factory.ts`. Do not mutate seeded rows in a spec without restoring them.
- **Slow specs**: `e2e/models.spec.ts` (all 372 models, software WebGL), `e2e/catalogue-models.spec.ts` (412), `journeys/*`, `storefront.spec.ts`. Run them alone with `--project=desktop`.
- **Demo sign-in**: admin `01000000001`, buyer `01000000002`, printers `01000000010` to `01000000015`. The OTP is shown in the dev banner.

## Where to look first

| Task | Start with |
|---|---|
| New or changed 3D model | `docs/guides/3d-engine-and-model-library.md`, `src/lib/library/packs/`, `src/lib/dieline/families/<fam>/README.md` |
| Designer behaviour | `docs/guides/designer.md`, `src/components/designer/DesignerApp.tsx` |
| Catalogue, order modes | `docs/guides/catalogue.md`, `src/data/catalogue/order-mode.ts` |
| Prices | `src/lib/pricing/engine.ts`, `src/lib/pricing/config.ts` |
| Checkout, orders, payments | `docs/guides/checkout-and-orders.md`, `src/lib/orders/service.ts` |
| Printer portal | `docs/guides/vendor-portal.md`, `src/components/vendor/server/actions.ts` |
| Admin console | `docs/guides/admin-console.md`, `src/components/admin/server/actions.ts` |
| Public site | `docs/guides/marketing-site.md`, `docs/design-refs/shopify-2026-reference.md` |
| Copy and translation | `docs/guides/i18n-and-copy.md` |
| Tests | `docs/guides/testing.md` |
| Auth, privacy, headers | `docs/guides/security-and-privacy.md` |
| Deploy | `docs/DEPLOY-CLOUDFLARE.md` |
| Is this a known issue? | `docs/audit/STATUS.md`, then the area report |
