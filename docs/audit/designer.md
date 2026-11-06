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

## Reported to other owners (not edited)

| id | owner | finding | suggested fix |
|---|---|---|---|
| R-01 | catalogue (`ModelPicker.tsx`) | Model cards print the literal standard code "none" for styles without one ("Hinged-lid flip-top pack — none"). | Hide the line when the code is `none` or empty. |
| R-02 | catalogue (`ModelPicker.tsx`) | All 370 models render as one list (14,000 px at 1440 px). There is no "show more" per group, so a phone user scrolls through 128 boxes to reach Pouches. Card heights vary with title length, so rows do not line up. | Show the first 8 per group with "Show all 128", or make the group chips a filter; clamp titles to 2 lines. |
| R-03 | 3D engine (`PackagingScene`) | `touch-action: none` and wheel zoom are always on. That is right in the editor, but it traps scrolling wherever a viewer sits in a scrolling page (start page, share page, proof). | A `scrollFriendly` prop: `touch-action: pan-y` and `enableZoom` only with a modifier key or on focus. |
| R-04 | 3D engine (`dielineToSvg`) | Panel labels use `font-family="Inter"` only, so Arabic panel names fall back to a system font. | Add the Plex Arabic variable to the label font stack. |
| R-06 | 3D engine + catalogue (from 3d-visual X-01) | Container tint and closure style are dropped: `VesselOption` has only `core`, and neither `VesselSceneProps` nor `createVesselMaterial` take a tint or closure style, so green glass renders amber and crown / cork / ROPP render as screw caps. The designer cannot pass what the engine does not accept. | Catalogue: add `tint?` and `closureStyle?` to `VesselOption` and fill them in `library/vessels.ts`. Engine: accept `tint` and `closureStyle` on `VesselScene` / `VesselModel` and add the closure profiles. Designer (2 lines in `VesselView.tsx` L81-82): pass the selected option's `tint` and `closureStyle` through, ready as soon as the props exist. |
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
| medium | 10 | 10 | 0 |
| low | 7 | 7 | 0 |

Plus 6 items reported to other owners (R-01 to R-06), not edited.
