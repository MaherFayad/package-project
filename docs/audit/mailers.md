# Mailer boxes: the owner's tuck front mailer and its variants

2026-11-10. Branch `claude/exciting-albattani-8kzgsu-mailers`. Owner input: `docs/owner-input/2026-11-10/` ("and this type of boxes"). Screenshots: `docs/screenshots/audit/mailers/`.

## Summary

- **New model `MAILER_RETF`, "Mailer box (tuck front)" / «علبة بريدية بلسان أمامي»**, slug `mailer-box-tuck-front`. It reproduces the owner's die: single front wall, square ears about H deep on the front and back walls, rolled double side walls that lock into the base with two tabs each, rounded lid side flaps, a full-depth tuck with rounded side wings and a thumb notch.
- **New model `MAILER_RETF_PLAIN`, "Mailer box (tuck front, plain tuck)" / «علبة بريدية بلسان أمامي بسيط»**, slug `mailer-box-tuck-front-plain`. Same base, with a plain round-cornered tuck and trapezoid side flaps. It is a simpler die and uses less board.
- Both are fefco-04 family models (`src/lib/dieline/families/fefco-04/retf.ts`), priced on the `FEFCO_0427` mailer rate card, so they get an instant price. Options on both: lid window, tear strip and divider insert.
- **The dieline detector now ranks `MAILER_RETF` first on all three owner files**, at L:W:H 0.97 : 1 : 0.32 (target 0.98 : 1 : 0.32). Scores are 0.851, 0.746 and 0.761, with a lead of 0.06 to 0.08 over the next model. The detector code is unchanged.
- The core `FEFCO_0427` "Mailer box" (`mailer-box`) is untouched, so saved designs open exactly as before.

## 1. Research

Sources are supplier and trade pages, collected on 2026-11-10. Where suppliers disagree, the disagreement is noted.

### Constructions and trade names

