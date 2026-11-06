# Flexible packaging family (`src/lib/vessels/families/flexible`)

Filled 3D film packs (three.js `BufferGeometry`) with print layouts per face, zod limits and
size presets. Pure TypeScript except `geometry.ts`, `materials.ts` and `group.ts`, which use `three`.
No React is needed: `buildFlexibleGroup(cfg)` returns a ready `THREE.Group` (scaled mm -> m)
that can be dropped into `<primitive object={group} />`.

## Models

| Code | EN | AR | Standard | Shape model | Print panels |
|---|---|---|---|---|---|
| `FLEX_STAND_UP_POUCH` | Stand-up pouch (doypack) | كيس واقف | none | standup | front, back, bottom |
| `FLEX_FLAT_POUCH` | Flat pouch | كيس مسطح | none | pillow (4 seals) | front, back |
| `FLEX_THREE_SIDE_SEAL` | Three-side seal pouch | كيس لحام ثلاثي | none | pillow (bottom fold) | front, back |
| `FLEX_PILLOW_BAG` | Centre-seal pillow bag | كيس وسادة بلحام خلفي | none | pillow (tube + back fin) | front, back |
| `FLEX_QUAD_SEAL_BAG` | Quad-seal bag | كيس لحام رباعي | none | box (4 corner fins) | front, back, gussets, bottom |
| `FLEX_SIDE_GUSSET_BAG` | Side-gusset coffee bag | كيس قهوة بطيات جانبية | none | box (back fin, folded base) | front, back, gussets |
| `FLEX_FLAT_BOTTOM_POUCH` | Flat-bottom box pouch | كيس بقاعدة مسطحة | none | box (corner fins) | front, back, gussets, bottom |
| `FLEX_SACHET` | Sachet | ظرف أحادي الجرعة | none | pillow (4 seals) | front, back |
| `FLEX_STICK_PACK` | Stick pack | ظرف طولي | none | pillow (tube + back fin) | front, back |
| `FLEX_RETORT_POUCH` | Retort pouch | كيس تعقيم حراري | none | pillow (10 mm seals) | front, back |
| `FLEX_VACUUM_PACK` | Vacuum pack | كيس تفريغ هواء | none | pillow (slab section) | front, back |
| `FLEX_FLOW_WRAP` | Flow wrap (bar) | غلاف انسيابي | none | pillow, horizontal | front, back |
| `FLEX_SHRINK_SLEEVE` | Shrink sleeve film | غلاف انكماش حراري | none | sleeve | sleeve |
| `FLEX_MAILER_BAG` | Poly mailer bag | كيس شحن بلاستيك | none | pillow (bottom fold + flap) | front, back |
| `FLEX_BAG_IN_BOX` | Bag-in-box bladder | كيس داخلي لعبوة كرتون | none | pillow + gland | front, back |

`standard` is `null` for all of them on purpose: FEFCO and ECMA cover board only, and there is no
published numbering for film pack styles. Styles are named by construction (seal pattern + gussets)
and sized by the converter as W x H (+ G). Do not invent a code.

Options (per style, see `allowedOptions`): zipper, spout (corner / top / front gland), clear window,
tear notch, hang hole (round / euro slot), round corners, degassing valve, tin tie, adhesive flap.
Film materials: `FILM_MATTE`, `FILM_GLOSS`, `FILM_METALLISED`, `FILM_KRAFT_LAMINATE`, `FILM_CLEAR`.

## How it works

- **Flat in, filled out.** `solveShape(cfg)` bends the flat film without stretching it: each row's
  cross-section (superellipse lens, or box section with V-folding gussets) is solved so its arc
  length equals the flat width, and rows are spaced by arc length along the centre line so the
  face keeps its flat height. A filled pillow therefore pinches in and gets shorter, like the real
  thing. `fill` (0..1) drives the bulge; volume (ml) is integrated from the cross-sections.
- **UV contract.** Every face/seal/base vertex has a flat coordinate (s across, t down from the
  top trim edge), mapped with `panelUv(panel, s, t)` onto that panel's PRINT area (trim + 3 mm
  bleed). One texture per panel, drawn in flat print coordinates, lands without distortion.
- **Seals.** Flat two-ply parts (front ply uses the front artwork, back ply the back artwork),
  with tear notches, rounded corners and hang holes cut into the outline. `uv1` is in crimp pitches;
  `crimpNormalTexture()` (channel 1) gives the serrated look.
