# FEFCO group 09: interior fittings

Pads, liners, cell tubes, slotted partitions (N × M cells), cushion and clearance pads, scored sheets, and corner and edge protectors. All 48 styles listed in the FEFCO 09 index from 0900 to 0976 are covered, including the "a" variants.

Each fitting is sized from its **host box's inner dims** plus options (cell counts, height, leg size, layers, clearance). It returns a `FittingModel`: the shared `DielineModel` shape (panels, hinges, fold angles, cut and crease lines, 3 mm bleed, 5 mm safe zones, faces, metrics), so the existing fold engine and SVG export can use it. It also carries `placement.matrix`, which maps the closed fitting into host inner space.

```ts
import { DEFINITIONS, FITTINGS, generateFitting } from "@/lib/dieline/families/fefco-09";
const m = generateFitting("FEFCO_0933", { host: { L: 360, W: 270, H: 130 }, rows: 3, cols: 4 }, { thicknessMm: 1.5 });
m.placement.matrix; // column-major 4×4: fitting model space → host inner space (origin at the inner bottom-left-back corner, x = L, y = up, z = W toward the front)
```

## Models

| FEFCO | Code | Sub-family | English | Arabic | Standard | Slot in host | Options |
|---|---|---|---|---|---|---|---|
| 0900 | `FEFCO_0900` | PAD | Inner flap fill-in pad | حشوة فراغ الألسنة الداخلية | FEFCO 0900 | floor-gap | clearanceMm |
| 0901 | `FEFCO_0901` | PAD | Full bottom pad | لوح قاع كامل | FEFCO 0901 | floor | clearanceMm |
| 0902 | `FEFCO_0902` | PAD | Full W-side (end wall) pad | لوح تغطية الجانب القصير | FEFCO 0902 | end-wall | clearanceMm |
| 0903 | `FEFCO_0903` | PAD | Full L-side wall pad | لوح تغطية الجانب الطويل | FEFCO 0903 | side-wall | clearanceMm |
| 0904 | `FEFCO_0904` | LINER | Open U-liner, bottom and end walls | بطانة مفتوحة للقاع والجانبين القصيرين | FEFCO 0904 | walls | clearanceMm, heightMm |
| 0905 | `FEFCO_0905` | LINER | Open U-liner, bottom and long walls | بطانة مفتوحة للقاع والجانبين الطويلين | FEFCO 0905 | walls | clearanceMm, heightMm |
| 0906 | `FEFCO_0906` | LINER | Open four-wall liner | بطانة مفتوحة للجدران الأربعة | FEFCO 0906 | walls | clearanceMm, heightMm |
| 0907 | `FEFCO_0907` | LINER | Open L-liner, bottom and one long wall | بطانة زاوية للقاع وجدار طويل | FEFCO 0907 | walls | clearanceMm, heightMm |
| 0908 | `FEFCO_0908` | LINER | Open L-liner, bottom and one end wall | بطانة زاوية للقاع وجدار قصير | FEFCO 0908 | walls | clearanceMm, heightMm |
| 0909 | `FEFCO_0909` | LINER | Wrap liner around the length | بطانة ملتفة حول الطول | FEFCO 0909 | walls | clearanceMm |
| 0910 | `FEFCO_0910` | LINER | Wrap liner around the width | بطانة ملتفة حول العرض | FEFCO 0910 | walls | clearanceMm |
| 0911 | `FEFCO_0911` | LINER | Side-slotted liner tray | صينية بطانة بجوانب مشقوقة | FEFCO 0911 | walls | clearanceMm, heightMm, cols |
| 0913 | `FEFCO_0913` | LINER | Open five-panel liner | بطانة مفتوحة للقاع والجدران الأربعة | FEFCO 0913 | walls | clearanceMm, heightMm |
| 0914 | `FEFCO_0914` | LINER | Full-overlap closure liner | بطانة بغطاء متداخل كامل | FEFCO 0914 | walls | clearanceMm |
| 0920 | `FEFCO_0920` | COMPARTMENT | Open compartment liner, cross dividers | بطانة بحجرات عرضية | FEFCO 0920 | cells | clearanceMm, heightMm, compartments |
| 0921 | `FEFCO_0921` | COMPARTMENT | Open compartment liner, long dividers | بطانة بحجرات طولية | FEFCO 0921 | cells | clearanceMm, heightMm, compartments |
| 0929 | `FEFCO_0929` | PARTITION | C partition | فاصل بطرفين مثنيين | FEFCO 0929 | cells | clearanceMm, heightMm |
| 0930 | `FEFCO_0930` | PARTITION | Four-cell partition | فاصل أربع خانات | FEFCO 0930 | cells | clearanceMm, heightMm |
| 0931 | `FEFCO_0931` | PARTITION | Single-cell extension partition | فاصل خانة واحدة ممتد | FEFCO 0931 | cells | clearanceMm, heightMm |
| 0932 | `FEFCO_0932` | PARTITION | Single-cell support partition | فاصل خانة واحدة بحواف ارتكاز | FEFCO 0932 | cells | clearanceMm, heightMm, sizeMm |
| 0933 | `FEFCO_0933` | PARTITION | Slotted cell partition (N × M) | فاصل متعاشق متعدد الخانات | FEFCO 0933 | cells | clearanceMm, heightMm, rows, cols |
| 0934 | `FEFCO_0934` | PARTITION | Fifteen-cell extension partition | فاصل متعاشق 15 خانة | FEFCO 0934 | cells | clearanceMm, heightMm, rows, cols |
| 0935 | `FEFCO_0935` | PARTITION | Twelve-cell partition with high divider | فاصل 12 خانة بحاجز مرتفع | FEFCO 0935 | cells | clearanceMm, rows, cols, heightMm, highMm |
| 0940 | `FEFCO_0940` | CUSHION | Cushion pad, ends folded under | وسادة حماية بطرفين مطويين | FEFCO 0940 | floor | clearanceMm, sizeMm |
| 0941 | `FEFCO_0941` | CUSHION | Double-layer cushion pad | وسادة حماية مزدوجة | FEFCO 0941 | floor | clearanceMm |
| 0942 | `FEFCO_0942` | CUSHION | Z-fold cushion pad | وسادة حماية مطوية ثلاث طبقات | FEFCO 0942 | floor | clearanceMm, layers |
| 0943 | `FEFCO_0943` | CLEARANCE | Clearance pad, two legs | لوح رفع بساقين | FEFCO 0943 | floor | clearanceMm, heightMm |
| 0944 | `FEFCO_0944` | CLEARANCE | Clearance pad, four skirts | لوح رفع بأربع جوانب | FEFCO 0944 | floor | clearanceMm, heightMm |
| 0945 | `FEFCO_0945` | CUSHION | Cushion pad, four edges folded under | وسادة حماية بحواف مطوية | FEFCO 0945 | floor | clearanceMm, sizeMm |
| 0946 | `FEFCO_0946` | CUSHION | Cushion pad, triangular end rails | وسادة حماية بقضبان مثلثة طرفية | FEFCO 0946 | floor | clearanceMm, sizeMm |
| 0947 | `FEFCO_0947` | CUSHION | Cushion pad, triangular side rails | وسادة حماية بقضبان مثلثة جانبية | FEFCO 0947 | floor | clearanceMm, sizeMm |
| 0948 | `FEFCO_0948` | CUSHION | Cushion pad, square end rails | وسادة حماية بقضبان مربعة | FEFCO 0948 | floor | clearanceMm, sizeMm |
| 0949 | `FEFCO_0949` | CUSHION | Cushion pad, raised end walls | وسادة حماية بجدارين قائمين | FEFCO 0949 | floor | clearanceMm, heightMm |
| 0949a | `FEFCO_0949A` | CUSHION | Cushion pad, double end walls | وسادة حماية بجدارين مزدوجين | FEFCO 0949a | floor | clearanceMm, heightMm |
| 0950 | `FEFCO_0950` | CUSHION | Accordion cushion pad, four layers | وسادة حماية أكورديون أربع طبقات | FEFCO 0950 | floor | clearanceMm, layers |
| 0950a | `FEFCO_0950A` | CUSHION | Accordion cushion pad, five layers | وسادة حماية أكورديون خمس طبقات | FEFCO 0950a | floor | clearanceMm, layers |
| 0951 | `FEFCO_0951` | SCORED_SHEET | Scored sheet | لوح مسطح بخطوط طي | FEFCO 0951 | floor | clearanceMm, scores |
| 0967 | `FEFCO_0967` | SCORED_SHEET | Cross-scored sheet | لوح مسطح بخطوط طي متقاطعة | FEFCO 0967 | floor | clearanceMm, scores |
| 0970 | `FEFCO_0970` | CORNER | Angle edge protector | واقي حافة زاوي | FEFCO 0970 | corner | sizeMm, heightMm |
| 0971 | `FEFCO_0971` | CORNER | Three-face corner protector | واقي ركن ثلاثي الأوجه | FEFCO 0971 | corner | sizeMm, heightMm |
| 0971a | `FEFCO_0971A` | CORNER | Three-face corner protector with tab | واقي ركن ثلاثي الأوجه بلسان | FEFCO 0971a | corner | sizeMm, heightMm |
| 0972 | `FEFCO_0972` | CORNER | U edge protector | واقي حافة على شكل قناة | FEFCO 0972 | edge | clearanceMm, sizeMm, heightMm |
| 0972a | `FEFCO_0972A` | CORNER | Lipped U edge protector | واقي حافة قناة بشفتين | FEFCO 0972a | edge | clearanceMm, sizeMm, heightMm |
| 0973 | `FEFCO_0973` | CORNER | Triangular edge brace | دعامة حافة مثلثة | FEFCO 0973 | edge | clearanceMm, sizeMm |
| 0974 | `FEFCO_0974` | CORNER | Corner brace pad, one end | لوح قاع بدعامة طرفية | FEFCO 0974 | floor | clearanceMm, sizeMm |
| 0975 | `FEFCO_0975` | CORNER | Corner brace pad, both ends | لوح قاع بدعامتين طرفيتين | FEFCO 0975 | floor | clearanceMm, sizeMm |
| 0976 | `FEFCO_0976` | CORNER | Triangular corner post | عمود ركن مثلث | FEFCO 0976 | corner | sizeMm, heightMm |
| 0976a | `FEFCO_0976A` | CORNER | Square corner post | عمود ركن مربع | FEFCO 0976a | corner | sizeMm, heightMm |

