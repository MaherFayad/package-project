# FEFCO 03 (telescope) + 05 (slide): parametric dielines

This folder covers every style that FEFCO Code 11th edition lists in group 03 (telescope type) and group 05 (slide type). Each style has its own generator, written against the core `DielineBuilder` / `StructureDraft` contracts. It produces a die (cut, crease and perforation lines), panels with hinge edges, fold angles and stages, glue flaps, 3 mm bleed, safe zones, faces, and the closed pose of every extra blank. Styles with two or three pieces return all their blanks on one sheet. Each extra blank (lid, caps, inner sleeve, liner) is an `assembly` root that the fold engine moves into place.

```ts
import { DEFINITIONS, DEFINITION_BY_CODE, generateFamilyDieline } from "@/lib/dieline/families/fefco-03-05";
const m = generateFamilyDieline(DEFINITION_BY_CODE.FEFCO_0301, { L: 330, W: 250, H: 100 }, { thicknessMm: 1.5, features: { lidHeightMm: 40 } });
```

All dimensions are **inner mm** (L = front width, W = depth, H = height). Panels measure crease to crease: inner + 2 × layers × t. This is the same thickness compensation `structures.ts` uses.

## Models

| Code | EN | AR | Standard | Pieces | Sub-family |
|---|---|---|---|---|---|
| FEFCO_0300 | Telescope tray and lid, corner flaps | علبة تلسكوبية بقاعدة وغطاء بألسنة ركنية | FEFCO 0300 | 2 | telescope-tray-lid |
| FEFCO_0301 | Telescope tray and lid, alternating flaps | علبة تلسكوبية بألسنة ركنية متبادلة | FEFCO 0301 | 2 | telescope-tray-lid |
| FEFCO_0302 | Telescope tray and lid, taped corners | علبة تلسكوبية بأركان مشرطة | FEFCO 0302 | 2 | telescope-tray-lid |
| FEFCO_0303 | Telescope box, gusset corners folded outside | علبة تلسكوبية بأركان مثنية للخارج | FEFCO 0303 | 2 | telescope-tray-lid |
| FEFCO_0304 | Telescope box, gussets folded on end walls | علبة تلسكوبية بأركان مثنية على الجدار الجانبي | FEFCO 0304 | 2 | telescope-tray-lid |
| FEFCO_0306 | Telescope box with shallow cap | علبة تلسكوبية بغطاء قصير | FEFCO 0306 | 2 | telescope-tray-lid |
| FEFCO_0307 | Telescope box, locking-tab corners | علبة تلسكوبية بألسنة قفل | FEFCO 0307 | 2 | telescope-tray-lid |
| FEFCO_0308 | Telescope box, inside gussets with relief slots | علبة تلسكوبية بأركان مثنية للداخل مع شقوق | FEFCO 0308 | 2 | telescope-tray-lid |
| FEFCO_0309 | Telescope box, inside gussets without slots | علبة تلسكوبية بأركان مثنية للداخل بدون شقوق | FEFCO 0309 | 2 | telescope-tray-lid |
| FEFCO_0310 | Sleeve with top and bottom caps | علبة ثلاثية القطع بغلاف وغطاءين | FEFCO 0310 | 3 | telescope-caps |
| FEFCO_0312 | Half-slotted body with cap lid | علبة شحن بقاع ذي ألسنة وغطاء منفصل | FEFCO 0312 | 2 | telescope-caps |
| FEFCO_0313 | Slotted body with two deep caps | علبة شحن قياسية بغطاءين عميقين | FEFCO 0313 | 3 | telescope-caps |
| FEFCO_0314 | Sleeve with self-locking caps | علبة ثلاثية القطع بأغطية ذاتية القفل | FEFCO 0314 | 3 | telescope-caps |
| FEFCO_0320 | Two-piece half-slotted telescope box | علبة تلسكوبية من قطعتين بألسنة | FEFCO 0320 | 2 | telescope-slotted |
| FEFCO_0321 | Telescope set with envelope flaps | علبة تلسكوبية بألسنة مدببة | FEFCO 0321 | 2 | telescope-slotted |
| FEFCO_0322 | Friction-lock tray and lid, double end walls | علبة تلسكوبية بجدران مزدوجة على الطرفين | FEFCO 0322 | 2 | telescope-tray-lid |
| FEFCO_0323 | Double-wall slip-lid presentation box | علبة تلسكوبية بجدران مزدوجة من الجهات الأربع | FEFCO 0323 | 2 | telescope-tray-lid |
| FEFCO_0325 | Sleeve with internal caps | غلاف بغطاءين داخليين | FEFCO 0325 | 3 | telescope-caps |
| FEFCO_0330 | Self-assembly tray and cap, locking noses | علبة تلسكوبية ذاتية التجميع بألسنة قفل | FEFCO 0330 | 2 | telescope-tray-lid |
| FEFCO_0331 | Rolled-edge tray and cap | علبة تلسكوبية بحواف ملفوفة | FEFCO 0331 | 2 | telescope-tray-lid |
| FEFCO_0350 | Octabin with flap bottom and cap | حاوية ثمانية بقاع ذي ألسنة وغطاء | FEFCO 0350 | 2 | telescope-octabin |
| FEFCO_0351 | Octabin, symmetrical sides, two caps | حاوية ثمانية متماثلة بغطاءين | FEFCO 0351 | 3 | telescope-octabin |
| FEFCO_0352 | Octabin with longer side panels | حاوية ثمانية بجوانب طويلة | FEFCO 0352 | 3 | telescope-octabin |
| FEFCO_0501 | Sleeve open top and bottom | غلاف مفتوح من أعلى وأسفل | FEFCO 0501 | 1 | slide-sleeve |
| FEFCO_0502 | Sleeve open on length and height sides | غلاف مفتوح من الأمام والخلف | FEFCO 0502 | 1 | slide-sleeve |
| FEFCO_0503 | Slip sleeve open at both ends | غلاف منزلق مفتوح الطرفين | FEFCO 0503 | 1 | slide-sleeve |
| FEFCO_0504 | Closed sleeve set (0501 + 0502) | طقم غلافين متداخلين 0501 و0502 | FEFCO 0504 | 2 | slide-set |
| FEFCO_0505 | Closed sleeve set (0502 + 0503) | طقم غلافين متداخلين 0502 و0503 | FEFCO 0505 | 2 | slide-set |
| FEFCO_0507 | Closed sleeve set (0501 + 0503) | طقم غلافين متداخلين 0501 و0503 | FEFCO 0507 | 2 | slide-set |
| FEFCO_0509 | Slide closure set (liner + sleeve) | علبة منزلقة بغلاف وبطانة | FEFCO 0509 | 2 | slide-set |
| FEFCO_0510 | Wrap in sleeve with top flap | علبة بلفافة وغلاف ولسان علوي | FEFCO 0510 | 2 | slide-set |
| FEFCO_0511 | Wrap in sleeve with end dust flaps | علبة بلفافة وغلاف بألسنة طرفية | FEFCO 0511 | 2 | slide-set |
| FEFCO_0512 | Wrap with internal end liner | علبة بلفافة وبطانة داخلية | FEFCO 0512 | 2 | slide-set |

