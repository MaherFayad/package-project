# Cosmetic, pharma, cans, tubs and tubes: container catalogue

Self-contained catalogue of 38 parametric containers for the vessel engine. Every model is pure data
(`CatalogueVesselDefinition`, serialisable); `buildGeometry()` turns a shape recipe plus a size into a
**core `VesselProfile`** (lathe outline, mm, Y up, standing on y = 0), so the existing renderer
(`src/components/three/vessels`), volume math (`brimfulVolumeMl`) and sleeve math work unchanged.
Print areas reuse the core `bandSpec` / `sleeveSpec` / `discSpec` / `faceSpec` and keep the same
flat/UV contract as `flatPoint` / `surfaceUv` (a test checks they match the core to 1e-9).

```ts
import { DEFINITIONS, describeCatalogueVessel, validateDims } from "@/lib/vessels/families/cosmetic-cans";
const def = DEFINITIONS.find((d) => d.code === "CAN-BEVERAGE")!;
const { geometry, surfaces, brimfulMl, envelope } = describeCatalogueVessel(def, { D: 66.2, H: 115.2 });
```

## Models

| Code | English | Arabic | Standard | Geometry | Presets |
|---|---|---|---|---|---|
| COS-DROPPER | Dropper bottle (euro) | زجاجة قطارة | — (DIN 18 neck) | lathe | 5, 10, 30, 100 ml |
| COS-SERUM | Flat-shoulder serum bottle | زجاجة سيروم بكتف مسطح | — | lathe | 15, 30, 50 ml |
| COS-AIRLESS | Airless pump bottle | زجاجة مضخة بدون هواء | — | lathe | 15, 30, 50 ml |
| COS-PERFUME-ROUND | Round perfume bottle with collar | زجاجة عطر دائرية بطوق | — (FEA 15) | lathe | 30, 50, 100 ml |
| COS-PERFUME-OVAL | Oval perfume bottle with collar | زجاجة عطر بيضاوية بطوق | — (FEA 15) | extrusion | 30, 50, 100 ml |
| COS-ROLL-ON | Roll-on bottle | عبوة رول أون | — | lathe | 10, 30, 50 ml |
| COS-DEO-STICK | Deodorant stick | عبوة مزيل عرق صلب | — | extrusion | 50, 75 g |
| COS-LIPSTICK | Lipstick case | علبة أحمر شفاه | — | lathe | 11.1 / 12.1 mm bullet |
| COS-LIP-GLOSS | Lip gloss bottle | عبوة ملمع شفاه | — | lathe | 5, 8 ml |
| COS-MASCARA | Mascara bottle | عبوة ماسكارا | — | lathe | 8, 12 ml |
| COS-COMPACT | Powder compact | علبة بودرة مضغوطة | — | lathe | 59, 75 mm pan |
| COS-JAR-DOUBLE | Double-wall cream jar | برطمان كريم مزدوج الجدار | — (SPI 400 necks) | lathe | 15, 30, 50, 100 g |
| COS-NAIL-POLISH | Nail polish bottle | زجاجة طلاء أظافر | — (13-415) | extrusion | 10, 15 ml |
| PH-VIAL | Injection vial with crimp cap | قارورة حقن بغطاء مكبوس | ISO 8362-1:2018, ISO 8362-6 | lathe | 2R, 10R, 20R, 50R |
| PH-AMPOULE | Glass ampoule | أمبولة زجاجية | ISO 9187-1:2010 | lathe | 1, 2, 5, 10 ml |
| PH-PILL-CR | Pill bottle with child-resistant cap | عبوة أقراص بغطاء مقاوم لفتح الأطفال | ISO 8317:2015 | lathe | 75, 150, 250 cc |
| PH-EYE-DROP | Eye-drop bottle | زجاجة قطرة عين | — | lathe | 5, 10, 15 ml |
| PH-BLISTER | Blister pack | شريط أقراص بليستر | ISO 14375:2018 (CR option) | blister | 10, 14, 20 cavities |
| PH-TUBE | Ointment tube | أنبوبة مرهم | — | tube | 5, 15, 30 g |
| CAN-BEVERAGE | Beverage can | علبة مشروبات ألومنيوم | — (200 / 202 ends) | lathe | 150 slim, 250 slim, 330, 330 sleek, 355, 473, 500 ml |
| CAN-FOOD-3PC | Three-piece food can | علبة أغذية ثلاثية القطع | ISO 1361 | lathe | 65×101, 73×110, 99×119, 153×178 |
| CAN-TUNA | Tuna can with ring pull | علبة تونة بحلقة فتح | ISO 1361 (83 mm) | lathe | 140, 160, 185 g |
| CAN-SARDINE | Rectangular sardine tin | علبة سردين مستطيلة | — (1/4 Club, 1/4 Dingley) | extrusion | Club, Dingley |
| CAN-OVAL-FISH | Oval fish tin | علبة أسماك بيضاوية | — | extrusion | 1/2 oval, 1/1 oval |
| TIN-GIFT-ROUND | Round biscuit and gift tin | علبة بسكويت وهدايا دائرية | — | lathe | Ø160, Ø200, Ø250 |
| TIN-GIFT-SQUARE | Square gift tin | علبة هدايا مربعة | — | extrusion | 150², 200² |
| TIN-TEA-CADDY | Tea caddy | علبة شاي معدنية | — | extrusion | 50, 100, 250 g |
| CAN-PAINT | Paint tin with lever lid | علبة دهان بغطاء ضغط | IS 2552 (reference) | lathe | 0.5, 1, 2.5, 5 l |
| CAN-AEROSOL | Aerosol can | عبوة بخاخ إيروسول | FEA 215; ASTM D3061 / EN 15007 | lathe | 150, 200, 250, 400 ml |
| CUP-YOGURT | Yogurt cup | كوب زبادي | — | lathe | Ø75/100, Ø95/150, 250, 525 ml |
| CUP-ICE-PINT | Ice cream pint | علبة آيس كريم دائرية | — | lathe | 8, 16, 32 oz |
| TUB-ICE-RECT | Rectangular ice cream tub | علبة آيس كريم مستطيلة | — | extrusion | 1 l, 2 l |
| CUP-DELI | Round deli container with lid | علبة طعام دائرية بغطاء | — | lathe | 8, 16, 32 oz |
| TRAY-CLAMSHELL | Hinged clamshell | علبة صدفية مفصلية | — | extrusion | 125², 150², 228² |
| TRAY-PUNNET | Fruit punnet | سلة فاكهة بلاستيك | — | extrusion | 250 g, 500 g, 1 kg |
| TUBE-LAMINATE | Laminate tube | أنبوبة رقائقية | — | tube | Ø25, 35, 40, 50 |
| TUBE-ALU | Aluminium tube | أنبوبة ألومنيوم | — | tube | Ø22, 28, 35 |
| TUBE-OVAL | Oval tube | أنبوبة بيضاوية | — | tube | 35, 40, 50 equivalent |

