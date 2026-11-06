# 3D audit: cans, tins, cosmetic, pharma, tubes and flexible packs

Key: `3d-cans-flexible` · Branch: `claude/exciting-albattani-8kzgsu-3d-cans-flexible` · Scope: `src/lib/vessels/families/cosmetic-cans`, `src/lib/vessels/families/flexible` (+ their tests).
Contact sheets: `docs/screenshots/audit/3d-cans-flexible/` — `cans`, `cosmetic`, `pharma-tubes-cups`, `flexible-1`, `flexible-2` (`-before.jpg` / `-after.jpg`) plus `cans-closures-*` (pass 1); 5 views per model: iso, front, back, high, low.

## Method

- Every model in both folders (37 catalogue containers, 15 film packs) rendered through the same `DesignScene` → `VesselView` path the designer uses (`/en/dev/3d?model=`, library browser), Chromium + SwiftShader, 1440×900, 1x, `reducedMotion: reduce`; spot checks in the live designer `/en/design/<slug>` at iPhone 13 (390×844).
- Sizes checked against the presets' sources (README tables): 330 ml can Ø66.2 × 115.2, 250 slim Ø53.4 × 134, tuna Ø83 × 37–42, 1/4 Club 105 × 60 × 29, paint 1 l Ø108 × 125, doypack 250 g 160 × 230 + 80. All presets already matched; no dimension changes were needed.
- Cross-checked with `docs/audit/3d-visual.md` (§12 V-11 … V-20, §13 V-21 … V-23) on `claude/exciting-albattani-8kzgsu-audit-3d-visual`.
- Two passes: baseline → fix → re-render → fix → full re-render.

Severity: critical = not the product it claims; high = clearly wrong to a packaging buyer / option silently not shown; medium = visible realism defect; low = nitpick.

## Findings

### A. In scope (fixed here)

