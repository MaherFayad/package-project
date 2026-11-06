# Audit: worldwide 3D packaging catalogue (key: `catalogue`)

Scope: `src/lib/dieline`, `src/lib/vessels`, `src/lib/configurator`, `src/data`, the public catalogue (`/[locale]/catalog`), the designer model picker, `public/models`, `prisma/seed*.ts` (additive), e2e model specs, `scripts/`.

## What was integrated

| Layer | Where | What |
|---|---|---|
| Catalogue rows | `src/data/catalogue/` | One serialisable row per model: **410 models** = the 370 designer-ready library models (`src/lib/library`) + the 40 family models the library leaves out (paper cups, bowls, cup sleeve, lids, moulded pulp, paper bags, hang tag / belly band / gift sleeve, envelopes and mailers, pallet-box lid, octabin, 12 unprinted FEFCO 09 fittings, blister card). Every row: family, sub-family, family style group, standard code (FEFCO / ECMA / none, with the printer reference kept as label), `availableInEgypt` (local / imported / rare), regions, size axes, presets, bilingual names and a search haystack. |
| Dedupe | `src/data/catalogue/index.ts` | Family definitions already in the library keep the library row (it is wired into designer, pricing, seed). Example: `FEFCO_0201` and `FEFCO_0320` exist as core structures and as fefco-02 / fefco-03-05 definitions: one row, core source. Slugs stay unique. |
| Taxonomy | `src/data/catalogue/mapping.ts`, `taxonomy.ts` | Models are filed under the availability research taxonomy (`src/data/packaging-availability`): 12 families in use, 61 sub-families. FEFCO styles by series, octabins under bulk bins, liquid cartons under gable-top / aseptic, cups / bowls / pulp / bags under food service, bottles by material, cosmetic / pharma / metal by format. |
| Configurator | `src/lib/configurator/catalogue.ts` | Every model works with ModelConfig rules: library boxes are configured as their base core structure for the chosen board (rate card, rules, dies) with the model's OWN feature support for add-ons; containers as their core kind; quote-only family models get a per-family finish list (cupstock: water-based varnish only; moulded fibre, fittings, blister foil: none). `quoteMode` decides the commerce path against live printers. |
| 3D | `src/components/catalogue/CatalogueViewer.tsx`, `MeshStage.tsx`, `meshes.ts` | Library models through the designer's own scene; FEFCO 09 fittings folded and placed by their `placement.matrix` inside an open FEFCO 0200 host of the fitting's host size; bags / flat stock / envelopes / bulk bins through the fold engine with paper looks (carrier-bag handles from `HandleSpec`); cups, bowls, sleeve, lids, pulp and blisters as meshes from the family geometry. |
| Thumbnails | `scripts/render-catalogue-thumbnails.ts` → `public/models/<code>.webp` | Each model rendered headless (Playwright, software WebGL) on the chrome-free route `/[locale]/dev/catalogue/<code>`, trimmed, padded, 480 × 480 WebP with alpha. Fails on a render error or a blank frame (< 1 % painted). |
| Public page | `/[locale]/catalog`, `/[locale]/catalog/<slug>` | Marketing language (mint hero band, 64 to 96 px headline, pill controls, 1280 px container). Family + sub-family chips with live counts, "Available in Egypt" (default) / "Worldwide", search over Arabic / English names and FEFCO / ECMA codes (Arabic letter variants folded), windowed grid (only rows near the viewport are in the DOM; Tab / Shift+Tab still walk every model), URL state. Model page: live 3D (poster first, cross-fade), standard, Egypt availability and regions, sizes, and the commerce path. |
| Designer picker | `src/components/catalogue/CataloguePicker.tsx` | Polaris dialog: family / sub-family navigation with counts, Egypt / Worldwide, search, windowed grid of real thumbnails inside the dialog scroll area. Same props as the old `ModelPicker`; swapped in with a one-line import change in `DesignerApp.tsx`. |
| Commerce | `quoteMode`, `/api/catalogue/quote-request`, `QuoteRequestForm` | Instant price when an active printer has the capability and a rate card for the base structure and board (274 models). Containers (labels and sleeves, 96) and quote-only family stocks (40) are designable or viewable free and route to "Request a quote": signed-in buyers send quantity, size and notes; stored as a `Quote` row with status `REQUESTED` and zero totals. |
| Seed | `prisma/seed-catalogue.ts` (called from `seed.ts`) | Additive: Damietta Packaging also makes FEFCO 0422 produce trays, Alex Print House FEFCO 0320 telescope boxes, Obour Box Works E-flute FEFCO 0201 and crash-lock cartons; 9 new rate cards copied from a peer card and scaled to the printer's own price level. |
| e2e | `e2e/catalogue-models.spec.ts`, `e2e/catalogue.spec.ts` | All 410 models in batches of 24 (render ready, non-blank WebGL, no console errors, labelled contact sheet per batch in `docs/screenshots/models/catalogue/`). Catalogue flows: Egypt default, Worldwide, search by code and both languages, family / sub-family, keyboard walk through the windowed grid, model page instant and quote paths, quote request, RTL, no horizontal scroll, axe (WCAG 2.2 AA tags). |

## Model counts

By family (all 410):

| Family | Models |
|---|---|
| Corrugated board (FEFCO 02 to 09) | 221 |
| Folding cartons (ECMA) | 40 |
| Food service packaging | 27 |
| Cosmetic and pharma containers | 26 |
| Rigid plastic containers | 22 |
| Glass containers | 21 |
| Flexible packaging | 16 |
| Metal packaging | 12 |
| Rigid set-up boxes | 8 |
| Paper tubes and composite cans | 7 |
| Pallet boxes and bulk bins | 6 |
| Envelopes and paper mailers | 4 |

