# Store bags family

`src/lib/dieline/families/bags` holds the 7 store (carrier) bag models of the designer. Every model is produced and priced as the core structure `PAPER_BAG`; the handle type and colour live in `DesignDoc.features.bagHandle` (`BagHandleChoice`, `src/types/bag.ts`). Research, sources and prices: `docs/audit/bags.md`.

Why a family of its own and not part of `foodservice`: carrier bags have their own construction (split gussets, block bottom, turnover with handles, base insert, eyelets), their own papers and their own price rules (size bands, handle cost, MOQ by line). The food bags that stay quote-only (`FS_BAG_MERCHANDISE`, `FS_BAG_BREAD_WINDOW`) remain in `foodservice`. The four earlier quote-only carrier codes point at these models (`BAG_CODE_ALIASES`).

## Models

| Code | EN | AR | Line | Papers | Handles (default first) | Order |
|---|---|---|---|---|---|---|
| BAG_TWISTED_KRAFT | Kraft bag, twisted paper handle | كيس كرافت بيد ورقية مجدولة | machine | kraft 120, white kraft 120, kraft 80 | twisted paper, flat paper | instant |
| BAG_FLAT_KRAFT | Kraft bag, flat paper handle | كيس كرافت بيد ورقية مسطحة | machine | same | flat paper, twisted paper | instant |
| BAG_SOS | SOS bag, no handle | كيس ورقي بقاع مربع دون يد | machine | kraft 80, kraft 120, white kraft 120 | none (thumb notch option) | instant |
| BAG_ROPE_ART | Laminated art-paper bag, rope handle | كيس كوشيه مسلفن بيد حبل | handmade | art 210, 170, 250 | cotton rope, PP rope, satin, grosgrain, twisted paper | instant |
| BAG_GIFT_ART | Gift bag, ribbon handle | كيس هدايا كوشيه بيد شريط | handmade | art 210, 170, 250 | satin, grosgrain, cotton rope, PP rope | instant |
| BAG_DIECUT_PATCH | Die-cut handle bag | كيس بيد مفرغة | machine | kraft 120, white kraft 120, art 210 | die-cut | quote |
| BAG_BOTTLE | Bottle bag, rope handle | كيس زجاجة بيد حبل | handmade | art 210, kraft 120, white kraft 120, art 250 | cotton rope, PP rope, satin, twisted paper | quote |

## Die (`generator.ts`)

Sheet mm, printed side up, mouth at the top. Dims are L = face width, W = gusset, H = finished height, crease to crease (the W x G x H order Egyptian printers quote).

- Columns: glue seam (12 to 22 mm) | gusset half B | gusset half A | front | gusset half A | gusset half B | back. The gusset centre fold is a real hinge, so the closed pose (the OPEN standing bag) creases each gusset `GUSSET_CREASE_DEG` = 8° inward, the way a bag stands. The rigid-panel engine bends the whole height by that angle; a real bag's crease fades toward the base (depth error G(1 - cos 8°), about 1 % of the gusset).
- Block bottom (pasted): gusset triangles (stage 1), back extension (stage 2), front extension on top (stage 3), each G/2 + a 10 to 20 mm lap. The triangle corners are tapered by more than tan 8° of their depth so nothing pokes past the faces.
- Top turnover 35 to 50 mm (55 to 70 for die-cut), folded 180° inside in the last stage; none on SOS bags.
- Holes: threaded handles punch two eyelets per face (rope Ø + 2 mm, ribbon 10 mm) through the wall AND the turnover (mirrored); die-cut bags cut a 90 x 28 mm stadium hand hole through both.
- Separate pieces (own dies, not printed, placed inside in stage 5): board base insert (laminated bags), handle patches (twisted paper, 50 mm high), top board strips (ropes and ribbons), hand-hole board patch (die-cut). `metrics.blankAreaM2` is the printed paper blank only; the board parts are priced per bag in `src/lib/pricing/bags.ts`.
- Faces: front, back, bottom from the fold engine; left and right are the two gusset halves side by side (`sideBySide`, built on `obliqueFace`).

## Handles (`handles.ts`)

Pure maths (no three.js): `handleAccessories` returns `DielineAccessory` centre lines in the closed-bag frame (origin bottom centre, y up, z to the front). The renderer (`src/components/three/accessories.ts`) sweeps them: twisted paper is two strands twisted round the centre line, cotton rope three strands, PP rope a smooth cord, flat paper tape and ribbons a flat strip lying on the wall plane (`normal`), knots and tails as short cords. Accessories show only in the closed pose; the camera fit includes them.

Sizes: twisted cord 4.5 mm, flat tape 15 mm, cotton rope 6 mm, PP rope 5 mm, ribbon 15 to 25 mm. Spans and loop heights scale with the face width (`handleGeometry`).

## Tests

`__tests__/bags.test.ts`: presets inside the limits, the blank area equals tube x (height + turnover + bottom), the bag closes to L x G cos 8° x H, flat sheet at 0, faces, every handle's geometry above the mouth and on both faces, eyelets through wall and turnover, pieces inside the bag, handle fallback rules, order modes match `QUOTE_ONLY_BAGS`. Pricing: `src/lib/pricing/__tests__/bags.test.ts`. e2e: `e2e/bags.spec.ts` and `e2e/models.spec.ts --grep "model BAG_"`.
