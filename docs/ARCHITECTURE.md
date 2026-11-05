# Elba (علبة): architecture and team contracts

Elba is a web platform for custom printed packaging in Egypt. Visitors design a box in 3D for free. The platform then prices it from vendor rate cards and takes the order as a managed marketplace (Elba is the merchant of record). Product reasoning is in `docs/research-report.md`. This file covers how the code is organised and the contracts every agent must follow.

## 1. How to run

```bash
npm install                 # also runs `prisma generate`
cp .env.example .env        # first time only
npm run db:push             # create/update SQLite schema (prisma/dev.db)
npm run db:seed             # wipe + seed sample data (idempotent)
npm run dev                 # http://localhost:3000  ->  redirects to /ar
```

| Script | What it does |
|---|---|
| `dev` / `build` / `start` | Next.js dev server / production build / production server |
| `lint` | `eslint .` (flat config, `next/core-web-vitals` + `next/typescript`). `next build` also lints, so lint errors break the build. |
| `typecheck` | `tsc --noEmit` (strict) |
| `test` | Vitest unit tests: `src/**/*.test.ts(x)` and `tests/unit/**` |
| `test:e2e` | Playwright (`e2e/`). Starts `npm run start -p 3100` unless a server is already on 3100, so run `npm run build` first. Uses the preinstalled Chromium at `/opt/pw-browsers/chromium`. **Never run `playwright install`.** Projects: `desktop` and `mobile` (360 px wide). |
| `db:push` / `db:seed` / `db:reset` | Prisma schema push / seed / force-reset and seed |

Seed users (sign in at `/ar/login`; the OTP is shown in the dev banner and logged to the server console):

| Role | Phone |
|---|---|
| ADMIN | `01000000001` |
| BUYER | `01000000002` (owns design "Bloom mailer" and order `ELB-26001`) |
| VENDOR | `01000000010` Nile Pack, `…011` Delta Cartons, `…012` Obour Box Works, `…013` Alex Print House, `…014` Damietta Modern Packaging |

## 2. Environment variables

| Var | Default (dev) | Notes |
|---|---|---|
| `ELBA_DATABASE_URL` | `file:./dev.db` | **Not** `DATABASE_URL`: some hosts and containers pre-set `DATABASE_URL` to an unrelated Postgres. In production, set `provider = "postgresql"` in `schema.prisma` and point this at Postgres. |
| `SESSION_SECRET` | dev fallback | Required in production (32+ chars). Used to hash OTP codes. |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | Canonical URLs, share links, metadataBase |
| `OTP_DEV_ECHO` | `1` | Under `next dev` the OTP is echoed unless this is `"0"`. Under `next start` it is echoed **only** when this is `"1"` (local prod builds and e2e). **Never set it in a real deployment.** |
| `PAYMENTS_PROVIDER` | `mock` | `mock` or `paymob` (adapter in `src/lib/payments`) |
| `PAYMOB_*` | empty | Paymob credentials, used when the provider is `paymob` |
| `SHIPPING_PROVIDER` | `mock` | `mock` or `bosta` (adapter in `src/lib/shipping`) |
| `BOSTA_API_KEY` | empty | |
| `E2E_INSECURE_COOKIES` | unset | If set, the session cookie is sent without `Secure` under `next start`. Only needed when testing over plain HTTP on a host other than localhost. |

## 3. Folder ownership

Edit only what you own. For shared files (`prisma/schema.prisma`, `src/i18n/{ar,en}.ts`, `package.json`, `src/types/*`), make **minimal additive edits** and **re-read the file right before editing**, because other agents edit them in parallel. Do not delete or reformat other people's code.

