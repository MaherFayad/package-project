# ECMA specials family (`src/lib/dieline/families/ecma-specials`)

Non-tuck ECMA groups and special styles, built as parametric dielines for the existing fold engine. Each model has cut, crease and perforation lines, hinges with fold angles and stages, glue flaps (ink-free), 3 mm bleed, a 3 mm safe zone, faces for artwork and the board area for pricing.

```ts
import { DEFINITIONS, generateFamilyDieline } from "@/lib/dieline/families/ecma-specials";
const def = DEFINITIONS.find((d) => d.code === "ECMA_TRAY_BEERS")!;
const model = generateFamilyDieline(def, def.defaultDims, { thicknessMm: 0.48 }); // a DielineModel
```

## Models

| Code (proposed `StructureCode`) | English | Arabic | Standard | Sub-family |
|---|---|---|---|---|
| `ECMA_TRAY_4C` | Four-corner glued tray | صينية بأربعة أركان ملصوقة | ECMA B40.20.00.00 | glued-tray |
| `ECMA_TRAY_BEERS` | Beers-style webbed corner tray | صينية بأركان مثنية ملصوقة | ECMA B40.21.00.00 | glued-tray |
| `ECMA_TRAY_BRIGHTWOOD` | Brightwood-style double end wall tray | صينية بجدران طرفية مزدوجة | ECMA B44.20.00.00 | glued-tray |
| `ECMA_TRAY_6C_LID` | Six-corner tray with hinged cover | صينية بستة أركان وغطاء متصل | ECMA F20.41.00.00 | hinged-lid-tray |
| `ECMA_TRAY_HINGED_TUCK` | Tray with hinged tuck lid | صينية بغطاء متصل ولسان | ECMA F20.40.00.00 | hinged-lid-tray |
| `ECMA_SLEEVE_OPEN` | Open-end sleeve | غلاف أنبوبي مفتوح الطرفين | ECMA A01.01.00.00 | sleeve-wrap |
| `ECMA_WRAP_LOCK` | Self-locking wrap-around | غلاف التفافي ذاتي القفل | ECMA E30 group | sleeve-wrap |
| `FOLDER_PRESENTATION` | Presentation folder | حافظة أوراق تقديمية | none | wallet-folder |
| `ECMA_WALLET_ENDFLAP` | Wallet with end flap (disc/card) | محفظة كرتون بلسان إغلاق | ECMA F60.92.00.00 | wallet-folder |
| `ECMA_PILLOW` | Pillow box | علبة وسادة | ECMA F70.01.00.00 | curved |
| `CONE` | Paperboard cone | مخروط كرتون | none | curved |
| `ECMA_HEXAGON` | Hexagonal carton | علبة سداسية الأضلاع | ECMA C10.40.20.20 | polygonal |
| `ECMA_OCTAGON` | Octagonal carton | علبة ثمانية الأضلاع | ECMA C10.50.11.11 | polygonal |
| `GABLE_CARRY_CLB` | Gable carry box, crash-lock bottom | علبة حمل جملونية بقاع أوتوماتيكي | ECMA A60 body + X81 | carrier |
| `CUP_CARRIER` | Cup carrier (2 or 4 cups) | حامل أكواب | ECMA E12 group | carrier |
| `BOTTLE_BASKET_4` | 4-bottle basket carrier | حامل زجاجات رباعي | ECMA E23 group | carrier |
| `BOTTLE_BASKET_6` | 6-bottle basket carrier | حامل زجاجات سداسي | ECMA E23 group | carrier |
| `ECMA_COUNTER_DISPLAY` | Counter display with tear-off header | علبة عرض للكاونتر بواجهة قابلة للنزع | ECMA A20.20.03.03 + X35 | display |
| `LIQUID_GABLE_TOP` | Gable-top liquid carton, 250 ml–2 L | عبوة كرتون جملونية للسوائل | none | liquid |
| `LIQUID_ASEPTIC_BRICK` | Aseptic brick carton, 200 ml–1 L | عبوة كرتون معقمة مستطيلة | none | liquid |

