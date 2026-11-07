# Designer restyle: reference-editor layout (2026-11-08)

Goal: the 3D designer page reads as the same kind of editor as the reference the owner picked (a mockup editor
with a full-bleed grey canvas, an icon rail, a floating panel, a floating bottom toolbar and a tool column),
with Elba's own name, wordmark, colours, copy and Arabic-first RTL. Nothing of the reference's brand is copied
(no logo, wordmark, name, copy, icon artwork or purple): Elba's wordmark, near-black primary, neutral greys, lucide icons.

Screenshots: `C:\Users\Admin\AppData\Local\Temp\claude\f8173f44571ee159\d92726ee-f788-4602-8df6-7bcebbbfc7a0\scratchpad\designer-restyle\`
(`final-side-by-side-{ar,en}-{1-empty,2-logo}.png` next to the reference, `final-{ar,en}-desktop-*.png`,
`final-{ar,en}-phone-strip.png`, All options and a container: `v2-adv-*.png`, `v2-vessel-*.png`; scripts `shot.mjs`, `shot2.mjs`).

## What changed

| Before | After |
|---|---|
| Dark site bar + a second toolbar row (back, name, undo/redo, save state, menu, order) | One thin white bar: wordmark, back, borderless design name, save state, language, sign-in, «الحفظ والمشاركة» (outlined), «طلب هذه العلبة» (the one filled button). The server `DesignerTopBar` is white too and hidden with `:has(.edBar)` once the editor is on screen |
| 3D view in a white card, side panel card on the end, price strip above | Full-bleed canvas (soft vertical grey gradient, darker at the top), no card; the box framed in the free part (`setFitInsets` from the rail, panel and dock) |
| Basics: one long panel (logo, text, colour, size, more) | Icon rail at the start: «الشعار», «الألوان», «المقاس», «المزيد», plus a separate «نوع العلبة» card (opens the model picker). The panel shows one section: Logo has a dashed upload zone as its hero (button, or drop a file on it), the name/text button, the items + quick edit, then grey list rows with a chevron (cardboard colour, size, change box type) |
| All options: tabs at the top of the panel | The same four tabs (Box, Artwork, Layers, Print check) are the rail items (`role="tab"`), the panel is the tabpanel; the face select floats as a small card at the top of the canvas |
| Arrow-button orbit bar over the box; fold slider + Flat/Half/Closed under it (All options only) | Bottom dock: zoom − / +, an Open ↔ Closed fold slider (boxes; containers get Open + turntable), view buttons 3D / Face (All options) / Laid flat / Dimensions. Price is a pill beside it |
| — | Tool column at the far end: undo, redo, rotate left / right, reset view (the single-pointer alternative to dragging) |
| Phones: price strip + Logo/Text/Order bar at the bottom, sheet with tabs | Canvas full width; the rail is a bottom tab bar; the panel a bottom sheet (tap a tab to open it, the open tab to close it; the handle still works); the dock floats above the sheet; Order stays in the top bar |

Kept: upload (button, tap a side with glow, drop on the box, drop on the upload zone), landing chip, text, colours, sizes,
all sides, size slider, All options, price sheet, undo/redo, save/share/export menu, order, rename on phones, autosave state.

## Files

`src/components/designer/{DesignerApp.tsx, SimplePanel.tsx, DesignerTopBar.tsx, designer.module.css}`,
`src/app/[locale]/design/(editor)/[structure]/loading.tsx` (skeleton in the new shape),
`src/i18n/designer.{en,ar}.ts` (`designer.simple.{dropHint, sizeCm, railLabel, railLogo, railColours, railSize, railType,
railTypeVessel, railMore, tools, viewBar, foldOpen, foldClosed, account}`; `logoHint` lost "above"), `src/i18n/scopes.generated.ts`,
`docs/guides/designer.md` (Layout section), e2e: `designer.spec.ts`, `journey.spec.ts`, `journeys/helpers.ts`.
Not touched: the export section of Modals.tsx, exportFile/downloadPdf/exportGlb, `src/components/three/**`
(the dock and tool column call the existing scene handle: `zoom`, `rotate`, `reset`, `setFitInsets`; fold and
dimensions are the existing `fold` / `viewOpts` state).

## Checks

- `npx tsc --noEmit -p .`: clean. eslint on changed files: clean. `npx vitest run src/components/designer src/i18n`: 22 files, 113 tests.
- `npx tsx scripts/generate-i18n-scopes.ts --check`: up to date.
- e2e against the dev server (`E2E_PORT=3000`): `designer.spec.ts` desktop + mobile pass; `catalogue-order-modes.spec.ts` mobile
  passes; `journeys/j2-price-request.spec.ts` desktop passes (uses the new `basicsPanel` helper).
  Two old assertions in `designer.spec.ts` were stale before this change and are fixed: the Print check tab regex (`/check/i`)
  and the save gate title («رقم محمولك للمتابعة»).
- `journey.spec.ts` desktop: the designer part passes; it fails later at the printer QC upload
  (`#qc input[type=file]` now matches 3 inputs), which is the vendor portal, not this change.

## Notes / left

- Tilt up / down are keyboard-only now (arrow keys on the focused viewer); rotate left / right and reset are buttons.
- The reference's select / pan tools have no counterpart: the scene handle has no pan; the column holds undo, redo, rotate, reset.
- One dev-server run logged `Cannot read properties of undefined (reading 'isReady')` once; not reproduced on a clean run
  (likely a hot reload while the 3D files were being edited by the realism agent).
