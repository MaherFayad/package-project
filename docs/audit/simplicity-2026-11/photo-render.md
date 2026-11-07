# Photo render export (progress log)

Goal: a one-click «صورة واقعية» / "Photo render" export in the box designer that path-traces the
buyer's box (three-gpu-pathtracer) into a studio-quality PNG.

## Done
- `three-gpu-pathtracer@0.0.24` (last version whose peer range accepts three r180), exact pin.
- `src/components/three/photoRender.ts`: clones the live model (hover glow, lines and hidden
  objects stripped), converts materials to path-tracer PBR (paper roughness ~0.8, ink ~0.6,
  hot foil baked to metal via a roughness/metalness map, spot UV as a clear-coat map, lamination
  clear coat and soft-touch sheen copied), gradient studio sky, soft area key/fill/rim lights that
  follow the camera, ground plane. "studio" = light backdrop; "transparent" = see-through PNG with
  the shadow recovered by differential rendering (render / empty-ground render) and a raster
  coverage mask. Progressive samples, progress callback, AbortSignal, time budget.
- `renderPhoto(opts)` on `PackagingSceneHandle` / `EngineViewApi` (+ forwarders). The module
  and the path tracer load by dynamic import only; on error or no float targets it falls back to
  the supersampled screenshot.
- Designer: "Photo render" at the top of the image group (boxes only), see-through checkbox,
  progress bar + cancel in the export dialog, download `elba-<name>-photo.png`.
- i18n keys `designer.export.photo*` in en + ar.

## Findings (headed Chrome, RTX 5060 Ti, ANGLE D3D11)
- The path tracer's fragment shader takes ~58 s to compile on ANGLE/D3D11 the first time
  (~30 s in a second context; Chrome's GPU blob cache). Sampling itself is fast (200 spp at
  800x600 in ~4 s). Defines changed after setScene (DOF/FOG/BACKGROUND_MAP) trigger a second
  compile: preset them before setScene.
- `setSceneAsync` needs a BVH worker; use sync `setScene` (box models are small).
- FEATURE_MIS=0 cuts the compile from ~58 s to ~6 s (more grain; more samples + denoise cover it).
- 0.0.24 gives each mesh ONE material: multi-material panels (outside/inside/edge groups) must be
  split into one mesh per group, or materials shift (ground showed the board tile).
- `transmissiveBounces = 4` leaves ~1/3 of pixels black (NaN): keep the default 10.
- Working: 1600x1200, 384 spp, ~10 s end to end in headed Chrome (first render, compile included).

- The denoise filter blots paper grain into mottling: used only when the time budget stops
  sampling below 256 spp. Ink detection threshold sits above the kraft fibre noise.
- Final: 1600x1200, 1024 spp, ~15 s studio / ~14 s see-through (first render, compile included)
  on an RTX 5060 Ti. Images: scratchpad `photo-render/after-photo.png`, `after-photo-clear.png`,
  baseline `before-hd.png`.
- Checks: tsc, eslint (changed files), vitest three/designer/i18n (165 pass), i18n scopes regenerated.
  Dependency committed (ed4b1431); feature files left uncommitted alongside the parallel agents' work.

## Left
- Compile time on other GPUs/browsers not measured (MIS off; 150 s cap then screenshot fallback).
- Vessels have no renderPhoto (they get the supersampled screenshot fallback, option hidden).
- See-through mode shows faint grain on the far floor at grazing angles.

## Next
- Headed Chrome verification on /en/design/mailer-box, compare with the HD PNG, tune lights.
- Checks: tsc, eslint, vitest (three, designer), i18n scopes --check, bundle check.
