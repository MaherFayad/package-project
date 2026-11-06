# Bottles, jars, tubs, pails and jerrycans (`src/lib/vessels/families/bottles`)

Rotational and extruded container models for the 3D designer. They extend the core vessel
pattern (`src/lib/vessels`) without editing it. Everything is pure TypeScript (no three.js), in mm,
Y up, standing on y = 0, front facing +Z, angles measured from +Z towards +X (same as the core).

Entry point: `import { DEFINITIONS, describeBottle } from "@/lib/vessels/families/bottles"`.

## Models (33)

| Code | English | Arabic | Family / sub-family | Standard | Finishes | Presets |
|---|---|---|---|---|---|---|
| `BTL_GLASS_BEER_LONGNECK` | Longneck beer bottle | زجاجة مشروب شعير بعنق طويل | BOTTLE / GLASS_BEER | ISO 12821 (26 H 180 crown finish) | CROWN_26 | 330 ml, 355 ml |
| `BTL_GLASS_BEER_STUBBY` | Stubby (steinie) beer bottle | زجاجة مشروب شعير قصيرة | BOTTLE / GLASS_BEER | ISO 12821 (26 H 180 crown finish) | CROWN_26, SWING_26 | 330 ml, 250 ml |
| `BTL_GLASS_JUICE` | Glass juice bottle | زجاجة عصير زجاجية | BOTTLE / GLASS_JUICE | none | TO43, TO38 | 250 ml, 330 ml, 1 litre |
| `BTL_GLASS_MILK` | Glass milk bottle | زجاجة حليب زجاجية | BOTTLE / GLASS_DAIRY | none | TO43, TO38 | 250 ml, 500 ml, 1 litre |
| `BTL_GLASS_OIL_DORICA` | Dorica olive oil bottle | زجاجة زيت زيتون دائرية طراز دوريكا | BOTTLE / GLASS_OIL | PP 31.5 x 18 ROPP | PP31_5 | 250 ml, 500 ml, 750 ml |
| `BTL_GLASS_OIL_MARASCA` | Marasca olive oil bottle | زجاجة زيت زيتون مربعة طراز ماراسكا | BOTTLE / GLASS_OIL | PP 31.5 x 18 ROPP | PP31_5 | 250 ml, 500 ml, 750 ml, 1 litre |
| `BTL_GLASS_PHARMA_SYRUP` | Amber glass syrup bottle | زجاجة شراب دوائي عسلية | BOTTLE / GLASS_PHARMA | Ph. Eur. 3.2.1 type III glass; PP 28 ROPP | PP28 | 100 ml, 125 ml |
| `BTL_GLASS_SAUCE_WOOZY` | Woozy hot sauce bottle | زجاجة صلصة حارة بعنق طويل | BOTTLE / GLASS_SAUCE | GPI 24-414 | F24_414, F28_400 | 5 oz (148 ml), 10 oz (296 ml) |
| `BTL_GLASS_SPARKLING` | Sparkling wine bottle | زجاجة مشروب فوار | BOTTLE / GLASS_SPARKLING | CETIE 29 mm crown / cork finish (sparkling) | CROWN_29 | 750 ml, 375 ml, 200 ml |
| `BTL_GLASS_SPIRITS_FLASK` | Spirits flask | زجاجة مسطحة للجيب | BOTTLE / GLASS_SPIRITS | none | PP28, BARTOP_18_5 | 200 ml, 375 ml, 750 ml |
| `BTL_GLASS_WATER` | Glass water bottle | زجاجة مياه زجاجية | BOTTLE / GLASS_WATER | none | PP28, CROWN_26, SWING_26 | 330 ml, 750 ml |
| `BTL_GLASS_WINE_BORDEAUX` | Bordeaux wine bottle | زجاجة نبيذ طراز بوردو | BOTTLE / GLASS_WINE | EN 12726 / CETIE GME 1.04 (18.5 mm cork mouth) | CORK_18_5, BVS_30H60 | 750 ml, 375 ml, 750 ml screw cap |
| `BTL_GLASS_WINE_BURGUNDY` | Burgundy wine bottle | زجاجة نبيذ طراز بورجوني | BOTTLE / GLASS_WINE | EN 12726 / CETIE GME 1.04 (18.5 mm cork mouth) | CORK_18_5, BVS_30H60 | 750 ml, 375 ml |
| `BTL_GLASS_WINE_HOCK` | Hock (flute) wine bottle | زجاجة نبيذ طراز الراين | BOTTLE / GLASS_WINE | EN 12726 / CETIE GME 1.04 (18.5 mm cork mouth) | CORK_18_5, BVS_30H60 | 750 ml, 375 ml |
| `BTL_HDPE_DETERGENT_HANDLE` | Detergent bottle with handle | عبوة منظف سائل بمقبض | BOTTLE / HDPE_HOUSEHOLD | SPI/GPI 38-400 | F38_400 | 1 litre, 2.5 litre, 3 litre |
| `BTL_HDPE_GALLON_JUG` | Gallon jug with handle | جالون بلاستيك بمقبض | JUG / HDPE_DAIRY | SPI/GPI 38-400 | F38_400 | Half gallon (1.89 l), 1 gallon (3.785 l) |
| `BTL_HDPE_MOTOR_OIL` | Motor oil bottle | عبوة زيت محركات | BOTTLE / HDPE_LUBRICANT | SPI/GPI 38-400 | F38_400 | 1 litre, 4 litre |
| `BTL_HDPE_SHAMPOO_OVAL` | Oval shampoo bottle | زجاجة شامبو بيضاوية | BOTTLE / HDPE_PERSONAL_CARE | SPI/GPI 24-410 | F24_410 | 200 ml, 400 ml, 600 ml |
| `BTL_PET_CSD` | Carbonated soft drink bottle (petaloid) | زجاجة مشروب غازي بقاع بتلي | BOTTLE / PET_CSD | ISBT PCO 1881 (28 mm) | PCO_1881 | 1 litre, 1.5 litre, 2.25 litre |
| `BTL_PET_JUICE` | PET juice bottle | زجاجة عصير بلاستيك | BOTTLE / PET_JUICE | 38 mm 3-start hot-fill | HOTFILL_38 | 330 ml, 750 ml, 1 litre |
| `BTL_PET_PHARMA_SYRUP` | Amber PET syrup bottle | زجاجة شراب دوائي بلاستيك عسلية | BOTTLE / PET_PHARMA | SPI/GPI 28-410 | F28_410, PP28 | 100 ml, 120 ml, 150 ml |
| `BTL_PET_SPORTS` | Sports bottle with grip waist | زجاجة رياضية بخصر | BOTTLE / PET_SPORTS | ISBT PCO 1881 (28 mm) | PCO_1881 | 500 ml, 750 ml |
| `BTL_PET_WATER_COOLER_19L` | Water-cooler bottle 11 to 19 l | قارورة مبرد مياه 19 لتر | JUG / PET_BULK_WATER | 55 mm water-cooler snap neck | SNAP_55 | 19 litre (5 gal), 11 litre (3 gal) |
| `BTL_PET_WATER_EG` | PET water bottle (600 ml to 1.5 l) | زجاجة مياه بلاستيك | BOTTLE / PET_WATER | ISBT PCO 1810 / PCO 1881 (28 mm) | PCO_1810, PCO_1881 | 600 ml, 1.5 litre |
| `BTL_PET_WATER_JUG_5L` | PET water jug 5 to 7 l | جالون مياه 5 لتر | JUG / PET_BULK_WATER | none | SCREW_48 | 5 litre, 7 litre |
| `JAR_GLASS_HONEY_HEX` | Hexagonal honey jar | برطمان عسل سداسي | JAR / GLASS_JAR | none | TO43, TO58, TO63 | 45 ml (60 g), 190 ml (250 g), 280 ml (400 g) |
| `JAR_GLASS_JAM` | Jam jar | برطمان مربى | JAR / GLASS_JAR | none | TO63, TO66, TO70 | 212 ml (280 g), 314 ml (400 g), 370 ml (500 g) |
| `JAR_GLASS_MASON` | Mason jar | برطمان تخزين بغطاء وحلقة | JAR / GLASS_JAR | Mason regular (70 mm) / wide (86 mm) mouth | MASON_70, MASON_86 | Half pint (240 ml), Pint (470 ml), Quart wide mouth (950 ml) |
| `JAR_PET_NUT_BUTTER` | Nut butter jar | برطمان زبدة فول سوداني | JAR / PET_JAR | SPI/GPI 70-400 / 89-400 | F70_400, F89_400 | 340 g, 500 g, 1 kg |
| `JAR_PICKLE` | Pickle jar | برطمان مخلل | JAR / GLASS_JAR | none | TO82 | 720 ml (750 g), 1.7 l (2 kg) |
| `JERRYCAN_HDPE` | HDPE jerrycan | جركن بلاستيك | JERRYCAN / HDPE_JERRYCAN | DIN 45 / DIN 61 neck; UN 3H1 (when certified) | DIN45, DIN51, DIN61 | 5 litre, 10 litre, 20 litre |
| `PAIL_PP_ROUND` | Round plastic pail | جردل بلاستيك بمقبض | PAIL / PP_PAIL | UN 1H2 (when certified) | RIM | 1 litre, 5 litre, 10 litre, 20 litre |
| `TUB_PP_HALAWA` | Halawa tub | علبة حلاوة طحينية | TUB / PP_TUB | none | RIM | 250 g, 500 g, 1 kg |
| `TUB_PP_TAHINI` | Tahini tub | علبة طحينة بلاستيك | TUB / PP_TUB | none | RIM | 300 g, 500 g, 1 kg |

