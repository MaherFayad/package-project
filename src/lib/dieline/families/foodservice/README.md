# Foodservice and paper packaging family

`src/lib/dieline/families/foodservice` holds 29 parametric models in four geometry kinds:

| Kind | What it produces | Engine |
|---|---|---|
| `dieline` | A die (cut, crease and perf lines, panels with hinges, fold angles and stages, glue flaps, 3 mm bleed, safe zones, faces) | The core fold engine. `finalizeDraft` repeats `generate.ts#buildDieline` for codes that are not core `StructureCode`s yet |
| `frustum` | A conical fan blank (annular sector) and a frustum mesh with exact UVs | `frustum.ts` |
| `lathe` | A revolved lid profile, plus a printable top disc on paper lids | `lids.ts` |
| `molded` | A molded-pulp height-field shell, plus a slip label on egg-carton lids | `pulp.ts` |

Entry point: `buildFoodservice(code, dims, { thicknessMm?, features?, bleedMm? })`. It validates the input with zod (ranges and rules) and returns `{ kind, model }`. `DEFINITIONS` is exported from `index.ts`.

## Models

| Code | EN | AR | Standard | Kind |
|---|---|---|---|---|
| FS_CAKE_BOX_WINDOW | Cake box with window | علبة تورتة بنافذة | none | dieline |
| FS_BAKERY_BOX | Lock-corner bakery box | علبة مخبوزات بأركان مقفلة | none | dieline |
| FS_BURGER_CLAMSHELL | Burger clamshell | علبة برجر صدفية | none | dieline |
| FS_NOODLE_PAIL | Takeout noodle pail (wire-free) | علبة نودلز للطلبات الخارجية | none | dieline |
| FS_FRIES_SCOOP | Fries scoop | علبة بطاطس مقلية | none | dieline |
| FS_SANDWICH_WEDGE | Sandwich wedge | علبة ساندويتش مثلثة | none | dieline |
| FS_PIZZA_SLICE | Pizza slice box | علبة شريحة بيتزا | none | dieline |
| FS_PIZZA_ROUND | Pizza box, 8 to 16 inch | علبة بيتزا بمقاسات البوصة | FEFCO 0426 | dieline (core `pizza` generator) |
| FS_BAG_SOS | SOS flat-bottom paper bag | كيس ورقي بقاع مربع | ISO 6591-1 (dimensional designation) | dieline |
| FS_BAG_FLAT_HANDLE | Carrier bag, flat handle | حقيبة ورقية بمقبض مسطح | ISO 6591-1 | dieline + handle |
| FS_BAG_TWISTED_HANDLE | Carrier bag, twisted handle | حقيبة ورقية بمقبض مجدول | ISO 6591-1 | dieline + handle |
| FS_BAG_MERCHANDISE | Merchandise flat bag | كيس ورقي مسطح | none | dieline |
| FS_BAG_BOTTLE | Bottle bag | كيس ورقي للزجاجات | ISO 6591-1 | dieline |
| FS_BAG_BREAD_WINDOW | Bread bag with window | كيس خبز بنافذة | ISO 6591-1 | dieline |
| FS_HANG_TAG | Hang tag | بطاقة تعليق | none | dieline (flat) |
| FS_BELLY_BAND | Belly band | حزام تغليف | none | dieline (core `sleeve`) |
| FS_GIFT_SLEEVE | Gift wrap sleeve | غلاف هدية منزلق | none | dieline (core `sleeve`) |
| FS_CUP_SINGLE | Single-wall paper cup, 4/8/12/16 oz | كوب ورقي بجدار مفرد | none | frustum |
| FS_CUP_DOUBLE | Double-wall paper cup, 4/8/12/16 oz | كوب ورقي بجدار مزدوج | none | frustum |
| FS_CUP_SLEEVE | Hot cup sleeve | غلاف عازل للكوب | none | frustum |
| FS_BOWL | Paper bowl | وعاء ورقي | none | frustum |
| FS_CUP_LID | Cup lid | غطاء كوب | none | lathe |
| FS_BOWL_LID | Paper bowl lid | غطاء وعاء ورقي | none | lathe |
| FS_PULP_EGG_6 | Egg carton, 6 | علبة بيض سعة 6 | none | molded |
| FS_PULP_EGG_10 | Egg carton, 10 | علبة بيض سعة 10 | none | molded |
| FS_PULP_EGG_TRAY_30 | Egg tray, 30 | طبق بيض سعة 30 | none | molded |
| FS_PULP_CUP_CARRIER_2 | Cup carrier, 2 | حامل أكواب سعة 2 | none | molded |
| FS_PULP_CUP_CARRIER_4 | Cup carrier, 4 | حامل أكواب سعة 4 | none | molded |
| FS_PULP_FRUIT_TRAY | Molded pulp fruit tray | صينية فاكهة من لب الورق | none | molded |