| Path | Owner |
|---|---|
| `src/components/ui/**`, `src/styles/**` | UI kit |
| `src/lib/dieline/**`, `src/components/three/**` | 3D engine |
| `src/lib/pricing/**` | Pricing |
| `src/app/[locale]/design/**`, `src/components/designer/**` | Designer |
| `src/app/[locale]/(store)/**` (home, catalog, structure/SEO pages, vendors, vendor profile), `src/components/store/**` | Storefront |
| `src/app/[locale]/(checkout)/**`, `src/app/[locale]/orders/**`, `src/lib/{payments,shipping,orders}/**`, `src/app/api/{orders,payments}/**` | Checkout |
| `src/app/[locale]/vendor/**`, `src/components/vendor/**` | Vendor portal |
| `src/app/[locale]/admin/**`, `src/components/admin/**` | Admin |
| `docs/business/**` | Business kit |
| Everything else (`src/lib/auth`, `src/lib/{db,format,phone,json,rate-limit,env}.ts`, `src/i18n/{index,core,client,types}.ts`, `src/types/**`, `src/middleware.ts`, `src/app/[locale]/layout.tsx`, `src/app/[locale]/(auth)/**`, `src/components/auth/**`, `prisma/**`) | Foundation (additive edits allowed, see above) |

The placeholder pages are marked `FOUNDATION PLACEHOLDER — owner: …`. Replace them. Delete `src/components/placeholder/` once nothing imports it.

### Route map

```
src/app/
  layout.tsx                    pass-through (html/body live in [locale]/layout.tsx)
  not-found.tsx                 global 404 (outside a locale)
  fonts.ts                      Inter + IBM Plex Sans Arabic (next/font/google) -> --font-inter / --font-plex-arabic
  api/auth/{request-otp,verify-otp,logout,me}/route.ts
  [locale]/
    layout.tsx                  <html lang dir>, fonts, I18nProvider, skip link. NO chrome.
    not-found.tsx
    (auth)/login/               phone + OTP page                         -> StoreShell
    (store)/                    / (home), /catalog, /catalog/[slug], /vendors, /vendors/[slug] -> StoreShell
    (checkout)/checkout/        -> StoreShell
    orders/, orders/[id]        requireUser                              -> StoreShell
    design/                     full-screen designer (own layout, renders <main id="main">)
    vendor/                     requireRole("VENDOR")  -> admin frame (to build)
    admin/                      requireRole("ADMIN")   -> admin frame (to build)
```

Each area adds its own chrome in its route-group `layout.tsx`. Buyer-facing areas use `StoreShell` from `src/components/store/StoreShell.tsx` (header, `<main id="main">`, footer). Every layout must render exactly one `<main id="main">`, because the skip link targets it.

## 4. Data model (Prisma, `prisma/schema.prisma`)

Conventions:
- **Money is stored as integer piasters** (1 EGP = 100 piasters). Field names end in `Piasters`. Never use floats for money. Format only at the edge with `formatMoney()`.
- **Enum-like columns are `String`**, so the schema works on both SQLite and Postgres. Their allowed values are TS unions in `src/types/*.ts` (`Role`, `OrderStatus`, `PaymentMethod`, …). Validate with zod at API boundaries.
- **Json columns** hold structured blobs: dims, artwork, rate tiers, machines, etc. Write with `toJson(value)` and read with `fromJson<T>(row.col)`, both from `src/lib/json.ts`.
- **Bilingual columns** come in pairs: `nameAr`/`nameEn`, `bioAr`/`bioEn`, `captionAr`/`captionEn`. Pick one with `pick(locale, row.nameAr, row.nameEn)`.
- All ids are `cuid()` strings.

