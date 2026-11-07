# Printer portal and admin console: fixes (2026-11-08)

Fixes for `portals-review.md`. Each portal fixer adds its own section below.

## Admin console

Scope: `src/components/admin/**`, `src/app/[locale]/admin/**`, `src/i18n/admin.{en,ar}.ts`, admin tests, and the admin steps in the e2e journeys. Nothing in `src/lib/orders`, `src/lib/pricing`, `src/lib/configurator` or `src/components/vendor` was edited. Screenshots (1440x900, ar and en): `C:\Users\Admin\AppData\Local\Temp\claude\f8173f44571ee159\d92726ee-f788-4602-8df6-7bcebbbfc7a0\scratchpad\portals-fix\admin\`.

| ID | Status | What changed |
|---|---|---|
| A-01 | Fixed (UI and action) | One confirmed **Mark paid** per payout part, from any unpaid state. `payoutStepAction` with step `PAY` now also raises and approves in the same transaction, with one audit row for each step, so the trail still reads raise → approve → pay. The dialog names the order, the part, the vendor and the amount, and the confirm button repeats the amount ("Mark paid: EGP 6,098.18"). The balance still needs the e-invoice tick. Payouts show one "To pay now" total, and the status labels read "To pay" / "Approved, to pay". |
| A-01 auto-raise | Already in place | `src/components/vendor/server/actions.ts` (accept) already creates the ADVANCE payout row on a portal accept. Seeded or older accepted orders (ELB-26301) have no row; with one-step pay that no longer costs ops a click. No lib change is needed. |
| A-05 + A-14 | Fixed | One `ConfirmDialog` (refund pattern) for QC approve ("releases the batch, cannot be undone here, 60% balance X becomes due after delivery"), courier booking ("books a real pickup from vendor to city, governorate; cannot be cancelled here"), reassign ("vendor A loses the job, vendor B must accept again, buy price X ex-VAT, unpaid advance cancelled") and every payout. Refund was already confirmed. |
| A-02 | Fixed (display) | One margin definition everywhere in admin: the share of the ex-VAT sale price. `settingsMarginPct(markup, prepay)` converts the pricing setting (25% markup, 3% prepay) into the order-side figure (17.5%). An order is flagged "below" only when it earns less than the current settings give (0.5 pt slack), or on a loss. The order page shows "17.5% of the sale price" under the margin. The pricing page help shows both figures, and its warning now checks the order-side figure against the 20–30% plan. |
| A-03 | Fixed | The order page Payment card lists the item lines, then the quote's extra lines (setup, prepay discount), then any leftover as "Other price change (manual override or rounding)", ending in "Goods after discount". ELB-26307: 18,305.00 + 750.00 − 571.65 = 18,483.35. |
| A-04 | Fixed | `AWAITING_VENDOR_STATUSES` (PAID, PROOF_APPROVED) and `ORDERS_TO_ACT_STATUSES` in `lib/orders.ts` drive the orders tab, the overview to-do and the nav badge. A new tab and metric, **Awaiting payment** (PENDING_PAYMENT), takes the unpaid orders out of "Awaiting vendor". Now: 11 awaiting vendor everywhere, badge 12 = 11 + 1 QC. |
| A-06 | Fixed | On every screen size the to-do list is the first thing on the overview, above the KPIs and the funnel. |
| Next action | Added | A "Next step" banner on every order: the status-specific action, plus the payout owed ("Owed to Obour: 40% advance, EGP 6,098.18"). |
| A-07 | Partly fixed | Timeline: "PREFLIGHT:1E/0W:ACK" now reads "the buyer approved with 1 print-check issue(s)…", and the payment note "CARD" shows the method label. Address governorate in the page language. The order page QC confirm uses the localized ship destination. **Open:** audit summaries are stored as English strings ("ELB-26307 advance (Obour…): 6098.18 EGP"); localizing them needs structured audit data (R5-CP-11). |
| A-08, A-09, A-10 to A-13 | Open | Not done in this pass. A-10 needs a city-to-governorate list (checkout). A-09 needs a per-vendor price for this job (`src/lib/configurator`). |

**Clicks per order (happy path, admin):**
- Before: about 13 (open queue and order 2, QC 1, ship 1, advance 3, balance 4, reopen 2), with no confirmations on QC, ship, raise or approve.
- After: about 10. The flow is open queue and order (2), QC + confirm (2), ship + confirm (2), advance pay + confirm (2), balance pay + tick + confirm (3), with the advance and balance usually done from /admin/payouts without reopening the order. Every money or irreversible step is now confirmed with its amount.

**Lib changes for the owners (not made here):**
1. `src/lib/orders/state.ts`: allow READY_TO_SHIP → QC_PENDING (ADMIN) while no shipment exists. This is the review's "undo QC approve" (A-05).
2. Checkout: validate city against governorate (A-10 / P-12).
3. The audit `summary` is English text. To show it per locale (A-07), store the parts (`{ order, kind, vendorId, amountPiasters }`) in `after` and render the summary per locale.

**Owner decision:** with a 25% markup and a 3% prepay discount, every order earns 17.5% of the sale price. That is below the business plan's 20–30% take rate. The pricing page now says so in one place, instead of a warning on every order. A 28.9% markup gives 20% after the discount.

**Checks:**
- `tsc`: clean for admin. The remaining errors are in `vendor/(portal)/page.tsx`, the printer fixer's work in progress.
- eslint is clean on the changed files.
- vitest (`src/components/admin`, `src/i18n`) passes, including a new `admin-simplicity.test.ts`.
- The i18n scopes were regenerated, and `--check` passes.
- 16 Playwright screenshots, with no console errors.
- e2e specs were updated for the dialogs (admin, journey, j1, j3, j4, j5) but not run.
