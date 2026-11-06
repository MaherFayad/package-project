# FEFCO group 02: slotted-type boxes

This folder holds a parametric dieline generator for every style in group 02 of the FEFCO-ESBO International Fibreboard Case Code. Each generator produces fold data for the shared fold engine (`src/lib/dieline/fold.ts`).

```ts
import { DEFINITION_BY_CODE, buildFefco02Dieline } from "@/lib/dieline/families/fefco-02";
const model = buildFefco02Dieline(DEFINITION_BY_CODE.FEFCO_0202, { L: 400, W: 300, H: 250 }, { thicknessMm: 3, params: { overlapMm: 60 } });
```

## Models

All styles are corrugated (`E_FLUTE_KRAFT`, `E_FLUTE_WHITE`, `B_FLUTE_KRAFT`), single piece, with a glued joint. Erection codes (M, A, M/A) are as printed in the Code.

| Code | English | Arabic | Standard | Sub-family | Style params | Fidelity |
|---|---|---|---|---|---|---|
| FEFCO_0200 | Half slotted container (HSC) | علبة نصف مشقوقة مفتوحة من أعلى | FEFCO 0200 | slotted | none | exact |
| FEFCO_0201 | Regular slotted container (RSC) | علبة شحن قياسية بألسنة متلاقية | FEFCO 0201 | slotted | none | exact |
| FEFCO_0202 | Overlap slotted container (OSC) | علبة بألسنة خارجية متداخلة جزئيا | FEFCO 0202 | slotted | `overlapMm` (o) | exact |
| FEFCO_0203 | Full overlap slotted container (FOL) | علبة بألسنة خارجية متداخلة كليا | FEFCO 0203 | slotted | none | exact |
| FEFCO_0204 | Centre special slotted container (CSSC) | علبة بألسنة داخلية متلاقية في المنتصف | FEFCO 0204 | slotted | none | exact |
| FEFCO_0205 | Centre special overlap slotted container | علبة بألسنة متساوية متداخلة في المنتصف | FEFCO 0205 | slotted | none | exact |
| FEFCO_0206 | Centre special full overlap slotted container | علبة بألسنة خارجية كاملة وداخلية متلاقية | FEFCO 0206 | slotted | none | exact |
| FEFCO_0207 | Slotted box with integral bottom divisions | علبة بفواصل مدمجة في القاع | FEFCO 0207 | slotted-divided | none | simplified |
| FEFCO_0208 | Slotted box with integral flap divisions | علبة بفواصل مدمجة في الألسنة | FEFCO 0208 | slotted-divided | none | simplified |
| FEFCO_0209 | Slotted container with short top frame flaps | علبة بإطار علوي مفتوح | FEFCO 0209 | slotted-open | `rimMm` (h) | exact |
| FEFCO_0210 | Slotted box with tuck lids on the same panel | علبة بغطاءين بلسان من جهة واحدة | FEFCO 0210 | slotted-tuck | none | exact |
| FEFCO_0211 | Slotted box with reverse tuck lids | علبة بغطاءين بلسان متعاكسين | FEFCO 0211 | slotted-tuck | none | exact |
| FEFCO_0212 | Tuck lid top, slotted bottom | علبة بغطاء علوي بلسان وقاع مشقوق | FEFCO 0212 | slotted-tuck | none | exact |
| FEFCO_0214 | Slotted container with tear-off top | علبة بجزء علوي قابل للنزع | FEFCO 0214 | slotted-open | `trayHeightMm` (h < H) | exact |
| FEFCO_0215 | Tuck lid top, snap-lock bottom | علبة بغطاء بلسان وقاع مقفل يدويا | FEFCO 0215 | slotted-tuck | none | simplified |
| FEFCO_0216 | Slotted top, snap-lock bottom | علبة بألسنة علوية وقاع مقفل يدويا | FEFCO 0216 | slotted-lock | none | simplified |
| FEFCO_0217 | Gable carry box with handle | علبة حمل جملونية بمقبض | FEFCO 0217 | slotted-lock | none | simplified |
| FEFCO_0218 | Full overlap box with locking tongue | علبة بألسنة كاملة ولسان قفل | FEFCO 0218 | slotted-lock | none | simplified |
| FEFCO_0225 | Slotted box with integral base and inner liner | علبة بقاع متصل وبطانة داخلية | FEFCO 0225 | slotted-divided | `linerHeightMm` (h ≤ H) | exact |
| FEFCO_0226 | Slotted box with bevelled gusset flaps (pinch-folding top) | علبة بألسنة مائلة | FEFCO 0226 | slotted-open | `bevelFoldDeg` (default 60°) | simplified |
| FEFCO_0227 | Tall slotted box with lid flaps and thumb notch | علبة طويلة بغطاء وفتحة إصبع | FEFCO 0227 | slotted-tuck | none | exact |
| FEFCO_0228 | Slotted box with integral centre partition | علبة بفاصل أوسط مدمج | FEFCO 0228 | slotted-divided | `overlapMm` (o) | exact |
| FEFCO_0229 | Slotted box with double-folded flaps | علبة بألسنة مزدوجة الطي | FEFCO 0229 | slotted-divided | none | simplified |
| FEFCO_0230 | Slotted container with overlap joint in a length panel | علبة بوصلة متداخلة في الجانب الطويل | FEFCO 0230 | slotted | `overlapMm` (o) | exact |
| FEFCO_0231 | Slotted container with overlap joint in a breadth panel | علبة بوصلة متداخلة في الجانب القصير | FEFCO 0231 | slotted | `overlapMm` (o) | exact |