### Skipped because the core registry already has them
- **Round honey jar**: core `WIDE_JAR` (100 / 250 / 500 g honey presets, TO 53 / 63).
- **PET still water 330 / 500 / 1000 ml**: core `ROUND_BOTTLE`. This folder only adds the Egyptian
  600 ml and 1.5 l sizes (`BTL_PET_WATER_EG`), which the core lacks.
- Glass and PET **syrup**: the core `BOSTON_ROUND` (glass) and `PUMP_BOTTLE` (PET) have a similar
  silhouette, but no amber PET, ROPP or child-resistant closure, and no Egyptian 100 / 120 / 125 / 150 ml
  pharma sizes. These are kept here as `BTL_GLASS_PHARMA_SYRUP` and `BTL_PET_PHARMA_SYRUP`.

## What each definition contains
- `code`, `slug`, `name` / `description` (Arabic in MSA, noun form, no diacritics; the schema test enforces this),
  `family` + `subFamily`, `standard`, `coreKind` (nearest core kind, used as a renderer fallback).
- `recipe`: shape proportions (fractions of H and R) plus wall and base thickness, base style (flat, punt,
  5-foot petaloid, stack ring), shoulder (cone, ogive, Boston, none), neck length and flare, ribs, grip waist, taper, label zone and handle.
