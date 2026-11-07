# Designer

## Purpose

The free 3D designer at `/{locale}/design`. A visitor picks a model, sets size, board and finishes, places artwork per face, checks preflight, and then saves, shares, exports a PNG or goes to checkout. Anonymous visitors can design; saving, sharing, exporting and seeing the price open the sign-in gate (G2 soft gate).

## Key files

| Path | Role |
|---|---|
| `src/app/[locale]/design/(picker)/page.tsx` | Model picker / start |
| `src/app/[locale]/design/(editor)/[structure]/page.tsx` | Editor route. `modelFromParam()` accepts a slug or code. Query: `?d=<designId>`, `?preset=`, `?L=&W=&H=&material=`, `?resume=1` |
| `src/components/designer/DesignerApp.tsx` | The editor shell (state, views, tabs) |
| `src/components/designer/lib/history.ts` | `historyReducer`: undo/redo with coalesce keys, `HISTORY_LIMIT = 50` |
| `src/components/designer/lib/preflight.ts` | `runPreflight` (also run on the server at proof approval) |
| `src/components/designer/lib/concurrency.ts`, `access.ts` | Save conflicts, who may open a design |
| `src/components/designer/lib/storage.ts` | Local autosave (localStorage) |
| `src/components/designer/uploadImage.ts` | PNG, JPEG, WebP, SVG (rasterised at 2000 px); 10 MB; longest side 3000 px; data URL capped at 3M characters |
| `src/components/designer/Stage3D.tsx`, `Scene3D`, `VesselView`, `DesignScene.tsx` | 3D views (`DesignScene` is read-only: share page and proof) |
| `ArtworkPanel`, `FaceEditor`, `LayersPanel`, `BoxPanel`, `ConfigPanel`, `CropDialog`, `BrandColors`, `PreflightPanel`, `DielineView` | Panels in `src/components/designer/` |
| `src/components/designer/server.ts` | `saveDesign`, `loadDesign`, `rowToDoc`, `docConfig`, `shareDesign`, `loadSharedDesign` (server only) |
| `src/app/api/designs/_shared.ts` | `SaveBody` zod schema, body cap 12 MB, 120 writes per 10 min |
| `src/types/design.ts` | `DesignDoc`, layers, `DESIGN_FINISH_CODES`, `PRICED_FINISH_OF` |
| `src/lib/configurator/` | Rules engine for `ConfigPanel` (disabled options carry a reason) |

## Layout

The editor (`DesignerApp.tsx`, styles in `designer.module.css` under "editor layout") is one screen: its own thin white top bar
(wordmark, design name, save state, language, sign-in, «الحفظ والمشاركة» menu, the one primary «طلب هذه العلبة»; the server
`DesignerTopBar` is hidden with `:has(.edBar)` once the editor is on screen) over a full-bleed grey canvas. Floating white cards:
the icon rail and its panel at the start (Basics: Logo, Colours, Size, More, plus Box type, which opens the model picker; All options:
the Box, Artwork, Layers and Print check tabs), the tool column at the end (undo, redo, rotate, reset view), and the bottom dock
(zoom, open/closed fold slider, 3D / face / laid flat / dimensions) with the price pill. The camera frames the box in the part the
cards leave free (`setFitInsets`). Phones: the rail is a bottom tab bar and the panel a bottom sheet. See
`docs/audit/simplicity-2026-11/designer-restyle.md`.

## The DesignDoc

`{ v: 1, id?, name, structureCode, dims, materialCode, finishCode, printSides, artwork, features?, modelCode?, finishes?, vessel?, brandColors? }`

