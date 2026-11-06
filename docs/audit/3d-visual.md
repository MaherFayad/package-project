# 3D visual audit — every packaging model (baseline, report only)

Key: `3d-visual` · Branch: `claude/exciting-albattani-8kzgsu-audit-3d-visual` · Base: head of `claude/exciting-albattani-8kzgsu`.
This round changes **no source**. Every finding below carries a precise fix for the next round (file, function, values).

## Method

| Step | Tool (all under `docs/audit/tools/`) | What it gives |
|---|---|---|
| Model list | `models-json.ts` | All **370** library models: 274 boxes (core 13, FEFCO 02 24, 03/05 32, 04 80, 06/07 33, 09 36, ECMA tuck 14, ECMA specials 20, food service 8, rigid + tubes 14) and 96 containers (core 10, bottles/jars/tubs 34, cosmetic/pharma/cans/tubes 37, flexible 15). |
| Render capture | `capture.cjs` | Loads `/en/dev/3d`, picks each model in the library browser (same `DesignScene` → `Scene3D` / `VesselView` path as the designer), `reducedMotion: reduce` so fold/camera land deterministically, 1x DPR. Boxes: closed iso, closed back-bottom (180° + tilt), 50 % fold, flat. Containers: iso, back, top-down. Console errors logged per model. |
| Contact sheets | `sheet.cjs` | `docs/screenshots/audit/3d-visual/<family>-NN.jpg` (JPEG q78, 1x). |
| Artwork mapping | `pattern.cjs` | 13 core structures with the face **test pattern** (face names + up arrows) in iso + 6 orthographic views + inside print at 50 % fold → `core-pattern-1/2.jpg`. |
| Geometry numbers | `geometry-check.ts` | Every box at default size + default board: closed outer vs inner, coplanar overlapping panels (**z-fight**, d = 0), stacked panels closer than one caliper (**interpenetrate**), missing print face. |
| Container numbers | `vessel-check.ts` | Brim-full profile volume vs nominal capacity, and **option collapse** (different container / closure options that resolve to the same renderer code, so picking them cannot change the 3D model). |

Rendering environment: Chromium + SwiftShader (ANGLE). Anti-aliasing, DPR and texture filtering are judged at 1x; on a real GPU at DPR 1.5–2 edges are cleaner, so AA findings are rated conservatively.

Severity: **critical** = model is wrong / broken (not the product it claims), **high** = clearly wrong to a packaging buyer or an option that silently does nothing, **medium** = noticeable realism / polish defect, **low** = nitpick.

---

## Summary

**97 findings** across 370 models: **4 critical · 17 high · 42 medium · 33 low** (rows marked "—" are verified-correct notes, not counted).

| Family | Models | Critical | High | Medium | Low |
|---|---:|---:|---:|---:|---:|
| 0. Cross-cutting renderer | all | 0 | 1 | 8 | 3 |
| 1. Core structures | 13 | 0 | 1 | 4 | 5 |
| 2. FEFCO 02 | 24 | 1 | 1 | 2 | 1 |
| 3. FEFCO 03 / 05 | 32 | 1 | 1 | 3 | 1 |
| 4. FEFCO 04 | 80 | 0 | 0 | 3 | 2 |
| 5. FEFCO 06 / 07 | 33 | 0 | 0 | 4 | 2 |
| 6. ECMA specials | 20 | 0 | 2 | 1 | 3 |
| 7. Food service + rigid + tubes | 22 | 0 | 1 | 4 | 3 |
| 8. FEFCO 09 fittings | 36 | 0 | 0 | 3 | 1 |
| 9. ECMA tuck | 14 | 0 | 0 | 2 | 2 |
| 10. Finishes + options (boxes) | — | 0 | 2 | 4 | 3 |
| 11. Bottles, jars, tubs (+ core) | 44 | 0 | 5 | 1 | 3 |
| 12. Cosmetic, pharma, cans, cups, tubes | 37 | 2 | 3 | 2 | 2 |
| 13. Flexible | 15 | 0 | 0 | 1 | 2 |
| **Total** | **370** | **4** | **17** | **42** | **33** |

No console errors or WebGL failures on any of the 370 models (harness log); 1 frame missing (FEFCO_0321 flat, harness selector clash).

### Top 20 fixes (in order)

1. **F02-01** FEFCO_0226 closed state not closed + gusset z-fight → `fefco-02/styles.ts` gusset `foldAngleClosed ±180`, `stack −1/−2`.
2. **F35-01** FEFCO_0322 tray + lid never assemble → `fefco-03-05/generators.ts` end-wall folds + lid `assembly.matrix`.
3. **V-11** Square tins get a round lid → lid built from `profile.section` (`cosmetic-cans/geometry.ts`, `vessels/closures.ts`).
4. **V-12** Rectangular punnet / clamshell / ice tub get round lids → same section-driven lid + `TOP_SEAL_FILM`/`HINGED_LID`.
5. **X-01** Pass container tint + closure style through `VesselOption` (green glass, cobalt, PET blue, coloured HDPE, ABS black, crown, ROPP, cork) → `library/vessels.ts`, `VesselView.tsx` L81–82, `vessels/materials.ts`.
6. **FN-01** Gold/silver foil renders black → StudioLights for finishes + foil `envMapIntensity 1.6` in `finishMaterial.ts`.
7. **X-03** One shared light rig (`StudioLights`) for boxes, finishes and vessels; brighter fill (fixes muddy bottoms, black tinplate V-13, foil).
8. **FN-02** Spot UV invisible without a mask → default mask to logo layer in `toggleFinish`.
9. **V-02** Hex honey jar renders round → polygon section (6 sides) in `bottles/models/jars.ts`.
10. **V-03** Shampoo oval: missing flip-top + label slicing the body → `closures.ts` FLIP_TOP for pump-core, oval label band in `labels.ts`.
11. **V-04** Detergent / jerrycan / gallon jug lack handles → handle sweep in `vessels/geometry.ts`.
12. **SP-01** Cone artwork upside-down/mirrored → 180° face transform in `ecma-specials/shapes.ts`.
13. **SP-02** Aseptic brick ears stand up unprinted → fold ears flat (`carriers.ts`).
14. **C-01 / FR-01** Rigid lids/sleeves interpenetrate base walls → lid inner `+ 2t + 1 mm` in `structures.ts` and `rigid-tubes/rigid.ts`.
15. **F35-02** Octabin bottom flaps coplanar → per-flap `stack` in `fefco-03-05/generators.ts`.
16. **F04-01/02** 18 FEFCO 04 trays: bottom flaps 0.5 mm inside the base, corner flaps coplanar → full-caliper `stack` in `fefco-04/build.ts`.
17. **V-06** Label backs show mirrored artwork through clear glass → `createLabelMaterial` FrontSide + white liner back mesh.
18. **X-06** White rim on rigid boxes → wrap colour on rigid cut edges.
19. **X-02** Framing fills only ~35–40 % → projected-box fit, margin 1.08 (`PackagingScene.tsx · frameFor`).
20. **V-15 / V-14** Deodorant stick renders as a lidded cup; black compact renders white → `TWIST_UP` closure, `ABS_BLACK` core material.

---

## 0. Cross-cutting (renderer, applies to every box or every container)

