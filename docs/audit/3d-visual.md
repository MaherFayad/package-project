# 3D visual audit — every packaging model (baseline, report only)

Key: `3d-visual` · Branch: `claude/exciting-albattani-8kzgsu-audit-3d-visual` · Base: head of `claude/exciting-albattani-8kzgsu`.
This round changes **no source**. Every finding below carries a precise fix for the next round (file, function, values).

## Method

Re-verified on the merged base `36ab41f` (designer model picker): its 3D code (`src/components/three`, `src/lib/dieline`, `src/lib/vessels`, `src/lib/library`) is byte-identical to the audited snapshot, and spot-checks in the real designer `/en/design/<slug>` reproduce F02-01 (FEFCO 0226 not closed) and V-11 (square tin, round lid); see `designer-spotcheck.png`.

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
2. **F35-01** FEFCO_0322 tray + lid fail to assemble at shallow sizes (default 300×220×80) → `fefco-03-05/generators.ts` end-wall folds + lid `assembly.matrix`.
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
| F35-01 | FEFCO_0322 | **critical** | "Closed" shows the friction-lock tray and lid **not assembled** at the model's default size (300 × 220 × 80): lid floats above the tray, both double end walls stay open/unfolded, the tray is a three-sided U. Re-checked in the real designer (`/en/design/fefco-0322-friction-lock-set`, merged base 36ab41f): it assembles at the "Shoe box" preset 330 × 210 × 120, so the failure is **size-dependent** (shallow H, likely the rolled end wall depth > H). | FEFCO 0322: tray + lid, each with rolled double end walls that friction-lock into the side walls. | `families/fefco-03-05/generators.ts` 0322: end-wall panels lack `foldAngleClosed` (or have `foldStage` beyond `maxStage`); lid `assembly.matrix` must translate the lid to `y = H − lidDepth` over the tray. Add a unit test `computePoses(d,1)` bbox ≈ outer dims. |
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

---

## Round 5 — 3D QA of every model (key `3d-visual`, ids `R5-3Q-`)

Branch `claude/exciting-albattani-8kzgsu-r5-3dqa`, base `4c11648`. Scope: model geometry, UV / face mapping and material definitions in the generators and packs (`src/lib/dieline/**`, `src/lib/library/**`, and the container model definitions in `src/lib/vessels/**`). The engine mount, renderer, scheduling and Stage3D / Scene3D / VesselView (`src/components/**`) were not touched (r4-3d session); defects that can only be fixed there are open rows with a precise fix.

### Method

| Step | Tool (`docs/audit/tools/`) | What it gives |
|---|---|---|
| Variants | `r5-variants.ts` | **2 098 DesignDocs** for the 370 library models: default, smallest and largest size the generator builds (searched from the limits toward the default), every supported feature (window per face, handle, thumb notch, tear strip, 2 × 3 partitions, display front, lid height), one other board shown blank (kraft / white / caliper), every other container, every other closure, every flexible option. Each doc carries the **face test pattern** (face colour + name + ▲ up arrow), so mirrored, upside-down, stretched or misplaced artwork and unprinted flaps show at once. |
| Capture | `r5-capture.cjs` | The **real editor**, production build (`next build && next start`, `ELBA_DEV_PAGES=1`): each doc goes into the browser autosave and opens with `?resume=1`, the path a returning user takes. 1440 × 900 hero for every variant; for the default also back + underside, half fold, flat, the 2D **Dieline view** (boxes) / back, top, open closure (containers); 390 × 844 hero for default, min and max. The 40 catalogue-only models through `/en/dev/catalogue/<code>`. Reduced motion, 1x DPR, SwiftShader. |
| Review | `r5-review.py`, `r5-sheets.py` | Per-model labelled grids (5 columns) for close inspection plus full-resolution crops; contact sheets per family. |
| Numbers | `r5-geometry.ts`, `r5-option-collapse.ts` | z-fight / interpenetration / outer-vs-inner over **every box variant** (sizes, features, boards); container and closure options whose core + tint + closure style are identical (cannot change the 3D). |
| People | 7 reviewers in parallel by family (A core + FEFCO 02, B FEFCO 03/05 + 06/07, C FEFCO 04, D ECMA + food service, E rigid / tubes / FEFCO 09 / catalogue, F core containers + bottles, G cosmetic / cans + flexible), each reviewing every model in every variant and view as a packaging engineer and a product designer, fixing in its family generator and verifying on a dev server. |

Severity as in the rest of this file: critical = the model is not the product it claims or the option is broken; high = clearly wrong to a packaging buyer, or an option that silently does nothing; medium = noticeable realism / polish defect; low = nitpick.

### Counts (new round 5 findings, before fixing)

The Dieline-view stretch was found by four reviewers (A-10, B-07, C-06, D-04) and is counted once.

| Severity | Found | Fixed | Open |
|---|---:|---:|---:|
| critical | 2 (F-01 closures never styled, G-22 clear-film product) | 2 | 0 |
| high | 31 | 24 | 7 (A-10 Dieline view; F-06 swing top, F-07 measuring cup, G-06 mist collar, G-07 CR cap, G-21 flexible window, G-25 lid colour — all engine / designer) |
| medium | 41 | 31 | 10 (A-03, F-08, F-09, F-11, F-12, F-19, G-10, G-11, G-28, E-06 — engine / designer / catalogue / shared) |
| low | 20 | 5 | 15 |
| **total** | **94** | **62** | **32** |

Reopened older rows: 3d-visual V-05 / 3d-engine E-39 / 3d-bottles B-02 (as F-01, fixed), 3d-ecma O-03 (as D-05, fixed), 3d-ecma O-09 (as D-04, root-caused, open), 3d-bottles E-07 (partly, as F-12, open), TK-04 and 3d-rigid-food FR-06 / E-02 (open, engine). Holds: F35-01, F02-01, F04-01…15, R4-01 / R4-12 section-following lids, R4-14.
Medium-or-worse issues were found, so the rounds continue (BRIEF round 4 rule).

### Findings
### A. Core structures (13) + FEFCO 02 (24)

