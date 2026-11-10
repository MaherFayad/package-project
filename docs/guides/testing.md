# Testing

## Purpose

Two layers: Vitest unit tests (fast, run on every change) and Playwright end-to-end tests against a production build (`next start`). The full e2e suite has about 767 tests and takes over an hour; run single specs while you work.

## Unit tests (Vitest)

- Config: `vitest.config.ts`. Environment `node`, alias `@` to `src`, include `src/**/*.test.{ts,tsx}` (and `tests/unit/**`, which does not exist). No setup files.
- Layout: about 124 files in colocated `__tests__/` folders next to the code (`src/lib/**/__tests__`, `src/components/*/__tests__`, `src/components/*/lib/__tests__`, `src/i18n/__tests__`, `src/data/catalogue/__tests__`, `src/app/__tests__`).
- DOM tests opt in per file with `// @vitest-environment jsdom` (Testing Library is installed).
- Commands:
  ```bash
  npm test                                   # all
  npx vitest run src/lib/orders              # a folder
  npx vitest run src/lib/orders/__tests__/state.test.ts -t "refund"   # one file, one name
  npm run test:watch
  ```
- Tests that guard generated files (they fail when a generator was not re-run): `src/lib/library/__tests__/registry.test.ts`, `library.test.ts`, `src/data/catalogue/__tests__/catalogue.test.ts`, `src/i18n/__tests__/scopes.test.tsx`, `src/lib/routing/__tests__/static-404.test.ts`, `src/lib/__tests__/cloudflare.test.ts` (Postgres schema copy), `src/app/__tests__/css-chunking.test.ts` (vendored Next plugin), `src/lib/dieline/__tests__/geometry-snapshot.test.ts` (300 s).
- Unit tests that touch the database use the SQLite file in `ELBA_DATABASE_URL`; seed it first.

## End-to-end tests (Playwright)

- Config: `playwright.config.ts`. `testDir ./e2e`, `globalSetup ./e2e/global-setup.ts`, timeout 60 s, `expect` 15 s, fully parallel, 3 workers locally (2 with `CI`).
- Projects: `desktop` (Desktop Chrome) and `mobile` (Pixel 5 at 360 x 780).
- Server: `npm run start -- -p ${E2E_PORT:-3100}` with `ELBA_E2E=1`, or an existing server on that port (`reuseExistingServer`). So: `npm run build` first, and `pkill -f next-server` if an old build is still listening.
- The server needs `SESSION_SECRET` (from `.env`), `OTP_DEV_ECHO=1` and `ALLOW_MOCK_PAYMENTS=1`. `global-setup.ts` fails fast with a clear message when sign-in does not work, then warms the heavy routes as anon, buyer, vendor and admin.
- Chromium is preinstalled (`/opt/pw-browsers/chromium`, or `PW_CHROMIUM_PATH`). Never run `playwright install`.

```bash
OTP_DEV_ECHO=1 ALLOW_MOCK_PAYMENTS=1 npx playwright test e2e/checkout.spec.ts --project=desktop --trace off
npx playwright test e2e/vendor.spec.ts -g "QC" --trace off --reporter=line
```

## Fixtures and data

- `e2e/fixtures/factory.ts`: every test makes its own users and orders, so specs run in parallel. Helpers: `uniquePhone`, `createUser({ role, vendorId, name })`, `signInAs(context, baseURL, userId)` (writes a session row and cookie), `signInPhone`, `sendOtp` (returns the dev OTP), `cloneOrder(template, { status, buyerId, withQcPhotos })` (numbers `ELB-E2E-...`), `track`, `deleteOrder`, `cleanup`. `SEEDED` holds the seeded phones.
- `e2e/fixtures/models.json` (372) and `catalogue-models.json` (412) are generated manifests.
- `e2e/journeys/helpers.ts`: `localeOf(info)` runs every journey in English on desktop and Arabic on mobile; `tr()` looks labels up in the real dictionaries; `amounts()` parses EGP and «ج.م»; `ageShipments()` back-dates shipments; `noSideScroll()`.