| ID | Sev | Model / file | Finding | Standard / reference | Fix | Status |
|---|---|---|---|---|---|---|
| CF-01 | critical | TIN-GIFT-SQUARE, TIN-TEA-CADDY · `cosmetic-cans/geometry.ts · tin` (= 3d-visual V-11) | Round core slip lid floating inside a square tin, its edge poking through the four side walls as grey tabs; open body top. | Square tins: square slip lid, rounded corners, curled skirt edge proud of the body by ~1 mm. | Non-round tins carry the lid in the profile: body → 0.8 mm skirt step with curl → rounded top edge → embossed panel, closed on the axis; core closure anchored inside (`closureY`, coreKind `CAN`). | fixed |
| CF-02 | high | CAN-TUNA, CAN-SARDINE, CAN-OVAL-FISH · `geometry.ts · metalcan`, `definitions/cans.ts` | No ring pull: tuna showed a white slip disc (core `ROUND_TIN`), sardine/oval had the core pull tab buried 2 mm below the end panel. | Full-aperture easy-open end (Crown / Egycan 83 mm): ring-pull tab lying in the countersink. | `ringPullAnchor(panelY)` puts the core `CAN_END` tab flat on the panel; tuna coreKind `CAN`. | fixed |
| CF-03 | high | CAN-PAINT · `geometry.ts · metalcan` | White slip disc over the chime; lid skirt band visible below the seam. | Lever-lid tin (IS 2552 ref.): recessed plug lid inside the chime ring. | Profile already has the 7 mm recessed lid; core closure hidden under it (`closureY`), coreKind `CAN`. | fixed |
| CF-04 | high | COS-DEO-STICK · `geometry.ts · caseShape` (≈ V-15) | Round jar lid (core `LUG_LID`) over an oval barrel. | Oval twist-up stick: cap the full oval section. | Oval cap is in the case profile; core closure hidden inside (coreKind `CAN`). Twist wheel at the base still missing (engine, see E-07). | fixed (partly) |
| CF-05 | high | FLEX_FLOW_WRAP · `flexible/layout.ts` | Bar is shown lying horizontal but its print panels were portrait: artwork laid out in the 2D editor read **sideways** along the bar. | Bar / wafer wraps are printed along the length (text runs end seal to end seal). | Horizontal packs get landscape panels (`landscape: "topRight"` front, `"topLeft"` back); all rects rotated; `panelUv` maps accordingly. | fixed |
| CF-06 | high | FLEX_VACUUM_PACK and any `FILM_CLEAR` pack · `flexible/materials.ts`, `geometry.ts` (= V-22) | Back face showed the front artwork **mirrored** through the film (double-sided 55 % film), no product inside. | Clear printed film: ink with white underlay is opaque, unprinted film shows the product. | Printed clear film is single-sided and opaque where inked (artwork alpha keeps clear areas clear); new `product` part (body shrunk 8 %, neutral food tone) inside transparent packs. | fixed |
| CF-07 | high | All film packs · `flexible/geometry.ts · wrinkleAt` | Perfectly smooth film, no gathering where the bulge pinches into seals: reads as inflated plastic. | Filled pillow / pouch: film cannot stretch, spare width gathers into soft ripples fanning from end seals, strongest at the corners. | Procedural wrinkles along the normal (two incommensurate wavelengths ≈ W/9, phase drift, per-panel seed), fading over min(24 mm, 0.2 H) from end seals and 14 mm from side seals, scaled by fill, zero on empty packs and sleeves. Positions only: UVs unchanged, so artwork does not swim. Mesh 56 × 40 per face (≈ 10k triangles a pack). | fixed |
| CF-08 | high | FLEX_STAND_UP_POUCH · `flexible/shape.ts · standup` | Elliptical cross-section pinched the base into a narrow round cup; the pouch read as a tapered tumbler. | Doypack: front and back meet the side seals at an angle; base is eye-shaped and nearly full width. | Superellipse exponent 1.35 (pointed lens) for body rows and base (`base.n`), so faces stay ≥ 85 % of width at the shelf. | fixed |
| CF-09 | medium | All sealed packs · `crimpNormalTexture` | Crimp serration read as hard ruler lines at 1x DPR. | Crimp jaws give a fine, low-relief texture. | Normal slope 0.7 → 0.42. | fixed |
| CF-10 | medium | FILM_METALLISED packs · `materials.ts` (≈ V-21) | Printed metallised film rendered 35 % metal: artwork looked dull and dark. | Metallised film is printed over a white underlay; metal shows only where unprinted. | Mapped metallised metalness 0.35 → 0.12. | fixed |
| CF-11 | medium | COS-PERFUME-ROUND, COS-PERFUME-OVAL · `definitions/cosmetic.ts` (= V-17) | Walls 3 mm read thin and cheap; brim volume 1.34× nominal. | Perfume flacons: 4–8 mm walls, 8–15 mm base. | Round wall 3.2 → 5 mm; oval 3 → 4.5 mm, base 8 → 10 mm (capacity tests still pass). | fixed |
| CF-14 | critical | TUB-ICE-RECT, TRAY-CLAMSHELL, TRAY-PUNNET · `geometry.ts · cup` (= 3d-visual V-12) | Rectangular ice-cream tub, clamshell and punnet carried a **round** lid disc (core `LUG_LID`) over a rectangular footprint. | Lid follows the body footprint: snap lid skirt over the flange; top-seal film flat on the flange; clamshell lid tray. | Non-round snap / film lids built into the profile (skirt with rounded top edge and recessed panel; flat film); the core closure is shrunk (`closureR` 0.4) and parked under the base (`CLEAR_HIDE_Y`). A ~1 px dot can still show through clear bases until E-04 lands. Sheets: `trays-lids-*.jpg`. | fixed |
| CF-12 | low | FLEX_SIDE_GUSSET_BAG tin tie | Tin tie is a flat 8 mm strip standing off the face; real ties fold over at the ends. | — | Left as is (reads correctly at default zoom). | open (low) |
| CF-13 | low | FLEX_MAILER_BAG | Adhesive flap is modelled on the front (README convention). Most retail poly mailers fold the flap onto the back so the front stays clean for the shipping label. | — | Needs a product decision (moves the keep-out to the back panel). | open (decision) |

### B. Outside scope (shared engine / library): not edited, precise fixes

