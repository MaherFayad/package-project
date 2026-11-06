# ECMA tuck-end and glued-end folding cartons (`families/ecma-tuck`)

Parametric dielines for ECMA group A cartons (rectangular, longitudinal glue seam). All
dimensions are **inner mm**: `L` front width, `W` depth, `H` height (the closures sit at the H
ends). Each model emits a full `DielineModel`: cut, crease and perforation lines, a panel tree
with hinges, closed fold angles, fold stages and stack offsets (for the existing fold engine),
glue flaps kept ink-free, 3 mm bleed on cut edges, 3 mm safe zones, faces, closed outer size
and board metrics.

```ts
import { DEFINITIONS, DEFINITION_BY_CODE, generateEcmaDieline } from "@/lib/dieline/families/ecma-tuck";
const def = DEFINITION_BY_CODE.ECMA_HANGER_EURO;
const model = generateEcmaDieline(def, def.defaultDims, { thicknessMm: 0.48, model: { hangHole: "euro" } });
```

## Models

| Code | EN | AR | Standard | Base code |
|---|---|---|---|---|
| `ECMA_TUCK_STE` | Straight tuck end carton | علبة بلسان مستقيم | ECMA A20.20.03.03 | `ECMA_STE` |
| `ECMA_TUCK_RTE` | Reverse tuck end carton | علبة بلسان عكسي | ECMA A20.20.03.01 | `ECMA_RTE` |
| `ECMA_TUCK_AIRPLANE` | Airplane-style straight tuck carton | علبة بلسان مستقيم أمامي | ECMA A20.20.01.01 | `ECMA_STE` |
| `ECMA_TUCK_FRENCH_RTE` | French reverse tuck carton | علبة بلسان عكسي مقلوب | ECMA A20.20.01.03 | `ECMA_RTE` |
| `ECMA_TUCK_SNAP_LOCK` | Tuck top, 1-2-3 snap-lock bottom | علبة بلسان علوي وقاع مقفل 1-2-3 | ECMA A55.20.01.03 | `ECMA_SLB` |
| `ECMA_TUCK_CRASH_LOCK` | Tuck top, crash-lock (auto) bottom | علبة بلسان علوي وقاع أوتوماتيكي | ECMA A60.20.00.03 | `ECMA_CLB` |
| `ECMA_SEAL_END` | Seal end carton (glued both ends) | علبة بأطراف ملصوقة | ECMA A10.10.01.01 | `ECMA_STE` |
| `ECMA_SEAL_END_TEAR` | Seal end carton with tear strip | علبة بأطراف ملصوقة وشريط فتح | ECMA A10.10.01.01 + tear strip | `ECMA_STE` |
| `ECMA_HANGER_EURO` | Hanger tab carton, Euro slot | علبة تعليق بفتحة يورو | ECMA A20.21.03.03 | `ECMA_STE` |
| `ECMA_HANGER_ROUND` | Hanger tab carton, round hole | علبة تعليق بفتحة دائرية | ECMA A20.21.03.03 | `ECMA_STE` |
| `ECMA_WINDOW_RTE` | Window carton | علبة بنافذة عرض | ECMA A20.20.03.01 + window | `ECMA_RTE` |
| `ECMA_PHARMA_RTE` | Pharma carton with leaflet allowance | علبة دواء بمساحة للنشرة | ECMA A20.20.03.01 | `ECMA_RTE` |
| `ECMA_FLIP_TOP` | Hinged-lid flip-top pack | علبة بغطاء مفصلي | none | `ECMA_STE` |
| `ECMA_DOUBLE_WALL_TUCK` | Double-wall tuck carton | علبة بلسان وجدران مزدوجة | none | `ECMA_RTE` |

### Construction notes

- **Layout**: `glue | left | front | right | back`, front panel = root, identity closed rotation.
- **Thickness compensation** (engine convention, crease-to-crease = inner + layers × t):
  `L + 2t`, `W + 2t`; height `H + 4t` (tuck both ends: closure + dust flap), `H + 5t`
  (tuck top + 3-layer lock bottom), `H + 6t` (seal end: minor + 2 majors each end).
  Double wall: `W + 5t` (front two layers, back three with the glue flap).
