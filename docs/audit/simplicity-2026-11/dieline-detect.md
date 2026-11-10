# Dieline detector (full artwork with die lines drawn on it)

2026-11-09. Module: `src/components/designer/lib/dielineDetect/`. Pure TypeScript with no DOM. It runs in a Web Worker and in Node tests. No generated files and no dieline code were changed.

## What it does

`detectDieline(img, { models, dpi?, pxPerMm?, maxCandidates? })` takes RGBA pixels of an uploaded artwork that has the box's cut and fold lines drawn on it. It returns which library box model it is, at what size, and the top template mapped onto the image.

1. **Strokes** (`extract.ts`). The image is box-averaged to a long side of about 1100 to 1650 px. A pixel counts as a *ridge* when it differs from the pixels 2 to 3 px away on both sides while those two agree with each other. This rejects flat areas and the edges of large shapes, and it is tested in 6 directions. The die colour is the dominant colour of ridge pixels that lie on long straight horizontal or vertical runs, weighted by run length × contrast² (up to 2 colours). The stroke mask keeps ridge pixels whose colour is a mix between the local background and a die colour. This handles antialiasing and JPEG blur on any background.
2. **Vectorise**. A small rotation (up to ±3°) is estimated from projection sharpness and undone. Row and column runs, with gaps for dashed creases, become axis-aligned segments that carry an ink share: about 1 for solid cuts, lower for dashed lines. Short broken runs are artwork such as text or a QR code, so they are dropped. The silhouette is found on a coarse grid of about 400 px: a flood fill from the border through the max-pooled stroke mask, with the result being the blank's outline and bounding box.
3. **Match** (`match.ts`, `score.ts`, `detect.ts`). Every box model is built with its own `build()`. The straight-line positions are linearised in L, W and H (4 builds per model, cached, computed in `prepareModels`) in all 8 orientations (4 rotations × mirror). The px/mm scale is fixed when it is known. With it fixed, the image line positions are linear in (s·L, s·W, s·H, offsets). A weighted least-squares ICP pairs template lines with detected lines under a shrinking gate. The pipeline:
   - **Prefilter** all models. A quick fit from the default size is combined with a normalised-layout comparison, keeping the union of the best 28 of each.
   - **Line fits** from several starts: presets and the default (stretched or anchored at either end), plus data-driven starts where L, W and H come from the panel sizes seen on the art (gaps between consecutive lines) with offsets voted Hough-style. The 3 best distinct fits per model are kept.
   - **Short list** of 12 models by line score blended with a cheap raster look.
   - **Verify**. Each model is re-linearised at its fitted size, then scored by truncated chamfer both ways (template on the art, art on the template) and silhouette IoU. The leaders get a pattern-search refinement on the raster match.
   - Near ties keep the input order, so a core model wins over its identical family twin.
4. **Size**. When the scale is known (`pxPerMm`, or file dpi from `readImageDpi` between 100 and 2400, not 72 or 96), dims are absolute (`scaleKnown: true`). Otherwise the proportions are exact, and the absolute size is the scale that puts them nearest one of the model's presets or its default size, kept inside the limits (`scaleKnown: false`). In that case the UI should ask the buyer for one measurement.

## Results

**Synthetic set**: 10 library dielines (8 of them in the test). Each one is drawn over random artwork (blobs and dark scribbles) in red, magenta, cyan, green, black or blue, with 1 to 2 px lines, dashed creases, rotation up to ±1.2°, all 8 orientations, and pixel plus 8×8 block noise. All 10 come back top-1 with dims within 1.3%: FEFCO_0427, FEFCO_0201, ECMA_RTE, ECMA_STE, PIZZA, FEFCO_0422, ECMA_CLB, GABLE_BOX, FEFCO_0203 and FS_BAKERY_BOX. Most errors are 0.0 to 0.7%. At about 2000 px with 1 px lines, 9 of 10 come back top-1. The miss is ECMA_RTE: ECMA_PHARMA_RTE scores 0.953 against 0.949, and the two near-identical family variants differ only in tuck proportions.