Families: `COSMETIC`, `PHARMA`, `CAN`, `TUB_CUP`, `TUBE`. Each model also has a sub-family with
bilingual names, allowed materials and closures, typical uses, and `egypt: true` on the presets common
in Egypt.

### Core kinds skipped (already in `src/lib/vessels/registry.ts`)
- `PUMP_BOTTLE`: the lotion pump bottle.
- `PERFUME_SQUARE`: the square perfume bottle. Round and oval versions are added here.
- `WIDE_JAR`: the single-wall cream jar. The double-wall jar is added here.
- `ROUND_TIN`: small slip-lid tins (Ø40-160). Large gift tins are added here.
- `STAND_UP_POUCH`: not in scope.

### Core kinds this folder supersedes (`CORE_KINDS_SUPERSEDED`)
- `DROPPER_BOTTLE` → `COS-DROPPER`: the core limits start at Ø22 × 50 mm, but 5 and 10 ml droppers need Ø18.5.
- `CAN` → `CAN-BEVERAGE`: adds the 150 slim, 355, 473 and 500 ml sizes, plus `DIRECT_PRINT`, which is how two-piece cans are actually decorated.
- `SQUEEZE_TUBE` → `TUBE-LAMINATE` / `TUBE-ALU` / `TUBE-OVAL`: these tubes are printed directly. They reuse the core tube profile through `buildProfile("SQUEEZE_TUBE")`.

## Size conventions (`CatalogueDims`, a superset of `VesselDims`)
- `D`: body diameter, or width across for square and rect sections. **Cups and tubs: rim width at the top.**
- `H`: height without the closure. For cases, tins and clamshells it is the closed height including the lid.
- `G`: depth for non-round sections. For blisters it is the cavity depth.
- `taper`: cups and tubs only, rim width minus base width (wider at the top). Core `taper` on jars means narrower at the top.
- Blisters: `rows`, `cols`, `cavityD`. There is a 4 mm sealing border.

Limits are validated with zod (`dimsSchema` / `validateDims`) using the per-model ranges plus geometry checks: the neck must fit the body, the bottle must be tall enough for its finish, the cup taper must be at most 40% of the rim, and blister cavities must fit inside the border. `clampCatalogueDims` is for sliders.

## Print surfaces
| Kind | Process | Bleed / safe | Notes |
|---|---|---|---|
| WRAP, FRONT, BACK, NECK, LID | label | 2 / 2.5 mm (core) | core builders; cones become exact annular sectors |
| SHRINK_SLEEVE | sleeve | 3 / 3 mm (core) | conforms to the profile; shrink warnings from core |
| DIRECT_PRINT | direct | 3 / 3 mm | seamless 360° with no overlap. Round: rect or sector. Non-round: section girth (`placement.type = "girth"`, s = 0 at the back centre) |
| IML | iml | 3 / 3 mm | in-mould label; tapered round cups get an exact sector |
| LID_TOP | direct | 3 / 3 mm | rect lids (sardine end, square tins, tubs, clamshell) |
| LID_FOIL | foil | 3 / 3 mm | die-cut disc or rect plus a 10 mm pull tab (below the disc in flat space) |
| CARD_FRONT / CARD_BACK | card | 3 / 3 mm | blister foil; the front lists cavity `keepOut` circles |