| id | sev | model(s) · file | finding (variant / view) | real-world reference | fix | status |
|---|---|---|---|---|---|---|
| R5-3Q-A-01 | high | RIGID_BOX (every size, worst at min) · `structures.ts · rigidBox` | Lid and base walls ran full length, so each wall end lay in the neighbour's printed face: vertical corners z-fought; white raw-board slabs at the front corners and a LEFT-colour sliver at the front-left bottom (`RIGID_BOX__min__d_hero`, `m_hero`). | A wrapped set-up box shows one continuous wrap round the corner. | Walls stop 0.1 mm (`CORNER_GAP`) short of each corner, as the family fix RF-06. | fixed, verified |
| R5-3Q-A-02 | medium | RIGID_BOX · `rigidBox` | Corner-tab hinge edges lay in the long wall's printed face: pale strip down each corner. | Corner tabs are paper under the end-wall wrap. | Tab `pivotDepth` 0.08 mm / t. | fixed, verified |
| R5-3Q-A-03 | medium | every folded box (RIGID_BOX lid rim, FEFCO_0230 / 0204 front-top fold, mailers) · **engine** `components/three/panelGeometry.ts` | At a 90° fold with pivotDepth 0 each panel's crease side face lies in the other panel's printed face: a caliper-wide band of flickering crease colour along every fold rim (the "ragged lid edge"). Found again independently by reviewer C on B flute. | A fold shows no flicker. | Skip the crease side face on non-roll hinge edges folded 90° ± 30° with pivotDepth 0, on parent and child; the t × t corner is closed by the two printed faces. | open (engine, outside scope) |
| R5-3Q-A-04 | high | PAPER_TUBE · `paperTube` | FRONT centre sat 180/N° (5.6–7.5°) left of the hero axis: FRONT off-centre, BACK colour on the right silhouette (`PAPER_TUBE__def__d_hero`). | — | Closed pose turned half a strip; lid matrix pre-multiplied by the same turn (stays concentric). FRONT mean azimuth 0.00° at D 40 / 75 / 150. | fixed, verified |
| R5-3Q-A-05 | medium | PAPER_TUBE, rolled tubes, cups, pails, cones · `dieline/generate.ts` + 7 family assemblers | Light vertical line at every facet in 3D, flat and Dieline views: bleed 0 on roll hinges clips each strip exactly at the hinge and the two anti-aliased clips leave a seam. | A composite-can label is one continuous print. | One shared `edgeBleed()` (builder.ts) replaces nine copies: roll hinges overlap 0.25 mm. | fixed (lead) |
| R5-3Q-A-06 | medium | FEFCO_0427, PIZZA, FS_PIZZA_ROUND · `trayWithLid` | Front / side walls, ears, rolled inner walls, the lid tuck and side flaps ran up into the lid board: raw-board lines across TOP (`FEFCO_0427__min__d_hero`). | FEFCO 0427: the lid closes on walls of H + t. | `lidOnWalls`: walls H − t, ears inset t, tuck and side flaps hinge from the lid underside. | fixed, verified |
| R5-3Q-A-07 | medium | FEFCO_0427, PIZZA, FEFCO_0422 · `trayWithLid` | Tray vertical corners z-fought; ear hinges lay in the front / back print. | As A-01. | `cornerGap` 0.1 mm; ears pivot 0.08 mm with a compensating stack. | fixed, verified |
| R5-3Q-A-08 | medium | FEFCO_0320, PALLET_BOX_LID · `telescope` | Lid manufacturer's joint ran 0.5–1.5 mm into the base's left wall. | Lid inner = base outer + clearance + joint. | Lid L + t, shifted −t/2. PALLET_BOX_LID test expectation updated (+t). | fixed (geometry) |
| R5-3Q-A-09 | medium | all FEFCO 02 standard-tube styles, 0225, core 0201 / 0320 · `fefco-02/kit.ts`, `styles.ts`, `slotted` | Glued joint: left-wall end and joint-flap hinge both in the FRONT print, a flickering kraft streak down the front-left corner (`FEFCO_0204__min__m_hero`). | The joint shows at most a hairline board edge. | Left wall 0.1 mm shorter; joint pivot 0.08 mm with a compensating stack. | fixed, verified |
| R5-3Q-A-10 | high | every tall sheet (SLEEVE, PAPER_TUBE, PIZZA, 0427, RIGID_BOX, 04xx, 03xx sets) · **designer** `designer.module.css · .dielineSheet / .dielineCanvas` | Dieline view: artwork canvas stretched sideways while the die SVG letterboxes, so print and die do not register (`SLEEVE__def__d_dieline`, `FEFCO_0310__def__d_dieline`, `FEFCO_0404__def__d_dieline`). Found independently by reviewers A, B (R5-3Q-B-07) and C (R5-3Q-C-06). | The dieline must register exactly with the print. | `.dielineCanvas { object-fit: contain; }` or size `.dielineSheet` by `min(width, height × ratio)`. | open (designer, outside scope) |
| R5-3Q-A-11 | low | GABLE_BOX min, FEFCO_0217 | FRONT face is wall + roof, so a centred label straddles the roof crease at small sizes. | Gable boxes print continuously over the roof. | None: by design. | not a defect |
| R5-3Q-A-12 | low | FEFCO_0230 · `fefco-02/styles.ts` | Back overlap top flap sits one layer proud, a ridge across the back of TOP. | Check against the FEFCO drawing. | — | open (unverified) |
| R5-3Q-A-13 | low | RIGID_BOX, SBS cartons | LEFT face reads washed-out in the back view. | — | Engine lighting. | open |
| 3d-visual X-07 | low | PAPER_TUBE · engine `PackagingScene.tsx` | 32° hero still puts a wide FRONT label on the silhouette. | — | Per-cylinder default azimuth ~18°. | open (engine) |

### B. FEFCO 03 / 05 (32) + FEFCO 06 / 07 (33)

| id | sev | model(s) · file | finding | real-world reference | fix | status |
|---|---|---|---|---|---|---|
| R5-3Q-B-01 | high | FEFCO_0700, 0701, 0703, 0711–0717 · `fefco-06-07/group07.ts` | Crash-lock bottoms printed only the outer front lock flap: back lock flap and glue-assist flaps bare kraft over half the underside (`FEFCO_0700__def__d_back`); on 0714 (crash-lock lid) half the TOP was bare board in the hero (`FEFCO_0714__def__d_hero`). | Auto-bottom case: every visible flap belongs to the printed face. | `deepEnds` bottom (and top for the telescope). New test. | fixed, verified |
| R5-3Q-B-02 | medium | FEFCO_0350 · `fefco-03-05/generators.ts` | Octabin flap bottom: six of eight flaps bare (`FEFCO_0350__def__d_back`). | — | `composeFaces(octFaces, deepEnds(["bottom"]))`. New test. | fixed, verified |
| R5-3Q-B-03 | medium | FEFCO_0303, 0308 · `kit.ts` | Overlapping web-corner gussets picked by `sy` only: on long walls the offset hit the other wall, ~20 000 mm² coplanar z-fight at 150×120×100. | Overlapping web corners lie one on the other. | Pick by `sy` on end walls, `sx` on long walls. | fixed (numeric + test) |
| R5-3Q-B-04 | medium | FEFCO_0308, 0309 · `kit.ts` | Full-depth lid option: lid's overlapping gussets pierced the base walls by 1–1.5 mm. | Lid inner = base outer + all lid inside layers. | `tray()` adds the two layers. | fixed (numeric + test) |
| R5-3Q-B-05 | medium | FEFCO_0303, 0304, 0308, 0309 · `definitions.ts` | Limits allowed H > wall length: gussets ran past the far corner. | Web-corner trays need walls ≥ H. | `LIMITS.gussetTray`: H ≤ W, H ≤ L (defaults and presets still valid). | fixed |
| R5-3Q-B-06 | low | FEFCO_0307 · `kit.ts` | Tall short sizes: the two locking noses of one wall met and z-fought. | — | d + nose ≤ 0.48 of the wall. | fixed |
| R5-3Q-B-07 (dup of A-10, not counted) | high | all multi-piece 03/05 sets | Dieline view misregistration: same cause as R5-3Q-A-10. | — | See A-10. | open (designer) |
| R4-08 (re-check) | low | FEFCO_0321, 0325, 0504 · `generators.ts` | Joint inside the lid / sleeve still 0.5 mm (E) / 1.5 mm (B) into the neighbour. | Lid = base outer + 2t + joint. | Family sizing +2t on lid / sleeve (shared kit joint untouched). | fixed |

Holds: F35-01 (no lid, cap or sleeve apart or floating at any size, lid depth or board).

### C. FEFCO 04 (80)

| id | sev | model(s) · file | finding | real-world reference | fix | status |
|---|---|---|---|---|---|---|
| R5-3Q-C-01 | medium | 70 styles with ears, lid tucks, side flaps, overlap covers, wraps, octagon · `build.ts`, `wraps.ts`, `octagon.ts` | Folded-in flaps started at the parent's printed face, so their cut edge ran through the board and z-fought on the print: kraft strips on TOP / FRONT (`FEFCO_0420__min__d_hero`, `FEFCO_0406__min__d_hero`, `FEFCO_0421__def__d_hero`); 0404 / 0406 glue-flap end on the end flaps; 0459 ear feet on BOTTOM. | Folded-in flaps start at the parent's inside face. | Inward 90° folds pivot on the parent's inside face; wrap end flaps one caliper shorter; octagon ear hinge one caliper up. New test "no cut edge on a printed face" (80; 69 fail without the fix). | fixed, verified |
| R5-3Q-C-02 | high | 18 double-front styles with thumb notch (0423 … 0471a) · `kit.ts`, `build.ts` | Thumb-notch option had almost no visible effect: the rolled inner wall filled the notch; a crease ran across the hole (`FEFCO_0437__notch__d_hero`). | One die cut through both layers. | Notch on the inner wall's roll edge too; creases clipped to where both panels have board. | fixed (0437 seen, 17 numeric) |
| R5-3Q-C-03 | high | 0421, 0421_1, 0421a, 0426a, 0427_1, 0428, 0428a, 0429, 0429a, 0470, 0471 · `kit.ts` | Rolled wall tops ran into the lid board: a strip 3–4.5 mm in from the TOP edges. | The lid rests on the rolled walls. | Double walls under a lid stop at H + t. | fixed, verified |
| R5-3Q-C-04 | medium | 15 styles with ears + hand holes · `kit.ts` | Ears ran ~6 mm into each side of the hand hole (much more at min) (`FEFCO_0430__min__d_hero`). | A hand hole is a clear opening. | Ears stop 4 mm short of the hole. | fixed (numeric) |
| R5-3Q-C-05 | medium | 0423a, 0423_1a · `kit.ts` | Full-height end-wall ears stood ~12 cm² above the display cut-down (`FEFCO_0423a__def__d_hero`). | Ears stay behind board. | Ears below the cut-down. | fixed, verified |
| R5-3Q-C-06 (dup of A-10, not counted) | low | Dieline view | Same as A-10. | — | — | open (designer) |
| R5-3Q-C-07 | low | display fronts 0422a, 0423a, 0424a, 0435*, 0449, 0472 | Front face / safe zone include the cut-away, so centred artwork falls into the opening. | — | Lower-band `safeZones` for the front. | open |
| R5-3Q-C-08 | low | 0435, 0435a, 0449 header; 0459 corner walls | No printable face for the header inside / chamfered walls: plain board. | — | — | open |