By availability in Egypt: **local 367, imported 27, rare 16** ("Available in Egypt" filter = local + imported = 394).
By standard: FEFCO 225, ECMA 33, no FEFCO / ECMA code 152.
By commerce path with the seeded printers: instant price 274, labels / sleeves by quote 96, quote-only stock 40.

## Findings

| id | severity | page / file | finding | standard | fix | status |
|---|---|---|---|---|---|---|
| CAT-01 | critical | `/catalog` | The catalogue showed only the 13 core box structures; the ~400 family models (FEFCO 02 to 09, ECMA, food service, flexible, glass, plastic, cosmetic, metal) were unreachable from any public page. | Broken flow | New catalogue of all 410 models with families, sub-families, search and Egypt filter. | fixed |
| CAT-02 | critical | `src/lib/library` coverage | 40 family models (cups, lids, pulp, bags, flat stock, envelopes, bulk bins, unprinted fittings, blister) had no catalogue row, thumbnail or commerce route. | Broken flow | Catalogue rows + 3D viewer paths + request-a-quote route. | fixed |
| CAT-03 | high | all models | No shared family / sub-family / standard code / Egypt availability / regions on models; FEFCO variant codes (0421.1, 0415a) and ECMA codes not searchable. | — | `src/data/catalogue` joins every model to the availability research; `standardOf` parses FEFCO variants and full ECMA codes. | fixed |
| CAT-04 | high | `public/models/*.svg` | Thumbnails were flat line drawings, not 3D, and missing for the 40 extra models. | Brief: "never blank placeholders" | Real headless 3D renders, WebP with alpha, 410 files; unit test fails if one is missing or tiny. | fixed |
| CAT-05 | high | `src/lib/configurator` (bridge) | Models only made in B-flute kraft (FEFCO 0314, 0350 to 0352, pallet box) produced a default config with CMYK, which the rules reject on direct-flexo kraft, so the config was invalid. | Print facts in `configurator/catalog.ts` | Default to one spot ink when CMYK is not offered on the board. Note for the designer owner: `createModelDoc` may hit the same rule for these models. | fixed (bridge) |
| CAT-06 | high | `foodservice/pulp.ts` | `FS_PULP_FRUIT_TRAY` test timed out under load: the 590 × 390 mm height field built 37 k vertices at a fixed 2.5 mm step (also heavy for the 3D view). | Performance | Cap the grid at 6,000 vertices (step grows on large trays; cells are ≥ 25 mm). Test 3.9 s → 0.6 s. | fixed |
| CAT-07 | high | `fefco-09` tests | Reported failures for 0930 / 0933 / 0934 / 0935 closed outer size and fit-inside-host. | — | Re-ran on this base: all 4 × 5 checks pass (the fold convention fix is already in the snapshot). No change needed. | verified |
| CAT-08 | high | `/catalog` (new) 390 px | Toolbar grid track sized to the search input's min-content: 83 px horizontal scroll on phones (ar and en). | WCAG 1.4.10 reflow | `minmax(0, 1fr)` tracks, `min-inline-size: 0` on the search, full-width scope switch under 640 px. | fixed |
| CAT-09 | high | FEFCO 09 rendering | Fittings rendered as loose pieces with no box, so a partition or liner read as a random box. | Brief item 2 | Fitting placed by its own `placement.matrix` inside an open FEFCO 0200 host of its host size; camera looks down into the host. | fixed (catalogue viewer; the designer still shows fittings alone: designer owner) |
| CAT-10 | medium | commerce | Formats no printer prices (cups, pulp, bags, labels, imported glass) had no next step. | — | Clear ar / en copy ("Designed free, priced by quote"), sign-in that returns to the form, request API (rate limited 5/min, quantity 100 to 1,000,000), PDPL 151/2020 note. | fixed |
| CAT-11 | medium | seed | Several base structures had one printer only, so most family models had a single instant offer. | — | Additive capability extension for structures those printers run (3 printers, 9 cards). | fixed |
| CAT-12 | medium | designer picker | Picker had 8 flat groups, no sub-families, no Egypt filter, SVG drawings, every card in the DOM. | Polaris IA | Polaris picker with family / sub-family nav, Egypt / Worldwide, windowed grid of 3D thumbnails. | fixed |
| CAT-13 | medium | thumbnails script | sharp runs `resize` before `extend` in one pipeline, so the square padding was applied after a cover crop: tall models (FEFCO 0207, bottles) were cut at the top. | — | Pad in a first pipeline, resize (contain) in a second. | fixed |
| CAT-14 | medium | scope switch (page + picker) | "Egypt / Worldwide" used `role=radio` buttons without arrow-key roving focus. | WCAG 4.1.2, ARIA APG radio group | Toggle buttons with `aria-pressed` in a labelled group. | fixed |
| CAT-15 | low | paper carrier bags | Handles (`HandleSpec`) were not drawn, so twisted / flat handle bags looked like SOS bags. | — | Tube handles on both faces in the catalogue viewer. | fixed |
| CAT-16 | low | catalogue copy | Arabic search placeholder mixed a Latin code into RTL text, so the bidi order read backwards on phones. | Arabic UX | Arabic placeholder without Latin codes; codes still searchable. | fixed |
| CAT-18 | medium | catalogue + picker search | Substring search listed "تلسكوبية" (telescope) boxes before cups for "كوب", and code searches had no priority. | ISO 9241-110 (suitability for the task) | Relevance ranking: code hits, then name-word prefix hits, then other matches; stable in catalogue order. | fixed |
| CAT-19 | low | site-wide (`src/app`) | No favicon: every page requested `/favicon.ico` and logged a 404 console error (it also failed the per-model "no console errors" check). | — | `src/app/icon.svg` from the wordmark box glyph (outside scope, additive). | fixed |
| CAT-20 | low | `/catalog` 1280 px | "Available in Egypt" wrapped to two lines inside the pill switch. | — | `white-space: nowrap`; full-width switch under 640 px. | fixed |
| CAT-21 | low | `/catalog` | The page was statically prerendered at build, so instant-price badges would freeze at build-time printer data. | — | `revalidate = 300`, matching the 5-minute data cache. | fixed |
| CAT-22 | low | designer config panel | The model card in the designer's Box panel still shows the old SVG drawing (`modelImage` in `ModelPicker.tsx`). | — | Left: designer owner's file; the webp is at `/models/<code>.webp`. | open (outside scope) |
| CAT-17 | low | family chips | A family-level sub-family (e.g. `food-service` for fries scoop) was counted twice in the family chip (29 vs 27). | — | Count sub-family only when it differs from the family. | fixed |

