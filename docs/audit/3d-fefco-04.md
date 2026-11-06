# 3D audit: FEFCO 04 folders, wraps, mailers and trays (80 models)

Key: `3d-fefco-04` · Branch: `claude/exciting-albattani-8kzgsu-3d-fefco-04` · Scope: `src/lib/dieline/families/fefco-04` and its tests.
Contact sheets: `docs/screenshots/audit/3d-fefco-04/` (`before-NN.jpg` / `after-NN.jpg`: closed iso, closed back/bottom, 50 % fold, flat; `fold-before.jpg` / `fold-after.jpg`: 35 / 55 / 75 / 90 % fold of six representative styles; `mobile-*.png`: 390 × 844 designer).

## Summary

| Severity | Found | Fixed (family) | Open (engine / designer / library, not editable here) |
|---|---|---|---|
| critical | 0 | 0 | 0 |
| high | 6 | 5 | 1 (E-07) |
| medium | 10 | 6 | 4 (E-01, E-04, E-05, E-06) |
| low | 7 | 1 | 6 (E-02, E-03, E-08, E-09, L-01, F04-13) |

Open items are all in the shared engine (`src/components/three`, `src/lib/dieline/fold.ts`), the designer, or the library layer, and are listed in §3 with a precise fix. F04-13 is a residual one-frame contact in the family that needs engine easing (E-09) and is explicitly allowed in the new test.

## Method

- Every model rendered in the live designer path (`/en/dev/3d` library section → `DesignScene` → `PackagingScene` → `PackagingModel`, the same as `/[locale]/design`), Chromium + SwiftShader, 1× DPR, reduced motion so fold states land deterministically. Harness: the 3d-visual session's `docs/audit/tools/capture.cjs` (on its branch) plus a fold-sequence probe (35 / 55 / 75 / 90 %).
- Numeric checks over **every model × every preset × E and B flute (1 117 builds)**: stacked panels closer than one caliper (z-fight / clipping), closed outer vs inner, face coverage and orientation, and a new **mid-fold sweep check**: at 19 fold steps, any panel whose mid-surface enters another panel's board (non-adjacent pairs).
- Mobile: `/ar/design/fefco-0471`, `/en/design/fefco-0459`, `/en/design/fefco-0409` on an iPhone 13 profile: no page errors, rAF steady at 60/s (software GL, idle). Heaviest model (0437.1) has 12 panels / 152 outline vertices: a few hundred triangles and ≤ 14 draw calls, far below any mobile budget.
- Findings from the 3d-visual report (`docs/audit/3d-visual.md` §4, F04-01…05, fetched from `claude/exciting-albattani-8kzgsu-audit-3d-visual`) are merged below and cross-referenced.

## 1. Findings fixed in the family