Holds: F04-01…15; mailer tucks inside every front layer; trays at 90°.

### F. Core containers (10) + bottles, jars, tubs (34)

| id | sev | model(s) · file | finding | real-world reference | fix | status |
|---|---|---|---|---|---|---|
| R5-3Q-F-01 (reopens 3d-visual V-05, 3d-engine E-39, 3d-bottles B-02) | critical | 13 glass models with crown 26 / 29, ROPP, pourer, natural or sparkling cork · `bottles/closures.ts`, `packs/vessel-bottles.ts` | None of the closure styles was ever drawn: they ride on core LUG_LID, which `buildClosure` refuses to style, so crown, ROPP, capsule, hood and pourer were all one white lug lid (`BTL_GLASS_WATER__k-CROWN_26__d_hero` = def). | ISO 12821 crown; CETIE ROPP; 40–60 mm capsule; foil hood + wire. | Core SCREW_CAP for these closures; test builds every styled option with the real `buildClosure` and asserts it differs from the plain core. | fixed, verified |
| R5-3Q-F-02 | medium | WINE_BORDEAUX / BURGUNDY / HOCK (ROPP) · pack | With F-01 a wine ROPP would draw an 18 mm skirt on a 60 mm BVS 30H60 finish. | Stelvin shell ~60 mm. | BVS models keep the smooth 60 mm metal shell. | fixed (engine half open: ROPP `yb = top − max(18, finishH)`) |
| R5-3Q-F-03 | high | SPARKLING, BORDEAUX; BURGUNDY / HOCK NECK option · `bottles/builder.ts`, `models/glass.ts` | Sparkling neck label stuck through the foil hood; Bordeaux neck label under the capsule; Burgundy / Hock NECK option did nothing. | Neck label sits below the capsule. | `neckSleeveMm(finish)`; neck zone ends 3 mm under it or is dropped; NECK removed where no straight neck is left. | fixed, verified |
| R5-3Q-F-04 | high | every GLASS_GREEN / GLASS_COBALT option · `bottles/materials.ts` | Green read pale mint, cobalt pale lavender, close to flint. | Antique green / cobalt glass. | Dense base (GLASS_AMBER core) with the option's tint. | fixed, verified (cobalt still a little light on white) |
| R5-3Q-F-05 | medium | DETERGENT_HANDLE, GALLON_JUG · `builder.ts · handleFor` | Handle ran across the BACK label. | Handle sits above / beside the label. | Lower handle end above the label top. | fixed, verified |
| R5-3Q-F-06 | high | GLASS_WATER, BEER_STUBBY (SWING_TOP) · engine `closures.ts` | Swing-top renders as the plain lug lid: no stopper, gasket or wire bail. | Ceramic / PP stopper, rubber ring, wire bail. | Add a SWING_TOP style (dome stopper, red ring, two wire loops to a neck ring), then core SCREW_CAP + style in the pack. | open (engine) |
| R5-3Q-F-07 | high | DETERGENT_HANDLE (default MEASURE_CAP) · engine | Measuring cup = small 38 mm screw cap. | Ø 55–65 mm, 30–35 mm cup. | MEASURE_CUP style (r = finishR + 7, top − 12 … top + 32). | open (engine) |
| R5-3Q-F-08 | medium | SHAMPOO_OVAL (FLIP_TOP) · engine | Flip-top = screw cap. | 24/410 flip-top with hinge and notch. | FLIP_TOP_CAP style. | open (engine) |
| R5-3Q-F-09 | medium | PET / GLASS PHARMA_SYRUP (CR cap) · engine | CR cap = screw cap. | ISO 8317 double shell, taller, wider. | `screwCap(p, { extraR: 2.5, extraTop: 2 })`. | open (engine) |
| R5-3Q-F-10 | low | NUT_BUTTER, JERRYCAN, SAUCE_WOOZY · engine | TE / vented / reducer pairs identical (largely true to life; TE band missing). | TE band under the skirt. | `screwCap` TE ring option. | open |
| R5-3Q-F-11 | medium | SPIRITS_FLASK (BAR_TOP) · engine | Bar-top renders as a ribbed screw cap. | T-cork head Ø 30, 16 mm. | BAR_TOP style. | open (engine) |
| R5-3Q-F-12 (reopens 3d-bottles E-07 partly) | medium | WATER, BEER_STUBBY, FLASK, BURGUNDY · library types / designer | Choosing a closure does not change the neck finish: crown on a PP28 thread, swing-top on a crown bead. | Neck finish matches the closure. | `describe(…, closure)` → `profileFor(def, dims, finishFor(closure))`, or switch preset by `closureFits`. | open |
| R5-3Q-F-13 | low | metal closure styles · designer | Crowns / capsules take closureColor WHITE. | Gold / silver crowns, foil capsules. | Default a metal closure colour for capMetal styles. | open |
| R5-3Q-F-14 | low | SQUEEZE_TUBE · engine `closures.ts` | FLIP_TOP and SCREW_TUBE_CAP share one branch. | — | Separate geometry. | open (engine) |
| R5-3Q-F-15 | low | wine corks · engine | CORK_CAPSULE fixed 48 mm ignores finishH. | — | `neckSleeve(p, max(finishH, 30))`. | open (engine) |

### G. Cosmetic, pharma, cans, cups, tubes (37) + flexible (15) — pass 1

| id | sev | model(s) · file | finding | real-world reference | fix | status |
|---|---|---|---|---|---|---|
| R5-3Q-G-01 | high | COS-SERUM (default), COS-DROPPER · `packs/vessel-cosmetic.ts` | TREATMENT_PUMP drew a rubber bulb and glass pipette. | Treatment pump on a screw collar. | `COS_CLOSURE_CORE`: → LOTION_PUMP. | fixed, verified |
| R5-3Q-G-02 | high | COS-LIP-GLOSS, COS-MASCARA | WAND_CAP drew a squat jar lug lid (~10 % of height). | Tall cylindrical overcap (~40 %). | Core SCREW_CAP + style BULLET_CAP. | fixed, verified (cap narrower than body: engine, open) |
| R5-3Q-G-03 | high | PH-AMPOULE | OPC break fell back to a white screw cap on the sealed tip and pushed the tip out of frame. | ISO 9187-1 ampoules are flame-sealed. | → ZIP_SEAL (no parts). | fixed, verified |
| R5-3Q-G-04 | high | CAN-AEROSOL | AEROSOL_VALVE → CAN_END drew a beverage pull tab in the valve cup. | FEA 215 valve cup + actuator. | → ZIP_SEAL; profile cup only. | fixed, verified (stem / actuator: engine, open) |
| R5-3Q-G-05 | high | COS-AIRLESS, COS-DEO-STICK, COS-MASCARA, PH-PILL-CR, PH-EYE-DROP | Natural PP / HDPE / LDPE options identical to white. | Unpigmented resin is translucent milky. | Frosted core + per-resin tint. | fixed (subtle under the label) |
| R5-3Q-G-06 | high | COS-PERFUME-ROUND / OVAL · engine | MIST_PUMP_COLLAR = MIST_PUMP (collar baked into the profile). | Metal collar over the ferrule. | `MIST_COLLAR` style; drop `collarMm` from the profile. | open (engine) |
| R5-3Q-G-07 | high | PH-PILL-CR · engine | CHILD_RESISTANT_CAP = SCREW_CAP. | ISO 8317 double shell. | `CR_CAP` style. | open (engine) |
| R5-3Q-G-08 | high | PH-VIAL | Crimp flip-off seal drew a big ribbed screw cap. | Aluminium crimp + flip-off button. | → smooth short LUG_LID. | fixed, verified (button not drawn, low open) |
| R5-3Q-G-09 | medium | COS-NAIL-POLISH | Open view showed a perfume sprayer. | Brush cap. | Style BULLET_CAP. | fixed, verified |
| R5-3Q-G-10 | medium | PH-TUBE, TUBE-ALU · engine | Piercing cap drawn as a wide flip-top. | Tall fluted cap with a spike. | `PIERCING` style. | open (engine) |
| R5-3Q-G-11 | medium | COS-JAR-DOUBLE, COS-COMPACT · engine | Double-wall cap narrower than the jar; compact lid white over a black base. | Flush cap; matching lid. | Lid radius from the outer wall; closure colour follows the container tint. | open (engine) |
| R5-3Q-G-12 | medium | all flexible · `packs/vessel-flexible.ts` | One invalid option reset every option (zipper, valve silently vanished). | — | Drop only the options the validation names, retry. | fixed |
| R5-3Q-G-13 | low | CUP-DELI, clamshell, punnet, CUP-YOGURT, TUBE-LAMINATE, TUBE-OVAL | Collapsed material pairs. | rPET has a faint grey-blue cast; PS / PP white, ABL / PBL, PE / PBL look alike. | rPET tint; others accepted as look-alikes. | partly fixed |
| R5-3Q-G-14 | low | PH-EYE-DROP · engine | Dropper-tip cap opens to a glass pipette. | LDPE nozzle + tall cap. | `DROPPER_TIP` style. | open |
| R5-3Q-G-15 | low | amber glass · engine `materials.ts` | Amber reads pale peach in the low-quality path. | Dark brown. | Opacity 0.8, `#8a4b12` on the low path. | open (may be the capture GPU) |

