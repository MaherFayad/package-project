# Deploy Elba to your own Cloudflare account (quickstart)

This is the short version of [DEPLOY-CLOUDFLARE.md](DEPLOY-CLOUDFLARE.md), for putting your own copy of the site online. It takes about 30 minutes. You need a computer with Node 20 or newer and Git. Linux, macOS or Windows (Git Bash) all work.

## Demo copy (for feedback) or real store

Pick one before you start:

| | **Demo copy** (recommended for showing friends) | **Real store** |
|---|---|---|
| Address | `https://<name>.<subdomain>.workers.dev` only | Your own domain |
| Sign-in | The 6-digit code is shown on screen. No SMS needed. Demo phones: admin `01000000001`, buyer `01000000002`, printers `01000000010` to `01000000015`. Any other Egyptian mobile number works too. | Needs an SMS or WhatsApp provider. The sending code is an empty stub (`sendOtpSms` in `src/lib/auth/otp.ts`), so nobody can sign in yet. |
| Payment | A fake gateway with "pay" buttons. No money moves. | Paymob keys |
| How | `ELBA_DEMO_SITE`, `OTP_DEV_ECHO` and `ALLOW_MOCK_PAYMENTS` set to `1` (step 3) | Leave them out |

Demo mode only switches on when the address ends in `.workers.dev` (`isDemoSite()` in `src/lib/env.ts`). On a custom domain it stays off even if the variables are set, so a demo copy can't turn into an open real store by mistake. Everyone who opens a demo copy can sign in as the demo admin, so share the link only with people you trust, and never put real customer data in it.

## Accounts you need

1. **Cloudflare** with **Workers Paid** ($5 a month): Dashboard → Workers & Pages → Plans. The free plan's 3 MiB size limit is too small for this app (the built Worker is about 5.4 MiB gzip).
2. **Neon** (free tier): create a project in **AWS Europe (Frankfurt)**. Copy the **direct** connection string, the one **without** `-pooler` in the host. It looks like `postgresql://USER:PASSWORD@ep-xxxx.eu-central-1.aws.neon.tech/neondb?sslmode=require`. Below it is called `NEON_URL`.

## 1. Get the code

```bash
git clone https://github.com/MaherFayad/package-project.git elba
cd elba
npm install
npx wrangler login
```

## 2. Create the Cloudflare resources

```bash
npx wrangler hyperdrive create elba-db --connection-string="NEON_URL"
npx wrangler r2 bucket create elba-files
npx wrangler r2 bucket create elba-next-cache
```

The first command prints an `id`. Keep it for the next step.

## 3. Edit `wrangler.jsonc`

Change only these lines:

```jsonc
"name": "elba",   // any name for your Worker; if you change it, change "service" under "services" to the same name
...
"hyperdrive": [{
  "binding": "HYPERDRIVE",
  "id": "PASTE_THE_HYPERDRIVE_ID_HERE",
  "localConnectionString": "postgresql://elba:elba@localhost:5432/elba_check"
}],
...
"vars": {
  "NEXT_PUBLIC_SITE_URL": "https://elba.YOUR-SUBDOMAIN.workers.dev",   // or your own domain
  "TRUST_CF_CONNECTING_IP": "1",
  // Demo copy only (delete these three lines for a real store):
  "ELBA_DEMO_SITE": "1",
  "OTP_DEV_ECHO": "1",
  "ALLOW_MOCK_PAYMENTS": "1"
}
```

Your `workers.dev` address is shown under Workers & Pages → your account's subdomain. The full address is `https://<worker name>.<subdomain>.workers.dev`.

## 4. Set the secrets

Run each command. Each one asks you to type or paste the value:

```bash
npx wrangler secret put SESSION_SECRET      # 32+ random characters: openssl rand -hex 32
npx wrangler secret put CRON_SECRET         # any long random string: openssl rand -hex 32
```

Optional, only when you have them:

| Secret | For |
|---|---|
| `PAYMENTS_PROVIDER` = `paymob`, plus `PAYMOB_API_KEY`, `PAYMOB_SECRET_KEY`, `PAYMOB_PUBLIC_KEY`, `PAYMOB_HMAC_SECRET`, `PAYMOB_INTEGRATION_ID_CARD`, `PAYMOB_INTEGRATION_ID_WALLET`, `PAYMOB_INTEGRATION_ID_KIOSK`, `PAYMOB_INTEGRATION_ID_INSTAPAY` | Online payment |
| `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` | WhatsApp webhook |
| `BOSTA_API_KEY`, and `SHIPPING_PROVIDER` = `bosta` | Shipping |

**Never** set `ELBA_E2E` or `ELBA_DEV_PAGES` on a deployed copy, and on a real store leave out `OTP_DEV_ECHO` and `ALLOW_MOCK_PAYMENTS` too. The app ignores all four on `https://` anyway, except the two demo flags on a demo copy.

## 5. Create the database tables and load the data

```bash
ELBA_DATABASE_URL="NEON_URL" npm run db:migrate:pg
npx prisma generate --schema prisma/postgres/schema.prisma
ELBA_DATABASE_URL="NEON_URL" npx prisma db seed
npx prisma generate
```

The seed **deletes everything** in that database. It then loads the catalogue, materials and price cards, plus demo accounts and demo orders. That's fine for a test copy. Never run it on a database with real orders.

## 6. Build and deploy

```bash
ELBA_DATABASE_URL="NEON_URL" npm run cf:build
npm run cf:deploy
```

The build needs `ELBA_DATABASE_URL` because it prerenders pages with live prices. Repeat these two commands for every update (`git pull` first).

## 7. Check it

- Open `https://<your address>/api/health`. It should show `{"runtime":"workers","facts":true,"db":"ok"}`.
- Open `https://<your address>/ar`: the site in Arabic. `/en` is English.
- Open `https://<your address>/ar/design/mailer-box`: the 3D designer.
- Demo copy: open `https://<your address>/ar/login`, enter `01000000001`. The code appears under the form. You are now the demo admin (`/ar/admin`).

## When something fails

| Symptom | Fix |
|---|---|
| `cf:build` fails with "Can't reach database server" | `ELBA_DATABASE_URL` is missing or is the `-pooler` URL. Use the direct one. |
| Deploy says the Worker is too large | You are on the Workers Free plan. Subscribe to Workers Paid. |
| `/api/health` shows `"db":"error"` | Wrong Hyperdrive id in `wrangler.jsonc`, or the Hyperdrive was created with a different Neon URL. Run `npx wrangler hyperdrive list` to check. |
| Pages are empty or prices are missing | Step 5 was skipped. Seed the database, then build and deploy again. |
| Local `npm run dev` breaks after a Cloudflare build | Run `npx prisma generate` to restore the local SQLite client. |

To run it on your own computer instead: `cp .env.example .env`, `npm run db:push`, `npm run db:seed`, then `npm run dev`, and open http://localhost:3000. Locally the login code is shown on screen. Demo phone numbers: admin `01000000001`, buyer `01000000002`, printers `01000000010` to `01000000015`.

## Deploying from a Claude Code cloud session

Cloud sessions reach the internet only through an HTTPS proxy, so port 5432 is closed even with Unrestricted network access. Add `ELBA_NEON_HTTPS=1` to the seed and build commands: they then use Neon's serverless driver over WebSocket on port 443 (`src/lib/db.ts`). The Worker itself still uses Hyperdrive.

```bash
ELBA_NEON_HTTPS=1 ELBA_DATABASE_URL="NEON_URL" npm run cf:build
```
```bash
npx opennextjs-cloudflare deploy -c wrangler.demo.jsonc
```

Headless Chromium in a cloud session gets a redirect loop on asset paths with `%5B` or `%40` (the session proxy decodes them and Cloudflare redirects to the encoded form). curl and real browsers get 200. To test a deployed copy from a session, route the page's requests through Playwright's `route.fetch()`.