| Model | Key fields |
|---|---|
| `User` | `phone` (E.164, unique), `name`, `role` BUYER/VENDOR/ADMIN, `locale`, `marketingConsent`, `consentAt`, `organizationId?`, `vendorId?` (vendor staff) |
| `Organization` | `name`, `taxId`, `commercialRegister`, `city` |
| `Session` | `tokenHash` (sha256 of the cookie token), `userId`, `expiresAt`, `ip`, `userAgent` |
| `OtpCode` | `phone`, `codeHash`, `expiresAt`, `attempts`, `consumedAt` |
| `Consent` | PDPL log: `userId?`, `phone`, `kind` TERMS/PRIVACY/MARKETING/RETARGETING, `granted`, `textVersion`, `locale`, `ip`, `userAgent` |
| `Vendor` | `slug`, `nameAr/En`, `city` (EgyptCity key) + `cityAr/En`, `bioAr/En`, `logoUrl`, `coverUrl`, `machines` Json `VendorMachine[]`, `capabilities` Json `VendorCapabilities`, `certifications` Json `VendorCertification[]`, `foodSafe`, `rating`, `ratingCount`, `onTimePct` (0–100), `leadTimeDays`, `minOrderQty`, `serviceAreas` Json `EgyptCity[]`, `verified`, `status` |
| `VendorPortfolioItem` | `vendorId`, `imageUrl` (local `/seed/...`), `captionAr/En`, `structureCode?`, `sortOrder` |
| `Structure` | `code` StructureCode, `slug`, `family`, `nameAr/En`, `descriptionAr/En`, `params` Json `StructureParamLimits`, `defaultDims` Json `Dims`, `presets` Json `DimsPreset[]` |
| `Material` | `code` MaterialCode, `family`, `boardType`, `flute`, `color`, `gsm`, `thicknessMm`, `nameAr/En`, `foodSafe` |
| `Finish` | `code` FinishCode, `nameAr/En`, `unitSurchargePiasters`, `setupPiasters` |
| `RateCard` | unique (`vendorId`, `structureId`, `materialId`); `qtyTiers` Json `RateTier[]` (vendor **buy** price per unit, ex-VAT, for `referenceAreaM2`), `setupPiasters`, `dieCostPiasters`, `printSidesSurchargePct`, `finishSurcharges` Json `Partial<Record<FinishCode, piasters>>`, `leadTimeDays` |
| `Design` | `ownerId?` (null means anonymous), `anonId?` (cookie `elba_anon`), `name`, `structureCode`, `dims`, `materialId?`, `finishCode`, `printSides`, `artwork` Json `Artwork`, `thumbnailUrl`, `shareToken?`, `expiresAt?` (anonymous: +30 days) |
| `Proof` | immutable: `designId`, `version`, `snapshot` Json `DesignDoc`, `hash` = sha256(`canonicalJson(snapshot)`), `pdfUrl`, `previewUrl`, `approvedAt`, `approvedIp`, `approvedById` |
| `Quote` | `lines` Json `QuoteLine[]`, `subtotalPiasters`, `vatPiasters`, `shippingPiasters`, `totalPiasters`, `validUntil` (+72 h), `status` |
| `Order` | `number` (e.g. `ELB-26001`), `buyerId`, `vendorId`, `quoteId?`, `status` OrderStatus, money fields, `vendorCostPiasters`, `shippingAddress` Json `ShippingAddress`, timestamps |
| `OrderItem` | `proofId?`, `structureCode`, `dims`, `materialCode`, `finishCode`, `printSides`, `quantity`, `unitPiasters`, `lineTotalPiasters`, `printPdfUrl` (print-ready dieline PDF, **orders only**) |
| `ProductionEvent` | `orderId`, `type` ProductionEventType, `note`, `actorId` |
| `QcPhoto` | `orderId`, `url`, `kind`, `status` PENDING/APPROVED/REJECTED |
| `Shipment` | `provider`, `trackingNumber`, `status` ShipmentStatus, `events` Json |
| `Payment` | `provider`, `method` PaymentMethod, `status`, `amountPiasters`, `providerRef`, `fawryRef`, `raw` |
| `Payout` | `vendorId`, `orderId?`, `kind` ADVANCE/BALANCE, `amountPiasters`, `status` |
| `Invoice` | `number`, `subtotal/vat/totalPiasters`, `etaUuid?`, `etaStatus?` |
| `Review` | `orderId`, `vendorId`, `authorId`, `rating` 1–5, `body` |
| `Dispute` | `orderId`, `openedById`, `reason`, `description`, `status`, `resolution` |

Seed contents: 13 structures, 7 materials, 4 finishes, 5 vendors with 3 portfolio items each, rate cards for every (vendor × structure × compatible material), 7 users, and 1 sample order. Images are local SVGs under `public/seed/{vendors,portfolio,structures}/`, generated by `node scripts/generate-seed-images.mjs`.

