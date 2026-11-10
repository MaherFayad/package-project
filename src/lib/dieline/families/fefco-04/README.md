# FEFCO group 04: folder-type boxes and trays

Parametric dieline generators for FEFCO group 04 styles: one-piece folders, five panel folders, wrap-around blanks, the Bliss container, and self-locking, glued, lidded, display, interior-flap and octagonal trays. Every model is in inner mm, validated with zod, compensated for board thickness, and returns the full core `DielineModel` (panels, hinges, fold angles and stages, cut and crease lines, 3 mm bleed, 5 mm safe zones, print regions, faces, metrics). The existing fold engine (`computePoses`, `computeFaces`) animates and maps every style unchanged.

```ts
import { DEFINITIONS, definitionByCode, generateFamilyDieline } from "@/lib/dieline/families/fefco-04";
const def = definitionByCode("0421")!;                 // or "FEFCO_0421", or the slug "fefco-0421"
const model = generateFamilyDieline(def, { L: 250, W: 180, H: 80 }, { thicknessMm: 3 });
```

## Models (82)

| FEFCO | code | en | ar | standard | sub-family | delivered | fidelity |
|---|---|---|---|---|---|---|---|
| 0400 | `FEFCO_0400` | One-piece folder | غلاف مطوي من قطعة واحدة | FEFCO 0400 | one-piece-folder | glued | interpreted |
| 0401 | `FEFCO_0401` | One-piece folder (cover across W) | غلاف مطوي من قطعة واحدة بغطاء على العرض | FEFCO 0401 | one-piece-folder | glued | described |
| 0402 | `FEFCO_0402` | One-piece folder (cover along L) | غلاف مطوي من قطعة واحدة بغطاء على الطول | FEFCO 0402 | one-piece-folder | glued | interpreted |
| 0403 | `FEFCO_0403` | One-piece folder with end buffers | غلاف مطوي بمصدات طرفية | FEFCO 0403 | one-piece-folder | glued | interpreted |
| 0412 | `FEFCO_0412` | One-piece folder with dust flaps | غلاف مطوي بألسنة جانبية | FEFCO 0412 | one-piece-folder | glued | interpreted |
| 0413 | `FEFCO_0413` | One-piece folder with dust flaps, overlapping cover | غلاف مطوي بألسنة جانبية وغطاء متراكب | FEFCO 0413 | one-piece-folder | glued | interpreted |
| 0415 | `FEFCO_0415` | One-piece folder with dust flaps and front flap | غلاف مطوي بألسنة جانبية ولسان أمامي | FEFCO 0415 | one-piece-folder | glued | interpreted |
| 0415a | `FEFCO_0415a` | One-piece folder with dust flaps, wrapped cover | غلاف مطوي بألسنة جانبية وغطاء ملتف | FEFCO 0415a | one-piece-folder | glued | interpreted |
| 0416 | `FEFCO_0416` | One-piece folder with dust and tuck flaps | غلاف مطوي بألسنة جانبية ولسان إدخال | FEFCO 0416 | one-piece-folder | unglued | interpreted |
| 0416a | `FEFCO_0416a` | One-piece folder with dust and tuck flaps, lid side flaps | غلاف مطوي بلسان إدخال وألسنة غطاء جانبية | FEFCO 0416a | one-piece-folder | unglued | interpreted |
| 0420 | `FEFCO_0420` | One-piece folder with dust flaps and hinged lid | غلاف مطوي بألسنة جانبية وغطاء متصل | FEFCO 0420 | one-piece-folder | unglued | interpreted |
| 0404 | `FEFCO_0404` | Folder-type tube | أنبوب مطوي | FEFCO 0404 | wrap-around | glued | interpreted |
| 0406 | `FEFCO_0406` | Wrap-around blank | لوح تغليف ملتف | FEFCO 0406 | wrap-around | glued | interpreted |
| 0409 | `FEFCO_0409` | Five panel folder | غلاف خماسي الألواح | FEFCO 0409 | five-panel-folder | glued | described |
| 0409a | `FEFCO_0409a` | Five panel folder, partial fifth panel | غلاف خماسي الألواح بلوح خامس جزئي | FEFCO 0409a | five-panel-folder | glued | interpreted |
| 0410 | `FEFCO_0410` | Five panel folder, end flaps on W panels | غلاف خماسي الألواح بألسنة طرفية على العرض | FEFCO 0410 | five-panel-folder | glued | interpreted |
| 0410a | `FEFCO_0410a` | Five panel folder, end flaps on W panels, partial fifth panel | غلاف خماسي الألواح بألسنة على العرض ولوح خامس جزئي | FEFCO 0410a | five-panel-folder | glued | interpreted |
| 0411 | `FEFCO_0411` | Centre seam five panel folder | غلاف خماسي الألواح بوصلة في المنتصف | FEFCO 0411 | five-panel-folder | glued | interpreted |
| 0411a | `FEFCO_0411a` | Centre seam five panel folder, offset seam | غلاف خماسي الألواح بوصلة غير متماثلة | FEFCO 0411a | five-panel-folder | glued | interpreted |
| 0405 | `FEFCO_0405` | Bliss-style container | حاوية بليس من ثلاث قطع | FEFCO 0405 | multi-piece-folder | glued | interpreted |
| 0421 | `FEFCO_0421` | Tray with self-locking end walls and hinged lid | صينية ذاتية القفل بغطاء متصل | FEFCO 0421 | lidded-tray | unglued | interpreted |
| 0421_1 | `FEFCO_0421_1` | Tray with self-locking end walls and hinged lid, lid side flaps | صينية ذاتية القفل بغطاء متصل وألسنة جانبية | FEFCO 0421.1 | lidded-tray | unglued | interpreted |
| 0421a | `FEFCO_0421a` | Tray with self-locking walls and hinged lid, double front | صينية ذاتية القفل بغطاء متصل وواجهة مزدوجة | FEFCO 0421a | lidded-tray | unglued | interpreted |
| 0422_1 | `FEFCO_0422_1` | Self-locking tray with hand holes | صينية ذاتية القفل بفتحات يد | FEFCO 0422.1 | self-locking-tray | unglued | interpreted |
| 0422_2 | `FEFCO_0422_2` | Self-locking tray with locked inner end walls | صينية ذاتية القفل بجدران داخلية مقفلة | FEFCO 0422.2 | self-locking-tray | unglued | interpreted |
| 0422a | `FEFCO_0422a` | Self-locking tray with display front | صينية ذاتية القفل بواجهة عرض | FEFCO 0422a | display-tray | unglued | interpreted |
| 0423 | `FEFCO_0423` | Tray with self-locking long walls | صينية ذاتية القفل بجدران طولية مزدوجة | FEFCO 0423 | self-locking-tray | unglued | interpreted |
| 0423_1 | `FEFCO_0423_1` | Tray with self-locking long walls and hand holes | صينية ذاتية القفل بجدران طولية مزدوجة وفتحات يد | FEFCO 0423.1 | self-locking-tray | unglued | interpreted |
| 0423a | `FEFCO_0423a` | Tray with self-locking back wall and display front | صينية ذاتية القفل بجدار خلفي مزدوج وواجهة عرض | FEFCO 0423a | display-tray | unglued | interpreted |
| 0423_1a | `FEFCO_0423_1a` | Tray with self-locking back wall, display front and hand holes | صينية عرض ذاتية القفل بفتحات يد | FEFCO 0423.1a | display-tray | unglued | interpreted |
| 0424 | `FEFCO_0424` | Tray with self-locking end walls and lock flaps | صينية ذاتية القفل بألسنة قفل سفلية | FEFCO 0424 | self-locking-tray | unglued | interpreted |
| 0424a | `FEFCO_0424a` | Tray with self-locking end walls, lock flaps and display front | صينية ذاتية القفل بألسنة قفل وواجهة عرض | FEFCO 0424a | display-tray | unglued | interpreted |
| 0425 | `FEFCO_0425` | Tray with four self-locking walls | صينية ذاتية القفل بأربعة جدران مزدوجة | FEFCO 0425 | self-locking-tray | unglued | interpreted |
| 0425a | `FEFCO_0425a` | Tray with four self-locking walls and bottom flaps | صينية بأربعة جدران مزدوجة وألسنة قاع | FEFCO 0425a | self-locking-tray | unglued | interpreted |
| 0426a | `FEFCO_0426a` | Tray with self-locking walls and hinged lid, plain lid | صينية ذاتية القفل بغطاء متصل بسيط | FEFCO 0426a | lidded-tray | unglued | interpreted |
| 0427_1 | `FEFCO_0427_1` | Mailer with locking ears, plain lid | علبة بريدية بآذان قفل وغطاء بسيط | FEFCO 0427.1 | lidded-tray | unglued | interpreted |
| 0428 | `FEFCO_0428` | Tray with foot-lock and hinged lid | صينية بقفل سفلي وغطاء متصل | FEFCO 0428 | lidded-tray | unglued | interpreted |
| 0428a | `FEFCO_0428a` | Tray with foot-lock and hinged lid, plain lid | صينية بقفل سفلي وغطاء متصل بسيط | FEFCO 0428a | lidded-tray | unglued | interpreted |
| 0429 | `FEFCO_0429` | Tray with self-locking walls and wrap-over lid | صينية ذاتية القفل بغطاء ملتف | FEFCO 0429 | lidded-tray | unglued | interpreted |
| 0429a | `FEFCO_0429a` | Tray with self-locking walls, double front and wrap-over lid | صينية ذاتية القفل بواجهة مزدوجة وغطاء ملتف | FEFCO 0429a | lidded-tray | unglued | interpreted |
| 0430 | `FEFCO_0430` | Tray with carrying handles | صينية بمقبض حمل | FEFCO 0430 | self-locking-tray | unglued | interpreted |
| 0431 | `FEFCO_0431` | Self-locking tray, double back wall | صينية ذاتية القفل بجدار خلفي مزدوج | FEFCO 0431 | self-locking-tray | unglued | interpreted |
| 0432 | `FEFCO_0432` | Self-locking tray, locked long walls | صينية ذاتية القفل بجدران طولية مقفلة | FEFCO 0432 | self-locking-tray | unglued | interpreted |
| 0432a | `FEFCO_0432a` | Self-locking tray, locked long walls and hand holes | صينية ذاتية القفل بجدران طولية مقفلة وفتحات يد | FEFCO 0432a | self-locking-tray | unglued | interpreted |
| 0433 | `FEFCO_0433` | Self-locking tray, four double walls, ears on ends | صينية ذاتية القفل بأربعة جدران مزدوجة وآذان طرفية | FEFCO 0433 | self-locking-tray | unglued | interpreted |
| 0434 | `FEFCO_0434` | Self-locking tray with carrying handles, raised ends | صينية ذاتية القفل بمقبض حمل وطرفين مرتفعين | FEFCO 0434 | self-locking-tray | unglued | interpreted |
| 0435 | `FEFCO_0435` | Display tray with self-locking walls and header | صينية عرض ذاتية القفل بلوحة إعلانية | FEFCO 0435 | display-tray | unglued | interpreted |
| 0435a | `FEFCO_0435a` | Display tray with self-locking walls, tall header | صينية عرض ذاتية القفل بلوحة إعلانية طويلة | FEFCO 0435a | display-tray | unglued | interpreted |
| 0436 | `FEFCO_0436` | Self-locking tray, four locked walls | صينية ذاتية القفل بأربعة جدران مقفلة | FEFCO 0436 | interior-flap-tray | unglued | interpreted |
| 0437 | `FEFCO_0437` | Self-locking tray, double front | صينية ذاتية القفل بواجهة مزدوجة | FEFCO 0437 | self-locking-tray | unglued | interpreted |
| 0437_1 | `FEFCO_0437_1` | Self-locking tray, double front and hand holes | صينية ذاتية القفل بواجهة مزدوجة وفتحات يد | FEFCO 0437.1 | self-locking-tray | unglued | interpreted |
| 0439 | `FEFCO_0439` | Self-locking tray with interior bottom flaps | صينية ذاتية القفل بألسنة قاع داخلية | FEFCO 0439 | interior-flap-tray | unglued | interpreted |
| 0439a | `FEFCO_0439a` | Self-locking tray with interior bottom flaps and hand holes | صينية بألسنة قاع داخلية وفتحات يد | FEFCO 0439a | interior-flap-tray | unglued | interpreted |
| 0447 | `FEFCO_0447` | Tuck-lock tray with lid | صينية بقفل إدخال وغطاء | FEFCO 0447 | lidded-tray | unglued | interpreted |
| 0449 | `FEFCO_0449` | Display tray with self-locking walls | صينية عرض ذاتية القفل | FEFCO 0449 | display-tray | unglued | interpreted |
| 0457 | `FEFCO_0457` | Tray with ear-hook lock corners | صينية بأركان مقفلة بخطاف | FEFCO 0457 | self-locking-tray | unglued | interpreted |
| 0440 | `FEFCO_0440` | Tray with stitched lid | صينية بغطاء مدبس | FEFCO 0440 | lidded-tray | glued | interpreted |
| 0441 | `FEFCO_0441` | Tray with hinged lid | صينية بغطاء متصل | FEFCO 0441 | lidded-tray | glued | interpreted |
| 0442 | `FEFCO_0442` | Tray with notch-lock corners and hinged cover | صينية بأركان مقفلة بشقوق وغطاء متصل | FEFCO 0442 | lidded-tray | unglued | interpreted |
| 0443 | `FEFCO_0443` | Rigid tray, long-wall glue flaps | صينية متينة بألسنة لصق طولية | FEFCO 0443 | glued-tray | glued | interpreted |
| 0444 | `FEFCO_0444` | Rigid tray, end-wall glue flaps | صينية متينة بألسنة لصق طرفية | FEFCO 0444 | glued-tray | glued | interpreted |
| 0445 | `FEFCO_0445` | Jointless tray | صينية بدون وصلة | FEFCO 0445 | glued-tray | unglued | interpreted |
| 0448 | `FEFCO_0448` | Side-slotted tray with folding flaps | صينية بشقوق جانبية وألسنة منثنية | FEFCO 0448 | glued-tray | glued | interpreted |
| 0450 | `FEFCO_0450` | End-slotted tray with folding wall | صينية بشقوق طرفية وجدار منثن | FEFCO 0450 | glued-tray | glued | interpreted |
| 0451 | `FEFCO_0451` | Side-slotted tray with folding wall | صينية بشقوق جانبية وجدار منثن | FEFCO 0451 | glued-tray | glued | interpreted |
| 0451_1 | `FEFCO_0451_1` | Side-slotted tray with folding front wall | صينية بشقوق جانبية وجدار أمامي منثن | FEFCO 0451.1 | glued-tray | glued | interpreted |
| 0451_2 | `FEFCO_0451_2` | Side-slotted tray with two folding walls | صينية بشقوق جانبية وجدارين منثنيين | FEFCO 0451.2 | glued-tray | glued | interpreted |
| 0452 | `FEFCO_0452` | Side-slotted tray | صينية بشقوق جانبية | FEFCO 0452 | glued-tray | glued | described |
| 0453 | `FEFCO_0453` | End-slotted tray | صينية بشقوق طرفية | FEFCO 0453 | glued-tray | glued | described |
| 0454 | `FEFCO_0454` | End-slotted tray with double walls | صينية بشقوق طرفية وجدران مزدوجة | FEFCO 0454 | glued-tray | glued | interpreted |
| 0454_1 | `FEFCO_0454_1` | End-slotted tray with locked double walls | صينية بشقوق طرفية وجدران مزدوجة مقفلة | FEFCO 0454.1 | glued-tray | glued | interpreted |
| 0455 | `FEFCO_0455` | Side-slotted tray with double end walls | صينية بشقوق جانبية وجدران طرفية مزدوجة | FEFCO 0455 | glued-tray | glued | interpreted |
| 0455_1 | `FEFCO_0455_1` | Side-slotted tray with locked double end walls | صينية بشقوق جانبية وجدران طرفية مزدوجة مقفلة | FEFCO 0455.1 | glued-tray | glued | interpreted |
| 0458 | `FEFCO_0458` | Container with wrap-over lid | حاوية بغطاء ملتف | FEFCO 0458 | lidded-tray | glued | interpreted |
| 0459 | `FEFCO_0459` | Octagonal tray | صينية ثمانية الأضلاع | FEFCO 0459 | octagonal-tray | glued | interpreted |
| 0460 | `FEFCO_0460` | Tray with raised end panels | صينية بألواح طرفية مرتفعة | FEFCO 0460 | display-tray | unglued | interpreted |
| 0470 | `FEFCO_0470` | Self-locking tray with interior bottom flaps and lid | صينية ذاتية القفل بألسنة قاع داخلية وغطاء | FEFCO 0470 | interior-flap-tray | unglued | interpreted |
| 0471 | `FEFCO_0471` | Self-locking mailer with interior bottom flaps | علبة بريدية ذاتية القفل بألسنة قاع داخلية | FEFCO 0471 | interior-flap-tray | unglued | interpreted |
| 0471a | `FEFCO_0471a` | Self-locking tray with interior bottom flaps, open | صينية مفتوحة ذاتية القفل بألسنة قاع داخلية | FEFCO 0471a | interior-flap-tray | unglued | interpreted |
| 0472 | `FEFCO_0472` | Self-locking display tray with interior bottom flaps | صينية عرض ذاتية القفل بألسنة قاع داخلية | FEFCO 0472 | interior-flap-tray | unglued | interpreted |
| RETF | `MAILER_RETF` | Gift box (tuck front) | علبة هدايا بلسان أمامي | RETF (FEFCO 0427 family) | mailer | unglued | described |
| RETF_PLAIN | `MAILER_RETF_PLAIN` | Gift box (tuck front, plain tuck) | علبة هدايا بلسان أمامي بسيط | RETF (FEFCO 0427 family) | mailer | unglued | interpreted |
**Fidelity.** `described`: a published text description confirms the construction (0401 and 0409 verbatim, 0452 and 0453 from a secondary guide). `interpreted`: the code and official name are confirmed, but the panel arrangement was reconstructed from the name and the group's construction rules, not from the licensed drawing. See "Verification" below.