- `materials` (flint, amber, green, cobalt, frosted glass; clear, amber and blue PET; white, natural and coloured HDPE; white and natural PP),
  `finishes` (real neck standards, see `finishes.ts`), `closures` (screw, tamper-band screw, child-resistant, ROPP,
  pourer, 26 / 29 mm crown, cork with capsule, mushroom cork, bar top, swing top, flip top, sports, orifice reducer,
  lug, mason two-piece, non-spill snap, vented, measuring cap, tear-strip lid).
- `limits` (zod via `dimsSchemaFor`) with an H/D `aspect` window, 2 to 4 `presets` flagged `egypt`, and a `source` for each one.
- `surfaces` / `defaultSurfaces`, `typicalUses` (ar / en), `fillable`, and `defaultContent` (fill colour, clarity and density).

## Geometry and print math
- `buildBottleProfile(recipe, dims, finish)` returns a `BottleProfile` that is a core `VesselProfile`
  (lathe outline, `body` label zone, `shoulder` = neck-label zone, `finishTopY`, `fillMaxY`) plus:
  - `bottleSection`: the exact section. `round`; `rect` (rounded rectangle; `cornerRatio >= depthRatio` is a
    stadium, used for the oval shampoo bottle and the flask); `polygon` (hexagon honey jar, D measured across flats).
    The squareness `s` on each outline point blends the section into the round neck with no jump in area or girth.
  - `base` (punt depth, petaloid feet / clearance), `neckZone`, `handle` (centre-line path + tube radius) and `innerBaseY`.
- Volume (`bottleBrimfulMl`, `bottleVolumeToMl`) and girth use the exact section. Every preset's brimful
  volume is tested to be within 0.98 to 1.30 of nominal, and the Berlin 330 ml longneck comes out at its published 345 ml brimful.
- `fillLevelFor(profile, ml)` bisects the fill line for the nominal capacity and returns the headspace.
- `bottleLabelSpecs` reuses the core `bandSpec` / `discSpec` / `faceSpec`, so pricing, SVG and roll layout keep working,
  and adds `mapping` and `safeRect` (`BottleLabelSpec`):
  - `cylinder` / `cone`: core band mapping. Tapered pails and tubs unroll to exact annular sectors.
  - `prism`: a wrap on a non-round body. `placement.r0 = r1 = girth / 2π`, so `trimWidth = developed girth + 8 mm overlap`.
  - `developedFace`: FRONT / BACK on a non-round body. `x0..x1` is the **arc length** from the face centre
    (developed, not projected), so a label can run onto the corners undistorted.
  - `sleeve`: a shrink sleeve on any section (`bottleSleeveSpec`). Same rules as the core (3% ease, 6 mm seam, PETG shrink warnings).
  - `disc`: a lid or cap top, skipped for closures without a printable top.