| ID | Sev | File · function | Finding | Fix |
|---|---|---|---|---|
| E-01 | high | `src/components/three/vessels/materials.ts · createVesselMaterial TINPLATE` (= V-13) | Tinplate (sardine, oval, square tins, food can ends, round gift tin body) renders **black**: roughness 0.18, metalness 1 mirrors the transparent background. | roughness 0.18 → 0.3, envMapIntensity 1.25 → 1.8; add a wide front fill `Lightformer` (intensity 0.8, scale [10, 3, 1], position [0, 1, 4]) in `VesselScene.tsx` `Environment`. |
| E-02 | high | `src/lib/library/vessels.ts · COSMETIC.surfaces / defaultSurfaces` | `DIRECT_PRINT`, `IML`, `LID_TOP`, `LID_FOIL` are dropped by `isSurface`: lithographed tins and cups show bare metal / a fallback FRONT label; the 330 ml can is decorated as a shrink sleeve. | Map catalogue surfaces to core display surfaces: `DIRECT_PRINT → WRAP` (round) / `FRONT+BACK` (square), `LID_TOP → LID` (needs a rect lid disc in `labels.ts · lidTop` for `roundedRect` sections), `IML → WRAP`. |
| E-03 | high | `src/lib/library/vessels.ts · COSMETIC.defaultLiquid` | Perfume, serum, roll-on, dropper show opaque **cream** inside clear glass (`CREAM` for every cosmetic). | Per-model liquid from the definition (`def.defaultContent`, add it to `CatalogueVesselDefinition`): perfume `PERFUME`, serum/dropper `SERUM`, roll-on `SERUM`. |
| E-04 | high | `src/lib/library/vessels.ts · COSMETIC.closures` (+ 3d-visual X-01) | Catalogue closures collapse to the core kind's default: airless pump → wide lotion-pump disc, roll-on ball → screw cap, mist pump collar → plain cap, BULLET_CAP → `LUG_LID`, `EASY_OPEN_END` vs `DOUBLE_SEAM_END` / `PEEL_FOIL` identical. Picking them changes nothing in 3D. | Add `ROLL_ON_BALL`, `AIRLESS_PUMP`, `PEEL_FOIL`, `EOE_RING`, `BULLET_CAP` builders to `closures.ts`; pass the catalogue closure code (`VesselOption.style`) instead of `core`. Then remove the `closureY` hiding in `cosmetic-cans/geometry.ts`. |
| E-05 | medium | `src/components/three/vessels/closures.ts · CAN_END` | Pull tab uses the cap colour (`WHITE` default) instead of aluminium; tab is fixed 22 mm long (oversized on 52 mm ends, undersized on 153 mm). | Role `capMetal` with a fixed aluminium material for `CAN_END`; scale tab by `profile.finishR / 27`. |
| E-06 | medium | `src/lib/library/vessels.ts · FLEXIBLE.describe envelope` | Envelope is `{ W, max(G,30), H }` regardless of shape: flow wrap (horizontal) is framed as a tall object and sits low; filled pillows are framed by their flat size. | Use `FLEX.solveShape(cfg).envelope` (already rotated for horizontal packs). |
| E-07 | medium | `src/lib/library/vessels.ts · FLEXIBLE.defaultSurfaces` | Gussets and bottoms are never textured by default: quad-seal / flat-bottom gussets show bare silver film next to printed faces. | Default surfaces = all `def.panels`. |
| E-08 | medium | `src/lib/library/vessels.ts · FLEXIBLE.describe` | Flexible options (zipper, valve, spout, window, hang hole, tin tie) are not editable: `options: {}` always resolves to the definition defaults. | Store `doc.vessel.options`, pass it to `parseFlexConfig`, expose `def.allowedOptions` toggles in `ConfigPanel`. |
| E-09 | medium | `src/lib/library/vessels.ts · COSMETIC.describe` tubes | `TUBE-OVAL` renders round: tubes go through `describeVessel("SQUEEZE_TUBE")`, ignoring the family's stadium section (= V-19). | Use `COS.buildGeometry(def.shape, d).profile` for tubes too and let `tubeBodyGeometry` honour `profile.section`. |
| E-10 | low | `src/components/three/vessels/VesselScene.tsx · ContactShadows` | Every container's underside renders solid black from below (the shadow plane). | Fade the shadow plane when the camera is below y = 0 (`opacity * smoothstep(0, 0.05, camera.position.y)`). |
| E-11 | low | `src/components/designer/*` | Container models still say "Order this box" in the designer header. | Copy keyed by model kind (`designer.orderContainer`). |
| E-12 | low | `VesselScene.tsx` (= 3d-visual X-08) | Turntable 20°/s and stops for good on first touch. | Use `AUTO_ROTATE` from `finishes/motion.ts`. |

## Performance (mobile)

Live designer at iPhone 13 viewport, SwiftShader (software GL, so a floor, not a device number): film packs hold **60 fps** rAF idle; beverage can **18 fps** during its entrance animation (anisotropic `MeshPhysicalMaterial` + 128-segment lathe, engine). Film geometry builds in 30–90 ms and is 9–20k triangles (vacuum pack with product ≈ 30k).

