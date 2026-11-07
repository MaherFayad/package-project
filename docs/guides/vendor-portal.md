# Vendor portal (printers)

## Purpose

Printer staff (role VENDOR, `User.vendorId` set) use `/{locale}/vendor` to apply, take paid jobs through production, upload QC photos, download the dieline and print PDF, keep their profile, portfolio, special-gluing listings and rate cards current, and follow payouts. Vendors never see buyer contact details: first name and city only, and only their own price ("Elba handles all buyer contact").

## Key files

| Path | Role |
|---|---|
| `src/app/[locale]/vendor/apply/page.tsx`, `ApplyForm` | Onboarding application |
| `src/app/[locale]/vendor/(portal)/layout.tsx` | `requireVendorContext`: VENDOR (or ADMIN). States: not linked, PENDING, SUSPENDED banner. Nav badge from `countAwaiting` |
| `(portal)/page.tsx`, `jobs`, `jobs/[number]`, `payouts`, `profile`, `rate-cards`, `rate-cards/[id]` | Dashboard, job list and detail, payouts, profile, rate cards |
| `src/components/vendor/server/context.ts` | `vendorForMutation()` (VENDOR or ADMIN, linked vendor, not PENDING, SUSPENDED refused unless allowed), `runAction` |
| `src/components/vendor/server/actions.ts` | `acceptJob`, `startProduction`, `submitQc`, `declineJob`, `addJobNote`, `deleteQcPhoto`, `saveProfile`, portfolio actions, `saveRateCard`, `submitApplication` |
| `src/components/vendor/server/queries.ts` | `listJobs`, `getJob`, `getDashboard`, `getPayoutRows`, `listRateCards`, `getRateCard`, `getProfile` |
| `src/components/vendor/server/storage.ts` | `saveUpload` (magic bytes, metadata stripped), `readUpload`, `deleteUpload` |
| `src/components/vendor/lib/jobs.ts` | Job actions, `can()`, `hasRequiredQcPhotos`, `DECLINE_REASONS`, `DUE_SOON_DAYS = 3` |
| `src/components/vendor/lib/payouts.ts` | `ADVANCE_SHARE = 0.4`, `splitVendorCost`, `payoutSchedule`, badges |
| `src/components/vendor/lib/rateCard.ts` | `RATE_LIMITS`, `validateRateCard`, `rateUnit` |
| `src/components/vendor/lib/contact.ts`, `profile.ts`, `bio-review.ts` | Contact-detail filter, profile schema, bio review data |
| `src/components/vendor/lib/files.ts` | `UPLOAD_SCOPES`, `UPLOAD_RULES`, `canReadFile` |
| `src/app/api/vendor/uploads/route.ts` | Multipart uploads: `qc`, `portfolio`, `cert`, `apply` |
| `src/app/api/vendor/files/[...key]/route.ts` | Serves private files through `canReadFile` (refusal is 404) |
| `src/app/api/vendor/jobs/[id]/{dieline,print-pdf}` | Production files (print PDF locked until ACCEPTED) |
| `src/i18n/vendorPortal.{en,ar}.ts` | Strings |

## Job flow

```
PAID / PROOF_APPROVED --accept--> ACCEPTED --start--> IN_PRODUCTION --submit QC--> QC_PENDING
                    \--decline (event VENDOR_DECLINED, status unchanged)
QC_PENDING --admin approve--> READY_TO_SHIP --ship--> SHIPPED      (reject: back to IN_PRODUCTION)
```

- Every move goes through `moveJob()`: `can()` (job rules), `assertTransition(from, to, "VENDOR")`, a conditional `updateMany` on the current status, then a `ProductionEvent`.
- Accepting creates the 40% ADVANCE payout (PENDING). The BALANCE follows delivery; admin raises, approves and pays both.
- Submitting QC needs one FIRST_SHEET and one PACKED_BUNDLE photo that are not rejected. At most 20 QC photos per order.
- Notes (`addJobNote`, 30/min) never reach the buyer.

## Onboarding

