# Admin console

## Purpose

The operations console at `/{locale}/admin` (role ADMIN). It covers the overview KPIs and funnel, orders (reassign, override, refund, QC review, ship, notes), printers and applications, users and PDPL requests, catalogue settings, pricing, payouts, disputes and reprints, the price-request inbox, moderation and the audit log. Almost everything is a server action; the only admin API route is `GET /api/admin/users/[id]/export`.

## Guards

- `src/app/[locale]/admin/layout.tsx`: `requireRole("ADMIN")`, nav badges (QC pending, paid orders awaiting a printer, applications, disputes, data requests, payouts to act on, moderation, open quote leads).
- Every page calls `requireAdminPage()` first (R6-SEC-09); `orders/[number]/page.tsx` uses `requireRole("ADMIN")` instead. Admin sessions expire 12 hours after creation.
- Every mutation calls `adminForMutation()` (`src/components/admin/server/context.ts`) and `audit(actor, entry, tx?)`, which writes an `AuditLog` row (actor id and phone, action, entity, summary, before/after, IP).
- Detail routes (`orders/[number]`, `vendors/[slug]`, `vendors/applications/[id]`, `users/[id]`, `disputes/[id]`) check the record in `layout.tsx` above `<Suspense>` so a missing id answers a real 404 (R5-PL-03). `AdminFrame` passes `boundary={false}` to `ui/Frame`.

## Pages

| Page | Loader | Main components |
|---|---|---|
| `(overview)` | `loadOverview`, `loadCheckoutSettings` | KPIs, funnel (`lib/metrics.ts`) |
| `orders`, `orders/[number]` | `loadOrderRows`, `loadOrderDetail` | `OrdersIndex`, `OrderActions`, `PayoutActions` |
| `vendors`, `vendors/[slug]`, `vendors/applications/[id]` | `loadVendorRows`, `loadVendorDetail`, `loadApplication` | `VendorsIndex`, `VendorActions`, `HealthBadge` |
| `users`, `users/[id]`, `privacy` | `loadUsers`, `loadUser`, `loadDataRequests` | `DataRequestActions` |
| `catalog` | `loadCatalog` | `CatalogManager`, `CatalogModels` |
| `pricing` | `loadPricingSettings`, `loadCheckoutSettings`, `loadOnTimeMinDeliveries` | `PricingForms`, `CheckoutSettingsForm`, `VendorMetricsForm` |
| `payouts` | `loadPayoutRows` | `PayoutsIndex` |
| `disputes`, `disputes/[id]` | `loadDisputes`, `loadDispute` | `DisputeDecision` |
| `quotes` | `loadQuoteLeads`, `loadQuoteVendors`, `loadPricingConfig` | `QuoteLeadsIndex`, `QuoteSendPrice` |
| `moderation` | `loadModeration` | `ModerationQueue` |
| `audit` | `loadAudit` | `AuditIndex` |

Loaders live in `src/components/admin/server/queries.ts` and `settings.ts`; pure rules in `src/components/admin/lib/`.

## Actions (`src/components/admin/server/actions.ts`)