UVs: `printUv(spec, s, t)` → WebGL UV (v up) for a texture covering the whole print area. It is identical to the core `surfaceUv` for the core kinds.

## Sources
- Beverage cans: Ardagh can templates (250 slim Ø53.4×134, 330 sleek Ø58.1×145.4), Crown (330 Ø66×115.2), BIS can table (150 slim Ø53.6×88.5, brimful ~180 ml), Nomoq 500 ml spec (Ø66.3×168), Gamut / Ball guides (355 ≈ 122 mm, 473 ≈ 158.75 mm).
- Vials: ISO 8362-1 Table 1 via SGD Pharma tubular vial pages (4R 16×45, 10R 24×45, 20R 30×55, 50R 40×73).
- Ampoules: APG Pharma 1 ml form D (10.75×70) and 10 ml form B (17.75×102), per DIN ISO 9187-1.
- Tuna: Egycan listing (Fi Africa): Ø83 × 37 / 40 / 42 mm for 140 / 160 / 185 g. Crown / Saupiquet 83 mm ends.
- Sardine and oval: Mundolatas format table (1/4 Club 105×60×29, 1/4 Dingley 105×76×21.5, 1/2 Oval 149×81×25).
- Paint tins: Invopak 500 ml (Ø89×100), Taylor Davis / Nonpaints 2.5 l (Ø153×157), 5 l retail (Ø176×233), BIS round paint tin standard.
- Aerosols: ASTM D3061 diameter codes (45 / 52 / 57 / 65 / 70 mm), FEA 215 1-inch valve cup, BS EN 15007.
- Aluminium tubes: supplier spec sheet (Ø13.5 to 35 mm length and capacity ranges).
- Airless bottles: Berlin Packaging APAC (Ø31.9 × 79 / 102.5 / 135.2 mm overall).
- Roll-on: Flaschenland 50 ml (Ø38×88). Eye drops: DWK Wheaton 15 ml LDPE (Ø25×78 with cap), retail 10 ml (Ø20×64).
- Cups: Greiner GPI Ø95 PP cups (150 ml, 525 ml / 120 mm), Berry Global 16 oz pint (3.84 / 2.94 / 3.88 in), Pactiv Newspring and Choice deli containers (4.5 in lid, 32 oz 5.5 in tall).

Presets whose source says "approx., confirm with the supplier drawing" are typical catalogue sizes, not checked against one drawing. The capacity tests cover all of them: brimful must be within 0.95 to 1.5 × nominal, or ±20% of the stated brimful or overflow.

## Integrator to-do
1. **Registry merge.** `VesselKind`, `VesselMaterialCode`, `ClosureKind` and `PrintSurfaceKind` are closed unions in core. This folder defines supersets (`CatalogueMaterialCode`, `CatalogueClosureKind`, `CatalogueSurfaceKind`) and keys models by `code`. Either widen the core unions, or keep catalogue models in their own table keyed by `code`.
2. **Renderer.** Render `geometry.profile` with the existing lathe builder; `section.kind = "roundedRect"` already works through `sectionPoint`. Add:
   - lids from `geometry.lid`: slip, plug, lever, snap, foil, hinged and end. Each has a y range, half width and depth ratio.
   - blister cards from `geometry.blister`, as a flat card with spherical-cap cavities.
   - the `"girth"` and `"top"` placements, with UVs from `printUv`.
   - closure models for the new `CatalogueClosureKind`s. `coreKind` names the nearest existing model to fall back on.
3. **Ellipse section.** Oval perfume, oval tins, deodorant sticks and oval tubes use a stadium, which is the core roundedRect with corner = half depth. A true `{ kind: "ellipse" }` `CrossSection` would be more exact; the area difference is about 5%.
4. **Superseded kinds.** Decide whether to retire core `DROPPER_BOTTLE` and `CAN`, or keep them as aliases of `COS-DROPPER` and `CAN-BEVERAGE`.
5. **Pricing and i18n.** Add `DIRECT_PRINT`, `IML`, `LID_FOIL` and `CARD_*` processes to pricing: no label stock, `defaultStock: null`. Copy the names in `MATERIAL_NAMES` and `CLOSURE_NAMES` into i18n if needed.
6. `npx tsc --noEmit` currently reports 9 errors **outside this folder**, in dieline/pricing/designer files, because their `StructureKind` records are missing the new structures. They already exist at the base WIP commit. This folder adds none.
