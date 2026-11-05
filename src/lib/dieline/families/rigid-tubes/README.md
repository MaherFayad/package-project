# Rigid boxes, paper tubes, bulk corrugated and envelopes

`src/lib/dieline/families/rigid-tubes` exports `DEFINITIONS` (20 parametric models), `DEFINITION_BY_CODE`, `definitionBySlug`, the generators, and helpers (`printAreas`, `FAMILY_MATERIALS`, `assembleDieline`). Every model builds a shared `DielineModel` (plus `catalogCode`) that the existing fold engine, face mapping, texture painter and SVG export read unchanged.

```ts
import { DEFINITION_BY_CODE } from "@/lib/dieline/families/rigid-tubes";
const def = DEFINITION_BY_CODE.RIGID_BOOK_MAGNETIC;
const model = def.generate({ L: 220, W: 160, H: 70 }, { material: "GREYBOARD_WRAP" });
def.construction?.({ L: 220, W: 160, H: 70 }); // greyboard cut list, magnets, ribbon…
```

## Models

| Code | EN | AR | Family / sub-family | Standard | Pieces |
|---|---|---|---|---|---|
| `RIGID_LID_BASE` | Rigid lid and base box | علبة صلبة بغطاء وقاعدة | RIGID / two-piece | none | 2 |
| `RIGID_SHOULDER` | Shoulder box (neck box) | علبة صلبة بكتف | RIGID / shoulder | none | 3 |
| `RIGID_BOOK_MAGNETIC` | Book-style magnetic box | علبة صلبة على شكل كتاب بغلق مغناطيسي | RIGID / book | none | 2 |
| `RIGID_DRAWER` | Drawer box with ribbon pull | علبة صلبة بدرج | RIGID / drawer | none | 2 |
| `RIGID_HINGED_LID` | Hinged lid rigid box | علبة صلبة بغطاء مفصلي | RIGID / hinged | none | 2 |
| `RIGID_COLLAPSIBLE` | Collapsible rigid box | علبة صلبة قابلة للطي | RIGID / collapsible | none | 1 |
| `RIGID_WINDOW` | Two-piece rigid box with window | علبة صلبة بنافذة | RIGID / two-piece | none | 2 |
| `TUBE_LID_BASE` | Paper tube with lid | أسطوانة ورقية بغطاء وقاعدة | TUBE / lid-base | none | 2 |
| `TUBE_ROLLED_EDGE` | Rolled-edge paper tube | أسطوانة ورقية بحافة ملفوفة | TUBE / rolled-edge | none | 2 |
| `TUBE_TELESCOPING` | Telescoping paper tube | أسطوانة ورقية تلسكوبية | TUBE / telescoping | none | 2 |
| `TUBE_PUSH_UP` | Push-up paper tube | أسطوانة ورقية بدفع سفلي | TUBE / push-up | none | 3 |
| `TUBE_WINDOW` | Paper tube with window | أسطوانة ورقية بنافذة | TUBE / window | none | 2 |
| `TUBE_SHOULDER` | Shoulder paper tube | أسطوانة ورقية بكتف | TUBE / shoulder | none | 3 |
| `PALLET_BOX` | Pallet box | صندوق بالتة | CORRUGATED / bulk | FEFCO 0201 | 1 |
| `PALLET_BOX_LID` | Pallet box with telescope lid | صندوق بالتة بغطاء تلسكوبي | CORRUGATED / bulk | FEFCO 0320 | 2 |
| `OCTABIN` | Octabin (octagonal bulk bin) | صندوق ثماني الأضلاع | CORRUGATED / bulk | none (no FEFCO number) | 1 |
| `ENVELOPE_DOCUMENT` | Document envelope | ظرف مستندات | ENVELOPE / envelope | ISO 269 | 1 |
| `MAILER_BAG` | Paper mailer bag | كيس بريدي ورقي | ENVELOPE / mailer | none | 1 |
| `PADDED_MAILER` | Padded mailer | ظرف مبطن | ENVELOPE / mailer | none (A/000…F/3 size codes) | 1 |
| `ENVELOPE_CARD` | Card envelope | ظرف بطاقة | ENVELOPE / envelope | ISO 269 (C6, DL) | 1 |

## Geometry conventions

- **Dims.** Boxes and tubes use inner mm (L front width, W depth, H height). Tubes: L = W = inner diameter (rule `L == W`). Envelopes, mailer bags and card envelopes use the **finished size**, because ISO 269 states finished sizes. W is the contents thickness, capped by a rule. Padded mailers use the **internal size**, as the trade size codes do, and the generator adds the padding (2t).
- **Rigid boxes.** The dieline is the printed wrap sheet, with one panel per greyboard face, so the 3D model shows the real board thickness t (greyboard + 0.15 mm paper). Compensation: tray base = inner + 2t; walls = H + t. Turn-ins are 8–15 mm and roll 180° over every rim (pivot depth 1). Corner tabs sit on the long walls. Lids clear the base by 0.5 mm per side; the drawer sleeve clears the drawer by 0.75 mm per side.
  - **Book box:** a separate cover piece (bottom → spine → lid → magnetic flap). The cover owns the front, back, top and bottom faces.
  - **Collapsible box:** base L = L + 6t (outer wall, trapped ear and inner board at each end). It ships flat (`glued: false`).
  - **Construction:** `construction()` lists the greyboard blanks, magnets, ribbon and hinge strip.