| ID | Sev | Models | Finding | Standard / reference | Fix | Status |
|---|---|---|---|---|---|---|
| F04-06 | high | 54 trays and folders with corner ears (every style with `ears` ≠ none: 0412–0420, 0421*, 0422.1, 0422.2, 0422a, 0423*, 0425, 0425a, 0426a, 0427.1, 0429*, 0430, 0431, 0432*, 0433–0435a, 0437*, 0440–0445, 0447, 0449–0458, 0460) | **Ears swept through the walls they lock into.** Walls (stage 0) rose before the ears (stage 1) folded, so every ear passed through the end (or long) wall at 35–70 % fold. | Hand erection of a self-locking tray: fold the ear-carrying walls up with the ears turned in, then raise the walls that trap them. | `kit.ts`: ear-owning walls and their ears fold together (stage 0), receiving walls rise outside them (stage 1). Stages compact: no idle pauses. | fixed |
| F04-07 | high | 18 trays with interior bottom flaps (0422.2, 0424, 0424a, 0425a, 0428, 0428a, 0432, 0432a, 0435a, 0436, 0439, 0439a, 0454.1, 0455.1, 0470, 0471, 0471a, 0472) | **Interior bottom flaps swept through the base** (flap folded only after its inner wall had rolled down, so its free edge came up through the floor at 70–95 %). Visible as brown wedges under the tray. | Real fold: the lock flap is squared first and lands on the floor as the inner wall rolls in. | `kit.ts`: bottom flap stage = inner wall stage − 1. | fixed |
| F04-08 | high | 0436, 0439, 0439a, 0471, 0471a, 0472 | Adjacent rolled inner walls (end + long) rolled in together and **crossed at the corners** at 50–65 %. | Rolled ends go in first, long inner walls tuck between them. | `kit.ts`: long inner walls one stage after the end inner walls. | fixed |
| F04-09 | high | 0404, 0406, 0409–0411a | Wraps: glue flap / fifth panel folded with the tube and **came up through the base**; fully overlapping end-flap pairs folded together and **passed through each other** at 95 %. | Closing panel is pre-folded; overlapping end flaps close one after the other. | `wraps.ts`: closing panel stage 0, tube stage 1, inner end flaps, then outer; fully overlapping pairs staggered, the first to fold lies deeper (`stack`). | fixed |
| F04-01 | medium | the 18 bottom-flap trays above | Bottom flaps **0.5 mm inside the base slab** on E flute (2 mm on B): print shimmer and clipped edges on the tray floor. (3d-visual F04-01.) | Folded flap lies one caliper above the base. | `kit.ts`: inner wall with a bottom flap stops `2t + 0.1` short of the wall height, so the flap rests exactly on the base's inner face for any caliper (test: 0 to 0.5 mm above). | fixed |
| F04-02 | medium | 0425a, 0436, 0439, 0439a, 0471, 0471a, 0472 | Neighbouring bottom flaps **coplanar and overlapping** in the corners (460–750 mm²): z-fighting triangles. (3d-visual F04-02.) | Interior flaps have mitred ends. | `kit.ts`: 45° mitre (`taper = fd + 1 + 2t`, ≤ 45 % of the hinge). Chosen over stacking because stacking would lift a whole flap off the floor by a caliper. | fixed |
| F04-03 | medium | 0459 | Octagonal tray glue ears **coplanar with the neighbouring ear** on every corner wall (~200 mm² × 4). (3d-visual F04-03.) | Glue ears never overlap; each covers less than half the corner wall. | `octagon.ts`: ear width ≤ half the corner wall − 1 mm. | fixed |
| F04-10 | medium | 0459 | Corner walls rose before the glue ears folded: **ears passed through the corner walls** 45–90 %. | — | `octagon.ts`: main walls + ears stage 0, corner walls stage 1. | fixed |
| F04-11 | medium | 0406, 0409–0411a | Wrap end flaps ran the full panel width, so their edges sat **inside the neighbouring panels' board** at the tube end (1.5 × 1.5 mm strip, z-fighting with the cut edge); the **fifth panel ran through the end flaps**. | End flaps are cut between the creases; the fifth panel stops at the inner flaps. | `wraps.ts`: end-flap hinges stop `t + 0.2` short of each corner; fifth panel inset by `endLayers·t + 0.5` each end. | fixed |
| F04-12 | low | 0421.1, 0428, 0447 (and every lid with dust / tuck flaps) | Lid side (dust) flaps folded with the lid and **clipped the end walls** at 95 %. | Dust flaps squared before the lid closes; outside wrap-over flaps after. | `kit.ts`: inside lid flaps at `topBase`, lid + tuck at `topBase + 1`, outside front / side flaps at `topBase + 2`. | fixed |
| F04-15 | high | 0405 | Pass 2: both Bliss end panels were cut to the right of the body, so the **left end flew through the body and out through the front wall** (visible over the printed front at 55–68 %). | Bliss ends are fitted from their own side. | `bliss.ts`: one end panel on each side of the body (the side it ends on), `lift = 0.7 H`. Residual: one 1–2 % frame where the left end's corner grazes the front edge (engine path, E-08). | fixed |
| F04-14 | medium | 0422.1, 0423.1, 0430, 0432a, 0434, 0437.1, 0439a (handle); 0443, 0444, 0448 (thumb notch) | **Options that did nothing**: the Handle toggle was offered on styles whose hand holes are built in; the Thumb notch toggle was offered on rim-flap trays where the generator ignores it. | "Every configuration option visibly applied." | `catalog.ts · featuresFor`: offer `handle` only without built-in hand holes and without a lid; `thumbNotch` only with an open, full-height front. | fixed |

Regression tests: `__tests__/fefco-04-3d.test.ts` (162 tests). For every model: no stacked board inside board at the closed state (all presets, E and B); no panel sweeps through another at 19 fold steps; ears fold no later than their wall and before every wall that traps them; interior bottom flaps rest 0–0.5 mm above the base. On the old code 93 of them fail; all pass now.

## 2. Verified, no change needed

| Check | Result |
|---|---|
| Geometry vs FEFCO code | Panel layouts follow the README's construction rules (base hinged to walls / cover, rolled double walls, ears on long or end walls, interior lock flaps, hinged lids with tuck / dust / outside flaps). 76 of 80 are `interpreted` (no licensed drawing in the repo); no rendered model contradicts its official name. Still open as the README's integrator item 5 (compare against the FEFCO 11th edition drawings). |
| Closed dimensions | outer ≥ inner on every axis for all 1 117 builds; outer ≤ inner + 8t except header / raised-end styles (0434, 0435, 0435a, 0449, 0460, intentional). |
| Caliper and flute edge | Board thickness from `BOARD_SPECS` (E 1.5, B 3) shows on every cut edge; flute texture is the engine's (see X-05). |
| Normals | Every outside face's normal points out of the box (face detection requires `normal·n ≥ 0.99`); no inverted panels in any render. |
| Artwork mapping | Face transforms are derived from the folded pose, so every face is upright and unmirrored by construction. Multi-part faces (0400 / 0412 meeting cover flaps, 0411 / 0411a split top) map continuously across the seam. Partial coverage only where the geometry is partial: display cut-downs and headers, 0443/0444/0448 rim flaps (open top), 0459 chamfers, and a 1.7 mm board-edge strip at wrap tube ends (correct: the end flap is narrower than the end). |
| Console | 0 errors / warnings over 80 models × 4 states, before and after. |