- **Print layout.** `printLayout(cfg)`: per panel trim, bleed (3 mm), safe rect (3 mm and clear of
  every seal by 2 mm), seal bands, keep-out zones (zipper, fin, valve, window, hang hole, tin tie,
  spout, mailer flap, sleeve seam), window rect; plus the flat film blank (width x length, m²)
  per pack for pricing.

## Conventions and simplifications (integrator, please read)

- Dims are FLAT: `W` face width (lay-flat width for tubes and sleeves), `H` face height (bag length
  for side-gusset bags; bar length for flow wrap; cut height for sleeves), `G` fully opened gusset.
- Side-gusset bag: the lower `G/2` of each face folds into the block base, so the standing height
  is `H - G/2`; the base mesh is textured from the bottom of the front and back panels.
- Quad-seal and flat-bottom pouches have a separate `bottom` panel (W x G).
- Flow wrap is built upright then turned -90° about Z (top seal at +X). Its print panels are
  LANDSCAPE (H x W, `panel.landscape`): front has the top seal on the right, back (seen from
  behind) on the left, so artwork laid out in the editor reads along the bar. `panelUv` handles it.
- Film wrinkles (`wrinkleAt`) are a displacement along the normal near end and side seals, scaled by
  fill; UVs are untouched. Clear film packs get an opaque `product` part so print never reads
  mirrored through the film.
- Shrink sleeve: `fill` means "conform" (0 = loose tube, 1 = shrunk 45% at the neck). It is not
  placed on a container here; the vessel engine can wrap it around its own profiles.
- The mailer flap is the unprinted inner side of the back ply; it is a keep-out on the front.
- Tear notches are cut into the top-seal edge; a doypack notch in the side seal above the zip
  is shown in the same place.
- Corner spout: the top-right corner of the header is chamfered and the spout sits at 45°.
- Hardware sizes (valve Ø21 mm, spout 10 mm bore / Ø22 cap, BIB gland Ø38 cap, euro slot 30 x 8 mm,
  round hole Ø6 mm) are typical generic values; confirm with the converter's fitment drawing.

## Local types the integrator may want to promote

All in `types.ts`: `FlexibleCode`, `FlexibleDefinition`, `FlexDims`, `FlexOptions`,
`FilmMaterialCode`, `FlexPrintPanel`, `FlexPrintLayout`. Mapping to the shared
`VesselDefinition` (src/lib/vessels/registry.ts): `D = W`, `H = H`, `G = G`, family `POUCH`; the
existing `STAND_UP_POUCH` vessel kind can be replaced by `FLEX_STAND_UP_POUCH`. `FlexPanelId` adds
`gussetLeft`, `gussetRight`, `bottom`, `sleeve` faces that `PrintSurfaceKind` does not have yet.
Nothing in shared registries, prisma, pages or i18n was touched. To show a pack in the existing
scene: `const { group } = buildFlexibleGroup(parseFlexConfig({...}), { artwork: { front: tex } })`.

## Sources

- Stand-up pouch sizes and gusset rules: Mailcoms 120 x 200 x 80; Vivopak 500 g 190 x 275 + 100;
  Epac 1 kg 235 x 300 x 110; YLTPACK gusset guide (gusset 40-60% of width); Chromapack sourcing
  guide (side seals 10-15 mm). https://yltpacking.com/how-to-measure-and-select-gusset-size-for-stable-stand-up-pouches/
- VFFS pillow bags: film width = 2W + back seal + allowance (shkpack); end seals 10-15 mm
  (YLTPACK pillow bag size guide). https://yltpacking.com/pillow-bag-size-guide-how-to-choose-the-right-dimensions-for-your-product/
- Retort and 3-side-seal sizes 90x140, 130x200, 160x230: https://yltpacking.com/retort-pouch-sizes-guide-standard-dimensions-and-capacity/
- Stick pack widths 17 / 23 / 35 mm: https://making.com/technologies/stickpack-machines
- Side-gusset coffee bags 250 g 90x60x270, 500 g 115x55x310, 1 kg 130x70x400 (Thriving Enterprises).
- Flat-bottom coffee bags 250 g 125x195x65, 500 g 135x265x70: https://www.vivopak.com.au/
- Bag-in-box 3 l 330 x 270 (gdokpackaging), 10 l outer 500 x 400 (Fischer-Lahr spec sheet).
- Presets marked "approx." in `definitions.ts` are typical market sizes without a single published
  source; get a converter drawing before ordering.