Each definition (`EcmaSpecialDef`, `types.ts`) also has: slug, ar/en description, axis labels (what L/W/H mean per style), zod-validated limits and rules, default dims, 3 or 4 presets common in Egypt, allowed materials, supported features, delivery (flat / set-up / reel-fed), typical uses, and for liquid cartons `capacityMl`.

### How the ECMA codes were assigned

Source: *The ECMA Code of Folding Carton Design Styles*, revised edition September 2009 (ECMA, 2022 PDF). I extracted the text and checked each code against the coding matrices.

- **Group B** (non-long-seam-glued, rectangular). 1st pair: basic tray shape (40 = glued tray with 4 single walls, 44 = with 2 double walls). 2nd pair: locking (20 = glued corner/panel not webbed, 21 = glued corner/panel webbed). 3rd pair: dust flaps. 4th pair: cover. B40.20.00.00, B40.21.00.00, B44.20.00.00 and B44.21.00.00 are all illustrated styles in the catalogue.
- **Group C** (long-seam-glued, non-rectangular). Pairs are body / basis / bottom / top. Body 10 = rectangular solid; basis 40 = 6-cornered, 50 = 8-cornered; closure 20 = tuck-in flap, 11 = reduced flaps with one flap fully covering. C10.40.20.20 and C10.50.11.11 are illustrated.
- **Group A**. Pairs are bottom / top closure, then the panel each closing flap hinges on. 01 = without flaps, so A01.01.00.00 is the open sleeve. A20.20.03.03 is the straight tuck end.
- **Group F**: F20.40 is a tuck-in flap box with continuous base and lid attached. F20.41 is a hinge back lid with glued corners. F60.92 is a wallet with end flap (closed). F70.01 is a pillow pack with end flaps completely covered.
- **Group X** codes are 2-digit features appended to a style code. X35 = tuck-in closure usable as display. X81 = carrying handle formed of the 2 main flaps.
- **Group E** (product-related). 1st pair: product (12 = cylindrical, vertical panels, double row; 23 = bottles, double row, cap/neck not covered; 30 = cubical). 2nd pair: closure. The closure column headers in the PDF matrix are rotated and I could not map them to the digits reliably, so these models only cite the **group** (`ECMA E23 group`). **Integrator: confirm the closure pair with a printer, or keep the group-level reference.**
- **"Beers" and "Brightwood"** are North-American trade names, not ECMA terms. The PPC (paperbox.org) says the Beers style is glued by the converter and shipped flat. The supremex.com glossary describes Brightwood as a four-corner glued or double-wall tray. These map to ECMA B40.21 (webbed glued corners) and B44.20 (double walls), and the names are kept as "-style" in English only.
- Presentation folder, cone and the liquid cartons have no ECMA style, so their standard is `"none"`.

Other sources used:
- Gable-top base sections of 57 × 57 (≤ 500 ml), 70 × 70 (250 ml–1.1 L) and 91–96 mm square (1.5–2 L), plus a 1 L height of about 235 mm with the roof. From supplier and retail guides (boxnovo.com, soonpak.com, allcustompackaging.co.uk).
- Aseptic brick footprints vary by format family. The presets are derived from capacity (200 ml 52 × 36 × 107, 250 ml 55 × 37 × 123, 1 L 90 × 60 × 186). A test checks each brimful body volume against the nominal capacity (≥ nominal and ≤ +12 %). **Confirm with the filler's format sheet.**

## Geometry notes