## Left open (with reason)

- **Shared unions not widened.** `StructureCode` / `VesselKind` / `MaterialCode` stay closed. Widening them by ~400 codes breaks the `Record<StructureCode, …>` maps in pricing, designer and store (other owners) and the main-branch wiring in progress. The merged registry is `src/lib/library` (designer, pricing, seed; main branch) plus `src/data/catalogue` (all 410, this branch); `STRUCTURES` / `VESSELS` remain the core sets the rate cards key on.
- **Designer for the 40 quote-only models.** They render, size and route to a quote from the catalogue page, but artwork editing in the designer needs new renderer paths in `src/components/designer` (outside this scope).
- **Instant price for containers.** Labels and sleeves are quote-only by the configurator's `orderability` rule (no label rate cards seeded); kept as is.

## Verification (pass 2)

- `npm run typecheck`: clean. `npm run lint`: clean.
- `npm test` (vitest): 45 files, 6,703 tests passed (includes `src/data/catalogue/__tests__` 421 tests and `src/lib/configurator/__tests__/catalogue.test.ts` 377 tests; the fruit-tray pulp test now 0.6 s).
- `npm run build`: passes.
- Playwright against `next start` (`OTP_DEV_ECHO=1`, `--workers=2`, `--trace off`):
  - `e2e/catalogue-models.spec.ts` (desktop): 18 batches, all 410 models rendered, non-blank WebGL, no console errors or failed requests (12.1 min). Contact sheets: `docs/screenshots/models/catalogue/batch-01.jpg` … `batch-18.jpg`.
  - `e2e/catalogue.spec.ts` (desktop + mobile): 11 passed, 3 desktop-only skips on mobile; axe (wcag2a/aa, 21aa, 22aa) clean on `/ar/catalog` and the Arabic quote page.
  - `e2e/designer.spec.ts`, `e2e/storefront.spec.ts`, `e2e/smoke.spec.ts` (touched by the picker swap and the new `/catalog`): all pass (35 passed in total with the catalogue spec).
- Screenshots: `docs/screenshots/audit/catalogue/` (before: old `/catalog` en 1440 and ar 390, old picker; after: filtered catalogue, Arabic desktop and mobile, quote page, new picker).

## Files touched outside scope

- `src/components/designer/DesignerApp.tsx`: one import line (`ModelPicker` now from `@/components/catalogue/CataloguePicker`, same props).
- `src/app/api/catalogue/quote-request/route.ts`: new route for quote requests (stores a `Quote` row, no schema change).
- `src/app/icon.svg`: new favicon (CAT-19).
- `e2e/storefront.spec.ts`: the "home → catalogue → structure" step now finds the mailer in the new catalogue and follows the model page's "Sizes and prices" link to `/boxes/mailer-box`; the rest of the journey is unchanged.
- `package.json` / `package-lock.json`: `@axe-core/playwright` dev dependency (allowed by the brief).

## Pass 3 (after merging the base branch at 2b57cab)

