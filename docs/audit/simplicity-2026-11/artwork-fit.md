# Full artwork: fit check, inside and outside slots (2026-11-09)

Owner's ask: "when uploading the full artwork, run a script to check if it fits the current box; if it doesn't, tell the user, and tell him what box it fits perfectly, or if it doesn't exist." Then (same day): "when the print is in and out I can upload 2 artworks, to the inner and outer faces, and I need to see them also."

## How the check works

`src/components/designer/lib/artworkFit.ts` (pure, no DOM, unit-tested in `lib/__tests__/artwork-fit.test.ts`).

- **What "fits" means.** The template the buyer designs on is the model's sheet (die + bleed): `dielineToSvg` uses `model.sheet` as its viewBox, and `sheetImagePlacement` covers exactly that frame. So the test is the image's aspect against `sheet.width / sheet.height` of the dieline the model builds (no hand formulas). Difference = `|ln(image / template)|`: up to 1.5 % **fits**, up to 5 % **near** (a thin strip is cut), else **off**. The report also gives the share cut and the edge (sides, or top and bottom).
- **Resolution.** Effective dpi at the sheet size (`sheetImagePlacement(...).pxPerMm`), against preflight's thresholds (`DPI_WARNING` 300, `DPI_ERROR` 150), plus the largest size it prints at 300 dpi.
- **Same model, other sizes** (`solveModelDims`): every preset that matches, then a one-axis solve on L, W and H inside the model's limits (14-sample scan for a sign change, then bisection), rounded to whole mm and re-checked. Ranked: standard size first, then a size that keeps the height, then the smallest change. About 30 ms.
- **Other models** (`scanModels`): `loadBoxModels()` (new in `src/lib/library/registry.ts`) loads the box family packs (one chunk each, containers skipped); FEFCO 09 fittings are left out (they go inside another box). Pass 1 tries each model's standard sizes and default size (about 4 builds per model); pass 2 runs a fast secant solve on L then H (about 6 builds) for models still without a match. Same family and group go first. It runs on the main thread in 12 ms slices with a `setTimeout` yield between slices, so input stays responsive, and stops at a 2 s budget (`complete: false` then). Ranked: same family + group, closeness to the current size (25 % steps), standard size, closest aspect; top 3. (Without the size term an Octabin 100 × 100 × 78 cm came second for a 25 cm mailer.)
- **Not done: pixel analysis.** Content bounds / transparent margins would not change anything: the whole image frame is what is placed, so the frame's aspect decides the crop. Cut-line detection is being built by a separate agent (`src/components/designer/lib/dielineDetect/`); `SheetArtwork` has a `recognised` prop (a node per surface, shown above the fit report) as the hook for its "we recognised this box" result. It was not present when this work finished, so it is not wired.

Timings (Node, 274 box models): pass 1 about 750 ms; both passes about 1.6–2.4 s, so the 2 s budget sometimes ends pass 2 early (the result then lists what was found). In headed Chrome (dev server): 1.6–2.0 s from upload to suggestions; the search always ran to its 2 s budget, so pass 2 is usually partial. Same-model answers come from the full solve regardless.

## What the buyer sees (Full artwork section)

