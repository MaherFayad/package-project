# 3D engine audit and fixes

Key: `3d-engine` · Branch: `claude/exciting-albattani-8kzgsu-3d-engine` · Base: `36ab41f` (head of `claude/exciting-albattani-8kzgsu`).
Scope: `src/components/three/**` (engine, box viewer, finishes, vessels) and `src/lib/dieline` core. Engine API is backward compatible: every existing prop, handle method and export is unchanged; additions are optional (`toneMapping`, `exposure` on `PackagingScene`; `tint` on `VesselModel` / `VesselScene`; `heroView`, `modelKey`, `KEY_SHORTCUTS`, `SoftShadow`, `StudioLighting` exports).

## Metrics (before → after)

Same probe on both production builds (`next build && next start`, `ELBA_DEV_PAGES=1`): base commit built in a separate worktree, this branch built from HEAD. Probe: `scripts/perf/measure-3d.cjs` (WebGL call hooks, engine-agnostic, so it measures both revisions identically; `renderer.info` via `?debug3d` on the new build). Page: `/en/dev/3d`, first viewer, mid-phone profile 390×844, DPR 3 device (canvas capped at 1.5), touch.

| Metric | Before | After | Target | Note |
|---|---:|---:|---|---|
| Draw calls per orbit frame | 101 | **50** | < 50 scene + 0 shadow | shadow no longer re-rendered on camera moves |
| Triangles per orbit frame | 426 | 212 | — | shadow depth pass gone from orbit frames |
| Frames rendered while idle (3 s) | 0 | 0 | 0 | `frameloop="demand"` kept |
| Orbit drag fps, CPU 4× throttle (SwiftShader) | 5.2 | **14.5** | 50+ on a real phone GPU | see caveat |
| Keyboard rotate fps, CPU 4× throttle | 5.8 | **14.7** | — | |
| Longest frame during keyboard rotate | 200 ms | 100 ms | — | |
| Main-thread JS per frame, CPU 4× throttle | 22.0 ms | **12.8 ms** | < 20 ms (50 fps) | CDP profiler, `(program)`/GC excluded |
| Native (GL / SwiftShader) per frame, 4× | 254.8 ms | 85.0 ms | — | software rasteriser, not a phone GPU |
| Live GL textures after 0 / 10 / 50 model switches | 12 / 31 / **114** | 13 / 12 / **13** | flat | leak fixed |
| Live framebuffers after 0 / 10 / 50 switches | 13 / 33 / **115** | 14 / 14 / **14** | flat | leak fixed |
| Live GL buffers after 0 / 10 / 50 switches | 91 / 134 / 295 | 113 / 116 / 113 | flat | |
| `renderer.info` geometries / textures / programs after 0 → 50 switches | n/a | 35/9/8 → 35/9/8 | flat | |
| First 3D frame after navigation | 1 001 ms | 893 ms | — | desktop-class CPU |
| Structure switch (select → settled), median | 1 121 ms | 986 ms | — | includes 120 ms probe wait |
| JS heap after 50 switches | 32.7 MB | 34.2 MB | ± 5 MB | |
| Home page loads three.js | no | no | no | three / r3f / drei stay lazy |

Raw data: `docs/audit/perf-3d/before.json`, `docs/audit/perf-3d/after.json`.

**Caveat on fps.** This container has no GPU; WebGL runs on SwiftShader in the GPU process, which CDP CPU throttling does not slow. The fps above is bound by software rasterisation and is pessimistic. The transferable number is main-thread JS per frame: 12.8 ms at 4× throttle fits the 20 ms budget for 50 fps, and the GPU-side work per orbit frame halved (one scene pass instead of scene + shadow depth + 2 blur passes, and 2/3 pixel ratio while dragging).

## Findings

Severity: critical = broken / data / leak; high = clearly wrong, ugly or inaccessible; medium = noticeable polish; low = nitpick. Rows with an `X-`, `FN-`, `V-` or `PERF-` id come from `docs/audit/3d-visual.md` / `docs/audit/performance.md` (report-only sessions) and are engine-level.

