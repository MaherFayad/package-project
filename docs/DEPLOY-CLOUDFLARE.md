# Deploying Elba on Cloudflare Workers + Neon + R2

Production runs as one Cloudflare Worker built by the OpenNext adapter
(`@opennextjs/cloudflare`). PostgreSQL lives on Neon and is reached through Hyperdrive.
Private files (vendor documents, dispute photos, print PDFs, proof previews) live in R2.
Dev, unit tests and the e2e suite keep running on SQLite and the local disk. The same code
switches at runtime.

| Piece | Service | Plan |
|---|---|---|
| App (SSR, API, middleware, cron) | Cloudflare Workers | **Workers Paid, $5 a month per account.** This is separate from the Pro zone plan. The Free plan's 3 MiB size limit and 10 ms CPU limit are too small. |
| Static files (`public/`, `/_next/static`) | Workers static assets | Included |
| Database | Neon PostgreSQL, via Hyperdrive | Neon Free to start (no overage billing); Hyperdrive is included in Workers Paid |
| Private files | R2 bucket `elba-files` | Free tier (10 GB-month) |
| ISR cache | R2 bucket `elba-next-cache` | Free tier |
| Images (`next/image`) | Cloudflare Images binding | Free tier, then per transformation |
| WAF, DDoS, Polish | Zone on the Pro plan | Already paid |

## How the code adapts

| Concern | Node (dev, e2e) | Workers (production) | Code |
|---|---|---|---|
| Database | SQLite `file:` URL, Rust engine | Postgres client (`engineType = "client"`), pg adapter over `HYPERDRIVE`, **one client per request** | `src/lib/db.ts`, `prisma/postgres/schema.prisma` |
| Schema | `prisma/schema.prisma` (source of truth) | Generated copy `prisma/postgres/schema.prisma` plus migrations in `prisma/postgres/migrations` | `scripts/generate-postgres-schema.ts` |
| Private files | `var/uploads`, `./storage` | R2 binding `ELBA_FILES`, keys `uploads/...` and `storage/...` | `src/lib/storage/blob.ts` |
| Build directory reads (font preloads, 3D chunk preload, optional loop videos) | Read from `.next` and `public/` | `/_elba/build-facts.json`, written after the build and loaded once per isolate by `worker.ts` | `src/lib/runtime/build-facts.ts`, `scripts/cloudflare/write-build-facts.ts` |
| Inline model posters | `fs.readFileSync` | First render per isolate links the URL; the file is fetched from `ASSETS` in the background and inlined from then on | `src/app/model-poster.ts` |
| Client IP | `X-Real-IP` / `X-Forwarded-For` rules | `CF-Connecting-IP` only (`TRUST_CF_CONNECTING_IP=1`); the other headers are client-controlled behind Cloudflare | `src/lib/rate-limit.ts` |
| Daily job | `npm run jobs:daily` or `POST /api/jobs/follow-up` | Cron Trigger `17 6 * * *` calls the same route with `CRON_SECRET` | `worker.ts` |

### Known differences to keep in mind
- **Per-IP rate limits are per isolate on Workers.** `src/lib/rate-limit.ts` keeps its counters in memory, and Workers runs many isolates. The OTP lockout and the per-phone limits are stored in the database, so they still hold. Add Cloudflare WAF rate-limiting rules as the edge backstop (step 9 below).
- **Text search is case-sensitive on Postgres.** Prisma `contains` is case-insensitive for ASCII on SQLite and case-sensitive on Postgres. This affects the admin audit-log search (`src/components/admin/server/queries.ts`). It matters only when an admin searches for a lowercase fragment of a mixed-case value.
- **Build-time prerendering reads the database.** `next build` prerenders the catalogue and marketing pages with live prices, so the build needs `ELBA_DATABASE_URL` set to a reachable Postgres (Neon) with the catalogue seeded.

## One-time setup (founder actions)

1. **Workers Paid:** Cloudflare dashboard, Workers & Pages, Plans: subscribe to Workers Paid ($5 a month).
2. **Neon:** create a project in region **AWS Europe (Frankfurt)**, the closest Neon region to Egypt. Copy the **direct** connection string (not the `-pooler` one); Hyperdrive does the pooling.
3. **Log in:**
   ```bash
   npx wrangler login
   ```
4. **Hyperdrive:**
   ```bash
   npx wrangler hyperdrive create elba-db --connection-string="postgresql://USER:PASSWORD@HOST/neondb?sslmode=require"
   ```
   Put the printed id in `wrangler.jsonc` under `hyperdrive[0].id`.
5. **R2 buckets:**
   ```bash
   npx wrangler r2 bucket create elba-files
   ```
   ```bash
   npx wrangler r2 bucket create elba-next-cache
   ```