- Merged `origin/claude/exciting-albattani-8kzgsu` (no conflicts: the model library this work builds on was already in the base; main changed only `Modals.tsx` and `storefront.spec.ts`).
- Integrator request: `openTop?: boolean` on library box models (`isOpenTop` in `src/lib/library/boxes.ts`): 105 styles (trays, displays, half-slotted, open sleeves, carriers, FEFCO 09 fittings); lidded trays, telescope sets, capped sleeves, hinged lids and wraps stay closed. Covered by a unit test. The designer label ("Assembled" vs "Closed", 3d-visual F67-06) is the designer owner's change.
- Not done here: PERF-04 (lazy family loaders in `src/lib/library`) is a refactor of the library's sync API used by the server, seed and tests, left to the library owner. PERF-14/15 apply to the old `ModelBrowser`; the designer now uses the windowed `CataloguePicker` with lazy webp thumbnails, and `/catalog` server-renders compact cards (no per-card family text) with lazy images.
- Re-verified: typecheck clean, vitest 6,704 passed. `npm run lint` reports 13 errors only in `docs/audit/tools/*` scripts that arrived with the base branch (other sessions' harnesses), none in this work.

## Round 3 (docs/audit/ROUND3.md: B-16, B-20, B-21, CR-03, CR-30 to CR-33, designer R-01 / R-02, PERF-04)

Base: merged `origin/claude/exciting-albattani-8kzgsu` at d1ea599 (no conflicts).

| id | severity | page / file | finding | standard | fix | status |
|---|---|---|---|---|---|---|
| B-16 | critical | pricing engine, designer, checkout, catalogue | Models no Egyptian SME printer can make (aseptic brick, gable-top liquid carton, FEFCO 07 auto-bottom, rare formats) got an instant price and "Order this box" because they were priced as their nearest core structure. | Business plan §4.2; prepaid orders | `src/data/catalogue/order-mode.ts`: an order mode per model from the availability data. `preview` (rare in Egypt, filling-line liquid cartons, 17 models) and `quote` (stocks no printer prices, 40): always a quote. `listed` (auto-bottom / crash-lock / corner-glued styles, 44): instant only from a printer that lists the model in the new optional `VendorCapabilities.models`; otherwise a quote. Enforced in the pricing engine (`quote()` returns `manual_quote` with `reason: "MODEL_BY_QUOTE"` and `orderReason`), so the designer badge, the price modal ("Request a quote" instead of "Order this box", with the reason in ar / en), checkout (its quote form now explains the reason) and order creation (instant offers only) all follow. The catalogue's `quoteMode` uses the same gate. Seed: Delta Cartons (already runs the core crash-lock carton) lists the 6 crash-lock / corner-glued carton models; the Obour digital shop no longer gets crash-lock cartons. | fixed |
| B-20 | high | `/design` library, designer picker, config panel, `/catalog`, model pages | The availability data was on the new catalogue only; the `/design` library and the designer had no Egypt signal. | Business plan; Egypt market | One wording everywhere (`EGYPT_BADGE`: "متوفر في مصر / مستورد / توفر محدود"; Made in Egypt / Imported / Limited in Egypt): badge on every card of `/catalog`, the picker, the `/design` library and the designer's config header. "Available in Egypt" is the default filter on `/catalog`, the picker and the `/design` library. | fixed |
| B-21 | high | same surfaces | Lists opened with system-supplied formats; the wedge (100 to 2,000 units) formats were buried. | Go-to-market | Default sort `wedgeRank`: the 13 core structures first, then local instant models, imported instant, special gluing, quote-only stock, preview. Search keeps relevance order. `/catalog` now opens with FEFCO 0201, 0320, 0422, pizza, 0427, snap-lock, crash-lock, sleeve. | fixed |
| CR-03 | high | `designer/library.module.css` | Selected chip lost its dark fill on hover (white on #f7f7f7, 1.07:1). | WCAG 1.4.3 | Hover rule excludes `[aria-pressed="true"]`; selected hover uses the brand hover fill. | fixed |
| CR-30 | medium | `/design` library, `/catalog` | 370 models in one 13,000 to 18,000 px list; filters scroll away. | Craft, performance | `/design` library: 12 per group with "Show all N" (full list when a group chip or search is active). `/catalog`: windowed grid (pass 1) and the search + Egypt switch now stick under the site header. | fixed |
| CR-31 | medium | `/boxes` product cards | Action rows did not line up across a row. | Rhythm | Card is a flex column, description clamped to 2 lines, actions pushed to the bottom; `/design` card titles clamped to 2 lines. | fixed |
| CR-32 | low | `/ar/catalog`, `/boxes` pizza card | Eyebrow read "PIZZA" in Latin caps. | Localization | Product cards show the industry code (`FEFCO 0426`) or nothing. | fixed |
| CR-33 | low | `/design` model card | "Simplified" was 11 px grey text. | Component consistency | Polaris `Badge size="small"`. | fixed |
| R-01 | low | `ModelPicker.tsx` | Cards printed the literal standard "none". | — | Line hidden when the standard is empty or "none". | fixed |
| R-02 | medium | `ModelPicker.tsx` | One long list; ragged rows. | — | See CR-30 / CR-31. Thumbnails now the real 3D webp (`modelImage(slug, code)`), also in the config panel (closes CAT-22). | fixed |
| PERF-04 | critical | `src/lib/library`, editor bundle | The editor shipped every family generator (505 KB first-load JS for `/design/[structure]`). | Core Web Vitals (TBT, LCP) | One pack per family (`src/lib/library/packs/*`), a light registry (`registry.ts`) with a generated code → pack index, `loadModel()` / `useLibraryModel()` in the browser. The eager `@/lib/library` entry is unchanged for the server, seed and tests. The editor, share viewer, checkout proof viewer and catalogue viewer wait for the open model's pack; the picker loads another family on demand. The picker reads generated rows instead of the catalogue. Result: `/design/[structure]` first-load JS **505 KB → 359 KB**; no family pack in the initial route; each pack is a separate 9 to 23 KB (gzip) chunk loaded on demand. What is left in the route is three.js core and the dieline engine (PERF-03, 3D engine owner). | fixed |

Commerce paths with the seeded printers after B-16 (410 models): instant price 315 (220 boxes, 95 containers priced as labels / pouches / tubes, matching the engine); request a quote 95 (special gluing 38, quote-only stock 40, rare in Egypt 15, filling-line cartons 2).

Files touched outside the original scope for this round (all requested in ROUND3): `src/lib/pricing/{engine,types,area}.ts`, `src/types/vendor.ts` (optional `models`), `src/components/designer/{DesignerApp,Modals,ConfigPanel,ModelPicker,SharedScene}.tsx`, `src/components/designer/lib/{quote,doc,catalog}.ts`, `src/components/designer/library.module.css`, checkout `actions.ts`, `CheckoutClient.tsx`, `ProofViewer.tsx`, `[designId]/page.tsx`, `src/components/marketing/{ProductCard.tsx,marketing.module.css}`, `src/lib/orders/pdf/print.ts`, `src/app/api/{designs/_shared.ts,vendor/jobs/[id]/dieline/route.ts}` (side-effect import of the eager library), `src/lib/library/__tests__/library.test.ts` (expects B-16 routing instead of "every model instant"; still checks base pricing and area for every orderable model).

### Round 3 verification

- `npm run typecheck`, `eslint src e2e scripts prisma`: clean. `npm test`: 65 files, 8,164 tests passed (new: `src/lib/library/__tests__/registry.test.ts` for the lazy registry and the generated index / picker rows; B-16 cases in the library, configurator and catalogue tests; the generated order-mode table is checked against the rules for all 410 models).
- `npm run build`: passes. `/design/[structure]` first-load JS 359 KB (was 505 KB); family packs load on demand.
- Playwright against `next start` (`OTP_DEV_ECHO=1 ALLOW_MOCK_PAYMENTS=1 SESSION_SECRET=…`, `--workers=2 --trace off`):
  - `e2e/models.spec.ts` (every library model through the designer, desktop): run 1 365 / 370, run 2 369 / 370. Every failure was the intermittent React #418 hydration mismatch already recorded on the base (3d-engine, a11y and fefco-06-09 audits: a different model each time); each failed model passed when re-run alone. It does not reproduce in 66 targeted loads (production and dev, with and without concurrency), so the source is still open (designer page owner; not 3D, the viewer is client-only).
  - `e2e/catalogue-models.spec.ts`: 18 / 18 batches, all 410 models through the lazy registry.
  - `e2e/catalogue.spec.ts`, `designer.spec.ts`, `storefront.spec.ts`, `smoke.spec.ts`, `checkout.spec.ts`, `journey.spec.ts` (desktop + mobile): all pass. `checkout` and `journey` need `ALLOW_MOCK_PAYMENTS=1` under `next start` (by design, `src/lib/payments/config.ts`).
- Browser re-check (screenshots `docs/screenshots/audit/catalogue/round3-*`): the aseptic brick shows "Priced by quote: see why", the top bar reads "Request a quote", and the price dialog (titled "Request a quote") explains the filling-line reason and links to the quote form; the mailer box still gets "500 boxes from EGP 37.95 each, delivered in 13 days". `/catalog` opens with FEFCO 0201, 0320, 0422, pizza, 0427, snap-lock, crash-lock, sleeve. The `/design` library shows the Egypt switch (default "Available in Egypt"), badges on every card and 12 per group with "Show all N" in en 1440 and ar 390.
- Note for the next integrator: run `npx tsx scripts/generate-library-index.ts`, `scripts/generate-order-mode-table.ts` and `scripts/generate-catalogue-rows.ts` after adding or renaming a model; unit tests fail if the generated files drift.

### Round 3, follow-up items (platform and designer reports)

Merged `origin/claude/exciting-albattani-8kzgsu` at 4ee7d9d (includes the platform route move of `/catalog` into `(list)`; conflicts in `DesignerApp.tsx` and checkout `actions.ts` resolved: lazy library loading kept, `pickerCards` dropped as main did, B-16 quote reasons kept next to the B-05 sample credit).

| id | severity | page / file | finding | standard | fix | status |
|---|---|---|---|---|---|---|
| R3-01 | high | `/ar/catalog` 360 px (platform report, catalogue.spec:73 mobile) | Before JS measured the container, the windowed grid placed cells for a 1,200 px width, so phones laid out about 1,184 px wide for the first ~100 ms. | WCAG 1.4.10 reflow; CLS | Until the first measurement the grid renders the first 12 cards as a plain CSS grid whose container queries mirror the windowed grid (2 / 3 / 4 columns at 0 / 720 / 1,100 px container width, 12 / 16 px gaps, fixed 132 px text block), then the virtualizer takes over on the same `<ul>`. Verified with the JS chunks blocked (no hydration): 360 px document, grid 328 px, cards 158 px, no horizontal scroll. | fixed |
| R3-02 | high | `src/lib/configurator/rules.ts` (designer report) | Spot UV on white-top B / BC corrugated was refused with "needs a coated or laminated surface", but lamination is itself refused on that board, so the message pointed to an impossible remedy. | ISO 9241-110 (self-descriptiveness); print practice | Separate reasons that match practice: kraft and white-top liners are printed flexo directly and cannot be laminated, so spot UV needs another board (white E-flute, a printed laminated sheet), where matte lamination + spot UV is allowed. New code `FINISH_UV_WHITE_TOP`. Tests: white-top refuses both lamination and spot UV with a reason that names white E-flute (ar / en), kraft's reason no longer suggests lamination, white E-flute + matte lamination + spot UV evaluates without errors. One existing assertion that pinned the old wording ("coated or laminated") now checks the corrected one. | fixed |
| R3-03 | medium | `CataloguePicker` on phones (designer report) | The search field got focus on open, which raised the keyboard over the grid. | WCAG 2.4.3 focus order | Search autofocus only when `(pointer: fine)`; on touch the dialog keeps its default focus (dialog, title read first). e2e: mobile picker opens with the search not focused and focus inside the dialog. | fixed |

Verification: typecheck and lint clean; vitest 77 files, 8,283 tests passed; build passes; `catalogue.spec`, `designer.spec`, `storefront.spec`, `smoke.spec`, `checkout.spec` (desktop + mobile) pass against `next start` on a freshly pushed and seeded database. Note: the base's schema change (`Vendor.status`, `Dispute` unique key) needs a fresh `db push` + seed on an existing dev database; the sitemap and `/boxes` price table are prerendered from the database at build time, so build after seeding.

## Round 4

Base: `claude/exciting-albattani-8kzgsu` at 781d663 (rounds 1 to 3 merged). Audited with Playwright on `next start` (en / ar, 1440 × 900 and 390 × 844, axe WCAG 2.2 AA tags, signed-out and two fresh buyers per run via random phones), plus a row-by-row data review of all 410 models against `docs/packaging-availability.md`.

### Re-verification of round 1 to 3 rows

| id | result |
|---|---|
| B-16 | **reopened**: the engine gate holds for `/api/quote`, order creation, samples and reorders, but the share link, the export modal / toast, and checkout still offered an order (R4-01 to R4-05 below). Fixed this round. |
| B-20 | fixed: Egypt badge on every `/catalog` card, model page, picker card, `/design` library card and the designer header; "Available in Egypt" is the default on all three lists. |
| B-21 | fixed: `/catalog`, the picker and the `/design` library open with FEFCO 0201, 0320, 0422, pizza, 0427, sleeve, snap-lock, crash-lock (core structures first). |
| CR-03, CR-30 to CR-33, R-01, R-02, R3-01 to R3-03, CAT-08, CAT-14, CAT-20 | fixed (browser re-check, `catalogue.spec` desktop + mobile). |
| PERF-04 | fixed: lazy family packs still load on demand (designer opens `aseptic-brick-carton` and `mailer-box` through `useLibraryModel`). |

axe (wcag2a/aa, 21aa, 22aa) on `/catalog`, four model pages and `/design`, en + ar, desktop + phone: 0 violations. No horizontal scroll at 390 px. No console errors.

### New findings (round 4)

Counts before fixing: **critical 2, high 6, medium 8, low 6** (22, pass 1); pass 2 added **high 2, low 1** (R4-23 to R4-25). Round total: critical 2, high 8, medium 8, low 7.

| id | severity | page / file | finding | standard | fix | status |
|---|---|---|---|---|---|---|
| R4-01 | critical | `checkout/[designId]/page.tsx` (share-link copy) | Opening a shared design's "Order this box" as another buyer copied the design **without `modelCode` and `config`**: a shared aseptic brick became a plain straight tuck end box, got instant prices (EGP 12 / box at 500) and could be paid. B-16 bypass through a deep link. | B-16; prepaid orders | The copy keeps `modelCode` and `config`; the "same copy already exists" check compares them too. e2e: the visitor's copy has `modelCode = LIQUID_ASEPTIC_BRICK` and checkout shows no price. | fixed |
| R4-02 | critical | checkout `actions.ts` `requestQuoteAction` | A quote request needed more than 2,000 units, so a quote-only model at 100 to 2,000 units (the only quantities the page offered) could not be requested at all: "Request a price" failed. | Broken flow (B-16 / B-15) | Any quantity is accepted when the design's model is priced by quote (checked on the server with the same `quoteDesign` gate); other designs still need > 2,000. | fixed |
| R4-03 | high | `DesignerApp.tsx` export modal + export toast | The top bar said "Request a quote" for quote-only models but the export modal and the "Downloaded" toast still said "Order this box". | B-16 | One `orderLabel` computed from the order mode, used by the top bar, export modal and toast. | fixed |
| R4-04 | high | `/s/[id]` share page | "Order this box" and the instant-order help text for every shared design, quote-only models included. | B-16 | "Request a quote" plus the order-mode reason (ar / en) for quote / preview models. | fixed |
| R4-05 | high | checkout for a quote-only design | Tiers read "Not available" and were disabled, a paid "Sample · 5 boxes" was offered, the quote form offered "Order 2,000 boxes now", the summary said "Large orders are priced by our team", and the initial server render dropped the B-16 reason. | B-16; ISO 9241-110 self-descriptiveness | Server passes `reason` / `orderReason`; tiers read "By quote" and stay selectable; no sample tier; no "Order 2,000 now"; no "Choose a printer" heading; summary "This format is priced by quote…"; the filling-line / special-gluing reason is shown in the form. | fixed |
| R4-06 | high | `/s/[id]` | "Design your own" opened the base structure (`/design/straight-tuck-end`) instead of the model; the Style row and title badge named the base structure; the poster was the old flat SVG. The checkout "Edit design" link also used the base slug. | Correctness; CAT-04 (3D thumbnails) | Model name everywhere, `designerPath(modelCode)`, poster `/models/<code>.webp`. | fixed |
| R4-07 | high | `src/data/catalogue/order-mode.ts` | Formats the research gives no price basis for at 100 to 2,000 units were priced instantly from a base rate card: flow wrap, pillow and quad-seal bags, stick packs (roll stock for the buyer's FFS line, 300 to 1,000 kg film minimum), bag-in-box bladders and noodle pails (imported, price "n/a"), aluminium tubes (dry offset, 10,000+). | B-16; `docs/packaging-availability.md` table rows 79 to 86, 71, 105 | `NO_PRICE_BASIS` sub-families route to a quote (`QUOTE_ONLY_STOCK`). Pre-made sachets and three-side-seal pouches stay instant (digital short runs). Printed cans stay instant as **labels** (doc "What I'd ship" #3). | fixed |
| R4-08 | high | `order-mode.ts`, `configurator/catalogue.ts` | Blisters were "quote" although the doc keeps them preview-only with liquid cartons (#2); the octabin (rare) was "quote" because quote-only stock was checked before rarity; and `quoteMode` returned "no printer prices this stock" for every non-library model, so the blister page showed the wrong reason. | B-16; doc #2 | Filling-line and rare checks come first; `cosmetic-pharma/blister` is filling-line; `quoteMode` returns the order-mode reason before the library lookup. Unit tests pin stick pack, blister, octabin, can (label, instant) and sachet (instant). | fixed |
| R4-09 | medium | `/api/catalogue/quote-request` | A catalogue quote request wrote no QUOTE_REQUEST audit row, so the admin quote-leads inbox had no spec snapshot (family models showed a raw code), the buyer's account listed it as "Untitled", and re-sending created duplicate leads. | B-15; ISO 9241-110 | Audit row with spec (model code, ar / en name, standard, preset, size), model name stored on the line (account page reads it), same request within 14 days returns the open one (200 `{ repeat: true }`). e2e covers the audit row and the dedupe. | fixed |
| R4-10 | medium | `CataloguePicker`, `/design` library | Nothing told the buyer a model is priced by quote until after it was opened in the designer. | B-16; ISO 9241-110 | "By quote" badge on picker and library cards for quote / preview models. | fixed |
| R4-11 | medium | picker cards (ar) | Standard code and Egypt badge shared one wrapping flex row, so cards in the same row had the code and badge on one or two lines (ragged baselines); `dir="ltr"` on the code span pushed it to the left edge of Arabic cards. Same LTR misalignment on `/catalog` cards and `/design` library cards. | Craft (alignment); WCAG 1.3.2 | Code on its own line in `<bdi dir="ltr">` (aligned to the start of the line in both directions); badges in their own bottom row; row height set to fit. | fixed |
| R4-12 | medium | model page, quote models | Two black primary pills ("Design it free" and a full-width "Sign in to request a quote") of different widths. | Hierarchy (one primary per card) | With a quote path, "Design it free" is the outline pill and the quote action is the one primary, both in one CTA row. | fixed |
| R4-13 | medium | Arabic model names | "حاوية ثمانية" (eight containers, not octagonal, FEFCO 0350 to 0352); "مشرطة" (slit) for taped corners (0302); "عكسي مقلوب" for French reverse tuck; "حقيبة" for paper carrier bags while siblings use "كيس"; snap-lock bottom "مقفل يدويا" vs "1-2-3" elsewhere (0215, 0216); colloquial "تستيف" (0770) and "سوستة" (stand-up pouch); "مقابض" vs "فتحات يد" (0774); "الجدار الجانبي" for end walls (0304); "أنبوبة كريم" for a generic squeeze tube; jug / cooler capacities that did not match the English. | MSA, terminology consistency | Corrected in the family definitions; the stand-up pouch is now "Stand-up pouch with zip" / "كيس واقف بسحاب" (it has one). Index and picker rows regenerated. | fixed |
| R4-14 | medium | `designer/server.ts` `rowToDoc` | If a stored design's options stopped validating, the loader dropped the model and returned the base box: a quote-only model would silently become instantly priced. | B-16 (defence in depth) | Falls back to the model without its options before falling back to the base box. | fixed |
| R4-15 | medium | `/catalog` cards (ar) | Same LTR alignment as R4-11 on the standard line. | Craft | `<bdi>`. | fixed (with R4-11) |
| R4-16 | medium | `order-mode.ts` copy | The filling-line reason said "200,000+ packs"; the research says 100,000+. | Data accuracy | 100,000+. | fixed |
| R4-17 | low | picker | Models without a FEFCO / ECMA code showed the internal code in Latin caps ("LIQUID ASEPTIC BRICK"), also on Arabic. | Localization | Sub-family name instead. | fixed |
| R4-18 | low | picker, `/design` library | "Limited in Egypt" used the critical (error red) badge tone. | Semantic colour | Warning tone. | fixed |
| R4-19 | low | picker | The current model's card replaced its Egypt badge with "Current". | B-20 | Both badges. | fixed |
| R4-20 | low | core structures (`dieline/registry.ts`) | Malformed ECMA labels "ECMA A20 (reverse tuck)", "ECMA A20 (straight tuck)", "ECMA A01 (sleeve)" next to the full codes of the same styles. | ECMA catalogue | `ECMA A20.20.03.01`, `ECMA A20.20.03.03`, `ECMA A01.01.00.00`. | fixed |
| R4-21 | low | checkout, quote-only design | "Choose a printer" heading and help above a quote form. | ISO 9241-110 | Hidden for quote-only models. | fixed |
| R4-22 | low | data | Hang tags, belly bands and gift sleeves are "quote" although the research lists them as local, 100 to 1,000 pcs, EGP 0.5 to 4. FEFCO 0405 is named a bliss-style (a 06xx style); ECMA trays with lids carry F-series codes; `PAPER_TUBE` is labelled "composite can" (rare) but filed as a retail tube; Arabic "غلاف مطوي" for 04xx folders clashes with "غلاف" for sleeves; `RIGID_BOX` and `RIGID_LID_BASE` share a name. | Data accuracy | Left: instant tags need a flat-stock rate card (pricing / admin owners); the FEFCO / ECMA corrections need the official FEFCO and ECMA PDFs to confirm the replacement code and drawing, and a code change renames model URLs. | open |

### Verification (round 4)

- `npm run typecheck`, `eslint src e2e scripts prisma`: clean. `npm test`: 79 files, 8,295 passed (new assertions in `src/lib/configurator/__tests__/catalogue.test.ts`; the "library models are preview or instant" assertion now follows the rule for quote models too, nothing removed).
- Generated files rerun: `generate-library-index.ts` (370), `generate-order-mode-table.ts` (108 non-instant, was 95 + 13), `generate-catalogue-rows.ts` (370).
- e2e (`next start`, `OTP_DEV_ECHO=1 ALLOW_MOCK_PAYMENTS=1`, `--workers=2 --trace off`): new `e2e/catalogue-order-modes.spec.ts` (API, designer top bar, export modal, share page, share-link checkout copy, no instant tiers / sample / "Order 2,000 now", quote request at 100 boxes); `e2e/catalogue.spec.ts` (quote request now also checks the audit row and dedupe). `catalogue-order-modes`, `catalogue`, `designer`, `checkout`, `storefront`, `smoke`, `journey`, `admin` (desktop + mobile): **58 passed, 12 skipped** (one-project tests), 0 failed. `catalogue-models.spec.ts` (all 410 models, desktop): **18 / 18 batches passed** (11.7 min).
- Screenshots: `docs/screenshots/audit/catalogue/round4/` (`before-*` and `after-*`).

### Pass 2 (fresh re-audit after the fixes)

| id | severity | page / file | finding | standard | fix | status |
|---|---|---|---|---|---|---|
| R4-23 | high | `/design` library (`designer/ModelPicker.tsx`) | A family chip or the scope switch re-rendered up to 370 cards synchronously: 430 to 544 ms per click at 4x CPU (INP budget 200 ms). | Core Web Vitals INP | Chip state stays urgent, the list renders from `useDeferredValue(group / scope)` (interruptible), cards are memoised. With the hero 3D paused the same clicks take 40 to 80 ms at 4x CPU (input 24 ms). | fixed |
| R4-24 | high | `/design` hero (`designer/DesignStart.tsx`, designer / 3D owner) | The hero 3D preview animates continuously: desktop TBT 4.3 s, phone (Slow 4G, 4x CPU) LCP 12.2 to 12.6 s, TBT 7.5 to 8.4 s, INP 608 to 704 ms, 576 KB JS. Even a hover costs 224 ms while it runs (headless software WebGL inflates this; the shape holds on a GPU). | LCP < 2.5 s, INP < 200 ms | Not in this scope: render on demand (`frameloop="demand"`, rotate only on interaction or once), mount the canvas after LCP with the webp poster first, as the catalogue `DetailStage` does. | open (designer / 3D owner) |
| R4-25 | low | `QuoteRequestForm` | The quantity error was linked with `aria-describedby` but not announced when it appeared. | WCAG 3.3.1, 4.1.3 | `role="alert"`. | fixed |

Perf (`docs/audit/tools/perf-pages.mjs`, after fixes): `/catalog` desktop LCP < 0.5 s, CLS 0.000; phone ar / en LCP 4.7 / 4.2 s (Slow 4G, hero text; the phone LCP gap is the platform-wide item carried from round 3), CLS 0.003 / 0.000, INP 48 ms, TBT 353 to 361 ms, JS 212 KB transferred. `/catalog/[slug]` 126 KB first-load JS; `/catalog` 120 KB.

### Files touched outside the original scope (all B-16 enforcement or name data)

`src/app/[locale]/(checkout)/checkout/{[designId]/page.tsx,actions.ts,_components/CheckoutClient.tsx}`, `src/app/[locale]/s/[id]/page.tsx`, `src/components/designer/{DesignerApp.tsx,ModelPicker.tsx,server.ts,library.module.css}`, `src/app/[locale]/(store)/account/page.tsx` (catalogue request name), `src/components/admin/server/queries.ts` (Arabic name fallback for catalogue leads), `src/lib/dieline/registry.ts` and `src/lib/dieline/families/{fefco-02,fefco-03-05,fefco-06-07,ecma-tuck,foodservice}/definitions.ts`, `src/lib/vessels/{registry.ts,families/bottles/models/plastic.ts}` (names and ECMA labels only).

## Round 5 rows (docs/audit/ROUND5.md, integrator request during round 4)

Merged `origin/claude/exciting-albattani-8kzgsu` at 553e407 first; one conflict in `/s/[id]/page.tsx` resolved by keeping both sides (the R4-12 share price from main and the B-16 quote CTA from this branch; the share price is null for quote models).

| id | severity | page / file | finding | standard | fix | status |
|---|---|---|---|---|---|---|
| CR-30 (reopened) | medium | `/catalog` | All matching models in one windowed list: 46,528 px at 1440, 64,334 px at 390. | Craft, performance | With no family and no search the page shows 12 per family (launch formats first) with "Show all N in {family}", which selects that family (full windowed list). Family sections use `content-visibility: auto` with an intrinsic block size. The family chips stick under the search row on tablet and desktop (offset measured from the search row, so it follows the breakpoint and font). Now 18,932 px at 1440 and 19,970 px at 390. e2e: ≤ 12 cards per section, page < 25,000 px, "Show all" selects the family, chips stay in view after scrolling. | fixed |
| R4-CR-05 | medium | `/ar/catalog` chips; `src/app/fonts.ts` | IBM Plex Sans Arabic 600 swapped in ~450 ms late, widened the chips and re-wrapped the row (CLS 0.069 to 0.075). | CLS | Plex Arabic 600 preloaded on Arabic pages with 400 and 700; the chip row is one `nowrap` scroller at every width with an end fade inside the gutter. `/ar/catalog` CLS 0.000 (desktop and phone, perf-pages.mjs). | fixed |
| R4-CR-06 | medium | `/catalog` hero, `/design` library | "410 models · 394 in Egypt" on the catalogue vs "370 · All 355" in the designer, with no explanation of the 40 quote-only formats. | Trust, consistency | Both totals from the catalogue rows: the `/catalog` hero states "370 open in the 3D designer" next to 410 / 394 / instant; `/design` says "40 more formats (cups, paper bags, moulded pulp, fittings) are in the catalogue, priced by quote" with a link. | fixed |
| R4-CR-17 | low | "Change model" dialog | "Current" replaced the Egypt badge; badges sat at different heights. | Component consistency | Done in R4-11 / R4-19: the code on its own line, one badge footer pinned to the bottom ("Current" first, then Egypt, then "By quote"), titles clamped to 2 lines. | fixed |
| R4-B-10 | low | designer config panel | "Made and priced as Straight tuck end carton" on the aseptic brick, which is priced by quote. | Plan §4.2 | Preview models (filling line, rare): "Priced by quote" (they are not made as their base by Egyptian printers either); quote models: "Made as {base}; priced by quote"; instant and listed-with-a-printer models keep "Made and priced as". "Limited in Egypt" tone warning here too. | fixed |

New finding while fixing: **R5-01 (low)**, `/catalog` desktop now lazy-loads more thumbnails below the fold (images 686 KB transferred at 1440, was 370 KB), because 12 cards per family sit closer together than the windowed rows. LCP is unaffected (0.31 to 0.36 s desktop). Left: the thumbnails are already 480 px WebP; a 240 px `srcset` variant would halve it (thumbnail script change, next round).

Verification: typecheck and lint clean; vitest 82 files, 8,381 passed; build passes; e2e `catalogue-order-modes`, `catalogue`, `designer`, `checkout`, `storefront`, `smoke`, `journey`, `admin` (desktop + mobile): 63 passed, 13 skipped, 0 failed. perf-pages `/catalog`: desktop ar / en LCP 0.31 / 0.36 s, CLS 0.000, INP 48 to 56 ms, TBT 15 to 27 ms; phone (Slow 4G, 4x CPU) ar / en LCP 4.0 / 4.3 s (platform-wide phone item from round 3), CLS 0.000, INP 80 ms.

Files outside the original scope this step: `src/app/fonts.ts` (preload weights), `src/i18n/library.{en,ar}.ts` (3 keys), `src/components/designer/ConfigPanel.tsx`, `src/app/[locale]/design/(picker)/page.tsx` (subtitle sentence and link).
