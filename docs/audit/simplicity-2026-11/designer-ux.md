# Designer UX: simpler, nicer (2026-11-08)

Goal: a shop owner gets "my logo on a box, see the price, order" with no thinking. Arabic phone first.
Parallel agents own the export dialog (photo render) and `src/components/three/**` (realism); not touched here.

Screenshots and the walk script: `C:\Users\Admin\AppData\Local\Temp\claude\f8173f44571ee159\d92726ee-f788-4602-8df6-7bcebbbfc7a0\scratchpad\designer-ux\`
(`walk.mjs before|after`, `before-*.png`, `after-*.png`, `*-report.json`).

## Walk (before), mailer box, anonymous

Taps from opening the designer to «طلب هذه العلبة»: **2 + file pick** (ar 390x844 and en 1440x900):
Logo (bottom bar / "Add your logo") → file → Order. Order opens the phone gate (business rule, kept).
The tap count was already low after the Basics round; the friction is in what the user sees and reads.

## Friction found

| # | Sev | What | Where |
|---|---|---|---|
| U-01 | High | Desktop header has 6 actions: Undo, Redo, Export, Share, Save, Order, plus a red «1 to fix» chip. A newcomer reads "fix" as "something is broken" (it is the small-logo warning). Save is redundant: the design autosaves («Saved for 30 days») | toolbar |
| U-02 | High | Phone: the price sits at the top, the Order button at the bottom; the user has to look up and down to connect "price" and "order" | price row |
| U-03 | Med | No moment when the logo lands: a long toast slides up instead, and on phones it covers the sheet and later the sign-in sheet (5 lines: «تمت إضافة الصورة إلى وجه الأعلى. شعارك صغير…») | upload toast |
| U-04 | Med | No "put my logo on all sides": every side needs a separate tap + file pick | quick edit |
| U-05 | Low | Size is two buttons (Make bigger / Make smaller, 15 % steps); no sense of how big | quick edit |
| U-06 | Low | Loading: the flat poster and the first 3D frame overlap for a moment (two boxes) | stage (owned by the three/ agent's area: left) |

## Fixes (Basics mode; All options unchanged)

- U-01: toolbar in Basics: Undo, Redo, **Save and share** (one menu: Export, Share, Save; Rename on phones), **Order this box**.
  The «to fix» chip is hidden in Basics (the print check stays in All options; the small-logo warning is in the panel).
  Desktop header actions 6 + chip → 4. Phones keep the icon menu ("More actions").
- U-02: phones: the price strip sits directly above the bottom bar (Logo, Text, Order); the 3D view moves up under the toolbar.
- U-03: when a logo lands (button, tap on a side, drop) in Basics: a green «شعارك على العلبة الآن» chip pops over the
  3D view for 2.6 s (5 s with a short «الصورة صغيرة…» line when the picture is small) and the side glows; no toast.
  Reduced motion: no pop.
- U-04: «الشعار على كل الجوانب» in the selected logo's quick edit: one tap copies it onto every other side except the
  bottom (sides under 25 mm skipped, same share of the width, max 80 % of the height, centred), one undo step, toast with Undo.
  `copyToSides()` in `src/components/designer/lib/doc.ts` (+2 unit tests).
- U-05: «الحجم على العلبة» slider (10–100 % of the side's width, 5 % steps, value shown) replaces Make bigger / Make smaller.
- U-06: not done (the poster/first-frame handoff is in the three/ agent's files).

Taps from opening the designer to «طلب هذه العلبة»: **2 + file pick before, 2 + file pick after** (ar phone, en desktop).
What changed is what is on screen around those taps: fewer header actions, the price next to Order, a clear "it worked" moment,
and the logo on all sides in 1 more tap instead of 4 taps + 4 file picks.

## Checks

- `npx tsc --noEmit -p .`: no errors in these files (the only error, DesignerApp.tsx ~1104 `PhotoRenderResult`, is the photo-render agent's in-progress code).
- eslint on changed files: 0 errors (3 unused-var warnings from the photo-render agent's `photoProgress`/`photoAbort`).
- `npx vitest run src/components/designer src/i18n`: 22 files, 113 tests pass.
- `npx tsx scripts/generate-i18n-scopes.ts`: regenerated (now passes `--check`).
- e2e: `designer.spec.ts` "Basics" (now also taps "Put it on every side", expects 5 images saved) passed against the dev server
  (`E2E_PORT=3000`, desktop). `catalogue-order-modes.spec.ts` helper updated for the "Save and share" menu; not re-run: the
  shared dev server started failing (build error in `src/components/three/lighting.tsx`, invalid UTF-8, from the realism agent).
- Screenshots: `after-ar-phone-*.png`, `after-en-desktop-*.png` (1 first open, 2a landing chip, 2 logo added, 3 price, 3b quick edit, 3c all sides, 4 order step).

## Files

`src/components/designer/{DesignerApp.tsx, SimplePanel.tsx, designer.module.css, lib/doc.ts, lib/__tests__/doc.test.ts}`,
`src/i18n/designer.{en,ar}.ts` (`designer.simple.{landed,landedLowRes,size,sizeValue,allSides,allSidesDone,allSidesNone,menu}`),
`src/i18n/scopes.generated.ts`, `e2e/designer.spec.ts`, `e2e/catalogue-order-modes.spec.ts`.
Not touched: the export section of Modals.tsx, exportFile/downloadPdf/exportGlb, `src/components/three/**`.

## Owner decisions / notes

- Mailer box: the right/left side copies read rotated 90° (that side's "up" on the dieline runs along the box length). A tap
  upload on that side does the same. Fix belongs in the dieline face orientation, not here.
- The «to fix» chip is hidden in Basics. If you want a print check before ordering for Basics users, show it at checkout.
- Ideas left: first-frame/poster crossfade (three/ area); a "my logo on all sides" offer inside the landing chip.

## Status

- [x] Walk + before screenshots
- [x] Fixes
- [x] Checks (except the second e2e spec, blocked by the shared dev server), after screenshots