- `structureCode` is always the **base** structure (pricing, rate cards, orders). `modelCode` is the library model. Use `docModelCode(doc)` (`src/lib/library/doc.ts`) for links and resume, never `structureCode` (D-03).
- `artwork = { outside, inside }`, each `{ background, layers[] }` (index 0 is the bottom).
- Layers: `image | text | shape`, placed per face in mm, (x, y) is the layer centre relative to the face top-left seen from outside, rotation in degrees clockwise. Never mirrored in RTL. Fonts: only "IBM Plex Sans Arabic" and "Inter".
- `finishes`: each finish with the layer ids that form its mask; `finishCode` is the main priced one.
- Stored in `Design` as columns plus `config` Json (`features`, `finishes`, `vessel`).

## Data flow

1. The editor page builds the doc (`createModelDoc` / `createDesignDoc`, or `loadDesign` for `?d=`).
2. `DesignerApp` keeps it in a history reducer. Views: `3d`, `face`, `dieline`. Tabs: box, artwork, layers, check.
3. `docGeometry(doc)` (debounced 150 ms while typing dims) gives the `DielineModel`.
4. `useArtworkCanvases` paints one canvas per surface in sheet space (`paintArtworkSurface`), 1024 px on low-DPR screens, else 2048, and bumps a version.
5. `Stage3D` (loaded with `next/dynamic` after `loadEngineStack()`) renders one `EngineCanvas` with `Scene3D` (boxes, `useArtworkTexture`) or `VesselView` (containers).
6. Save: `POST /api/designs` (anonymous via the `elba_anon` cookie) or `PUT /api/designs/[id]` with `baseUpdatedAt`. A newer server copy returns 409 CONFLICT with that doc unless `force` (R10-R1).
7. Share: `POST /api/designs/[id]/share` mints `shareToken` (owner only); `DELETE` revokes it. Public page: `/{locale}/s/<token>`.
8. Checkout: `/{locale}/checkout/<designId>`. A quote-only model shows "Request a quote" instead of a price.

## Common changes

- **New panel option**: add the rule in `src/lib/configurator`, render it in `ConfigPanel`, store it in `DesignDoc` (additive), map it in `docConfig` / `rowToDoc`, extend `designDocSchema` in `src/app/api/designs/_shared.ts`.
- **New preflight check**: add the code to `PreflightIssue["code"]` in `src/types/design.ts`, implement it in the designer preflight lib, add `preflight.<code>` keys in both dictionaries.
- **New finish**: `DESIGN_FINISH_CODES` and `PRICED_FINISH_OF` (`src/types/design.ts`), a priced `FinishCode` (`src/types/material.ts`, seed `Finish` row), the renderer material in `src/components/three/finishes/`.
- **Strings**: designer keys live in `src/i18n/designer.{en,ar}.ts`; the design area scope is generated.

## Tests

- Unit: `src/components/designer/lib/__tests__/` (18 files: doc, history, preflight, concurrency, finish masks, upload rejects, vessel closures, ...), `src/lib/configurator/__tests__/`.
- e2e: `e2e/designer.spec.ts` (editor flows, several 120 to 150 s tests), `e2e/designer-page.spec.ts` (the marketing `/designer` page), `e2e/models.spec.ts` (every model), `e2e/catalogue-order-modes.spec.ts` (quote-only models show no order path), `e2e/a11y.spec.ts` (modal focus trap).

## Pitfalls

- **D-02 / R-03**: an embedded viewer must not trap page scroll (`touch-action`, wheel handling).
- **D-04**: autosave retries with backoff; do not drop failed saves silently.
- **R10-01**: large images made designs unsaveable (413), hence the data URL cap.
- **R4-14 (catalogue)**: `rowToDoc` must not silently fall back to the base box, or a quote-only model becomes instantly priced.
- **R-06 / X-01**: tint and `closureStyle` flow through `VesselOption`, not ad hoc props.
- **R14-04 (open, low)**: bottle cards show the raw finish id (e.g. PP28).
- **R5-SEC-08**: the API can revoke a share link; the designer dialog still lacks a "Stop sharing" button.
- Never key `EngineCanvas`; remounting it leaks GPU objects (E-01).
- Full history: `docs/audit/designer.md` (16 rounds).