- `surfacePoint(spec, profile, s, t)` is the inverse of the core `flatPoint` / `surfaceUv`. Build label meshes from it and
  take UVs from `surfaceUv`, and flat artwork lands undistorted. Tests check that the mapping is isometric for cylinder, prism and developed faces.

## Integrator TODO (shared files I did not edit)
1. **Core types**: add the 33 codes to `VESSEL_KINDS` (or add a `code` to `VesselDefinition`), add `BottleFamily` members
   (`TUB`, `PAIL`, `JERRYCAN`, `JUG`) to `VesselFamily`, add `{ kind: "polygon"; sides; cornerRatio }` to `CrossSection`,
   and add `BOTTLE_MATERIAL_CODES` and `BOTTLE_CLOSURE_CODES` to the core unions. Until then, every model carries `coreKind`,
   `coreMaterial` and `coreClosure` fallbacks.
2. **Renderer** (`src/components/three/vessels`):
   - Revolve `profile.outer` with `sectionPointAtArc(bottleSection, r, u, s)` in place of the core rounded-rect helper, which also covers the hexagon.
   - Draw `profile.handle.path` as a `TubeGeometry`, and the petaloid feet (`base.feet`) as 5 lobes.
   - Until then the 3D view draws the core closure named by `coreClosure` over `profile.finishH`, which is the height the
     closure really covers (`closureCoverMm`: crown 6.5 mm, swing-top head 7.5 mm, cork capsule down the neck, else the finish).
     Metal closures fall back to the metal `LUG_LID`; nothing may use the core `FLIP_TOP` (a tube cap drawn at y = 0).
     `coreMaterial` never swaps colour family (green glass falls back to clear, natural HDPE / PP to frosted). See `docs/audit/3d-bottles.md`.
   - Draw closures from `BOTTLE_CLOSURES` (`heightAboveMm`, `skirtMm`, `extraDiameterMm`). Swing-top wire and lugs are not lathe parts.
   - Jerrycans: the real spout is off-centre towards one corner, but the lathe puts the neck on the axis. Offset it in the renderer if needed.
3. **i18n / catalogue / prisma**: names and descriptions are in the definitions; slugs are unique and URL-safe. Seed
   rate cards for label printing only, since Elba does not make the containers.
4. **Pricing**: `trimAreaM2`, `printWidthMm` / `printHeightMm` and `sleeve.layFlatMm` follow the core `LabelSpec` contract, so `labelRun` works unchanged.

## Sources
- Wine: Berlin Packaging EU Bordeaux 75 cl CETIE 18.5 (313–316 mm), Cary Bordeaux Ø2.97 × 11.875 in; EN 12726 / CETIE GME 1.04 (18.5 mm cork mouth).
- Beer: Berlin Packaging Long Neck SE 330 ml CR26 (Ø60.4 × 226.5 mm, 345 ml brimful), Hauser / World of Bottles steinie 330 ml (Ø70 × 174 mm); ISO 12821 (26 H 180).
- Olive oil: Creopack Dorica 250 / 500 ml (PP 31.5 × 18), Berlin Packaging Marasca 500 / 750 ml (56 / 66.5 mm square).
- Woozy: Uline S-21720 5 oz 24-414 (Ø1.859 × 6.625 in). Flask: TricorBraun 375 ml oblong flask (3.25 × 1.60 × 7.64 in).
- PET: Petainer 1.5 l PCO 1810 (Ø94 × 305.2), Petainer 5 gal 55 mm snap (Ø270 × 488, 19 l), Berlin Packaging round juice 38 mm 3-start 330 / 750 / 1000 ml.
- Jugs and bulk: Aaron Packaging 1 gal dairy 38 mm (146 × 146 × 248), Avantor 20 l DIN 61 jerrican (248 × 290 × 379), Abelo 20 l bucket (Ø326 / 265 × 359).
- Jars: Etivera / Ampulla 190 ml hex TO 58 (69 mm across corners × 90 mm), Ampulla 280 ml hex TO 63, Ball-style mason 70 / 86 mm mouths.
- Presets whose `source` starts with "Typ." are typical trade sizes (Egyptian market), not a single drawing. Confirm them with the supplier before cutting a label die.
