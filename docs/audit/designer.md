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

# Round 4

Base: `main` at 781d663 (rounds 1 to 3 merged). Method: `next build && next start` (`OTP_DEV_ECHO=1`, `ALLOW_MOCK_PAYMENTS=1`), Playwright ar + en, 390 × 844 (touch) and 1440 × 900, no account and signed in, keyboard, axe-core (wcag2a/aa, 21aa, 22aa), `docs/audit/tools/perf-pages.mjs`. For the hydration lead, a temporary probe was patched into the built React DOM chunk (`throwOnHydrationMismatch`: logs the failing fiber's ancestry and the hydration cursor). It was never committed, and the final build has no probe. Screenshots are in `docs/screenshots/audit/designer/r4/`.

## Round 3 rows re-verified in the browser

| id | check (round 4) | result |
|---|---|---|
| R2-01 (#418 editor) | The e2e "designer pages hydrate without errors" was repeated 8, 32 and 24 times on the base. Every failure (3 in 120 runs) was on **`/en/design`, the start page**. The editor had none. | editor still fixed. The start page had the same defect, now R4-01 |
| B-26 / B-02 badge | Signed in, mailer: "500 boxes from EGP 40.06 each excl. VAT · delivered in 10 days" / "500 علبة من 40.06 ج.م للعلبة دون الضريبة · التوصيل خلال 10 أيام". The headline offer and counted forms are correct ("10 أيام" is right for 3 to 10). | still fixed |
| CR-20 / CR-21 / CR-63 | The amount ticks on its own, the chip loads with a shimmer bar, and the chip is 32 px. | still fixed |
| B-22 / B-03 | The standard PNG carries the mark. The export modal has "Order this box" and the toast offers the order action. **However, the PNG also carried the "Your logo here" hint** (R4-10). | mark: still fixed. Hint: R4-10 |
| E-08 | The pouch editor shows "Pack options" with only the allowed options. | still fixed |
| CR-11 | Arabic size helpers read "80–600" and "25–250". | still fixed |
| CR-47 / CR-58 | The face select has its label above and the value only inside. | still fixed |
| X-04 / X-05 | The top bar link is named "علبة الرئيسية" / "Elba Home", and panel headings are h2. axe finds 0 violations. | still fixed |
| X-07 | The live region announces position and size after keyboard moves. | still fixed |
| B-17 | The gate's step 1 copy says you choose about offers on the next step. | still fixed |
| Route split | `/en/design` 200 with the white header, `/en/design/mailer-box` 200 with the dark bar, `/en/design/no-such` **404**. | still fixed |
| `measureText` lead | `measureText` / `fitTextBox` are called only in the add-text and layer-change handlers (`DesignerApp.tsx`). No render or `useMemo` path reads them. `resolveFont` is passed as a function and only called while painting canvases inside effects. | no render path depends on it. Guarded by R4-09 |

axe-core round 4: **0 violations** on the start page, box editor, pouch editor, artwork tab, text added and gate, in ar and en, at 390 and 1440. No console errors and no horizontal scroll.

## Findings (round 4)

| id | severity | page / file | finding | standard | fix | status |
|---|---|---|---|---|---|---|
| R4-01 | high | `/design` start page (`design/(picker)/layout.tsx`) | **Intermittent React #418 ("HTML") on the start page.** It failed in 3 of 120 repeated runs of the hydration e2e on the base (mobile 2/16, desktop 1/48). The probe named the failing fiber `main` (`marketing_main`, from `MarketingShell`) while the hydration cursor was already inside it on `<div class="designer_startPage">`. This is the R2-01 signature: the page segment reads its RSC payload with `use()`, and nothing sits between `<main>` and that read. React threw away the server HTML and re-rendered the document on the client, which loses scroll and focus. | WCAG 4.1.2, 2.4.3 | `<Suspense>` directly inside `<main>` in the picker layout. The page now streams into it within the same response, so the fallback is a `min-block-size: 100dvh` block: the footer never paints above the fold and then jumps. | fixed: **0 failures in 128 runs** after (64 with the probe, 64 on the final build). CLS 0.000 before and after. LCP/TBT unchanged against a base build measured side by side |
| R4-02 | medium | editor top bar (`DesignerTopBar.tsx`) | "Sign in" in the editor always used `next=/design`. A visitor who signed in from the top bar landed on the start page and lost the editor and their `?d=` design. | ISO 9241-110 (controllability), WCAG 3.3.7 (redundant entry) | New client `TopBarSignIn` (in `TopBarLanguage.tsx`) carries the live path and query, read on click because `?d=` is written with `replaceState`. The server fallback is the old link. | fixed: `login?next=%2Fen%2Fdesign%2Fmailer-box` |
| R4-03 | medium | quote-only and preview models (`DesignerApp.tsx`, `Modals.tsx`) | On quote-only and preview models (for example the aerosol can), the toolbar said "Request a quote", but the export modal's secondary action and the "Image downloaded" toast said "Order this design". The quote copy was also hard-coded with `locale === "ar" ? … : …` in four places, outside the dictionary. | consistency (ISO 9241-110), i18n | One `orderLabel` (quote or order) for the toolbar, export modal and toast. Keys `designer.price.quoteBadge / quoteHeading / quoteTitle / quoteAction`. Arabic uses the noun form "طلب عرض سعر" and "التسعير بعرض سعر: عرض السبب" in place of the imperative "اطلب عرض سعر" and "اضغط للتفاصيل". The quote state now shows the tag icon, not the lock icon (it is not gated). | fixed (`after-aerosol-export-*.png`) |
| R4-04 | medium | share modal (`Modals.tsx`) | A spinner showed while the link was being created. Every other loading state in the designer uses a skeleton (CR-21). | skeletons over spinners; WCAG 4.1.3 | A `role="status"` `aria-busy` skeleton with "Creating link" as its text. | fixed (`after-share-loading-ar.png`) |
| R4-05 | low | `DesignerApp.applyGeometry` | The "Removed finishes" toast joined the names with the Arabic comma "،" in English too. | localisation | Use "، " in ar and ", " in en. | fixed |
| R4-06 | low | share modal | When the clipboard was blocked (permissions, insecure origin), "Copy link" did nothing with no feedback. Focusing the read-only link did not select it either. | WCAG 3.3.1 (error identification), 4.1.3 | Visible and announced "Could not copy. Select the link and copy it." / "تعذر النسخ. حدد الرابط وانسخه.". Focusing the link selects all of it. | fixed (`after-share-copy-en.png`) |
| R4-07 | low | export file name | An Arabic design name slugged to an empty string and the file fell back to `elba-box-1080.png`, even for a bottle. | — | Fall back to the model slug (`elba-mailer-box-1080.png`, `elba-stand-up-pouch-…`). | fixed |
| R4-08 | medium | editor, phone, sheet open (`designer.module.css`) | The open sheet (72dvh), the toolbar, the price row and the stage's 12rem floor added up to 968 px on an 844 px phone. After "Add text" the page scrolled 124 px and the sticky top bar covered the 3D/Face/Dieline switch and the "Panel" label. | WCAG 2.4.11 (focus not obscured), 1.4.10 | The open sheet height is `min(72dvh, 100dvh − top bar − 21rem)`, and the panel scrolls inside itself. | fixed: page scrollHeight 844 = viewport, scrollY 0 (`before-phone-sheet-overflow-en-390.png` → `after-phone-sheet-en-390.png`) |
| R4-09 | low | `fonts.ts` (hydration lead) | `measureText` estimates on the server and measures with canvas in the browser, and the result changes when the webfont loads. It is safe today because only event handlers call it, but nothing stops a render path from starting to. | WCAG 4.1.2 (robust) | Doc comment on the contract and a unit guard (`measure-text-usage.test.ts`): only `DesignerApp`'s add-text and layer-change handlers may call `measureText` / `fitTextBox`. | fixed |
| R4-10 | high | export PNG and saved thumbnails (`DesignerApp.exportPng`, `saveToServer`) | **Exported mockups carried the "شعارك هنا" / "Your logo here" hint** whenever the outside had no artwork yet. A visitor exporting a plain kraft box to post got a placeholder on it. Saved design thumbnails had it too. CR-15 says the hint is preview-only. | content accuracy; business plan §1.3 social loop | `shoot()`: when the outside is still empty, it repaints the sheet without the hint, waits for the texture version and two frames, takes the screenshot, then restores the hint. The export and the thumbnail both use it. | fixed (`after-export-ar.png`: plain box with the mark) |
| R4-11 | high | start page, phone (`DesignStart.tsx`, `StartViewer.tsx`) | **Phone LCP 11.2 to 12.9 s** (perf-pages phone profile). The hero's SVG poster painted at about 2 s. When the 3D chunk mounted, the engine painted its own, larger poster `div` at about 6 s, which became the LCP element. | LCP < 2.5 s budget | One poster `<img>` stays mounted from the first paint and fades out (200 ms, off under reduced motion) when the viewer reports its first frame. The engine gets no `poster`, so no later, larger candidate appears. | fixed: phone LCP **4.0 to 4.6 s** (ar/en), CLS 0. What remains is the Slow 4G profile's FCP of 3.3 to 3.9 s, which is platform-wide (CR-43 / round 3 note) |
| R4-12 | high | editor, phone (`DesignerApp.tsx`, `[structure]/page.tsx`) | **Phone LCP 10.5 to 11.1 s.** The editor's server HTML was an empty skeleton until the family pack loaded. The stage poster then painted at about 6.1 s, followed by the engine's larger poster `div` at about 6.3 s. | LCP < 2.5 s budget | The page passes `posterSlug`, and the loading skeleton in the server HTML shows the model's poster. The engine no longer gets its own poster, because the stage `<img>` overlay already covers it until the first frame. | fixed: in the LCP harness (Pixel 5, 4x CPU, 150 ms RTT) the LCP element is the poster at **2.1 s** (was 6.3 s) |

### Reported to other owners (not edited)

| id | owner | finding | suggested fix |
|---|---|---|---|
| R4-R1 | platform / marketing (`MarketingShell.tsx`) | Every page in `MarketingShell` has the R4-01 structure (`<main>{children}</main>`, no boundary). The designer start page now has its own boundary, but home, boxes, catalogue, share and account pages can hit the same intermittent #418. | Put the boundary in `MarketingShell` (`<main><Suspense fallback={<div style={{minBlockSize:"100dvh"}}/>}>{children}</Suspense></main>`), then repeat each page's hydration check. |
| R4-R2 | 3d-engine (`PackagingScene` `poster`) | The engine's poster is a full-bleed `div` that paints after the JS chunk. Any page that already shows its own poster (share viewer, marketing hero) gets a second, larger LCP candidate seconds later. | Document "pass `poster` only when the page has none", or render the engine poster in the server HTML. |

## Files touched outside scope

None. `src/app/[locale]/design/(editor)/[structure]/page.tsx` (one prop) and the i18n `designer.*` keys are inside scope.

## Verification (round 4)

- `npm run lint` and `npm run typecheck` are clean. `npm test`: **80 files, 8,297 tests passed** (new: `measure-text-usage.test.ts`). `npm run build` OK.
- Playwright (`--workers=2 --trace off`): `designer` + `smoke` + `journey`: **17 passed, 1 skipped** (journey's own desktop-only skip), 0 failed.
- Hydration e2e repeated: before, **3 failed in 120** (all `/en/design`). After, **0 in 128**: 64 on the probe build and 64 on the final build.
- perf-pages, start page: phone LCP 11.3–12.9 s → **4.0–4.6 s**, CLS 0.000. Desktop LCP 0.58–0.68 s, unchanged.
- The rest of the fixes were checked in the browser: export PNG, share modal states, quote-only labels, phone sheet, top bar sign-in link, ar and en.

## Counts (round 4, new findings, before fixing)

| severity | found | fixed | open |
|---|---|---|---|
| critical | 0 | 0 | 0 |
| high | 4 (R4-01, R4-10, R4-11, R4-12) | 4 | 0 |
| medium | 4 (R4-02, R4-03, R4-04, R4-08) | 4 | 0 |
| low | 4 (R4-05, R4-06, R4-07, R4-09) | 4 | 0 |

Plus 2 items reported to other owners (R4-R1, R4-R2). This round found medium-or-worse issues, so the designer area needs another round.

## Round 5 rows (integrator request, `docs/audit/ROUND5.md` at 553e407, merged)

| id | severity | where | finding | fix | status |
|---|---|---|---|---|---|
| R4-CR-11 | medium | editor, phones (`DesignerApp.tsx`, `designer.module.css`) | The stage header, a 7-button control row and the fold row were stacked, so the canvas was about 170 px tall and the model filled about 30 % of it (a bottle about 40 px wide). The Face select appeared twice. | Phones, portrait, sheet down: the stage is `minmax(46dvh, 1fr)` and the closed sheet takes the rest (at least 10rem). The seven view buttons became one "Adjust view" / "ضبط العرض" menu (7 menu items, stays open between taps, Escape closes it; drag plus the menu meets 2.5.7) in the fold row, so there is one control row. Under 490 px the stage header has no Face select (the Artwork panel has it). In landscape the row keeps only the menu. | fixed. At 390 × 844 the canvas is **294 px** (was about 170), stage 412 px (≥ 46dvh = 388), page height = viewport. Model bounding box (shadow included): mailer 82 % × 69 %, bottle 90 % of the height, pouch 85 % of the height (`after-r5-stage-*.png`, `after-r5-view-menu-ar-390.png`, `after-r5-landscape-en.png`) |
| R4-CR-18 | low | ar fold and closure labels | Two grammars: "مسطحة / نصف طي / مغلقة" and "إغلاق / فتح". | Box: "فرد · نصف طي · طي كامل" (open-top: "تجميع كامل"). Vessel: "غلق · فتح · دوران تلقائي". | fixed |
| R4-B-01 (designer half) | critical | share page (`s/[id]/page.tsx`) | The share page named and linked the base structure: the badge and "Style" said "Straight tuck end carton" for an aseptic brick, "Design your own" opened the base structure, and the CTA said "Order this box" even for quote-only models. | The page uses the library model: its name in the badge, title and "Style", a new "Model" row with the code, the model's poster, and "Design your own" / "Open design" link to the model. The CTA is "Request a quote" / "طلب عرض سعر" for quote and preview models, and "Order this design" for containers. Its checkout URL carries `&model=<code>` for checkout's server guard (checkout session). Containers show their own size ("Ø 52 × 160 mm", or W × G × H for pouches) and "Print material", not the label sheet's "100 × 1 × 100 mm" and "Board". | fixed, designer half (`after-r5-share-aerosol-*.png`). The fork copy and the server guard belong to checkout |
| R4-24 | medium | start page hero (`DesignStart.tsx`, `StartViewer.tsx`) | The hero 3D turned all the time. | One bounded turn: it stops after a full turn or 8 s of real time (frames are capped, but the budget uses wall time, so a slow GPU still stops at 8 s), then rests. Hovering the stage (mouse) or hovering / focusing a product shortcut starts another turn. Pause, a drag or focus inside the viewer stops it until Play, and Play turns until Pause. Under `prefers-reduced-motion` it never starts by itself. WCAG 2.2.2, 2.3.3. | fixed. Measured: playing at 6 s, resting at 8 s, a hover restarts it, resting again 10 s later. Reduced motion stays at rest after a hover |

Out of scope by assignment: `src/app/[locale]/s/[id]/page.tsx` (share page, designer half of R4-B-01) and `src/i18n/library.ar.ts` (`panel.closeClosure`, used only by the designer).

Verification (round 5 rows): lint and typecheck are clean. `npm test`: 83 files, **8,383 passed**. Playwright `designer` + `smoke` + `journey` + `checkout`: **27 passed, 1 skipped**. Hydration e2e repeated 16×2: **32 passed**.

### a11y round 4 rows (integrator request)

| id | severity | where | finding | fix | status |
|---|---|---|---|---|---|
| a11y R4-05 | medium | model names: start page list (`library.module.css .modelName`) and the editor's model picker (`catalogue/picker.module.css .name`) | Names were clamped to 2 lines (`-webkit-line-clamp`), so under WCAG 1.4.12 text spacing the end of a long name was cut off. | No clamp: names wrap (`overflow-wrap: anywhere`). The 2-line `min-height` keeps the rows aligned. | fixed: with the 1.4.12 spacing stylesheet, **0 of 91** names cut on the start page and **0** in the picker, ar and en, at 390 and 1440 (`after-r5-picker-textspacing-ar-390.png`) |
| a11y R4-06 | low | `ArtworkPanel` inspector | The sub-headings "Move", "Quick placement" and "Position" were h4 under the inspector's h2. | `as="h3"`. Outline: h2 "Selected item…", h3 Move / Quick placement / Position. axe (incl. best-practice) on the panel: 0. | fixed |

Outside scope: `src/components/catalogue/picker.module.css` (one rule, the picker opened from the designer). Tests: lint clean, vitest 8,383 passed, Playwright `designer` + `catalogue` 22 passed, 4 skipped.

# Round 6

Base: main 7292e05 (includes 7936acb) merged into this branch (`49f8490`). Conflicts:
- **Share page:** I kept checkout's quote reason and model poster, then added the designer half on top (Model row, container size, `&model=` on the CTA, i18n labels).
- **`DesignerApp`:** I kept main's `staticQuote || price.status === "quote"`, with the label coming from the dictionary.
- **Picker `.name`:** the line clamp stays removed.

Fresh pass: Playwright ar + en, 390 and 1440, axe, keyboard, `perf-pages.mjs` (both profiles, every designer page).

axe-core: **0 violations** on the start page, box and pouch editors, artwork tab, text added and gate, ar + en, 390 + 1440. No console errors and no horizontal scroll.

## Findings (round 6)

| id | severity | page / file | finding | standard | fix | status |
|---|---|---|---|---|---|---|
| R6-01 | high | start page, phone (`DesignStart.tsx`) | **INP 640 ms** (budget 200). The first tap waited 444 to 474 ms for a 784 to 816 ms main-thread task: the hero's 3D viewer mounting on idle, right when the visitor starts to interact. TBT was 6.3 to 6.5 s. | INP < 200 ms; WCAG 2.2.2 (and battery) | On phones and touch screens (`max-width: 767px` or `pointer: coarse`) the hero keeps its poster, and the 3D view loads only when the visitor presses Play. Hover and focus no longer start a turn before then. Desktop is unchanged. | fixed for the passive load: **TBT 6.3–6.5 s → 1.7–2.1 s**, no 3D work unless asked. perf-pages still reports a high INP (784 / 1,248 ms). The cause is the tool itself: it taps Play, which loads the 3D view (one 700–880 ms task, engine), and its next key press lands during that task. The chip handlers take under 5 ms. Splitting that task goes to the 3D engine (R6-R1) |
| R6-02 | medium | editor and start page, phone (`[structure]/page.tsx`, `(picker)/layout.tsx`) | The LCP element (the stage or hero poster SVG) was only requested after the CSS, so LCP was about FCP + 1.3 s. | LCP < 2.5 s | Preload with `fetchPriority="high"`: `preload()` in the editor page, and a real `<link>` in the picker layout's shell. `preload()` inside the page that streams into the R4-01 boundary only reached the RSC payload, not `<head>`. | fixed: editor phone LCP **4.55 → 3.54 s (en), 5.20 → 4.33 s (ar)**; LCP is now FCP + 0.3 s |

### LCP check on the editor (integrator request)

`perf-pages.mjs`, phone profile (390 × 844, 4x CPU, 562 ms RTT, 1.47 Mbps):

| page | round 4 base | after R4-11/12 | after R6-02 |
|---|---|---|---|
| designer-box en / ar | 10.45 / 11.12 s | 4.56 / 5.20 s | **3.54 / 4.33 s** |
| designer-bottle en / ar | — | 4.58 / 5.23 s | **3.51 / 4.26 s** |
| design-picker en / ar | 11.3 / 12.9 s | 3.92 / 4.64 s | 3.89 / 4.70 s |

The remaining gap to 2.5 s is FCP (3.2 to 4.0 s on this profile). FCP is platform-wide (fonts, CSS, document on Slow 4G), as noted after round 3. Desktop LCP is 0.48 to 0.66 s and CLS is 0.000 to 0.003 everywhere.

### Reported to other owners (not edited)

| id | owner | finding | suggested fix |
|---|---|---|---|
| R6-R1 | 3d-engine | Mounting a `PackagingScene` (three import, scene, first shader link) is one 700 to 880 ms task at 4x CPU, and 1.2 s for the bottle in the editor. Any input during it waits. | Yield between import, scene build and first render (`scheduler.yield` / `setTimeout(0)`), and warm programs with `compileAsync` before mounting the canvas. |

## Verification (round 6)

- Lint and typecheck are clean. `npm test`: **85 files, 8,419 passed**. `npm run build` OK.
- Playwright `designer` + `smoke` + `journey` + `checkout` + `catalogue` (`--workers=2`): **41 passed, 5 skipped**, 0 failed.
- Hydration e2e repeated 16 × 2 after the merge: **32 passed**.

## Counts (round 6, new findings before fixing)

| severity | found | fixed | open |
|---|---|---|---|
| critical | 0 | 0 | 0 |
| high | 1 (R6-01) | 1 | 0 (the engine part is R6-R1) |
| medium | 1 (R6-02) | 1 | 0 |
| low | 0 | 0 | 0 |

This round still found a medium-or-worse issue (both are performance), so the stop rule calls for another pass.

# Round 7

Base: main dccbd36 (includes this branch's f6e220a, catalogue R7 and the integrator's resolution of the share page, the order label and the picker) merged in. In all three spots I took main's side, then confirmed every designer addition was still there (model row, vessel size, print material, vessel subtitle, `&model=`, the `quoteAction` / container labels, wrapping picker names, the R6 preloads, the phone hero gate).

## Spots the integrator asked me to check in the browser

| spot | check | result |
|---|---|---|
| share page, quote-only model | `/s/<token>` for the aerosol can, ar + en | h1 "Aerosol can" / "عبوة بخاخ إيروسول". Rows: Style, Model `CAN-AEROSOL`, Size "Ø 52 × 160 mm", Print material. CTA "Request a quote" / "طلب عرض سعر" → `/checkout/<id>?share=…&model=CAN-AEROSOL` |
| editor order label | aerosol can, signed in | badge settles on `quote` in about 1.8 s: "Priced by quote: see why" / "التسعير بعرض سعر: عرض السبب". The toolbar, the price modal title and its action all say "Request a quote" / "طلب عرض سعر". Mailer: "500 boxes from EGP 40.06 each excl. VAT · delivered in 10 days" |
| picker names | WCAG 1.4.12 text spacing, ar + en, 390 + 1440 | 0 of 91 cut on the start page, 0 in the editor picker |

## Fresh pass

- axe-core: **0 violations** on the start page (before and after Play), box and pouch editors, the artwork tab, text added, the gate, and the phone "Adjust view" menu open, in ar and en, at 390 and 1440.
- Keyboard:
  - The "Adjust view" menu opens with Enter and focuses its first item. Arrow keys move through the items. Escape closes it and returns focus to the button.
  - Each menu item is 40 px tall (2.5.8).
  - The focus ring is the kit's #005bd3 (focus-visible) on the menu button and the fold buttons.
- Start page on a phone: the poster shows until Play (no canvas). Play loads the 3D view and starts turning, and the button label then says "Pause the turning box".
- Export (standard PNG): no placeholder, mark present, file `elba-mailer-box-1080.png`. Share modal states and the copy-failure message work. No console errors.

**No new findings this round.** Counts: critical 0, high 0, medium 0, low 0. Under the stop rule, the designer area is done.

Still owned elsewhere: R4-R1 (MarketingShell boundary, platform/marketing), R4-R2 and R6-R1 (engine poster and mount task, 3d-engine), and the platform-wide first paint of 3.2 to 4.0 s on the phone profile (performance session).

## Verification (round 7)

- Lint and typecheck are clean. `npm test`: **85 files, 8,419 passed**. `npm run build` OK.
- Playwright `designer` + `smoke` + `journey` + `checkout` + `catalogue` (`--workers=2`): **41 passed, 5 skipped**, 0 failed.
- Hydration e2e, 16 × 2 projects: **32 / 32 passed**.

# Round 8 (performance reopened R4-15 and R4-12)

Base: main 0cc1957 merged in. The performance branch (`r4-performance` b0ee870) is **not in main yet**. A trial merge conflicted only in files outside designer scope (`[locale]/layout.tsx`, `font-preload.ts`, `fonts.ts`), where marketing and performance each built the same English-only Inter preload. I aborted it, so those are left for the integrator. The designer code follows its conventions: direct UI-kit imports in the touched files, and `fetchPriority="high"` on the hero poster. `three/dpr.ts` arrives with that merge, and `DesignerApp` takes it from there.

## Findings (round 8, new)

| id | severity | page / file | finding | standard | fix | status |
|---|---|---|---|---|---|---|
| R8-01 | medium | `/design?structure=…`, `/design?design=…` (storefront deep links) | Since R4-01 these deep links answered **200 with a `<meta http-equiv="refresh">`** instead of a 307: the page's `redirect()` ran inside the Suspense boundary, after the shell had streamed. Browsers still arrived, but crawlers, link checkers and storefront tooling saw a 200 page. | HTTP semantics; SEO | `startPageRedirect()` (new `designer/startRedirect.ts`) runs in the picker **layout**, above the boundary, using the query that `src/middleware.ts` now forwards as `x-elba-search` (one additive line). The page keeps the same check for soft navigations. | fixed: `?structure=FEFCO_0201` → **307** `/en/design/shipping-box`, `?design=abc` → 307 `…/mailer-box?d=abc`, size params kept |
| R8-02 (= PERF R4-15) | high | `/design` phone LCP (`(picker)/layout.tsx`, `page.tsx`) | The hero (headline, stage, poster: the LCP element) streamed after the page's 370-card RSC payload. The poster was at byte 794 K of a 1 MB document. | LCP < 2.5 s | The hero and the resume card render in the **layout, above the boundary**. The page holds only the catalogue section, inside the boundary. The R4-01 boundary still sits between `<main>` and the page's payload read. | fixed: the poster is at byte **15.5 K** of 359 K, and LCP is now **FCP + 0.06 to 0.12 s** (phone, ISOLATE=1, 5 runs: ar 3.83–3.90 s with FCP 3.73–3.79 s, en 3.42–3.49 s with FCP 3.36–3.40 s). This base doesn't include the performance branch's FCP work (inline CSS, font preloads), so the absolute LCP has to be re-checked after that merge. With the payload ordering fixed, LCP follows FCP |
| R8-03 (= PERF R4-12) | high | `/design` phone TBT / INP (`DesignStart`, `StartViewer`) | TBT and INP over budget on the phone profile. | INP < 200 ms | Before tapping Play (R6-01), the page does no 3D work: the hand-replayed tool taps showed no long task over 200 ms during load in ar and one 213 ms task in en, and the chip and tab handlers take under 12 ms. Added this round: the hero turns at about 30 fps (one demand-rendered frame per 33 ms, not every display frame) and draws at 1x on touch screens. | **passive page within budget.** Runs where the 3D view hadn't loaded before the tool's last interaction (JS ≈ 440 KB): INP 104–136 ms, TBT 0.43–0.54 s. **Still over after Play**: perf-pages taps the hero's Play button, which loads the 3D view (two 450–550 ms startup tasks). The tool's next key press then waits: INP 264–760 ms, TBT 1.1–1.4 s, in both locales, with or without the frame cap and 1x canvas. That startup work is the engine's (R6-R1: yield between import, scene build and first render; `compileAsync`) |

Hydration: 40 cold loads (a fresh browser per load: `/ar/design` + `/en/design`, desktop + Pixel 5, 10 rounds), **0 errors**. The e2e hydration test repeated 16 × 2: **32 / 32 passed**.

Files touched outside scope: `src/middleware.ts` (one line, `x-elba-search`, R8-01).

## Verification (round 8)

- Lint and typecheck are clean. `npm test`: **89 files, 8,494 passed**. `npm run build` OK.
- Playwright `designer` + `smoke` + `journey` + `checkout` + `catalogue` + `storefront` (`--workers=2`): **57 passed, 5 skipped**, 0 failed.

## Counts (round 8, new findings before fixing)

| severity | found | fixed | open |
|---|---|---|---|
| critical | 0 | 0 | 0 |
| high | 2 (R8-02, R8-03; both reopened by performance) | 1 fully (R8-02), 1 for the passive page (R8-03) | R8-03 after Play → 3d-engine R6-R1 |
| medium | 1 (R8-01) | 1 | 0 |
| low | 0 | 0 | 0 |

# Round 9

Base: main d61f21f. It includes this branch's 0844838, perf bbc5100, marketing, catalogue and checkout R5, so it was a fast-forward. I checked that the R8 pieces are intact: the hero above the boundary, the redirect from the layout, `x-elba-search`, the 30 fps / 1x hero turn, and `three/dpr` in `DesignerApp`.

## Absolute LCP on the merged code (integrator request)

`perf-pages.mjs`, `ISOLATE=1`, phone profile, 5 runs:

| page | LCP ar | LCP en | FCP | INP | CLS |
|---|---|---|---|---|---|
| `/design` (start page) | **1.26–1.61 s** | **1.22–1.25 s** | 1.02–1.58 s | 88–232 ms (19 of 20 runs < 200 ms) | ≤ 0.002 |
| `/design/mailer-box` (editor) | **1.45–1.49 s** | **1.34–1.36 s** | 0.98–1.05 s | 96–176 ms | 0.002 |

Both pages are **under the 2.5 s budget** in every run. TBT on this profile is 0.29–1.78 s on the start page and 1.33–1.55 s in the editor. That is software WebGL after the 3D loads (in the editor by design; on the start page only after Play), and the mount task is with 3d-engine (R6-R1, as assigned).

## Fresh pass

- axe-core: **0 violations** on every state in ar + en at 390 and 1440: start page, editors, artwork, text, gate, the phone view menu, and the start page after Play.
- Keyboard: the view menu works fully (Enter, arrows, Escape returns focus), and Play / Pause is a real button with the right name.
- Deep links answer 307 (`?structure=`, `?design=`). An unknown model answers 404.
- WCAG 1.4.12 text spacing: no model name is cut (0 of 91 on the start page, 0 in the picker).
- Export: no placeholder, mark present. The share modal states and the copy-failure message work.
- Quote-only model: the badge, toolbar and modal agree.

## Findings (round 9)

| id | severity | page / file | finding | standard | fix | status |
|---|---|---|---|---|---|---|
| R9-01 | medium | price badge for a signed-in visitor (`Modals.tsx · PriceBadge`) | For the first 0.5 to 1 s of every editor load, a **signed-in** visitor saw the signed-out badge: "500 قطعة: اعرف السعر" / "500 pieces: see the price" with a lock icon. The `idle` state (before the debounced first request) fell through to the locked branch. Seen on the aerosol can in ar. | ISO 9241-110 (self-descriptiveness); WCAG 4.1.3 (a wrong status is announced through the live region) | `idle` renders as loading: "Getting the price" / "جار حساب السعر", the shimmer bar, `aria-busy`, and the tag icon. | fixed. Sampled every 100 ms on load: `idle → loading → quote`, all with the loading copy until the result. The lock never shows |

## Verification (round 9)

- Lint and typecheck are clean. `npm test`: **95 files, 8,508 passed**. `npm run build` OK.
- Playwright `designer` + `smoke` + `journey` + `checkout` + `catalogue` + `storefront` (`--workers=2`): **57 passed, 5 skipped**, 0 failed.
- Hydration: e2e repeat 16 × 2 **32 / 32 passed**; 20 cold loads (fresh browser each, `/ar/design` + `/en/design`, desktop + Pixel 5) **0 errors**.

## Counts (round 9, new findings before fixing)

| severity | found | fixed | open |
|---|---|---|---|
| critical | 0 | 0 | 0 |
| high | 0 | 0 | 0 |
| medium | 1 (R9-01) | 1 | 0 |
| low | 0 | 0 | 0 |

# Round 10

Base: unchanged (main d61f21f + 282c9eb). Fresh pass on the angles the integrator suggested: Slow 3G, upload errors, undo/redo and autosave after reload, two tabs on one design, long Arabic text on small faces, and the export modal on a phone.

## Checked and fine

| angle | check | result |
|---|---|---|
| Slow 3G (2 s RTT, 500 kbps), ar pouch, phone | timeline sampled every second | the poster and editor skeleton are up at **4.1 s**, the canvas and badge at 22.5 s. No spinner anywhere, no console errors (`r10-slow3g-early-ar-390.png`) |
| Reload after autosave | add text → URL gains `?d=` → "Saved" → reload | same URL, the text layer is back, status "Saved for 30 days". Undo starts empty after a reload (history is per session), and that is expected |
| Upload: transparent PNG, CMYK JPEG, tiny PNG | added and saved (201) | transparency kept. CMYK is decoded by the browser. The 60 × 40 px PNG is flagged LOW_DPI by the print check |
| Export modal, phone, ar + en | sheet at the bottom, targets, axe | radios 24 px, buttons 114 × 40 px, no overflow, axe 0 (`r10-export-ar-390.png`) |

## Findings (round 10)

| id | severity | page / file | finding | standard | fix | status |
|---|---|---|---|---|---|---|
| R10-01 | high | image upload + autosave (`uploadImage.ts`, `DesignerApp.saveToServer`) | **A valid image could make the design unsaveable.** A 9.7 MB PNG (under the 10 MB upload limit) became a ~13 MB data URL. Every save then answered **413** (body cap 12 MB), the toolbar said "Could not save. Retrying shortly." and retried forever, and the work was never stored on the server. | WCAG 3.3.4-adjacent (error prevention); data loss | (1) A size budget per stored image (`IMAGE_MAX_SRC_CHARS` = 3 M characters, so 3 images and the doc fit in 12 MB). An image over budget is re-encoded as WebP (keeps transparency), then stepped down 0.8× at a time. It is refused with the "too large" message only if it still doesn't fit at 20 %. (2) A 413 is now the `tooLarge` state: "This design is too large to save. Replace a large image with a smaller one." (and Arabic), shown in the status and once in a critical toast. There's no retry loop; the next edit tries again. | fixed. The 9.7 MB PNG now saves (**201**) in ar + en. With a 413 forced by the test: one request in 31 s (it was a 10 s / 20 s / 40 s… retry loop), plus the message and the toast (`r10-too-large-en-1440.png`) |
| R10-02 | medium | upload errors (`uploadImage.ts`, `ArtworkPanel`, `DesignerApp`) | One message for every failure ("Use PNG, JPG, WebP or SVG under 10 MB"), whether the file was the wrong type, too big or unreadable. | WCAG 3.3.1, 3.3.3 | `rejectReason()` / `UploadError(kind)`: "This file type cannot be added…", "This file is larger than 10 MB. Save a smaller copy…", "This file could not be opened as an image. Export it again as PNG or JPG." (and Arabic). The drop zone passes its own reason. Unit test `upload-reject.test.ts`. | fixed: `.txt` → type, 12 MB → size, a fake `.png` → unreadable |
| R10-03 | medium | two tabs on one design (`DesignerApp`) | **Silent last-writer-wins.** Tab B renamed and saved, then tab A's next autosave overwrote it without any notice. | ISO 9241-110 (controllability); data loss | Tabs announce saves on a `BroadcastChannel`. A tab that hears another tab save the same design pauses its autosave (status "Autosave paused") and shows a warning banner: "This design changed in another tab. Autosave is paused here so neither version is lost." with **Load the latest** / **Keep this version**. Keeping saves this tab's version, and then the other tab gets the banner. | fixed for tabs in the same browser: the server keeps A's version until B chooses, and "Keep" stores B's (`r10-stale-tab-en-1440.png`). Two different devices would need a server version check (R10-R1) |
| R10-04 | medium | long text on small faces (`DesignerApp.onLayerChange`, `preflight.ts`) | Typing a long Arabic line on the mailer's side panel kept the font size, so the text ran far past both panel edges and would be cut in print. The print check only said "review" (outside the safe zone). | content integrity; preflight | (1) When the words change and the line outgrows the panel's safe width, the size steps down to fit (6 pt minimum), as it already does when text is added. A size the visitor sets on purpose is kept. (2) Preflight: text that runs past the panel edge itself is an **error**; images and shapes there stay a warning (they may be intentional bleed). Unit test in `preflight.test.ts`. | fixed: the same sentence now fits inside the safe area at about 6.7 pt with no issue (`r10-before-longtext-ar-390.png` → `r10-after-longtext-ar-390.png`) |

### Reported to other owners (not edited)

| id | owner | finding | suggested fix |
|---|---|---|---|
| R10-R1 | technical / platform (`api/designs`) | Saves have no version check, so two **devices** editing one design still overwrite each other silently. R10-03 covers tabs in the same browser only. | Send `updatedAt` with each PUT and answer 409 when it is stale. The designer would then show the R10-03 banner on a 409 too. |

## Verification (round 10)

- Lint and typecheck are clean. `npm test`: **96 files, 8,513 passed** (new: `upload-reject.test.ts`, the off-panel case in `preflight.test.ts`). `npm run build` OK.
- Playwright `designer` + `smoke` + `journey` + `checkout` + `catalogue` + `storefront` (`--workers=2`): **57 passed, 5 skipped**, 0 failed.
- Hydration e2e, 16 × 2 projects: **32 / 32 passed**.

## Counts (round 10, new findings before fixing)

| severity | found | fixed | open |
|---|---|---|---|
| critical | 0 | 0 | 0 |
| high | 1 (R10-01) | 1 | 0 |
| medium | 3 (R10-02, R10-03, R10-04) | 3 | 0 (multi-device conflicts → R10-R1) |
| low | 0 | 0 | 0 |

## R10-R1 (assigned to designer by the integrator): optimistic concurrency for saves

| part | change |
|---|---|
| API (`api/designs/_shared.ts`, `[id]/route.ts`) | `PUT` takes `baseUpdatedAt` (the version the edit started from) and `force`. When the stored design is newer: **409** `{ error: "CONFLICT", updatedAt, doc }`. |
| Store (`designer/server.ts · saveDesign`) | A stale base is refused (`isStaleBase`, pure, in `designer/lib/concurrency.ts`). The write itself is a compare-and-set (`updateMany where { id, updatedAt: base }`), so a save landing between the read and the write is refused too. `force` writes deliberately. Creating a share link keeps `updatedAt` (it is not a content change), so an open editor isn't falsely stale. |
| Editor (`DesignerApp`) | The base comes from the page (`initialUpdatedAt`) and every save response. A 409 opens the R10-03 banner ("This design changed in another tab or on another device", "Load the latest" / "Keep this version") and pauses autosave. "Keep" re-sends with `force: true`. After sign-in (verify-otp claims the draft, which is a write) the editor reads the stored version again before continuing. |
| Tests | Unit: `concurrency.test.ts` (same version, newer or older, no base, force, malformed). e2e: "two devices on one design" (two browser contexts sharing the anonymous cookie, so no BroadcastChannel between them). A's newer save stands, B's older one gets 409, the banner and "Autosave paused", the server still has A's name, and "Keep this version" stores B's. The main designer, journey and checkout flows (sign-up gate, share, order) pass with the check on. |

# Round 11

Fresh pass on the integrator's angles: the dieline / flat view and print accuracy, the colour picker and brand colours, image crop and rotation, RTL text alignment on faces, and the editor at 1024 px.

## Findings (round 11)

| id | severity | page / file | finding | standard | fix | status |
|---|---|---|---|---|---|---|
| R11-01 | medium | editor at 1024 px (iPad landscape / portrait) (`designer.module.css`) | 1024 px is under the 1040 px side-panel breakpoint, so the tablet got the phone bottom sheet. In landscape (1024 × 768) the 3D canvas was **199 to 207 px** tall, and the floating view controls covered about a third of it. | WCAG 1.4.10; craft | The side-panel layout starts at **1000 px** (all seven 1040 / 1039 rules). | fixed: 1024 × 768 canvas **398–406 px** (panel 384 px at the side); 1024 × 1366 canvas 996–1004 px. No page or sideways scroll; axe 0 in ar + en (`r11-after-tablet-1024x768-en.png`) |
| R11-02 | medium | colour code field (`fields.tsx`, `lib/color.ts`) | Brand colours typed the usual ways were silently ignored: "#fff" (short form), "#١٢٣٤٥٦" (an Arabic keyboard's digits) and a pasted " #1f3d2b " (it became "# #1f3d2" because of the 7-character limit). | WCAG 3.3.1, 3.3.3 (input help); Arabic keyboards | `normalizeHex()`: trims spaces, reads Arabic-Indic and Persian digits as 0–9, makes `#` optional and expands `#rgb`. Six-digit codes apply as you type; the short form applies on leaving the field (it is also the start of a six-digit code). The limit is 12 characters, and the error says "a 3- or 6-digit colour code". Unit test `color-hex.test.ts`. | fixed: all of those apply (#ffffff, #123456, #1f3d2b), and "#12345g" still shows the error |
| R11-03 | medium | start / end aligned text on faces (`lib/dieline/texture.ts · drawLayer`, outside scope, one line) | Start- or end-aligned text was drawn on the edge of its box, ignoring the 0.15 em padding the designer measures the box with. Arabic glyphs overhung the selection box (and the box preflight checks the safe zone with), and the print PDF draws through the same function. | print accuracy; preflight | The text is inset by the same 0.15 em. The 3D preview, the face editor and the print PDF (`orders/pdf/print.ts` → `paintArtworkSurface`) all change together. | fixed: start (right for Arabic) and end (left) now sit inside the box (`r11-before-align-ar.png` → `r11-after-align-ar.png`) |
| R11-04 | low | dieline view (`DielineView.tsx`) | The flat view named the lines but gave no measurements: no flat (die) size, bleed or safe-zone width in mm. | print accuracy (mm) | A size line above the legend: "Flat size 584 × 673 mm · bleed 3 mm · safe zone 5 mm" / "المقاس المفرود … مم · هامش القص الزائد 3 مم · المنطقة الآمنة 5 مم", taken from the dieline model, with the numbers kept left to right. | fixed (`r11-dieline-en-1024.png`) |

Checked, no change:
- **RTL alignment:** for Arabic, "start" is right and "end" is left, so the logical alignment is correct.
- **Image rotation:** 15° buttons and a numeric field, and it reaches the print file.
- **Cropping:** there is none; an image is placed and scaled whole. That's a feature gap rather than a defect, so I'm proposing it, not adding it here.
- **Pantone / spot colours:** not offered. The plan's SME printers run CMYK, so a spot colour is a price-request item. I'd add a "Brand colours (from your saved designs)" row before any Pantone support, as a separate decision.
- **The print PDF's own bleed and crop marks:** owned by checkout (`orders/pdf`). The designer side (what it paints) is fixed by R11-03.

Files touched outside scope (round 11): `src/lib/dieline/texture.ts` (the R11-03 inset, one line plus a comment). R10-R1: `src/app/api/designs/_shared.ts`, `src/app/api/designs/[id]/route.ts` (assigned by the integrator).

## Verification (R10-R1 + round 11)

- Lint and typecheck are clean. `npm test`: **98 files, 8,521 passed** (new: `concurrency.test.ts`, `color-hex.test.ts`). `npm run build` OK.
- Playwright `designer` + `smoke` + `journey` + `checkout` + `catalogue` + `storefront` + **`models`** (`--workers=2`): **428 passed, 376 skipped**, 0 failed. That includes the new "two devices on one design" test and every library model after the text-inset change.
- Hydration e2e, 16 × 2 projects: **32 / 32 passed**.

## Counts (round 11, new findings before fixing)

| severity | found | fixed | open |
|---|---|---|---|
| critical | 0 | 0 | 0 |
| high | 0 | 0 | 0 |
| medium | 3 (R11-01, R11-02, R11-03) | 3 | 0 |
| low | 1 (R11-04) | 1 | 0 |