## Seeded demo data (`prisma/seed.ts`, destructive: wipes every table)

| Role | Phone (local) | Notes |
|---|---|---|
| ADMIN | `01000000001` | «فريق تشغيل علبة» |
| BUYER | `01000000002` | «منى عادل», Bloom Candles; owns ELB-26001 |
| VENDOR staff | `01000000010` to `01000000015` | Nile Pack, Delta Cartons, Obour Box Works, Alex Print House, Damietta Modern Packaging, Cairo Label Flex (the seed header still says ...14) |
| Applicant (BUYER) | `01000000020` | Pending vendor `giza-carton-lab` |

Seeded orders: ELB-26001 (in production), ELB-26201 (Delta, paid, reset by `vendor.spec.ts`), ELB-26202, ELB-26203 (delivered), ELB-26301 (QC pending, reset by `admin.spec.ts`). The OTP shows in the dev banner and server log.

## Spec map

| Area | Specs |
|---|---|
| Smoke and storefront | `smoke`, `storefront`, `start`, `why-pricing`, `designer-page` |
| Marketing kit and layout | `marketing-kit`, `marketing-spacing`, `restyle-height` |
| Catalogue | `catalogue`, `catalogue-order-modes`, `catalogue-models` |
| Designer and 3D | `designer`, `models` |
| Checkout and orders | `checkout`, `checkout-quote`, `checkout-states`, `checkout-share-guard`, `checkout-dispute-photos`, `checkout-vendor-view`, `journey` |
| Vendor, admin | `vendor`, `admin`, `admin-quote-price` |
| Accessibility | `a11y` (keyboard checkout, modal trap), `a11y-routes` (axe on every role's routes, one h1, one main, no side scroll) |
| Security | `security-r6` |
| Journeys | `journeys/j1-brand-orders` to `j5-failure-paths` |

axe runs with tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`.

## Slow specs

There is no `test.slow`; slow tests raise `test.setTimeout`.

- `models.spec.ts`: every designer model with software WebGL, desktop only. Run alone.
- `catalogue-models.spec.ts`: all 412 renders in batches of 24: `npx playwright test e2e/catalogue-models.spec.ts --project=desktop --workers=2 --trace off`.
- 300 s: `storefront.spec.ts` (slow-phone hydration), `j1`, `j4`. 240 s: `journey.spec.ts`, `j2`, `j3`. 180 s: `restyle-height`, `designer-page` (height), `j5`. 150 s: `checkout`, `designer`, `security-r6`.

## Screenshots written by e2e

| Spec | Output |
|---|---|
| `models.spec.ts` | `docs/screenshots/models/<code>.png` |
| `catalogue-models.spec.ts` | `docs/screenshots/models/catalogue/` (labelled contact sheets) |
| `catalogue.spec.ts` | `docs/screenshots/audit/catalogue/` |

A full run rewrites these committed PNGs. Commit them only when the change is intended. The other folders under `docs/screenshots/` come from audit tools and scripts.

## Other checks

- `npm run lint`, `npm run typecheck`.
- `npm run test:size` (`scripts/check-bundle-size.mjs`) after a build: non-3D pages must stay under 200 KB gzip first-load JS and must not ship three.js. 3D routes (`/design`, `/s/`, `/dev/`) are reported, not gated.
- `npx tsx scripts/generate-i18n-scopes.ts --check`, `npx tsx scripts/generate-route-slugs.ts --check`, `node scripts/codemods/debarrel-ui.mjs --check`.

## Pitfalls

- A stale `next-server` on 3100 makes e2e test an old build. Always `pkill -f next-server` first.
- Do not use `prisma db push --force-reset` (Prisma refuses it from an agent). Use a fresh `ELBA_DATABASE_URL=file:./merge-check.db`.
- Specs that change seeded rows (Nile Pack capabilities, ELB-26201, ELB-26301) restore or reset them; follow that pattern.
- Scope locators to `main` and to the specific list (vendor R7-03, R2-10): the header and toasts repeat text.
- Under load some specs time out (five did on the Worker run); re-run them with `--workers=1` before calling them failures.