### Already in the core engine (skipped here)

| FEFCO | core `StructureCode` |
|---|---|
| 0422 | `FEFCO_0422` (self-locking display tray) |
| 0426 | `PIZZA` |
| 0427 | `FEFCO_0427` (mailer) |

Their variants (0422_1, 0422_2, 0422a, 0426a, 0427_1) **are** generated here.

### Not generated

| FEFCO | reason |
|---|---|
| 0446 Tray with twenty holders | Needs a separate 4 × 5 holder insert. That is a multi-piece insert, not a folder. Add it once the core partitions builder (`addPartitions`) is exported. |
| 0473 Recessed end box | The recessed ends need compound (non-hinge-chain) folds that the panel tree cannot close yet. |
| 0474 to 0477 | Not in any published group 04 list I could find. The engview FEFCO library stops at 0473 and has no 0438, 0456 or 0461 to 0469. |

## How it is built

- `kit.ts`, **`trayKit`**: one construction kit for every base-hinged 04 style. Options: rolled double walls per wall, corner ears on the long walls or the end walls, interior bottom flaps at the foot of rolled walls, top closure (none, cover flaps meeting / overlapping / rim, or a hinged lid with tuck or outside front flap and dust, rounded or outside side flaps), display cut-down front, back header, raised ends, and hand holes through both layers. Layers are counted per wall, so closed inner = requested inner (for example, 0421 outer = L + 6t, W + 2t, H + 2t).
- `wraps.ts`, **`wrapFolder`**: chain-of-panels tubes (0404, 0406, 0409 to 0411 and their variants). Joint options are glue flap, fifth overlap panel, or centre or offset seam. End flaps can meet or fully overlap on the W or H panels.
- `bliss.ts`: 0405 as three pieces. Two end panels are placed with core `piece()` and assembly matrices, and their glue flaps fold onto the inside of the body.
- `retf.ts`, **`retfMailer`**: roll end tuck front gift boxes (`MAILER_*` codes, the construction suppliers sell as RETF mailers, sub-family `mailer`), drawn after the owner's die (`docs/owner-input/2026-11-10`, measured in `docs/audit/gift-box-tuck-front.md`). Single front wall, square ears about H deep on front and back, rolled double end walls whose inner walls lock into base slots with two tabs each, rounded (or trapezoid) lid side flaps, full-depth tuck with rounded side wings (or a plain round-cornered tuck) and a thumb notch on the tuck. Options: lid window, tear strip, divider insert (`addPartitions` from the core). Priced as `FEFCO_0427`.
- `octagon.ts`: 0459, with a chamfered octagonal base, 8 walls, and triangular glue ears that fold 45° and fit the 45° gap on the flat sheet.
- `build.ts`: **`generateFamilyDieline`**, a copy of the core `buildDieline` post-processing (normalise, cut/crease, bleed, faces, safe zones, metrics). It is needed because `GENERATORS` / `generateDieline` only accept the closed `StructureCode` union. It also holds the zod limits (`familyDimsSchema`, `validateFamilyDims`, same rule syntax as core: `"H <= W"`) and `familyFeatures`.
- Fold stages: 0 walls, 1 ears / inner end flaps, 2 rolled inner walls / outer end flaps, 3 interior bottom flaps, 4 to 5 covers and lids.

