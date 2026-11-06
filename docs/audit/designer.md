# Designer audit (key: designer)

Scope: `/[locale]/design` (start page), `/[locale]/design/[structure]` (editor), `src/components/designer/**` (except `ModelPicker.tsx`, catalogue session), designer i18n keys.
Method: Playwright against `next start` (seeded SQLite), ar + en, 390x844 (touch) and 1440x900, keyboard only, axe-core (wcag2a/aa, 21aa, 22aa) on start page, editor, face editor and sign-up gate. Persona: first-time Egyptian brand owner, no account.

axe-core: 0 violations on every state tested, before and after. The findings below are what axe does not catch.

Screenshots: `docs/screenshots/audit/designer/` (`before-*`, `after-*`).

## Findings

| id | severity | page / file | finding | standard | fix | status |
|---|---|---|---|---|---|---|
| D-01 | high | `/design` (`page.tsx`) | The start page (the product's hook) was a Polaris admin page: small "Pick a box style" title, 4 small cards, then a 14,000 px wall of 370 static thumbnails. Nothing on the page moved or showed what you would make. | brief "inviting, live 3D"; marketing ref; WCAG 2.2.2, 2.3.3 | New `DesignStart` hero: a 56 px headline, a 3-step strip, a live, slowly turning 3D box that changes when you hover or focus a product shortcut ("T-shirt mailer" shows a green mailer, "Perfume" shows a tuck carton…), and a "Start designing" pill CTA. Turning stops on any interaction, has a pause button and starts paused under reduced motion. three.js loads when the browser is idle, with an SVG poster until then. The catalogue stays below. | fixed |
| D-02 | high | `DesignStart` (new) | An embedded `PackagingScene` uses `touch-action: none` and OrbitControls zooms on the wheel, so on a scrolling page a 3D preview would trap vertical swipes on phones and the wheel on desktop. | ISO 9241-210; brief (touch vs page scroll) | The hero sets `touch-action: pan-y` on its viewer (vertical swipe scrolls, horizontal drag turns) and stops `wheel` in the capture phase before it reaches the canvas, so the page scrolls. Engine left as is (see "Reported"). | fixed |
| D-03 | high | `ResumeCard.tsx` | "Continue your last design" linked to the draft's base structure (`doc.structureCode`), not its library model. For any family style or container (for example a hexagonal carton) the link opened a different model, and `?resume=1` then refused the draft because the model codes did not match, so the work did not come back. It also named the draft by the base structure. | WCAG 3.3 (error recovery); data loss | Uses `docModelCode(draft.doc)` for the link and the model's own name. The icon on its own line (RTL) was removed: the Banner already has an icon. | fixed |
| D-04 | high | `DesignerApp.tsx` (autosave) | A failed server save showed "Could not save. We will try again." but nothing retried until the next edit. There was no retry button and no offline state. | WCAG 3.3.1, 3.3.3 | Retries on its own with backoff (10 s, 20 s, 40 s … up to 2 min) and when the browser comes back online. A "Retry now" button appears next to the status, there is an offline message, and the local draft is written on failure. Copy now matches what happens. | fixed |
| D-05 | high | editor, 390 px | The 7 view buttons (rotate, tilt, zoom, reset) sat on top of the 3D box. On a phone they covered the lower third of the model. | WCAG 2.4.11 (related: content obscured), visual | Under 768 px the buttons move to their own row under the stage (`viewControlsRow`). Desktop keeps the overlay. One instance only (no duplicate controls for screen readers). | fixed |
| D-06 | high | `FaceEditor.tsx` | Keyboard users could move, resize and rotate the selected item, but could not select an item from the face editor: selection needed a click or a detour through the Layers tab. | WCAG 2.1.1, 2.5.7 | Enter / Space picks the next item (Shift goes back). The new selection is announced in a polite live region, and the hint text explains every key. | fixed |
| D-07 | medium | `ArtworkPanel`, `FaceEditor` label, `PreflightPanel`, `LayersPanel` | For containers (labels, pouches) the face names came from the box dictionary ("Front panel"), while the stage used the print-area names ("Wrap label"). The same face had two names in one screen. | WCAG 3.2.4 (consistent identification) | `faceLabel` from `DesignerApp` is passed to every panel; `describeFace` takes an optional display name. | fixed |
| D-08 | medium | `fields.tsx` (`ColorField`) | Swatches were announced as "Colour #1f3d2b". An invalid hex code turned the field red with an empty error message. | WCAG 1.1.1, 3.3.1, 3.3.3 | Swatches have names ("Colour #1f3d2b, Forest green" / "اللون #1f3d2b، أخضر غامق", tooltip = name). The hex field shows "Use a 6-digit colour code, for example #1F3D2B." | fixed |
| D-09 | medium | editor panel | In a long inspector the Box / Artwork / Layers / Check tabs scrolled out of view. | ISO 9241-110 (orientation) | The tab bar is sticky at the top of the panel (pass 1 targeted the tablist and missed: its scrolling wrapper blocked `sticky`; pass 2 makes the wrapper sticky). | fixed |
| D-10 | medium | `DesignerApp.tsx` | Deleting an item (Delete key, Backspace or button) gave no feedback and no obvious way back except Ctrl+Z. | WCAG 3.3.4 (reversible) | "Item deleted" toast with an Undo action. | fixed |
| D-11 | medium | toolbar, 390 px | On phones the save status text is hidden. Before, an icon showed only once saved, so a phone user could not see "saving" or "unsaved". | WCAG 4.1.3 | Icons for every state (upload cloud for dirty/saving, check for saved, cloud-off for error), colour by state, and a `title`. The text stays in the live region for screen readers. | fixed |
| D-12 | medium | `[structure]/loading.tsx` | The editor's loading state was the generic `SkeletonPage` (page title and cards), then the full-screen editor replaced it, so the layout jumped. | CLS < 0.1 | Editor-shaped skeleton (toolbar, price pill, stage, panel) using the same grid. | fixed |
| D-13 | medium | Arabic copy | The font select read "عربي (IBM Plex Sans Arabic)" and bidi turned it into "…ans Arabic) عربي" in a narrow select. | MSA / RTL | "عربي (بلكس)" / "لاتيني (إنتر)"; en "Arabic (IBM Plex)". | fixed |
| D-14 | low | Arabic copy | Plural agreement after numbers: "{count} عناصر", "تم حذف {count} عناصر", "{count} مطابع" are wrong for 11 and up (should be عنصرا / مطبعة). | MSA grammar | Noun-form labels avoid the agreement: "العناصر: {count}", "العناصر المحذوفة: {count}…", "المطابع المتاحة للتنفيذ: {count}". | fixed |
| D-15 | low | Arabic / en copy | Sheet toggle "عرض المزيد من العلبة" / "Show more of the box" read oddly. | | "تكبير عرض العلبة" / "Show the box larger". | fixed |
| D-16 | low | `DielineView.tsx`, 390 px | Panel names were drawn at about 3 px on a phone: unreadable noise. | WCAG 1.4.4 | Names show only when the sheet is at least 560 px wide; the legend explains the lines on small screens. | fixed |
| D-17 | low | start page product cards | Cards had uneven heights, the perfume card wrapped to 4 lines, and the cards had a shadow but no hover or press state. | Polaris; WCAG 2.3.3 | 2-column grid, equal heights, border, hover / active / selected state (150 ms ease-out, off under reduced motion). | fixed |
| D-18 | high | editor, landscape phone (844x390) | The portrait layout was used: a 32rem minimum height made the page scroll, the 3D stage shrank to a strip, and the viewer's own 240 px floor pushed the canvas under the rows below it, so the controls covered the box. | WCAG 1.3.4 (orientation), 2.4.11 | At most 500 px high and 640 to 1039 px wide: stage and panel side by side, no page scroll, fold row hidden (portrait only). The 3D controls move to a row, and the stage body clips the viewer. | fixed |
| D-19 | medium | `ConfigPanel.tsx` model card | For models without a standard code the card printed the raw internal code ("STAND_UP_POUCH"). | content quality | The line shows only a real standard (not empty or "none"). | fixed |
| D-20 | medium | `ConfigPanel.tsx` size fields (ar) | The size field suffix was a hard-coded Latin "mm" in the Arabic UI. | MSA localisation | Uses `common.mm` ("مم"). | fixed |
| D-21 | medium | editor, 390 px, sheet open | With the sheet pulled up (72dvh), the 3D control and fold rows ate the remaining stage, leaving about 40 px of model. | visual | While the sheet is open on phones, those rows are hidden and the stage keeps the box. They come back when it closes. | fixed |
| D-22 | low | bottom sheet handle | The sheet looked draggable (grab handle) but only a tap worked. | ISO 9241-110 (conformity with expectations) | Swiping the handle up or down opens or closes it (pointer capture, 24 px threshold). A tap still toggles it (WCAG 2.5.7), and `aria-controls` points at the panel. | fixed |
| D-23 | low | stage header, 390 px | The face select was squeezed to about 9rem and cut container names ("الوجه ملصق دائري…"). | | The select takes the remaining width on phones. | fixed |
| D-24 | low | `Scene3D.tsx`, `DesignScene.tsx` (from 3d-visual X-11) | The editor, share and proof 3D views showed a blank skeleton for 1 to 3 s on first load; the model's thumbnail already exists. | perceived performance | `poster` = `/models/<slug>.svg` passed to `PackagingScene` (cross-fades to the canvas on the first frame). Vessels: `VesselScene` has no `poster` prop (engine). | fixed |
| D-25 | low | fold control (`DesignerApp.tsx`, `SharedViewer.tsx`) (from 3d-visual F67-06) | Open-top styles (FEFCO 0700…) never close, but the 100 % fold button said "Closed". | ISO 9241-110 (self-descriptiveness) | Shows "Assembled" / "مجمعة" when the model has `openTop`. The field is read defensively until the catalogue adds it to the library. The checkout `ProofViewer` has the same label (checkout owner). | fixed (needs the `openTop` flag to take effect) |
| D-26 | medium | editor, new design (CR-15, designer half) | A new design opened as a blank board: nothing told a first-time owner where their logo would go. | onboarding / ISO 9241-110 (self-descriptiveness) | Preview-only hint "Your logo" / "شعارك هنا" on the lid (front if there is no lid) in `#616161` at 75 % opacity, in the 3D and dieline textures only while the outside has no layers and no background. It is never in the document, so the face editor, preflight, saved designs and the print PDF never contain it (`previewSurface` in `useArtworkCanvases.ts`, unit-tested). It disappears with the first item or background colour. | fixed |
| D-27 | low | `DielineView.tsx` (CR-27, designer half) | In Arabic, panels without a face name (tuck, dust flap, ear…) were labelled in English on the dieline. | MSA localisation | `DielineView` passes `locale` to `dielineToSvg` (engine CR-27, 857f989); face names still win per panel. Checked on reverse tuck end in Arabic: "لسان إدخال"، "لسان جانبي" (`after-dieline-labels-ar-1440.png`). | fixed |

## Reported to other owners (not edited)

| id | owner | finding | suggested fix |
|---|---|---|---|
| R-01 | catalogue (`ModelPicker.tsx`) | Model cards print the literal standard code "none" for styles without one ("Hinged-lid flip-top pack — none"). | Hide the line when the code is `none` or empty. |
| R-02 | catalogue (`ModelPicker.tsx`) | All 370 models render as one list (14,000 px at 1440 px). There is no "show more" per group, so a phone user scrolls through 128 boxes to reach Pouches. Card heights vary with title length, so rows do not line up. | Show the first 8 per group with "Show all 128", or make the group chips a filter; clamp titles to 2 lines. |
| R-03 | 3D engine (`PackagingScene`) | `touch-action: none` and wheel zoom are always on. That is right in the editor, but it traps scrolling wherever a viewer sits in a scrolling page (start page, share page, proof). | A `scrollFriendly` prop: `touch-action: pan-y` and `enableZoom` only with a modifier key or on focus. |
| R-04 | 3D engine (`dielineToSvg`) | Panel labels use `font-family="Inter"` only, so Arabic panel names fall back to a system font. | Add the Plex Arabic variable to the label font stack. |
| R-06 | 3D engine + catalogue (from 3d-visual X-01) | Container tint and closure style are dropped: `VesselOption` has only `core`, and neither `VesselSceneProps` nor `createVesselMaterial` take a tint or closure style, so green glass renders amber and crown / cork / ROPP render as screw caps. The designer cannot pass what the engine does not accept. | Catalogue: add `tint?` and `closureStyle?` to `VesselOption` and fill them in `library/vessels.ts`. Engine: accept `tint` and `closureStyle` on `VesselScene` / `VesselModel` and add the closure profiles. The integrator assigned X-01 end to end, including the `VesselView.tsx` L81-82 pass-through, to the engine session. |
| R-05 | foundation + checkout (`src/types/design.ts`, `src/lib/orders/pdf/print.ts`) | Only two text fonts (IBM Plex Sans Arabic, Inter). An Egyptian brand owner expects a few Arabic display faces (Kufi, Naskh, rounded). This needs the `fontFamily` union widened and the print PDF to embed each font, outside designer scope. | Add 3 to 4 OFL Arabic faces (for example Noto Kufi Arabic, Noto Naskh Arabic, Tajawal) to `fonts.ts`, the type and the PDF renderer together. |

## Verification (pass 1)

- `npm run lint`: clean. `npm run typecheck`: clean. `npm test`: 43 files, 5,905 tests passed. `npm run build`: OK.
- `npx playwright test e2e/designer.spec.ts e2e/smoke.spec.ts --workers=2 --trace off`: 12 / 12 passed (desktop + mobile).
- No horizontal scroll at 390 or 1440 (ar and en) on the start page or the editor. No console errors.

## Verification (pass 2)

- Re-audit in the browser: every pass 1 fix was re-checked (D-09 reopened: the first sticky rule targeted the tablist, whose scrolling wrapper blocked `sticky`; now fixed and verified in `after-sticky-tabs-ar-390.png`). Wheel over the start-page hero scrolls the page (scrollY 0 → 500). The handle swipe opens the sheet. Container models (wide jar, stand-up pouch) use the same print-area names in every panel.
- axe-core after the fixes: 0 violations (start page, editor, face editor with selection, gate).
- `npm run lint` clean, `npm run typecheck` clean, `npm test` 5,905 / 5,905 passed, `npm run build` OK.
- Playwright `designer`, `smoke`, `journey` (desktop + mobile, `--workers=2 --trace off`): 13 passed, 1 skipped (journey's own desktop-only skip), 0 failed. `e2e/models.spec.ts` (every model, catalogue / engine owned) was not run.

## Counts

| severity | found | fixed | open |
|---|---|---|---|
| critical | 0 | 0 | 0 |
| high | 7 | 7 | 0 |
| medium | 11 | 11 | 0 |
| low | 9 | 9 | 0 |

Plus 6 items reported to other owners (R-01 to R-06), not edited.

## Performance fixes (from `docs/audit/performance.md`, integrator request)

Measured with the report's own harness (`docs/audit/tools/bundle-report.mjs`, `perf-3d.mjs`) on `next build && next start`, the same profiles (desktop; phone = 4x CPU + Slow 4G).

| id | change | before | after |
|---|---|---|---|
| PERF-03a | `lib/paths.ts`: dependency-free `STRUCTURE_SLUGS`, `structureFromParam`, `designerPathLite`, `PRODUCT_PRESETS`, `readDraftSummary` (`catalog.ts` re-exports them). `ResumeCard` reads a draft summary, not the parsed doc. The start page's 3D preview is a lazy chunk (`StartViewer.tsx`) with an SVG poster. A unit test keeps the slugs equal to the engine's. | `/design` 472 KB gz, three + library + dieline in the first bundle | **146 KB gz**, none of them (they load after idle for the preview) |
| PERF-04 (share) | `SharedViewer` is light. The 3D view (`SharedScene.tsx`: library, dieline, three) is a lazy chunk; the page passes the model thumbnail as a poster. | `/s/[id]` 463 KB gz | **142 KB gz** |
| PERF-04 (editor) | No client-side `MODELS.map(toCard)`: the editor now uses the catalogue's self-contained `CataloguePicker` (merged from main), loaded with `next/dynamic`, so no cards are sent. The picker is `next/dynamic`, mounted on first open and kept, so closing still animates and returns focus. | 507 KB gz | 509 KB gz. The editor still needs `docGeometry` / `modelByCode`, and `@/lib/library` imports every generator, so the per-family `import()` split in `src/lib/library` (not designer scope) is what removes the 172 KB library chunk. |
| PERF-10 | The editor page emits `<link rel="preload" as="script">` for the 3D chunks of the current kind (read from the build's react-loadable manifest; `rel=preload` because Next's chunks are classic scripts, not modules). A large model poster shows in the stage from the first paint and fades out on the first rendered frame (`onReady`). | first 3D frame 639 ms / 9,029 ms (phone); LCP = 160x120 poster | 845 ms / 9,505 ms (the same within run noise: the bundle is unchanged). The poster is visible at first paint. The phone number needs PERF-04's library split. |
| PERF-08 (designer part) | While a size field is typed (coalesced `dims` / `vessel` steps), dieline + textures + mesh rebuild after 150 ms of quiet; artwork rescaling tracks the latest committed geometry (`geoFacesRef`) so quick edits do not compound. "Skip the repaint when only dims change" needs UV scaling in the engine's texture path (report items 2 and 3): engine session. | config → frame p50 2,184 ms desktop / 2,293 ms phone | **1,461 ms** / 2,222 ms |
| PERF-22 | `useArtworkCanvases` sheet capped at 1024 px when `defaultMaxDpr() < 2`. | resident texture after config 37.3 MB; texture data uploaded over 12 changes 438 MB | **23.3 MB**; **11 MB** (23 uploads) |
| PERF-18 | Quote results and tab switches are applied in `startTransition`; `ConfigPanel` and `Scene3D` are `memo`, with stable `onOpenPicker` / `onFinish` / `onPrintSides`. | INP 168-336 ms | Not re-measured (needs the page harness's INP run). |
| PERF-19 | Undo stack capped at 50 (was 100). Snapshots are `DesignDoc`s only, with no geometry and images shared by reference. | heap 16.6 → 41.3 MB after 50 switches | 17.1 → 28.1 MB after 20 switches (same harness, `SWITCHES=20`). The rest scales with WebGL context churn (PERF-09). |
| PERF-09 | `Stage3D.tsx` (lazy): one un-keyed `<EngineCanvas>` (engine API, branch `…-3d-engine` up to dc0e0a9, merged here) with `PackagingSceneContent` / `VesselSceneContent` children via `Scene3D` / `VesselView` `embedded` mode; the stage poster fades on `onContentReady`. The leak hunt on the shared canvas found 3 textures per container visit (engine PMREM target, fixed 3a4cd84), then 1 (engine label material holding a disposed texture, fixed dc0e0a9), plus the pouch group's own maps (`VesselView`, fixed here). | 16 contexts over 20 mixed switches (a new context, environment and shaders on every box ↔ container switch); switch p50 3,734 ms | Mixed 5-model cycle: **1 context**, textures flat (11 live / 8.6 MB after 10 switches, 11 / 8.9 MB after 30), switch p50 3,051 ms (it includes opening the picker). JS heap 17 → 32.9 MB after 30 switches is the undo history (≤ 50 snapshots, PERF-19). |

---

# Round 2

Scope as round 1 (`src/app/[locale]/design`, `src/components/designer`, designer i18n keys), plus the three items the integrator assigned: the intermittent hydration error #418 on `/en/design/<slug>`, PERF-09 (one WebGL context for box and container switches) and FN-02 (spot UV invisible without a mask). Method: `next build && next start` (seeded SQLite), Playwright ar + en, 390x844 (touch) and 1440x900, keyboard only, axe-core (wcag2a/aa, 21aa, 22aa), `docs/audit/tools/perf-3d.mjs`, plus purpose-built probes (WebGL texture census, CPU profile, trace, hydration timeline).

Screenshots: `docs/screenshots/audit/designer/r2/` (`before-*`, `after-*`, 1x and device DPR).

## Round 1 items re-verified in the browser

| id | check (round 2) | result |
|---|---|---|
| D-01 / D-02 | Start page hero; wheel over the 3D preview scrolls the page (scrollY 0 → 500). | still fixed |
| D-05 | Phone: no view-control overlay on the stage; controls in their own row. | still fixed |
| D-09 | Tabs stay visible after scrolling a long panel (390, ar). | still fixed |
| D-18 | Landscape phone (844x390): no page scroll, viewer fits the stage. | **reopened, round 2** → fixed as R2-02 (the clip that D-18 added hid the bottom of the model in portrait) |
| D-21 / D-22 | Sheet opens with a real touch swipe on the handle; tap still toggles. | still fixed |
| D-24 | Poster until the first frame (box). Containers now get it too (R2-03). | still fixed |
| other D-xx | Spot-checked in the `after-*` screenshots (copy, plural forms, mm unit, model card, face names). | still fixed |

axe-core round 2: **0 violations** on start page, box editor, container editor, picker and finish states, ar + en, 390 + 1440, before and after. No console errors, no horizontal scroll.

## Findings (round 2)

| id | severity | page / file | finding | standard | fix | status |
|---|---|---|---|---|---|---|
| R2-01 | high | `/design/<model>` (`design/layout.tsx`) | **Intermittent React #418 ("HTML")**: in roughly 3 % of loads with warm JS (0 in a cold run, 7 of 216 in parallel runs) React threw away the server HTML of the **whole document** and client-rendered it (flash, lost scroll and focus, e2e failures on FEFCO_0436 / CAN-AEROSOL). Root cause, found with a temporary probe in React's `throwOnHydrationMismatch`: the failing fiber was the layout's `<main>` while the hydration cursor was already inside it (`<!--$-->`). The model segment's router reads its RSC payload with `use()`; there was no Suspense boundary between `<main>` and that read (`loading.tsx` only wraps the page), so a payload that resolved a tick late suspended up to the root, and the retry tried to claim `<main>` again. Not the cause, ruled out with measurements: streaming-hydration vs parser race (react#37321: hydration was gated after DOMContentLoaded and still failed), batched `$RV` reveals (all done before hydrateRoot), streaming metadata (`htmlLimitedBots: /./` still failed), time / storage / random render values (a development React build shows no attribute or text diff at all). | WCAG 4.1.2 (robust), 2.4.3 (focus lost on re-render) | `<Suspense>` directly inside `<main>` in `design/layout.tsx` (server output only gains `<!--$-->` markers). Because a `notFound()` inside that boundary would stream with status 200, the unknown-model check moved above it: the middleware forwards the path (`x-elba-path`, one additive line) and the layout calls `notFound()` (404 kept, start page stays static). New e2e `designer pages hydrate without errors` (12 loads, ar + en, box + container + start page) fails on any #418 / #419 / #423 / #425 or "Hydration failed". | fixed: **0 of 576 loads** after (288 with the probe build, 288 with stock React); the new e2e passes on desktop + mobile |
| R2-02 | high | editor, 390 px portrait (`designer.module.css`) | The bottom of the 3D model was cut off: the engine's 240 px viewer floor beat the designer's `.sceneWrap > * { min-block-size: 0 }` (equal specificity, CSS chunk order decides), so a 240 px canvas sat in a 186 px stage that clips it. | WCAG 1.4.10 (reflow), visual | Selector `.sceneWrap > [role="application"]` (0,2,0) wins whatever the load order. Verified: viewer 186 px = stage 186 px, model centred (`after-editor-ar-390.png` vs `before-stage-clipped-ar-390.png`). | fixed |
| R2-03 | high | PERF-09 (`Stage3D.tsx`) | Box ↔ container switches created a new WebGL context, environment and programs each time. | budget: switch < 1 s | Round 2 built a parallel one-canvas stage (`DesignStage`) and found the same GPU leaks the engine session fixed (PMREM of each content's environment, cloned label textures). When `main` was merged, the round-1 designer session's `Stage3D` (same approach, engine fixes 3a4cd84 / dc0e0a9) was already integrated, so `DesignStage` was dropped in favour of it (integrator: do not redo PERF-09). Round-2 measurements of the one-canvas approach are kept below as independent confirmation. | fixed on `main` (Stage3D); see note on < 1 s |
| R2-04 | high | container editor copy (`DesignerApp`, `Modals`, i18n) | Bottles, jars, cans and pouches said "box": "اطلب هذه العلبة" / "Order this box", "500 علبة: اعرف السعر" / "500 boxes: see the price", "علبة بدون اسم", "سعر العلبة", "تكبير عرض العلبة". | content accuracy; ISO 9241-110 (self-descriptiveness) | `designer.container.*` keys: "اطلب هذا التصميم" / "Order this design", "{qty} قطعة: اعرف السعر" / "{qty} pieces: see the price", "تصميم بدون اسم", "سعر القطعة", "تكبير عرض النموذج". Gate reasons ("price", "export", "order") now say "تصميمك" / "your design" for every model. | fixed (`after-pouch-ar-1440.png`) |
| R2-05 | medium | finishes / materials (`ConfigPanel.tsx` `OptionGroup`) | On kraft board, 7 of 11 finishes were disabled and each printed a full "Not available: …" paragraph, so the 4 usable finishes were buried in a wall of grey text. | ISO 9241-110 (suitability for the task), Hick's law | Usable options first; 2 or more ruled-out options fold into a disclosure "Unavailable options (7)" / "خيارات غير متاحة: 7" (32 px target, focus ring, 150 ms ease-out chevron, mirrored in RTL, reduced-motion safe). Each reason is still the input's `aria-describedby`. | fixed (`before-finishes-wall-en-1440.png` → `after-finishes-*`) |
| R2-06 | high | FN-02 (`lib/config.ts`, `Scene3D.tsx`) | Spot UV / foil / emboss changed 0 % of pixels when the design had no artwork: masks started on "every layer of the outside" (none), and the panel said "Add text or a logo to see this finish". | printer convention: spot UV is a defined area | `defaultFinishLayerIds`: masked finishes start on the **logo** (image layers), else the text, else every visible item. With no artwork yet the 3D preview covers the whole front panel (the `DesignFinish` contract: empty mask = main face) through a stand-in layer that never enters the document, and the panel says so ("No artwork yet, so it covers the whole front. Add a logo to limit it."). The first item added fills an empty mask; deleting the masked item falls back to the default. Unit tests: `finish-masks.test.ts`. | fixed (`before-fn02-foil-empty.png` → `after-fn02-foil-empty.png`) |
| R2-07 | medium | artwork inspector (`ArtworkPanel.tsx`) | The finishes help said "Foil, spot UV and emboss go on the artwork you choose", but nothing let you choose. | WCAG 3.3.2 (instructions), ISO 9241-110 (controllability) | "Finishes on this item" / "تشطيبات هذا العنصر" checkboxes in the selected item's inspector (outside surface, boxes) add or remove that item from each masked finish. Help text: "…start on your logo. Select an item to add it or take it off." | fixed |
| R2-08 | medium | editor document (`[structure]/page.tsx`) | 330 KB HTML, 144 KB of it the picker cards of all 370 models, parsed on every editor load. | perf budget (LCP, TBT) | Round 2 moved them to a cached JSON route; `main`'s catalogue `CataloguePicker` now loads its own cards and the page no longer inlines them, so that route was dropped in the merge. | fixed on `main` (catalogue) |
| R2-09 | low | lid height slider (`ConfigPanel.tsx`) | Value read "40 mm" in the Arabic UI. | MSA localisation | `common.mm` ("مم"). | fixed |
| R2-10 | low | start page body (ar) | "برقم موبايلك عندما تكون جاهزا": colloquial "موبايل" and masculine-only "جاهزا". | MSA, gender-neutral copy | "واعرف سعرها برقم هاتفك المحمول في أي وقت." | fixed |
| R2-11 | low | `server.ts · lazyChunkHrefs` | Read the loadable manifest from `.next` only, so a build in `NEXT_DIST_DIR` preloaded 404 chunks. | — | Honours `NEXT_DIST_DIR`. | fixed |

### PERF-09 measurements (round 2 one-canvas build, before the merge with `main`)

`docs/audit/tools/perf-3d.mjs`, `SWITCHES=20`, box model, cycle FEFCO_0201 → ECMA_RTE → STAND_UP_POUCH → FEFCO_0427 → ROUND_BOTTLE (same build, same SwiftShader host):

| | WebGL contexts created | live textures / resident after 20 switches | programs compiled | heap before → after | switch p50 / max (desktop) | switch max (phone) |
|---|---|---|---|---|---|---|
| base | 16 | 11 / 8.9 MB | 155 | 17.4 → 28.0 MB | 2,675 / 3,652 ms | 8,705 ms |
| shared canvas, before the janitor | 1 | 34 / **70.3 MB** (PMREM + label leak) | 110 | 17.4 → 27.7 MB | 3,146 / 4,359 ms | — |
| **round 2 one-canvas build** | **1** | **12 / 11.9 MB** | **110** | 17.4 → 27.5 MB | 3,033 / 4,042 ms | **4,652 ms** |

Texture census over 20 mixed switches (WebGL `createTexture`/`deleteTexture` wrapper): 13 → 12–13 (flat) after; before the janitor 13 → 21 and growing by one PMREM target per container mount plus one label per vessel mount.

Switch time note: the harness's p50 includes opening the picker. Click → first frame of the new model is 0.85–1.0 s (box) and 1.2–1.6 s (container) in this environment. A trace of the container switch shows the time is SwiftShader, not the app: one 1.06 s task = 684 ms GPU-process `Commit` (software rasterisation) + 361 ms first render (synchronous shader link, `getProgramInfoLog`); React and geometry work are under 60 ms. This Chromium build has no `KHR_parallel_shader_compile`, so the `compileAsync` warm-up is a no-op here. On hardware WebGL both parts are an order of magnitude smaller, so it is expected to land under the 1 s budget, but that could not be measured in this sandbox.

## Reported to other owners (round 2, not edited)

| id | owner | finding | suggested fix |
|---|---|---|---|
| R2-R1 | configurator (`lib/configurator/rules.ts`) | Spot UV is refused on white-top corrugated even with matte lamination, while its own message says "needs a coated or laminated surface". | Allow spot UV on `WHITE_TOP_LINER` when a matte / soft-touch lamination is selected. |
| R2-R2 | catalogue (`ModelPicker.tsx`) | On phones the picker focuses the search field on open, so the keyboard covers half the sheet before the user has seen a model. | Focus the dialog (or the close button) on touch devices; keep search autofocus on fine pointers. |
| R2-R3 | 3D engine | The PMREM of a render-target environment is never released by three (`WebGLCubeUVMaps` adds no dispose listener for render-target textures), and vessel label textures are cloned per material. The designer frees both on switches; any other page that swaps environments inside one canvas would leak the same way. | Dispose the PMREM target with the environment in `StudioEnvironment`, dispose material maps in `VesselModel` cleanup. |
| R2-R4 | checkout / payments | `e2e/journey.spec.ts` stops at the card step (`Card number` never appears on `/checkout/pay/…`). The designer part of the journey passes. | Checkout session. |

## Files touched outside scope

- `src/middleware.ts`: one line, forwards `x-elba-path` to Server Components (R2-01, keeps the 404 status).

## Verification (round 2)

- `npm run lint` clean, `npm run typecheck` clean, `npm test` **55 files, 6,251 tests passed** (new: `finish-masks.test.ts`), `npm run build` OK.
- Playwright (`--workers=2 --trace off`, `next start` with `OTP_DEV_ECHO=1` and a local `SESSION_SECRET`): `designer.spec.ts` all passed on desktop + mobile (incl. the two new tests), `smoke.spec.ts` passed, `journey.spec.ts` 1 failed at the checkout card step (R2-R4, outside scope), 1 skipped (its own desktop-only skip). `models.spec.ts` subset (FEFCO 04xx, cans, bottles, pouches, jars, tubes, ECMA RTE): **119 / 119 passed**.
- Hydration: 0 #418 in 576 instrumented loads after the fix, against 7 of 216 before (same harness: 3 parallel browsers, warm JS, the e2e's page sequence). Before the fix the new e2e failed 1 of 6 and 3 of 12 repeats; it passes after.

## Counts (round 2)

| severity | found | fixed | open |
|---|---|---|---|
| critical | 0 | 0 | 0 |
| high | 5 (R2-01, -02, -03, -04, -06) + 1 reopened (D-18) | 6 | 0 |
| medium | 3 | 3 | 0 |
| low | 3 | 3 | 0 |

Plus 4 items reported to other owners (R2-R1 to R2-R4).

# Round 3

Base: `main` (platform, admin, checkout, catalogue, engine) merged with the round 2 designer branch (`…-r2-designer` 3aeb6a8: #418 Suspense under `<main>` + 404 check above it, FN-02, phone stage clip). Rows from `docs/audit/ROUND3.md` (designer), `craft.md` (CR-*), `a11y.md` (X-*), `business.md` (B-*) and the integrator's E-08. Method as before: `next build && next start`, Playwright ar + en, 390 and 1440, axe-core, keyboard.

| id | severity | where | finding | standard | fix | status |
|---|---|---|---|---|---|---|
| B-26 / B-02 | medium | price badge (`lib/quote.ts`, `Modals.tsx`, i18n) | The badge showed the cheapest offer and its lead time, so the public page, badge and checkout disagreed. It did not say the price excludes VAT, and the Arabic counted forms were wrong ("13 أيام"). | business plan §1.3, §5.7 | `toPriceState` uses `headlineOffer()` (best match, the offer checkout pre-selects). Copy: "{qty:box} from {price} each excl. VAT · delivered in {days:day}" / "{qty:box} من {price} للعلبة دون الضريبة · التوصيل خلال {days:day}"; containers use `{qty:piece}`. The counted placeholders give "13 يوما", "يومين", "500 علبة". The unit test now expects the headline offer, not the cheapest. | fixed |
| CR-20 | medium | `Modals.tsx · PriceBadge` | The tick re-keyed the whole sentence. | motion craft | Only the amount span is keyed and ticks (300 ms, off under reduced motion). | fixed |
| CR-21 / CR-24 | medium | stage loading, price chip, price modal | Spinners: a large one on the stage, plus "Loading Getting the price" as the chip's name. | skeletons over spinners; WCAG 4.1.2 | Stage: the `.stageSkeleton` used by the route loader (`role="status"`, `aria-busy`). Chip: a 64 × 12 px shimmer bar, `aria-busy`, name = "Getting the price" only. Price modal: `SkeletonBodyText`. The face and dieline views mount synchronously, so the only flash left was this loader. | fixed |
| B-22 / B-03 | medium | export (`DesignerApp.exportPng`, `ExportModal`) | Exports carried no mark, and the export modal and its toast had no way back to ordering. | business plan §1.3 growth loop / bridge 2 | Standard PNG → `stampExportMark(blob, { locale })` (marketing's mark, bottom end corner); HD stays clean, and the choice help text says so. "Order this box" / "Order this design" is a secondary action in the export modal and the action on the "Image downloaded" toast. | fixed |
| E-08 | medium | flexible packs (`FlexOptionsGroup.tsx`, `ConfigPanel`) | Zipper, spout, window, tear notch, hang hole and the other options could not be edited; they always resolved to the defaults. | — | `DesignVessel.options` (additive, validated in the doc schema); a "Pack options" group lists only `def.allowedOptions`. Spout and hang hole are selects, the rest checkboxes. An option the size or film rules out stays visible, disabled, with "Not available at this size or with this film." The library `describe` passes the options to `parseFlexConfig` and falls back to the defaults if they don't validate. The quote key includes the options. Unit tests: `flex-options.test.ts`. | fixed |
| CR-11 | high | size helpers (ar) | Ranges rendered reversed ("330–130"). | WCAG 1.3.2 | `<bdi dir="ltr">{min}–{max}</bdi>` in `ConfigPanel` (box + vessel) and `BoxPanel`. Verified: "80–600", "25–250". | fixed |
| CR-47 / CR-58 | low | stage face select | The inline label ran into the value ("الوجه الأمام") and mixed type sizes. | MSA; type scale | Label above, value only inside; stage header aligned to the end. | fixed |
| CR-63 | medium | price chip vs toolbar | 40 px pill next to 32 px buttons. | component consistency | Chip at 32 px (still a pill, target ≥ 24 px). | fixed |
| X-04 | medium | `DesignerTopBar` | `aria-label="Home"` hid the visible wordmark. | 2.5.3 | No aria-label; a visually hidden "Home" follows the wordmark, so the name is "Elba Home". | fixed |
| X-05 | low | panel headings | `h3` directly under the page `h1`. | 1.3.1 | `as="h2"` in BoxPanel, ConfigPanel, LayersPanel, PreflightPanel and ArtworkPanel's inspector; LayersPanel's surface sub-heading stays `h3`. | fixed |
| X-06 | medium | `/s/<token>` not found | No `h1`. | 1.3.1 | Already fixed on `main` (`<Page title={notFoundTitle}>`); re-verified. | verified |
| X-07 | low | `FaceEditor` | The live region announced only the selection, never the new position. | 4.1.3 | After a keyboard move, resize or rotate (debounced 300 ms): "X 159.5 mm, Y 41.5 mm, 103 × 26 mm, 15°" / "س 159.5 مم، ص 41.5 مم، 103 × 26 مم، 15°". It resets on a new selection. | fixed |
| X-11 | info | Board / Printing radios | Native 16 px radios. | 2.5.8 (passes) | No change: each option is a full-width `<label>` row about 40 px tall, so the whole row is the target (larger than the kit control's 24 px). | no change needed |
| B-17 | low | sign-up gate step 1 | "Marketing messages only if you opt in" appeared before any box existed. | PDPL 151/2020 clarity | "We send a verification code by SMS. You choose whether to get offers on the next step." / "…يمكنك اختيار تلقي العروض أو رفضها في الخطوة التالية." | fixed |
| Route split | — | `design/(picker)`, `design/(editor)` | The start page used the dark designer bar (CR-05: three chromes). | ISO 9241-110 conformity | `(picker)/layout.tsx` = `MarketingShell`; `(editor)/layout.tsx` keeps the dark bar, **the `<Suspense>` directly under `<main>` (R2-01)** and **the `x-elba-path` 404 check above it**. Each group has its own `error.tsx`. Verified: `/en/design` 200 with the white header, `/en/design/mailer-box` 200 with the dark bar, `/en/design/no-such-model` **404**. | fixed |

### Files touched outside scope (round 3, additive)

- `src/types/design.ts`: `DesignVessel.options?` (E-08).
- `src/lib/library/vessels.ts`: `describeVesselModel` forwards `options`; flexible `describe` passes them to `parseFlexConfig`, falling back to the defaults (E-08).
- `src/lib/library/doc.ts`: passes `doc.vessel.options` (E-08).
- `e2e/designer.spec.ts`: badge regex updated to the B-02 copy.

### Verification (round 3)

- `npm run lint` and `npm run typecheck` are clean. `npm test`: 8,282 passed (new: `flex-options.test.ts`; `storage-quote-catalog.test.ts` now expects the headline offer). `npm run build` OK.
- axe-core: 0 violations on the start page (en 1440, ar 390), the box editor (ar 1440) and the pouch editor (en 390). No console errors, no horizontal scroll. Screenshots: `docs/screenshots/audit/designer/r3/`.
- Playwright `designer` + `smoke` + `journey` (`--workers=2 --trace off`): 16 passed, 1 skipped, 1 failed. All 5 designer tests pass on desktop and mobile, including **"designer pages hydrate without errors"** and the PERF-09 canvas test. The failure is `journey` on desktop at the vendor step "Submit for quality check" (button stays disabled after the QC photo upload), outside designer scope; the design, gate, price and checkout steps before it pass.
