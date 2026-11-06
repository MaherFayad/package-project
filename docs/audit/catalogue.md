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
| CAT-17 | low | family chips | A family-level sub-family (e.g. `food-service` for fries scoop) was counted twice in the family chip (29 vs 27). | — | Count sub-family only when it differs from the family. | fixed |

## Left open (with reason)

- **Shared unions not widened.** `StructureCode` / `VesselKind` / `MaterialCode` stay closed. Widening them by ~400 codes breaks the `Record<StructureCode, …>` maps in pricing, designer and store (other owners) and the main-branch wiring in progress. The merged registry is `src/lib/library` (designer, pricing, seed; main branch) plus `src/data/catalogue` (all 410, this branch); `STRUCTURES` / `VESSELS` remain the core sets the rate cards key on.
- **Designer for the 40 quote-only models.** They render, size and route to a quote from the catalogue page, but artwork editing in the designer needs new renderer paths in `src/components/designer` (outside this scope).
- **Instant price for containers.** Labels and sleeves are quote-only by the configurator's `orderability` rule (no label rate cards seeded); kept as is.