## Counts

| Severity | Found | Fixed | Open |
|---|---|---|---|
| critical | 2 | 2 | 0 |
| high | 7 (+ 4 engine/library) | 7 | 4 engine/library |
| medium | 3 (+ 5 engine/library) | 3 | 5 engine/library |
| low | 2 (+ 3 engine/library) | 0 | 2 + 3 engine/library |

## Tests

- New: `cosmetic-cans/__tests__/closures.test.ts` (ring-pull anchor, hidden closures, square lid skirt), `flexible/__tests__/realism.test.ts` (landscape flow-wrap panels and UVs, clear-film product, wrinkle bounds and fade, doypack base width).
- `flexible.test.ts`: the per-component UV range loop (thousands of `expect()` calls, timed out at the finer mesh) now checks the same bound on the min / max in one assertion. Same predicate, nothing weakened.

## Round 2

Merged `origin/claude/exciting-albattani-8kzgsu` and `origin/claude/exciting-albattani-8kzgsu-3d-engine` (d9c2406). The engine now has real closure styles (`ROLL_ON_BALL`, `AIRLESS_PUMP`, `BULLET_CAP`, `PEEL_FOIL`, `EOE_RING`, mapped via `VesselOption.closureStyle`). Sheets: `round2-closures-before.jpg` / `round2-closures-after.jpg`.

| ID | Sev | Model / file | Finding | Fix | Status |
|---|---|---|---|---|---|
| R2-01 | high | CAN-TUNA, CAN-SARDINE, CAN-OVAL-FISH, CAN-FOOD-3PC · `geometry.ts · metalcan` | Ring pull was the generic core can tab placed by an offset hack (`ringPullAnchor`); the EASY_OPEN_END option on the food can showed nothing. | Hack removed. Closure anchor = end panel, so the engine's `EOE_RING` (ring + rivet, follows the section) sits on the panel and a plain double-seam end keeps the core tab hidden under it. | fixed |
| R2-02 | high | TRAY-PUNNET · `geometry.ts · cup` | Film lid drawn in the profile regardless of the closure option. | Profile is an open rim again; the engine's section-following `PEEL_FOIL` draws the film. The round fallback for the HINGED_LID option (no style yet) is shrunk to a speck (`closureR`). | fixed |
| R2-03 | high | COS-LIPSTICK · `geometry.ts · caseShape`, `definitions/cosmetic.ts` | Round jar lid disc on top of the case (core `LUG_LID` blocks styles). | Core kind `ROUND_BOTTLE` so `BULLET_CAP` applies; new `cap: "bullet"` shape option anchors the cap so its top is the case top and puts the split groove under its edge. | fixed |
| R2-04 | medium | COS-AIRLESS · `index.ts · catalogueEnvelope` | Overcap cropped by the camera: envelope ignored the renderer-drawn head because the case shape has a lid. | Airless head height (17 mm) added to the envelope. | fixed |
| R2-05 | — | COS-ROLL-ON, CUP-YOGURT | Now render the engine's ball + dome cap and peel foil. Verified. | — | fixed (engine) |
| R2-06 | medium | E-02, E-03 → `cosmetic-cans/display.ts` | Surface mapping and per-model liquid. | `displaySurfaces(def)` (DIRECT_PRINT / IML → WRAP on round, FRONT + BACK on square / oval; LID_TOP / LID_FOIL → LID on round) and `displayLiquid(def)` (perfume PERFUME, serums SERUM, vials / eye drops WATER, cans COLA, creams CREAM). Library hook below. | fixed in family, needs hook |
| R2-07 | medium | E-06, E-07 → `flexible/display.ts` | Flex framing and default panels. | `flexDisplayEnvelope(cfg)` (filled, flow wrap lying down) and `defaultPrintPanels(code)` (all panels). Library hook below. | fixed in family, needs hook |