- **Tubes.** Each wrap label is bent from roughly 8 mm strips on virtual roll hinges into an N-gon whose apothem is the outer radius. The root strip is the left side of the tube and the closing rotation is `rotY(−90° + 180°/N)`, so the front half of the tube is one contiguous strip run on the label (straight artwork, symmetric facets). The glued overlap is 10 mm at the back seam.
  - **Window:** the strips are split above and below the aperture, and their seams are virtual.
  - **Rolled edge:** a curl flap on every strip, with virtual seams so the knife has no slits.
  - **Shoulder:** neck, body and cap; the cap is flush within its 0.4 mm clearance.
  - **Push-up:** open bottom with an inner platform tube.
- **Octabin.** Eight-panel sleeve with 45° folds. The corner leg is that of a regular octagon on the shorter side. Each outer panel width grows by 2·t·tan 22.5°. Height is H + 4t, as for FEFCO 0201. Main panels carry RSC-style flaps and the diagonals carry short corner flaps.
- **Envelopes.** The front is the root. Side flaps or seams fold 180° at pivot depth 1, the bottom flap or back panel at 1.5, and the seal flap at 2, which stacks the layers exactly. Mailer bags have a tear-strip perforation near the opening.
- **Bleed and safe zone.** Bleed is 3 mm on cut edges only (none on creases or virtual seams). The safe zone is 3 mm (5 mm corrugated). Unprinted parts (glue flaps, seams, hidden neck and platform) are removed from the faces.

## Sources

- FEFCO Code (11th ed.) style families: 0201 RSC, 0320 telescope (two 0200 halves); the 0201/0320 geometry is the engine's existing `rsc` / `telescope` generators. Pallet box examples: 0201 pallet boxes in BC double wall of 1040×710×630 and 1185×785×1070 mm (ofrex.ch); FEFCO 0300 group = lidded/telescope boxes (springpack.co.uk, kitepackaging.co.uk box style guide).
- Octabins have no FEFCO number (renubox.com lists them as "FEFCO: n/a"); base/sleeve/lid construction (Smurfit Kappa); typical size about 47 × 39 in on a pallet (US4382537).
- ISO 269 envelope sizes: C4 229×324, C5 162×229, C6 114×162, DL 110×220 mm, +1.5 mm tolerance (ISO 269:1985 sample, papersizes.org).
- Padded mailer size codes A/000 110×160, C/0 150×210, D/1 180×260, F/3 220×330 mm internal (supplier listings; codes are generic trade sizes).
- Rigid box board 1.5 to 3 mm greyboard; wrap turn-in about 15 to 20 mm in templates (xwprint.com rigid box board guide, dieline template references).
- Push-up tubes 16 to 50 mm diameter (TricorBraun push-up tube sheet); rolled-edge / curl-and-disc ends and telescoping dual-wall tubes (packaging-labelling.com, SKS).
- Pallet footprints: ISO 6780 sizes 1200×1000, 1200×800, 1100×1100 mm.

## For the integrator

1. **Codes.** Add the 20 `code`s to `STRUCTURE_CODES` (`src/types/structure.ts`) and add `"ENVELOPE"` to `StructureFamily`. Until then, `model.structureCode` is the closest shared code (`baseCode`: `RIGID_BOX`, `PAPER_TUBE`, `FEFCO_0201`, `FEFCO_0320` or `SLEEVE`), and `model.catalogCode` carries the real one.
2. **Materials.** Add the proposed material codes in `materials.ts` (`FAMILY_MATERIALS`, `shared: false`) to `MATERIAL_CODES` / `BOARD_SPECS` / the seed: `GREYBOARD_1500_WRAP`, `GREYBOARD_2500_WRAP`, `WHITE_TUBE`, `BC_FLUTE_KRAFT`, `AAA_TRIPLE_KRAFT`, `OFFSET_PAPER_100`, `KRAFT_PAPER_120`, `CARD_PAPER_160`, `PADDED_KRAFT`.
3. **Uses.** `CatalogueUse` adds `industrial`, `stationery` and `jewellery` to the `StructureDef.uses` union.
4. **Virtual edges.** `assemble.ts` mirrors the private `buildDieline` in `generate.ts`, plus `virtualEdges` (neither cut nor crease) and a filter that keeps unprinted panels out of faces. If `buildDieline` gains `virtualEdges` support, `GENERATORS[code] = (d, t, f) => def.generate…` can be wired directly. Every generator returns a `StructureDraft`-compatible draft.
5. **Features.** Supported features per model are in `def.features`: window (top for rigid, front for tube), thumb notch, lid / neck / cap depth via `lidHeightMm`, tear strip, hand holes. Partitions are not supported here.
6. **Repo state.** `npx tsc --noEmit` currently reports 9 errors outside this folder (`Record<StructureCode, …>` maps in the designer, store, pricing and core tests that predate the widened `STRUCTURE_CODES`). This folder adds none.