Corrugated structures (`FEFCO_0427`, `FEFCO_0201`, `PIZZA`) use the corrugated materials (`E_FLUTE_*`, `B_FLUTE_KRAFT`). Folding cartons (`ECMA_RTE`, `ECMA_STE`, `SLEEVE`, `ECMA_CLB`, `ECMA_SLB`, `GABLE_BOX`) use `SBS_300` and `SBS_350`. `FEFCO_0320` and `FEFCO_0422` are corrugated; `RIGID_BOX` uses `GREYBOARD_WRAP` and `PAPER_TUBE` uses `KRAFT_TUBE`. Rate cards follow the same pairing (same `family`).

Import the client as `import { db } from "@/lib/db"` (server only).

## 5. Shared TypeScript contracts (`src/types/*.ts`, import from `@/types`)

These are the interfaces between agents. Change them only additively (new optional fields, new union members), and say so in your summary.

```ts
// common.ts
type Locale = "ar" | "en";            LOCALES, DEFAULT_LOCALE = "ar"
type Role = "BUYER" | "VENDOR" | "ADMIN";
interface LocalizedText { ar: string; en: string }
type Piasters = number;               // integer, 1 EGP = 100
VAT_RATE = 0.14; QUOTE_VALIDITY_HOURS = 72; ANON_DESIGN_TTL_DAYS = 30; CURRENCY = "EGP"
type Mm = number;
type ConsentKind = "TERMS" | "PRIVACY" | "MARKETING" | "RETARGETING";

// structure.ts
type StructureCode = "FEFCO_0427" | "FEFCO_0201" | "ECMA_RTE" | "ECMA_STE" | "PIZZA" | "SLEEVE"
  | "FEFCO_0320" | "ECMA_CLB" | "ECMA_SLB" | "FEFCO_0422" | "GABLE_BOX" | "PAPER_TUBE" | "RIGID_BOX";  // STRUCTURE_CODES
// Full catalogue facts (names, standard ref, limits, boards, features, presets): STRUCTURES in @/lib/dieline
interface StructureFeatures { window?; thumbNotch?; handle?; tearStrip?; partitions?; lidHeightMm?; displayFront? }  // DesignDoc.features
type StructureFamily = "CORRUGATED" | "FOLDING_CARTON" | "RIGID" | "TUBE";
interface Dims { L: Mm; W: Mm; H: Mm }            // INNER dimensions, mm
interface StructureParamLimits { L: Range; W: Range; H: Range; rules?: string[] }
interface DimsPreset { id: string; name: LocalizedText; dims: Dims; standard?: boolean }
interface StructureInfo { code; slug; family; name; description; params; defaultDims; presets }
type FaceId = "front" | "back" | "left" | "right" | "top" | "bottom";   // FACE_IDS
type PrintSurface = "outside" | "inside";

// material.ts
type MaterialCode = "E_FLUTE_KRAFT" | "E_FLUTE_WHITE" | "B_FLUTE_KRAFT" | "SBS_300" | "SBS_350";
type FinishCode = "NONE" | "MATTE_LAMINATION" | "GLOSS_LAMINATION" | "SPOT_UV";
type PrintSides = "OUTSIDE" | "BOTH";
type BoardType = "CORRUGATED" | "SBS"; type Flute = "E" | "B"; type BoardColor = "KRAFT" | "WHITE";
interface MaterialInfo { code; family; boardType; flute; color; gsm; thicknessMm; name; foodSafe }

// design.ts
// Layers are placed per FACE in mm, relative to the face's top-left corner as seen from
// outside the closed box (x right, y down). (x, y) is the layer CENTRE; rotation is
// degrees clockwise. Never mirrored in RTL.
interface LayerBase { id; face: FaceId; surface: PrintSurface; x; y; width; height; rotation; opacity?; locked?; hidden? }
interface ImageLayer extends LayerBase { kind: "image"; src; pxWidth; pxHeight; fit? }
interface TextLayer  extends LayerBase { kind: "text"; text; fontFamily: "IBM Plex Sans Arabic" | "Inter"; fontSizePt; fontWeight; color; align: "start"|"center"|"end"; direction: "rtl"|"ltr"|"auto" }
interface ShapeLayer extends LayerBase { kind: "shape"; shape: "rect"|"ellipse"|"line"; fill; stroke; strokeWidthMm }
type ArtworkLayer = ImageLayer | TextLayer | ShapeLayer;
interface ArtworkSurface { background: string | null; layers: ArtworkLayer[] }   // index 0 = bottom
interface Artwork { outside: ArtworkSurface; inside: ArtworkSurface }          // Design.artwork
interface DesignDoc { v: 1; id?; name; structureCode; dims; materialCode; finishCode; printSides; artwork }
emptyArtwork(): Artwork
interface PreflightIssue { code: "LOW_DPI"|"OUTSIDE_SAFE_ZONE"|"CROSSES_FOLD"|"ON_GLUE_FLAP"|"MISSING_BLEED"|"TEXT_TOO_SMALL"|"EMPTY_DESIGN"; severity: "error"|"warning"|"info"; layerId?; face?; messageKey }

// pricing.ts
QTY_TIERS = [100, 250, 500, 1000, 2000]; MAX_INSTANT_QTY = 2000   // above: "Request a quote"
interface RateTier { minQty: number; unitPiasters: Piasters }      // RateCard.qtyTiers
interface QuoteRequest { structureCode; dims; materialCode; finishCode; printSides; quantity; vendorId? }
interface QuoteLine { kind: "PRODUCT"|"SETUP"|"DIE"|"FINISH"|"SHIPPING"|"DISCOUNT"; labelKey; quantity; unitPiasters; totalPiasters }
interface QuoteResult { vendorId; quantity; lines; subtotalPiasters; vatPiasters; totalPiasters; unitPiasters; leadTimeDays; standardSize; validUntil /* ISO */ }
interface PriceTableRow { quantity: QtyTier; best: QuoteResult | null }

// vendor.ts
type EgyptCity = "CAIRO"|"GIZA"|"SIXTH_OF_OCTOBER"|"TENTH_OF_RAMADAN"|"OBOUR"|"ALEXANDRIA"|"NEW_DAMIETTA"|"SADAT_CITY";
interface VendorMachine { kind: "OFFSET"|"FLEXO"|"DIGITAL"|"DIE_CUTTER"|"FOLDER_GLUER"|"LAMINATOR"|"UV_COATER"; model; count }
interface VendorCapabilities { structures: StructureCode[]; materials: MaterialCode[]; finishes: FinishCode[]; maxColors; digitalShortRun; monthlyCapacityUnits }
interface VendorCertification { code: "FOOD_SAFE"|"ISO_9001"|"FSC"|"ISO_22000"; issuer; validUntil? }
interface VendorSummary { id; slug; name: LocalizedText; city; rating; ratingCount; onTimePct; leadTimeDays; verified; foodSafe; logoUrl }

// order.ts
type OrderStatus = "PENDING_PAYMENT"|"PAID"|"PROOF_APPROVED"|"ACCEPTED"|"IN_PRODUCTION"|"QC_PENDING"|"READY_TO_SHIP"|"SHIPPED"|"DELIVERED"|"CANCELLED"|"REFUNDED";
type ProductionEventType = "ORDER_PLACED"|"PAYMENT_CONFIRMED"|"PROOF_APPROVED"|"VENDOR_ACCEPTED"|"VENDOR_DECLINED"|"PRODUCTION_STARTED"|"QC_UPLOADED"|"QC_APPROVED"|"QC_REJECTED"|"SHIPPED"|"DELIVERED"|"CANCELLED"|"NOTE";
type PaymentMethod = "CARD"|"WALLET"|"FAWRY"|"INSTAPAY"; type PaymentStatus = "PENDING"|"PAID"|"FAILED"|"REFUNDED";
type ShipmentStatus = "CREATED"|"PICKED_UP"|"IN_TRANSIT"|"OUT_FOR_DELIVERY"|"DELIVERED"|"RETURNED";
type PayoutKind = "ADVANCE"|"BALANCE"; type PayoutStatus = "PENDING"|"APPROVED"|"PAID";
type DisputeReason = "PRINT_DEFECT"|"WRONG_ITEM"|"LATE"|"DAMAGED"|"OTHER";
interface ShippingAddress { name; phone; governorate; city; street; building?; floor?; apartment?; landmark?; notes? }
```