### D. ECMA tuck (14) + ECMA specials (20) + food service (8)

| id | sev | model(s) · file | finding | real-world reference | fix | status |
|---|---|---|---|---|---|---|
| R5-3Q-D-01 | medium | ECMA_TRAY_6C_LID (E flute, every size) · `ecma-specials/trays.ts · sixCornerTray` | Cover glue flaps cut 1 mm into the end walls (~500 mm²): overhang t + 0.5 had to hold two layers. Hidden from outside. | ECMA F20.41: glue flaps inside the side flaps, outside the end walls. | Overhang 2t + 0.5 (0.5 mm clear at t 0.4 … 3). New overlap test for every corrugated board / preset (8 fail on old code). | fixed |
| R5-3Q-D-02 | low | CONE · `shapes.ts · cone` | Mouth 0.6–0.9 mm under nominal L (24-gon sized by corner radius). | Nominal L = narrowest inner mouth. | Corner radius (L/2 + t) / cos(π/24). | fixed |
| R5-3Q-D-03 | medium | ECMA_TUCK_SNAP_LOCK · `ecma-tuck/generators.ts` | Half the 1-2-3 bottom plain board; BOTTOM artwork stopped at the lock notch (`__def__d_back`). | ECMA A55: flaps 2 and 3 both print. | `bottom_front` added to the bottom face. | fixed, verified |
| R5-3Q-D-05 (reopens 3d-ecma O-03) | medium | GABLE_CARRY_CLB, BOTTLE_BASKET_4 / 6 · `carriers.ts` | Triangular hole in the crash-lock bottom showed the unprinted glue flap (both chamfers on one corner, from core `crashLockCarton`). | ECMA A60: main flaps close flush. | Carriers build their tube from the ecma-tuck `tube` + `crashLockBottom`. | fixed (core ECMA_CLB: see R5-3Q-L-01) |
| R5-3Q-D-06 | medium | LIQUID_GABLE_TOP, LIQUID_ASEPTIC_BRICK · `liquid.ts`, `kit.ts` | Back seal flap on the underside plain board. | Printed web covers every visible flap. | `withLiftedParts` adds `bottom_back`. | fixed, verified |
| R5-3Q-D-07 | high | FS_NOODLE_PAIL · `foodservice/generators/boxes.ts` | Back closure flap (half the closed top) plain board, TOP artwork cut in half (`__def__d_hero`). | Oyster pail: all four top flaps printed. | `backFlap` in the top face. | fixed, verified |
| R5-3Q-D-08 | high | FS_SANDWICH_WEDGE · same | Back wall and base had no face at all (lid board edge 0.7t proud defeated the 0.25t face search). | Wedge back and base carry brand / ingredients. | `faceDepthTol: t`. | fixed, verified |
| R5-3Q-D-09 | high | FS_PIZZA_SLICE · same | Long side walls had no face (plain kraft in the hero); back face empty. | Side walls are the branding surface. | `faceDepthTol: t`; side walls printable right / left (`obliqueFace`). | fixed, verified |
| R5-3Q-D-04 (reopens 3d-ecma O-09; dup of A-10, not counted) | high | tuck cartons, CUP_CARRIER, DOUBLE_WALL … | Dieline view stretch, root-caused: same as R5-3Q-A-10. | — | See A-10. | open (designer) |
| R5-3Q-D-10 | low | CONE · shared `dieline/svg.ts` | ~20 "Inner wall" labels scattered along the cone arc (bbox-only label fit). | — | Also require polygon area / bbox > 0.4 or inradius > font size. | fixed (lead, R5-3Q-L-02) |
| R5-3Q-D-11 | low | all SBS models · shared `materials.ts` | SBS inside `#f0eee8` renders beige (reads as clay-back), outside barely separates from the stage. | SBS is bleached both sides. | Inside `#f3f2ef`; stage contrast is the renderer's. | fixed (lead, inside colour) / stage open |
| R5-3Q-D-12 | low | FS_CAKE_BOX_WINDOW, FS_BURGER_CLAMSHELL, FS_NOODLE_PAIL, FS_FRIES_SCOOP | No kraft-back folding board (CUK) offered. | Foodservice cartons are commonly CUK. | New board in `BOARD_SPECS` (needs pricing rate cards: business decision). | open |
| TK-04 (reopened) | low | ECMA_WINDOW_RTE, all win-* · `PackagingModel.tsx` | Window film reads as an opaque light patch. | — | As TK-04. | open (engine) |
| 3d-rigid-food FR-06 / E-02 (reopened) | medium | FS_NOODLE_PAIL · engine | No wire bail handle. | — | As E-02 (accessories `kind: "wire"`). | open (engine) |

### L. Lead (shared dieline code)

| id | sev | model(s) · file | finding | real-world reference | fix | status |
|---|---|---|---|---|---|---|
| R5-3Q-L-01 | medium | core ECMA_CLB · `structures.ts · crashLockBottom` | Both long flaps chamfered the same box corner (the back panel runs the other way), leaving a triangular hole onto the unprinted glue flap (`ECMA_CLB__def__d_back`; reviewer D found the same in the carriers). | ECMA A60: main flaps close flush. | Small 6 mm clearance chamfer, as the family `crashLockBottom` (3d-ecma E-05). | fixed |
| R5-3Q-L-02 (= D-10, not counted) | low | CONE and sliver panels · `svg.ts` | = R5-3Q-D-10. | — | Panel must fill ≥ 40 % of its bbox to carry a label. | fixed |
| R5-3Q-L-03 (harness, not counted) | — | harness | 46 docs of large shipping cases were rejected by the editor (test-pattern font > 400 pt schema cap) and showed the blank default: a harness bug, not a model defect; generator clamps now. Also the dev server shared `.next` with production and served 400s for 20 min (re-captured). | — | `r5-variants.ts` clamp; dev on `NEXT_DIST_DIR=.next-dev`. | fixed (harness) |

### E. Rigid boxes + tubes (14), FEFCO 09 fittings (36), catalogue-only models (40)