**Codes that do not exist.** No source lists 0305, 0311, 0315–0319, 0324, 0326–0329, 0332–0349, 0500, 0506, 0508 or 0513 in the FEFCO 11th edition, so they are not modelled. Two codes appear only in single supplier catalogues: 0319, and 0360 (hexagonal). I could not confirm either as a FEFCO style, so I left them out.

**Full vs partial telescope.** Every lid and cap depth follows `features.lidHeightMm`, clamped to [min(20, H), H] (caps: H/2). The defaults are:
- Full depth (lid = H): 0300–0304, 0320 and 0321.
- Partial (≈ 0.35 H, 20–80 mm): 0307, 0308, 0309, 0322, 0323, 0330 and 0331.
- Shallow cap (0.25 H, 20–60 mm): 0306.
- Style-specific cap defaults: 0310–0314, 0325 and 0350–0352.

Each def also carries the same rule as `lidDepth(dims)`.

**With and without flaps.** 0320 and 0321 are slotted tubes with flaps (HSC). 0310, 0314 and 0325 use an open sleeve (0501) with caps. 0312 and 0313 combine a slotted body (0200/0201) with caps.

## Construction per style (how each was modelled)

- **Corner flaps** (0300, 0306, caps): the flaps sit on the end walls, fold 90° inside the long walls and are glued or stitched. The long walls get +1 layer of compensation. In **0301** the lid's flaps sit on the other wall pair (the long walls), so lid and base flaps never stack.
- **0302**: a pure cross blank with flapless corners, taped.
- **Gussets / web corners** (0303, 0304, 0308, 0309): the corner square stays joined to both walls. In the model it is two triangles: one hinged to the "against" wall at ±180°, the other hinged to the first along the diagonal at ∓180°. The web edge to the other wall is an **extra crease, not a cut**. The variants are:
  - 0303: outside, on the long walls.
  - 0304: outside, on the end walls.
  - 0308: inside, on the long walls, with a relief square at the corner.
  - 0309: inside, on the end walls, no slot.

  Inside gussets add 2 layers of compensation.