Module contracts that other owners are expected to expose (suggested; owners finalise them and document in their summary):
- `src/lib/dieline`: `generateDieline(code: StructureCode, dims: Dims, material: MaterialInfo)` returns panels with hinge edges, a face map (`FaceId` to panel), cut and crease paths, bleed and safe zone. One shared module drives the 3D view, the PDF and the area used by pricing.
- `src/lib/pricing`: `quote(req: QuoteRequest): Promise<QuoteResult[]>` and `priceTable(...) → PriceTableRow[]`. Pure helpers stay DB-free so they can be unit-tested.
- `src/lib/payments`: a `PaymentProvider` adapter (`mock`, `paymob`). `src/lib/shipping`: a `ShippingProvider` adapter (`mock`, `bosta`).

## 6. Auth and session API

Phone + OTP only. There are no passwords. Sessions are DB rows referenced by a random token in an httpOnly cookie.

**HTTP**

| Endpoint | Body | Response |
|---|---|---|
| `POST /api/auth/request-otp` | `{ phone }` (any Egyptian format, Arabic digits OK) | `200 { ok, phone: "+20…", expiresAt, devCode? }` · `400 INVALID_PHONE` · `429 RATE_LIMITED { retryAfterSec }` |
| `POST /api/auth/verify-otp` | `{ phone, code, name?, locale, acceptTerms?, marketingConsent? }` | `200 { ok, user: { id, role, name, isNew } }` and sets the cookie · `400 INVALID_INPUT \| INVALID_PHONE \| TERMS_REQUIRED \| INVALID_CODE \| EXPIRED \| TOO_MANY_ATTEMPTS` |
| `POST /api/auth/logout` | none | `200 { ok }` and clears the cookie |
| `GET /api/auth/me` | none | `200 { user: SessionUser \| null }` |