| id | sev | model(s) · file | finding | real-world reference | fix | status |
|---|---|---|---|---|---|---|
| R5-3Q-E-01 | medium | RIGID_LID_BASE, WINDOW, SHOULDER, HINGED_LID, DRAWER, BOOK_MAGNETIC · `rigid-tubes/rigid.ts`, `common.ts` | Corner tabs (and neck / sleeve glue flaps) hinged on the long wall's printed face: a white ragged board slab down every corner, worst at min (`RIGID_LID_BASE__min__d_hero`, `RIGID_SHOULDER__min__d_hero`). | A wrapped corner reads as one continuous wrap. | `tabPivot(t)` 0.08 mm, as the core fix A-02. | fixed, verified |
| R5-3Q-E-02 | medium | RIGID_DRAWER · `drawerBox` | Sleeve top's glued end lay in the LEFT sleeve wall print: a TOP-coloured line along the top-left edge. | — | Free end 0.1 mm short. | fixed |
| R5-3Q-E-03 | medium | six tray-built rigid boxes, drawer sleeve, book cover · `rigid.ts`, `common.ts` | Walls and boards hinged on the printed face: a ragged pink / white band along every lid-top edge and the drawer front (the lead's "ragged lid edge"). | — | `wallPivot(t)` 0.05 mm; boards cut by the same amount so inner / outer sizes stay exact. | fixed, verified |
| R5-3Q-E-04 | high | all six TUBE_* · `tubes.ts · halfFace` | Face mapping measured strips against the unshifted draft, so artwork landed 7 mm low: bare white board on the top 7 mm of every cap and body (a third of the cap on Ø 30); front coverage 0.91. | Composite-can labels print edge to edge. | Label top from the shifted strips. New test: every face part inside its panel, front coverage > 0.99 (fails on old code). | fixed, verified |
| R5-3Q-E-05 | medium | TUBE_WINDOW at min · `tubes.ts` | Fixed 12 mm margins left no room: the window model silently built a plain tube (option does nothing). | — | Margins min(12, 20 % of body), min window 10 mm. Test. | fixed (tests) |
| R5-3Q-E-06 | medium | catalogue FEFCO_0946, 0947, 0949, 0949A, 0973–0976 · `components/catalogue/CatalogueViewer.tsx · FittingView` | Striped z-fight on floor pads: the viewer seats the fitting at t, but the 0200 host's inner flaps reach 2t (`FEFCO_0949__def__d_hero`). | A pad rests on the inner flap layer. | `innerMin.y` = max y of the host's bottom-flap panels from `boundsAt(host, 1)`. | open (outside scope) |
| R5-3Q-E-07 | low | RIGID_HINGED_LID · fold engine | Half fold lifts the lid off instead of swinging on the back hinge. | Hinged lid rotates about the back edge. | Assembly path about the back rim. | open |
| R5-3Q-E-08 | low | FS_PULP_CUP_CARRIER_2 / 4 · `foodservice/pulp.ts` | Jagged pocket rims (144-cell grid), vertical sides without draft. | Moulded pulp: 3–5° draft, smooth pockets. | Radial pocket sampling + skirt draft. | open |
| R4-05, R4-06, 3d-fefco-06-09 FF-13 / FF-15 | — | catalogue / designer | Reproduce unchanged. | — | As before. | open (outside scope) |

### F. pass 2 (19 models not seen in pass 1, min / max of all 44)

| id | sev | model(s) · file | finding | real-world reference | fix | status |
|---|---|---|---|---|---|---|
| R5-3Q-F-16 | high | JAR_GLASS_HONEY_HEX (min: lid 1.45 × body), JAR_GLASS_JAM (1.27 ×) · `bottles/registry.ts`, `models/jars.ts`, pack | Custom sizes kept the default preset's lug finish: at min the lid overhung the glass by 5–9 mm a side (`__min__d_hero`). | Smaller jars take TO38 / TO53. | `finishForDims`: largest same-kind finish that fits; TO38 / TO53 added. | fixed, verified |
| R5-3Q-F-17 | medium | JAR_GLASS_MASON, JAR_PET_NUT_BUTTER (min D65) · `jars.ts` | Lid 1.07 × body; no smaller finish exists. | Regular-mouth mason / 70-400 jars are ≥ 70 mm. | D.min 70. | fixed, verified |
| R5-3Q-F-18 | high | WIDE_JAR (min D45, TO 63 neck) · `packs/vessel-core.ts`, `vessels/registry.ts` | Same as F-16 in the core pack. | — | Largest preset neck of the same thread ≤ D; D.min 54. | fixed, verified |
| R5-3Q-F-19 | medium | TUB_PP_TAHINI, TUB_PP_HALAWA, PAIL_PP_ROUND · `vessels/labels.ts · bandSpec` (core) + engine `labelArt.ts` | Tapered wrap label: white V-notch top and bottom of the back seam (cone wraps get no overlap). | IML / wrap labels overlap 5–8 mm. | Overlap for cone sectors in `bandSpec`; artwork into the radial bleed in the engine. | open (outside scope) |
| R5-3Q-F-20 | low | SAUCE_WOOZY, JAM, syrups · shared `common-vessel.ts` + core LIQUIDS | Hot sauce / jam / syrup all map to HIBISCUS: pink, translucent. | Hot sauce is opaque red-orange. | New core liquids HOT_SAUCE / JAM (+ engine liquid material). | open (shared + engine) |
| R5-3Q-F-21 | low | PHARMA_SYRUPs, OIL_MARASCA, SHAMPOO_OVAL, BOSTON_ROUND at min D | Cap 0.8–0.9 × body: reads as a jar. | 30–60 ml syrups use 18–20 mm necks. | Add PP18 / F20-410 finishes; let `finishForDims` switch narrow necks. | open |

### G. pass 2 (34 models not seen in pass 1, min / max of all 52, every flexible option)

| id | sev | model(s) · file | finding | real-world reference | fix | status |
|---|---|---|---|---|---|---|
| R5-3Q-G-16 | high | COS-LIPSTICK (+ DEO-STICK) · `cosmetic-cans/geometry.ts · caseShape` | Case top flush with the bullet-cap top: brushed metal disc / black ring z-fighting through the cap (`COS-LIPSTICK__def__d_hero`, `c-ABS_BLACK`). | Inner sleeve sits inside the overcap. | Case above the groove becomes a sleeve stepped in 0.7 mm, stops under the cap. Test. | fixed, verified |
| R5-3Q-G-17 | high | CUP-ICE-PINT, CUP-DELI (default) · pack | LID print sat under the domed snap lid: only a red ring showed. | Snap-lid art is on the crown. | Lid disc on the crown for snap-lid-only cups. | fixed, verified |
| R5-3Q-G-18 | high | COS-ROLL-ON, DROPPER, PH-VIAL, PH-PILL-CR, COS-JAR-DOUBLE, LIP-GLOSS (min) · `cosmetic-cans/index.ts`, definitions, pack | Custom sizes kept the default neck: closures much wider than the bottle (`__min__d_hero`); some min limits broke the family's own neck rule. | Every finish needs a wider body. | `neckFor()`; D min raised (dropper 18.5, roll-on 18, lip gloss 14, vial 16 / ISO 2R, pill 40, jar 42, beverage 53). | fixed (vial seen, others numeric) |
| R5-3Q-G-19 | high | CAN-BEVERAGE (min) · `geometry.ts · bevcan` | 202 end on a Ø 50 body flared the neck outwards. | Necked-in two-piece can. | `Rs = min(neck/2 + 1.2, R − 0.3)` + D min. | fixed (numeric) |
| R5-3Q-G-20 | medium | CAN-FOOD-3PC · pack | Open view swung a hidden pull tab out of the seamed end. | A double-seamed end does not open. | → no-part core; end panel in the profile. | fixed, verified |
| R5-3Q-G-21 | high | every flexible model, o-window · engine flexible view | Window option draws nothing: `windowUv` is never used in `src/components` (o-window = def). | An unprinted window shows the product. | Front material `alphaMap` from `windowUv`, show the product part. | open (engine) |
| R5-3Q-G-22 | critical | every flexible model on FILM_CLEAR · `flexible/geometry.ts · productParts` | Product ran to the seals as an open sheet, brown teeth through the crimp (`FLEX_STAND_UP_POUCH__c-FILM_CLEAR`, `FLEX_SACHET__c-FILM_CLEAR`). | Product settles below the zipper / header. | Product clipped below the zipper / above the bottom seal / off the ends, top closed. | fixed, verified |
| R5-3Q-G-23 | high | FLEX_PILLOW_BAG o-hangHole · `finParts` | Back fin ran across the hang hole: printed strip in the slot. | The punch goes through every ply. | Fin stops 0.6 mm under the hole. | fixed, verified |
| R5-3Q-G-24 | medium | FLEX_MAILER_BAG · `flexible/materials.ts` | Adhesive flap a dark grey band. | Siliconised release liner is off-white. | `#efede6`. | fixed, verified |
| R5-3Q-G-25 | high | CUP-YOGURT snap lid, TRAY-CLAMSHELL, CUP-DELI, TRAY-PUNNET, TIN-GIFT-*, COS-COMPACT · `VesselView` + shared `common-vessel.ts` | Lids and films take the default WHITE closure colour: opaque white lid on a clear APET clamshell / PP deli pot, white lids on tinplate. Yogurt snap-lid option hides the lid print (describe never gets the closure). | A clamshell is one clear piece; tin lids are tinplate. | Mouth-style / slip lids default to the container material and tint; pass the closure to `describeVesselModel`. | open (engine / shared) |
| R5-3Q-G-26 | medium | CAN-PAINT ≥ 1 l · `definitions/cans.ts`, `geometry.ts`, `types.ts` | No wire handle although promised from 1 l. | Paint tin bail in side ears. | `bailFromD: 100`, bail folded over the back. | fixed, verified |
| R5-3Q-G-27 | medium | QUAD_SEAL, SIDE_GUSSET, FLAT_BOTTOM, STAND_UP (valve) · `featureParts` | Valve fixed 45 mm below the top: under the seal on large bags. | ~1/5 down (1 kg ≈ 70 mm). | `max(45, 0.2 × faceH)`. | fixed (code) |
| R5-3Q-G-28 | medium | COS-PERFUME-OVAL, FLEX_STICK_PACK, TUBE-*, CUP-DELI lid · designer Dieline view | Dieline view draws the art at a different width from the trim box (stick pack ~3× its 17 mm panel). | — | Size the raster to `trimWidthMm` / `trimHeightMm` (same root as A-10). | open (designer) |

### Models whose geometry changed deliberately (geometry snapshot re-recorded for exactly these 146 keys)

Core FEFCO_0427, FEFCO_0201, PIZZA, FEFCO_0320, FEFCO_0422, ECMA_CLB, PAPER_TUBE, RIGID_BOX (and their `+features` keys) · FEFCO 02: 0200, 0202–0212, 0214–0218, 0225–0227, 0229 · FEFCO 03/05: 0321, 0325, 0350, 0504 · FEFCO 06/07: 0700, 0701, 0703, 0711–0717 · FEFCO 04: 70 styles (0401–0404, 0406, 0409–0413, 0415–0416a, 0420–0423_1a, 0425–0437_1, 0440–0447, 0449–0460, 0470, 0471) · ECMA / food service: ECMA_TUCK_SNAP_LOCK, ECMA_TRAY_6C_LID, CONE, GABLE_CARRY_CLB, BOTTLE_BASKET_4 / 6, LIQUID_GABLE_TOP, LIQUID_ASEPTIC_BRICK, FS_NOODLE_PAIL, FS_SANDWICH_WEDGE, FS_PIZZA_SLICE, FS_PIZZA_ROUND (core pizza) · rigid / tubes: RIGID_LID_BASE, RIGID_SHOULDER, RIGID_BOOK_MAGNETIC, RIGID_DRAWER, RIGID_HINGED_LID, RIGID_WINDOW, TUBE_LID_BASE, TUBE_ROLLED_EDGE, TUBE_TELESCOPING, TUBE_PUSH_UP, TUBE_WINDOW, TUBE_SHOULDER, PALLET_BOX (core slotted). Every other key is byte-identical.
Containers (no snapshot): WINE_BORDEAUX / BURGUNDY / HOCK, SPARKLING (neck zone), DETERGENT_HANDLE, GALLON_JUG (handle), HONEY_HEX, JAM, MASON, NUT_BUTTER, WIDE_JAR (neck fit / D min), COS-LIPSTICK, COS-DEO-STICK, CAN-BEVERAGE, CAN-PAINT, COS-DROPPER, COS-ROLL-ON, COS-LIP-GLOSS, PH-VIAL, PH-PILL-CR, COS-JAR-DOUBLE (neck fit / D min), all 15 FLEX_* (product clip, fin at hang hole, valve). Option metadata only (closure core / style / tint): 13 styled glass closures, green / cobalt glass, cosmetic closures and natural resins.
Size rules tightened (a buyer can no longer enter a size the real construction cannot make): FEFCO 0303 / 0304 / 0308 / 0309 H ≤ W and H ≤ L; D min of the ten containers above.
`generate-library-index.ts`, `generate-order-mode-table.ts`, `generate-catalogue-rows.ts` re-run: outputs unchanged (no model added or renamed).

### Files outside scope

None in source. The fixes stay in `src/lib/dieline/**`, `src/lib/library/**` and the container model definitions in `src/lib/vessels/**` (profiles, finishes, closure tables, materials / tints, flexible film geometry), the same ownership the earlier 3D rounds used for those generators. Audit tooling: `docs/audit/tools/r5-variants.ts`, `r5-capture.cjs`, `r5-geometry.ts`, `r5-option-collapse.ts`, `r5-review.py`, `r5-sheets.py`.

### Open items for the engine / designer owners (precise fixes in the rows above)

1. **R5-3Q-A-10** (high) Dieline view: `.dielineCanvas { object-fit: contain }` in `designer.module.css` (artwork does not register with the die on every tall sheet).
2. **R5-3Q-A-03** (medium) `panelGeometry.ts`: skip the crease side face at 90° folds (flickering band along every fold rim, worst on rigid lids and B flute).
3. Missing closure styles in `three/vessels/closures.ts`: swing top (F-06), measuring cup (F-07), flip-top (F-08), CR cap (F-09, G-07), bar top (F-11), mist collar (G-06), piercing cap (G-10), dropper tip (G-14), aerosol actuator (G-04 remainder), tamper band (F-10).
4. **R5-3Q-G-21** (high) flexible window: use `windowUv` as the front `alphaMap` and show the product.
5. **R5-3Q-G-25** (high) lids / films default to the container material (clear clamshell, tinplate tin lids), and pass the closure to `describeVesselModel`.
6. **R5-3Q-F-12** closure ↔ neck finish; **F-19** cone-wrap seam overlap; **F-20** opaque sauce / jam liquids; **E-06** catalogue floor pads on the host flaps.

### Screenshots (`docs/screenshots/audit/3dqa/`, 14 MB)

- `before/<family>-NN.jpg`, `after/<family>-NN.jpg`: every model, one row each, every captured variant and view (default hero / back / half / flat / dieline / phone, min, max, features, boards, containers, closures, flexible options); catalogue-only models in `catalogue-extra-*`. "Before" = base build, "after" = this branch's production build. (The before set also has the blank / board frames; the after set skips the board-only frames.)
- `details-core.jpg`: RIGID_BOX min, PAPER_TUBE, FEFCO_0427 min, ECMA_CLB underside, before | after.
- `details-families.jpg`: 12 headline fixes before | after (0714 crash-lock lid, 0420 min, 0437 notch, crown cap, Bordeaux green glass, clear stand-up pouch, pizza slice sides, tube label coverage, hex jar lid at min, serum pump, lipstick sleeve, ampoule).

### Verification (final production build of this branch)

| Check | Result |
|---|---|
| `npm run lint`, `npm run typecheck` | clean |
| `npm test` | 92 files, **8 669 passed** (new: fefco-04 "no cut edge on a printed face" ×80, fefco-03-05 extreme-size no-clash + 0350 bottom, fefco-06-07 crash-lock flaps printed, ecma-specials corrugated overlap, rigid-tubes tube coverage + smallest window, bottles real-`buildClosure` styles + tints, cosmetic sleeve under cap) |
| geometry snapshot | re-recorded for the 146 deliberately changed keys only (listed above); every other key identical |
| `npm run build` | passes |
| `e2e/models.spec.ts --project=desktop --workers=2` | **370 passed** (26.1 min) |
| `e2e/catalogue-models.spec.ts --project=desktop --workers=2` | **18 / 18 batches passed** (13.3 min): all 410 render, non-blank, no console errors |
| Round 5 capture, every variant | before 2 098 + 40, after 1 613 + 40 (board-only frames skipped): **0 console errors** either way |
| `r5-geometry.ts` over every box variant | no new z-fight / interpenetration rows; FEFCO_0320, 0321, 0325, 0504 lid-joint rows and the ECMA_TRAY_6C_LID E-flute row gone |
| `npm run test:size` | 3D pages within budget; one non-3D page over (vendor profile, 201.7 KB): outside this scope, unchanged by this branch |

## Round 6 (engine) — the 32 open rows of round 5 (key `3d-visual`, session r6-engine)

Branch `claude/exciting-albattani-8kzgsu-r6-engine` (base `claude/exciting-albattani-8kzgsu` + the round 5 report). Scope: the engine and designer 3D parts (`src/components/three/**`, `src/components/designer/**` 3D stage, Dieline view, VesselView, ConfigPanel closure colour) plus the smallest additive changes in the packs / generators the precise fixes named.

### Method

- **Real editor, production build**, same harness as round 5 (`r5-variants.ts` → `r5-capture.cjs`, `?resume=1`): the **274 variants of the 50 affected models** (default, min, max, every container / closure / flexible option / feature), 1440 × 900 hero + back / top / open / half / flat / Dieline view, 390 × 844 phone hero for default, min and max. Captured on the base build (before) and on this branch (after; a second and third after build for the generator lows and TK-04). Catalogue-only parts (FEFCO 09 fittings, pulp carriers) through `/en/dev/catalogue/<code>` with `r6-catalogue-shot.cjs`; the base for those from a worktree of the base.
- Closure variants of the after set apply each option's new default colour, as the closure picker now does.
- Every row below was looked at before and after; contact sheets in `docs/screenshots/audit/3d-engine-r6/`.

### Counts (the 32 open rows)

| Severity | Open at round 5 | Fixed, verified | No change (cause shown) | Still open |
|---|---:|---:|---:|---:|
| high | 7 | 7 | 0 | 0 |
| medium | 10 | 10 | 0 | 0 |
| low | 15 | 11 | 1 (A-13) | 3 (A-12, C-08, D-12) |
| **total** | **32** | **28** | **1** | **3** |

Also closed: the open remainders of fixed rows (F-02 engine half, G-02 cap width, G-04 actuator, G-08 button), the duplicates of A-10 (B-07, C-06, D-04), TK-04 (reopened), and 3d-rigid-food FR-06 / E-02 (no change, see below). X-07 re-verified (the paper tube already opens at 18°). One regression of this round's own work was caught by e2e before merge and fixed (R6-01).

### Rows

| id | sev | where | fix (round 6) | status |
|---|---|---|---|---|
| R5-3Q-A-10 (+ B-07, C-06, D-04) | high | `DielineView.tsx`, `designer.module.css` | The sheet box keeps the die's aspect ratio at every viewport: width = min(room across, room down × ratio) in container units of `.dieline` (it was width 100 % + max-height 100 %, so a tall sheet lost its ratio and the canvas stretched while the SVG letterboxed). The canvas also `object-fit: contain`s like the SVG. The size legend that fell off the stage is back in view. | fixed, verified (SLEEVE, 0310, 0404, PAPER_TUBE, RIGID_BOX, ECMA_WINDOW_RTE) |
| R5-3Q-G-28 | medium | `DielineView.tsx` | Same root; the die clip now scales per axis (`c.width / sheet.width`, `c.height / sheet.height`): the raster is rounded on each axis and a 17 mm stick-pack panel drifted with one factor. | fixed, verified (perfume oval, stick pack, deli lid, tubes) |
| R5-3Q-A-03 | medium | `three/panelGeometry.ts` | No crease side face on a non-roll hinge folded 90° ± 30° about the printed face (pivotDepth 0), on parent and child: the t × t corner is closed by the two printed faces. Test: panel vertex counts per hinge + a RIGID_BOX case. | fixed, verified (RIGID_BOX lid rim, 0230, 0204, 0427 mailer, min / max, phone) |
| R5-3Q-F-06 | high | `three/vessels/closures.ts` · pack | `SWING_TOP` style: dome stopper, red rubber gasket, neck wire ring, two levers and the bail over the stopper (new `gasket` / `wire` part roles). Swing top now on a screw-cap core so the style applies. | fixed, verified (GLASS_WATER, BEER_STUBBY) |
| R5-3Q-F-07 | high | `closures.ts` | `MEASURE_CUP`: r = finishR + 7, top − 12 … top + 32, translucent PP with fill rings. | fixed, verified (DETERGENT_HANDLE) |
| R5-3Q-F-08 | medium | `closures.ts` | `FLIP_TOP_CAP`: base / lid split line, back hinge, front thumb notch. | fixed, verified (SHAMPOO_OVAL) |
| R5-3Q-F-09 / G-07 | medium / high | `closures.ts` | `CR_CAP`: `screwCap(p, { extraR: 2.5, extraTop: 2, te, 36 ribs })`, the double shell. | fixed, verified (PH-PILL-CR, PET / glass syrups) |
| R5-3Q-F-10 | low | `closures.ts` | `screwCap` TE band (break line + band) as `TE_CAP` for screw-cap-TE and vented caps. The orifice reducer stays a plain cap (it is inside: true to life). | fixed, verified (NUT_BUTTER, JERRYCAN) |
| R5-3Q-F-11 | medium | `closures.ts` | `BAR_TOP`: Ø 30 × 16 mm T-cork head on its shank. | fixed, verified (SPIRITS_FLASK) |
| R5-3Q-F-14 | low | `closures.ts` | Tube flip-top gets its own parts (hinge strap across the lid line, thumb lip); the screw tube cap keeps the slim fluted body + shoulder disc. | fixed, verified (SQUEEZE_TUBE) |
| R5-3Q-F-15 | low | `closures.ts` | Cork capsule depth from the neck: clamp(30, 0.85 × neck length, 55), no longer a fixed 48 mm onto a short shoulder. | fixed, verified (wine models) |
| R5-3Q-F-02 (engine half) | — | `closures.ts` · pack | ROPP skirt `yb = top − max(18, finishH)`; wine BVS 30H60 bottles now take the ROPP style (the LUG_LID stand-in is gone). Test: the Stelvin skirt covers finishH. | fixed, verified (BURGUNDY ROPP) |
| R5-3Q-G-06 | high | `closures.ts` · `cosmetic-cans/definitions/cosmetic.ts` | `MIST_COLLAR`: the mist pump plus a metal collar over ferrule and neck; `collarMm` dropped from the two perfume profiles, so MIST_PUMP and MIST_PUMP_COLLAR now differ. | fixed, verified (PERFUME-ROUND / OVAL) |
| R5-3Q-G-10 | medium | `closures.ts` | `PIERCING` tube style: tall slim fluted cap, spike moulded in the recessed crown. | fixed, verified (PH-TUBE, TUBE-ALU) |
| R5-3Q-G-11 | medium | `closures.ts` · pack | `DOUBLE_WALL_CAP` flush with the outer wall (body radius, not the inner pot's thread); compact lid takes the container's look (see G-25). | fixed, verified (COS-JAR-DOUBLE, COS-COMPACT) |
| R5-3Q-G-14 | low | `closures.ts` | `DROPPER_TIP`: LDPE nozzle in the neck + tall pointed cap. | fixed, verified (PH-EYE-DROP) |
| R5-3Q-G-04 / G-08 / G-02 (remainders) | — | `closures.ts` | `AEROSOL` stem + actuator with orifice on the valve cup; `CRIMP_FLIP_OFF` aluminium crimp + coloured flip-off button; `BULLET_CAP` flush with the body (max body radius). | fixed, verified |
| R5-3Q-G-21 | high | `flexible/group.ts`, `flexible/geometry.ts` | The front film gets an alpha mask from `windowUv` (window at 12 %: clear film still glosses) and the product part is drawn behind a window on opaque films too. | fixed, verified (stand-up pouch o-window) |
| R5-3Q-G-25 | high | `VesselModel.tsx`, `VesselView.tsx`, `ConfigPanel.tsx`, `lib/doc.ts`, packs | Per-option `defaultColor` on closures. New colour **"MATCH" (Same as container / مثل العبوة)**: the lid / film shell uses the container's own material and tint (alpha-blended, no second transmission pass); default for hinged / snap / plug / lever / slip lids, top-seal films and the compact lid. A new design starts with the default closure's colour; switching closure moves an unchanged colour to the new default. A raised lid (snap, plug, lever, hinged, double-wall) carries the lid label on its own top (`ClosureModel.printTopY`), so the yogurt snap-lid print is no longer hidden. | fixed, verified (clamshell, deli, punnet film, tins, compact, yogurt) |
| R5-3Q-F-13 | low | `vessel-bottles.ts` | Metal defaults: ROPP / pourer SILVER, crowns, cork capsule and sparkling hood GOLD (recolourable). | fixed, verified |
| R5-3Q-F-12 | medium | `vessel-bottles.ts`, `common-vessel.ts`, `library/doc.ts`, `ConfigPanel.tsx` | `describe(…, closure)`: the preset finish when the closure fits it, else the model's finish of the closure's kind nearest in diameter (crown bead for a crown, swing bead for a swing top). The envelope uses the chosen closure. Test added. | fixed, verified (WATER, STUBBY, FLASK) |
| R5-3Q-F-19 | medium | `vessels/labels.ts`, `vessels/types.ts`, `cosmetic-cans/surfaces.ts` | Full cone wraps run `WRAP_OVERLAP_MM` (8 mm at the big end) past the seam: `SectorGeometry.wrapAngle` = the angle once round, the flat sector is longer by the overlap, `overlapMm` set, the 3D maps only `wrapAngle`. Tests: overlap arc = 8 mm, area = frustum × overlap factor. (The small wedge still seen on the **test pattern** at the tub seam is the pattern's own white frame line on the rectangular trim edge, which the sector corner touches; real artwork with background bleed has none.) | fixed, verified |
| R5-3Q-F-20 | low | `vessels/registry.ts`, `common-vessel.ts` | New products HOT_SAUCE (opaque red-orange) and JAM (dense dark fruit); hot sauce / jam no longer map to translucent hibiscus. Syrups keep hibiscus (a reasonable cough-syrup look). | fixed, verified (SAUCE_WOOZY) |
| R5-3Q-F-21 | low | `bottles/finishes.ts`, `bottles/registry.ts`, two model files, `vessel-core.ts` | New finishes F20-410 and PP 18 ROPP; bottle necks stay under ~72 % of the body (`finishForDims`), jars / tins only switch when they would overhang. No default preset changed (checked over every preset). | fixed, verified (syrups, marasca, shampoo at min) |
| R5-3Q-G-15 | low | `vessels/materials.ts` | Alpha-blended amber glass `#8a4b12` at 0.8 (low path and thin mode): no more pale peach. | fixed, verified (glass syrup, phone) |
| R5-3Q-E-06 | medium | `catalogue/CatalogueViewer.tsx` | Fittings rest on the top of the host's bottom flaps (highest horizontal lower-half panel at the closed pose), not at t. | fixed, verified (0949, 0946, 0973) |
| R5-3Q-C-07 | low | `fefco-04/build.ts` | A cut-away face panel's safe zone is the largest rectangle its outline covers (display fronts, chamfered 0459 base). Test: every safe-zone point is on board. | fixed, verified (geometry snapshot, 10 keys) |
| R5-3Q-E-07 | low | `dieline/fold.ts`, `types.ts`, `builder.ts`, `rigid-tubes/rigid.ts` | `assembly.hinge`: the hinged lid travels to its place opened 105° about the lid's back bottom rim, then swings shut on it, instead of the lift arc. Test: lid on the hinge line from 0.85 to 0.95 progress, closed pose unchanged. (The editor's fold animation is ~0.6 s and could not be sampled frame by frame here; verified numerically.) | fixed, verified (test) |
| R5-3Q-E-08 | low | `foodservice/pulp.ts` | Pocket profile u^1.6 then a cubic rounded lip easing flat onto the rim (never past the cell's half pitch), 4° skirt draft, 1.6 mm grid within 12 000 vertices. | fixed, verified (cup carrier 2 / 4) |
| TK-04 (reopened) | low | `PackagingModel.tsx`, `finishes/finishMaterial.ts` | The inside board of a closed windowed carton is shaded (×0.58 as the fold closes; flat / half it is lit as before): the window reads into a cavity, not as an opaque light patch. The finished-board material keeps the shade. | fixed, verified (ECMA_WINDOW_RTE, FS_CAKE_BOX_WINDOW) |
| R5-3Q-A-13 | low | lighting | Looked at: the washed-out LEFT face in the back view is the gloss-laminated rigid wrap reflecting the front-left key softbox at grazing incidence; matte kraft (0204) in the same view reads correctly. Dimming the studio would undo R4-CR-10 / R4-L01. | no change (cause shown) |
| 3d-rigid-food FR-06 / E-02 | medium | FS_NOODLE_PAIL | The model is the **wire-free** pail by definition ("locks with a tab and slit instead of a wire handle"); the engine already draws wire accessories when a generator emits one. | no change (by design) |
| X-07 | low | PackagingScene | Already fixed (roll-hinged tubes open at 18°); re-verified. | verified |
| R5-3Q-A-12 | low | FEFCO_0230 | Needs the FEFCO 0230 drawing to decide whether the back overlap top flap is one layer proud; public catalogues list 0230 without the flap layout. | open (needs the drawing) |
| R5-3Q-C-08 | low | 0435 / 0435a / 0449 header inside, 0459 chamfers | A printable face there needs new face ids in the artwork model (designer data model, face editor, sheet painter); the print still reaches those panels on the sheet. | open (designer data model) |
| R5-3Q-D-12 | low | foodservice boards | A CUK board in `BOARD_SPECS` needs vendor rate cards and pricing: business decision. | open (business) |
| R6-01 (new, this round) | high | `VesselView.tsx` | The non-embedded VesselScene path still passed the raw closure colour, so "MATCH" reached `CLOSURE_COLORS` and the catalogue route crashed for CAN-PAINT, COS-COMPACT, TRAY-PUNNET (found by `catalogue-models` e2e). Both paths map MATCH; `createClosureMaterial` falls back to white for any unknown code. | fixed, verified (e2e) |
| R4-05, R4-06, FF-13 / FF-15 | — | catalogue / designer | Not part of the 32; not re-examined this round. | unchanged |

### Generator output (geometry snapshot)

Re-recorded in the same commit as the change for exactly **10 keys**, all on the `dieline` fingerprint only (poses, bounds and SVG identical): FEFCO_0422a, FEFCO_0423a, FEFCO_0423_1a, FEFCO_0424a, FEFCO_0435, FEFCO_0435a, FEFCO_0449, FEFCO_0459, FEFCO_0472 (safe zones, C-07) and RIGID_HINGED_LID (assembly hinge, E-07).

### Engine mount performance (`3d-mount-tasks.cjs`, TYPE=1, phone profile, 4× CPU)

A / B on the same container: base build and this branch served side by side, alternating runs. This container's SwiftShader numbers are noisy (the base alone ranged 56–520 ms INP).

| Page | INP base (runs) | INP branch (runs) | TBT after tap base / branch | Longest task base / branch (median) |
|---|---|---|---|---|
| `/en/design/mailer-box` (7 runs each) | 152, 72, 56, 144, 80, 104, 88 (median 88) | 152, 112, 120, 48, 24, 48, 112 (median 112) | ~1.6 s / ~1.6 s | 465 / 532 ms |
| `/en/design` + "Turn the box" (3 runs) | 320, 520, 240 | 544, 120, 224 | ~0.95 s / ~1.04 s | 381 / 418 ms |

Mailer INP stays under the 200 ms phone target on every run of both builds. The engine-mount structure is untouched: `loadEngineStack`, chunked shader warm-up and no three.js on first paint. New closure styles are built only when a container with that closure mounts. The longest mount task is ~65 ms longer in the median on the mailer, inside the run-to-run spread; it was not reproduced as a profile delta.

### Files outside the engine / designer scope (smallest additive changes the fixes named)

`src/lib/library/{types,doc}.ts`, `src/lib/library/packs/{common-vessel,vessel-bottles,vessel-cosmetic,vessel-core}.ts`, `src/lib/vessels/{labels,registry,types}.ts`, `src/lib/vessels/families/{bottles/{finishes,registry,models/glass,models/plastic},cosmetic-cans/{surfaces,definitions/cosmetic},flexible/{geometry,group}}.ts`, `src/lib/dieline/{fold,types,builder}.ts`, `src/lib/dieline/families/{fefco-04/build,rigid-tubes/rigid,foodservice/pulp}.ts`, `src/components/catalogue/CatalogueViewer.tsx`, `src/i18n/library.{en,ar}.ts` (one key: `library.colors.MATCH`).

### Screenshots (`docs/screenshots/audit/3d-engine-r6/`, jpg, before | after)

`01-dieline-view-A-10-G-28`, `02-fold-rims-A-03`, `03-closures-bottles`, `04-closures-cosmetic-pharma`, `05-lids-flexible-G-21-G-25`, `06-lows-TK-04-E-06-E-08`. Tools: `docs/audit/tools/r6-sheets.py`, `r6-catalogue-shot.cjs`, `r6-fold-frames.cjs`.

### Verification (final production build of this branch, `b4e20f0e` + this table)

| Check | Result |
|---|---|
| `npm run lint` (direct UI-kit imports rule included), `npm run typecheck` | clean |
| `npm test` | 113 files, **8 778 passed** (new: panel crease faces + RIGID_BOX square creases, every R6 bottle style draws its own part, closure ↔ neck finish, Stelvin skirt, cone-wrap overlap, display-front safe zones on board, hinged-lid swing, unknown closure colour, every pack style builds) |
| geometry snapshot | re-recorded for the 10 keys above only |
| `npm run build` | passes |
| `e2e/models.spec.ts` + `e2e/catalogue-models.spec.ts` + `e2e/designer.spec.ts`, `--workers=2` | **402 passed**, 0 failed (392 skipped: desktop-only / phone-only by design), 37.6 min; 18 / 18 catalogue batches, all models of `models.spec` |
| Hydration (`designer.spec` "hydrate without errors", `--repeat-each=16`, desktop + Pixel 5) | **32 / 32 passed** |
| Round 6 capture (274 variants, before and after) | 0 console errors in the editor captures; the catalogue-route crash (R6-01) was found by e2e and fixed |