The Code assigns no styles to 0213, 0219–0224 or anything above 0231. No numbered variants (for example `0201-2`) are published either: the Code says versions "may be unique to individual manufacturers". So this folder has no variant entries.

- **Exact:** the panels and flap depths follow the drawing's dimension labels (½B, B, ½L, ½(B+o), h, l1 + l2 = L + o, and so on).
- **Simplified:** the construction follows the drawing, but secondary lock and tab cut details are reduced to plain shapes. Each definition's `notes` field says what was simplified.

## Conventions

- **Dimensions:** `Dims` are INNER mm. FEFCO's L is the longer side of the opening and B is the shorter side (B is called `W` here). H is the height.
- **Thickness compensation:** crease-to-crease sizes are L + 2t and B + 2t (one wall layer on each side), and H + (top layers + bottom layers) × t. The layers per style are in `END_LAYERS` and `definition.endLayers`. Exceptions: in 0225 the liner adds layers (L + 4t, B + 3t; its left wing sits inside the glued joint, so the liner is inset 3t on that side and 2t on the other), and in 0228, 0230 and 0231 the overlapped half-wall sits one layer further out.
- **Sheet view:** the sheet is drawn from the printed outside, laid out as joint | front L | right B | back L | left B. FEFCO draws from the inside, so this is the mirror image of the same die. The front wall is the root, so `closedRotation` is the identity.
- **Slots and flaps:** slots are 2t + 2 mm wide (4 to 8 mm). Flaps are inset by half a slot at each end. When flaps overlap, the back flap sits one layer inside the front flap and the minor flaps one layer further in (`stackOffset`).
- **Joint, bleed and safe zone:** the glued joint is 15 to 35 mm wide (at most 0.4 × H), stops 2t + 1 mm short of each end crease and is not printable. Bleed is 3 mm on cut edges only. The safe zone is 5 mm (the corrugated default).
- **3D faces:** faces are cropped to the panels that carry them. Flaps that show beside an outer flap (overlap closures, snap-lock bottoms, a frame's minors, the inner flap round a tuck tongue) join the end face (`deepEnds`): the shared fold engine leaves every stacked panel out of the faces. 0217 and 0226 have no flat top: their wall faces run on over the roof, handle or leaning flap (`stripFace`), so artwork crosses the fold without a seam.
- **Fold order:** panels fold in erection order so nothing sweeps through a wall or another flap: 0207 divisions swing in one flap at a time, 0208 / 0229 divisions are pre-folded, 0225 wings → liner → base. `__tests__/fefco02-3d.test.ts` checks every style closed (no interpenetration, no coplanar same-facing surfaces, faces covered, unmirrored) and these sequences half-way.

## Files

- `types.ts`: local types: `Fefco02Code`, `Fefco02Definition` (mirrors `StructureDef`), `Fefco02Params` and `Fefco02Model`.
- `kit.ts`: construction helpers: tube, flaps, tuck lid, 1-2-3 snap-lock bottom, hand holes.
- `styles.ts`: one generator per style (`GENERATORS`), plus `END_LAYERS` and `defaultParams`.
- `assemble.ts`: dims and params validation (zod), and `buildFefco02Dieline`. The builder does the same post-processing as the shared `generateDieline`: cut and crease lines, bleed, safe zones, faces and metrics.
- `definitions.ts`: `DEFINITIONS` / `DEFINITION_BY_CODE`: names, descriptions, limits, presets, materials, uses and features.

## Integrator checklist

1. Add the 25 `FEFCO_02xx` codes to `STRUCTURE_CODES` in `src/types/structure.ts`. `FEFCO_0201` already exists, so add only the 24 others. Then `Fefco02Model` becomes a plain `DielineModel`.
2. Register `def.generate` in `GENERATORS` (`src/lib/dieline/structures.ts`). It has the shared `Generator` signature, with style params at their defaults. Then:
   - Merge `params` into `STRUCTURE_LIMITS`.
   - Merge `defaultDims` into `DEFAULT_DIMS`.
   - Merge `features` into `FEATURE_SUPPORT`.
   - Set `STRUCTURE_FAMILY = "CORRUGATED"`.
   - Add the `ENTRIES` metadata in `registry.ts`.
   - Decide whether the existing `FEFCO_0201` (the `rsc` generator) or this one wins. They are geometrically the same; this one adds nothing beyond the shared one for 0201.
3. The new shared fields are `subFamily`, `erection`, `paramsSchema` / `defaultParams` / `generateWith` (style params), `endLayers`, `fidelity` and `notes`. Add them to `StructureDef` as optional fields if the catalogue should show them.
4. Style params (`overlapMm`, `rimMm`, `trayHeightMm`, `linerHeightMm`, `bevelFoldDeg`) need a home in `DesignDoc`, for example an optional `styleParams` field, and in the designer UI. Until then the defaults are used.
5. Seed, i18n and pricing: add the rows and rate cards. The materials are corrugated only.

## Sources

- FEFCO-ESBO, *International Fibreboard Case Code* (11th edition layout): the group 02 drawing pages and introduction (dimension conventions, joints, style versions and erection codes). The copy read was the PDF published at umbudagerdin.is (`fefco_codes_web.pdf`). Every style above was checked against its drawing.
- FEFCO technical information, "FEFCO Code": https://www.fefco.org/technical-information/fefco-code
- Supplier summaries used for cross-checking names only: IVX Packaging "FEFCO Codes in 3D", Diamond Box "FEFCO 0200 slotted type boxes", and the Kolici and PackCalc FEFCO guides.