Most of these styles have no published FEFCO or ECMA code. I searched for an ECMA code for a lock-corner cake or bakery box and did not find one, so those entries say `none` instead of a guessed code. Each model has 2 to 4 presets. The one exception is `FS_PIZZA_ROUND`, which has 5 presets because the brief asks for 8, 10, 12, 14 and 16 inch.

## Geometry notes

- **Thickness compensation** follows the core rule: crease-to-crease sizes are the inner size plus layers × t. The tests check that the closed outer size equals inner + a few t.
- **Noodle pail.** The walls flare out by `PAIL_FLARE_DEG` = 9°. Each wall is a trapezoid with slant `(H+t)/cos θ` and is folded to `90 − θ`, so neighbouring lateral edges meet exactly. The closure flaps fold to `90 + θ`. The wall faces are oblique, so they are built with `obliqueFace` from `engine.ts`. The corner gusset webs of a real pail are not modelled: the walls are separate leaves of the fold tree.
- **Sandwich wedge.** The slope folds to `180 − atan(H/W)` and its glue flap folds to `90 + atan(H/W)`. `faces.top` (also exposed as `front`) is the sloped window panel, built with `obliqueFace`.
- **Bags** are shown opened. Each gusset is one side wall, and its flat-pack centre fold and SOS bottom diagonals are drawn as `extraCreases`. Carrier bags fold a 35–50 mm top turnover inside (`inner` panels, 180°). Handles are an accessory (`model.handle: HandleSpec`) for the renderer to draw as a strip or rope. They are not part of the die.
- **Cups, bowls and sleeves.** The fan is an exact development: arc length = circumference, and `fanPoint` is an isometry (tested). The UVs come from the same mapping. The seam sits at the back (φ = π) and the front is at s = 0.5. The apex is below the fan, so the rim prints at the top of the artwork. Converting allowances (`CUP_ALLOWANCES`: top curl 6, bottom fold 8, seam 8, recess 6, double-wall gap 1.5 mm) are typical values that depend on the machine. No public source gave numbers, so confirm them against the converter's tooling drawing.
- **Molded pulp.** Pulp is not printed directly. The only print surface is the paper slip label on egg-carton lids (75 % × 60 % of the lid, with 3 mm bleed and safe zone).

## Sources

- Paper cup sizes are supplier listings (they vary by maker): 4 oz 63/45/58, 8 oz 80/57/90, 12 oz 90/60/112, 16 oz 90/58/130 mm (cupprint.com, customdesignsboxes.com, yoonpak.com).
- Bowl sizes: Vegware 16 oz 148/130/51, Bioleader soup bowls 115/98/72, 118/96/108 and 118/93/131 mm.
- SOS bags: American Retail Supply and Packaging Source #4 / #6 / #8 tables (inches converted to mm).
- Carrier bags: retailer sizes 190×80×210, 260×120×350 and 320×140×420 mm. Dimensions follow the ISO 6591-1 width × gusset × height convention.
- Egg packs: 6-egg carton about 6×4×3 in or 14×10×5 cm; 30-egg flats 290×290×50 and 292×292×48 mm (Hartmann listing).
- Pizza: FEFCO 0426, through the core `pizza()` generator. Inch presets are the pizza diameter plus 6–7 mm clearance.

## What the integrator must do

1. **Codes.** Add the `FOODSERVICE_CODES` to `STRUCTURE_CODES` in `src/types/structure.ts`, or add a parallel catalogue union, and widen `StructureFamily` with `PAPER_BAG | PAPER_CUP | MOLDED_PULP | FLAT_STOCK`. Then `FamilyDielineModel` becomes a plain `DielineModel`, and the dieline generators can go into `GENERATORS`, `STRUCTURE_LIMITS`, `DEFAULT_DIMS`, `FEATURE_SUPPORT` and `STRUCTURE_FAMILY`. `finalizeDraft` is then no longer needed.
2. **Materials.** Add the new substrates in `materials.ts` (`CUK_300`, `CUPSTOCK_*`, `KRAFT_PAPER_*`, `WHITE_KRAFT_100`, `GREASEPROOF_50`, `MOLDED_PULP_*`, `LID_*`) to `MATERIAL_CODES`, `BOARD_SPECS` and the seed. The `SBS_*` and `*_FLUTE_*` codes are reused unchanged.
3. **Renderer.** Add three mesh paths in `src/components/three`:
   - `fanMesh(model.printFan)` for cups, bowls and sleeves, plus a rim torus and a base disc taken from `CupModel.rim` / `CupModel.base`.
   - `latheMesh(lid.profile)` for lids.
   - `heightFieldMesh(pulp, "base" | "lid")` for molded pulp.
   
   All three return plain `Float32Array` / `Uint32Array` data (`MeshData`), ready to wrap in a `BufferGeometry`.
4. **Bag handles.** Render `model.handle` (`HandleSpec`) as a loop on the front and back faces, using its span, height, width and anchor values.
5. **i18n and catalogue.** Names and descriptions are already in `ar` / `en` on each definition. `dimLabels` renames L/W/H for bags and flat items.
6. **Food contact.** Products marked `food` / `beverage` should use the `foodContact: true` materials only.