- **Fits**: green «التصميم مناسب لهذه العلبة.» plus «دقة الصورة كافية للطباعة (N نقطة لكل بوصة).» when the dpi is fine.
- **Near / off**: amber note naming how much is cut and where, two small pictures side by side ("Your design" and "On this box": the template's cut lines over the image, the cut-off parts shaded), then up to three choices:
  «تغيير المقاس إلى 25 × 18 × 8 سم» (same model, applies the size), «تغيير العلبة إلى …، 39.1 × 20 × 20 سم» (switches model and size, keeps all artwork), «الإبقاء كما هي» (hides the note for this image and size). While the search runs: «جار البحث عن علبة تناسب التصميم».
- **Nothing fits**: «لا توجد علبة نصنعها تطابق شكل هذا التصميم. يمكن تنزيل قالب هذه العلبة ووضع التصميم عليه ثم تصديره من جديد.» with the template download button.
- **Low resolution**: amber (under 300 dpi) or red (under 150 dpi) «دقة الصورة منخفضة لهذه العلبة (N نقطة لكل بوصة). تطبع بوضوح حتى مقاس W × H سم.»

Note: `SHEET_IMAGE_OPTIONS` caps a full artwork at 7000 px, so a mailer sheet (584 × 676 mm at 250 × 180 × 80) tops out at about 260 dpi: every full artwork on a box that size gets the low-resolution note. Raising the cap (memory) or relaxing the sheet threshold is a product call; left as is.

## Inside and outside

- When printing is "Outside and inside", the section shows two slots side by side (one column on phones): «التصميم الخارجي» and «التصميم الداخلي», each with its own upload, thumbnail, remove, template download and fit check. "Outside only" keeps one slot, as before.
- **Inside template**: `dielineToSvg(model, { inside: true })` draws the sheet flipped left-right (as seen from inside the board), with the labels unflipped. This matches how `paintArtworkSurface` mirrors the inside sheet image, so an image made on the inside template lines up.
- **Print PDF and preflight** already handled `artwork.inside.sheetImage` (inside page, mirrored for press; LOW_DPI per surface). Tests added: inside sheet on the inside PDF page; preflight checks it only when both sides print.
- **Seeing it**: after an inside upload the 3D view switches to the inside: fold target 0.6 (walls up, flaps open), `reset()` to re-frame for that fold, then `rotate(0, 30)` to look down into the box (a positive polar delta raises the camera; -25 looked at the underside). A «عرض الداخل / عرض الخارج» button sits in the bottom view bar (boxes, both sides printed) to flip back and forth; uploading an outside design goes back to the closed outside. Uses only the existing scene handle (`reset`, `rotate`, `setView`) and the `fold` state; nothing in `src/components/three/**` changed. Missing from the handle: a named "inside" camera view (look-into-box framing for the open state) would frame better than reset + tilt.

## Files

- New: `src/components/designer/lib/artworkFit.ts`, `src/components/designer/SheetArtwork.tsx`, `src/components/designer/sheetArtwork.module.css`, `src/components/designer/lib/__tests__/artwork-fit.test.ts`.
- Changed: `ArtworkPanel.tsx` (the Full artwork fieldset is now a `sheetArtwork` slot), `DesignerApp.tsx` (`onSheetUpload(file, side)`, `onSheetRemove(side)`, apply size / model, inside view toggle, inside template download), `src/lib/dieline/svg.ts` (`inside` option), `src/lib/library/registry.ts` (`loadBoxModels`), `src/i18n/designer.{en,ar}.ts` (`designer.artworkFit.*`).

## Verified in headed Chrome (mailer-box, 250 × 180 × 80)

Screenshots in the scratchpad `artwork-fit/` folder.
- (a) image made on the downloaded template (aspect 0.864): green "fits", plus the low-res note (225 dpi): `a-template.png`.
- (b) image for a 350 × 180 × 80 mailer: off, 15 % cut from the sides. Offered «Change the size to 25 × 13.1 × 8 cm» (aspect alone cannot tell 350 × 180 from 250 × 131: both are exact) and another box. Applying the size turns the note green: `b-other-mailer-size.png`, `b-after-apply-size.png`.
- (c) image for a Shipping box 20 × 15 × 10 (FEFCO 0201 standard): off, 70 % cut; first choice «Change the box to Shipping box, 20 × 15 × 10 cm»; applying it switches the URL to /design/shipping-box with the artwork kept, note green: `c-other-box-type.png`, `c-after-apply-model.png`.
- (d) 3:1 banner: off, 71 % cut; two other boxes offered: `d-banner-3x1.png`.
- Arabic 390 × 844: `ar-390-other-size.png`.
- Inside and outside: both slots filled, 3D inside view, toggle back to outside, in English 1440 × 900 and Arabic 390 × 844: `inside-both-slots-*.png`, `inside-3d-*.png`, `outside-3d-*.png`, `inside-3d-again-*.png`. The inside stripes show on the inside of the lid, labels from the inside template read the right way round (not mirrored).

Environment note: the shared :3000 dev server was answering 500 during this run (other agents had dev servers on 3005/3006 and were editing ConfigPanel); verification ran on a private `NEXT_DIST_DIR=.next-artfit next dev -p 3011`, stopped and deleted afterwards. A sheet upload error now also shows as a toast (the error text sat in the per-side drop zone above the section).

## Checks

tsc clean; eslint clean on changed files; vitest `src/lib/dieline src/components/designer src/i18n src/lib/library` 52 files / 6985 tests pass; geometry snapshot not changed by this work (its `svg` hashes are unchanged; the `poses` / `bounds` hashes in the working copy were changed at 19:15 by another agent's fold work); `generate-i18n-scopes --check` up to date.