- **0307**: locking corner flaps fold outside the long walls. A rounded nose engages a slit cut in the long wall.
- **Roll-over walls**: these inner walls fold 180° (pivot one caliper deep, 1.5 when they trap ears).
  - 0322: rolled end walls trapping ears on the long walls.
  - 0323: all four walls rolled, with ears on the end walls.
  - 0330: as 0322, plus locking noses that enter slots in the floor (0422/0423 type).
  - 0331: rolled long walls trapping ears on the end walls.
  - 0314 caps: rolled walls with ears, 0422 type.
- **Caps**: each cap's inner size = the body's closed outer size + clearance (max(1, t/2) per side). The cap's top board rests on the body rim.
  - 0313: two caps of about half the height each, on an RSC body.
  - 0325: the caps fit **inside** the sleeve ends, flush. The caps hold the inner L × W and the sleeve is sized around them.
- **Octabins**: an 8-panel tube folded 45° per crease, plus octagonal caps whose 8 rim walls fold 90°.
  - 0350 / 0351: regular octagon (rule `L == W`, chamfer leg = L/(2+√2)).
  - 0352: longer sides, chamfer leg = 0.18 × min(L, W), rule `W <= L`.
  - 0350: integral bottom flaps plus a top cap.
  - 0351 / 0352: bottom and top caps.
- **05 sleeves**, by which faces each wraps:
  - 0501: front/right/back/left, open top and bottom.
  - 0502: top/right/bottom/left, open front and back.
  - 0503: top/front/bottom/back, open left and right. The open axis = inner length exactly.
- **05 sets**:
  - 0504 = 0502 inside 0501.
  - 0505 = 0503 inside 0502.
  - 0507 = 0503 inside 0501.
  - 0509 = a 0907-type U liner (floor + end walls) inside 0503.
  - 0510: a wrap (floor, front, back, hinged top flap with tuck) sealed into a 0501 outer sleeve that closes the ends and stops below the lid.
  - 0511: as 0510, plus dust flaps on the outer sleeve's ends.
  - 0512: the wrap plus an internal U liner (back and end walls), "assembly made internally".

**Fold stages.** Walls go first, then flaps / ears / gussets, then roll-overs, then each extra blank moves in its own stage. In 0510–0512 the top flap closes last (stage 3), after the sleeve or liner is in place.

## Sources

- FEFCO, *International Fibreboard Case Code*, 11th edition. Codes and group definitions:
  - Group 03: "more than one piece … lid and/or bottom telescoping over the body".
  - Group 05: "several pieces of liners and sleeves sliding in different directions into each other … also outside sleeves".
- Sandland Packaging, *FEFCO Codes brochure v3* (2024), pp. 15–20 and 36–38. This brochure reproduces the FEFCO drawing and one-line description for every 03 and 05 code above, for example:
  - 0301 "tabs alternating so not to conflict when closing"
  - 0303 "creases added to fold the corners flat"
  - 0306 "fully enclosed base with an 0452 cap"
  - 0310 "0501 cap tray sleeve set with 0452 caps"
  - 0312 "0200 cap tray set with an 0453 cap"
  - 0313 "0201 … with 0453 caps"
  - 0314 "0501 … with 0422 caps"
  - 0320 "male & female 0200"
  - 0321 "envelope closure set"
  - 0330 "using an 0422 & 0423"
  - 0331 "friction locking tabs"
  - 0351 "symmetrical sides" / 0352 "longer side panels"
  - 0501 "basic sleeve"
  - 0502 "opening on the length and height side" / 0503 "width and height side"
  - 0504 "0501 & 0502" / 0505 "0502 & 0503" / 0507 "0501 & 0503" / 0509 "0907 & 0503"
  - 0510 / 0511 "sealing the wrap and then applying the top flap" / 0512 "assembly made internally"

  https://sandlandpackaging.co.uk/wp-content/uploads/2024/04/Fefco-Brochure-v3.pdf
