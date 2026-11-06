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
