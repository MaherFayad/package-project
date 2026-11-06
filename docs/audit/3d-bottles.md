# 3D audit: bottles, jars, tubs, pails, jerrycans (`src/lib/vessels/families/bottles`)

Key: `3d-bottles` · Branch: `claude/exciting-albattani-8kzgsu-3d-bottles` · 34 models.
Scope: the family folder and its tests. Shared engine (`src/components/three/vessels`) and library
(`src/lib/library`) problems are described with a precise fix and left open (not edited).

## Method

- Rendered every model through the real designer path (`/en/dev/3d` library section → `DesignScene` → `VesselView` → `VesselScene`, same as `/[locale]/design/<slug>`) with Playwright + Chromium (SwiftShader WebGL): iso, back and top views, plus 2x close-ups of the closures. Opened `/en/design/glass-wine-bottle-bordeaux` and exercised Open / Close (closure animation) and options.
- Cross-checked with `docs/audit/3d-visual.md` (§11 V-01..V-10, §V-collapse) from `claude/exciting-albattani-8kzgsu-audit-3d-visual`.
- Numbers: profile ring counts / triangle budget, brim-full volume vs nominal, closure-covered height per finish.
- Contact sheets: `docs/screenshots/audit/3d-bottles/before-01..04.jpg`, `after-01..04.jpg` (iso · back · top), `before-closures.jpg` / `after-closures.jpg` (closure close-ups), `cooler-before-after.jpg`.

## Findings

Severity: critical = broken flow / data; high = clearly wrong to a packaging buyer or an option that silently does nothing; medium = noticeable realism defect; low = nitpick.

### Fixed in the family folder

| ID | Sev | Model(s) / file | Finding | Standard / reference | Fix | Status |
|---|---|---|---|---|---|---|
| B-01 | high | BTL_HDPE_SHAMPOO_OVAL (default), any model with Flip-top or Swing-top · `closures.ts` | `FLIP_TOP` / `SWING_TOP` fell back to the core `FLIP_TOP`, which is a **squeeze-tube cap drawn at y = 0**: the bottle showed a bare threaded neck and a wide band round its base (3d-visual V-03 "white slice" is this band, not a label). | 24-410 flip-top cap sits on the neck. | `coreClosure`: FLIP_TOP → `SCREW_CAP`, SWING_TOP → `LUG_LID`. Test: no closure may use core FLIP_TOP. | fixed |
| B-02 | high | Crown 26 / 29, ROPP, pourer, natural cork, sparkling cork (13 glass models) · `closures.ts`, `builder.ts` | All metal closures rendered as the **ribbed plastic screw cap**, and the crown as an 18 mm tall cap (whole finish height). (3d-visual V-05, X-01) | ISO 12821 crown: fluted steel crimp ~6 mm skirt. CETIE ROPP: smooth aluminium shell over the 18 mm finish. EN 12726 cork mouth + capsule: foil sleeve 40–60 mm down the neck. | Metal closures fall back to the smooth metal `LUG_LID`. New `closureCoverMm(finish)` sets `BottleProfile.finishH` to what the closure covers: crown 6.5 mm, swing-top head 7.5 mm, cork capsule `min(52, 0.7 × neck)` (Bordeaux 750: 52 mm; Burgundy: 34 mm), BVS 30H60: 60 mm (tall Stelvin-type shell). Open / close animation verified (capsule unscrews and lifts). | fixed |
| B-03 | high | Every model with green glass (Bordeaux, Burgundy, Sparkling default; Marasca, Dorica default; others as option) · `materials.ts` | Green glass rendered **amber**: wine and oil bottles read as beer bottles. (3d-visual V-01) | Bordeaux / Burgundy: "antique green" glass; Marasca / Dorica: green or UV-amber. | `coreMaterial` rule: never a different colour family. GLASS_GREEN → `GLASS_CLEAR` (neutral until the engine takes a tint, see E-03). | fixed (fallback); true green needs E-03 |
| B-04 | medium | BTL_PET_PHARMA_SYRUP (default) · `materials.ts` | Amber PET rendered **water clear**, so the "amber" UV-protective bottle looked like clear PET. | Ph. Eur. 3.2.1 light protection: amber. | PET_AMBER → `GLASS_AMBER` (right colour; thickness difference not visible at this scale). | fixed |
| B-05 | medium | BTL_HDPE_GALLON_JUG, JERRYCAN_HDPE (defaults), natural HDPE / PP options · `materials.ts` | Natural (translucent) HDPE and PP rendered **opaque white**, identical to white HDPE / PP: the option did nothing. | Natural HDPE dairy jugs and jerrycans are milky translucent (you see the fill line). | HDPE_NATURAL, PP_NATURAL → `GLASS_FROSTED` (milky, rough, transmissive). | fixed |
| B-06 | low | BTL_PET_WATER_COOLER_19L · `models/plastic.ts` | Body too cylindrical (brim-full 1.19 × nominal), square heel, short dome. (3d-visual V-07) | Petainer 5 gal Ø270 × 488: domed shoulder, rounded heel, stiffening hoops. | `heel 0.16 → 0.3`, `bodyTop 0.7 → 0.58`, hoops at 0.17 / 0.43 / 0.55 H, 9 mm deep, label between the first two hoops. Brim-full 1.19 → 1.14. | fixed |

