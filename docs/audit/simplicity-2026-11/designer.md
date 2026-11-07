# Designer simplicity audit and fix (2026-11-07)

Owner's complaint: "too complicated", "the flows are really complicated for a simple Egyptian man".
Target user: small Egyptian business owner, phone, Arabic first, low tech literacy. Wants: size, logo
(maybe colour and a name), see it in 3D, see the price, order.

Scope (file ownership): `src/components/designer/**`, `src/app/[locale]/design/(editor)/**`,
`src/components/three/**`, `src/i18n/designer.*.ts`. Nothing else edited.

Screenshots: `C:\Users\Admin\AppData\Local\Temp\claude\f8173f44571ee159\d92726ee-f788-4602-8df6-7bcebbbfc7a0\scratchpad\designer\`
(`before-*` and `after-*`; scratch, not in the repo). Screenshot scripts were `.tmp-shots.mjs`,
`.tmp-tabs.mjs`, `.tmp-flow.mjs` at the repo root (deleted after use; recreate from the description below).

## Status

- [x] Audit (before): phone 390x844 ar, desktop 1440x900 en, signed in and anonymous.
- [x] Simple mode (default) + "All options" toggle, remembered in `localStorage["elba.designer.mode"]`.
- [x] Phone bottom bar: Logo, Text, Order.
- [x] Logo and text stay in the 3D view in simple mode (no jump to the flat face editor).
- [x] Jargon pass inside "All options": FEFCO/ECMA code kept with a tooltip (`<abbr>`), plain help under
  Board (kraft/white, E/B flute) and Printed sides (inside costs more).
- [x] Checks: `npx tsc --noEmit -p .` clean, eslint clean on changed TS files,
  `npx vitest run src/components/designer src/components/three src/i18n` 28 files / 163 tests pass.
- [x] After screenshots: ar phone, en desktop, ar desktop, en phone (simple and advanced), flow runs.
- [ ] e2e specs need a one-line change (see "e2e impact"): not edited, outside this agent's files.

## Before: what a first-time user sees (mailer-box, phone, ar)

Toolbar: back, undo, redo, "More" (export, share, save, rename), "Order this box".
Price chip ("500 boxes: see the price", locked until sign-in).
Stage header: 3D / Face / Dieline switch, Panel (face) select (desktop only).
3D view: 7 view buttons (desktop) or "Adjust view" menu (phone).
Fold row: fold slider (desktop), Flat / Half / Closed.
Bottom sheet (phone, closed by default) with 4 tabs: Box, Artwork, Layers, Check.
- Box tab (48 visible controls on desktop): model card with "FEFCO 0427", "Made in Egypt", Change model;
  Common sizes (4); Size L/W/H in mm with ranges and outer size; Board (E-flute kraft, E-flute white,
  B-flute kraft); Printed sides (Outside only / Outside and inside); Finishes (11 checkboxes, 7 folded
  as unavailable, foil warnings about 0.5 mm lines); Add-ons (window, tear strip, dividers); View
  (show dimensions, scene select, turntable).
- Artwork tab: Panel select, Inside/Outside select, background colour (8 swatches + hex + brand colours),
  upload drop zone, tip about clicking the 3D view, "Full artwork" (upload, SVG dieline template),
  Add text / Rectangle / Circle, then an inspector (nudge pad, bigger/smaller, rotate, 6 placements,
  X/Y/W/H/rotation/opacity in mm, forward/back/duplicate/hide/delete, font, size pt, weight, direction,
  align, colour).
- Layers tab, Check tab (preflight).

Counted controls visible without scrolling the panel: phone 19, desktop 30; in the Box tab alone 48.

### Decisions/taps before "my logo on the box + a price" (phone, signed in)

1. Open the sheet ("Show more controls").
2. Pick the "Artwork" tab (the word "التصميم" does not say "logo").
3. Scroll past the panel select and background colour to the drop zone; tap "Add image".
4. Pick the file.
5. The app switches to the flat "Face" editor, so the logo is NOT shown on the box: tap "3D".
Price: visible in the chip (signed in) or behind the sign-in gate (anonymous, business rule G2, kept).
Total: 4 taps + file pick, plus 2 jargon decisions (which "panel"/"face", what "التصميم" means).

## Findings (prioritised)

| # | Sev | Finding | Fix |
|---|---|---|---|
| S-01 | High | No visible "add logo" action on the first screen; upload is in the 2nd tab, below a face select and colour picker | Simple panel step 1 "Add your logo" (big primary), plus a "Logo" button in the phone bottom bar |
| S-02 | High | After an upload the editor jumps to the flat face editor: the user never sees the logo on the 3D box without finding the "3D" button | Simple mode stays in 3D for logo and text |
| S-03 | High | Box tab shows 48 controls, mostly printer jargon: FEFCO 0427, E-flute kraft, B-flute, Printed sides, 11 finishes with 0.5 mm foil warnings, add-ons, scene | All behind "All options"; simple mode shows cardboard colour as "Natural brown / White" (grade name in a tooltip), sizes by everyday name with the size in cm |
| S-04 | High | Phone: the Order button is top-left of a crowded toolbar, far from the thumb | Bottom bar Logo / Text / Order on phones (<768 px portrait); toolbar copy hidden there |
| S-05 | Med | Stage header (3D / Face / Dieline, "Panel" select) and fold slider (Flat / Half / Closed) shown to everyone | Hidden in simple mode; phones keep "Adjust view" (single-pointer alternative to drag, WCAG 2.5.7) |
| S-06 | Med | "Layers" and "Check" tabs are designer/printer concepts | Simple mode lists "On your box" items as tappable chips with quick edit (text, colour, bigger, smaller, top/centre/bottom, delete); the print check stays in All options |
| S-07 | Med | Text is added in the middle of the logo, on the "front" while the logo hint is on the lid | Simple mode adds text on the logo's side, under the logo, focuses the field, opens the sheet |
| S-08 | Low | Phone sheet starts closed; its label "Show more controls" hides what is inside | The closed sheet now starts with the Basics switch and step 1 (logo) |
| S-09 | Low | Anonymous price is behind the sign-in gate | Kept (business rule G2). The chip stays at the top in both modes |

## After

Simple mode (default), panel top to bottom: Basics / All options switch; 1 Your logo (Add your logo, tip
"or tap any side of the box"); 2 Name or text (Add a name or text); On your box (items, quick edit);
3 Colour (cardboard colour Natural brown / White, one print colour all over); 4 Size (everyday presets,
"Inside size: 25 × 18 × 8 cm", Exact size → All options Box tab, Change box type → picker);
More options (one line of what is there, "Show all options").
Phone bottom bar: Logo, Text, Order this box.
Stage: 3D only; phones keep "Adjust view".

Taps to logo-on-box + price (phone, signed in): 1 tap ("Logo" in the bar or "Add your logo") + file
pick. The 3D view shows it at once, the price chip is on screen the whole time, and Order is one more tap.
Text: 1 tap + typing (the field is focused).
Visible controls on the phone first screen: 19 → 12 (panel closed), all in plain words.

All options = the previous editor, unchanged (tabs, face/dieline views, fold, mm, board, finishes,
inside print, full artwork, dieline template, layers, preflight). The 3D click / drop upload, full
artwork, masked finishes, export modal and shadows from earlier today are untouched.

## Files changed

- `src/components/designer/SimplePanel.tsx` (new): the beginner panel.
- `src/components/designer/DesignerApp.tsx`: mode state + switch, simple-mode add/upload behaviour
  (`logoFaceOf`, `addLogo`, `onAddText`), stage header and fold row only in All options, phone bottom
  bar (`nav` "Main actions"), toolbar Order wrapped in `.toolbarOrder`.
- `src/components/designer/designer.module.css`: simple mode, mode switch, `.actionBar`, `.toolbarOrder`
  (appended at the end of the file).
- `src/components/designer/ConfigPanel.tsx` + `library.module.css` (`.standardCode`): code tooltip and
  plain help under Board and Printed sides.
- `src/i18n/designer.en.ts`, `designer.ar.ts`: `designer.simple.*`, `designer.box.{boardHelp,printSidesHelp,standardHelp}`; `src/i18n/scopes.generated.ts` regenerated.

## e2e impact (not edited: e2e is outside this agent's files)

Fresh browser contexts start in simple mode, so specs that click the tabs (`Artwork`, `Layers`,
`Check`, `Box`), the Face/Dieline buttons, the fold buttons or Board radios first need
`await page.getByRole("button", { name: tr(locale, "All options") }).click()` (ar «كل الخيارات»), or an
init script: `await page.addInitScript(() => localStorage.setItem("elba.designer.mode", "advanced"))`.
On phones (<768 px portrait) the Order button is in the bottom bar (same name, only one visible).

Key screenshots (scratch folder above): `before-ar-phone-in-mailer-box.png`, `before-ar-phone-tab0-2.png`
(Box tab jargon), `before-ar-phone-tab1-0.png` (Artwork tab), `before-en-desktop-in-mailer-box.png`;
`after-ar-phone-in-mailer-box.png`, `after-ar-phone-in-mailer-box-sheet.png`,
`after-ar-phone-flow-logo.png` (logo on the 3D box after 1 tap), `after-ar-phone-flow-text.png`,
`after-en-desktop-flow-text.png`, `after-ar-desktop-simple.png`, `after-en-phone-advanced.png`.
Measured: logo + name on the 3D box with the price on screen in 2 taps + file pick + typing (ar phone,
signed in, ~10 s scripted).

## Left to do

- e2e: add the "All options" click or the localStorage init script (see above) in `e2e/designer.spec.ts`
  and any journey that opens the tabs; run `npx playwright test e2e/designer.spec.ts --project=desktop`.
- Toasts sit over the phone bottom bar for a few seconds (Toast is in `src/components/ui`, not ours):
  give the toast region a bottom offset on the designer page.
- Ideas not done: rename tabs inside All options ("Artwork" → "Logo and text"; e2e uses the names),
  closure colour as a basic for bottles, a short first-visit hint over the 3D view ("Tap the box to add
  your logo"), price chip next to the Order button in the phone bar.
- A test buyer session row was inserted in the dev DB for screenshots (expires in 7 days).
- Docs: `docs/guides/designer.md` should mention simple mode (`SimplePanel`, `elba.designer.mode`).