## Tests

`__tests__/fefco-04.test.ts` has 334 tests. For every model, at the default size (E and B flute), every preset and the size limits, it checks:

- no NaN or Infinity anywhere in the model
- sheet = die + 2 × 3 mm bleed
- the panel tree is valid
- the flat blank has no overlapping panels (it can be cut)
- bleed regions cover each panel, glue flaps stay ink-free, and safe zones sit inside their panels
- net area ≤ blank area
- closed outer ≥ inner and ≤ inner + 8t (H ≤ inner + 4t except header and raised-end styles)
- the required faces exist

Construction checks:

- interior bottom flaps lie on the base inside the walls (fold sign)
- rolled walls hang inside
- exact thickness compensation for 0421, 0409 and 0405
- 0405 is three pieces whose end panels form the left and right faces
- the 0459 base is an octagon
- display fronts and headers are in place
- hand holes go through both layers
- windows are cut only where supported

Metadata checks: unique codes, slugs and names; Arabic present with no diacritics; 2 to 4 presets inside the limits.

## Integrator to-do

1. **New shared types (local for now, in `types.ts`):**
   - `Fefco04Definition` mirrors `StructureDef` but has `code: string` (`FEFCO_0421_1`).
   - `pieces: 1 | 2 | 3`: Bliss 0405 has 3 pieces, but core `StructureDef.pieces` is `1 | 2`.
   - Adds `fefco`, `subFamily`, `fidelity` and `generate`.
   - `Fefco04Model` is `DielineModel` with a string `structureCode`.
   - To merge: widen `StructureCode` (or add a family-code registry), let `GENERATORS` accept `def.generate`, and delete `build.ts` in favour of core `generateDieline`.