**Owner's sample** (`__fixtures__/owner-mailer-sample.jpg`, 1244×1600, 72 dpi JFIF so the scale is unknown):
- The red die lines (#b95044), skew 0 and the blank's outline are all found.
- The top candidates are all the same construction: a hinged tuck lid with dust flaps, double end walls with locking tabs, and ears. FS_BAKERY_BOX scores 0.75, FEFCO_0421_1 0.74, RIGID_COLLAPSIBLE 0.72, FEFCO_0421 0.71 and FEFCO_0426a 0.70, all at L:W:H ≈ 0.98 : 1 : 0.32 (the base is 524 × 535 px and the walls are about 160 px).
- **FEFCO_0427 is not first, and the reason is structural.** The library's FEFCO_0427 generator adds a rolled-in double front wall (an `inner` panel below the front wall). The sample's front wall is single, with ears only. Fitted on its own, FEFCO_0427 overlays everything except that extra panel and scores 0.58 to 0.68, against 0.75 for the bakery box, whose die lines up almost line for line with the sample. Forcing 0427 to the top would need a bias that breaks the synthetic set. If the owner wants this artwork to read as "Mailer box", the options are:
  - (a) give FEFCO_0427 a single-front option, which changes geometry and needs a snapshot update, or
  - (b) map the "tuck-lid, double end wall" group to the mailer product in the UI.

  The test asserts the construction group and the proportions, and documents this.

**Timings** (Node 24 on this laptop, warm caches, single thread, while other agents were building):

| Input | Time |
|---|---|
| Owner's sample | 1.0 to 1.2 s (strokes 0.2, vectorise 0.1, prefilter 0.14, fit 0.12, short list 0.17, verify 0.35) |
| Synthetic images, 700 to 1600 px | 0.65 to 1.3 s |
| About 2000 px | 0.8 to 1.5 s |
| `prepareModels` (once per worker) | about 0.9 s |

Call `prepareModels` when the panel opens so the first upload doesn't pay it.

**Debug images** (scratchpad, not in the repo):
- `C:\Users\Admin\AppData\Local\Temp\claude\f8173f44571ee159\d92726ee-f788-4602-8df6-7bcebbbfc7a0\scratchpad\dieline-detect\sample-lines.png`: stroke mask in black, segments in red, silhouette in blue.
- `C:\Users\Admin\AppData\Local\Temp\claude\f8173f44571ee159\d92726ee-f788-4602-8df6-7bcebbbfc7a0\scratchpad\dieline-detect\sample-overlay.png`: the top match drawn over the sample (blue cuts, green dashed creases).
- `C:\Users\Admin\AppData\Local\Temp\claude\f8173f44571ee159\d92726ee-f788-4602-8df6-7bcebbbfc7a0\scratchpad\dieline-detect\sample-overlay-FEFCO_0427.png`: FEFCO_0427 fitted alone, showing the extra front panel.

## Integration (for the «Full artwork» fit check)

Wired on 2026-11-10: the Full artwork upload recognises the box and re-composes the art on the open model's template. See `docs/audit/dieline-remap.md`.

Do not import the detector into the main bundle. Use the worker client:

```ts
import { createDielineDetector, imageForDetection } from "@/components/designer/lib/dielineDetect/client";

const detector = createDielineDetector();      // once (e.g. ArtworkPanel mount); detector.dispose() on unmount
detector.prepare();                            // loads the box packs in the worker, warms caches (~1 s)

// in onSheetUpload(file):
const { image, dpi, scale } = await imageForDetection(file);   // RGBA (long side ≤ 2400) + file dpi
const res = await detector.detect(image, { dpi });             // or { pxPerMm } once the buyer typed a size
if (res.found) {
  const top = res.candidates[0];
  // top.code, top.slug, top.name / top.nameAr, top.dims (mm), top.proportions, top.scaleKnown, top.score, top.why
  // !top.scaleKnown → ask for one measurement, then dims = proportions × (typed mm / proportions[key])
  //                    or re-run detect with pxPerMm.
}
// Overlay: res.overlay.{cut, crease, perf} are segments and res.overlay.panels polygons in the
// pixels of `image`; divide by `scale` for the original file's pixels. res.overlay.transform maps
// DielineModel sheet mm → image px (canvas setTransform order).
```

Notes:
- `res.found` is true when the best candidate scores at least 0.6 (`FOUND_SCORE`). `res.lines` always describes the strokes: colours, skew, segments and die box.
- The worker uses `loadModel` per box code from `MODEL_INDEX` (committed registry API), so the family packs load in the worker only.
- Synchronous use (tests, scripts): `detectDieline(img, { models: BOX_MODELS })` from `@/components/designer/lib/dielineDetect`.

## Limits

- Lines must be mostly axis-aligned (rotation up to ±3°). A scan photographed at an angle with perspective is out of scope.
- One die per image. Multi-piece models laid out on one sheet match only if the art shows the same layout.
- The die colour must differ from its local background. Where the die runs over artwork of the same colour, those stretches are lost, though the gaps are bridged.
- Lines thinner than about 0.6 px at the working resolution, as in very large images with hairlines, become faint. Then `found` may be false.
- Library twins (a core model and a family variant with the same die) tie, and the core model is listed first. Near-twins such as ECMA_RTE and ECMA_PHARMA_RTE can swap at high resolution.
- Real-world art often has flap shapes that differ from Elba's templates (tuck depth, rounded dust flaps). The scores tolerate this, but the absolute score is lower: about 0.75 on the sample against 0.93 to 0.97 on synthetic art.

## Files

- `types.ts`: API types.
- `extract.ts`: strokes, deskew, segments, silhouette, distance transform.
- `match.ts`: model geometry, orientations, linearisation, ICP, data-driven starts.
- `score.ts`: raster checks.
- `detect.ts`: pipeline, overlay, `prepareModels`.
- `dpi.ts`: JPEG JFIF/EXIF and PNG pHYs.
- `worker.ts` and `client.ts`: Web Worker and browser helper.
- `index.ts`: exports and `loadDetectModels`.
- `__tests__/dielineDetect.test.ts`: 15 tests, about 12 s.
- `__tests__/synth.ts`: test rasteriser.
- `__fixtures__/owner-mailer-sample.jpg`.

## Checks

- `npx tsc --noEmit`: clean.
- `npx eslint src/components/designer/lib/dielineDetect`: clean.
- `npx vitest run src/components/designer/lib/dielineDetect`: 15/15.
- `npx vitest run src/lib/dieline`: 24 files, 6079 tests passed.

`src/lib/dieline/fold.ts` and `__snapshots__/geometry.json` show as modified in the working tree. That change is another agent's work; this task did not edit them.
