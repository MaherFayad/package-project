# 3D engine and model library

## Purpose

One shared geometry engine drives the 3D view, the flat dieline, preflight, pricing area and the print PDF. The library registers every model the designer can open: **372 models** (276 boxes and 96 containers). The public catalogue adds 40 quote-only family models on top (412 total, see `catalogue.md`).

## Key files

| Path | Role |
|---|---|
| `src/lib/library/types.ts` | `ModelDef = BoxModelDef \| VesselModelDef`, `ModelSource` (14 packs), `MODEL_GROUPS` |
| `src/lib/library/packs/*.ts` | One pack per family; each exports `models` |
| `src/lib/library/packs/common-box.ts` | `familyEntry()`: turns a family definition into a box model, derives `group`, `baseFor`, `openTop`; `UNPRINTED_FITTINGS` |
| `src/lib/library/boxes.ts`, `vessels.ts` | Eager aggregation with dedupe (first pack wins a code; a repeated slug gets `-<code>` appended); `EXCLUDED_FAMILY_MODELS` |
| `src/lib/library/index.ts` | `MODELS` (eager, for server, scripts, tests) |
| `src/lib/library/registry.ts` | Lazy browser loader: `loadModel(code)`, `useLibraryModel`, `PACK_LOADERS` (PERF-04) |
| `src/lib/library/model-index.generated.ts` | `MODEL_INDEX: code -> [pack, slug]`. Generated |
| `src/lib/library/doc.ts` | `docGeometry(doc)`, `normaliseDocModel`, `baseOf`, `docBoardArea`, `vesselPrintMaterials` |
| `src/lib/dieline/` | `generateDieline`, `fold.ts` (poses, bounds, faces), `svg.ts`, `structures.ts` (13 core generators), `builder.ts`, local `./math` |
| `src/lib/dieline/families/<fam>/` | ecma-specials, ecma-tuck, fefco-02, fefco-03-05, fefco-04, fefco-06-07, fefco-09, foodservice, rigid-tubes. Each has a README, `definitions`, generators, tests |
| `src/lib/vessels/` | `profile.ts` (neck finishes, `buildProfile`), `labels.ts`, `layout.ts`, `stocks.ts`, `registry.ts` (`VESSELS`), `families/{bottles,cosmetic-cans,flexible}` |
| `src/components/three/index.ts` | Light, lazy entry: `PackagingSceneLazy`, `VesselSceneLazy`, `loadEngineStack` |
| `src/components/three/engine.ts` | Eager three/R3F exports. Import only from lazily loaded modules |
| `src/components/three/PackagingModel.tsx` | Box mesh: one group per panel pivoting on its hinge, `foldProgress` 0 to 1 |
| `src/components/three/finishes/` | `FinishedPackagingModel`, finish materials and masks (foil, spot UV, emboss, soft touch) |
| `src/components/three/vessels/` | Custom lathe `geometry.ts` (`revolve`), `VesselModel`, closures, `labelArt.ts` |

## Model packs (counted from the index)

| Pack | Models | Pack | Models |
|---|---|---|---|
| core | 13 | ecma-specials | 20 |
| fefco-02 | 24 | foodservice | 8 |
| fefco-03-05 | 32 | rigid-tubes | 14 |
| fefco-04 | 82 | vessel-core | 10 |
| fefco-06-07 | 33 | vessel-bottles | 34 |
| fefco-09 | 36 | vessel-cosmetic | 37 |
| ecma-tuck | 14 | vessel-flexible | 15 |

## Concepts

- **Units**: millimetres everywhere in `src/lib/dieline` and `src/lib/vessels`. Dims are INNER size. Sheet space: x right, y down, origin top-left of the printed sheet including bleed, seen from the printed outside, never mirrored. Default bleed 3 mm; safe zone 3 mm (folding carton) or 5 mm (corrugated). The renderer works in metres (`MM = 0.001`).
- **Box model**: `build(dims, { thicknessMm, features })` returns a `DielineModel` (panels with hinges and fold angles, cut/crease/perf lines, faces, bleed and safe zones, metrics). `baseFor(material)` returns the core `StructureCode` it is produced and priced as.
- **Vessel model**: `describe(dims, surfaces, presetId)` returns a lathe profile, print areas and an envelope. Flexible packs render as film (`render: "flexible"`).
- **Labels as dielines**: for containers, `docGeometry` lays the print areas side by side as one flat `DielineModel`, so the face editor, preflight, dieline view and PDF work unchanged.
- **Purity**: `src/lib/dieline` and `src/lib/vessels` do not import three.js (only `families/flexible` group builders do). Keep it that way: the dieline core reaches non-3D pages (E-34/E-44).

## Data flow

```
families/<fam>/definitions.ts -> packs/<pack>.ts (familyEntry) -> boxes.ts / vessels.ts -> MODELS
                                                               -> model-index.generated.ts -> registry.ts (lazy, browser)
Design doc -> docGeometry(doc) -> DielineModel -> PackagingModel (3D) | DielineView (SVG) | preflight | pdf/print.ts | pricing area
```

## How to add a model