| id | sev | page / file | finding | standard | fix | status |
|---|---|---|---|---|---|---|
| E-01 | critical | `PackagingScene.tsx`, `StudioStage.tsx`, `VesselScene.tsx` | GPU leak: drei `ContactShadows` reallocates two render targets whenever `scale` changes (every structure switch) and never disposes them: +2 framebuffers and +2 textures per switch (114 textures after 50 switches). | — | New `SoftShadow.tsx`: render targets allocated once per resolution, plane and shadow camera rescaled instead, everything disposed on unmount. | fixed (13 textures after 50 switches) |
| E-02 / PERF-11 | high | same | Contact shadow re-rendered the whole scene + 2 blur passes on every frame, including pure camera orbits: 101 draw calls per orbit frame for a 49-call scene. | — | `SoftShadow` re-renders only when a mesh moved (cheap world-matrix signature): fold, model swap, vessel animation. Orbit/zoom/finish crossfades reuse the cached shadow. | fixed (50) |
| E-03 | high | `PackagingScene.tsx` / `StudioStage.tsx` / `VesselScene.tsx` | drei `<Environment>` re-renders its cube camera (6 faces) whenever its children change identity: every React re-render of the rig (each artwork keystroke, `artworkVersion` bump, dimension-overlay toggle). | — | Rigs moved into memoised components (`lighting.tsx` `StudioLighting`, `VesselLights`). | fixed |
| E-04 / FN-01 | high | `finishes/finishMaterial.ts`, lighting | Gold / silver foil rendered as dull brown-olive ink: metal reflected a black world, and the coating's `envMapIntensity` (0.55 soft-touch) also dimmed the foil. | — | Grey studio sweep in the environment (photo-table gradient, never black); shader keeps foil reflections at their own strength (`elbaFoilEnv` 2.6) independent of the coating; faint crinkle normal from the grain tile gives glints. | fixed (see screenshots) |
| E-05 / X-03 | medium | `PackagingScene.tsx` | Three different light rigs (default box, studio stage, vessels); default box env 64 px with 3 cards, intensity 0.55; underside / back faces muddy. | — | One `StudioLighting` (key front-left, cool rim, hemisphere fill, 256 px softbox env with grey sweep) for every box viewer. Exposure tuned for Neutral tone mapping (no clipped reds). | fixed |
| E-06 | medium | `panelGeometry.ts` | Pale seam along every crease: each panel's end face on a fold showed the raw cut-edge material between two printed faces. | — | Edges on a crease go into the outside group with the sheet UV of the crease line, so the print wraps round the fold. Cut edges keep the board edge. | fixed |
| E-07 / X-06 | medium | `panelGeometry.ts` | Rigid set-up boxes (and composite tubes) showed a white board rim; the wrap turns over every rim. | — | For RIGID / TUBE families all outline edges take the printed outside. | fixed |
| E-08 / X-05 | medium | `panelGeometry.ts`, `boardMaterials.ts` | Flute wave drawn on every corrugated edge, including cuts parallel to the flutes; inside liner on the edge used the outside colour. | — | Edges along the sheet y axis (flute direction) sample one column of the flute tile: flat liner stack. Legacy flute tile takes the inside liner colour. | fixed |
| E-09 / FN-09 | medium | `boardMaterials.ts` | Legacy (non-finish) path printed kraft artwork as on white board. | — | Print multiplies with kraft (`#dcc7a8`) on kraft liners, same rule as the finished-board path. | fixed |
| E-10 / X-02 | medium | `PackagingScene.tsx · frameFor` | Bounding-sphere fit left boxes at 35–40 % of the frame; long folders at 10 %. | Product-shot convention | Projected-box fit (8 corners through the camera at the target view), margin 1.3 (≈ 75 % fill, clears the view toolbar). | fixed |
| E-11 / X-04 | medium | `PackagingScene.tsx` | Flat blank (fold 0) shown at the 3/4 view, foreshortened. | Dieline proof view | `heroView`: fold < 2 % frames the blank face-on (front view); folding again swings back to the 3/4 view. Done in the camera, not in `fold.ts`, so poses and face transforms are unchanged. | fixed |
| E-12 / X-07 | low | `PackagingScene.tsx` | Round tubes framed at 32°: centred front copy sat on the silhouette. | — | Models with rolled hinges use an 18° hero angle. | fixed |
| E-13 / X-12 | low | `PackagingScene.tsx` | Re-framing keyed on `structureCode`; library variants sharing a core code did not re-frame. | — | `modelKey` = code + panel set hash (dimension edits keep the user's angle). | fixed |
| E-14 | medium | `PackagingScene.tsx` | Structure change jumped the camera; model popped in. | WCAG 2.3.3 respected | Eased 700 ms glide to the hero view, 280 ms swap-in scale (94 → 100 %, ease-out). Both skipped under `prefers-reduced-motion`. | fixed |
| E-15 | low | `PackagingScene.tsx` | Fold was linear in progress. | Motion tokens: ease-in-out | Fold tween with `easeInOutCubic`, duration scaled by distance and fold stages. | fixed |
| E-16 | medium | `PackagingScene.tsx` | Poster cross-fade revealed the canvas before shaders were compiled (first drag hitch). | — | `ShaderWarmup`: `compileAsync` when `KHR_parallel_shader_compile` exists, else `compile`, then reveal two frames later. Without the extension three warned and its polling threw after unmount (`isReady` page error, seen in the browser). | fixed |
| E-17 | medium | `PackagingScene.tsx`, `VesselScene.tsx` | Turntables kept rendering while the viewer was off-screen. | Battery / perf | `useOnScreen` (IntersectionObserver) pauses spinning; resumes when visible. | fixed |
| E-18 | medium | same | Full pixel ratio while dragging (fill-rate bound on phones). | — | R3F `performance` regress from OrbitControls / keyboard API: 2/3 DPR (never below 1) during input, full sharpness 300 ms after. | fixed |
| E-19 | low | `PackagingModel.tsx` | Artwork anisotropy fixed at 4× (blurry type on faces seen at an angle). | — | `useTextureQuality`: renderer max, capped at 8×. | fixed |
| E-20 | low | `boardMaterials.ts` | `getImageData` on the fibre tile forced a GPU readback ("GPU stall due to ReadPixels"). | — | `createImageData` with a manual fill. | fixed |
| E-21 | medium | `PackagingScene.tsx`, `VesselScene.tsx` | Keyboard zoom only on `+`/`-` (not on every layout), no programmatic hint of the shortcuts. | WCAG 2.5.7, 2.1.1 | `PageUp`/`PageDown` zoom; `aria-keyshortcuts` on both viewers. Arrow keys / +/- / 0 / Home unchanged; `ViewControls` 44 px buttons unchanged (2.5.8). Focus ring 2 px `#005bd3` inside the viewer (2.4.7, not obscured 2.4.11). | fixed |
| E-22 | low | `PackagingScene.tsx` | Tone mapping hard-wired. | — | `toneMapping` prop (`neutral` default, `aces`, `agx`) and `exposure`. Neutral (Khronos PBR Neutral) is kept as default: it preserves approved sRGB brand colours, ACES/AgX shift hue and saturation. sRGB artwork, mipmaps and MSAA unchanged. | fixed |
| E-23 / X-08 | medium | `vessels/VesselScene.tsx` | Vessel turntable spun 20°/s immediately and stopped for good after one touch; boxes used 6°/s after 4 s idle and resumed. | WCAG 2.2.2 | Vessels use `AUTO_ROTATE` (4 s idle, 6°/s, eased ramp, resumes when idle again). | fixed |
| E-24 / FN-03 | medium | `finishes/looks.ts` | Matte lamination / matte varnish / gloss varnish invisible. | — | Matte lamination roughness 0.85, ink 0.97, env 0.45; matte varnish +0.15; gloss varnish clear coat 0.6 / 0.12. | fixed |
| E-25 / FN-04 | medium | `finishes/looks.ts` | Soft-touch washed to a chalky haze. | — | Sheen 0.45 → 0.18, sheen roughness 0.5, ink 0.92. | fixed |
| E-26 / FN-05, FN-06 | low | `finishes/looks.ts` | Gloss lamination streak weak; emboss too shallow. | — | Clear-coat roughness 0.03; `RELIEF_BUMP_SCALE` 2.2 → 4. | fixed |
| E-27 / V-06 | medium | `vessels/materials.ts` | Opaque labels showed the artwork mirrored through clear glass / PET. | — | Back faces of opaque label stocks render the white liner; clear stocks keep the reversed print (that is what you see through a clear label). | fixed |
| E-28 / V-13 | high | `vessels/materials.ts`, `VesselScene.tsx` | Tinplate read as black lacquer. | — | Tinplate roughness 0.28, env 1.8; broad front fill card and a dark-grey (not black) world in the vessel environment. | fixed |
| E-29 / V-11, V-12 (engine half) | critical | `vessels/closures.ts` | Square tins and rectangular tubs got a round lid. | — | `SLIP_LID` / `LUG_LID` are built on the body's cross-section; non-round lug lids lift instead of unscrewing. Family profiles still decide the section (V-12 punnet/clamshell film and hinge need family work). | fixed (engine) |
| E-30 / X-01 (engine half) | high | `vessels/VesselModel.tsx`, `materials.ts` | No way to tint a container (green / cobalt glass, coloured HDPE, black ABS). | — | Optional `tint` prop: body colour, and absorption colour for transmissive glass. Wiring from library options is the library session's (`VesselOption` → `VesselView`). | fixed (engine) |
| E-31 / PERF-12 | high | `vessels/VesselModel.tsx` | Same 128-segment bodies / labels on phones. | — | Quality "low" (phones): 64 radial segments (liquid 40, surface 32). | fixed |
| E-32 / X-10 | medium | `lib/dieline/fold.ts · faceTransform` | Inside-lid copy reads upside down when opened. | Printer convention | Not changed: `faceTransform` also drives the painter, preflight and saved layer coordinates; rotating it would move existing customers' inside artwork. Needs a versioned migration in the designer. | open (deferred, reason given) |
| E-33 / X-09 | medium | `lib/dieline/families/*` | Pieces sweep through walls mid-fold. | — | Engine already supports `foldStage` and `assembly.lift`; per-family values belong to the family sessions. | open (family scope) |
| E-34 / PERF-03 | critical | `lib/dieline/*`, `lib/dieline/families/*` | three.js core arrives on non-3D pages because the dieline engine and 30+ family files import `Vector3`/`Matrix4` from `three`. | — | Needs a route-level split of the model catalogue (designer / library scope) or a three-free math layer across all families; not safe to do from the core alone (mixed class identities). | open (cross-scope) |
| E-35 / PERF-08, PERF-22 | high | `components/designer/useArtworkCanvases.ts` | Full 2048 px sheet repainted and re-uploaded on every config change; no phone cap. | — | Designer scope (`maxPx` 1024 on phones, repaint only on artwork changes). The engine side already caps at the GPU limit and re-uploads only on `version` bumps. | open (designer scope) |
| E-36 / PERF-09 | high | `components/designer/DesignerApp.tsx` | Box ↔ vessel switch creates a new WebGL context each time. | — | Designer renders two different canvases; a shared canvas is an API change, left for the designer session. | open (designer scope) |
| E-37 / PERF-02, PERF-13 | critical | `components/marketing/HeroScene3D.tsx` | Hero replaces its poster `<img>` and rotates with its own endless rAF loop. | — | Marketing scope: keep the `<img>` mounted under the canvas and use `autoRotate` (engine turntable: demand-driven, off-screen pause, reduced-motion aware) instead of the rAF loop. | open (marketing scope) |

### Pass 2 (requests from the integrator, the designer session and the performance report)

| id | sev | page / file | finding | standard | fix | status |
|---|---|---|---|---|---|---|
| E-38 / PERF-09 | high | `EngineCanvas.tsx`, `PackagingScene.tsx`, `vessels/VesselScene.tsx` | Box ↔ container switches in the designer create a new WebGL context, environment and programs each time, because each viewer owns its `<Canvas>`. | — | New `EngineCanvas` (the accessible wrapper + one canvas, keyboard routed to the mounted content) and `PackagingSceneContent` / `VesselSceneContent` (scene without a canvas; `handleRef` works). `PackagingScene` / `VesselScene` are now thin wrappers with unchanged props. The designer session wires `DesignerApp` to one `EngineCanvas`. | fixed (engine API); designer wiring pending |
| E-39 / X-01 | high | `vessels/closures.ts`, `VesselModel.tsx`, `lib/library/{types,vessels}.ts`, `designer/VesselView.tsx` | Green / cobalt glass rendered amber or clear; crown, ROPP, cork + capsule, sparkling cork and pourer all rendered as a plastic screw cap. | ISO 12821 crown; ROPP; wine capsule 40–60 mm | Closure styles `CROWN`, `ROPP`, `CORK_CAPSULE`, `SPARKLING`, `POURER` (geometry follows the neck). Optional `tint` / `closureStyle` on `VesselOption`, filled for bottles (tint when the core material is only the nearest look) and cosmetic `ABS_BLACK`; passed through `VesselView`. | fixed |
| E-40 / X-11 (engine half) | low | `vessels/VesselScene.tsx` | Container viewer had no poster. | — | Optional `poster` prop with the same cross-fade as boxes. Passing a thumbnail is the designer's call (`Scene3D` passes none today). | fixed (engine) |
| E-41 / PERF-12 | high | `vessels/VesselModel.tsx` | Phones drew the same dense meshes. | — | Quality "low": 48 radial segments (liquid 32, surface 24) instead of 128 / 72 / 64. | fixed |
| E-42 / PERF-21 | medium | `vessels/VesselModel.tsx`, `VesselScene.tsx` | Vessel scenes kept working while idle: the turntable spun from load, and settled shrink sleeves rewrote and re-uploaded their vertices every frame. | — | Turntable waits for 4 s idle, pauses off-screen (E-23, E-17); settled sleeves are skipped. | fixed |
| E-43 / PERF-08 (engine half) | high | `hooks.ts · useArtworkTexture` | A resized artwork canvas allocates a new texture. | — | Not changed: a fixed-capacity texture with `texSubImage2D` + UV scale would change the UV contract of every board, finish and label material. The cost driver is the designer repainting and resizing the full sheet on every config change (E-35), which is the fix to make first. | open (reason given) |
| E-44 / PERF-03d | critical | `lib/dieline/fold.ts`, `generate.ts` | three.js core reaches non-3D pages through the dieline engine. | — | Not changed in this pass: `fold.ts` returns three `Box3` / `Matrix4` that the renderer and 30+ family generators consume. A local math layer has to land together with the families and the route split (E-34), or both copies of three's math ship. | open (reason given) |
| E-45 / FN-02 | high | `components/designer/lib/config.ts` | Spot UV invisible without a mask. | — | Designer scope (default the mask to the logo layer). The engine renders spot UV wherever a mask exists, now with a visible softbox streak. | open (designer scope) |

Counts over both passes (45 rows): **critical 5 (2 fixed, 3 open), high 13 (9 fixed, 4 open), medium 19 (17 fixed, 2 open), low 8 (all fixed)**. Open rows are outside this scope or deferred with the reason given.

## Screenshots

`docs/screenshots/audit/3d-engine/` (1440×900, 1× DPR, SwiftShader, reduced motion):

| View | Before | After |
|---|---|---|
| RSE mailer, kraft, test pattern | `before-rse-kraft-pattern.png` | `after-rse-kraft-pattern.png` |
| ECMA RTE carton | `before-carton-rte.png` | `after-carton-rte.png` |
| Rigid box | `before-rigid-box.png` | `after-rigid-box.png` |
| RSC at 50 % fold | `before-rsc-half-fold.png` | `after-rsc-half-fold.png` |
| Soft-touch + gold foil + spot UV | `before-finish-foil-spotuv-softtouch.png` | `after-finish-foil-spotuv-softtouch.png` |
| Gloss + emboss + silver foil on a table | `before-finish-gloss-emboss-table.png` | `after-finish-gloss-emboss-table.png` |
| Jar (vessel viewer) | `before-vessel.png` | `after-vessel.png` |
| Keyboard focus after ←←+ | `before-keyboard-focus.png` | `after-keyboard-focus.png` |

The face test pattern draws a white stroke round each face, so with it the wrapped fold / rigid edges show white; with real full-bleed artwork they carry the background colour.

## Tools

- `scripts/perf/measure-3d.cjs <base> <out.json> [label]`: the metrics table above.
- `scripts/perf/shots-3d.cjs <base> <dir> <prefix> [names]`: the screenshots.
- `?debug3d` on any page exposes live renderers as `window.__elba3d` for `renderer.info`.

## Files outside scope

- `scripts/perf/measure-3d.cjs`, `scripts/perf/shots-3d.cjs` (new, measurement only).
- `src/lib/library/types.ts` (optional `tint`, `closureStyle` on `VesselOption`), `src/lib/library/vessels.ts` (fills them), `src/components/designer/VesselView.tsx` (passes them, 5 lines): additive, at the integrator's request for X-01.
- `docs/audit/perf-3d/*.json`, this report, screenshots.

## Verification

| Check | Result |
|---|---|
| `npm run lint` | clean |
| `npm run typecheck` | clean |
| `npm test` | 43 files, 5 905 tests passed (incl. panel geometry group/UV/count tests) |
| `npm run build` | passes |
| `e2e/models.spec.ts` (every library model renders a non-blank canvas, desktop + mobile) | 380 passed |
| `e2e/designer`, `journey`, `smoke`, `checkout` | 10 passed, 9 failed at the OTP dev-code step / payment webhook (auth and payments, out of scope); the same 9 fail identically on the base build |
| Browser console on `/en/dev/3d` (all structures, fold 0 ↔ 1) and `/en/dev/finishes` | no page errors; remaining "unmount a root while rendering" message is React StrictMode in `next dev` only |

Re-measured after the last commit (final build): 50 draw calls, 0 idle frames, 14.7 fps drag / 15.5 fps keyboard at 4× in SwiftShader, 13 live textures and 14 framebuffers at both 0 and 50 switches.

### Pass 2 verification (after the EngineCanvas split, closures and tint)

| Check | Result |
|---|---|
| lint, typecheck, `npm test` (5 905), `npm run build` | pass |
| `e2e/models.spec.ts` desktop (every library model through the designer viewers) | 371 passed, 1 failed once on a React #418 hydration mismatch (CAN-TUNA; not 3D: the viewer is client-only), passed 3/3 on re-run |
| Production console on `/en/dev/3d` (all structures, fold 0 ↔ 1) and `/en/dev/finishes` | no errors |
| Probe after the refactor | 50 draw calls, 0 idle frames, 13 textures / 14 framebuffers at 0 and 50 switches (unchanged) |
| Browser check | Bordeaux bottle renders green glass with a cork capsule; beer longneck renders a fluted crown (were amber glass / screw caps) |