| Construction | What the sources say |
|---|---|
| FEFCO 0427 | One-piece folder: the lid extends from the back panel, trapezoid dust flaps go inside, and the long base flaps fold over two small flaps on each of the front and rear walls ([packaging-warehouse](https://www.packaging-warehouse.com/en/category/fefco-0427-hinged-lid-box-78)). Packhelp calls its mailer 0427 and credits the "double side walls" for its strength ([Packhelp](https://packhelp.co.uk/help/topic/what-is-a-mailer-box)). Packhelp lists 0427 variants: plain, with sleeve, and "with adhesive strip for e-commerce" ([Packhelp FEFCO](https://packhelp.co.uk/fefco-codes/)). |
| RETF / REFT (roll end tuck front) | The board "rolls over and folds back, creating reinforced walls on both short sides". The front tuck slots in between the side panels ([Paperlust](https://printshop.paperlust.co/blog?p=4763)). Rush Custom Boxes sells REFT with dust flaps and a locking tab, and describes double walls on the front and sides ([Rush](https://www.rushcustomboxes.com/mailer-boxes/front-tuck-mailers)). Newprint: RETF names the closure, "mailer" names the use ([Newprint](https://www.newprint.ca/help/what-is-the-difference-between-a-roll-end-tuck-front-box-and-a-mailer-box)). |
| RETF vs 0427 | **Suppliers use the two names for one family**, with double or triple fronts depending on the maker. PM Packaging calls it 0427 with "triple-thickness front and side panels" ([PM Packaging](https://pmpackaging-nextjs-16.netlify.app/product-catalog/packaging-and-cartons/roll-end-tuck-top-boxes)). One glossary swaps the codes ([Racklify](https://racklify.com/encyclopedia/roll-end-mailer-vs-regular-mailer-boxes-strength-presentation-and-when-to-choose/)). So the wall build is something to specify per die, not something the name settles. Elba now has both builds: `FEFCO_0427` with a rolled double front, and `MAILER_RETF` with a single front, as in the owner's die. |
| Ear-lock mailer | Packlane's standard mailer: the front and back flaps carry tuck flaps along the sides, the side walls fold over them and snap into holes in the bottom, and the lid's tabs lock into the side walls ([Packlane](https://packlane.com/support/how-do-you-assemble-a-mailer-box)). Packlane also lists "Roll End Front Tuck (with dust flaps)" as a separate die ([Packlane dielines](https://packlane.com/dieline-request)). The owner's die is this locking-into-the-base construction with an RETF lid. |
| FEFCO 0426 pizza style | Folding flaps "lock into place to form a double layered side" and the top tucks in ([Postpack](https://www.postpack.co.uk/pages/custom-size-mailing-boxes)). Smurfit Kappa files pizza-style postal boxes under "0426 or 0427" ([Smurfit Kappa](https://smurfitkappa.com/uk/products-and-services/packaging/pizza-style-postal-boxes)). |
| Tear strip mailers | A perforated, reinforced zip strip opens the box once. A peel-and-seal strip closes it, and "many brands choose to add a second adhesive strip for returns" ([Rush tear strip](https://www.rushcustomboxes.com/mailer-boxes/tear-strip-mailers), [Klingele](https://www.klingele.com/en/news-knowledge/detail/e-commerce-packaging-with-self-adhesive-strips-efficient-packaging-and-convenient-returns)). |
| Double-wall lid sides | Literature mailers have lid flaps that make double or triple walls on the front and sides ([Grainger](https://safety.grainger.com/category/packaging-shipping/shipping-boxes-pads-tubes/shipping-boxes/literature-mailers), [Uline tab locking](https://www.uline.com/Product/Detail/S-12770/Indestructo-and-Literature-Mailers/18-x-12-x-4-White-Tab-Locking-Literature-Mailers)). No source defines this as a named style. |
| Apparel and shoe mailers | Apparel: 12 x 9 x 2 in for folded lightweight apparel and 12 x 10 x 4 in for bundles ([Vistaprint](https://www.vistaprint.com/hub/mailer-box-size/)). Shoes: no reliable source defines a shoe mailer. One weak source names B flute ([Lazada guide](https://stationery.lazada.sg/best-cardboard-shoeboxes-for-shipping-and-storage-a-protection-guide-20260803/)). |
| Inserts | Corrugated inserts with 1 to 3 compartments sized to the mailer range ([Packhelp inserts](https://packhelp.co.uk/p/mailer-box-inserts/custom)). Use one divider for two products and a two-piece divider for more ([Packoi](https://packoi.com/blog/mailer-boxes-with-dividers)). |

### Standard sizes (inner, mm)

| Supplier | Sizes (L x W x D) | Notes |
|---|---|---|
| Packlane mailer / RETF ([1](https://packlane.com/products/mailer-box), [2](https://packlane.com/dieline-request)) | 127 x 76 x 38, 152 x 102 x 76, 178 x 127 x 76, 203 x 152 x 76, 229 x 152 x 102, 254 x 203 x 102, 305 x 229 x 51, 305 x 254 x 102, 330 x 254 x 127, 356 x 254 x 102. RETF only: 102 x 102 x 51, 152 x 152 x 51, 229 x 203 x 51 | 19 sizes, 5 x 3 x 1.5 in to 14 x 10 x 4 in |
| Arka ([link](https://www.arka.com/products/custom-mailer-boxes)) | 152 x 102 x 76, 152 x 152 x 51, 178 x 127 x 76, 229 x 152 x 76, 229 x 203 x 51, 254 x 203 x 102, 318 x 254 x 102, 381 x 254 x 102, 406 x 356 x 64 | interior dimensions |
| Uline tab locking ([link](https://www.uline.com/Product/Detail/S-12770/Indestructo-and-Literature-Mailers/18-x-12-x-4-White-Tab-Locking-Literature-Mailers)) | 203 x 203 x 70, 229 x 165 x 70, 254 x 254 x 76 to 127, 305 x 305 x 51 to 152, 457 x 305 x 51 to 102 | B flute, 200 lb test |
| Pacdora ([link](https://www.pacdora.com/dielines/mailer-box-dielines)) | 150 x 100 x 50, 230 x 150 x 100, 320 x 250 x 100 | "common sizes" |
| Vistaprint ([link](https://www.vistaprint.com/hub/mailer-box-size/)) | 152 x 102 x 76 (accessories, beauty), 229 x 152 x 102 (skincare sets with inserts), 305 x 229 x 51 (apparel), 305 x 254 x 102 (clothing bundles, subscription) | E flute 32 ECT |
| Packaging-warehouse 0427 ([link](https://www.packaging-warehouse.com/en/category/fefco-0427-hinged-lid-box-78)) | 280 x 200 x 40, 340 x 240 x 45, 250 x 150 x 90, 340 x 210 x 140, 450 x 320 x 100 | EU stock sizes |
| Egypt | No supplier publishes a mailer size list. UPack Egypt sells plain craft boxes at 15 x 15 x 5, 20 x 20 x 8, 25 x 25 x 8, 30 x 30 x 10 and 35 x 25 x 10 cm for EGP 9.5 to 17 ([UPack](https://upack-eg.com/)). Techno Rapid advertises custom e-commerce and self-locking boxes ([Techno Rapid](https://technorapid.com/en/industrial-solutions/e-commerce-packaging-and-shipping-solutions/)). | not verified as corrugated mailers |

PakFactory's rule for RETF is depth at or below length, with length at or above width ([PakFactory](https://pakfactory.com/economic-roll-end-front-tuck.html)). Elba keeps its family rule, H at or below W.

### Boards and flutes

- E flute is about 1.5 mm and B flute about 3 mm. Both come white/white, white/kraft or kraft/kraft ([packaging-warehouse](https://www.packaging-warehouse.com/en/category/fefco-0427-hinged-lid-box-78)). Packlane offers E (1/16 in) and B (1/8 in) in white, coated white and kraft ([Packlane](https://packlane.com/products/mailer-box)). F or micro flute is about 0.8 mm. Sources disagree on whether "micro flute" means E or F ([Packwire](https://packwire.com/blog/corrugated-flute-types)).
- E flute prints better. B flute is for heavier items or a mailer that ships on its own ([QinPrinting](https://www.qinprinting.com/blog/e-flute-vs-b-flute/), [Rush](https://www.rushcustomboxes.com/mailer-boxes/front-tuck-mailers)).
- Egypt: Waraq Co. supplies fluting for E (1.6 mm), B (3.2 mm) and A (4.8 mm) flute ([PaperIndex](https://www.paperindex.com/profile/waraq-co/02022117/37131)). IPSC and Inception list kraft liner, testliner and white top ([IPSC](https://www.ipsc-eg.com/en), [Inception](https://inception-eg.com/en/packaging/)). No Egyptian corrugator states which flutes it converts into boxes.
- Elba's mailers use the boards already priced for `FEFCO_0427`: `E_FLUTE_KRAFT`, `E_FLUTE_WHITE` and `B_FLUTE_KRAFT`.

### Print

- Outside, inside, both, or blank. Digital from 1 unit, flexo from about 5,000, litho-lam above about 10,000 (Packlane [1](https://packlane.com/products/mailer-box), [2](https://packlane.com/bulk-mailer-boxes)). Arka prints outside, inside or both from 10 units ([Arka](https://www.arka.com/products/custom-mailer-boxes)). Paperlust's artwork rule is 3 mm bleed and a 5 mm safe margin from creases ([Paperlust](https://printshop.paperlust.co/blog/mailer-box-artwork-dieline-guide)). Elba already uses the same margins for corrugated.
- Elba's designer already offers "Outside only" and "Outside and inside" for these models (screenshot: `docs/screenshots/models/MAILER_RETF.png`).
- Egypt: no published MOQ for printed mailers.

### What Egyptian brands order

Not verified. No data source covers what Egyptian Instagram fashion, cosmetics or subscription brands order. The owner's sample is an outside-and-inside printed kids apparel mailer, and that matches the global default: RETF in white or kraft E flute. A real answer needs quotes from IPSC, Inception, Techno Rapid and UPack Egypt (open item).

## 2. The owner's die, measured, and Elba's

Measured on `owner-mailer-sample.jpg` (1244 x 1600 px; the sheet is drawn tuck end up) and checked on the two webp files. The fitted scale is about 2.2 px/mm, which gives about 234 x 240 x 76 mm inner. Elba's values are at the default size of 240 x 240 x 75 on E flute (t = 1.5 mm).

| Feature | Owner's die | `MAILER_RETF` |
|---|---|---|
| Base | 530 x 535 px (L:W 0.99) | L + 6t by W + 2t (249 x 243 mm) |
| Front wall | single, 160 px (H), with ears | single, H + 2t, with ears |
| Back wall | 160 px, with ears, lid hinge | H + 2t, with ears, lid hinge |
| Ears | 4, square, 160 x 160 px (depth = H) | 4, square, depth min(H, 0.38 W), 2 mm lead-in at the rim |
| Side walls | rolled double: outer 160 px + inner 160 px, double crease about 8 px apart | rolled double: outer H + t, inner H - t - 0.5, roll crease |
| Locking tabs | 2 per inner wall, centred at 23% and 77% of its length, 18% long, 8 px (about 3.7 mm) deep | 2 per inner wall at 23% and 77%, 18% long, 1.5t + 0.5 deep (2.75 mm; stops half-way into the base board) |
| Base slots | 4, about 8 px wide, on the base side of the side creases | 4, 2t + 0.5 wide (3.5 mm), from t to 3t + 0.5 in from the base edge |
| Lid | 528 x 530 px, on the back wall | Lp x Wp, less a 0.1 mm corner gap |
| Lid side flaps | depth 158 px (0.99 H). Angled cut leaves the hinge end at 0.24 / 0.75 of the depth (along / out), rounded corner reaches the far edge 0.5 depth from the end | depth He - 2t - 2. Same 0.24 / 0.75 cut, Bezier corner ending at 0.5 depth |
| Tuck | full depth (158 px, 0.99 H), as wide as the lid | depth Hf - 2t - 2 (H - 2 mm), between the end walls' inner faces |
| Tuck wings | on vertical creases at the tuck ends. 112 px wide (0.71 of tuck depth), outer corner a quarter circle of the wing's width | 0.7 of tuck depth, quarter-circle corner. They fold 90° back inside the lid side flaps |
| Thumb notch | half circle, r 27 px (about 12 mm), on the tuck's free edge | r 12 mm (capped by tuck size), on the tuck's free edge |

The fit is drawn in `die-overlay-sample.webp`, `die-overlay-inside.webp` and `die-overlay-outside.webp`, with Elba's cuts in blue and creases in dashed green over the owner's red. Every straight line lands within a few pixels. The residuals are:

- the wing outline: the owner's arc is slightly fuller.
- the side flap depth on the jpg: Elba's is about 3 mm deeper at the fitted scale. On the webp files it is 3 mm shallower, so this is scale noise.
- the tab depth: Elba's tabs are shorter on purpose. Rolled in, a full-depth tab tip sat in the printed bottom face, and the 3D test "no cut edge on a printed face" caught it.

Board use against the core mailer, from `metrics.blankAreaM2` on E flute:

| Inner size | `MAILER_RETF` | `MAILER_RETF_PLAIN` | `FEFCO_0427` |
|---|---|---|---|
| 240 x 240 x 75 | 0.396 m² (554 x 715) | 0.385 m² | 0.423 m² (548 x 771) |
| 300 x 220 x 60 | 0.349 m² | 0.341 m² | 0.370 m² |
| 330 x 200 x 120 | 0.634 m² | 0.610 m² | 0.703 m² |

The single front saves 6 to 10% of the blank against the core mailer's rolled double front.

## 3. Models and the naming decision

| Code | English | Arabic | Slug | Fidelity |
|---|---|---|---|---|
| `MAILER_RETF` | Mailer box (tuck front) | علبة بريدية بلسان أمامي | `mailer-box-tuck-front` | described (the owner's die) |
| `MAILER_RETF_PLAIN` | Mailer box (tuck front, plain tuck) | علبة بريدية بلسان أمامي بسيط | `mailer-box-tuck-front-plain` | interpreted |

Name options I considered. All are MSA noun phrases, with no imperatives and no diacritics:

1. **علبة بريدية بلسان أمامي** / Mailer box (tuck front). **Shipped.** "علبة بريدية" is the word buyers already see on `mailer-box`, and "بلسان أمامي" is the visible difference.
2. علبة بريدية بجدارين جانبيين مزدوجين / Mailer box (double side walls). Accurate, but too long for a card, and buyers do not choose by wall count.
3. علبة شحن بريدية بلسان إدخال / Tuck-in e-commerce mailer. "شحن" collides with «كرتونة شحن» (`shipping-box`).

**Sibling, not a replacement for "Mailer box".** I kept `FEFCO_0427` as the default "Mailer box" and added `MAILER_RETF` as a sibling. Replacing it would change the geometry of every saved `mailer-box` design: its front wall, ear and tuck panels would move, and saved artwork is placed by face and panel. That would need a versioned artwork migration (see pitfall E-32 in the 3D guide). The sibling route keeps every saved design and the `mailer-box` slug byte-identical, and the geometry snapshot shows only additions. The catalogue and picker sort by sub-family and standard code, so the two RETF cards land directly after "Mailer box" (catalogue positions 84 to 86). If the owner wants the tuck front as *the* mailer, the follow-up is small: point `PRODUCT_PRESETS` and the "Mailer box" marketing links at `mailer-box-tuck-front` and keep the old slug alive.

**Variants as options, not as more models.** The research gives five sensible variants. One became a model (plain tuck). The other four are options or presets on both models, because they share the die:

| Variant | How it is offered |
|---|---|
| Tear strip (zip) | Feature `tearStrip`: two perforations across the lid behind the tuck crease (same as the core mailer) |
| Mailer with insert | Feature `partitions` (1 to 6 by 1 to 6 dividers, the core's `addPartitions`) |
| Window lid | Feature `window` on the top face |
| Apparel (shallow) and cosmetics | Presets: T-shirt 300 x 230 x 50, Cosmetics set 230 x 150 x 100 |
| Shoe mailer | Any size up to H 250 within H ≤ W. The shoe preset 330 x 200 x 120 stays on the core mailer, because family models carry at most 4 presets |
| Double front (three-layer front) | That is the core `FEFCO_0427` |

Presets on both models (inner mm; the first opens by default): **Kids apparel 240 x 240 x 75** (the owner's proportions), T-shirt 300 x 230 x 50, Cosmetics set 230 x 150 x 100, Jewellery and accessories 150 x 100 x 50. Limits: L 80 to 600, W 60 to 450, H 20 to 250, H ≤ W. Boards: E flute kraft, E flute white, B flute kraft. The finishes are the corrugated set the designer already offers.

## 4. Detector check

`npx tsx scripts/detect-owner-mailers.ts` uses every box model (`BOX_MODELS`). It is pinned by `src/lib/dieline/families/fefco-04/__tests__/retf-detect.test.ts`.

| File | Before (top 3) | After (top 3) | L:W:H after |
|---|---|---|---|
| `owner-mailer-sample.jpg` | FS_BAKERY_BOX 0.747, FEFCO_0421_1 0.735, RIGID_COLLAPSIBLE 0.718 | **MAILER_RETF 0.851**, MAILER_RETF_PLAIN 0.794, FS_BAKERY_BOX 0.747 | 0.976 : 1 : 0.318 |
| `dieline-inside-pink.webp` | FEFCO_0421_1 0.665, FEFCO_0904 0.667, FEFCO_0905 0.667 | **MAILER_RETF 0.746**, FEFCO_0421_1 0.665, FEFCO_0904 0.667 | 0.968 : 1 : 0.321 |
| `dieline-outside-purple.webp` | RIGID_COLLAPSIBLE 0.693, FS_BAKERY_BOX 0.684, FEFCO_0759 0.656 | **MAILER_RETF 0.761**, MAILER_RETF_PLAIN 0.709, RIGID_COLLAPSIBLE 0.693 | 0.969 : 1 : 0.328 |

For reference, the core mailers score lower on the owner's files: `FEFCO_0427` 0.582, 0.514 and 0.625, and `FEFCO_0427_1` 0.683, 0.608 and 0.608.

- The synthetic detector tests pass unchanged: 15 of 15, with all 10 library dielines top-1.
- **No detector change was needed.** The only edit in `dielineDetect/` is its test: the owner-sample allow list (`MAILERS`) gains `MAILER_RETF` and `MAILER_RETF_PLAIN`, because a mailer now legitimately wins.
- Geometry tuned for the detector: the tuck creases sit on the lid's side lines, as in the owner's die (the first draft inset them one more caliper). That took the outside webp from 0.749 to 0.761.

## 5. Tests and screenshots

- `src/lib/dieline/families/fefco-04/__tests__/retf.test.ts` (9 tests):
  - construction (single front, 4 ears, rolled ends, wings)
  - the owner's proportions
  - 4 slots at 23% and 77%, and 12-point inner walls with tabs
  - notch, closed size and all six faces
  - window, tear strip and insert
  - plain variant
  - every preset and the corner limits on E and B flute
  - library pricing base `FEFCO_0427`, and the `mailer-box` slug unchanged
- `retf-detect.test.ts` (3 tests): top-1 on each owner file, a lead of at least 0.02, and the proportions.
- The family suites now include both models: `fefco-04.test.ts` (dieline, metadata, presets) and `fefco-04-3d.test.ts` (no board inside board, no cut edge on a printed face, every preset on E and B flute). Two real problems found and fixed there:
  - The tuck wings first pivoted on the tuck's printed face and poked 3 mm through the front wall. That also hid the "front" face. They now pivot 3 calipers in and lie one caliper inside the lid side flaps.
  - The full-depth tabs ended in the printed bottom face. They now stop half-way into the base board.
- `e2e/models.spec.ts --grep "model MAILER_RETF" --project=desktop --trace off`: 2 passed. Writes `docs/screenshots/models/MAILER_RETF.png` and `MAILER_RETF_PLAIN.png`. The designer shows "500 boxes: EGP 40.22 per box, all-in excl. VAT" for `MAILER_RETF`.
- Screenshots in `docs/screenshots/audit/mailers/` (from `docs/audit/tools/mailers-capture.cjs` against `/en/dev/3d`, SwiftShader, 2x):
  - `mailers-vs-owner.webp`: the owner's mockup (front, top, right side, open) next to `MAILER_RETF` and the core `FEFCO_0427`.
  - `<CODE>__{iso,front,top,side,open,flat}.png` for `MAILER_RETF`, `MAILER_RETF_PLAIN` and `FEFCO_0427`, plus `<CODE>__sheet.png` contact sheets.
  - The open view shows the rounded side flaps, the winged tuck and the notch. The closed views match the mockup's silhouette: flush lid, single front, double side wall rim.

## Open items

1. **Faint ear line on the side wall (renderer).** At some sizes and angles, the far edge of an ear shows as a faint vertical line through the outer side wall. The line moves when the ear changes size. It survives a 0.2 mm air gap, so it is a renderer depth or shadow artifact, not geometry. **The core `FEFCO_0427` shows the same line** (`FEFCO_0427__side.png`). Ears capped at 0.38 W avoid it at small sizes. At the owner's proportions it still shows faintly at 31% and 69% of the side. This belongs with the 3D engine (shadow bias or polygon offset); I did not change the renderer.
2. **Thumb notch position.** The owner's die puts the notch on the tuck's free edge, and I followed the die. Most suppliers put it on the front wall's rim, so the lid's front edge can be gripped ([Packola](https://www.packola.com/blogs/boxing-and-packaging-articles/different-parts-of-a-mailer-box)). On the closed box, a notch on the tuck sits inside, low in the box. This is worth asking the owner. Moving it is one line in `retf.ts`, plus a snapshot update.
3. **Artwork mapping across the seams** (the owner's `seam-*.png`) is the -dieline-remap session's work. The new model gives that work a die that matches the owner's file line for line.
4. **Make tuck front the default "Mailer box"?** This is a product decision (section 3). I recommend it once the remap session can carry saved `mailer-box` artwork over, or simply by pointing new-design entry points at `mailer-box-tuck-front`.
5. **Egyptian sizes and MOQs are unverified.** Quotes from IPSC, Inception, Techno Rapid and UPack Egypt would ground the presets and the flexo and litho break points.
6. **Shoe preset.** Family models carry at most 4 presets (a family test rule), so the shoe size lives on the core mailer only. Raising the cap for mailers is a one-line test change if the picker can show 5.
7. **Generated-file noise.** The thumbnail generator on Linux changed the fill colours of about 218 existing SVGs by a shade (float drift from a different platform). I reverted those and committed only the two new SVGs. `e2e/fixtures/catalogue-models.json` also re-sorted two sleeve rows (`localeCompare` on this ICU). Both are generator output and regenerate at merge.
8. The `fefco-04` README note on 0446 says "add it once `addPartitions` is exported". It is exported now.