### Open: shared engine or library (described, not edited)

| ID | Sev | Model(s) | Finding | Standard / reference | Fix (file · function · values) | Status |
|---|---|---|---|---|---|---|
| E-01 | high | JAR_GLASS_HONEY_HEX | Renders **round**. The family emits `bottleSection: { kind: "polygon", sides: 6 }`, but the core `CrossSection` has no polygon, so `coreSectionFor` must return round. (3d-visual V-02 suggests editing `jars.ts`; the recipe is already hexagonal.) | Hex jar 190 ml TO 58: six flats, 69 mm across corners. | `src/lib/vessels/types.ts`: add `{ kind: "polygon"; sides; cornerRatio }` to `CrossSection`. `src/components/three/vessels/geometry.ts · sectionPoint`: for polygon, call `sectionPointAtArc(bottleSection, a, p × perimeter, s)` from `families/bottles/section.ts` (already exact, with normals from neighbouring points). Then `coreSectionFor` returns it unchanged. | open |
| E-02 | high | BTL_HDPE_DETERGENT_HANDLE, BTL_HDPE_GALLON_JUG, JERRYCAN_HDPE, PAIL_PP_ROUND | **No handle** drawn; the names promise one. The family already returns `profile.handle` (centre-line path + tube radius; pail: wire bail). (3d-visual V-04) | Blow-moulded hollow handle (detergent, jug, jerrycan); UN 1H2 pail wire bail. | `vessels/VesselModel.tsx`: if `(profile as BottleProfile).handle`, add a `TubeGeometry(new CatmullRomCurve3(path), 48, tubeRadiusMm, 12)` mesh with the body material (bail: closure `body` metal material, `group: "moving"` with the lid off). ~1.2 k triangles. | open |
| E-03 | high | All tinted options: GLASS_GREEN, GLASS_COBALT, PET_BLUE, HDPE_COLOURED (BTL_HDPE_MOTOR_OIL **default** renders white) | Options collapse to ~6 core looks, so a green, cobalt, light-blue or coloured container cannot be shown. (3d-visual X-01) | — | As 3d-visual X-01: `VesselOption.tint` from `BOTTLE_MATERIALS[m].hex` in `library/vessels.ts`; `createVesselMaterial(code, q, { tint })` uses it for `color` and `attenuationColor` (green `#2f5a2c`, `attenuationDistance 0.01`; opaque HDPE: `color = tint`). Then set GLASS_GREEN `coreMaterial` back to whatever base the tint rides on. | open |
| E-04 | high | BTL_GLASS_SPIRITS_FLASK, BTL_HDPE_SHAMPOO_OVAL (stadium sections), also MARASCA / MOTOR_OIL / DETERGENT / JUG / JERRYCAN | FRONT / BACK labels are **flat planes** sized for a 16 % corner (`labelSpecsFor` face branch: `w = 0.706 D`), so on a stadium section (flat front only `D − G` wide: flask 42 mm vs 58 mm label) the label **floats off the curved sides**. The family's exact `bottleLabelSpecs` (developed faces, prism wraps, `surfacePoint` mapping, safe rects) is not used by the library. | Labels follow the container surface (no air gap, no stretch). | `src/lib/library/vessels.ts · BOTTLES.describe`: use `BTL.bottleLabelSpecs(def, profile, dims, surfaces)` instead of the core `labelSpecsFor(coreKind, …)`; `vessels/geometry.ts`: build `developedFace` / `prism` label meshes from `BTL.surfacePoint(spec, profile, s, t)` (UVs from `surfaceUv`). | open |
| E-05 | medium | TUB_PP_HALAWA, TUB_PP_TAHINI, PAIL_PP_ROUND | Text centred on the WRAP of a tapered tub lands on the **bottom edge** of the band ("ELBA" cut on Halawa): the wrap is an annular sector whose bounding box is about twice the band height, and new text is centred in the bounding box. | IML / wrap labels on tapered tubs: artwork laid out along the arc. | `components/designer/lib/doc.ts · makeTextLayer`: place on the sector's centre line (`flatPoint(spec, 0.5, 0.5)`) and use the family `safeRect`. | open |
| E-06 | medium | BTL_PET_CSD, BTL_PET_SPORTS | Round base: no 5-foot petaloid base. (3d-visual V-08) | ISBT CSD bottles: 5-foot petaloid. | `vessels/geometry.ts · bodyGeometry`: for `base.kind === "petaloid"`, modulate rings with `y < clearance × 3` by `r × (1 − 0.18 × (0.5 + 0.5 cos(5 φ)))` (same pattern as `ribs`). | open |
| E-07 | medium | SPARKLING_CORK, BAR_TOP, SWING_TOP, POURER_CAP, MEASURE_CAP, CHILD_RESISTANT_CAP, ORIFICE_REDUCER_CAP | Each still borrows a generic core shape: no foil hood + wire on sparkling, no T-cork head on bar-top, no wire on swing-top, no spout on the pourer, no measuring cup. The covered height can only depend on the finish because `describe()` does not get the closure. | Sparkling: foil hood 90–120 mm; bar-top head ~16 mm above the lip. | `library/types.ts · describe(dims, surfaces, presetId, closure?)` → `BTL.profileFor(def, dims, finish, closure)`; `vessels/closures.ts`: add `CROWN` (21 flutes), `CORK_CAPSULE`, `FOIL_HOOD`, `BAR_TOP`, `POURER` lathe profiles keyed on a new `VesselOption.closureStyle`. | open |
| E-08 | medium | Glass bottles with a LID print surface and a metal fallback closure | LID label disc sits at `finishTopY + 3` (`labels.ts · lidTop`, ROUND_BOTTLE / BOSTON_ROUND) but `LUG_LID` tops out at `+1.6`: the disc floats 1.4 mm over crown / ROPP caps. | — | `lidTop` should take the closure's `topY` (`buildClosure(...).topY + 0.2`). | open |
| E-09 | medium | All clear glass / PET with labels | Back of a white label shows the artwork **mirrored** through the glass. (3d-visual V-06) | Self-adhesive label back is white liner side. | 3d-visual V-06 (`createLabelMaterial` FrontSide + white back mesh). | open |
| E-10 | medium | All | Turntable spins 20°/s immediately and stops for good after the first touch; framing uses the bounding sphere. (3d-visual X-08, X-02) | WCAG 2.2.2 pause / stop. | 3d-visual X-08 / X-02. | open |
| E-11 | low | JERRYCAN_HDPE | Spout on the axis; real jerrycans have it off-centre towards a corner. | DIN 61 jerrycan. | `VesselModel`: translate the finish / closure group by `profile.handle` side (`x = −0.25 D`) for `family === "JERRYCAN"`, or build the shoulder as a separate offset lathe. | open |
| E-13 | low | BTL_HDPE_GALLON_JUG (natural, back view) | Through the frosted body the transmission pass shows a dark vertical wedge where the square section's back corners and the back label overlap. Pass 2 re-check; it reads like the hollow handle recess, but it is a transmission artefact. | — | Goes away once E-02 draws the handle and E-09 gives labels an opaque back; otherwise `thinMode` (alpha glass) for frosted plastics in `VesselModel`. | open |
| E-12 | low | TUB_PP_*, PAIL_PP_ROUND | `SLIP_LID` uses the `capMetal` role, so a white PP snap lid reads grey and metallic. | PP snap lid: matte-gloss plastic. | `vessels/closures.ts`: `SLIP_LID` role `cap` when the container is plastic (pass `kind`/material). | open |

