# Simplicity round: follow-up agent (2026-11-07)

Picks up the "Left" items of `designer.md`, `flows.md` and `marketing.md`. All work is uncommitted.
The owner's Turbopack dev server on :3000 must never be stopped; e2e runs use a separate build
(`NEXT_DIST_DIR=.next-e2e`) served on :3100.

## Status

- [x] 1. e2e specs follow the new designer (Basics / All options) and the 3-step checkout
- [x] 2. Toasts above the designer's phone bottom bar
- [x] 3. Buyer-path jargon: box detail chip, designer picker list, order item board grade
- [x] 4. Catalog page height on phone
- [x] 5. Sign-in: name/terms/marketing only for new accounts

## Final checks (2026-11-07)
- e2e, desktop, final build with every change: 17 specs (smoke, designer, checkout, checkout-states,
  checkout-quote, checkout-share-guard, a11y, journey, security-r6, admin-quote-price, catalogue,
  catalogue-order-modes, storefront, journeys j1/j2/j4/j5): 67 passed, 3 skipped (mobile-only), 0 failed.
- Not run: the mobile project, `models.spec.ts` (370 models, edited only to use All options).
- `npx tsc --noEmit -p .` clean; `npm run lint` 0 errors (1 existing warning); scopes regenerated.
- `npx vitest run`: 9,034 passed; failing: css-chunking + cloudflare (known Windows line endings) and
  `r7-audit-in-transaction` (SQLite timing under full load, passes alone: 6/6).
- `.next-e2e`, `prisma/e2e-followup.db*` deleted; tsconfig.json / next-env.d.ts reverted; screenshots the catalogue spec rewrites reverted.

## Left
- Run the mobile project for the edited specs (`basicsPanel` opens the phone sheet; untested on phones).
- Tabs inside All options keep their names (e2e uses them); the gate dialog title "Create your free
  account" also shows for returning buyers.

### 5. Sign-in for returning buyers (SIM-12)
- Usage check before task 5: weekly 93%.
- `src/components/auth/OtpForm.tsx`: the code step shows only the code field. Name, terms and the
  marketing tick appear after the server answers `TERMS_REQUIRED` (new phone; the code stays
  valid), announced as a polite notice with focus on the terms box; a second Verify without the
  tick is an error as before. "Change number" hides them again. Server unchanged.
- e2e: `verifyNewAccount()` in `e2e/fixtures/factory.ts` (checks the fields are absent, Verify,
  terms focused, marketing unticked, tick, Verify); used by `checkout`, `designer`, `journey`,
  `smoke`, `storefront`, `journeys/j1`. New smoke test: a returning buyer sees no ticks.

## How the e2e runs are done (do not touch the :3000 dev server)

- Separate SQLite DB: `ELBA_DATABASE_URL=file:./e2e-followup.db` (`npx prisma db push --skip-generate && npx prisma db seed`).
- Build: `ELBA_DATABASE_URL=file:./e2e-followup.db NEXT_DIST_DIR=.next-e2e npm run build`, then
  `git checkout -- tsconfig.json next-env.d.ts` (Next adds `.next-e2e` to both).
- Run: same two env vars plus `E2E_PORT=3100 OTP_DEV_ECHO=1 ALLOW_MOCK_PAYMENTS=1 ELBA_E2E=1`,
  `npx playwright test <specs> --project=desktop --workers=2 --trace off --reporter=line`.
- Clean up at the end: `rm -rf .next-e2e prisma/e2e-followup.db*`, revert tsconfig/next-env again.

## Log

### 1. e2e specs (edited)
- `e2e/fixtures/factory.ts`: `designerAllOptions(context)` (init script sets `elba.designer.mode=advanced`).
- `e2e/journeys/helpers.ts`: `basicsPanel(page, locale)` (opens the phone sheet); `designToPayStep` uses the Basics colour.
- `designer.spec.ts`: new Basics test (logo + name on the 3D box, saved on the same side, All options remembered); the other editor tests call `designerAllOptions`.
- Checkout to 3 steps: `checkout`, `checkout-states`, `checkout-quote`, `a11y`, `journey` (now designs in Basics), `security-r6`, `admin-quote-price`, `catalogue-order-modes`, `journeys/j1, j2, j4, j5`.
- `catalogue.spec.ts`, `a11y.spec.ts` open the picker from "Change box type" (Basics). `models.spec.ts` uses All options.
- `storefront.spec.ts`: FAQ comment updated, asserts the FAQ heading.
- Also fixed (pre-existing breakage from today's export modal): dialog is now "Export your design"
  (`designer.spec.ts`, `catalogue-order-modes.spec.ts`); the crop test targets the Artwork tab's own
  file input (the stage has a hidden one first in the DOM).
- Run 1 (12 specs, desktop): 43 passed, 3 skipped, 4 failed (the export-modal / crop ones above, fixed).

### 2. Toasts above the phone bar
- `DesignerApp.tsx`: ResizeObserver on the bottom bar sets `--e-toast-offset` on `<html>` (0 / removed when hidden, removed on unmount).
- `ui/Toast.module.css`: `.Region { inset-block-end: var(--e-toast-offset, 0px) }`. Roles/live regions unchanged.

### 3. Jargon
- `/design` picker list (`ModelLinks` → `ModelPicker` card): plain kind ("علب بريدية وصواني") under the name, code in small print (`.modelCode`). New optional `ModelCard.kindName`; `plainKindName()` in `src/data/catalogue/taxonomy.ts` strips "(FEFCO 02)" from the English names. Search placeholder without a code (`library.*.ts`).
- Box detail chip (`src/components/store/StructureDetail.tsx`, used by `/boxes/[structure]` and `/[size]`): plain kind first, "(FEFCO 0427)" as `<small>`.
- Order page item line: «كرتون بني طبيعي» / «كرتون أبيض» (`buyer.easy.board.*`); the grade («كرتون مضلع E كرافت») is under «تفاصيل العلبة».

### 4. Catalog on phone
- Usage check before task 4: weekly 93%.
- `CatalogueBrowser.tsx` + `catalogue.module.css`: below 480 px container width each family in the default view is one swipeable shelf (`.shelf`) of its 12 cards. Measured on the dev server: /ar/catalog at 390 px = 7,217 px (was ~22,000); desktop unchanged (16,524 px). All cards stay in the HTML.