- **Closure owners (A20.20.xx.yy, pair 3 = bottom panel, pair 4 = lid panel)**: STE both on the
  back; RTE top back / bottom front; Airplane both on the front; French (inverted) reverse
  tuck top front / bottom back.
- **Tucks**: depth `0.35 W + 5` (10–30 mm, ≤ 0.45 H′), shoulders + rounded nose, inset `t + 0.5`
  from the lid corners. Dust flaps trapezoidal, depth `min(0.8 W, 0.45 L)`. Optional slit lock
  (`tuckLock: "slit"`): two 0.5 mm × ≤ 8 mm cuts at the tuck crease ends, as holes in the lid.
- **Lock bottoms**: 1-2-3 snap lock (dust flaps, slot flap, lock flap with two tabs) and crash lock
  (45° glue-assist creases as extra creases). Both crash-lock main flaps close flush on the outer
  bottom plane and meet on the centre line; their locking tongues are children on a virtual
  `roll` hinge one caliper further in, so the whole bottom carries artwork without z-fighting. Side flaps clamp to `L/2 − t` so wide-and-shallow
  sizes (W > L) never overlap past the centre.
- **Seal end** (ECMA A10 "full overlapping closure"): minor flaps, inner major (W − t), outer
  major (W), glued. Tear strip: two perforations 6 mm apart round all four walls and the glue
  flap, `clamp(0.15 H, 10, 30)` mm below the top crease.
- **Hanger** (A20.21 "tuck closure with extended back panel"): the back runs on past the top
  crease as a header (virtual `roll` hinge: no crease, no cut), with a 180° doubler, so the tab is
  two layers; the hang hole is cut through both in register (mirrored about the fold). The
  doubler is the front of the tab and joins the front face (printed). The top
  closure is hinged on the front. Euro slot: 30 × 5 mm slot with a Ø10 mm half-round at the top
  centre (scaled down only when the header is narrower than 38 mm). Round hole: Ø8 mm (peg
  hooks up to ~7 mm). Header 30 mm (Euro) / 25 mm (round), 20–80 mm.
- **Window**: reverse tuck with a die-cut front aperture (default 60 % × 45 %) and a clear film
  patch glued inside (`films`, `metrics.filmAreaM2`).
- **Pharma**: reverse tuck, slit lock default, `leafletThicknessMm` (default 3) added to the
  inner depth (`model.cartonInner.W = W + leaflet`), and an ink-free variable-data zone
  (batch / mfg / expiry) on the right side panel in `reservedZones`.
- **Flip-top**: glued shell; the lid is cut free of the body on the front and sides and stays
  hinged on a crease across the back (fold 0 when closed); glued ends with lips + dust flaps;
  separate **inner frame** blank (front + two part sides, thumb notch) placed inside the body
  front by an assembly matrix (`pieces: 2`). The lid front and sides stop 0.4 mm short of the
  body (cut clearance, so the closed pack shows the lid line); the lid's glue lip is
  `min(8, 0.35 × lid)` and the frame rises to just below it. No bevel on the lid sides (generic geometry,
  no trademarked shape).
- **Double wall**: reverse tuck whose front and back fold an inner wall 180° from their free edge.
  Layers, outside → in: front = wall | inner wall | top tuck; back = wall | glue flap | inner
  wall | bottom tuck, so the side panels are W + 5t.

## Options (`model` in `generateEcmaDieline`, zod `ecmaTuckOptionsSchema`, strict)

`tuckDepthMm` 6–40 · `glueFlapMm` 8–20 · `tuckLock` friction | slit · `hangHole` euro | round ·
`headerHeightMm` 20–80 · `leafletThicknessMm` 0–15 · `lidHeightMm` 10–80 (flip-top).
Dims are validated against each definition's `params` with the shared `dimsSchema` (same issue
codes as the engine). Flip-top has the rule `W <= L`.

## Sources