### Checked and fine

| Area | Result |
|---|---|
| Silhouettes and proportions | Wine (Bordeaux high shoulder, Burgundy sloping, Hock flute), beer longneck / steinie, Dorica / Marasca, woozy, flask, Boston syrup, PET water / CSD / juice / sports waist, jars and tubs read to life against the cited supplier drawings; brim-full volume is 0.97–1.19 × nominal for every preset (tests 0.98–1.30). |
| Wall / base | Glass 2.5–4.2 mm walls, punts on wine (0.5 R) and sparkling (0.62 R), flat bases on jars, stack ring on tubs. |
| Label areas | Wrap / front / back / neck zones sit on the straight body or the neck; no seams or mirrored text on the outside of round bodies. |
| Open / close | Unscrew + lift animation correct for screw caps, lug lids and (now) metal capsules / crowns; reduced motion jumps to the end state. |
| Triangle budget | Body 14 k–43 k triangles at 128 segments (cooler 43 k is the maximum); liquid 64–72 segments; one transmission pass. Reasonable for phones. SwiftShader runs at the 60 fps rAF cap on desktop, so phone frame rate could not be measured here. |
| Console | No errors or warnings for any of the 34 models (capture log). |

## Counts

| Severity | Found | Fixed | Open (engine / library) |
|---|---|---|---|
| critical | 0 | 0 | 0 |
| high | 7 | 3 (B-01, B-02, B-03 fallback) | 4 (E-01..E-04) |
| medium | 9 | 2 (B-04, B-05) | 7 (E-05..E-10, E-07) |
| low | 4 | 1 (B-06) | 3 (E-11..E-13) |

## Verification

- `npm run typecheck`, `npm run lint`: pass.
- `npm test`: 5 908 / 5 909 pass; the one failure is a 5 s timeout in `families/flexible` under full parallel load (passes alone, not in scope).
- `npx playwright test e2e/models.spec.ts --grep "BTL_|JAR_|TUB_|PAIL_|JERRYCAN" --workers=2`: 34 / 34 pass (against `next dev`).
- New tests: `__tests__/render-fallbacks.test.ts` (no core FLIP_TOP, metal closures metal, no colour-family swaps, closure-covered height per finish).
- Environment notes (outside scope): `npx prisma db seed` fails in this snapshot, so `npm run build` stops at prerendering `/[locale]/boxes/...` (Prisma query error); everything above ran on `next dev`.
