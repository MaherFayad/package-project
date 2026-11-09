# Image fit: Fill side or Fit whole image (2026-11-09)

Owner's ask: "when uploading an image to a side, I want it by default to be either fill or fit, and the user have less options here."

## Behaviour now

- `ImageLayer.place?: "fill" | "fit"` (`src/types/design.ts`, zod in `lib/doc.ts`). Absent = freely placed, exactly as before (old saved designs unchanged).
- **Fill**: box = side + bleed on every edge, centred, `fit: "cover"`, rotation 0. Painting already clips to the side, so it prints edge to edge without spilling onto neighbours or glue flaps.
- **Fit**: the whole image (crop aware) inside the safe zone, aspect kept, `fit: "contain"`, at a share (10 to 100 %) of the biggest fit, centred or at the drop point clamped to the safe zone.
- **Auto choice on upload** (`autoPlace`, `lib/imageFit.ts`; `imageLook` in `uploadImage.ts` reads a 64 px copy): transparent pixels or a flat-colour border (a logo on white) → Fit at 60 %; an opaque photo whose shape is within 1.6× of the side's and that fills at ≥ 100 dpi → Fill; anything else → Fit at 100 %. Same rule for the Basics logo button, the All options drop zone and a click or drop on the 3D box.
- **Mode is resolved into the layer box** when set, on a toggle, and on every size or style change (`rescaleArtwork(..., margins)` → `replaceOnResize`; Fit keeps its share and its relative spot). The 3D texture, print PDF (`paintArtworkSurface`) and preflight read the stored box, so they all agree.
- **Edits**: a new crop keeps the mode (`settlePlace`); a drag, rotation, nudge or typed size that breaks it frees the image (neither button pressed). "Put it on every side" places copies with the same mode.
- **Preflight**: LOW_DPI uses the cover scale for Fill; Fill images skip the safe-zone, fold and glue checks (they are full-bleed by intent and clipped to the side).

## Controls

- Basics (`SimplePanel` QuickEdit, image selected): segmented «ملء الوجه / ظهور الصورة كاملة» ("Fill side" / "Fit whole image"), a one-line note, the size slider for Fit only ("{pct}% of the space"), «الشعار على كل الجوانب», Delete. The width-share slider and the top/centre/bottom buttons are hidden for images (text unchanged).
- All options (`ArtworkPanel` LayerInspector, image): the same control, Crop, finishes, Delete; move pad, bigger/smaller, rotate, quick placement (without the old "Fit to panel"), X/Y/W/H/rotation/opacity and order sit in a collapsed «تعديل دقيق» / "Fine adjust" `<details>`. Text and shapes unchanged.
- Shared control: `src/components/designer/ImagePlaceControl.tsx`.

## Checks

- `npx tsc --noEmit` clean; eslint clean on changed files.
- `npx vitest run src/components/designer src/lib/orders src/i18n`: 34 files, 202 tests pass (new `lib/__tests__/imageFit.test.ts`, 12 tests: auto choice, fill/fit geometry on a 200 × 100 side, drop clamp, crop, settle, resize to a different shape, `rescaleArtwork` on a dims change with a real dieline, preflight and copy-to-sides).
- `generate-i18n-scopes.ts` regenerated (it was also stale from another change); `--check` passes.
- e2e selectors: `designer.spec.ts` Basics test asserts the logo starts as Fit; the crop test opens "Fine adjust" before reading Width/Height. Not run (suite rule).
- Headed Chrome on `/en/design/mailer-box` and `/ar/...` (1440 × 900 and 390 × 844): transparent PNG logo → fit, opaque 2400 × 1700 photo → fill, toggle Fit/Fill, size preset 25×18×8 → 30×22×6 keeps Fill covering the lid, nudge in Fine adjust frees it; no page errors.

## Left open

- Fit after a Fill → Fit toggle starts at 100 % (the earlier logo share is not remembered).
- No visual hint on the 3D box of the safe area while a Fit image is resized.