- OTP: 6 digits, 5-minute TTL, 5 wrong attempts max. Requesting a new code invalidates earlier ones. Codes are stored hashed.
- Rate limits (in memory, per process): 1 request per 30 s and 5 per hour per phone, 20 per hour per IP; verify is limited to 30 per 10 min per IP.
- New accounts must send `acceptTerms: true`. Marketing consent is a **separate, unchecked** checkbox. Every change writes a `Consent` row (PDPL 151/2020) with `CONSENT_TEXT_VERSION`.
- On verify, anonymous designs with the `elba_anon` cookie's `anonId` are claimed by the user, and their expiry is cleared.
- Cookies: `elba_session` (httpOnly, SameSite=Lax, Secure in production, 30 days), `elba_anon` (designer's anonymous id, set by the designer), `elba_locale` (last chosen language). Names are exported from `@/lib/auth/constants`.
- The SMS/WhatsApp sender is a stub, `sendOtpSms()` in `src/lib/auth/otp.ts`.

**Server helpers** (`import { … } from "@/lib/auth"` or `@/lib/auth/session`)

```ts
getSession(): Promise<Session | null>             // cached per request; Server Components, Actions, Route Handlers
requireUser(locale, nextPath?): Promise<SessionUser>        // redirects to /{locale}/login?next=…
requireRole(roles, locale, nextPath?): Promise<SessionUser> // ADMIN passes every check; wrong role -> /{locale}?denied=1
apiRequireRole(roles?): Promise<SessionUser | Response>     // in route handlers: if (r instanceof Response) return r;
createSession(userId) / destroySession()
interface SessionUser { id; phone; name; role: Role; locale: Locale; vendorId: string | null; marketingConsent }
```

**Client** (`@/components/auth`)
- `<OtpForm onSuccess reason? />`: the two-step phone + code form, with the dev banner and consent checkboxes.
- `<AuthGateDialog open onClose onSuccess reason? />`: the **G2 soft gate** modal (native `<dialog>`). Open it when an anonymous user tries to export, save, share or view the instant price, then `router.refresh()` and continue the action.
- `useSession()` → `{ user, loading, refresh }`, `signOut()`, `<SignOutButton />`.

## 7. i18n

- Routes: `/{locale}/…` with `locale ∈ {ar, en}`. `src/middleware.ts` redirects un-prefixed paths (including `/`) to `/{elba_locale cookie || "ar"}/…`. API routes, `_next`, `/seed` and files are skipped.
- `<html lang dir>` is set in `src/app/[locale]/layout.tsx`: `ar` uses `rtl`, `en` uses `ltr`.
- Dictionaries: `src/i18n/en.ts` **defines the shape**, and `src/i18n/ar.ts` is typed `Dictionary`, so TypeScript fails if a key is missing. A unit test also checks key parity and that the Arabic has no diacritics. Add keys under your own namespace (`designer.*`, `checkout.*`, `vendorPortal.*`, `admin.*`, `catalog.*`, `vendors.*`, …) **in both files in the same edit**. Interpolation uses `{name}`.
- Server: `const t = getT(locale); t("nav.home")`, `getDictionary(locale)`, `toLocale(params.locale)`, `dirOf(locale)`, `pick(locale, row.nameAr, row.nameEn)`, `localized(locale, {ar, en})`.
- Client: `const { t, locale, dir } = useI18n()` from `@/i18n/client`. The provider is already mounted.
- Keys are typed (`DictKey`). For dynamic keys, cast with `` `orderStatus.${status}` as DictKey ``.
- Shared lookup namespaces: `structures.<StructureCode>`, `materials.<MaterialCode>`, `finishes.<FinishCode>`, `cities.<EgyptCity>`, `orderStatus.<OrderStatus>`, `paymentMethods.<PaymentMethod>`, `preflight.<code>`, `pricing.line.*`, `auth.errors.*`.
- Arabic copy rules: MSA, noun-form labels ("الطلبات"), no diacritics, Western digits for sizes and prices, and "ج.م" after amounts.
- Formatting (`src/lib/format.ts`): `formatMoney(piasters, locale)` gives `1,250.50 ج.م` or `EGP 1,250.50`. Also `formatNumber`, `formatDims` (bidi-isolated, never mirrored), `formatDate`/`formatDateTime` (Africa/Cairo, Western digits) and `formatPercent`. Phones: `normalizeEgyptPhone()` and `formatEgyptPhone()` in `src/lib/phone.ts`.
- **Do not mirror** the 3D scene, the dieline, dimension strings or artwork coordinates in RTL. Use logical CSS properties (`margin-inline-start`, `inset-inline-end`, …) everywhere else.

## 8. Styling

- Plain CSS custom properties plus CSS Modules. No Tailwind, no `@shopify/polaris`, no Polaris icons, no Shopify logo, name or brand assets. Icons come from `lucide-react`.
- `src/styles/tokens.css` holds the Polaris-modelled tokens (`--p-color-*`, `--p-font-size-*`, `--p-space-*` on a 4 px scale, `--p-border-radius-*`, `--p-shadow-*` including bevel and button shadows, `--p-focus-ring`, `--p-motion-*`, layout and z-index). This is a first pass; the UI kit owner refines it. `src/styles/globals.css` holds the reset, base typography, focus-visible outline, `.visually-hidden`, `.skip-link` and the reduced-motion override.
- Fonts: Inter (`--font-inter`) and IBM Plex Sans Arabic (`--font-plex-arabic`). `--p-font-family-sans` puts Plex first under `:lang(ar)`.
- Quality bars: WCAG 2.2 AA, visible focus that is not obscured (sticky header offset via `scroll-padding-top`), targets of at least 24 px (we use 44 px on touch), works at 360 px wide, no horizontal scroll, 16 px side gutters on phones (`--p-page-gutter`), and `prefers-reduced-motion` respected.

## 9. Other shared helpers

| Module | Exports |
|---|---|
| `@/lib/db` | `db` (PrismaClient singleton, server only) |
| `@/lib/json` | `toJson`, `fromJson`, `canonicalJson` (use the last for proof hashes) |
| `@/lib/rate-limit` | `rateLimit(ns, key, limit, windowMs)`, `clientIp(headers)` |
| `@/lib/env` | `isProd`, `sessionSecret()`, `otpDevEcho()`, `siteUrl()` |
| `@/lib/format`, `@/lib/phone` | see §7 |