1. `/vendor/apply` (`submitApplication`, 5/h, one open application per user) creates a PENDING `Vendor`, a SUBMITTED `VendorApplication` and a `Consent` row. Documents are the applicant's own `apply` uploads.
2. Admin approves in `/admin/vendors/applications/[id]` (`decideApplicationAction`): vendor ACTIVE and verified, `seedStarterRateCards()` copies the median peer card per style and board as **paused** cards, the applicant becomes VENDOR.
3. The vendor reviews each starter card and switches it on. Nothing else creates rate cards: the portal only edits them.

## Rate cards

- Editor limits (`RATE_LIMITS`): up to 8 tiers, quantity up to 100,000, unit up to EGP 5,000, up to 20 standard dies, die tolerance 2 mm. The first tier must be at most 100, quantities rise, prices do not.
- Input is EGP with decimals, stored as piasters. A decimal comma ("18,50") is invalid (R7-AD-01).
- The vendor cannot change `referenceAreaM2` or `validFrom`. Saving calls `purgeCatalogCache()`.
- `docs/business/rate-card-how-to.md` is partly stale: it lists 6 structures and 5 materials (the code has 16 and 15), exactly 5 tiers, and says admins edit vendor-level fields. In code the vendor edits capabilities, MOQ, lead time and service areas on `/vendor/profile`.

## Files and visibility

| Scope | Max | Types | Who reads |
|---|---|---|---|
| `qc` | 10 MB | images | vendor, admin; buyer only once APPROVED |
| `portfolio` | 8 MB | images | public only once APPROVED |
| `cert`, `apply` | 10 MB | images, PDF | vendor (own), admin |
| `dispute` | 10 MB | images | buyer, admin (never the vendor) |

Never SVG. Metadata (EXIF GPS, PNG text chunks) is stripped on upload (R4-04).

## Common changes

- **New job action**: `JobAction`, `allowedActions`, `nextStatus`, `eventFor` in `lib/jobs.ts`; check the edge in `src/lib/orders/state.ts`; a wrapper in `actions.ts` through `moveJob`; tests in `vendor-lib.test.ts`.
- **New profile field**: `profileSchema` (`lib/profile.ts`), `ProfileForm.tsx`, `saveProfile`, `getProfile`, `types.ts`. Run public text through `splitContact`.
- **New upload scope**: `UPLOAD_SCOPES`, `UPLOAD_RULES`, `canReadFile`, and the branch in `uploads/route.ts`.
- **Rate card rule**: `validateRateCard`; error codes map to `vendorPortal.rateCards.errors.<CODE>`.

## Tests

- Unit: `src/components/vendor/lib/__tests__/` (`vendor-lib`, `coverage`, `contact` with bypass and false-positive corpora, `bio-review`, `dispute-scope`).
- e2e: `e2e/vendor.spec.ts` (clones ELB-26201 per run: accept, start, QC; other vendors get 404; portfolio privacy; buyers kept out; Arabic at phone width; listed models; notes and unreviewed QC hidden from the buyer; bio review), `e2e/checkout-vendor-view.spec.ts`, `e2e/journeys/j3-printer-onboarding.spec.ts`.
- Seeded staff: Nile Pack `01000000010`, Delta Cartons `01000000011` (and `...12` to `...15`).

## Pitfalls

- **B-08, R4-02, R6-01 to R6-04**: the contact filter is an arms race. Text is folded (NFKC, look-alikes, number words, keycaps) and fields are checked joined. Keep the precision corpora clean.
- **R4-01 / R4-09**: free-text notes must never reach the buyer timeline; decline details are flattened by `declineNote`.
- **R4-03**: buyers see QC photos only once approved.
- **R4-05 / R4-06**: a special-gluing model is instant only when listed; coverage counts must respect order mode.
- **R2-01**: show `OrderItem.modelCode`, not only the base structure.
- **Fixed (R7)**: `moveJob` used to skip the advance when the order had any ADVANCE row, so after a reassignment where the old advance was PAID the new printer got none. It now counts only the accepting printer's own rows (`advanceOnAccept`, read inside the transaction), so each printer gets its advance exactly once; the old printer's unpaid advance is still voided by the reassignment.
- **Still open**: V-21 / R2-11 dieline SVG labels in English and small (3d-engine E-59 addressed part), R2-12 portal phone LCP, CR-42 placeholder seed portfolio.
- `capabilities.monthlyCapacityUnits` is collected and shown but not used in pricing or matching.
