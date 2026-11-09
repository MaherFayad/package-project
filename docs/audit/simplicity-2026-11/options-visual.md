# «All options» panel: visuals instead of text lists (2026-11-09)

The owner asked for pictures in the All options panel instead of radio and checkbox lists. Shop owners
should be picking real things. Everything is inline SVG or CSS: no images, no new dependencies, no three.js.

Screenshots: `C:\Users\Admin\AppData\Local\Temp\claude\f8173f44571ee159\d92726ee-f788-4602-8df6-7bcebbbfc7a0\scratchpad\options-visual\`
(`before-{en,ar}-{desktop,phone}-*.png`, `after-…`, finish groups `groups-…`, first tile version `tiles-v1-…`;
scripts `shot.mjs`, `finish.mjs`, `check.mjs`).

## What changed

| Section | Before | After |
|---|---|---|
| Common sizes | Text chips | Cards with an isometric box drawn from the preset's L×W×H. All presets use one scale, so a shoe box draws bigger than an accessories box. Each card has its name and size in cm (`designer.simple.sizeCm`). They are `aria-pressed` buttons. The «Standard size» badge is kept |
| Board | Radio list plus a paragraph | Wide cards with an SVG board sample: kraft fibres (`feTurbulence`) or smooth white on top, and the cut edge underneath (E flute small waves, B flute big waves, card, rigid greyboard). Each card has a name and one line (`library.panel.boardLine.*`). The paragraph (`designer.box.boardHelp`) is gone; the key is unused but kept |
| Finishes | One checkbox list | Grouped as the rules are (owner follow-up): **Coating** (pick one, with «None»), **Foil** (pick one, with «None»; replacing a colour keeps the items it was on). Then «Add a second foil colour», with the first colour disabled («Already used as the first colour») and a cap at `MAX_FOIL_COLOURS`. **Spot UV** is its own toggle. **Raised or pressed print** is pick one, shown only when the board allows it. Swatches are CSS: flat matte, gloss streak, velvet soft-touch, metallic gold / silver / rose gold, a glossy spot, raised / pressed disc. The coating swatch base follows the board (kraft or white). Pick-one groups are native radios in `role="radiogroup"` and show a radio dot. Disabled cards show the rule's reason inline. The foil thickness warning is a small note under the Foil group. A note says foil goes on the selected logo or text, each colour on a different part |
| Options (add-ons) | Checkboxes | Tiles with a line drawing each: window with film, handle holes, tear strip (perforation and pull tab), thumb notch, lowered front, dividers. Window face, rows/columns and lid depth stay below |
| Artwork → Panel | A select | A clickable flat dieline drawn from the current `DielineModel`. Each face's panels form one `role="radio"` (click, or arrow keys to move between faces). The selected face is filled dark. Flaps that are not a face are faint. Side walls get rotated names. Never mirrored (`dir="ltr"`). The floating Panel select on the canvas stays as the equivalent control for small targets (2.5.8). Containers keep the select |
| Background colour | 32 px swatches | Same swatches, 44 px on touch screens (`pointer: coarse`) |

Semantics: every picture card wraps the real radio or checkbox (invisible, covering the card), so roles and names stay
the same as before (the name is the label only; the line, reason and warning are the description). Focus shows on the card.

## Files

- New: `src/components/designer/OptionVisuals.tsx` (BoardSwatch, FinishSwatch, BoxSketch, AddOnIcon, FaceMap), `src/components/designer/options.module.css`.
- `ConfigPanel.tsx`: `OptionGroup` gained `layout` (`rows` / `tiles`), `visual`, `line`, `none`, `foot`, `testId`. There is a new `FinishesGroup`, preset cards and add-on tiles. A new prop `onFinishSwap`.
- `lib/config.ts`: `swapFinish(doc, off, on)` does a pick-one change in one history step and carries the foil mask over. Unit test in `lib/__tests__/finish-masks.test.ts`.
- `ArtworkPanel.tsx`: new optional `dieline` prop and the FaceMap (the Full artwork section, image placement and inspector were not touched).
- `DesignerApp.tsx`: passes `dieline` to ArtworkPanel and `onFinishSwap` to ConfigPanel. `LibraryDevSection.tsx` passes `onFinishSwap`.
- `designer.module.css`: 44 px swatches on touch.
- i18n: `library.panel.{boardLine.*, finishNone, coating, foil, foilSecond, foilAddSecond, foilWhere, foilUsed, spotUv, relief}` and `designer.artwork.faceMap` (en and ar); `scopes.generated.ts` regenerated.
- e2e: `models.spec.ts` picks another finish as a `radio` (was `checkbox`); `journeys/j1-brand-orders.spec.ts` checks gold foil as a `radio`. The `group-material`, `group-finish` and preset `aria-pressed` hooks are unchanged.

## Checks

- `npx tsc --noEmit -p .` clean. eslint on the changed files clean.
- `npx vitest run src/components/designer src/i18n`: 24 files, 136 tests pass.
- `npx tsx scripts/generate-i18n-scopes.ts --check`: up to date.
- Headed Chrome check (`check.mjs`): white board radio, foil radio, window checkbox, preset button, and the panel map's arrow keys and clicks all work.

- e2e not run. A single `models.spec.ts -g FEFCO_0427` against :3000 did not get through. Playwright failed to reuse the dev server and tried `next start` (EADDRINUSE). Soon after, the :3000 dev server answered 500 on every route, `/favicon.ico` included. Other agents were changing `tsconfig.json`, `next-env.d.ts`, `package.json` and `.next-*` dirs at the same time. The changed selectors were checked by hand in headed Chrome instead.

## Left

- Printed sides and the vessel sections (label stock, closures, presets) are still lists.
- With no artwork, two foil colours both cover the whole front until items are added (existing mask behaviour; the note says to select an item).
- The phone dev runs logged `Cannot read properties of undefined (reading 'isReady')` from the 3D engine (`src/components/three`, not touched here), as in the restyle run.