- Hercule Industrial, FEFCO 0300 series pages (0300, 0302, 0310, 0320, 0330: piece counts, corner fastening, 0306 partial telescope, 0309 gapless corner, 0352 rectangular pallets). https://herculeindustrial.com/products/corrugated/fefco/0300-series
- Defenda Pack FEFCO 03 / 05 lists (assembly M/A codes, code inventory). https://www.defendapack.com/fefco_03
- Kolici FEFCO list (code inventory). https://www.kolici.com/fefco-codes
- Labelprint24, FEFCO 0503 slipcase. https://www.labelprint24.com/en/products/fefco-0503-714

**Interpretation and confidence.** The brochure drawings fix the topology: the pieces, which panels, and which faces are open or closed. The sub-variants within a topology were not fully legible at the resolution I had, so I resolved them from the brochure's one-line text:
- which wall pair a gusset folds onto (0303 vs 0304, 0308 vs 0309);
- 0322 vs 0323 vs 0331;
- the 0350 bottom (no drawing was available).

The proportions are my engineering defaults, not FEFCO values: flap depths, ear sizes, nose sizes, joint width (≤ 35 mm) and the 0352 chamfer ratio. Check them against a vendor's CAD library before cutting production dies.

## Integrator notes (must do)

1. **Widen `StructureCode`** in `src/types/structure.ts` with the 33 codes `FEFCO_0300` … `FEFCO_0512`. `FEFCO_0320` already exists, and its DEFINITIONS entry delegates to the core `telescope()` generator. Until then this folder uses the local string type `FefcoTelescopeSlideCode`, plus `FamilyDielineModel` (a `DielineModel` with that code).
2. **Port the cut rule** in `generate.ts` `buildDieline()`: subtract `builder.extraCreases` from the cut lines, using `subtractSegments(e, [...hinges, ...extraCreases, ...cutLines])`, and count them as creases for bleed coverage. Without this, gusset web edges (0303/0304/0308/0309) are drawn as cuts. `./model.ts` is the local copy of the pipeline that already does this. The change is harmless for existing styles: their extra creases (crash-lock diagonals) lie inside panels, not on outlines.
3. **Registry fields.** `FamilyStructureDef` mirrors `StructureDef` with these additions and changes:
   - added: `group`, `subFamily`, `pieceLabels`, `lidDepth` and `generate`;
   - `shape` adds `"octagon"`;
   - `pieces` allows `3`;
   - `uses` adds `"industrial"` (octabins, pallet caps).

   Widen `StructureDef` accordingly, or map these fields when merging.
4. **Generators**: register `def.generate` in `GENERATORS`, `def.params` in `STRUCTURE_LIMITS`, `def.defaultDims` in `DEFAULT_DIMS`, `"CORRUGATED"` in `STRUCTURE_FAMILY`, and `def.features` in `FEATURE_SUPPORT`. Only `lidHeight` is supported, on multi-piece styles except the 05 sets.
5. **Materials**: octabins and 0314 list only `B_FLUTE_KRAFT`. Real octabins are triple-wall, and pallet caps are usually double-wall. Add BC / EB / AAA boards to `MATERIAL_CODES` and `BOARD_SPECS` to price these honestly.
6. **Blank size**: the 0350–0352 octabin bodies are about 3 m long (a single blank). Vendors often split them into two halves with two joints. A `split` option would be a later addition.
7. **Seed / i18n**: names and descriptions are in `definitions.ts` (MSA, noun form, no diacritics).

## Tests

`__tests__/fefco-03-05.test.ts` (676 cases). For every style × caliper (1.5 / 3 mm) × default and presets, it checks:
- no NaN / Infinity in the model;
- piece count;
- closed outer ≥ inner and ≤ inner + 14t + 8;
- the inner L × W × H cavity is free of board, which proves the flaps fold the right way and the layers are compensated (octabins are excluded: the cavity is octagonal);
- six faces on every 03 style;
- bleed regions ≥ the panel area, and only on printable panels; glue flaps are ink-free;
- safe zones lie inside their panels;
- die lines lie inside the bleed margin;
- the fold has no NaN mid-way and is flat at 0;
- limits and caliper validation (zod).

It also has style-specific checks:
- octabin rules;
- gusset creases;
- full vs partial lid depth;
- floor compensation;
- the 0503 open axis;
- the exact bleed area of a crease-bounded panel;
- three-piece ordering;
- regular octagonal caps.