Still open:
- **E-09 oval tube (engine):** `src/components/three/vessels/geometry.ts · tubeBodyGeometry(dims)` builds round rings from `dims.D` and ignores `dims.G`. Fix: pass `G` and make each body ring an ellipse with `a = D/2`, `b = G/2`, morphing to the flat crimp as it does now. Also have the library route tubes through `describeVessel` with `dims.G`. The family profile already carries the stadium section.
- **EOE ring on rect / oval tins (engine, new):** `closures.ts · styledClosure EOE_RING` places the ring at `z = R * 0.55` with R the half WIDTH, so on CAN-SARDINE and CAN-OVAL-FISH (depth 0.57× width) the ring hangs over the short edge. Fix: `z = R * depthRatio * 0.55` and `rr = min(…, R * depthRatio * 0.4)`.
- **Hacks kept** (no engine style yet): square slip / plug lids (TIN-GIFT-SQUARE, TIN-TEA-CADDY), lever lid (CAN-PAINT), twist-up cap (COS-DEO-STICK), snap lid on TUB-ICE-RECT, clamshell hinge. Each needs a section-following style (`SLIP_LID_SECTION`, `LEVER_LID`, `SNAP_LID_SECTION`, `TWIST_UP`, `HINGED_TRAY`); then drop `closureY` / `closureR` in `geometry.ts`.
- **E-08 flex options:** needs a designer field (`doc.vessel.options`) and ConfigPanel toggles from `def.allowedOptions`; the family already validates and renders every option.

### Library hook (not applied: this session's brief says not to edit src/lib/library)
In `src/lib/library/vessels.ts`:
- `COSMETIC`: `const shown = COS.displaySurfaces(def);` then `surfaces: shown.surfaces, defaultSurfaces: shown.defaultSurfaces` (replaces the `isSurface` filter), and `defaultLiquid: COS.displayLiquid(def)`.
- `FLEXIBLE`: `defaultSurfaces: FLEX.defaultPrintPanels(def.code)`, and in `describe`: `envelope: FLEX.flexDisplayEnvelope(cfg)`.

## Round 3

Merged `origin/claude/exciting-albattani-8kzgsu-3d-engine` 4d9d1e7: section-following `PLUG_LID`, `LEVER_LID`, `SNAP_LID`, `HINGED_LID`, `TWIST_UP` closure styles, a section-following core `SLIP_LID`, the oval tube body (E-09) and the EOE ring depth fix. Every remaining lid hack is gone; `geometry.ts` no longer hides or shrinks any renderer closure. Sheets: `round3-lids-before.jpg` / `round3-lids-after.jpg`.

| ID | Sev | Model / file | Change | Status |
|---|---|---|---|---|
| R3-01 | high | TIN-GIFT-SQUARE, TIN-TEA-CADDY · `geometry.ts · tin`, `definitions/cans.ts` | Profile-built square lid removed: open rolled rim for every section, core `ROUND_TIN` again. The renderer's `SLIP_LID` (square / rect section) and `PLUG_LID` style draw the lid. | fixed |
| R3-02 | high | CAN-PAINT · `geometry.ts · metalcan` | Hidden-closure anchor removed; the renderer's `LEVER_LID` plugs into the chime from the seam top. | fixed |
| R3-03 | high | COS-DEO-STICK · `geometry.ts · caseShape`, `definitions/cosmetic.ts` | Core-hiding removed (core back to the family default). New `cap: "twist"`: the renderer's `TWIST_UP` oval dome cap is anchored so its top is the case top, with the split groove under its edge. | fixed |
| R3-04 | high | TUB-ICE-RECT · `geometry.ts · cup` | Profile-built snap lid and shrunk fallback removed; the renderer's `SNAP_LID` follows the rectangle. | fixed |
| R3-05 | high | TRAY-CLAMSHELL · `geometry.ts · cup` | Profile is now the base tray with its flange; the renderer's `HINGED_LID` draws the lid. Hinge line `hb` solves `hb + max(8, min(30, 0.35 hb)) = H`, so the closed height is still H. The catalogue test checks that sum instead of the profile top. | fixed |
| R3-06 | medium | TRAY-PUNNET | Round fallback shrink removed; both options (`TOP_SEAL_FILM`, `HINGED_LID`) are now renderer styles. | fixed |
| R3-07 | medium | CAN-SARDINE, CAN-OVAL-FISH (EOE ring), TUBE-OVAL (E-09) | Verified after the engine fixes: the ring sits on the panel and the oval tube is flattened. | fixed (engine) |

What is left of `closureY`: anchors only. End panel for ring-pull and foil ends, and the anchor that puts `BULLET_CAP` / `TWIST_UP` flush with the case top. The overcap anchors mirror the renderer's cap formulas (noted at both places). If those formulas change, update `caseShape`.

Still open: E-02 / E-03 / E-06 / E-07 library hook (Round 2) and E-08 (flex options UI).