2. **Pricing:** `metrics.blankAreaM2` already sums the three blanks for 0405. Add flat-pack and gluer specs per `glued`.
3. **Seed / catalogue:** each definition has slug, names, descriptions, params, `defaultDims`, presets, materials (corrugated only), features and uses, ready for `Structure` rows.
4. **Standard strings:** variants use the FEFCO dot convention, for example `FEFCO 0421.1`, `FEFCO 0422a`.
5. **Verification:** before shipping `interpreted` styles to vendors, compare each one against the licensed FEFCO Code (11th edition) drawing. Adjust it by editing the option set in `catalog.ts`; generators do not need changes.
6. **Repo state:** `npx tsc --noEmit` currently reports 9 errors, all in files outside this folder (designer/store catalogues, pricing, core dieline test). They come from the in-progress `StructureCode` expansion. None are in this folder.

## Sources

- engview FEFCO library, group 0400 index (codes and official names, incl. variants 0409a, 0421_1, 0422_2, 0423_1a…): https://www.engview.com/online_help/7.3/packaging_library/en/Corrugated_Standards_Library/FEFCO_Standards_Library/F_0400/F_0400.htm
- W H Skinner, FEFCO style guide (0401, 0403, 0405, 0415, 0421, 0452/0453, 0470, 0471 construction and uses): https://www.whskinner.co.uk/guide-to-fefco-box-styles/
- IVX Packaging, FEFCO codes in 3D (0401, 0403, 0409, 0427, 0471 construction): https://www.ivxpackaging.com/fefco.html
- Kite Packaging, box style guide (group 04 definition: "the bottom of the box is hinged to form two or all side walls and the cover"; variant suffix convention): https://www.kitepackaging.co.uk/mcp/box-style-guide/
- Kolici, FEFCO codes (variant notation, 0422/0427 titles): https://www.kolici.com/fefco-codes