- Thickness compensation follows the engine convention: crease-to-crease = inner + layers × t, so the folded 3D inner space equals the requested inner size. Trays add 2 × wall layers to the base, plus H + t for the walls (H + 2t with a lid). Polygon cartons use side `a = (F + 2t)·tan(π/n)`, where F is the inner size across flats.
- **Beers webs** form a closed loop: the web half B touches both web half A and the end wall. The fold tree keeps the B-to-end-wall edge out of the hierarchy and declares it in `EcmaDraft.joins`. The local assembler then draws it as a crease, not a cut. **Shared engine change needed:** `StructureDraft.joins?: Segment[]` and the same handling in `generate.ts` (see `assemble.ts`).
- **Pillow**: the lens cross-section is modelled as a rhombus. Each face has two facets on a smooth `roll` hinge, and the side folds are real creases. The curved end creases are drawn as straight hinge chords, and the lobe outlines are true arcs. Lobes fold until they reach the centre plane.
- **Cone**: a 24-facet pyramid on `roll` hinges. The dihedral fold comes from the real pyramid, and `closedRotation` comes from the folded shape (mouth up). The whole developed sector is one artwork face in sheet space.
- **Baskets**: the centre handle partition and the cross partitions are separate blanks, assembled with `assembly` matrices. Production baskets strike them from the side panels and pre-glue them; that one-piece layout is not modelled. The crash-lock bottom only works when W ≤ L, so the rule is `W <= L`.
- **Gable top**: the side gussets are pentagons with their crease lines drawn; the inward-folding wings are not modelled as separate panels. The roof is at 45° with a 9 mm vertical fin. The bottom is square and sealed.
- **Aseptic brick**: top ears fold 180° outward onto the side panels, and bottom ears fold under the base. The brick needs `W <= L` so the ears fit.
- Gable carry and basket reuse the shared `crashLockCarton` and remove its tuck top. The counter display reuses `tuckEndCarton` (straight tuck) and adds the tear-off perforations.

## What the integrator must do

1. Add the codes above to `STRUCTURE_CODES` (`src/types/structure.ts`). `assemble.ts` currently casts `def.code` to `StructureCode`.
2. Wire the definitions into `GENERATORS`, `STRUCTURE_LIMITS`, `DEFAULT_DIMS`, `STRUCTURE_FAMILY`, `FEATURE_SUPPORT` / `DEFAULT_FEATURES` and the registry `ENTRIES`, or switch the registry to consume `DEFINITIONS`. Then drop the local assembler and use `generateDieline` once it supports `joins`.
3. Widen shared types (all local for now, in `types.ts`):
   - `StructureDef.shape`: add `"cone"` and `"flat"`.
   - `StructureDef.pieces`: change to `number` (the baskets have 3 or 4 blanks).
   - `StructureDef.uses`: add `"beverage" | "dairy" | "stationery" | "media"`.
   - New fields: `subFamily`, `axes` (per-style L/W/H labels; the folder's W is the spine, the cone's L is the mouth Ø), `delivery`, `typicalUses`, `capacityMl`.
4. Materials: the liquid cartons need **liquid packaging board** (PE / PE-Al-PE laminated). The `MaterialCode` union does not have it, so they list `SBS_350` as a stand-in. Bottle baskets are usually coated unbleached kraft (CUK) board, also missing. E-flute is allowed for trays, carriers and the display; `materialFitsStructure` is family-based and will need a per-structure override.
5. Rules syntax: the local zod schema also accepts a scale factor, for example `"W <= L * 0.5"` (pillow). The shared `checkRule` in `limits.ts` does not, so extend it or drop that rule.
6. Pricing: liquid cartons are reel-fed form-fill-seal (`delivery: "reel-fed"`). The blank area is correct per pack, but vendor rate cards for die-cut cartons do not apply. Use the area metrics only.
7. Food contact: trays, cups, cones and the liquid cartons are food-contact packaging. Restrict them to vendors with food-safe certification (`Vendor.foodSafe`), as for PIZZA.

## Tests

`__tests__/ecma-specials.test.ts`: 135 tests. They cover metadata completeness and Arabic without diacritics, no brand names, zod limits and rules, feature filtering, and for every preset and valid limit corner: no NaN, a valid fold tree, print-area math (sheet = die + 2 × bleed, bleed regions ≥ panel area, glue flaps ink-free, safe zones inside their panels) and finite poses while folding. Closed outer size is checked against the inputs per style, along with style-specific geometry (webs, double walls, six glue points, cup apertures, partitions, perforations, roof and fin angles, ears, preset capacities).