6. **Secrets.** Run once per name; each command prompts for its value:
   ```bash
   npx wrangler secret put SESSION_SECRET
   ```
   Names: `SESSION_SECRET` (32+ random characters), `CRON_SECRET`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `BOSTA_API_KEY`, and the payment provider keys. Never set `OTP_DEV_ECHO`, `ALLOW_MOCK_PAYMENTS`, `ELBA_E2E` or `ELBA_DEV_PAGES` in production. As a backstop, the app ignores all four whenever `NEXT_PUBLIC_SITE_URL` starts with `https://` and logs one `[env] ignoring dev-only flags` warning (`devFlag()` in `src/lib/env.ts`); local runs, e2e and a local preview on `http://localhost` keep them.
7. **Site URL:** set `vars.NEXT_PUBLIC_SITE_URL` in `wrangler.jsonc` to the real `https://` domain.
   A feedback copy on `*.workers.dev` can keep on-screen sign-in codes and the fake gateway with `ELBA_DEMO_SITE=1` (see `DEPLOY-QUICKSTART.md`, `isDemoSite()` in `src/lib/env.ts`). It never applies on a custom domain.
8. **Database schema.** Point the migration at the Neon direct URL:
   ```bash
   ELBA_DATABASE_URL="postgresql://USER:PASSWORD@HOST/neondb?sslmode=require" npm run db:migrate:pg
   ```
   Then load the catalogue (structures, materials, rate cards). `prisma/seed.ts` also creates the **demo accounts and demo orders**. Do not run it against production as is: split the catalogue part out first, or delete the demo rows after seeding.
9. **WAF rate-limiting rules** (zone, Security, WAF, Rate limiting rules), as the edge backstop for per-isolate counters:
   - `/api/auth/request-otp`: 10 requests per minute per IP, then block for 10 minutes.
   - `/api/auth/verify-otp`: 20 requests per minute per IP, then block for 10 minutes.
10. **Custom domain:** Workers & Pages, `elba`, Settings, Domains & Routes: add the domain on the Pro zone.

## Every deploy

```bash
ELBA_DATABASE_URL="postgresql://USER:PASSWORD@HOST/neondb?sslmode=require" npm run cf:build
```
```bash
npm run cf:deploy
```

`cf:build` does five things in order:
1. regenerates the Postgres schema;
2. generates the Postgres Prisma client;
3. runs `opennextjs-cloudflare build` (which runs `next build`);
4. writes `/_elba/build-facts.json`;
5. regenerates the SQLite client, so local dev keeps working.

When `prisma/schema.prisma` changes:
1. Run `npm run db:schema:pg`.
2. Create a migration:
   ```bash
   ELBA_DATABASE_URL="postgresql://..." npx prisma migrate dev --schema prisma/postgres/schema.prisma --name <change>
   ```
3. Apply it with `npm run db:migrate:pg` before deploying.

The unit test `src/lib/__tests__/cloudflare.test.ts` fails when the Postgres copy is stale.

## Local checks

- **Postgres in Node** (the closest thing to production that runs the e2e suite):
  ```bash
  ELBA_DATABASE_URL=postgresql://elba:elba@localhost:5432/elba_check npx prisma generate --schema prisma/postgres/schema.prisma
  ```
  Then run `npm run db:migrate:pg`, `npx prisma db seed`, `npm run build`, and the Playwright suite as usual.
- **The Worker itself:** run `npm run cf:build`, then `npm run cf:preview`. This runs workerd locally with the Hyperdrive `localConnectionString` from `wrangler.jsonc` and local R2.

## Verification log (local Worker, 2026-11-07)

- `wrangler deploy --dry-run`: **5.4 MiB gzip** (25 MiB raw), under the Workers Paid 10 MiB limit. With `inlineCss` on it was 14.3 MiB, which is why the Cloudflare build turns it off (`next.config.ts`).
- `wrangler dev` (workerd) against local Postgres 16 through the Hyperdrive `localConnectionString`, with local R2:
  - `/api/health` answered `{"runtime":"workers","facts":true,"db":"ok"}`;
  - OTP sign-in, sessions and authenticated pages worked across repeated requests, with no cross-request I/O errors.
- **Full Playwright suite against that Worker: 760 passed, 7 failed.**
  - 2 were the malformed-URL 500, fixed in `worker.ts` (now 400, as on Node).
  - 5 were timeouts under load (checkout, J1, share price, R6-SEC-10, storefront); all 5 passed on a single-worker re-run. Locally one workerd process served two parallel browsers.
- The same suite on Node and SQLite: 767 passed, 0 failed.
