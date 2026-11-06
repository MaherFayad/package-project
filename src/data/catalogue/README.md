# Worldwide packaging catalogue

One row per 3D model (`CATALOGUE`, 410 models): the designer-ready model library (`src/lib/library`) plus every family definition the library leaves out. Rows are plain data (safe for the browser); geometry stays in the family folders.

- `index.ts`: builds the rows, dedupes (library row wins), unique slugs, lookups, `toCatalogueCard`, counts.
- `mapping.ts`: model -> availability sub-family (`availabilitySlugFor`) and standard code (`standardOf`: FEFCO from the code, ECMA from the reference, else "none").
- `taxonomy.ts`: family order and names (from `src/data/packaging-availability`).
- Commerce and configuration: `src/lib/configurator/catalogue.ts` (`catalogueModelConfig`, `catalogueOptions`, `quoteMode`).
- 3D: `src/components/catalogue/CatalogueViewer.tsx`; render route `/[locale]/dev/catalogue/<code>`.

## Adding a model

1. Add the definition to its family folder (or to the library). It appears in `CATALOGUE` automatically.
2. If its sub-family is new, add a rule in `mapping.ts` (the unit test fails when a row has no availability entry).
3. Render its thumbnail with the app running: `npx tsx scripts/render-catalogue-thumbnails.ts --only CODE` (`--missing` renders only absent files). This also refreshes `e2e/fixtures/catalogue-models.json`.
4. Run `npx vitest run src/data/catalogue src/lib/configurator` and `npx playwright test e2e/catalogue-models.spec.ts --project=desktop --workers=2 --trace off`.