1. **Definition**: add it to the family's `DEFINITIONS` (`src/lib/dieline/families/<fam>/definitions.ts`, or `src/lib/vessels/families/<fam>/`). The pack maps over `DEFINITIONS`, so no registration code is needed.
   - A box appears only if its family is CORRUGATED, FOLDING_CARTON, RIGID or TUBE and it has a priced material (`familyEntry`). Otherwise it lands in `EXCLUDED_FAMILY_MODELS`.
   - Check what `baseStructure` (keyword match on sub-family or code), `groupOf` and `isOpenTop` derive for it.
   - Vessels need closure and colour maps (`BOTTLE_CLOSURE_STYLE`, `COS_CLOSURE_STYLE`).
   - A whole new family also needs: a `ModelSource` member (`types.ts`), a `PACK_LOADERS` entry (`registry.ts`), a pack file, and a place in `BOX_PACKS` (`boxes.ts`) or the vessel list.
2. **Catalogue mapping**: a new sub-family needs a rule in `src/data/catalogue/mapping.ts` (`availabilitySlugFor`).
3. **Regenerate**:
   ```bash
   npx tsx scripts/generate-library-index.ts
   npx tsx scripts/generate-model-thumbnails.ts
   npx tsx scripts/generate-catalogue-rows.ts
   npx tsx scripts/generate-order-mode-table.ts
   npx tsx scripts/generate-route-slugs.ts
   npx tsx scripts/render-catalogue-thumbnails.ts --only CODE   # app must be running
   ```
4. **Geometry snapshot** (box models): `UPDATE_GEOMETRY_SNAPSHOT=1 npx vitest run src/lib/dieline/__tests__/geometry-snapshot.test.ts`.
5. **Seed**: `prisma/seed.ts` creates a `CatalogModel` row per model and fails if a model has no vendor rate card for its base. Re-seed.
6. Run the tests below, then open `/en/design/<slug>` and `/en/dev/3d?model=<code>`.

## Geometry snapshot workflow

- Test: `src/lib/dieline/__tests__/geometry-snapshot.test.ts`. File: `__snapshots__/geometry.json` (292 keys: 276 box models plus 16 core structures with every feature on).
- Per model it builds at `defaultDims` with the first material's thickness and stores truncated sha256 hashes of the dieline JSON, the fold poses at 0, 0.37 and 1, the bounds at 0, 0.5 and 1, and the structure illustration SVG. Errors are stored as `"throws: ..."`.
- It fails when the key set changes or any hash changes. Update only for intended geometry changes and say so in the commit. Timeout 300 s.
- There are no image snapshots. `docs/audit/3d-visual-geometry.json` is audit tool output (`docs/audit/tools/geometry-check.ts`), not a test.

## Tests

| Test | Covers |
|---|---|
| `src/lib/library/__tests__/library.test.ts` | Unique codes and slugs, both names, SVG thumbnail exists, every box folds with a priced board, every container describes its areas, pricing via base, e2e manifest matches |
| `src/lib/library/__tests__/registry.test.ts` | `MODEL_INDEX` count and entries, picker rows match the catalogue |
| `src/lib/dieline/__tests__/*`, `families/*/__tests__` | Generators, folding, SVG, the snapshot |
| `src/lib/vessels/__tests__`, `src/components/three/__tests__` | Profiles, labels, renderer geometry |
| `e2e/models.spec.ts` | Opens every model in the designer, changes size, board and a finish, checks no errors and a painted canvas, writes `docs/screenshots/models/<code>.png` (desktop only, slow) |
| `e2e/catalogue-models.spec.ts` | All 412 catalogue renders, contact sheets in `docs/screenshots/models/catalogue/` |

Dev pages: `/[locale]/dev/3d?model=<code>`, `/[locale]/dev/finishes`, `/[locale]/dev/catalogue/<code>`. Perf tools: `scripts/perf/measure-3d.cjs`, `shots-3d.cjs`, `leak-shared-canvas.cjs`.

## Pitfalls (from the audits)

- **E-32 / X-10 (open)**: inside-lid copy reads upside down. Do not change `faceTransform` without a versioned artwork migration: it moves saved layer coordinates.
- **E-01 / E-51 / E-55**: GPU leaks. Keep the single shared `EngineCanvas` (never keyed) and `SoftShadow`; check with `scripts/perf/leak-shared-canvas.cjs`.
- **E-03**: memoise light rigs; `<Environment>` re-renders its cube camera when children change identity.
- **E-33**: pieces pass through walls mid-fold; tune per-family `foldStage` and `assembly.lift`.
- **E-43 (open)**: a resized artwork canvas allocates a new texture.
- **E-45**: spot UV is invisible without a mask.
- **FF-13 (open)**: FEFCO 09 fittings render alone in the designer, without a host box.
- **R4-01**: tinplate renders near black when the environment sits below the horizon.
- **R6-3Q-D-06 (open, medium)**: gable-top gusset is not folded. See `docs/audit/STATUS.md` for the other open lows.
- Family READMEs and the `3d-*.md` audits record per-model fixes; read the one for your family first.