- boxshot ECMA dieline editor, per-code catalogue comments and parameters:
  A20.20.01.01, A20.20.03.01 ("FC0201 – Reverse Tuck End"), A20.20.01.03 ("FC0204 – Inverted
  Reverse Tuck End"), A20.20.03.03 ("FC0202 – Same Panel Tuck"), A20.21.03.03 ("tuck in flap
  closure system with extended back panel"; hang holes Round / Delta / Euro), A55.20.01.03
  ("Tuck To Back Snap Lock Base"), A60.20.00.03 ("Tuck To Back Crash Lock Base"), A10.10.01.01
  ("full overlapping closure system" top and bottom): https://dielines.boxshot.com/
- ECMA code structure (group letter, bottom closure pair, lid closure pair, panel positions) and
  examples A20.20.01.01 / A20.20.01.03 / A20.21.03.03 (Euro slot hanger):
  https://www.packaging-warehouse.com/en/adviser/ecma-catalogue-281 and
  https://labelprint24.com/en/magazine/ecma-code-a-code-says-more-than-a-thousand-words-789
- A55.20.01.03 / A60.20.00.03 product naming: https://newprint.ca/blog/ecma-standards-for-product-packaging
- Euro slot geometry (30 mm × ~5 mm slot, Ø10 mm half-round at top centre):
  https://www.steier.de/en/steierform/Applications/point-of-sale-hangers-with-Euro-holes-50-x-50-mm.html
- "Airplane style" as a trade name for straight tuck: https://meyers.com/meyers-blog/tuck-end-folding-cartons-types-examples/

Caveats: "airplane" and "French reverse tuck" are trade names, not ECMA terms. Here airplane =
A20.20.01.01 (both closures on the front panel) and French reverse = A20.20.01.03 (inverted
reverse tuck). Many printers use "airplane" for any STE. The tear-strip X-code and the
hinged-lid / double-wall codes were not verified, so they are marked `+ tear strip` / `none`.

## For the integrator

1. **New codes**: `EcmaTuckCode` (14 codes, `types.ts`) is not in the shared `StructureCode`
   union. Either add the codes to `src/types/structure.ts` (and `STRUCTURE_FAMILY`,
   `STRUCTURE_LIMITS`, `DEFAULT_DIMS`, `FEATURE_SUPPORT`, `GENERATORS`, registry `ENTRIES`), or
   keep them as catalogue codes and route through `generateEcmaDieline`. Until then each model
   reports `structureCode = baseCode` (closest existing code, see table) and
   `catalogCode = <family code>`.
2. **Generator signature**: family generators take a 4th `options` argument
   (`EcmaTuckGenerator`). To register in `GENERATORS`, wrap with the definition defaults:
   `(d, t, f) => def.generator(d, t, f, def.optionsDefaults)`.
3. **`model.ts` duplicates `buildDieline`** from `src/lib/dieline/generate.ts` (it is not
   exported). If the core exports it (or accepts a generator), replace the body of
   `generateEcmaDieline` with a call to it and keep the extras (`catalogCode`, `options`,
   `cartonInner`, `reservedZones`).
4. **New local types** to consider promoting: `EcmaTuckDefinition` (= `StructureDef` +
   `baseCode`, `subFamily`, `generator`, `optionsDefaults`, `defaultFeatures`), `ReservedZone`
   (ink-free variable-data area), `EcmaTuckDielineModel`, and the use tag `"pharma"` (not in the
   shared `StructureDef.uses` union).
5. **Pricing**: hanger header + doubler, double-wall inner walls, flip-top inner frame (second
   blank; `metrics.pieceCount = 2`, `blankAreaM2` sums both blanks) and window film are all in
   `metrics`; tear strip in `perfLengthMm`.
6. **Seed / i18n**: names and descriptions are in the definitions (`name`, `description`, preset
   names) and ready to copy into `prisma/seed.ts`.
7. The existing repo-wide `tsc` errors (catalog/pricing/test `Record<StructureCode, …>` maps
   missing the newer codes) are pre-existing and outside this folder.