| ID | Scope | Sev | Finding | Real-world reference | Fix (file · function · values) |
|---|---|---|---|---|---|
| X-01 | all containers | high | Container and closure options are reduced to ~10 core renderer codes before rendering, so **20+ options render identically or wrongly**: green glass renders **amber**, cobalt glass renders clear, `PET_BLUE` clear, `HDPE_COLOURED`/`HDPE_NATURAL` white, `ABS_BLACK` compact **white**, crown cork / ROPP / natural cork / sparkling cork / pourer / bar-top all render as a **plastic screw cap** (full list in §V-collapse). | Green (UAG/"Georgia green") glass for wine/oil; 26 mm crown (ISO 12821) is a fluted steel crimp 6 mm tall, not a threaded cap; cork + capsule covers the neck 40–60 mm. | `src/components/designer/VesselView.tsx` L81–82 only passes `core`. Add `tint?: string` (from `BOTTLE_MATERIALS[m].hex`, `COS.MATERIAL_NAMES` hex) and `closureStyle?: string` to `VesselOption` (`src/lib/library/types.ts`), fill them in `src/lib/library/vessels.ts` (`BOTTLES`, `COSMETIC` maps), and in `src/components/three/vessels/materials.ts → createVesselMaterial` use `opts.tint` for `color` + `attenuationColor` (green glass: `attenuation #2f5a2c`, `attenuationDistance 0.01`). Add `CROWN`, `CORK_CAPSULE`, `ROPP`, `POURER` lathe profiles in `src/components/three/vessels/closures.ts`. |
| X-02 | all boxes | medium | Default framing leaves the closed box at ~35–40 % of the viewport width (lots of dead space); vessels use a different margin (1.08) so switching box ↔ bottle jumps scale. | Product-shot convention: subject fills 60–70 % of the frame. | `src/components/three/PackagingScene.tsx · frameFor` L109: fit the **projected** box (8 corners through the camera at `DEFAULT_VIEW`) instead of the bounding **sphere**; margin `1.2 → 1.08` to match `vessels/VesselScene.tsx · frame` L60; target y `size.y/2 → size.y*0.47`. |
| X-03 | all boxes | medium | Underside / back faces read muddy olive (yellow artwork renders ~45 % luminance on the bottom in the default light rig); bottoms look like a different colour. | Packshot lighting keeps fill within ~1.5 stops of key. | `PackagingScene.tsx` default rig (non-stage branch): `hemisphereLight` ground `#d9d4cc → #ece7df`, intensity `0.9 → 1.1`; add the `StudioStage` floor-bounce `Lightformer` (`intensity 0.35`, `#f2e6d6`, `position [0,-2,0]`) to this `Environment`, raise `environmentIntensity 0.55 → 0.8`. Better: always mount `StudioLights` so boxes, finishes and vessels share one rig (today there are three different rigs). |
| X-04 | all boxes | medium | Flat state (fold 0) stands the blank **vertically** on its bottom edge; at the default 3/4 view it is foreshortened and its contact shadow sits detached under it. | A die-cut blank is shown lying flat or face-on (dieline proof view). | `src/lib/dieline/fold.ts · rootRotationAt`: blend from a "lying" quaternion (−90° about X) instead of identity, **or** in `PackagingScene.tsx` when `foldTarget === 0` animate the camera to `VIEWS.front` (theta 0, phi 88°). |
| X-05 | corrugated | medium | Cut-edge flute texture: one sine row for all boards (B, E and the configurator's BC double wall in the legacy path), drawn on **every** edge — edges parallel to the flute direction should show the straight liner stack, not waves; inside liner on the edge uses the **outside** colour (white-top board shows white on both liners). | Corrugated board: flutes run across the panel height on an RSC; parallel cuts show flat liners; white-top liner is white only on the print side. | `src/components/three/boardMaterials.ts · fluteTexture` L77–99: take `insideLiner` as a 4th arg (`appearance.inside`) for the bottom 4 px; in `panelGeometry.ts · buildPanelGeometry` pick a second edge material (flat liner stack) when the edge direction is within 30° of the panel's flute axis (flutes ⟂ the panel's longest crease for RSC). Legacy path: honour `fluteLayers()` from `finishes/looks.ts` (2 rows for BC). |
| X-06 | rigid boxes | medium | Rigid set-up boxes show a **white cut edge** (`#efebe3`) around the lid and base rim. A wrapped rigid box has no visible board edge: the wrap paper turns over the rim (turn-in) and carries the printed colour. | Rigid set-up box: 1.5–2.5 mm greyboard + 120–157 gsm wrap, 15–20 mm turn-in. | `src/lib/dieline/materials.ts · boardAppearance` L119: rigid `edge` → use the outside artwork colour; in `panelGeometry.ts` map edge UVs of RIGID panels to the nearest outside UV (sample the sheet colour) instead of the flat edge material. |
| X-07 | all boxes | low | Default iso view (theta 32°) puts the front-centre of cylinders near the silhouette, so centred front text is cut by the tube edge (PAPER_TUBE "ELBA" → "LBA"). | Tube packshots are shot ~15° off front. | `PackagingScene.tsx` L89: per-shape default `theta 32° → 18°` when `dieline.closedOuter` is round (or `model.shape === "cylinder"`). |
| X-08 | turntable | medium | Two different idle-rotation behaviours: boxes rotate 6°/s after 4 s idle and resume after input (`AUTO_ROTATE`), containers spin **20°/s immediately** (`s.theta += delta * 0.35`) and stop for good after the first touch. | WCAG 2.2.2 (pause, stop, hide) and a calm 60 s/turn reference. | `src/components/three/vessels/VesselScene.tsx · Rig` L150: use `AUTO_ROTATE` from `finishes/motion.ts` (idle 4000 ms, 6°/s, ramp 1200 ms) and reset `interacted` on idle like `PackagingScene.tsx · poke`. |
| X-09 | fold animation | medium | Panels fold along independent hinge arcs with no collision avoidance: long panels and extra pieces sweep **through** the walls mid-fold (FEFCO 0225 liner, 0320 lid, several 04xx trays). | Real assembly order folds outer panels last. | `src/lib/dieline/fold.ts · panelFoldAmount`: give extra pieces / long liners a later `foldStage` in their generators, or add `assembly.lift` (already supported in `assemblyPoseAt`) for pieces that cross the body. Per-model fixes in family tables. |
| X-10 | inside print | medium | Inside artwork on lids reads **upside down** when the lid is opened toward the viewer (test pattern shows "dOT" on ECMA_RTE / CLB / SLB / PIZZA inside lids). | Printers rotate inside-lid copy 180° so it reads when opened (e.g. "Hello" mailer insides). | `src/lib/dieline/fold.ts · faceTransform(…, "inside")`: for `top` / lid parts compose an extra 180° rotation (`[-1,0,0,-1,width,height]`); same in `texture.ts` inside painter. |
| X-11 | all | low | No loading poster for the designer or library 3D views (only the marketing hero passes `poster`); the stage shows a blank skeleton for 1–3 s on first load. | — | `src/components/designer/Scene3D.tsx`: pass `poster={modelImage(model.slug)}` (the picker thumbnail already exists, `ModelPicker.tsx · modelImage`) to `PackagingScene`; same in `VesselView.tsx`. |
| X-12 | camera | low | Re-framing on model change keys on `dieline.structureCode` (`framedFor` in `Rig`); family models priced as the same core code (e.g. all FEFCO 02xx → `FEFCO_0201`) do not reset the view angle when switched, only the distance. | — | `PackagingScene.tsx` L201: key on `dieline.structureCode + dieline.sheet.width + dieline.panels.length` (or pass `modelCode` as a prop). |

---

## 1. Core structures (13) — `src/lib/dieline/structures.ts`

Contact sheets: `core-01.jpg`, `core-02.jpg`; mapping: `core-pattern-1.jpg`, `core-pattern-2.jpg`.
Mapping verdict: every outside face reads upright and unmirrored in all six views; no seams across folds on slotted cases, tucks, trays or rigid boxes.

| ID | Model | Sev | Finding | Real-world reference | Fix |
|---|---|---|---|---|---|
| C-01 | RIGID_BOX | high | Lid turn-ins and base walls occupy the same space (geometry check: `front↔lid_frontTurn`, `back↔lid_backTurn`, `left↔lid_leftTurn` overlap 0.5 mm on 2.15 mm board, 2 500–3 500 mm²); in iso the base wall corner pokes out below the lid with a visible notch. | Lid inner = base outer + 1–1.5 mm clearance (2 × caliper + 1 mm) so the lid slides over. | `structures.ts` rigid generator: size lid `L/W += 2*t + 1.0` mm; base turn-in `stack` offset one more caliper (`stack: -2`). |
| C-02 | RIGID_BOX | medium | White rim on lid and base (see X-06). | Wrapped edge. | X-06. |
| C-03 | PAPER_TUBE | medium | Left/right views show a vertical **light stripe** at the label overlap (unprinted `bodyGlue` overlap shows board through) and the artwork colour jumps at the seam. | Spiral/convolute composite cans hide the overlap under the label; seam is a hairline. | `structures.ts` L781/804: mark `bodyGlue` / `lidGlue` `printable: true` and let the painter bleed the artwork 3 mm across; or set the overlap `stackOffset` so it sits **under** the next strip (`stack: -1 → +0.5` toward inside). Geometry check also flags `body17↔lidGlue` interpenetration 0.4 mm. |
| C-04 | PAPER_TUBE | low | Front text sits on the silhouette at the default view (X-07). | — | X-07. |
| C-05 | ECMA_RTE | low | `glue↔bottomTuck` coplanar (d = 0, 229 mm²) inside the carton: z-fighting visible when looking in from the open end. | Glue flap is laminated to the panel, tuck sits one caliper inside. | `structures.ts` L178: glue flap `stack: -1` already; give the bottom tuck `stack: -2`. |
| C-06 | FEFCO_0320 | medium | Lid joint (`lid_glue`) interpenetrates the base `left` wall by 0.5 mm over ~3 000 mm²; at 50 % fold the lid sweeps through the base walls (X-09). | Telescope lid inner = base outer + 2 t. | Lid generator: `L/W += 2*t + 1`; lid `assembly.lift = H * 0.6`. |
| C-07 | GABLE_BOX | low | Handle is a zero-thickness single slab seen edge-on as a 1 px line from the side views. | 2 plies of board with a die-cut hand hole. | Fine for a carton; optional: double the handle panel (`stack +1`). |
| C-08 | ECMA_CLB, ECMA_SLB | low | Bottom view shows unprinted crash-lock / lock tabs in grey: correct to life, but the grey reads as a rendering hole on dark artwork. | Bottoms are usually unprinted. | None (keep); optionally paint the face background colour over glue-free lock flaps in `texture.ts`. |
| C-09 | PIZZA, ECMA_RTE/CLB/SLB | medium | Inside lid copy upside down when opened (X-10). | — | X-10. |
| C-10 | all core | low | Back/bottom faces muddy (X-03); flat state vertical (X-04). | — | X-03, X-04. |

## 2. FEFCO 02 slotted family (24) — `src/lib/dieline/families/fefco-02`

Contact sheets: `fefco-02-01..03.jpg`.

| ID | Model | Sev | Finding | Real-world reference | Fix |
|---|---|---|---|---|---|
| F02-01 | FEFCO_0226 | **critical** | Closed state is **not closed**: a top gusset flap stands up behind the lid (closed outer H 295 mm vs 200 mm inner) and the bevelled gusset parts are coplanar with the top flaps (`topFlap_left↔topFlap_left_ga` z-fight 8 279 mm², `…_gb` 7 843 mm²) — visible zebra striping on the lid. | FEFCO 0226: RSC with bevelled gusset flaps that fold flat inside the top. | `families/fefco-02/styles.ts` 0226 builder: gusset parts `_ga/_gb` need `foldAngleClosed` ±180 (fold back on themselves) and `stack: -1/-2`; parent top flap `foldAngleClosed 90`. Add a test: closed H ≤ inner H + 4 t. |
| F02-02 | FEFCO_0217 | — | Closed H 254 vs 150 inner: the carry handle stands 100 mm up. Matches the reference (handle above the gable). | FEFCO 0217 gable carry. | None (expected); exclude from the outer-H check. |
| F02-03 | FEFCO_0225 | high | `glue↔wingL` coplanar (z-fight 2 338 mm²) on the wall; at 50 % fold the integral base/liner strip passes straight **through** the box walls. | FEFCO 0225: liner is folded in last. | `styles.ts` 0225: `wingL` `stack +1`; liner panels `foldStage` = max stage + 1. |
| F02-04 | FEFCO_0229 | medium | Bottom (double-folded flaps) leaves a rectangular **opening** in the bottom showing the box interior and a tab inside. | FEFCO 0229 double-folded flaps form a solid reinforced bottom (inner flaps meet). | `styles.ts` 0229: inner fold depth = W/2 − t so the folded halves meet at the centre line. |
| F02-05 | FEFCO_0230 | low | Overlap joint in the length panel shows as a dark slot crossing the lid and front at the closed state (the slot between flap groups is 2× the needed width). | FEFCO 0230: slot = 2 t + 1 mm. | `styles.ts`: slot width `2*t + 1` instead of fixed 6 mm. |
| F02-06 | all 24 | medium | Board edge reads as a thin uniform brown line; flute wave only visible when zoomed (X-05). Fold/mapping otherwise correct: top/bottom flap gaps on 0201-style RSC, full overlap 0203/0206, frame top 0209, tear strip perforation 0214 render to life. | — | X-05. |

## 3. FEFCO 03 telescope + 05 slide families (32) — `src/lib/dieline/families/fefco-03-05`

Contact sheets: `fefco-03-05-01..04.jpg`. (0321 flat frame missing: harness click collision, re-run with `pattern.cjs`-style direct link.)

| ID | Model | Sev | Finding | Real-world reference | Fix |
|---|---|---|---|---|---|
| F35-01 | FEFCO_0322 | **critical** | "Closed" shows the friction-lock tray and lid **not assembled**: lid floats above the tray, both double end walls stay open/unfolded, the tray is a three-sided U. Same at every view. | FEFCO 0322: tray + lid, each with rolled double end walls that friction-lock into the side walls. | `families/fefco-03-05/generators.ts` 0322: end-wall panels lack `foldAngleClosed` (or have `foldStage` beyond `maxStage`); lid `assembly.matrix` must translate the lid to `y = H − lidDepth` over the tray. Add a unit test `computePoses(d,1)` bbox ≈ outer dims. |
| F35-02 | FEFCO_0350 | high | Octabin bottom flaps are **coplanar** (`bottomFlap1↔2`, `2↔3`, `5↔6`, `6↔7`, d = 0, ~35 000 mm² each): z-fighting on the visible underside. | FEFCO 0350 flap bottom: flaps overlap in sequence, each one caliper higher. | `generators.ts` octabin bottom: `stack` = −1, −2, −3 … per flap in fold order (B-flute t = 3 mm). |
| F35-03 | FEFCO_0303, 0304, 0308, 0309, 0322, 0323, 0330, 0331 | medium | Closed outer exceeds inner + board by **20 mm** on one axis (e.g. 0303 W 240 vs 220): gusset / double-wall panels stand 10 mm proud of the walls instead of lying on them; 0303 shows the diagonal gusset creases on the outside face as raised folds. | Gussets folded outside add 2 t (3 mm on E-flute), not 20 mm. | Gusset panels: `foldAngleClosed 180` (lie flat) not 90; double wall `stack +1`. Test: outer ≤ inner + 4 t + 2. |
| F35-04 | FEFCO_0321, 0325, 0504 | medium | Lid / cap joints interpenetrate the body by 0.5 mm (d = 1.0 on 1.5 mm board) over 3 000–9 000 mm²: thin flicker at the joint edge. | Joint glued on the inside: one caliper. | Joint `stack: -1` (full caliper). |
| F35-05 | FEFCO_0504, 0507, 0510–0512 | medium | 50 % fold: sleeve and liner pieces pass through each other (X-09). | — | `assembly.lift = H * 0.8` on the sleeve piece; liner `foldStage` before sleeve. |
| F35-06 | FEFCO_0307 | low | Locking-tab corners show small dark smudges on the front face (tab slits cut through the printed face). | Locking slits sit on the crease, not the face. | Move slit polygons 0.5 t onto the crease line. |
| F35-07 | FEFCO_0300–0302, 0306, 0309–0314, 0350–0352, 0501–0503, 0505, 0509 | — | Assembled correctly: tray + lid proportions, caps on 0310/0313/0314, octagon 0350–0352, open sleeves 0501–0503 read to life. | FEFCO code book 03/05. | — |

## 4. FEFCO 04 folder / tray family (80) — `src/lib/dieline/families/fefco-04`

Contact sheets: `fefco-04-01..08.jpg`. Overall the strongest family: every folder, tray and display style assembles; handholds, display headers (0434/0435/0449/0460), octagonal 0459, long document folders 0409–0411 and 0404 open-ended folder tube (correct: "no end flaps") read to life.

| ID | Model | Sev | Finding | Real-world reference | Fix |
|---|---|---|---|---|---|
| F04-01 | FEFCO_0422_2, 0424, 0424a, 0425a, 0428, 0428a, 0432, 0432a, 0435a, 0436, 0439, 0439a, 0454_1, 0455_1, 0470, 0471, 0471a, 0472 (18) | medium | Bottom flaps folded onto the base sit **0.5 mm inside the base slab** (mid-plane distance 1.0 mm on 1.5 mm E-flute, 8 000–20 000 mm² each): the flap's outside print shimmers through the base inside the tray and the cut edges clip into the floor. | Flaps folded 180° onto the base lie one full caliper above it. | `families/fefco-04/build.ts`: bottom-flap `stack` uses 2/3 of a caliper — set `stackOffset = parent.stackOffset - 1` (full `t`); double-wall corners `-2`. |
| F04-02 | FEFCO_0439, 0439a, 0471, 0471a, 0472, 0425a, 0436 | medium | Adjacent bottom flaps overlap at the corners while **coplanar** (`frontBottomFlap↔rightBottomFlap` d = 0, 460–750 mm²): z-fight triangles in the tray corners. | Corner flaps overlap in fold order. | Same builder: increment `stack` per flap in fold order (front −1, sides −2, back −3). |
| F04-03 | FEFCO_0459 | medium | Octagonal tray corner ears coplanar with the neighbouring ear (`ear_back_a↔ear_right_b` etc., d = 0, ~200 mm² × 4). | — | `catalog.ts` 0459 ears: alternate `stack` −1/−2. |
| F04-04 | FEFCO_0409–0411a | low | Long folders (aspect ≥ 6:1) occupy ~10 % of the frame height at the default 3/4 view (X-02 sphere fit is worst for long thin shapes). | — | X-02 projected-box fit. |
| F04-05 | all | low | 50 % fold: lids rotate through the opposite wall on 0402, 0422_2, 0424, 0435, 0455_1, 0472 (X-09). | — | Wall panels `foldStage` before lid flaps (already true for most). |

## 5. FEFCO 06 rigid-type + 07 ready-glued families (33) — `src/lib/dieline/families/fefco-06-07`

Contact sheets: `fefco-06-07-01..04.jpg`. Three-piece 06xx boxes (separate end panels 0615/0616/0752) and crash-lock 07xx bottoms assemble correctly; bottle-hole 0751 and vented 0771/0772 bottoms render to life.

| ID | Model | Sev | Finding | Real-world reference | Fix |
|---|---|---|---|---|---|
| F67-01 | FEFCO_0601, 0602, 0606 | medium | Corner flaps coplanar (`frontFlap_left↔bottomFlap_left`, `bottomFlap_*↔backFlap_*`, d = 0, ~370–410 mm² × 4): z-fight at all four bottom corners. | FEFCO 0601: flaps glued to the end panels in a set order. | `families/fefco-06-07/group06.ts`: stack flaps −1/−2 in fold order. |
| F67-02 | FEFCO_0605 | medium | Rim panels coplanar with end-panel top flaps (`rimFront↔endL_flap_top` …, 655 mm² × 4). | — | `group06.ts` 0605 rim `stack -2`. |
| F67-03 | FEFCO_0608 | medium | Tuck coplanar with end-panel flaps (`tuck↔endL_flap_right`, 1 002 mm² × 2). | — | 0608 tuck `stack -2`. |
| F67-04 | FEFCO_0621 | medium | Tab sits 1 mm inside the front wall (`front↔tab`, d 0.5 of 1.5, 10 421 mm², both pieces). | — | `parts.ts` tab `stack -1` full caliper. |
| F67-05 | FEFCO_0714 | low | Lid joint 0.5 mm inside the back wall (1 512 mm²). | — | `group07.ts` lid joint `stack -1`. |
| F67-06 | FEFCO_0700 | low | Default closed state leaves the top **open** (no top flaps folded): matches the code (crash-lock bottom, open top) but the "closed" button suggests a closed box. | FEFCO 0700 open-top. | Label the fold-1 state "Assembled" for open-top styles in `LibraryDevSection` / designer fold control. |
| F67-07 | FEFCO_0717 | — | H 285 vs 210 inner: carry handle above the top (expected). | — | Exclude from outer-H check. |

## 6. ECMA specials (20) — `src/lib/dieline/families/ecma-specials`

Contact sheets: `ecma-specials-01..02.jpg`.

| ID | Model | Sev | Finding | Real-world reference | Fix |
|---|---|---|---|---|---|
| SP-01 | CONE | high | Front artwork on the cone renders **upside down and mirrored** ("ELBA" reads as rotated glyphs near the seam) and the face transform squeezes it toward the tip. | Paper cones (fries / ice cream) are printed on an annular-sector blank; copy reads upright from the side. | `families/ecma-specials/shapes.ts` cone: the sector panel's `faces.front` transform must map face-up to the cone's apex-down axis — compose a 180° rotation (`[-1,0,0,-1,w,h]`) in the face part transform and use the sector's mid-radius arc as the face width. Add a test-pattern unit check (up arrow points to the rim). |
| SP-02 | LIQUID_ASEPTIC_BRICK | high | Top **ears stand up unprinted** (grey triangle at the top corner) instead of folding down flat onto the side panels; the top seal fin is missing. | Aseptic brick (TBA 200/1000 ml): top and bottom ears are folded flat and glued onto the side panels / base; transverse seal fin lies flat on top. | `families/ecma-specials/carriers.ts` (brick): ear panels `foldAngleClosed −90 → −180` with a second hinge onto the side, `printable: true`; add a 6 mm top fin panel folded flat. |
| SP-03 | ECMA_TRAY_BEERS | medium | Corner webs coplanar (`webFLA↔webFLB` … d = 0, 1 750–1 840 mm² × 4): z-fight in every corner. | Beers tray: web halves fold onto each other. | `trays.ts` web `B` halves `stack -1` vs `A`. |
| SP-04 | ECMA_PILLOW | low | Pillow ends drawn as two flat facets per end (visible crease ridges); H +47 mm vs inner is the curved end (expected). | Pillow box: smooth curved end panels. | `shapes.ts` pillow: split each end into ≥ 8 `hingeKind: "roll"` strips (same technique as tube labels) for smooth normals. |
| SP-05 | ECMA_HEXAGON, ECMA_OCTAGON | low | Lids lift and swing through the body at 50 % fold (X-09). HEXAGON outer L 93 vs 80 inner = across-corners (expected). | — | `assembly.lift`. |
| SP-06 | FOLDER_PRESENTATION, ECMA_WALLET_ENDFLAP | low | Closed state is a flat 2-panel folder standing on its edge: fine, but the default view shows it edge-on-ish (X-04 / X-02). | — | Default view `front` for flat folders. |
| SP-07 | CUP_CARRIER, BOTTLE_BASKET_4/6, GABLE_CARRY_CLB, LIQUID_GABLE_TOP, ECMA_TRAY_4C/6C_LID/BRIGHTWOOD/HINGED_TUCK, ECMA_SLEEVE_OPEN, ECMA_WRAP_LOCK, ECMA_COUNTER_DISPLAY | — | Assemble correctly; handle cut-outs, cup holes and gable-top fin read to life (H excess on carriers = handles, expected). | ECMA catalogue. | — |

## 7. Food service (8) + rigid boxes and tubes (14) — `families/foodservice`, `families/rigid-tubes`

Contact sheets: `foodservice-rigid-tubes-01..02.jpg`.

| ID | Model | Sev | Finding | Real-world reference | Fix |
|---|---|---|---|---|---|
| FR-01 | RIGID_LID_BASE, RIGID_WINDOW, RIGID_DRAWER, RIGID_BOOK_MAGNETIC | high | Lid / sleeve / cover turn-ins occupy the base walls (`front↔lid_frontTurn` 0.5 mm into 2.15 mm board, 2 100–3 500 mm² per wall; drawer sleeve 0.75 mm); book cover turn-ins **coplanar** with the base bottom (`bottom↔cover_bottomTurnF` d = 0, 3 071 mm²) → z-fight on the underside. | Lid inner = base outer + 1–1.5 mm; book cover board is glued under the base (one caliper + wrap). | `families/rigid-tubes/rigid.ts`: lid/sleeve inner dims `+ 2*t + 1.0`; cover turn-ins `stack -1` relative to the base bottom. |
| FR-02 | RIGID_SHOULDER, RIGID_HINGED_LID | medium | Neck panels coplanar with the base turn-ins (`frontTurn↔neck_front` 1 406 mm², d = 0) and side tabs coplanar with turns (`leftTurn↔frontTabL` ~50 mm²): flicker at the shoulder line. | Shoulder (neck) box: neck is a separate tray glued **inside** the base, one caliper in. | `rigid.ts` neck piece `stack -1`; tabs `-1`. |
| FR-03 | all RIGID_* | medium | White cut edge on every rim (X-06). | Wrapped edges. | X-06. |
| FR-04 | TUBE_LID_BASE, TUBE_ROLLED_EDGE, TUBE_TELESCOPING, TUBE_PUSH_UP, TUBE_WINDOW, TUBE_SHOULDER | medium | Label overlap stripe visible down the back (unprinted overlap, same as C-03); `lidGlue` / `bodyGlue` 0.4 mm into the body; TUBE_SHOULDER neck coplanar with `bodyGlue` (899 mm²); ROLLED_EDGE rolled-curl strips 0.4 mm into the body all round. | Composite cans: overlap under the label, hairline seam. | `rigid-tubes/tubes.ts`: overlap printable + `stack` under the next strip (see C-03); curl strips radius `+ t`. |
| FR-05 | all TUBE_* | low | Front copy cut by the silhouette at the default view (X-07). | — | X-07. |
| FR-06 | FS_NOODLE_PAIL | medium | Noodle pail renders as a tapered open box: no **wire handle** and no folded top closure flaps (outer 101×91 vs 70×60 is the flare, expected). | Oyster pail (16/26/32 oz): flared square body, four interlocking top flaps, wire bail handle. | `families/foodservice/generators/boxes.ts`: add 4 top flaps (`foldAngleClosed 90`, interlocking) and render a bail handle as a `TubeGeometry` child in `PackagingModel` (`dieline.extras.handle`). |
| FR-07 | FS_PIZZA_SLICE | low | Side ears 0.56 mm into the side walls (766 mm² × 2). | — | `boxes.ts` ears `stack -1`. |
| FR-08 | FS_FRIES_SCOOP | low | `glue↔bottomTuck` coplanar (94 mm²). | — | `bottomTuck stack -2`. |
| FR-09 | FS_CAKE_BOX_WINDOW, FS_BAKERY_BOX, FS_BURGER_CLAMSHELL, FS_SANDWICH_WEDGE, FS_PIZZA_ROUND, RIGID_COLLAPSIBLE, PALLET_BOX | — | Assemble correctly; window film on cake box and sandwich wedge reads as clear film. | — | — |

## 8. FEFCO 09 interior fittings (36 printed of 48) — `src/lib/dieline/families/fefco-09`

Contact sheets: `fefco-09-01..03.jpg`. Fittings are sized by the host box's inner dims, so "outer < inner" in the geometry check is expected (not a finding).

| ID | Model | Sev | Finding | Real-world reference | Fix |
|---|---|---|---|---|---|
| F09-01 | FEFCO_0904, 0907, 0908, 0920, 0970, 0971, 0971A, 0902 | medium | The default 3/4 view shows the **unprinted** side: the printed face is `left` / `back` / `right` only (no `front` / `top`), so the user lands on bare kraft and must orbit to find the artwork. | — | `PackagingScene.tsx · Rig` initial framing: pick `DEFAULT_VIEW.theta` from the largest printed face in `dieline.faces` (front 32°, right 122°, back 212°, left −58°). |
| F09-02 | FEFCO_0945 | medium | Pad coplanar with its edge strips (`pad↔edgeLeft`, `pad↔edgeRight`, d = 0, 4 876 mm² each): z-fight stripes along both long edges. | — | `cushions.ts` 0945 edge strips `stack -1`. |
| F09-03 | FEFCO_0948 | medium | Accordion pad panels coplanar (`p4↔p8`, `p4↔p0`, 4 469 mm²). | Folded pad: each layer one caliper apart. | `cushions.ts` 0948: `stack` = layer index. |
| F09-04 | FEFCO_0902 | low | Single pad rendered **standing on edge** in the closed state (it is a flat pad with one printed face). | A pad lies flat in the box bottom. | `liners.ts` 0902: `closedRotation` identity → −90° about X. |
| F09-05 | all others | — | Liners, sleeves (0906/0931/0932), H-dividers (0920/0921), corner posts read correctly. | FEFCO code book 09. | — |

## 9. ECMA tuck-end family (14) — `src/lib/dieline/families/ecma-tuck`

Contact sheet: `ecma-tuck-01.jpg`. All 14 cartons assemble; tuck flaps, dust flaps, hanger tabs (euro slot, round hole), seal-end tear strip and snap/crash-lock bottoms render to life.

| ID | Model | Sev | Finding | Real-world reference | Fix |
|---|---|---|---|---|---|
| TK-01 | ECMA_TUCK_RTE, AIRPLANE, FRENCH_RTE, HANGER_EURO, HANGER_ROUND, WINDOW_RTE, PHARMA_RTE | low | Glue flap coplanar with the tuck flap (`glue↔bottomTuck` / `glue↔topTuck`, d = 0, 46–266 mm²): z-fight visible when looking into an open end. | — | `families/ecma-tuck/closures.ts`: tuck flaps `stack -2` (glue is −1). |
| TK-02 | ECMA_DOUBLE_WALL_TUCK | medium | Inner walls coplanar with glue and tucks (`glue↔backInner` 2 467 mm², `topTuck↔frontInner` 1 457 mm², `bottomTuck↔backInner` 1 467 mm²). | Double-wall carton: inner walls one caliper inside. | `generators.ts` double wall: inner walls `stack -1`, glue `-2`, tucks `-3`. |
| TK-03 | ECMA_FLIP_TOP | medium | Top lip coplanar with the collar (417 mm²) — flicker on the front under the lid. | Flip-top (cigarette-style) collar sits inside the body. | `closures.ts` collar `stack -1`. |
| TK-04 | ECMA_WINDOW_RTE | low | Window film reads as an opaque light-grey patch (you see the unprinted inside of the back panel through 16 % film). | Real window cartons show the product; empty preview should look like clear film. | `PackagingModel.tsx` film material: `opacity 0.16 → 0.08`, add `transmission 1, thickness 0.05` on high quality; tint the inside back panel 5 % darker so depth reads. |
| TK-05 | ECMA_HANGER_EURO / ROUND | — | H +27/32 mm over inner = hanger tab (expected). | — | Exclude from outer-H check. |

## 10. Materials, finishes and option sensitivity (boxes)

Evidence: `finishes-ecma-ste.png` (none · gold foil · spot UV / emboss · soft-touch · gloss lamination) and `docs/audit/3d-visual-options.json` (`options.cjs`: % of stage pixels that change when an option is toggled, closed iso view; FEFCO_0201, ECMA_RTE, RIGID_BOX).

| ID | Option | Sev | Finding | Real-world reference | Fix |
|---|---|---|---|---|---|
| FN-01 | Gold / silver / rose-gold foil | high | Foil on the logo renders **near-black** (0.16–0.19 % pixel change; the text gets darker, not gold). Metalness 1 reflects an environment that is too dim and too small in the default rig (64 px, intensity 0.55, `envMapIntensity 0.7`), so metal reads as black. | Hot-foil gold: bright specular yellow (F0 ≈ 1.0, 0.78, 0.34) with a moving highlight. | Mount `StudioLights` (`finishes/StudioStage.tsx`) whenever `surfaceFinish` is set (X-03); in `finishes/finishMaterial.ts` foil branch raise env contribution: `envMapIntensity = mix(env, 1.6, foilA)` and floor albedo luminance (`diffuseColor = mix(diffuse, foilColor*0.35, foilA)`) so foil never drops below mid-grey on a dim env. |
| FN-02 | Spot UV | high | Toggling Spot UV changes **0 %** of pixels on all three test models: with no mask chosen, nothing is coated, and the UI gives no cue. | Spot UV is always a defined area (logo, pattern); printers ask for a separate mask layer. | `components/designer/lib/config.ts · toggleFinish`: default the mask to the main logo / text layer bounds when none is set; in `finishMaterial.ts` the spot-UV clearcoat (`SPOT_UV_LOOK`, roughness 0.03) needs a visible highlight — add a key-light strip `Lightformer` (already in `StudioLights`) so it shows at the default view. |
| FN-03 | Matte lamination, matte varnish, gloss varnish (rigid) | medium | 0 % visible change. Matte roughness 0.62 → 0.66 on SBS is imperceptible; gloss varnish on rigid (roughness 0.5 base) also 0 %. | Matte lamination slightly lifts blacks and kills the paper sheen; gloss varnish adds a soft specular. | `finishes/looks.ts · coatingLook`: matte → `roughness 0.85, inkTone 0.97, envIntensity 0.45`; matte varnish → `roughness +0.15`; gloss varnish → `clearcoat 0.6, clearcoatRoughness 0.12`. |
| FN-04 | Soft-touch lamination | medium | Whole box washes to a chalky grey haze (`sheen 0.45` white): reads as dusty, colours lose saturation. | Soft-touch: deep, slightly darker, velvety, no white haze face-on (sheen only at grazing). | `looks.ts`: `sheen 0.45 → 0.18`, `sheenRoughness 0.85 → 0.5`, `inkTone 0.95 → 0.92`. |
| FN-05 | Gloss lamination | medium | Only 3–8 % change; no crisp highlight at the default view, so gloss and unlaminated look alike. | Gloss lamination: mirror-like streak from the softbox. | With X-03 StudioLights the key strip gives the streak; additionally `clearcoatRoughness 0.05 → 0.03`. |
| FN-06 | Emboss / deboss | low | Visible but very shallow (0.1 % change, faint bevel). | 350 gsm emboss ≈ 0.3–0.5 mm relief, clearly visible raking light. | `looks.ts` `RELIEF_BUMP_SCALE 2.2 → 4`. |
| FN-07 | Print both sides | low | 0 % change in the closed view (correct: the inside is hidden) but the user gets no feedback. | — | When toggled on, animate fold to 0.6 for 1.5 s (respect reduced motion) or show the inside thumbnail. |
| FN-08 | Board E-flute white / B-flute kraft | low | Only 0.8–2 % change: white-top vs kraft is hidden under full-bleed artwork (correct) and B-flute caliper (3 mm) barely reads at 1x. | B-flute edge is twice E's. | X-05 flute edge; keep. |
| FN-09 | Kraft board under artwork | medium | Printed artwork on kraft renders as on white (no kraft show-through / ink absorption); designers expect kraft-tinted, slightly desaturated print. | CMYK on brown kraft without white underprint: multiply with kraft. | `boardMaterials.ts · createBoardMaterials`: when `appearance.outside === KRAFT` and no white underprint, `outside.color = #d9c2a3` (multiply) and `roughness 0.92`. |

## 11. Containers — core (10) + bottles, jars, tubs (34) — `src/lib/vessels`, `src/lib/vessels/families/bottles`

Contact sheets: `vessels-bottles-01..04.jpg` (iso · back · top-down). Numbers: `docs/audit/3d-visual-vessels.json`. Brim-full profile volume vs nominal capacity is within 0.97–1.19 for every round glass/PET bottle and jar (realistic headspace), so lathe proportions are sound; the defects are shape-class and option mapping.

| ID | Model | Sev | Finding | Real-world reference | Fix |
|---|---|---|---|---|---|
| V-01 | BTL_GLASS_WINE_BORDEAUX, BURGUNDY, HOCK, OIL_MARASCA, OIL_DORICA, BEER_LONGNECK (green option), JUICE | high | Default / green glass renders **amber** (X-01); wine bottles look like beer. | Bordeaux 750 ml: "antique green" / "dead leaf" glass. | X-01 tint pass-through (`GLASS_GREEN` hex `#2f5a2c`). |
| V-02 | JAR_GLASS_HONEY_HEX | high | "Hexagonal" honey jar renders as a **round** jar (core `WIDE_JAR`, section round). | Hex jar 190 ml (e.g. 45 mm TO lug): six flat facets, 62 mm across flats. | `families/bottles/models/jars.ts`: set `section: { kind: "polygon", sides: 6 }` and have `profileFor` emit it; `components/three/vessels/geometry.ts` already builds non-round sections for PERFUME_SQUARE — reuse with `sides`. |
| V-03 | BTL_HDPE_SHAMPOO_OVAL | high | **No closure** rendered (bare thread finish; default `FLIP_TOP` is not drawn on this core kind) and the label band cuts a **white slice** through the lower body on the back (label placement on the oval section intersects the wall). | 400 ml oval HDPE with 24/410 flip-top cap. | `vessels/closures.ts`: support `FLIP_TOP` for `PUMP_BOTTLE`-core bodies (fall back to `SCREW_CAP` geometry + hinge lid); `vessels/labels.ts` oval band: follow the elliptical section (`section.rx/ry`) instead of the round radius. |
| V-04 | BTL_HDPE_DETERGENT_HANDLE, JERRYCAN_HDPE, BTL_HDPE_GALLON_JUG | high | Rendered as plain square bottles: **no integral handle** (names promise one). | 2.5 L detergent / 20 L jerrycan / 1 gal jug: blow-moulded hollow handle. | Add a `handle` feature to the bottles family profile (swept tube or `TorusGeometry` segment joined at shoulder and upper body) in `components/three/vessels/geometry.ts`, driven by `def.handle: { side, gripMm }`. |
| V-05 | BTL_GLASS_WATER, BEER_*, SPARKLING, WINE_*, OIL_*, SAUCE_WOOZY, SPIRITS_FLASK, PHARMA_SYRUP | high | Crown cork, ROPP, natural cork + capsule, sparkling cork + muselet, pourer, bar-top and child-resistant caps all render as the same **plastic screw cap** (X-01). | ISO 12821 crown (fluted steel, 6 mm), ROPP aluminium (knurled skirt), wine capsule (40–60 mm foil sleeve). | X-01 closure profiles. |
| V-06 | all clear glass / PET with labels (BOSTON_ROUND, JAR_GLASS_*, JAR_PICKLE, BTL_GLASS_OIL_*, PET_WATER_*) | medium | The **back of the label** shows the artwork **mirrored through the glass** ("ABJƎ" in back views). A paper / white BOPP label's adhesive side is white (or the bottle colour for clear labels). | Self-adhesive label: printed face out, white liner side in. | `components/three/vessels/materials.ts · createLabelMaterial`: `side: FrontSide`, and add a second label mesh (back-face, `MeshStandardMaterial #f2f2ee`, offset −0.05 mm) unless stock is `CLEAR_BOPP` / `PETG_SHRINK`. |
| V-07 | BTL_PET_WATER_COOLER_19L | low | Brim volume 22.6 L vs 18.9 L nominal (1.19): body too cylindrical, no grip ring / ribs. | 5-gal PC/PET: ribbed body, Ø270 × 490. | `models/plastic.ts` cooler profile: add 3 ribs (−6 mm) and reduce body radius 4 mm. |
| V-08 | BTL_PET_CSD | low | Round base: no petaloid feet. | CSD PET bottles: 5-foot petaloid base. | Lathe cannot: add a 5-lobe base cap mesh. |
| V-09 | SQUEEZE_TUBE, BTL_PET_JUICE, BTL_PET_SPORTS | low | Front copy cut by the silhouette at the default view (X-07). | — | X-07 (vessel `DEFAULT_VIEW.theta`). |
| V-10 | WIDE_JAR, ROUND_TIN, TUB_PP_*, PAIL_PP_ROUND, CAN, ROUND_BOTTLE, PUMP_BOTTLE, DROPPER_BOTTLE, STAND_UP_POUCH | — | Read to life: 330 ml can necked end + tab, tubs' taper and rim, pump/dropper closures. | — | — |

## 12. Containers — cosmetic, pharma, cans, tins, cups, tubes (37) — `src/lib/vessels/families/cosmetic-cans`

Contact sheets: `vessels-cosmetic-cans-01..03.jpg`.

| ID | Model | Sev | Finding | Real-world reference | Fix |
|---|---|---|---|---|---|
| V-11 | TIN-GIFT-SQUARE, TIN-TEA-CADDY | **critical** | Square tins get a **round lid**: a white disc floats inside the square body (top view: circle in a square). | Square tin: square slip/plug lid with rounded corners matching the body. | `families/cosmetic-cans/geometry.ts`: lid section must reuse the body `section` (square, corner radius); `components/three/vessels/closures.ts · SLIP_LID/PLUG_LID` build from `profile.section` instead of a lathe disc. |
| V-12 | TRAY-PUNNET, TRAY-CLAMSHELL, TUB-ICE-RECT | **critical** | Rectangular trays (187 × 137, 150 × 150, 165 × 115) render with a **round** lid / film, and the punnet body reads round in iso. | PET punnet: rectangular with top-seal film; clamshell: hinged rectangular lid. | Same as V-11 for `LUG_LID`-core lids on non-round sections; `TOP_SEAL_FILM` should be a flat film on the rim polygon, `HINGED_LID` a mirrored tray on a hinge. |
| V-13 | TIN-GIFT-ROUND, TIN-GIFT-SQUARE, TIN-TEA-CADDY, CAN-SARDINE, CAN-OVAL-FISH, CAN-FOOD-3PC (ends) | high | **Tinplate reads as black lacquer**: metalness 1 under the dim vessel environment (same cause as FN-01). | Tinplate: bright silvery, slightly warm. | `vessels/materials.ts · TINPLATE`: `roughness 0.18 → 0.28`, `envMapIntensity 1.25 → 1.8`; vessel `Environment` add a broad front fill `Lightformer` (intensity 0.8, scale 10 × 3) like `StudioLights`. |
| V-14 | COS-COMPACT | high | Default `ABS_BLACK` compact renders **white/silver** (`ABS_BLACK → HDPE_WHITE`). | Black ABS compact. | `src/lib/library/vessels.ts · COS_MATERIAL` L181: map to a new core `ABS_BLACK` (`#151515`, roughness 0.35, clearcoat 0.6) or pass tint (X-01). Same for `PP_NATURAL`/`LDPE_NATURAL` (translucent milky, `transmission 0.3`), `ACRYLIC_CLEAR` (thick wall: `thickness 6`). |
| V-15 | COS-DEO-STICK | high | Twist-up deodorant renders as a tapered **cup with a jar lid** (`TWIST_UP → LUG_LID`, core `WIDE_JAR`). | Oval twist-up stick: oval barrel, dome cap, twist wheel at the base. | New closure `TWIST_UP` (dome cap the full barrel width) + base wheel; body section oval (`G`), no taper. |
| V-16 | CUP-ICE-PINT, CUP-YOGURT | medium | Paper ice-cream cup reads grey plastic (PE board mapped to `WHITE_POUCH`, dim). | SBS + PE pint: white, matte, rolled rim. | `COS_MATERIAL.PE_BOARD` → `HDPE_WHITE` look with `roughness 0.7`; brighter env (V-13). |
| V-17 | COS-PERFUME-ROUND, COS-AIRLESS, PH-AMPOULE | medium | Glass/airless walls too thin: brim volume 1.34× / 1.47× / 2.0× nominal; perfume reads light and cheap, ampoule body too long (no constriction ring). | Perfume flacons: 4–8 mm walls, 8–15 mm base; 2 ml ampoule Ø10.75 × 75 with stem constriction. | `definitions/cosmetic.ts` perfume `wallMm 2 → 5`, `baseMm → 12`; `pharma.ts` ampoule: add constriction at 0.55 H (r × 0.45) and shorten body to 35 mm. |
| V-18 | CAN-TUNA, CAN-FOOD-3PC | low | Easy-open end and double-seam end both render as `CAN_END` / `SLIP_LID`; peel-foil shows as a slip lid. | Peel-off foil is flat on the rim; EOE has a ring pull. | Closure variants `EOE_RING`, `PEEL_FOIL` in `closures.ts`. |
| V-19 | TUBE-LAMINATE, TUBE-ALU, TUBE-OVAL, PH-TUBE | low | Lathe tubes overstate volume 1.2–1.9× (flattened crimp not modelled in volume) — visual is fine; `TUBE-OVAL` renders round (G 24 ignored). | Oval tube: elliptical shoulder. | `geometry.ts` tube: elliptical section from `G`. |
| V-20 | COS-DROPPER, SERUM, ROLL-ON, LIPSTICK, LIP-GLOSS, MASCARA, NAIL-POLISH, JAR-DOUBLE, PH-VIAL, PH-PILL-CR, PH-EYE-DROP, CAN-BEVERAGE, CAN-PAINT, CAN-AEROSOL, CUP-DELI | — | Read to life (dropper bulb, aerosol valve cup, paint can lid ring, double-wall jar). | — | — |

## 13. Containers — flexible packs (15) — `src/lib/vessels/families/flexible`

Contact sheet: `vessels-flexible-01.jpg`. Pillow, three-side seal, quad seal, side gusset, flat-bottom (box) pouch, stick pack, sachet, flow wrap, mailer and bag-in-box render with believable seals, gussets and pillowing.

| ID | Model | Sev | Finding | Real-world reference | Fix |
|---|---|---|---|---|---|
| V-21 | FLEX_* metallised / foil laminates | medium | Every pouch reads the same dull mustard-metal: film looks semi-metallic regardless of laminate (PET/PE vs kraft vs foil); no crinkle or seal-edge highlight. | PET/PE gloss film: sharp specular, no metal; foil laminate: metal only where unprinted. | `components/three/vessels` flexible material: per laminate `metalness 0` (PET/PE, kraft), `0.9` only for MET-PET/foil; add a normal-map wrinkle (`createKraftTexture`-style procedural) at 5 % strength. |
| V-22 | FLEX_VACUUM_PACK | low | Clear film shows the artwork mirrored from the back: correct for a reverse-printed clear film, but the product inside is missing so it reads as a transparent sticker. | Vacuum pack: product visible through film. | Add a neutral product slab inside (like `fillable` liquids). |
| V-23 | FLEX_STAND_UP_POUCH vs core STAND_UP_POUCH | low | Two different pouch renderers (core lathe-kind kraft vs flexible film model) for the same product; look differs (kraft fibre vs flat film). | — | Route core `STAND_UP_POUCH` through the flexible renderer. |

### V-collapse: options that cannot change the 3D model (container → core · closure → core)

| Model | Collapsed options |
|---|---|
| BTL_GLASS_WATER | GLASS_FLINT+GLASS_COBALT→GLASS_CLEAR; ROPP_CAP+CROWN_26→SCREW_CAP |
| BTL_GLASS_JUICE | GLASS_AMBER+GLASS_GREEN→GLASS_AMBER |
| BTL_GLASS_WINE_BORDEAUX | GLASS_GREEN+GLASS_AMBER→GLASS_AMBER; NATURAL_CORK+ROPP_CAP→SCREW_CAP |
| BTL_GLASS_WINE_BURGUNDY | GLASS_GREEN+GLASS_AMBER→GLASS_AMBER; NATURAL_CORK+ROPP_CAP→SCREW_CAP |
| BTL_GLASS_WINE_HOCK | GLASS_GREEN+GLASS_AMBER→GLASS_AMBER; GLASS_FLINT+GLASS_COBALT→GLASS_CLEAR; NATURAL_CORK+ROPP_CAP→SCREW_CAP |
| BTL_GLASS_SPARKLING | SPARKLING_CORK+CROWN_29→SCREW_CAP |
| BTL_GLASS_BEER_LONGNECK | GLASS_AMBER+GLASS_GREEN→GLASS_AMBER |
| BTL_GLASS_BEER_STUBBY | GLASS_AMBER+GLASS_GREEN→GLASS_AMBER |
| BTL_GLASS_OIL_MARASCA | GLASS_GREEN+GLASS_AMBER→GLASS_AMBER; POURER_CAP+ROPP_CAP→SCREW_CAP |
| BTL_GLASS_OIL_DORICA | GLASS_GREEN+GLASS_AMBER→GLASS_AMBER; POURER_CAP+ROPP_CAP→SCREW_CAP |
| BTL_GLASS_SAUCE_WOOZY | ORIFICE_REDUCER_CAP+SCREW_CAP→SCREW_CAP |
| BTL_GLASS_SPIRITS_FLASK | ROPP_CAP+BAR_TOP→SCREW_CAP |
| BTL_GLASS_PHARMA_SYRUP | ROPP_CAP+CHILD_RESISTANT_CAP→SCREW_CAP |
| BTL_PET_WATER_EG | PET_CLEAR+PET_BLUE→PET_CLEAR |
| BTL_PET_WATER_JUG_5L | PET_CLEAR+PET_BLUE→PET_CLEAR |
| BTL_PET_WATER_COOLER_19L | PET_BLUE+PET_CLEAR→PET_CLEAR |
| BTL_PET_CSD | PET_CLEAR+PET_BLUE→PET_CLEAR |
| BTL_HDPE_SHAMPOO_OVAL | HDPE_WHITE+HDPE_COLOURED→HDPE_WHITE |
| BTL_HDPE_DETERGENT_HANDLE | HDPE_WHITE+HDPE_COLOURED+HDPE_NATURAL→HDPE_WHITE; MEASURE_CAP+SCREW_CAP_TE→SCREW_CAP |
| BTL_HDPE_MOTOR_OIL | HDPE_COLOURED+HDPE_WHITE+HDPE_NATURAL→HDPE_WHITE |
| BTL_PET_PHARMA_SYRUP | CHILD_RESISTANT_CAP+SCREW_CAP_TE→SCREW_CAP |
| BTL_PET_SPORTS | PET_CLEAR+PET_BLUE→PET_CLEAR |
| BTL_HDPE_GALLON_JUG | HDPE_NATURAL+HDPE_WHITE→HDPE_WHITE |
| JAR_GLASS_MASON | GLASS_FLINT+GLASS_COBALT→GLASS_CLEAR |
| JAR_PET_NUT_BUTTER | PET_CLEAR+PP_NATURAL→PET_CLEAR; SCREW_CAP+SCREW_CAP_TE→SCREW_CAP |
| PAIL_PP_ROUND | PP_WHITE+HDPE_WHITE→HDPE_WHITE |
| JERRYCAN_HDPE | HDPE_NATURAL+HDPE_WHITE+HDPE_COLOURED→HDPE_WHITE; VENTED_SCREW_CAP+SCREW_CAP_TE→SCREW_CAP |
| COS-DROPPER | DROPPER+TREATMENT_PUMP→DROPPER |
| COS-SERUM | TREATMENT_PUMP+DROPPER→DROPPER |
| COS-AIRLESS | PP_WHITE+PP_NATURAL→HDPE_WHITE |
| COS-PERFUME-ROUND | MIST_PUMP_COLLAR+MIST_PUMP→MIST_PUMP |
| COS-PERFUME-OVAL | MIST_PUMP_COLLAR+MIST_PUMP→MIST_PUMP |
| COS-DEO-STICK | PP_WHITE+PP_NATURAL→HDPE_WHITE |
| COS-COMPACT | ABS_BLACK+PP_WHITE→HDPE_WHITE |
| PH-PILL-CR | HDPE_WHITE+HDPE_NATURAL→HDPE_WHITE; CHILD_RESISTANT_CAP+SCREW_CAP→SCREW_CAP |
| PH-EYE-DROP | LDPE_NATURAL+LDPE_WHITE→HDPE_WHITE |
| CAN-FOOD-3PC | DOUBLE_SEAM_END+EASY_OPEN_END→CAN_END |
| CAN-TUNA | EASY_OPEN_END+PEEL_FOIL→SLIP_LID |
| TIN-TEA-CADDY | PLUG_LID+SLIP_LID→SLIP_LID |
| CUP-YOGURT | PP_WHITE+PS_WHITE→HDPE_WHITE; PEEL_FOIL+SNAP_LID→LUG_LID |
| CUP-DELI | PP_CLEAR+RPET_CLEAR→PET_CLEAR |
| TRAY-CLAMSHELL | APET_CLEAR+RPET_CLEAR→PET_CLEAR |
| TRAY-PUNNET | RPET_CLEAR+APET_CLEAR→PET_CLEAR; TOP_SEAL_FILM+HINGED_LID→LUG_LID |
| TUBE-LAMINATE | LAMINATE_PBL+LAMINATE_ABL→PE_TUBE_WHITE |
| TUBE-OVAL | PE_TUBE_WHITE+LAMINATE_PBL→PE_TUBE_WHITE |