Every model also has: a slug (`fefco-<number>-<name>`), short ar/en descriptions, materials (corrugated E/B; small pads, partitions and protectors also allow `SBS_350`), typical uses, host limits, a default host and 2 to 4 host presets. The presets are common Egyptian carton sizes, plus bottle and jar shippers with cell counts for partitions. Each definition also carries an `interpretation` string that records how its geometry was derived.

## Geometry conventions

- **Clearance**: `clearanceMm` is the total fit allowance per dimension (host inner − fitting outer), default 3 mm.
- **Liners** follow the box convention: the printed (outside) face is against the host walls, and positive folds go to the inside. **Pads and cushions** are printed face up.
- **Slotted partitions**: there are cols − 1 strips across W and rows − 1 strips along L, and cells are equal: `cell = (inner − (n − 1)·t) / n`. Strips along L are slotted from the bottom and strips across W from the top. Slots are t + 0.6 mm wide and half the low strip height deep, so the strips interlock flush. Each strip is its own blank, placed as an extra piece with an `assembly` matrix so it animates into place. The minimum cell opening is 25 mm.
- **0900**: RSC (0201) inner flaps are W/2 deep and leave an (L − W) × W gap between them. The pad fills that gap with its top flush with the inner floor, so it sits 1 t below y = 0.
- 180° roll-backs (cushions, compartment risers) use `pivotDepth` 1 when they fold to the inside and 0 when they fold to the printed side, so the layers stack without z-fighting.
- **Triangular braces** (0946, 0947 rails; 0973–0976 braces and posts) share `triangleBrace` in `engine.ts`. The closed section is exactly s × s at any caliper: the hypotenuse face pivots (√2 − 1)·t below its printed face so its bevelled end stays inside the leg, the leg is (1 − 1/√2)·t shorter to absorb that, and the face stops one caliper short of the parent so the glue tab lies flat against the parent's back (no shared board, no z-fighting). The square rail (0948) has its inner wall one caliper short for the same reason.
- **Walls folded up toward the printed face** (0949, 0949a) pivot on the unprinted face (`pivotDepth` 1, the outside of that bend), so the outer length stays L′. The 0949a return is one caliper shorter and rests on the pad.
- Tests check every model at 0.5, 1.5, 3 and 4 mm for every preset: placed bounds inside the host with **no** slack, closed size equal to `outer()`, and no two parallel panels sharing board volume (`__tests__/overlap.ts`).