| Action | What it does |
|---|---|
| `reassignOrderAction` | Move an order to another ACTIVE printer (from PENDING_PAYMENT, PAID, PROOF_APPROVED, ACCEPTED). Asks for a buy price when the new printer has no card or does not list the model. Deletes unpaid ADVANCE rows (R4-01). Notifies the new printer |
| `overrideOrderAction` | Price or cost override with an `updatedAt` lock |
| `refundOrderAction` | Claims each PAID payment, calls the provider `refund()`, then `transitionOrder("REFUNDED")` (credit note), deletes PENDING payouts |
| `reviewQcAction` | Approve (READY_TO_SHIP) or reject with a note of at least 3 characters (IN_PRODUCTION) |
| `shipOrderAction`, `addOrderNoteAction` | Ship from READY_TO_SHIP; a note stored only in the audit log |
| `payoutStepAction` | RAISE, APPROVE, PAY. A BALANCE is held while a dispute is open; paying a BALANCE needs the e-invoice checkbox |
| `decideDisputeAction` | REVIEW, REPRINT, REFUND, REJECT. A reprint creates `<number>-R<n>` as PAID at zero buyer price with a charge-back plan (`planReprint`) |
| `setVendorStatusAction`, `decideApplicationAction` | Suspend, reinstate, verify, unverify; approve or reject an application (checklist enforced, starter rate cards seeded) |
| `savePricingSettingsAction`, `applyIndexUpdateAction`, `previewPricingAction` | Margin, validity, zones, FX and board index (with a preview of every structure x material at 500 units) |
| `saveCheckoutSettingsAction`, `saveVendorMetricsAction` | `PlatformSetting` "checkout" and "vendor-metrics" |
| `quoteLeadStepAction`, `sendQuotePriceAction` | Mark a price request contacted or closed; send a price (PRICED quote, design created for catalogue requests, link `/{locale}/checkout/<designId>?quote=<id>`) |
| `reviewPortfolioAction`, `cleanBioAction`, `reviewBioEditAction` | Moderation of printer photos and bios |
| `updateStructureAction`, `updateMaterialAction`, `updateFinishAction` | Catalogue rows (engine bounds enforced, NONE finish stays active) |
| `decideDataRequestAction` | Completing a DELETE anonymises the user and runs `scrubErasedUserTraces` (blocked for admins, active orders, open disputes) |

Action codes: `AUDIT_ACTIONS` in `src/components/admin/lib/audit.ts` (44 codes), labels `admin.audit.actions.<CODE>`.

## How to add an admin action

1. A zod schema in `src/components/admin/lib/*`.
2. The action in `server/actions.ts`: `adminForMutation()`, parse, rule check, conditional update inside `db.$transaction`, `audit(..., tx)` inside the same transaction.
3. The code in `AUDIT_ACTIONS` and labels in `src/i18n/admin.{en,ar}.ts`.
4. `revalidateAdmin()`, plus `purgeCatalogCache()` if public data changed.
5. Call it from the component with `useAdminAction` (busy state, toast, refresh, field errors). Money inputs use `parseEgpInput`.

New detail page: a `layout.tsx` record guard above Suspense and a `not-found.tsx` one level up.

## Tests

- Unit: `src/components/admin/lib/__tests__/` (`admin-lib.test.ts` and `admin-round2` to `admin-round7`).
- e2e: `e2e/admin.spec.ts` (non-admins sent away, QC review, Arabic at 360 px, payout steps, catalogue availability, moderation, quote lead, reprint with charge-back, reassignment voids the advance, unknown ids 404), `e2e/admin-quote-price.spec.ts`, `e2e/journeys/j4-admin-day.spec.ts`.
- Seeded admin: `01000000001`.

## Pitfalls

- **R6-AD-01 / R7-AD-01**: decimal comma read as thousands. Every money field uses `src/lib/money/input.ts`.
- **R2-02**: hold the balance while a dispute is open. **R4-01**: void the unpaid advance on reassignment.
- **R4-02**: availability must apply the order mode (`withOrderMode`).
- **R4-03, R4-04, R8-AD-01**: funnel counts people, excludes staff, and is a cohort.
- **R5-AD-03**: `leadState` must honour `Quote.status` PRICED even without an audit row. **R4-07**: the quote SLA counts working days (Sunday to Thursday, Cairo).
- **Round 9 (J5)**: `AdminFrame` must not hold `matchMedia` state (it caused hidden duplicate server content).
- **R2-17 (open by choice)**: "Remove verified badge" has no confirmation.
- **R5-CP-11, R5-CP-46, R5-CP-86 (open)**: English audit summaries, raw note codes and English governorates on Arabic pages.
- Postgres `contains` is case-sensitive, so audit search behaves differently in production.
- **Not in the audits, found in code**:
  - Several actions write the audit row outside the transaction (`refundOrderInternal`, `reviewQcAction`, `shipOrderAction`, `setVendorStatusAction`, `decideDisputeAction`, pricing and catalogue updates). A failure can leave a change without its audit row.
  - A refund deletes only PENDING payouts; APPROVED rows stay and PAY is then refused (`PAYOUT_ORDER_CLOSED`).
  - An application can be approved with no starter rate cards when no peer prices a style; nothing warns.