## 3. Open: shared engine, designer and library (not edited, per scope)

| ID | Sev | Where | Finding | Fix (file · function · values) |
|---|---|---|---|---|
| E-01 (= 3d-visual X-04) | medium | `src/lib/dieline/fold.ts · rootRotationAt` | The flat blank stands vertically and the whole box tilts 90° while it folds, so mid-fold frames of every 04 style read as "box rotating" rather than "blank erecting". | Start from a lying root quaternion (−90° about X) or keep the root fixed and animate only the camera. |
| E-02 (= X-09, F04-05) | low | `fold.ts · panelFoldAmount` | Stages overlap by `0.2 / n`; a panel can start before its predecessor lands. The family's new stage order removes every collision this caused except one (F04-13). | Optional per-panel `delay` or zero overlap between dependent stages. |
| E-03 (= X-02, F04-04) | low | `src/components/three/PackagingScene.tsx · frameFor` | Long folders 0409–0411a (7:1) fill ~10 % of the frame height at the default view (bounding-sphere fit). | Fit the projected box at `DEFAULT_VIEW`, margin 1.08. |
| E-04 (= X-03) | medium | `PackagingScene.tsx` light rig | Bottom and back faces of every tray render muddy olive (~45 % luminance of the front). | Raise hemisphere ground colour / add floor bounce (see 3d-visual X-03). |
| E-05 (= X-05) | medium | `src/components/three/boardMaterials.ts · fluteTexture`, `panelGeometry.ts` | Flute wave drawn on every edge, including edges parallel to the flutes; inside liner on the edge takes the outside colour (E_FLUTE_WHITE shows white on both liners). | See 3d-visual X-05. |
| E-06 (= X-10) | medium | `fold.ts · faceTransform(…, "inside")` | Inside print on the hinged lids of 0421, 0426a, 0427.1, 0428, 0441, 0447, 0470, 0471 reads upside down when the lid opens toward the viewer. | Compose a 180° turn for lid parts on the inside surface. |
| E-07 | high | designer stage, 390 × 844 (`src/components/designer` stage + `ViewControls` overlay) | On a phone the 3D model is mostly hidden: the stage is ~240 px tall and the view-control bar overlays its lower half, and the box is framed below the visible area (see `mobile-*.png`). | Give the stage `min-height: 52svh` on narrow screens, move `ViewControls` below the canvas (or collapse to a single "view" button), and frame with the overlay's height as a bottom inset. WCAG 2.2 · 2.4.11 (focus not obscured) applies to the controls covering the canvas focus target. |
| L-01 | low | `src/lib/library/boxes.ts · baseStructure` | 0409 five panel folder shows "Made and priced as Mailer box" in the model card; the closest core quote base for a long glued FPF is the RSC / FEFCO 0201, not the 0427 mailer. | Map `five-panel-folder` and `wrap-around` sub-families to `FEFCO_0201`. |
| E-08 | low | `src/lib/dieline/fold.ts · assemblyPoseAt` | Extra pieces lerp their **frame origin**, not their centre, while slerping the rotation, so a piece cut far from the sheet origin swings on a wide curve (0405 left end grazes the front edge for one frame). | Lerp the piece centre: `p = lerp(p0 + q0·c, p1 + q1·c, a) − slerp(q0,q1,a)·c` with `c = ownPivot`. |
| E-09 | low | rigid-panel folding (engine) | Fine sampling (80 steps) shows every rigid tuck flap grazing the inside of the front wall in the last 1–3 % of the lid's swing, and lid dust flaps touching the end walls for one frame (0421.1, 0428, 0447, 0471). Hidden under the lid; real tucks flex. | Per-panel easing (`foldCurve`) so the tuck stays at ~70° until the lid is at 97 %, then squares. |
| F04-13 | low | `kit.ts`, 0429 only | One frame (85 %) of contact while the tuck slides behind the front wall under a wrap-over lid. Allowed explicitly in the new test. | Would need an engine-side eased tuck (E-02); geometry is correct at rest. |

## 4. Files touched

`src/lib/dieline/families/fefco-04/{kit,wraps,octagon,catalog}.ts`, new `src/lib/dieline/families/fefco-04/__tests__/fefco-04-3d.test.ts`, this report, `docs/screenshots/audit/3d-fefco-04/`. Nothing outside scope.
