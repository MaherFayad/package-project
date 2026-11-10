# Catalogue and storefront

## Purpose

The public catalogue lists **412** packaging models: the 372 designer models plus 40 family models the library leaves out (12 unprinted FEFCO 09 fittings, 6 moulded pulp, 4 cups and sleeves, 2 lids, 15 bags and envelopes, 1 blister). The 40 are quote-only and never open in the designer. Each entry has a family, sub-family, FEFCO / ECMA code, Egypt availability (local, imported, rare), regions and presets, and an **order mode** that decides whether the buyer gets an instant price or a price request.

The storefront also covers `/boxes` (box styles and SEO size pages), `/bottles`, `/vendors` (printer directory and profiles), legal pages and the account area.

## Key files

| Path | Role |
|---|---|
| `src/data/catalogue/index.ts` | `CATALOGUE` = library entries + `EXTRA_ENTRIES`; `catalogueEntry`, `catalogueEntryFromParam`, `catalogueThumb`, `toCatalogueCard`, `catalogueCounts` |
| `src/data/catalogue/README.md` | How to add a catalogue model |
| `src/data/catalogue/mapping.ts` | `availabilitySlugFor` (model to availability sub-family), `standardOf` |
| `src/data/catalogue/taxonomy.ts` | `CATALOGUE_FAMILIES`, family and sub-family names |
| `src/data/catalogue/order-mode.ts` | `orderModeForEntry` (the rules), `orderModeOf` (reads the table), `ORDER_MODE_COPY`, `byWedge` sort, `EGYPT_BADGE` |
| `src/data/catalogue/order-mode-table.ts` | `ORDER_MODE_TABLE` (108 non-instant rows), `EGYPT_TABLE`. Generated |
| `src/data/packaging-availability/` | Research data: `AVAILABILITY`, regions, regulatory notes, sources |
| `src/lib/configurator/catalogue.ts` | `quoteMode(code, vendors)`: the commerce gate |
| `src/components/catalogue/server.ts` | `getCatalogueData()` (5 min per-process cache) |
| `src/components/catalogue/CatalogueBrowser.tsx`, `rank.ts` | Client filters (`?family=&sub=&q=&scope=world`), search ranking |
| `src/components/catalogue/QuoteRequestForm.tsx` | Price request form on a model page |
| `src/components/store/data.ts`, `catalog.ts` | Storefront read models (`unstable_cache`, tag `catalog`, 300 s), structure slugs, SEO sizes |
| `src/lib/catalog-cache.ts` | `purgeCatalogCache()` (revalidates tag and layout, drops the `getCatalogueData()` memo) |
| `src/app/api/catalogue/quote-request/route.ts` | Creates a REQUESTED `Quote` from the catalogue |

## Order modes (B-16)

`orderModeForEntry()` checks in order:

1. Filling-line sub-families (aseptic, gable-top, blister): **preview**.
2. Rare in Egypt: **preview**.
3. Quote-only or a sub-family with no price basis (flow-wrap, pillow bag, stick pack, bag-in-box, noodle box, aluminium tube): **quote**.
4. Special gluing (crash lock, auto bottom, ready glued, glued tray, listed codes): **listed**. Instant only from a printer whose `capabilities.models` lists the code.
5. Everything else: **instant**.

The generated table has 44 listed, 45 quote, 19 preview rows. Regenerate with `npx tsx scripts/generate-order-mode-table.ts`. Never edit the table by hand.

## Data flow

1. `CATALOGUE` is built statically at import time.
2. `getCatalogueData()` loads ACTIVE vendors with rate cards (`loadVendorsForMatch`), runs `quoteMode` per code and builds cards. A database error means every card falls back to quote.
3. `/catalog` uses ISR (`revalidate = 300`); the browser filters and ranks client-side.
4. A model page shows an instant price with a vendor count, or the quote form with a reason.
5. A price request becomes `Quote` (REQUESTED, `validUntil` +14 days) plus a `QUOTE_REQUEST` audit row. Admin answers it in `/admin/quotes` (see `admin-console.md`).

## Routes and 404s

- `(detail)/catalog/[slug]/layout.tsx` guards the slug above Suspense. A core box slug gets 308 to `/boxes/<slug>`; anything unknown gets `notFound()`.
- `/boxes/[structure]` and `/boxes/[structure]/[size]`, `/legal/[doc]`, `/vendors/[slug]` use `dynamicParams = true` with layout guards (R8-01).
- Unknown URLs that can be ruled out without a database are rewritten to 404 by the middleware using `src/lib/routing/route-slugs.generated.ts` (regenerate with `npx tsx scripts/generate-route-slugs.ts`).

## Common changes

- **Add a catalogue model**: add the definition (see `3d-engine-and-model-library.md`), add a `mapping.ts` rule for a new sub-family, run `render-catalogue-thumbnails.ts --only CODE` with the app running, regenerate the library index, order-mode table, picker rows and route slugs, then `npx vitest run src/data/catalogue src/lib/configurator`.
- **Change order-mode rules**: edit `order-mode.ts`, regenerate the table, update `src/lib/configurator/__tests__/catalogue.test.ts` and the catalogue test.
- **Change search**: `rank.ts` and the search text builders in `index.ts`.

## Tests

- Unit: `src/data/catalogue/__tests__/catalogue.test.ts` (coverage, dedupe, slugs, taxonomy, parsing, thumbnails, table equals rules), `src/lib/configurator/__tests__/catalogue.test.ts`, `src/data/packaging-availability/availability.test.ts`, `src/components/store/__tests__/*`, `src/lib/routing/__tests__/static-404.test.ts`.
- e2e: `e2e/catalogue.spec.ts` (filters, search, keyboard, RTL with axe, instant and quote pages, quote request dedupe; writes `docs/screenshots/audit/catalogue/`), `e2e/catalogue-order-modes.spec.ts` (quote-only models never show an order path anywhere), `e2e/catalogue-models.spec.ts` (all 412 renders, slow), `e2e/storefront.spec.ts`.

## Pitfalls

- **B-16, R4-01 to R4-08, R6-05**: the instant price gate must hold everywhere: engine, designer label, export modal, share page, checkout copy. Share links must keep `modelCode` and `config`.
- **R4-14**: `rowToDoc` must not fall back to the base box silently.
- **R4-22 (open)**: data naming issues (hang tags, some FEFCO / ECMA codes, `PAPER_TUBE` filing).
- **R6-01 (open)**: axe reports a contrast false positive on `content-visibility` sections.
- **R3-01, R7-01**: the windowed grid needs a pre-measure CSS fallback and `minmax(0,1fr)` tracks for 320 px.
- **CAT-05**: B-flute-only models need a spot-ink default, not CMYK.
- **Not in the audits, found in code**:
  - Fixed (R7): `purgeCatalogCache()` also drops the per-process memo in `getCatalogueData()` (`catalogPurgedAt()`), and it now runs on admin structure, material, finish, vendor status and application edits and on every vendor profile or portfolio save, besides prices and rate cards.
  - Fixed (R7): `/api/catalogue/quote-request` answers 409 `INSTANT_PRICE` for a model the page would price instantly (`getCatalogueData().modes`); the form shows a link to the designer.
- `StructureCode` is not widened for catalogue models on purpose: rate cards key on the 16 core structures.