## Sources

- FEFCO 09 index with per-code titles: theessentialimage.com FEFCO Standards Library, F_0900 (https://www.theessentialimage.com/Packaging%20Catalogue/Html5_Packaging/Corrugated_Standards_Library/FEFCO_Standards_Library/F_0900/F_0900.htm). The titles used here come from it, e.g. "0904 Open Liner (LWH)", "0930 Four Cell Partition", "0943 Clearance Pad", "0970 Corner Protector", "0973 Corner Brace Pad".
- A-PAK FEFCO code list (https://a-pak.lt/en/fefco-codes/): the codes that exist in the 09 group.
- easypackmaker FEFCO introduction (https://easypackmaker.com/fefcointro): group 09 is interior fitments, and "any shown number of panels is arbitrary and may be increased".
- FEFCO 0201 geometry from the core engine (inner flap depth W/2), used for 0900.

**Verification caveat.** No public source gives the per-code drawings or panel sequences as text, only the titles. Panel layouts here come from each code's title and dimension notation, using standard converter practice, and are recorded per model in `interpretation`. Check them against the official FEFCO-ESBO catalogue drawings (12th edition) before using them to promise a buyer an exact FEFCO match. 0965 and 0966 appear in one code list with no title or drawing, so they are **not** modelled.

## Integrator notes

1. **New shared types needed.** This folder defines its own `FittingCode` (`FEFCO_0900` … `FEFCO_0976A`), `FittingDefinition`, `FittingModel`, `FittingParams` and `FittingSlot` in `types.ts`. These codes are not members of `StructureCode`. To list fittings in the DB or catalogue, either extend `STRUCTURE_CODES` and `StructureFamily` (add `"INTERIOR_FITTING"`), or keep fittings as a separate catalogue keyed by `FittingCode`.
2. **Engine.** `generateDieline` / `GENERATORS` are keyed by `StructureCode`, so this folder carries its own `finalizeFitting` (a copy of the core `buildDieline` steps). A `FittingModel` is structurally a `DielineModel` except that `structureCode` is a `FittingCode`. Cast with `as unknown as DielineModel` for `dielineToSvg`, `computePoses`, the 3D `PackagingModel`, etc. (the tests already do this for SVG). If the core `buildDieline` is ever exported, `finalizeFitting` can call it.
3. **Rendering inside a box.** Render the fitting's closed model under `placement.matrix`, composed with the host box's "inner bottom-left-back corner" transform. For a core box closed model, that is `T(innerMin)`: the inner floor at y = floor board thickness, inner x/z starting one wall thickness in.
4. **Partitions vs. `StructureFeatures.partitions`.** The core `addPartitions` (inside rsc / telescope / rigid) is a simplified version of FEFCO 0933. For a stand-alone, priced partition, use `FEFCO_0933` (or 0930 / 0934 / 0935) with the host's inner dims and the same rows/cols.
5. **Pricing.** `metrics.blankAreaM2` sums each piece's blank rectangle (one per partition strip), and `metrics.pieceCount` counts the separate blanks.
6. **i18n.** Names and descriptions are inline `LocalizedText`. No dictionary keys were added.
7. Pre-existing `tsc` errors in `src/components/{designer,store}/catalog.ts`, `src/lib/pricing/*` and `src/lib/dieline/__tests__/dieline.test.ts` (records missing the newer StructureCodes) come from the shared snapshot. They are not in this folder.
